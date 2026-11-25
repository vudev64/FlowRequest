import mongoose from 'mongoose';
import Request, { PURCHASE_CATEGORIES } from '../models/Request.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import { createAuditLog } from '../services/AuditService.js';
import { sendEmail } from '../services/EmailService.js';
import { FINANCIAL, REQUEST_TYPES, REQUEST_STATUS, ROLES, LEAVE_TYPES } from '../constants/enums.js';
import { WORKFLOW } from '../config/workflow.js';
import { requestDetailQuery, requestScopeQuery } from '../services/RequestAccessService.js';
import { FINANCE_TYPES } from '../services/FinanceService.js';
import { storageFor } from '../services/DocumentStorage.js';

// Lỗi có mã HTTP, dùng để dừng giao dịch và trả đúng thông báo
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Gửi mail / ghi audit thất bại thì chỉ ghi log, KHÔNG làm hỏng thao tác chính
const safe = async (fn) => {
  try {
    await fn();
  } catch (err) {
    console.error('Tác vụ phụ thất bại (mail/audit):', err.message);
  }
};

// Kiểm tra/chuẩn hóa dữ liệu server-side; không tin dữ liệu client tự tính.
const positiveInt = (v) => Number.isSafeInteger(Number(v)) && Number(v) > 0;
const validMoney = (v) => Number.isSafeInteger(Number(v)) && Number(v) >= 0;
const timeValid = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const dayValid = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
  && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
  && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const bad = (message) => { throw new HttpError(400, message); };
const cleanString = (v) => typeof v === 'string' ? v.trim() : '';
function countWeekdays(from, to) {
  // Chính sách ví dụ: T2-T6, chưa trừ ngày lễ/ngày nghỉ đặc biệt.
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if ((end - d) / 86400000 > 366) bad('Khoảng nghỉ phép quá dài');
  let count = 0;
  while (d <= end) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}
