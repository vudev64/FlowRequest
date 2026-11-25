import { readFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { loadEnvironment } from '../config/environment.js';
import connectDB from '../config/database.js';

try {
  const config = loadEnvironment();
  if (config.environment !== 'production') throw new Error('Bootstrap yêu cầu --environment=production.');
  const source = process.env.PRODUCTION_BOOTSTRAP_PASSWORD_FILE;
  if (!source || !path.isAbsolute(source)) throw new Error('Cần PRODUCTION_BOOTSTRAP_PASSWORD_FILE là file bí mật riêng, đường dẫn tuyệt đối.');
  const password = (await readFile(source, 'utf8')).replace(/^\uFEFF/, '').replace(/\r?\n$/, '');
  const { validateBootstrap, bootstrapFirstAdmin } = await import('../services/BootstrapService.js');
  const input = validateBootstrap({ name: process.env.PRODUCTION_BOOTSTRAP_NAME, email: process.env.PRODUCTION_BOOTSTRAP_EMAIL, department: process.env.PRODUCTION_BOOTSTRAP_DEPARTMENT, password });
  await connectDB(config, { bootstrap: true });
  await bootstrapFirstAdmin(config, input);
  console.log('Đã khởi tạo SYSTEM_ADMIN Production và ghi Audit Log. Không có tài khoản hoặc dữ liệu mẫu nào được tạo.');
} catch (error) { console.error('Không thể bootstrap Production:', error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
