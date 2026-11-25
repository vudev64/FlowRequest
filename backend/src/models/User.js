import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['EMPLOYEE', 'MANAGER', 'DIRECTOR','HR_ADMIN','SYSTEM_ADMIN','ACCOUNTANT'], 
    default: 'EMPLOYEE' 
  },
  department: { type: String, required: true },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  title: { type: String, trim: true },
  tokenVersion: { type: Number, default: 0 },
  adminRevision: { type: Number, default: 0 },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('User', UserSchema);
