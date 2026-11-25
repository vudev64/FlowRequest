import { createHash } from 'node:crypto';
import LoginAttempt from '../models/LoginAttempt.js';
export const loginKey = email => createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
export async function lockedUntil(key) {
  const entry = await LoginAttempt.findById(key).lean();
  return entry?.lockedUntil && entry.lockedUntil > new Date() ? entry.lockedUntil : null;
}
export async function recordLoginFailure(key, policy) {
  const now = new Date(), duration = policy.lockoutMinutes * 60000;
  const cutoff = new Date(now.getTime() - duration), expiresAt = new Date(now.getTime() + duration * 2);
  let entry = await LoginAttempt.findOneAndUpdate({ _id: key, windowStartedAt: { $gt: cutoff } }, { $inc: { failures: 1 }, $set: { expiresAt } }, { new: true });
  if (!entry) {
    try { entry = await LoginAttempt.findOneAndUpdate({ _id: key, $or: [{ windowStartedAt: { $lte: cutoff } }, { windowStartedAt: { $exists: false } }] }, { $set: { failures: 1, windowStartedAt: now, expiresAt }, $unset: { lockedUntil: 1 } }, { upsert: true, new: true }); }
    catch (error) { if (error.code !== 11000) throw error; return recordLoginFailure(key, policy); }
  }
  if (entry.failures >= policy.maxFailedLogins) {
    await LoginAttempt.updateOne({ _id: key, $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: { $lte: now } }] }, { $set: { lockedUntil: new Date(now.getTime() + duration) } });
    return true;
  }
  return false;
}
export const clearLoginFailures = key => LoginAttempt.deleteOne({ _id: key });
