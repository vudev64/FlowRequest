import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true, immutable: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, immutable: true },
  amount: { type: Number, required: true, min: 1, validate: Number.isSafeInteger, immutable: true },
  paidAt: { type: Date, required: true, immutable: true },
  paidOn: { type: String, required: true, immutable: true },
  timeZone: { type: String, required: true, immutable: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  note: { type: String, maxlength: 2000, default: '', immutable: true },
  idempotencyKey: { type: String, required: true, maxlength: 80, immutable: true },
  fingerprint: { type: String, required: true, immutable: true },
  voucher: {
    path: { type: String, required: true, immutable: true },
    originalName: { type: String, required: true, immutable: true },
    mimeType: { type: String, required: true, immutable: true },
    sha256: { type: String, required: true, immutable: true },
  },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' });
schema.index({ request: 1, idempotencyKey: 1 }, { unique: true });
schema.index({ request: 1, paidAt: -1, _id: -1 });
schema.index({ paidAt: -1, _id: -1 });
export default mongoose.models.RequestPayment || mongoose.model('RequestPayment', schema);
