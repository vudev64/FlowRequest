import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import AuditLog from '../models/Auditlog.js';
import { isReservedDemoEmail } from '../config/accountPolicy.js';

export function validateBootstrap(input) {
  const { name, email, department, password } = input;
  if (![name, email, department, password].every(value => typeof value === 'string') || !name.trim() || !department.trim() || !/^\S+@\S+\.\S+$/.test(email.trim()) || isReservedDemoEmail(email, 'production')) throw new Error('Thông tin SYSTEM_ADMIN đầu tiên không hợp lệ.');
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72 || /[\u0000-\u001f\u007f]/.test(password) || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^\w\s]/.test(password)) throw new Error('Mật khẩu bootstrap cần ít nhất 12 ký tự, chữ hoa, chữ thường, số, ký tự đặc biệt và tối đa 72 byte.');
  return { name: name.trim(), email: email.trim().toLowerCase(), department: department.trim(), password };
}
export async function bootstrapFirstAdmin(config, input) {
  if (config.environment !== 'production' || mongoose.connection.name !== config.databaseName) throw new Error('Bootstrap chỉ chạy trên database Production đã chỉ định.');
  const values = validateBootstrap(input), adminId = new mongoose.Types.ObjectId();
  await Promise.all([User.init(), AuditLog.init()]);
  const state = mongoose.connection.collection('runtimeenvironments');
  // Explicitly create the singleton collection before starting the transaction.
  try { await mongoose.connection.db.createCollection('runtimeenvironments'); } catch (error) { if (error.code !== 48) throw error; }
  const hashed = await bcrypt.hash(values.password, 12), session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (await state.findOne({ _id: 'first-system-admin' }, { session }) || await User.exists({ role: 'SYSTEM_ADMIN' }).session(session)) throw new Error('Production đã có SYSTEM_ADMIN hoặc đã bootstrap; không tạo thêm.');
      const identity = await state.findOne({ _id: 'identity' }, { session });
      if (identity && identity.environment !== 'production') throw new Error('Database không thuộc Production.');
      await state.insertOne({ _id: 'first-system-admin', environment: 'production', adminId, createdAt: new Date() }, { session });
      if (!identity) await state.insertOne({ _id: 'identity', environment: 'production', createdAt: new Date() }, { session });
      await User.create([{ _id: adminId, name: values.name, email: values.email, department: values.department, role: 'SYSTEM_ADMIN', status: 'ACTIVE', tokenVersion: 0, password: hashed }], { session });
      await AuditLog.create([{ actor: adminId, action: 'BOOTSTRAP_SYSTEM_ADMIN', targetEntity: 'User', targetId: adminId, changes: { newValue: { role: 'SYSTEM_ADMIN', environment: 'production' } }, ipAddress: 'BACKEND_CLI', userAgent: 'FlowRequest bootstrap' }], { session });
    });
    return { id: String(adminId), email: values.email };
  } finally { await session.endSession(); }
}
