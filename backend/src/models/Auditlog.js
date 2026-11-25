import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    // Người thao tác
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    // hành động:create_request,approve_request,reject_requets
    action: {
      type: String,
      required: true,
      trim: true
    },
    result: { type: String, enum: ['SUCCESS', 'FAILURE'], default: 'SUCCESS' },
    // Tên bảng bị tác động (ví dụ: 'Request', 'Department')
    targetEntity: {
      type: String,
      required: true
    },
    // ID của bảng ghi bị tác động
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    // Snapshot dữ liệu cũ & mới để đối soát khi cần kiểm toán
    changes: {
      oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
      newValue: { type: mongoose.Schema.Types.Mixed, default: null }
    },
    // Thông tin thiết bị & IP
    ipAddress: { type: String, default: 'UNKNOWN' },
    userAgent: { type: String, default: 'UNKNOWN' }
  },
  {
    // Nhật ký chỉ ghi nhận thời gian tạo, không cho phép chỉnh sửa
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Index để hỗ trợ truy vấn báo cáo nhanh
auditLogSchema.index({ targetId: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1 });

export default mongoose.model('AuditLog', auditLogSchema);
