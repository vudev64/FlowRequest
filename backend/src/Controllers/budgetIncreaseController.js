import mongoose from 'mongoose';
import BudgetIncreaseRequest from '../models/BudgetIncreaseRequest.js';
import Department from '../models/Department.js';
import AuditLog from '../models/Auditlog.js';
import { entityId } from '../services/FinanceService.js';

const failure = (status, message) => Object.assign(new Error(message), { status });
const scope = user => user.role === 'ACCOUNTANT' ? { createdBy: user._id } : {};
const respondError = (res, error) => res.status(error.status || 500).json({ message: error.status ? error.message : 'Không thể xử lý yêu cầu bổ sung ngân sách. Chưa có thay đổi được xác nhận; hãy tải lại danh sách.' });
const fieldsOnly = (body, keys) => body && !Array.isArray(body) && Object.keys(body).every(key => keys.includes(key));
const validId = id => { if (!mongoose.isValidObjectId(id)) throw failure(400, 'ID không hợp lệ.'); };
const dto = row => ({
  id: entityId(row), department: { id: entityId(row.department), name: row.department?.name || row.departmentName,
    allocatedAmount: row.department?.annualBudget ?? null, committedAmount: row.department?.usedBudget ?? null },
  amount: row.amount, reason: row.reason, status: row.status, createdAt: row.createdAt,
  createdBy: { id: entityId(row.createdBy), name: row.createdBy?.name || '—' },
  decidedBy: row.decidedBy ? { id: entityId(row.decidedBy), name: row.decidedBy?.name || '—' } : null,
  decidedAt: row.decidedAt || null, decisionReason: row.decisionReason || '',
  budgetBefore: row.budgetBefore ?? null, budgetAfter: row.budgetAfter ?? null,
});
const populate = query => query.populate('department', 'name annualBudget usedBudget').populate('createdBy', 'name').populate('decidedBy', 'name');