function buildTypedPayload(body, isDraft) {
  const { type } = body;
  const result = {};
  if (type === REQUEST_TYPES.PURCHASE) {
    const category = body.category || (isDraft ? null : null);
    if (category != null && !Object.values(PURCHASE_CATEGORIES).includes(category)) {
      bad('Danh mục mua sắm không hợp lệ');
    }
    if (!isDraft && !category) bad('Vui lòng chọn danh mục mua sắm');
    const d = body.purchaseDetails && typeof body.purchaseDetails === 'object' && !Array.isArray(body.purchaseDetails)
      ? body.purchaseDetails : {};
    const detail = { budgetCode: cleanString(d.budgetCode) };
    if (category === PURCHASE_CATEGORIES.EQUIPMENT) {
      detail.deviceName = cleanString(d.deviceName);
      if (d.quantity !== undefined && d.quantity !== '') detail.quantity = Number(d.quantity);
      if (d.unitPrice !== undefined && d.unitPrice !== '') detail.unitPrice = Number(d.unitPrice);
      if (!isDraft && (!detail.deviceName || !positiveInt(detail.quantity) || !validMoney(detail.unitPrice))) {
        bad('Thiết bị phải có tên, số lượng nguyên dương và đơn giá hợp lệ');
      }
      if (detail.quantity !== undefined && !positiveInt(detail.quantity)) bad('Số lượng không hợp lệ');
      if (detail.unitPrice !== undefined && !validMoney(detail.unitPrice)) bad('Đơn giá không hợp lệ');
      if (!isDraft && detail.quantity * detail.unitPrice !== Number(body.amount)) bad('Tổng tiền thiết bị không khớp');
    } else if (category === PURCHASE_CATEGORIES.SOFTWARE_LICENSE) {
      detail.softwareName = cleanString(d.softwareName);
      if (d.licenseCount !== undefined && d.licenseCount !== '') detail.licenseCount = Number(d.licenseCount);
      if (d.durationMonths !== undefined && d.durationMonths !== '') detail.durationMonths = Number(d.durationMonths);
      if (!isDraft && (!detail.softwareName || !positiveInt(detail.licenseCount) || !positiveInt(detail.durationMonths))) {
        bad('Phần mềm phải có tên, số license và thời hạn hợp lệ');
      }
      if (detail.licenseCount !== undefined && !positiveInt(detail.licenseCount)) bad('Số license không hợp lệ');
      if (detail.durationMonths !== undefined && !positiveInt(detail.durationMonths)) bad('Thời hạn không hợp lệ');
    } else if (category === PURCHASE_CATEGORIES.CLOUD_RESOURCE) {
      detail.cloudProvider = cleanString(d.cloudProvider);
      detail.resourceType = cleanString(d.resourceType);
      if (d.durationMonths !== undefined && d.durationMonths !== '') detail.durationMonths = Number(d.durationMonths);
      if (!isDraft && (!detail.cloudProvider || !detail.resourceType || !positiveInt(detail.durationMonths))) {
        bad('Cloud phải có nhà cung cấp, loại tài nguyên và thời hạn hợp lệ');
      }
      if (detail.durationMonths !== undefined && !positiveInt(detail.durationMonths)) bad('Thời hạn Cloud không hợp lệ');
    }
    return { category, purchaseDetails: detail };
  }
  if (body.category != null || body.purchaseDetails != null) bad('Danh mục mua sắm không dùng cho loại đơn này');
  if (type === REQUEST_TYPES.LEAVE) {
    const { leaveType, startDate, endDate, dayPart = 'FULL' } = body;
    if (leaveType && !Object.values(LEAVE_TYPES).includes(leaveType)) bad('Loại nghỉ phép không hợp lệ');
    if (!['FULL', 'AM', 'PM'].includes(dayPart)) bad('Hình thức nghỉ không hợp lệ');
    if (!isDraft && (!leaveType || !startDate || !endDate)) bad('Vui lòng nhập đủ thông tin nghỉ phép');
    if (startDate && !dayValid(startDate) || endDate && !dayValid(endDate)) bad('Ngày nghỉ không hợp lệ');
    if (startDate && endDate && endDate < startDate) bad('Ngày kết thúc trước ngày bắt đầu');
    if (dayPart !== 'FULL' && startDate && endDate && startDate !== endDate) bad('Nửa ngày chỉ được chọn một ngày');
    const leaveDays = startDate && endDate ? countWeekdays(startDate, endDate) : undefined;
    if (!isDraft && leaveDays === 0) bad('Khoảng nghỉ không có ngày làm việc');
    if (dayPart !== 'FULL' && leaveDays !== undefined && leaveDays !== 1) bad('Nghỉ nửa ngày phải rơi vào ngày làm việc');
    return {
      ...(leaveType && { leaveType }), ...(startDate && { startDate }), ...(endDate && { endDate }),
      dayPart, ...(leaveDays !== undefined && { leaveDays: dayPart === 'FULL' ? leaveDays : 0.5 }),
    };
  }
  if (type === REQUEST_TYPES.OVERTIME) {
    const projectName = cleanString(body.projectName);
    const { overtimeDate, overtimeStart, overtimeEnd } = body;
    if (!isDraft && (!projectName || !overtimeDate || !overtimeStart || !overtimeEnd)) bad('Vui lòng nhập đủ thông tin tăng ca');
    if (overtimeDate && !dayValid(overtimeDate)) bad('Ngày tăng ca không hợp lệ');
    if (overtimeStart && !timeValid(overtimeStart) || overtimeEnd && !timeValid(overtimeEnd)) bad('Giờ tăng ca không hợp lệ');
    let overtimeHours;
    if (overtimeStart && overtimeEnd) {
      const [h1, m1] = overtimeStart.split(':').map(Number);
      const [h2, m2] = overtimeEnd.split(':').map(Number);
      const minutes = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (minutes <= 0) bad('Giờ kết thúc phải sau giờ bắt đầu (chưa hỗ trợ OT qua đêm)');
      overtimeHours = Math.round((minutes / 60) * 100) / 100;
    }
    return {
      projectName, ...(overtimeDate && { overtimeDate }), ...(overtimeStart && { overtimeStart }),
      ...(overtimeEnd && { overtimeEnd }), ...(overtimeHours !== undefined && { overtimeHours }),
    };
  }
  // Các trường mới đều được kiểm tra và đưa vào danh sách trắng.
  const extraSpec = {
    [REQUEST_TYPES.ATTENDANCE_ADJUSTMENT]: ['attendanceDate','actualCheckIn','actualCheckOut'],
    [REQUEST_TYPES.WFH]: ['fromDate','toDate','workLocation'],
    [REQUEST_TYPES.BUSINESS_TRIP]: ['fromDate','toDate','destination','purpose'],
    [REQUEST_TYPES.TRAINING]: ['courseName','provider','fromDate','toDate'],
    [REQUEST_TYPES.RECRUITMENT]: ['position','headcount','requestedDepartment'],
  };
  if (extraSpec[type]) {
    const source = body.extraDetails;
    if (source != null && (typeof source !== 'object' || Array.isArray(source))) bad('Chi tiết đơn không hợp lệ');
    const d = source || {};
    const details = {};
    for (const key of extraSpec[type]) {
      if (d[key] != null && d[key] !== '') details[key] = key === 'headcount' ? Number(d[key]) : cleanString(d[key]);
    }
    if (!isDraft && extraSpec[type].some(k => details[k] == null || details[k] === '')) {
      bad('Vui lòng nhập đầy đủ thông tin riêng của loại đề xuất');
    }
    for (const key of ['attendanceDate','fromDate','toDate']) {
      if (details[key] && !dayValid(details[key])) bad('Ngày không hợp lệ');
    }
    if (details.fromDate && details.toDate && details.toDate < details.fromDate) bad('Ngày kết thúc trước ngày bắt đầu');
    for (const key of ['actualCheckIn','actualCheckOut']) {
      if (details[key] && !timeValid(details[key])) bad('Giờ chấm công không hợp lệ');
    }
    if (details.actualCheckIn && details.actualCheckOut && details.actualCheckIn >= details.actualCheckOut) {
      bad('Giờ ra phải sau giờ vào');
    }
    if (details.headcount !== undefined && !positiveInt(details.headcount)) bad('Số lượng tuyển dụng không hợp lệ');
    return { extraDetails: details };
  }
  return result;
}

