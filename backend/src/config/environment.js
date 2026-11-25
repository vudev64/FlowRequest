import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { isIP } from 'node:net';
import { fileURLToPath } from 'node:url';

export const backendRoot = fileURLToPath(new URL('../../', import.meta.url));
export function environmentName(env = process.env) {
  const value = env.FLOWREQUEST_ENV || 'demo';
  if (!['demo', 'production'].includes(value)) throw new Error('FLOWREQUEST_ENV phải là demo hoặc production.');
  return value;
}
export function loadEnvironment(argv = process.argv.slice(2)) {
  const argument = argv.find(value => value.startsWith('--environment='))?.split('=')[1];
  if (argument && process.env.FLOWREQUEST_ENV && argument !== process.env.FLOWREQUEST_ENV) throw new Error('Cấu hình môi trường không nhất quán.');
  if (argument) process.env.FLOWREQUEST_ENV = argument;
  if (!process.env.FLOWREQUEST_ENV && process.env.NODE_ENV === 'production') throw new Error('NODE_ENV=production yêu cầu chọn rõ FLOWREQUEST_ENV hoặc --environment.');
  const environment = environmentName();
  if (environment === 'production') process.env.NODE_ENV = 'production';
  const selected = path.join(backendRoot, `.env.${environment}`);
  dotenv.config({ path: environment === 'demo' && !fs.existsSync(selected) ? path.join(backendRoot, '.env') : selected, quiet: true });
  if (environmentName() !== environment) throw new Error('File cấu hình không được thay đổi môi trường khởi động.');
  return runtimeConfig();
}
export function authConfig(env = process.env) {
  const environment = environmentName(env);
  return { environment, secret: environment === 'production' ? env.PRODUCTION_JWT_SECRET : env.DEMO_JWT_SECRET || env.JWT_SECRET,
    issuer: `flowrequest:${environment}`, audience: `flowrequest:${environment}:api` };
}
export function emailConfig(env = process.env) {
  const production = environmentName(env) === 'production';
  return {
    apiKey: production ? env.PRODUCTION_RESEND_API_KEY : env.DEMO_RESEND_API_KEY || env.RESEND_API_KEY,
    senderName: production ? env.PRODUCTION_EMAIL_FROM_NAME : env.DEMO_EMAIL_FROM_NAME || env.EMAIL_FROM_NAME,
    senderAddress: production ? env.PRODUCTION_EMAIL_FROM_ADDRESS : env.DEMO_EMAIL_FROM_ADDRESS || env.EMAIL_FROM_ADDRESS,
  };
}
export function databaseTarget(uri, name) {
  const match = String(uri || '').match(/^mongodb(?:\+srv)?:\/\/([^/]+)\/([^?]*)/i);
  if (!match) throw new Error('MongoDB URI không hợp lệ hoặc chưa chỉ định database.');
  return { host: match[1].split('@').at(-1).toLowerCase(), user: match[1].includes('@') ? decodeURIComponent(match[1].slice(0, match[1].lastIndexOf('@')).split(':')[0]) : null, name: name || decodeURIComponent(match[2]) || 'test' };
}
const overlaps = (a, b) => a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep);
function canonical(value) {
  let target = path.resolve(value), suffix = [];
  while (!fs.existsSync(target)) { suffix.unshift(path.basename(target)); const parent = path.dirname(target); if (parent === target) break; target = parent; }
  const result = path.join(fs.realpathSync(target), ...suffix);
  return process.platform === 'win32' ? result.toLowerCase() : result;
}
export function storagePaths(env = process.env) {
  const production = environmentName(env) === 'production';
  if (production && (!env.PRODUCTION_STORAGE_ROOT || !path.isAbsolute(env.PRODUCTION_STORAGE_ROOT))) throw new Error('PRODUCTION_STORAGE_ROOT phải là đường dẫn tuyệt đối riêng.');
  const root = production ? env.PRODUCTION_STORAGE_ROOT : env.DEMO_STORAGE_ROOT || backendRoot;
  const result = { root: path.resolve(root), uploads: path.resolve(root, 'uploads'), vouchers: path.resolve(root, 'private-vouchers') };
  if (production) {
    const demo = env.DEMO_STORAGE_ROOT || backendRoot;
    for (const target of [result.uploads, result.vouchers]) for (const existing of [path.resolve(demo, 'uploads'), path.resolve(demo, 'private-vouchers')]) {
      if (overlaps(canonical(target), canonical(existing))) throw new Error('Production không được dùng chung thư mục chứng từ Demo.');
    }
  }
  return result;
}
export function runtimeConfig(env = process.env) {
  const auth = authConfig(env), production = auth.environment === 'production';
  if (production && env.PRODUCTION_ENABLED === 'false') throw new Error('Production đang tạm dừng (PRODUCTION_ENABLED=false). Chỉ khởi chạy Demo.');
  const uri = production ? env.PRODUCTION_MONGO_URI : env.DEMO_MONGO_URI || env.MONGO_URI;
  const database = production ? env.PRODUCTION_DB_NAME : env.DEMO_DB_NAME;
  if (!uri || !auth.secret) throw new Error('Thiếu MongoDB URI hoặc khóa JWT cho môi trường được chọn.');
  if (production && (!database || !/^[\w-]{1,63}$/.test(database))) throw new Error('Production bắt buộc có PRODUCTION_DB_NAME hợp lệ.');
  if (Buffer.byteLength(auth.secret, 'utf8') < 32) throw new Error('Khóa JWT của môi trường cần ít nhất 32 byte ngẫu nhiên.');
  if (production && [env.JWT_SECRET, env.DEMO_JWT_SECRET].filter(Boolean).includes(auth.secret)) throw new Error('Khóa JWT Production phải khác Demo.');
  const target = databaseTarget(uri, database);
  const publicDemo = !production && env.NODE_ENV === 'production';
  if (publicDemo && !target.user) throw new Error('Demo deploy công khai yêu cầu database user có xác thực và quyền riêng.');
  if (production && !target.user) throw new Error('MongoDB Production yêu cầu database user riêng, không dùng kết nối không xác thực.');
  let legacy = {};
  const demoFile = path.join(backendRoot, fs.existsSync(path.join(backendRoot, '.env.demo')) ? '.env.demo' : '.env');
  if (production && fs.existsSync(demoFile)) legacy = dotenv.parse(fs.readFileSync(demoFile));
  const demoUri = env.DEMO_MONGO_URI || env.MONGO_URI || legacy.DEMO_MONGO_URI || legacy.MONGO_URI;
  if (production && demoUri) {
    const demoTarget = databaseTarget(demoUri, env.DEMO_DB_NAME || legacy.DEMO_DB_NAME);
    if (demoTarget.host === target.host && demoTarget.name === target.name) throw new Error('Production đang trỏ nhầm database Demo.');
    if (demoTarget.host === target.host && demoTarget.user === target.user) throw new Error('Production phải dùng database user riêng, không dùng lại user Demo trên cùng cluster.');
    if ([legacy.JWT_SECRET, legacy.DEMO_JWT_SECRET].filter(Boolean).includes(auth.secret)) throw new Error('Khóa JWT Production trùng khóa Demo.');
  }
  const origins = String(production ? env.PRODUCTION_ALLOWED_ORIGINS || '' : env.DEMO_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (production && !origins.length) throw new Error('Production bắt buộc có PRODUCTION_ALLOWED_ORIGINS.');
  if (publicDemo && !origins.length) throw new Error('Demo deploy công khai bắt buộc có DEMO_ALLOWED_ORIGINS.');
  for (const origin of origins) { const url = new URL(origin); if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin || url.username || url.password) throw new Error('Origin phải là địa chỉ HTTP/HTTPS đầy đủ, không có đường dẫn.'); }
  const port = Number(production ? env.PRODUCTION_PORT || 5001 : env.DEMO_PORT || env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Cổng Backend không hợp lệ.');
  const trustedProxies = String(production ? env.PRODUCTION_TRUSTED_PROXIES || '' : env.DEMO_TRUSTED_PROXIES || '').split(',').map(value => value.trim()).filter(Boolean);
  if (trustedProxies.some(value => !isIP(value))) throw new Error('TRUSTED_PROXIES chỉ nhận địa chỉ IP cụ thể của reverse proxy.');
  return { ...auth, publicDemo, mongoUri: uri, databaseName: target.name, origins, port, trustedProxies, storage: storagePaths({ ...env, DEMO_STORAGE_ROOT: env.DEMO_STORAGE_ROOT || legacy.DEMO_STORAGE_ROOT }) };
}
