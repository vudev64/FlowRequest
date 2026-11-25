import mongoose from 'mongoose';
import { fileDigests, storageFor } from '../services/DocumentStorage.js';
import { createHash } from 'node:crypto';
import Request from '../models/Request.js';
import Department from '../models/Department.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import AuditLog from '../models/Auditlog.js';
import { ROLES } from '../constants/enums.js';
import { requestDetailQuery } from '../services/RequestAccessService.js';
import { approvalSnapshot, calendarDay, entityId, financeScope, paymentDto } from '../services/FinanceService.js';
import { getEffectiveSettings } from '../services/SettingsService.js';
import { zonedDayStart } from '../services/TimeZoneService.js';

const failure = (status, message) => Object.assign(new Error(message), { status });
const digest = value => createHash('sha256').update(value).digest('hex');
function checkPaymentReplay(payment, fingerprint) {
  if (payment.fingerprint !== fingerprint) throw failure(409, 'Mã ghi nhận đã được dùng với dữ liệu khác. Hãy tải lại lịch sử thanh toán.');
}
function paymentResponse(res, payment, requestId, replayed) {
  return res.status(replayed ? 200 : 201).json({ data: { id: entityId(payment), requestId, amount: payment.amount, paidOn: payment.paidOn, replayed } });
}

export async function financeSummary(req, res) {
  try {
    const requests = await Request.find(financeScope(req.user)).populate('author', 'name department').lean();
    const ids = requests.map(row => row._id);
    const totals = await Payment.aggregate([{ $match: { request: { $in: ids } } }, { $group: { _id: '$request', amount: { $sum: '$amount' } } }]);
    const paid = new Map(totals.map(row => [entityId(row._id), row.amount]));
    const rows = requests.map(row => {
      const approval = approvalSnapshot(row), paidAmount = paid.get(entityId(row)) || 0;
      const needsPaymentReview = (row.paidAmount || 0) !== paidAmount;
      return { id: entityId(row), title: row.title, type: row.type, category: row.category, author: { id: entityId(row.author), name: row.author?.name || '—' }, approvedAmount: approval.amount, approvedAt: approval.approvedAt || null, paidAmount, remainingAmount: Math.max(0, approval.amount - paidAmount), paymentAllowed: req.user.role === ROLES.ACCOUNTANT && approval.verified && !needsPaymentReview && approval.amount > paidAmount && entityId(row.author) !== entityId(req.user), isOwnRequest: entityId(row.author) === entityId(req.user), needsApprovalReview: !approval.verified, needsPaymentReview };
    });
    const departmentIds = requests.map(row => row.budgetDepartment || row.department).filter(Boolean);
    const departments = await Department.find(req.user.role === ROLES.DIRECTOR ? { _id: { $in: departmentIds } } : {}).sort({ name: 1 }).lean();
    const purchaseIds = requests.filter(row => row.type === 'PURCHASE').map(row => row._id);
    const spent = await Payment.aggregate([{ $match: { request: { $in: purchaseIds } } }, { $group: { _id: '$department', amount: { $sum: '$amount' } } }]);
    const byDepartment = new Map(spent.map(row => [entityId(row._id), row.amount]));
    const approvedAmount = rows.reduce((sum, row) => sum + row.approvedAmount, 0), paidAmount = rows.reduce((sum, row) => sum + row.paidAmount, 0);
    const departmentOptions = req.user.role === ROLES.ACCOUNTANT ? (await User.distinct('department')).filter(value => typeof value === 'string' && value.trim()).sort() : [];
    const unassignedApprovedAmount = requests.filter(row => row.type === 'PURCHASE' && !row.budgetDepartment && !row.department).reduce((sum, row) => sum + approvalSnapshot(row).amount, 0);
    res.json({ data: { scope: req.user.role === ROLES.DIRECTOR ? 'ACCESSIBLE_REQUESTS' : 'ACCOUNTING', currency: 'VND', approvedAmount, paidAmount, outstandingAmount: approvedAmount - paidAmount, approvedCount: rows.length, requests: rows, budgets: departments.map(dept => ({ id: entityId(dept), name: dept.name, code: dept.code, revision: dept.budgetRevision || 0, allocatedAmount: dept.annualBudget, committedAmount: dept.usedBudget, availableAmount: dept.annualBudget - dept.usedBudget, paidAmount: byDepartment.get(entityId(dept)) || 0 })), departmentOptions, unassignedApprovedAmount, unassignedPaidAmount: byDepartment.get('') || 0 } });
  } catch { res.status(500).json({ message: 'Không thể tải số liệu ngân sách và thanh toán.' }); }
}

