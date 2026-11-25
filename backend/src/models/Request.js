import mongoose from 'mongoose';
import { REQUEST_TYPES, REQUEST_STATUS, LEAVE_TYPES } from '../constants/enums.js';

// Danh mục con của PURCHASE. Giữ type = PURCHASE để không phá workflow hiện tại.
export const PURCHASE_CATEGORIES = Object.freeze({
  EQUIPMENT: 'EQUIPMENT',
  SOFTWARE_LICENSE: 'SOFTWARE_LICENSE',
  CLOUD_RESOURCE: 'CLOUD_RESOURCE',
});

const approvalHistorySchema = new mongoose.Schema({
  approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  role: { type: String },
  action: {
    type: String,
    enum: [REQUEST_STATUS.APPROVED, REQUEST_STATUS.REJECTED, REQUEST_STATUS.CANCELLED],
  },
  fromStatus: { type: String },
  toStatus: { type: String },
  comment: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
});

const purchaseDetailsSchema = new mongoose.Schema({
  // Thiết bị
  deviceName: { type: String, trim: true },
  quantity: { type: Number, min: [1, 'Số lượng phải lớn hơn 0'] },
  unitPrice: { type: Number, min: [0, 'Đơn giá không được âm'] },

  // Tool / IDE
  softwareName: { type: String, trim: true },
  licenseCount: { type: Number, min: [1, 'Số license phải lớn hơn 0'] },
  durationMonths: { type: Number, min: [1, 'Thời hạn phải lớn hơn 0 tháng'] },

  // Cloud
  cloudProvider: { type: String, trim: true },
  resourceType: { type: String, trim: true },
  configuration: { type: String, trim: true },
  durationMonths: { type: Number, min: 1 },

  // Thông tin chung cho mua sắm
  budgetCode: { type: String, trim: true },
}, { _id: false });

const requestSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Vui lòng nhập tiêu đề đơn'],
    trim: true,
  },
  type: {
    type: String,
    enum: Object.values(REQUEST_TYPES),
    required: true,
  },
  // Chỉ có ý nghĩa với PURCHASE. null hỗ trợ đơn mua sắm cũ.
  category: {
    type: String,
    enum: [...Object.values(PURCHASE_CATEGORIES), null],
    default: null,
  },
  content: {
    type: String,
    required: [true, 'Vui lòng nhập nội dung chi tiết'],
    trim: true,
  },
  amount: {
    type: Number,
    default: 0,
    min: [0, 'Số tiền không được âm'],
    validate: {
      validator: Number.isFinite,
      message: 'Số tiền phải là số hợp lệ',
    },
  },
  attachment: { type: String },
  purchaseDetails: { type: purchaseDetailsSchema, default: undefined },
  // Mới bổ sung : Dữ liệu đặc thù 5 loại mới. Kiểm tra required theo type tại Controller.
  extraDetails: {
    attendanceDate: { type: Date }, actualCheckIn: { type: String }, actualCheckOut: { type: String },
    workLocation: { type: String, trim: true },
    fromDate: { type: Date }, toDate: { type: Date },
    destination: { type: String, trim: true }, purpose: { type: String, trim: true },
    courseName: { type: String, trim: true }, provider: { type: String, trim: true },
    position: { type: String, trim: true }, headcount: { type: Number, min: 1 },
    requestedDepartment: { type: String, trim: true },
  },

  // Nghỉ phép
  leaveType: { type: String, enum: Object.values(LEAVE_TYPES) },
  dayPart: { type: String, enum: ['FULL', 'AM', 'PM'], default: 'FULL' },
  startDate: { type: Date },
  endDate: { type: Date },
  leaveDays: { type: Number, min: 0 },

  // Tăng ca
  overtimeDate: { type: Date },
  overtimeStart: { type: String },
  overtimeEnd: { type: String },
  overtimeHours: { type: Number, min: 0 },
  projectName: { type: String, trim: true },

  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
  },
  currentApprover: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  requiresDirector: { type: Boolean, default: false },
  status: {
    type: String,
    enum: Object.values(REQUEST_STATUS),
    default: REQUEST_STATUS.PENDING_MANAGER,
  },
  completedAt: { type: Date },
  // Approval commits a budget; actual payments are recorded separately.
  approvedAmount: { type: Number, min: 0, validate: Number.isSafeInteger },
  approvedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paidAmount: { type: Number, min: 0, validate: Number.isSafeInteger },
  budgetDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  budgetChargedAmount: { type: Number, min: 0, validate: Number.isSafeInteger },
  budgetChargedAt: { type: Date },
  approvalHistory: [approvalHistorySchema],
}, { timestamps: true });

// Các kiểm tra chéo cơ bản. Trường bắt buộc theo từng loại đơn
// cần được kiểm tra ở service/controller khi GỬI, vì bản nháp có thể chưa đủ.
requestSchema.pre('validate', function () {
  if (this.type !== REQUEST_TYPES.PURCHASE) {
    if (this.category != null) {
      this.invalidate('category', 'Danh mục mua sắm chỉ dùng với đơn PURCHASE');
    }
    if (this.purchaseDetails != null) {
      this.invalidate('purchaseDetails', 'Chi tiết mua sắm chỉ dùng với đơn PURCHASE');
    }
  }
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'Ngày kết thúc không được trước ngày bắt đầu');
  }
});

requestSchema.index({ author: 1, createdAt: -1 });
requestSchema.index({ status: 1, currentApprover: 1 });
requestSchema.index({ type: 1, category: 1, createdAt: -1 });

const Request = mongoose.models.Request || mongoose.model('Request', requestSchema);
export default Request;