export async function listBudgetIncreases(req, res) {
  try {
    const page = Number(req.query.page || 1), limit = Number(req.query.limit || 20);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw failure(400, 'Phân trang không hợp lệ.');
    const query = scope(req.user);
    if (req.query.status) {
      if (!['PENDING','APPROVED','REJECTED'].includes(req.query.status)) throw failure(400, 'Trạng thái không hợp lệ.');
      query.status = req.query.status;
    }
    const [rows, total] = await Promise.all([
      populate(BudgetIncreaseRequest.find(query)).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      BudgetIncreaseRequest.countDocuments(query),
    ]);
    res.json({ data: { items: rows.map(dto), total, page, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) { respondError(res, error); }
}
export async function getBudgetIncrease(req, res) {
  try {
    validId(req.params.id);
    const row = await populate(BudgetIncreaseRequest.findOne({ _id: req.params.id, ...scope(req.user) })).lean();
    if (!row) throw failure(404, 'Không tìm thấy yêu cầu hoặc bạn không có quyền xem.');
    res.json({ data: dto(row) });
  } catch (error) { respondError(res, error); }
}
export async function createBudgetIncrease(req, res) {
  let session;
  const key = req.get('Idempotency-Key');
  const matches = row => entityId(row.department) === req.body.departmentId && row.amount === req.body.amount && row.reason === req.body.reason.trim();
  try {
    if (!fieldsOnly(req.body, ['departmentId','amount','reason'])) throw failure(400, 'Có trường yêu cầu không được phép.');
    validId(req.body.departmentId);
    if (!Number.isSafeInteger(req.body.amount) || req.body.amount <= 0 || typeof req.body.reason !== 'string' || !req.body.reason.trim() || req.body.reason.trim().length > 2000) throw failure(400, 'Cần số tiền nguyên dương và lý do tối đa 2000 ký tự.');
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,80}$/.test(key)) throw failure(400, 'Thiếu mã chống gửi trùng yêu cầu.');
    await BudgetIncreaseRequest.init();
    session = await mongoose.startSession();
    let saved, replayed = false;
    await session.withTransaction(async () => {
      const existing = await BudgetIncreaseRequest.findOne({ createdBy: req.user._id, idempotencyKey: key }).session(session);
      if (existing) {
        if (!matches(existing)) throw failure(409, 'Mã gửi đã được dùng với nội dung khác.');
        saved = existing; replayed = true; return;
      }
      const department = await Department.findById(req.body.departmentId).session(session);
      if (!department) throw failure(404, 'Ngân sách phòng ban chưa tồn tại. Cần thiết lập trước khi yêu cầu bổ sung.');
      [saved] = await BudgetIncreaseRequest.create([{ department: department._id, departmentName: department.name, amount: req.body.amount,
        reason: req.body.reason.trim(), createdBy: req.user._id, idempotencyKey: key }], { session });
      await AuditLog.create([{ actor: req.user._id, action: 'REQUEST_BUDGET_INCREASE', targetEntity: 'BudgetIncreaseRequest', targetId: saved._id,
        changes: { newValue: { department: entityId(department), amount: saved.amount, status: 'PENDING' } }, ipAddress: req.ip, userAgent: req.get('user-agent') || 'UNKNOWN' }], { session });
    });
    res.status(replayed ? 200 : 201).json({ data: { id: entityId(saved), status: saved.status, replayed } });
  } catch (error) {
    if (error.code === 11000) {
      try {
        const existing = await BudgetIncreaseRequest.findOne({ createdBy: req.user._id, idempotencyKey: key });
        if (existing && matches(existing)) return res.json({ data: { id: entityId(existing), status: existing.status, replayed: true } });
        throw failure(409, 'Mã gửi đã được dùng với nội dung khác.');
      } catch (lookupError) { return respondError(res, lookupError); }
    }
    respondError(res, error);
  } finally { if (session) await session.endSession(); }
}
export async function decideBudgetIncrease(req, res) {
  let session;
  try {
    validId(req.params.id);
    if (!fieldsOnly(req.body, ['action','reason']) || !['APPROVED','REJECTED'].includes(req.body.action)) throw failure(400, 'Hành động không hợp lệ.');
    const reason = req.body.reason == null ? '' : req.body.reason;
    if (typeof reason !== 'string' || reason.trim().length > 2000 || (req.body.action === 'REJECTED' && !reason.trim())) throw failure(400, 'Cần lý do từ chối; ghi chú tối đa 2000 ký tự.');
    session = await mongoose.startSession();
    let saved;
    await session.withTransaction(async () => {
      const row = await BudgetIncreaseRequest.findById(req.params.id).session(session);
      if (!row) throw failure(404, 'Không tìm thấy yêu cầu.');
      if (row.status !== 'PENDING') throw failure(409, 'Yêu cầu đã được xử lý. Hãy tải lại danh sách.');
      if (entityId(row.createdBy) === entityId(req.user)) throw failure(403, 'Không được tự duyệt yêu cầu của mình.');
      const department = await Department.findById(row.department).session(session);
      const approved = req.body.action === 'APPROVED';
      if (approved && !department) throw failure(404, 'Ngân sách phòng ban không còn tồn tại.');
      const before = department?.annualBudget ?? null;
      if (approved && (!Number.isSafeInteger(before) || before < 0 || !Number.isSafeInteger(department.usedBudget) || department.usedBudget < 0 || department.usedBudget > before || !Number.isSafeInteger(row.amount) || row.amount <= 0 || !Number.isSafeInteger(before + row.amount))) throw failure(400, 'Số liệu ngân sách không hợp lệ hoặc vượt giới hạn số tiền.');
      const after = approved ? before + row.amount : before;
      saved = await BudgetIncreaseRequest.findOneAndUpdate({ _id: row._id, status: 'PENDING' }, { $set: { status: req.body.action, decidedBy: req.user._id,
        decidedAt: new Date(), decisionReason: reason.trim(), budgetBefore: before, budgetAfter: after } }, { session, returnDocument: 'after', runValidators: true });
      if (!saved) throw failure(409, 'Yêu cầu vừa được người khác xử lý.');
      if (approved) {
        const changed = await Department.findOneAndUpdate({ _id: department._id, annualBudget: before }, { $inc: { annualBudget: row.amount, budgetRevision: 1 } }, { session, returnDocument: 'after', runValidators: true });
        if (!changed) throw failure(409, 'Ngân sách vừa thay đổi. Hãy tải lại.');
      }
      await AuditLog.create([{ actor: req.user._id, action: approved ? 'APPROVE_BUDGET_INCREASE' : 'REJECT_BUDGET_INCREASE', targetEntity: 'BudgetIncreaseRequest', targetId: row._id,
        changes: { oldValue: { status: 'PENDING', allocatedAmount: before }, newValue: { status: saved.status, department: entityId(row.department), amount: row.amount, allocatedAmount: after, reason: reason.trim() } },
        ipAddress: req.ip, userAgent: req.get('user-agent') || 'UNKNOWN' }], { session });
    });
    res.json({ data: { id: entityId(saved), status: saved.status, budgetBefore: saved.budgetBefore, budgetAfter: saved.budgetAfter } });
  } catch (error) { respondError(res, error); }
  finally { if (session) await session.endSession(); }
}
