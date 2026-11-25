import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { MongoClient } from 'mongodb';
import { loadEnvironment, runtimeConfig } from '../config/environment.js';
import { assertDemoDatabasePrivileges, inspectDatabase } from '../config/database.js';

// Read-only preflight. Does not connect Mongoose, seed data, create indexes or
// change environment markers, users, budgets or the existing payment ledger.
export async function checkDemoDeployment({ env = process.env, offline = false,
  clientFactory = config => new MongoClient(config.mongoUri, { dbName: config.databaseName, serverSelectionTimeoutMS: 5000, maxPoolSize: 1 }),
  checkStorage = target => access(target, constants.R_OK | constants.W_OK),
} = {}) {
  const checks = [];
  let config;
  try {
    config = runtimeConfig({ ...env, FLOWREQUEST_ENV: 'demo', NODE_ENV: 'production' });
    checks.push({ id: 'public-config', status: 'PASS' });
  } catch (error) {
    checks.push({ id: 'public-config', status: 'FAIL', message: error.message });
  }
  if (config) {
    const https = config.origins.every(origin => new URL(origin).protocol === 'https:');
    checks.push({ id: 'https-origins', status: https ? 'PASS' : 'FAIL', message: https ? undefined : 'Origin deploy công khai phải dùng HTTPS.' });
    try {
      if (env.DEMO_STORAGE_DRIVER === 'gridfs') await checkStorage(config.storage.root);
      else { await checkStorage(config.storage.uploads); await checkStorage(config.storage.vouchers); }
      checks.push({ id: 'storage-access', status: 'PASS' });
    } catch { checks.push({ id: 'storage-access', status: 'FAIL', message: env.DEMO_STORAGE_DRIVER === 'gridfs' ? 'Thư mục gốc cần cho phép ghi tệp tạm GridFS.' : 'Tạo và cấp quyền cho uploads/private-vouchers trong storage Demo riêng trước khi deploy.' }); }
    if (!offline) {
      const client = clientFactory(config);
      try {
        await client.connect(); const db = client.db(config.databaseName);
        await inspectDatabase(db, 'demo');
        const status = await db.command({ connectionStatus: 1, showPrivileges: true });
        assertDemoDatabasePrivileges(status, config.databaseName);
        if (!status.authInfo.authenticatedUserPrivileges.some(privilege => privilege.resource?.collection === '' && ['find', 'insert', 'update', 'remove'].every(action => privilege.actions?.includes(action)))) throw new Error('Database user cần quyền readWrite trong DB Demo.');
        const topology = await db.command({ hello: 1 });
        if (!topology.setName && topology.msg !== 'isdbgrid') throw new Error('MongoDB phải hỗ trợ transaction.');
        checks.push({ id: 'database-isolation-and-transactions', status: 'PASS' });
      } catch { checks.push({ id: 'database-isolation-and-transactions', status: 'FAIL', message: 'Chưa xác minh được kết nối, quyền riêng/identity Demo hoặc replica set. Không ghi dữ liệu.' }); }
      finally { await client.close(); }
    }
  }
  if (!config || offline) checks.push({ id: 'database-isolation-and-transactions', status: 'NOT_VERIFIED' });
  return { scope: 'demo-backend-preflight', passed: checks.every(check => check.status === 'PASS'), checks,
    notCovered: ['Public hosting HTTPS/proxy routing and persistent storage', 'Real MongoDB finance integration tests', 'Budget reconciliation and browser end-to-end checks'] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    loadEnvironment();
    const result = await checkDemoDeployment({ offline: process.argv.includes('--offline') });
    console.log(JSON.stringify(result, null, 2)); process.exitCode = result.passed ? 0 : 1;
  } catch { console.error('Không thể kiểm tra cấu hình Demo. Kiểm tra file môi trường; không gửi URI/mật khẩu vào chat.'); process.exitCode = 1; }
}
