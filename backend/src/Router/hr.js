import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Request from '../models/Request.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { createAuditLog } from '../services/AuditService.js';
import { WORKFLOW } from '../config/workflow.js';
import { getEffectiveSettings, passwordError } from '../services/SettingsService.js';
import { ACCOUNT_CREATION_ROLES, isReservedDemoEmail, isSharedDemoAccount } from '../config/accountPolicy.js';
import { storageFor } from '../services/DocumentStorage.js';

export const HR_MANAGED_ROLES = ACCOUNT_CREATION_ROLES.HR_ADMIN;
export function validateHrAccount(body) {
  if (!['name', 'email', 'department'].every(key => typeof body[key] === 'string')) return 'Thông tin nhân sự không hợp lệ.';
  if (!HR_MANAGED_ROLES.includes(body.role)) return 'HR không được cấp hoặc sửa vai trò bảo vệ.';
  if (!String(body.name || '').trim() || !String(body.department || '').trim()) return 'Vui lòng nhập họ tên và phòng ban.';
  if (!/^\S+@\S+\.\S+$/.test(String(body.email || '').trim()) || isReservedDemoEmail(body.email)) return 'Email không hợp lệ.';
  return null;
}
const router = express.Router();
async function managerError(managerId, targetId) {
  if (!managerId) return null;
  if (!mongoose.isValidObjectId(managerId) || String(managerId) === String(targetId)) return 'Quản lý trực tiếp không hợp lệ.';
  const manager = await User.findOne({ _id: managerId, role: { $in: ['MANAGER', 'DIRECTOR'] }, status: { $ne: 'INACTIVE' } });
  if (!manager) return 'Quản lý không tồn tại hoặc đã bị khóa.';
  const visited = new Set([String(targetId)]);
  let current = manager;
  while (current) {
    if (visited.has(String(current._id))) return 'Quan hệ quản lý tạo thành vòng lặp.';
    visited.add(String(current._id));
    current = current.managerId ? await User.findById(current.managerId) : null;
  }
  return null;
}
router.use(protect, authorize('HR_ADMIN'));
router.get('/requests/:id/attachment', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'ID đơn không hợp lệ.' });
    const request = await Request.findOne({ _id: req.params.id, type: { $in: WORKFLOW.PENDING_HRADMIN.types }, status: { $ne: 'DRAFT' } });
    if (!request?.attachment || !/^\/uploads\/[a-zA-Z0-9_.-]+$/.test(request.attachment)) return res.status(404).json({ message: 'Không tìm thấy tài liệu.' });
    await storageFor(req).download(res, 'uploads', request.attachment);
  } catch (error) { if (!res.headersSent && !res.destroyed) res.status(error.status || 500).json({ message: 'Không thể tải tài liệu.' }); }
});
router.get('/users', async (req, res) => {
  try {
    const data = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ data });
  } catch { res.status(500).json({ message: 'Không thể tải danh sách nhân sự.' }); }
});
router.post('/users', async (req, res) => {
  try {
    const error = validateHrAccount(req.body);
    if (error || typeof req.body.password !== 'string' || req.body.password.length < 8) return res.status(400).json({ message: error || 'Mật khẩu cần tối thiểu 8 ký tự.' });
    const { security } = await getEffectiveSettings();
    const policyError = passwordError(req.body.password, security.password, 8);
    if (policyError) return res.status(400).json({ message: policyError });
    const { name, email, department, role } = req.body;
    const invalidManager = await managerError(req.body.managerId);
    if (invalidManager) return res.status(400).json({ message: invalidManager });
    const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), department: department.trim(), role, title: String(req.body.title || '').trim(), managerId: req.body.managerId || null, password: await bcrypt.hash(req.body.password, 10) });
    await createAuditLog(req, { action: 'CREATE_USER', targetEntity: 'User', targetId: user._id, newValue: { name: user.name, role } });
    const data = user.toObject(); delete data.password;
    res.status(201).json({ data });
  } catch (error) { res.status(error.code === 11000 ? 409 : 500).json({ message: error.code === 11000 ? 'Email đã tồn tại.' : 'Không thể tạo nhân sự.' }); }
});
router.patch('/users/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'ID không hợp lệ.' });
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'Không tìm thấy nhân sự.' });
    if (isSharedDemoAccount(target.email)) return res.status(403).json({ message: 'Tài khoản mẫu được bảo vệ để mọi người tiếp tục trải nghiệm Demo. Hãy tạo tài khoản mới để thử quản lý nhân sự.' });
    if (!HR_MANAGED_ROLES.includes(target.role) || String(target._id) === String(req.user._id)) return res.status(403).json({ message: 'HR không được sửa tài khoản này.' });
    const fields = {};
    for (const key of ['name', 'email', 'department', 'role', 'status', 'title', 'managerId']) if (req.body[key] !== undefined) fields[key] = req.body[key];
    if ('managerId' in fields) {
      const invalidManager = await managerError(fields.managerId, target._id);
      if (invalidManager) return res.status(400).json({ message: invalidManager });
      fields.managerId = fields.managerId || null;
    }
    const error = validateHrAccount({ ...target.toObject(), ...fields });
    if (error) return res.status(400).json({ message: error });
    if ('status' in fields && !['ACTIVE', 'INACTIVE'].includes(fields.status)) return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
    if ((fields.status === 'INACTIVE' || (fields.role && fields.role !== target.role)) && await Request.exists({ currentApprover: target._id, status: { $in: ['PENDING_MANAGER', 'PENDING_DIRECTOR'] } })) return res.status(409).json({ message: 'Tài khoản còn đơn chờ xử lý. Cần hoàn tất hoặc chuyển người duyệt trước.' });
    // Không để nhân viên đang hoạt động mất quản lý trực tiếp.
    if ((fields.status === 'INACTIVE' || (fields.role && fields.role !== target.role)) && await User.exists({ managerId: target._id, status: { $ne: 'INACTIVE' } })) return res.status(409).json({ message: 'Cần chuyển nhân viên cấp dưới sang quản lý khác trước khi khóa hoặc đổi vai trò.' });
    const oldValue = { name: target.name, role: target.role, status: target.status };
    if (fields.email) fields.email = String(fields.email).trim().toLowerCase();
    const revokeSessions = ('status' in fields && fields.status !== (target.status || 'ACTIVE')) || ('role' in fields && fields.role !== target.role);
    const data = await User.findOneAndUpdate({ _id: target._id, role: target.role, $expr: { $eq: [{ $ifNull: ['$tokenVersion', 0] }, target.tokenVersion || 0] } }, { $set: fields, ...(revokeSessions ? { $inc: { tokenVersion: 1 } } : {}) }, { new: true, runValidators: true }).select('-password');
    if (!data) return res.status(409).json({ message: 'Tài khoản đã thay đổi, hãy tải lại.' });
    await createAuditLog(req, { action: 'UPDATE_USER', targetEntity: 'User', targetId: target._id, oldValue, newValue: fields });
    res.json({ data });
  } catch (error) { res.status(error.code === 11000 ? 409 : 500).json({ message: error.code === 11000 ? 'Email đã tồn tại.' : 'Không thể cập nhật nhân sự.' }); }
});
export default router;
