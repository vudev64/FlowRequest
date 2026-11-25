import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import User from '../models/User.js';
import Request from '../models/Request.js';
import Department from '../models/Department.js';
import AuditLog from '../models/Auditlog.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { createAuditLog } from '../services/AuditService.js';
import { getEffectiveSettings } from '../services/SettingsService.js';
import { zonedDayStart } from '../services/TimeZoneService.js';
import { ACCOUNT_CREATION_ROLES, isReservedDemoEmail, isSharedDemoAccount } from '../config/accountPolicy.js';

export const ADMIN_ROLES = ['DIRECTOR', 'HR_ADMIN', 'SYSTEM_ADMIN'];
const router = express.Router();
router.use(protect, authorize('SYSTEM_ADMIN'));
const httpError = (status, message) => Object.assign(new Error(message), { status });
const respondError = (res, error) => res.status(error.status || (error.code === 11000 ? 409 : 500)).json({ message: error.status ? error.message : error.code === 11000 ? 'Email đã tồn tại.' : 'Không thể xử lý dữ liệu quản trị.' });
const accountDto = (u, actor) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role, department: u.department, status: u.status || 'ACTIVE', createdAt: u.createdAt, isCurrentUser: String(u._id) === String(actor) });
const validId = id => { if (!mongoose.isValidObjectId(id)) throw httpError(400, 'ID tài khoản không hợp lệ.'); };
const temporaryPassword = async () => {
  const { security } = await getEffectiveSettings();
  return `Aa1!${randomBytes(48).toString('base64url').slice(0, Math.max(24, security.password.minLength) - 4)}`;
};

router.get('/accounts', async (req, res) => {
  try {
    const [users, departments, departmentNames] = await Promise.all([
      User.find({ role: { $in: ADMIN_ROLES } }).select('-password').sort({ createdAt: -1 }),
      Department.find().select('name').sort({ name: 1 }),
      User.distinct('department'),
    ]);
    // Legacy users store department names; allow those departments without fabricating DB records.
    const choices = departments.map(d => ({ id: String(d._id), name: d.name }));
    for (const name of departmentNames) if (typeof name === 'string' && name.trim() && !choices.some(d => d.name === name)) choices.push({ id: name, name });
    res.json({ accounts: users.map(u => accountDto(u, req.user._id)), departments: choices });
  } catch (error) { respondError(res, error); }
});

router.post('/accounts', async (req, res) => {
  try {
    const { name, email, role, departmentId } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim()) || !ACCOUNT_CREATION_ROLES.SYSTEM_ADMIN.includes(role) || isReservedDemoEmail(email) || typeof departmentId !== 'string' || !departmentId.trim()) throw httpError(400, 'Vui lòng nhập tên, email, phòng ban và vai trò quản trị hợp lệ.');
    let department;
    if (mongoose.isValidObjectId(departmentId)) department = (await Department.findById(departmentId))?.name;
    if (!department && await User.exists({ department: departmentId })) department = departmentId;
    if (!department) throw httpError(400, 'Phòng ban không tồn tại.');
    const password = await temporaryPassword();
    const created = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), role, department, password: await bcrypt.hash(password, 10) });
    await createAuditLog(req, { action: 'CREATE_ADMIN_ACCOUNT', targetEntity: 'User', targetId: created._id, newValue: { name: created.name, email: created.email, role, department } });
    res.status(201).json({ account: accountDto(created, req.user._id), temporaryPassword: password });
  } catch (error) { respondError(res, error); }
});

router.post('/accounts/:id/reset-password', async (req, res) => {
  try {
    validId(req.params.id);
    const target = await User.findOne({ _id: req.params.id, role: { $in: ADMIN_ROLES } });
    if (!target) throw httpError(404, 'Không tìm thấy tài khoản quản trị.');
    if (isSharedDemoAccount(target.email)) throw httpError(403, 'Không thể đổi mật khẩu tài khoản mẫu dùng chung. Hãy tạo tài khoản mới để trải nghiệm.');
    const password = await temporaryPassword();
    const updated = await User.findOneAndUpdate({ _id: req.params.id, role: { $in: ADMIN_ROLES } }, { $set: { password: await bcrypt.hash(password, 10) }, $inc: { tokenVersion: 1 } }, { new: true });
    if (!updated) throw httpError(404, 'Không tìm thấy tài khoản quản trị.');
    await createAuditLog(req, { action: 'RESET_ADMIN_PASSWORD', targetEntity: 'User', targetId: updated._id, newValue: { sessionsRevoked: true } });
    res.json({ temporaryPassword: password });
  } catch (error) { respondError(res, error); }
});

