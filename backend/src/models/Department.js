import mongoose from 'mongoose';

//quản lý ngân sách năm (annualBudget), ngân sách đã tiêu (usedBudget),
// Sếp chính (manager) và Sếp phó/Người duyệt thay (putManager).
const departmentSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Tên phòng ban là bắt buộc'], 
    unique: true,
    trim: true 
  },
  code: { 
    type: String, 
    required: true, 
    uppercase: true,
    trim: true 
  },
  manager: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  putManager: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  annualBudget: { 
    type: Number, 
    default: 0 
  },
  usedBudget: { 
    type: Number, 
    default: 0 
  },
  budgetRevision: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

export default mongoose.model('Department', departmentSchema);