export async function saveBudget(req, res) {
  let session;
  try {
    const editing = Boolean(req.params.departmentId);
    const allowed = editing ? ['allocatedAmount', 'revision'] : ['name', 'code', 'allocatedAmount', 'openingCommittedAmount'];
    if (Object.keys(req.body).some(key => !allowed.includes(key))) throw failure(400, 'Có trường ngân sách không được phép.');
    const amount = req.body.allocatedAmount, opening = req.body.openingCommittedAmount;
    if (req.body.allocatedAmount === '' || !Number.isSafeInteger(amount) || amount < 0) throw failure(400, 'Ngân sách cấp phải là số nguyên không âm.');
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '', code = typeof req.body.code === 'string' ? req.body.code.trim().toUpperCase() : '';
    if (!editing && (!name || !/^[A-Z0-9_-]{2,30}$/.test(code) || req.body.openingCommittedAmount === '' || !Number.isSafeInteger(opening) || opening < 0 || opening > amount || !await User.exists({ department: name }))) throw failure(400, 'Cần chọn phòng ban có thật, mã và số cam kết ban đầu hợp lệ.');
    if (editing && (!mongoose.isValidObjectId(req.params.departmentId) || !Number.isSafeInteger(req.body.revision) || req.body.revision < 0)) throw failure(400, 'Phiên bản ngân sách không hợp lệ.');
    session = await mongoose.startSession();
    let saved;
    await session.withTransaction(async () => {
      const old = editing ? await Department.findById(req.params.departmentId).session(session).lean() : null;
      if (editing) {
        if (!old) throw failure(404, 'Không tìm thấy ngân sách.');
        if (amount > old.annualBudget) throw failure(403, 'Tăng ngân sách cần gửi yêu cầu bổ sung và được Giám đốc phê duyệt.');
        if (amount < old.usedBudget) throw failure(400, 'Không thể giảm ngân sách dưới số đã cam kết.');
        saved = await Department.findOneAndUpdate({ _id: old._id, usedBudget: { $lte: amount }, $expr: { $eq: [{ $ifNull: ['$budgetRevision', 0] }, req.body.revision] } }, { $set: { annualBudget: amount }, $inc: { budgetRevision: 1 } }, { session, returnDocument: 'after', runValidators: true });
        if (!saved) throw failure(409, 'Ngân sách đã thay đổi. Hãy tải lại trước khi lưu.');
      } else [saved] = await Department.create([{ name, code, annualBudget: amount, usedBudget: opening, budgetRevision: 1 }], { session });
      await AuditLog.create([{ actor: req.user._id, action: editing ? 'UPDATE_BUDGET' : 'CREATE_BUDGET', targetEntity: 'Department', targetId: saved._id, changes: { oldValue: old ? { annualBudget: old.annualBudget, usedBudget: old.usedBudget } : null, newValue: { annualBudget: saved.annualBudget, usedBudget: saved.usedBudget, openingBalance: !editing } }, ipAddress: req.ip, userAgent: req.get('user-agent') || 'UNKNOWN' }], { session });
    });
    res.status(editing ? 200 : 201).json({ data: { id: entityId(saved), revision: saved.budgetRevision } });
  } catch (error) { res.status(error.status || (error.code === 11000 ? 409 : 500)).json({ message: error.status ? error.message : error.code === 11000 ? 'Phòng ban đã có ngân sách. Hãy tải lại.' : 'Không thể lưu ngân sách. Chưa có thay đổi được áp dụng.' }); }
  finally { if (session) await session.endSession(); }
}