router.patch('/accounts/:id/status', async (req, res) => {
  let session;
  try {
    validId(req.params.id);
    const { status } = req.body || {};
    if (!['ACTIVE', 'INACTIVE'].includes(status)) throw httpError(400, 'Trạng thái không hợp lệ.');
    if (status === 'INACTIVE' && String(req.user._id) === String(new mongoose.Types.ObjectId(req.params.id))) throw httpError(403, 'Bạn không được tự khóa tài khoản đang sử dụng.');
    session = await mongoose.startSession();
    let changed, oldStatus;
    await session.withTransaction(async () => {
      // Touch the actor as well as the target: concurrent admins cannot deactivate each other.
      const actor = await User.findOneAndUpdate({ _id: req.user._id, role: 'SYSTEM_ADMIN', status: { $ne: 'INACTIVE' } }, { $inc: { adminRevision: 1 } }, { session });
      if (!actor) throw httpError(403, 'Phiên quản trị không còn hiệu lực.');
      const target = await User.findOne({ _id: req.params.id, role: { $in: ADMIN_ROLES } }).session(session);
      if (!target) throw httpError(404, 'Không tìm thấy tài khoản quản trị.');
      if (isSharedDemoAccount(target.email)) throw httpError(403, 'Không thể khóa hoặc sửa tài khoản mẫu dùng chung.');
      oldStatus = target.status || 'ACTIVE';
      if (status === 'INACTIVE') {
        if (target.role === 'SYSTEM_ADMIN' && await User.countDocuments({ role: 'SYSTEM_ADMIN', status: { $ne: 'INACTIVE' } }).session(session) <= 1) throw httpError(409, 'Phải giữ ít nhất một System Admin đang hoạt động.');
        if (await User.exists({ managerId: target._id, status: { $ne: 'INACTIVE' } }).session(session)) throw httpError(409, 'Cần chuyển nhân viên cấp dưới trước khi khóa quản lý.');
        if (await Request.exists({ currentApprover: target._id, status: { $in: ['PENDING_MANAGER', 'PENDING_DIRECTOR'] } }).session(session)) throw httpError(409, 'Tài khoản còn đơn chờ xử lý.');
      }
      changed = await User.findOneAndUpdate({ _id: target._id }, { $set: { status }, ...(status !== oldStatus ? { $inc: { tokenVersion: 1 } } : {}) }, { session, new: true });
    });
    await createAuditLog(req, { action: 'UPDATE_ADMIN_STATUS', targetEntity: 'User', targetId: changed._id, oldValue: { status: oldStatus }, newValue: { status } });
    res.json({ account: accountDto(changed, req.user._id) });
  } catch (error) { respondError(res, error); }
  finally { if (session) await session.endSession(); }
});

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function sanitizeAuditValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !/password|token|secret/i.test(key)).map(([key, v]) => [key, sanitizeAuditValue(v)]));
  return value;
}
router.get('/logs', async (req, res) => {
  try {
    const query = {}, conditions = [];
    const page = Number(req.query.page || 1), limit = 20;
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) throw httpError(400, 'Trang không hợp lệ.');
    if (req.query.action) query.action = String(req.query.action).slice(0, 100);
    if (req.query.result === 'SUCCESS') conditions.push({ $or: [{ result: 'SUCCESS' }, { result: { $exists: false } }] });
    else if (req.query.result === 'FAILURE') query.result = { $in: ['FAILURE', 'FAIL'] };
    else if (req.query.result) throw httpError(400, 'Kết quả không hợp lệ.');
    const timeZone = req.query.from || req.query.to ? (await getEffectiveSettings()).general.timeZone : null;
    for (const [field, operation] of [['from', '$gte'], ['to', '$lt']]) {
      if (!req.query[field]) continue;
      const raw = String(req.query[field]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw)) || new Date(raw).toISOString().slice(0, 10) !== raw) throw httpError(400, 'Ngày lọc không hợp lệ.');
      query.createdAt ||= {};
      const day = field === 'to' ? new Date(Date.parse(raw) + 86400000).toISOString().slice(0, 10) : raw;
      query.createdAt[operation] = zonedDayStart(day, timeZone);
    }
    if (query.createdAt?.$gte && query.createdAt?.$lt && query.createdAt.$gte >= query.createdAt.$lt) throw httpError(400, 'Khoảng ngày không hợp lệ.');
    if (req.query.search) {
      const regex = new RegExp(escapeRegex(String(req.query.search).trim().slice(0, 128)), 'i');
      const actors = await User.find({ $or: [{ name: regex }, { email: regex }] }).select('_id');
      conditions.push({ $or: [{ actor: { $in: actors.map(u => u._id) } }, { action: regex }, { targetEntity: regex }, { ipAddress: regex }, ...(mongoose.isValidObjectId(req.query.search) ? [{ targetId: req.query.search }] : [])] });
    }
    if (conditions.length) query.$and = conditions;
    const total = await AuditLog.countDocuments(query), totalPages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(page, totalPages);
    const records = await AuditLog.find(query).populate('actor', 'name role').sort({ createdAt: -1, _id: -1 }).skip((currentPage - 1) * limit).limit(limit).lean();
    res.json({ items: records.map(log => ({ id: String(log._id), actorName: log.actor?.name || '—', actorRole: log.actor?.role || '', action: log.action, target: `${log.targetEntity} · ${log.targetId}`, result: log.result || 'SUCCESS', ip: log.ipAddress, userAgent: log.userAgent, createdAt: log.createdAt, oldValue: sanitizeAuditValue(log.changes?.oldValue), newValue: sanitizeAuditValue(log.changes?.newValue) })), total, page: currentPage, totalPages });
  } catch (error) { respondError(res, error); }
});
export default router;