// 1. Tạo đơn mới — lưu đúng type/category/chi tiết theo nghiệp vụ.
export const createRequest = async (req, res) => {
  const store = req.file && storageFor(req);
  let writing = false;
  try {
    const { type, title, content, amount = 0 } = req.body;
    const isDraft = req.body.isDraft === true || req.body.isDraft === 'true';
    if (!Object.values(REQUEST_TYPES).includes(type)) bad('Loại đề xuất không hợp lệ');
    if (!cleanString(title) || !cleanString(content)) bad('Vui lòng nhập tiêu đề và nội dung');
    const amountNum = Number(amount);
    if (!validMoney(amountNum)) bad('Số tiền phải là số nguyên không âm hợp lệ');
    if (![REQUEST_TYPES.PURCHASE, REQUEST_TYPES.BUSINESS_TRIP, REQUEST_TYPES.TRAINING].includes(type) && amountNum !== 0) bad('Loại đơn này không dùng số tiền');
    const detailFields = buildTypedPayload(req.body, isDraft);
    const employee = req.user;
    if (employee.role === ROLES.DIRECTOR) bad('Tài khoản Giám đốc không tạo đơn qua luồng này');
    const nganSach = await Department.findOne({ name: employee.department });
    if (!isDraft && type === REQUEST_TYPES.PURCHASE && nganSach) {
      const remaining = nganSach.annualBudget - nganSach.usedBudget;
      if (amountNum > remaining) bad(`Ngân sách phòng ban không đủ. Còn: ${remaining.toLocaleString('vi-VN')} VNĐ`);
    }
    let approver = null;
    if (!isDraft) {
      if (employee.role === ROLES.MANAGER) {
        approver = await User.findOne({ role: ROLES.DIRECTOR, status: { $ne: 'INACTIVE' } });
      } else {
        if (employee.managerId) approver = await User.findOne({ _id: employee.managerId, role: { $in: [ROLES.MANAGER, ROLES.DIRECTOR] }, status: { $ne: 'INACTIVE' } });
        if (!approver) approver = await User.findOne({
          department: employee.department, role: ROLES.MANAGER, _id: { $ne: employee._id }, status: { $ne: 'INACTIVE' },
        });
        if (!approver && nganSach?.putManager) {
          const assigned = await User.findById(nganSach.putManager);
          if (assigned && assigned.status !== 'INACTIVE' && assigned.role === ROLES.MANAGER && !assigned._id.equals(employee._id)) approver = assigned;
        }
        if (!approver) approver = await User.findOne({ role: ROLES.DIRECTOR, status: { $ne: 'INACTIVE' } });
      }
      if (!approver) bad('Chưa thiết lập người phê duyệt cho đơn');
    }
    const firstStatus = approver?.role === ROLES.DIRECTOR
      ? REQUEST_STATUS.PENDING_DIRECTOR : REQUEST_STATUS.PENDING_MANAGER;
    const requiresDirector = type === REQUEST_TYPES.PURCHASE && amountNum >= FINANCIAL.DIRECTOR;
    const attachment = store ? await store.persist('uploads', req.file) : '';
    writing = true;
    const values = {
      title: cleanString(title), type, content: cleanString(content), amount: amountNum,
      ...detailFields,
      attachment,
      author: employee._id, department: nganSach?._id ?? undefined,
      currentApprover: approver?._id ?? null,
      status: isDraft ? REQUEST_STATUS.DRAFT : firstStatus,
      requiresDirector,
    };
    const newRequest = store?.writeGrid
      ? await mongoose.connection.transaction(async session => {
          await store.grid.bind(attachment.slice(1), req.file, session);
          const [created] = await Request.create([values], { session });
          return created;
        })
      : await Request.create(values);
    await safe(() => createAuditLog(req, {
      action: 'CREATE_REQUEST', targetEntity: 'Request', targetId: newRequest._id,
      newValue: { title: newRequest.title, type: newRequest.type, category: newRequest.category,
        amount: newRequest.amount, status: newRequest.status, attachment: newRequest.attachment },
    }));
    if (!isDraft && approver?.email) {
      await safe(() => sendEmail({
        to: approver.email,
        subject: `[Yêu cầu phê duyệt] Đơn mới từ ${employee.name}`,
        html: `<p>Chào ${approver.name},</p><p>Bạn có một đề xuất cần duyệt.</p>`,
      }));
    }
    return res.status(201).json({
      success: true, message: isDraft ? 'Đã lưu bản nháp.' : 'Đã gửi đề xuất thành công.',
      data: newRequest,
    });
  } catch (error) {
    if (store) {
      if (store.writeGrid || !writing || error.name === 'ValidationError' || error.code === 11000) await store.discard('uploads', req.file);
      else console.error('Cần đối soát kết quả ghi đơn và tệp:', req.file.filename);
    }
    if (error instanceof HttpError) return res.status(error.status).json({ success: false, message: error.message });
    if ([409, 413, 429, 503, 507].includes(error.status)) return res.status(error.status).json({ success: false, message: error.message });
    if (error?.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message });
    console.error('Lỗi tạo đơn:', error);
    return res.status(500).json({ success: false, message: 'Không thể tạo đơn. Vui lòng thử lại.' });
  } finally { if (store) await store.removeTemporary('uploads', req.file); }
};

