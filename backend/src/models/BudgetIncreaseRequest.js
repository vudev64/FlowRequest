import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true, immutable: true },
  departmentName: { type: String, required: true, immutable: true },
  amount: { type: Number, required: true, min: 1, validate: Number.isSafeInteger, immutable: true },
  reason: { type: String, required: true, maxlength: 2000, immutable: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  idempotencyKey: { type: String, required: true, maxlength: 80, immutable: true },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', required: true },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  decidedAt: Date,
  decisionReason: { type: String, maxlength: 2000 },
  budgetBefore: Number,
  budgetAfter: Number,
}, { timestamps: true, strict: 'throw' });
schema.index({ createdBy: 1, idempotencyKey: 1 }, { unique: true });
schema.index({ status: 1, createdAt: -1, _id: -1 });
schema.index({ createdBy: 1, createdAt: -1, _id: -1 });
export default mongoose.models.BudgetIncreaseRequest || mongoose.model('BudgetIncreaseRequest', schema);
