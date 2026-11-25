import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, enum: ['system'] },
  revision: { type: Number, required: true, min: 1 },
  general: { type: mongoose.Schema.Types.Mixed, required: true },
  security: { type: mongoose.Schema.Types.Mixed, required: true },
  attachments: { type: mongoose.Schema.Types.Mixed, required: true },
  notifications: { type: mongoose.Schema.Types.Mixed, required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true, strict: 'throw' });
export default mongoose.model('SystemSettings', schema);