// 2. Lấy danh sách đơn (Phân quyền theo Role)
// GET /api/request
export const getRequests = async (req, res) => {
  try {
    const query = requestScopeQuery(req.user);
    if (!query) return res.status(403).json({ success: false, message: 'Bạn không có quyền xem đơn.' });
    const requests = await Request.find(query)
      .populate('author', 'name email department role')
      .populate('currentApprover', 'name email role')
      .populate('department', 'name')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });

  } catch (error) {
    console.error('Lỗi lấy danh sách đơn:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server nội bộ khi lấy danh sách đơn!'
    });
  }
};

// 3. Phê duyệt hoặc từ chối đơn
// PATCH /api/request/:id/status
export const updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const comment = String(req.body.comment || '').trim();
    const approver = req.user;

    if (approver.role === ROLES.HR_ADMIN && (comment.length > 2000 || (action === REQUEST_STATUS.REJECTED && comment.length < 10))) {
      return res.status(400).json({ success: false, message: 'Ghi chú tối đa 2000 ký tự; lý do từ chối cần tối thiểu 10 ký tự.' });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'ID đơn không hợp lệ' });
    }

    if (![REQUEST_STATUS.APPROVED, REQUEST_STATUS.REJECTED].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Hành động không hợp lệ! Chỉ chấp nhận APPROVED hoặc REJECTED.'
      });
    }

    // MỚI: từ chối bắt buộc có lý do (kiểm tra ở backend)
    if (action === REQUEST_STATUS.REJECTED && !comment) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập lý do từ chối'
      });
    }

    const request = await Request.findById(id).populate('author', 'name email department');
    if (!request) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đề xuất này' });
    }

    // ===== CÁC KIỂM TRA QUYỀN (mục 5, 6) =====

    // (5) Đơn phải đang ở một bước chờ duyệt. Đơn nháp / đã kết thúc bị chặn ở đây.
    const step = WORKFLOW[request.status];
    if (!step) {
      return res.status(400).json({
        success: false,
        message: 'Đơn không ở trạng thái chờ duyệt, không thể xử lý'
      });
    }

    // (6) Đúng role của bước này
    if (approver.role !== step.role) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xử lý đơn ở bước này'
      });
    }

    // (6) Đúng loại đơn của bước này
    if (!step.types.includes(request.type)) {
      return res.status(403).json({
        success: false,
        message: 'Loại đơn này không thuộc quyền xử lý của bạn'
      });
    }

    // (6) Không tự duyệt đơn của chính mình
    if (request.author._id.equals(approver._id)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không được tự duyệt đơn của chính mình'
      });
    }

    // (6) Bước Quản lý: phải đúng người được giao
    if (step.byAssignee && request.currentApprover?.toString() !== approver._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Đơn này không được giao cho bạn'
      });
    }

    // ===== TÍNH TRẠNG THÁI KẾ TIẾP (mục 7) =====
    const fromStatus = request.status;
    const isReject = action === REQUEST_STATUS.REJECTED;
    const toStatus = isReject ? REQUEST_STATUS.REJECTED : step.next(request);
    const isFinal = [REQUEST_STATUS.APPROVED, REQUEST_STATUS.REJECTED].includes(toStatus);

    // Người phụ trách mới: chỉ chỉ định cụ thể ở bước Giám đốc.
    // HR / Kế toán xử lý theo role nên để trống; đơn kết thúc cũng trống.
    let nextApprover = null;
    let director = null;
    if (toStatus === REQUEST_STATUS.PENDING_DIRECTOR) {
      director = await User.findOne({ role: ROLES.DIRECTOR, status: { $ne: 'INACTIVE' } });
      if (!director) {
        return res.status(500).json({
          success: false,
          message: 'Không tìm thấy tài khoản Giám đốc để chuyển cấp.'
        });
      }
      nextApprover = director._id;
    }

    const shouldChargeBudget =
      toStatus === REQUEST_STATUS.APPROVED &&
      request.type === REQUEST_TYPES.PURCHASE &&
      request.amount > 0;

    // ===== GHI DATABASE TRONG 1 GIAO DỊCH (mục 5, 8) =====
    const session = await mongoose.startSession();
    let updated;
    try {
      await session.withTransaction(async () => {
        const decidedAt = new Date();
        const budgetFilter = request.department ? { _id: request.department } : { name: request.author.department };
        const budgetDepartment = shouldChargeBudget ? await Department.findOne(budgetFilter, null, { session }) : null;
        if (shouldChargeBudget && !budgetDepartment) throw new HttpError(400, 'Chưa có ngân sách phòng ban cho đơn này. Cần liên kết phòng ban trước khi duyệt.');
        if (budgetDepartment && (!Number.isSafeInteger(budgetDepartment.annualBudget) || !Number.isSafeInteger(budgetDepartment.usedBudget) || budgetDepartment.annualBudget < 0 || budgetDepartment.usedBudget < 0)) throw new HttpError(400, 'Ngân sách phòng ban chưa được cấu hình hợp lệ.');
        // Chỉ cập nhật nếu đơn VẪN còn ở trạng thái cũ.
        // Hai người bấm cùng lúc thì chỉ một người thành công.
        updated = await Request.findOneAndUpdate(
          { _id: id, status: fromStatus },
          {
            $set: {
              status: toStatus,
              currentApprover: nextApprover,
              ...(isFinal && { completedAt: decidedAt }),
              ...(toStatus === REQUEST_STATUS.APPROVED && FINANCE_TYPES.includes(request.type) && {
                approvedAmount: request.amount, approvedAt: decidedAt, approvedBy: approver._id, paidAmount: 0,
              }),
              ...(budgetDepartment && { budgetDepartment: budgetDepartment._id, budgetChargedAmount: request.amount, budgetChargedAt: decidedAt }),
            },
            $push: {
              approvalHistory: {
                approverId: approver._id,
                role: approver.role,
                action,
                fromStatus,
                toStatus,
                comment,
                timestamp: decidedAt
              }
            }
          },
          { new: true, session }
        );

        if (!updated) {
          throw new HttpError(409, 'Đơn vừa được người khác xử lý, vui lòng tải lại trang');
        }

        // Kế toán duyệt chi: trừ ngân sách, chỉ khi còn đủ tiền
        if (shouldChargeBudget) {
          const dept = await Department.findOneAndUpdate(
            {
              _id: budgetDepartment._id,
              $expr: {
                $lte: [{ $add: ['$usedBudget', request.amount] }, '$annualBudget']
              }
            },
            { $inc: { usedBudget: request.amount, budgetRevision: 1 } },
            { session }
          );

          if (!dept) {
            throw new HttpError(400, 'Ngân sách phòng ban không đủ hoặc chưa được cấu hình hợp lệ cho đơn này');
          }
        }
      });
    } finally {
      await session.endSession();
    }

    // ===== TÁC VỤ PHỤ: audit + email (lỗi cũng không hủy thao tác chính) =====
    await safe(() =>
      createAuditLog(req, {
        action: isReject ? 'REJECT_REQUEST' : 'APPROVE_REQUEST',
        targetEntity: 'Request',
        targetId: updated._id,
        oldValue: { status: fromStatus, currentApprover: request.currentApprover },
        newValue: { status: toStatus, currentApprover: nextApprover, comment }
      })
    );

    if (isReject) {
      await safe(() =>
        sendEmail({
          to: request.author.email,
          subject: `[Thông báo] Đơn "${request.title}" của bạn đã bị từ chối`,
          html: `<p>Chào ${request.author.name},</p>
                 <p>Đơn của bạn đã bị từ chối bởi <b>${approver.name}</b> (${approver.role}).</p>
                 <p><b>Lý do:</b> ${comment}</p>`
        })
      );
    } else if (toStatus === REQUEST_STATUS.PENDING_DIRECTOR) {
      await safe(() =>
        sendEmail({
          to: director.email,
          subject: `[Cấp cao phê duyệt] Đơn cần Giám đốc duyệt`,
          html: `<p>Chào Giám đốc,</p><p>${approver.name} đã duyệt đơn "${request.title}" (${request.amount.toLocaleString()} VNĐ) và chuyển lên Giám đốc phê duyệt.</p>`
        })
      );
    } else if (toStatus === REQUEST_STATUS.APPROVED) {
      await safe(() =>
        sendEmail({
          to: request.author.email,
          subject: `[Thành công] Đơn "${request.title}" của bạn đã được PHÊ DUYỆT HOÀN TẤT`,
          html: `<p>Chúc mừng ${request.author.name},</p><p>Đơn yêu cầu của bạn đã hoàn tất quy trình phê duyệt.</p>`
        })
      );
    }

    const messages = {
      [REQUEST_STATUS.REJECTED]: 'Đã từ chối đề xuất thành công',
      [REQUEST_STATUS.PENDING_DIRECTOR]: 'Đã duyệt. Đơn đã chuyển lên Giám đốc.',
      [REQUEST_STATUS.PENDING_HRADMIN]: 'Đã duyệt. Đơn đã chuyển sang HR Admin.',
      [REQUEST_STATUS.PENDING_ACCOUNTANT]: 'Đã duyệt. Đơn đã chuyển sang Kế toán.',
      [REQUEST_STATUS.APPROVED]: 'Đã phê duyệt đề xuất hoàn tất.'
    };

    return res.status(200).json({
      success: true,
      message: messages[toStatus] || 'Đã xử lý đơn.',
      data: updated
    });

  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Lỗi cập nhật trạng thái đơn:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server nội bộ khi xử lý đơn.'
    });
  }
};


