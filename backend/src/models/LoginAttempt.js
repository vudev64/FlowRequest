import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  _id: String, failures: { type: Number, default: 0 }, windowStartedAt: Date, lockedUntil: Date,
  expiresAt: { type: Date, required: true },
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model('LoginAttempt', schema);