export async function paymentHistory(req, res) {
  try {
    const page = Number(req.query.page || 1), limit = Number(req.query.limit || 20);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw failure(400, 'Phân trang không hợp lệ.');
    const scope = financeScope(req.user);
    if (req.query.requestId) {
      if (!mongoose.isValidObjectId(req.query.requestId)) throw failure(400, 'ID đơn không hợp lệ.');
      scope._id = req.query.requestId;
      if (!await Request.exists(scope)) throw failure(404, 'Không tìm thấy đơn hoặc bạn không có quyền xem.');
    }
    const requests = await Request.find(scope).select('_id').lean();
    const filter = { request: { $in: requests.map(row => row._id) } };
    const [rows, total] = await Promise.all([
      Payment.find(filter).populate('request', 'title type').populate('performedBy', 'name').sort({ paidAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Payment.countDocuments(filter),
    ]);
    res.json({ data: { items: rows.map(paymentDto), total, page, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) { res.status(error.status || 500).json({ message: error.status ? error.message : 'Không thể tải lịch sử thanh toán.' }); }
}

export async function recordPayment(req, res) {
  const store = req.file && storageFor(req);
  let session, readyToCommit = false;
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw failure(400, 'ID đơn không hợp lệ.');
    if (Object.keys(req.body).some(key => !['amount', 'paidOn', 'note'].includes(key))) throw failure(400, 'Có trường thanh toán không được phép.');
    const amount = Number(req.body.amount), paidOn = req.body.paidOn, note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
    const key = req.get('Idempotency-Key');
    if (!Number.isSafeInteger(amount) || amount <= 0) throw failure(400, 'Số tiền thanh toán phải là số nguyên dương hợp lệ.');
    if (typeof paidOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(paidOn) || Number.isNaN(Date.parse(`${paidOn}T00:00:00Z`)) || new Date(`${paidOn}T00:00:00Z`).toISOString().slice(0, 10) !== paidOn) throw failure(400, 'Ngày thanh toán không hợp lệ.');
    if (note.length > 2000 || (req.body.note != null && typeof req.body.note !== 'string')) throw failure(400, 'Ghi chú tối đa 2000 ký tự.');
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,80}$/.test(key)) throw failure(400, 'Thiếu mã chống ghi nhận trùng thanh toán.');
    if (!req.file) throw failure(400, 'Cần tải lên chứng từ thanh toán.');
    const { general } = await getEffectiveSettings();
    const today = calendarDay(new Date(), general.timeZone);
    if (paidOn > today) throw failure(400, 'Không ghi nhận ngày thanh toán trong tương lai.');
    const hashes = await fileDigests(req.file);
    const { sha256 } = hashes;
    const fingerprint = digest(JSON.stringify({ request: req.params.id, amount, paidOn, note, actor: entityId(req.user), sha256 }));
    await Payment.init();
    const paymentKey = { request: req.params.id, idempotencyKey: key };
    // A completed payment can be replayed even during a storage outage.
    if (store.remote || store.writeGrid) {
      const existing = await Payment.findOne(paymentKey).lean();
      if (existing) {
        checkPaymentReplay(existing, fingerprint);
        return paymentResponse(res, existing, req.params.id, true);
      }
    }
    session = await mongoose.startSession();
    let saved, replayed = false;
    const voucherPath = await store.persist('payment-vouchers', req.file, hashes);
    await session.withTransaction(async () => {
      readyToCommit = false;
      const existing = await Payment.findOne(paymentKey).session(session);
      if (existing) {
        checkPaymentReplay(existing, fingerprint);
        saved = existing; replayed = true; return;
      }
      const request = await Request.findById(req.params.id).session(session);
      const approval = request && approvalSnapshot(request);
      if (!approval?.verified) throw failure(400, 'Đơn chưa được duyệt hợp lệ hoặc thiếu lịch sử duyệt để ghi nhận thanh toán.');
      if (entityId(request.author) === entityId(req.user)) throw failure(403, 'Người tạo không tự xác nhận thanh toán cho đơn của mình.');
      if (paidOn < calendarDay(approval.approvedAt, general.timeZone)) throw failure(400, 'Ngày thanh toán không được trước ngày phê duyệt.');
      const totals = await Payment.aggregate([{ $match: { request: request._id } }, { $group: { _id: null, amount: { $sum: '$amount' } } }]).session(session);
      const paid = totals[0]?.amount || 0;
      if ((request.paidAmount || 0) !== paid) throw failure(409, 'Số liệu thanh toán cần đối soát trước khi ghi nhận tiếp.');
      if (paid + amount > approval.amount) throw failure(400, 'Số tiền thanh toán vượt số còn được phép chi.');
      const updated = await Request.findOneAndUpdate({ _id: request._id, status: 'APPROVED', $expr: { $lte: [{ $add: [{ $ifNull: ['$paidAmount', 0] }, amount] }, approval.amount] } }, {
        $inc: { paidAmount: amount },
        $set: { approvedAmount: approval.amount, approvedAt: approval.approvedAt, approvedBy: approval.approvedBy },
      }, { new: true, session, runValidators: true });
      if (!updated) throw failure(409, 'Đơn vừa có thay đổi thanh toán. Hãy tải lại.');
      if (store.writeGrid) await store.grid.bind(voucherPath.slice(1), req.file, session);
      [saved] = await Payment.create([{
        request: request._id, department: request.budgetDepartment || request.department || null, amount,
        paidOn, paidAt: zonedDayStart(paidOn, general.timeZone), timeZone: general.timeZone,
        performedBy: req.user._id, note, idempotencyKey: key, fingerprint,
        voucher: { path: voucherPath, originalName: req.file.originalname, mimeType: req.file.mimetype, sha256 },
      }], { session });
      await AuditLog.create([{
        actor: req.user._id, action: 'RECORD_PAYMENT', targetEntity: 'RequestPayment', targetId: saved._id,
        changes: { newValue: { requestId: req.params.id, amount, paidOn, voucher: saved.voucher.originalName } },
        ipAddress: req.ip || 'UNKNOWN', userAgent: req.get('user-agent') || 'UNKNOWN',
      }], { session });
      // The budget was committed at final approval. Payment never charges it again.
      readyToCommit = true;
    });
    if (replayed) await store.discard('payment-vouchers', req.file);
    paymentResponse(res, saved, req.params.id, replayed);
  } catch (error) {
    if (store && !readyToCommit) await store.discard('payment-vouchers', req.file);
    else if (readyToCommit) console.error('Cần đối soát kết quả ghi thanh toán và chứng từ:', req.file.filename);
    // Retain evidence on an ambiguous database/commit failure for reconciliation.
    res.status(error.status || (error.code === 11000 ? 409 : 500)).json({ message: error.status ? error.message : error.code === 11000 ? 'Thanh toán đang được ghi nhận. Hãy thử lại với cùng mã ghi nhận.' : 'Không thể ghi nhận thanh toán. Hãy kiểm tra lịch sử trước khi thử lại.' });
  } finally {
    if (store) await store.removeTemporary('payment-vouchers', req.file);
    if (session) await session.endSession();
  }
}

export async function downloadPaymentVoucher(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.paymentId)) throw failure(400, 'ID thanh toán không hợp lệ.');
    const payment = await Payment.findById(req.params.paymentId).lean();
    if (!payment || !await Request.exists(requestDetailQuery(req.user, payment.request))) throw failure(404, 'Không tìm thấy chứng từ hoặc bạn không có quyền xem.');
    if (!/^\/payment-vouchers\/[a-zA-Z0-9_.-]+$/.test(payment.voucher.path)) throw failure(404, 'Không tìm thấy chứng từ.');
    await storageFor(req).download(res, 'payment-vouchers', payment.voucher.path, payment.voucher.originalName);
  } catch (error) { if (!res.headersSent && !res.destroyed) res.status(error.status || 500).json({ message: error.status ? error.message : 'Không thể tải chứng từ.' }); }
}