// 4. Lấy chi tiết đơn theo ID
// GET /api/request/:id
export const getRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // 1. Kiểm tra ID hợp lệ
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID đơn không hợp lệ'
      });
    }

    const query = requestDetailQuery(user, id);
    if (!query) return res.status(403).json({ success: false, message: 'Bạn không có quyền xem đơn' });

    // 4. Truy vấn dữ liệu thật từ MongoDB
    const request = await Request.findOne(query)
      .populate('author', 'name email department role')
      .populate('currentApprover', 'name email role')
      .populate('department', 'name')
      .populate(
        'approvalHistory.approverId',
        'name email role'
      );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn hoặc bạn không có quyền xem'
      });
    }

    return res.status(200).json({
      success: true,
      data: request
    });

  } catch (error) {
    console.error('Lỗi lấy chi tiết đơn:', error);

    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy chi tiết đơn'
    });
  }
};

// 5. Lấy dữ liệu thống kê Dashboard (giữ nguyên)
// GET /api/request/stats/dashboard
export const getDashboard = async (req, res) => {
  try {
    const query = requestScopeQuery(req.user);
    if (!query) return res.status(403).json({ success: false, message: 'Bạn không có quyền xem thống kê.' });
    const pipeline = [{ $match: query }];

    const statusStats = await Request.aggregate([
      ...pipeline,
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const typeStats = await Request.aggregate([
      ...pipeline,
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      data: {
        scope: 'ACCESSIBLE_REQUESTS',
        statusOverview: statusStats,
        typeOverview: typeStats
      }
    });

  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu Dashboard:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server nội bộ khi lấy dữ liệu thống kê Dashboard'
    });
  }
};
