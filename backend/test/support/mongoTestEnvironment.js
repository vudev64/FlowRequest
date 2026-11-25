import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, realpath, rm } from 'node:fs/promises';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { MongoClient } from 'mongodb';

export const backendRoot = fileURLToPath(new URL('../../', import.meta.url));
export const CONTROL_COLLECTION = 'flowrequest_test_control';
export const TEST_COLLECTIONS = ['users', 'requests', 'departments', 'requestpayments', 'auditlogs', 'systemsettings', 'budgetincreaserequests', 'loginattempts'];
const purpose = 'flowrequest-isolated-mongo-test';
const runPattern = /^[a-f0-9]{32}$/;
const gridCollections = ['flowdocuments.files', 'flowdocuments.chunks', 'flowdocumentquota'];
export function gridTestOwnership(name, runId) {
  if (!runPattern.test(runId)) fail('Mã lượt test không hợp lệ.');
  const reference = new RegExp('^(uploads|payment-vouchers)/gridfs-[a-f0-9-]{36}-test-' + runId + '-');
  if (name === 'flowdocuments.files') return { _id: reference };
  if (name === 'flowdocuments.chunks') return { files_id: reference };
  return { $or: [{ _id: 'quota', _testRunId: runId }, { _id: reference }] };
}
const configKeys = ['FINANCE_TEST_URI', 'FINANCE_TEST_DB_NAME', 'FINANCE_TEST_STORAGE_ROOT'];
const fail = message => { throw new Error(message); };
const validTestDatabase = name => name === 'flowrequest_test' || /^frft_[a-z0-9_]{3,48}$/.test(name);

function canonical(value) {
  let current = path.resolve(value);
  const tail = [];
  while (!fs.existsSync(current)) {
    tail.unshift(path.basename(current));
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  const result = path.join(fs.realpathSync(current), ...tail);
  return process.platform === 'win32' ? result.toLowerCase() : result;
}
const overlaps = (a, b) => a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep);
const lexicalPath = value => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);

function connectionIdentity(uri) {
  try {
    const { options } = new MongoClient(uri);
    return { database: options.dbName, user: options.credentials?.username, password: options.credentials?.password };
  } catch { fail('MongoDB test URI không hợp lệ; không hiển thị URI để tránh lộ bí mật.'); }
}

export function validateTestConfig(values, protectedConfigs = [], root = backendRoot) {
  for (const key of configKeys) if (!values[key]?.trim()) fail(`Thiếu ${key}; không dùng cấu hình Demo/Production thay thế.`);
  const database = values.FINANCE_TEST_DB_NAME;
  if (!validTestDatabase(database)) fail('Database test phải là flowrequest_test hoặc tên riêng dạng frft_...');
  const identity = connectionIdentity(values.FINANCE_TEST_URI);
  if (identity.database !== database) fail('Tên database trong URI test phải trùng FINANCE_TEST_DB_NAME.');
  if (!identity.user || !identity.password) fail('MongoDB test bắt buộc có database user và mật khẩu riêng.');
  const protectedPaths = [path.join(root, 'uploads'), path.join(root, 'private-vouchers')];
  for (const config of protectedConfigs) {
    for (const key of ['MONGO_URI', 'DEMO_MONGO_URI', 'PRODUCTION_MONGO_URI']) {
      if (!config[key]) continue;
      const other = connectionIdentity(config[key]);
      if (identity.user === other.user) fail('Không được dùng lại database user Demo/Production cho test.');
      const otherName = key === 'PRODUCTION_MONGO_URI' ? config.PRODUCTION_DB_NAME : config.DEMO_DB_NAME;
      if (database === (otherName || other.database)) fail('Database test trùng tên database Demo/Production.');
    }
    if (config.DEMO_STORAGE_ROOT) protectedPaths.push(path.join(config.DEMO_STORAGE_ROOT, 'uploads'), path.join(config.DEMO_STORAGE_ROOT, 'private-vouchers'));
    if (config.PRODUCTION_STORAGE_ROOT) protectedPaths.push(config.PRODUCTION_STORAGE_ROOT);
  }
  if (!path.isAbsolute(values.FINANCE_TEST_STORAGE_ROOT)) fail('FINANCE_TEST_STORAGE_ROOT phải là đường dẫn tuyệt đối riêng.');
  const storageBase = canonical(values.FINANCE_TEST_STORAGE_ROOT);
  const protectedRoots = protectedPaths.map(canonical);
  if (protectedRoots.some(existing => overlaps(existing, storageBase))) fail('Thư mục test chồng lấn thư mục tệp Demo/Production.');
  return { uri: values.FINANCE_TEST_URI, database, username: identity.user, storageBase, protectedRoots };
}

export function protectedTestConfigs(root = backendRoot, env = process.env) {
  return [...['.env', '.env.demo', '.env.production'].filter(name => fs.existsSync(path.join(root, name))).map(name => dotenv.parse(fs.readFileSync(path.join(root, name)))), env];
}

export function readTestConfig({ env = process.env, root = backendRoot } = {}) {
  const filename = path.join(root, '.env.test');
  const exists = fs.existsSync(filename);
  if (!exists && !configKeys.some(key => env[key])) return null;
  if (env.NODE_ENV === 'production' || env.FLOWREQUEST_ENV === 'production') fail('Không chạy MongoDB test trong tiến trình Production.');
  const file = exists ? dotenv.parse(fs.readFileSync(filename)) : {};
  const values = { ...file };
  for (const key of configKeys) if (env[key] !== undefined) values[key] = env[key];
  // These files are read for comparisons only, never as test connection defaults.
  return validateTestConfig(values, protectedTestConfigs(root, env), root);
}

export function assertTestPrivileges(status, config) {
  const info = status.authInfo;
  if (!info?.authenticatedUsers?.some(user => user.user === config.username)) fail('Không xác nhận được database user test.');
  const privileges = info.authenticatedUserPrivileges;
  if (!Array.isArray(privileges) || !privileges.length) fail('Không đọc được quyền hiệu lực; dừng trước khi ghi test.');
  if (privileges.some(privilege => privilege.resource?.db !== config.database || privilege.resource?.cluster || privilege.resource?.anyResource)) fail('User test có quyền ngoài database test; cần giới hạn quyền MongoDB trước.');
}

function assertLeaseMarker(marker, database, runId) {
  if (!marker || marker.purpose !== purpose || marker.version !== 1 || marker.database !== database || marker.activeRun !== runId) fail('Không xác nhận được quyền sở hữu lượt test; giữ nguyên dữ liệu.');
}

async function inspectCollections(db, runId = null) {
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name);
  for (const name of names) {
    if (name === CONTROL_COLLECTION) continue;
    const grid = db.databaseName === 'flowrequest_test' && gridCollections.includes(name);
    if (!grid && !TEST_COLLECTIONS.includes(name)) fail('Database test có collection không thuộc bộ kiểm thử; giữ nguyên dữ liệu.');
    let filter = {};
    if (runId) filter = grid ? { $nor: [gridTestOwnership(name, runId)] } : { _testRunId: { $ne: runId } };
    const foreign = await db.collection(name).findOne(filter, { projection: { _id: 1 } });
    if (foreign) fail('Database test có dữ liệu cũ/khác lượt chạy; không ghi hoặc tự dọn dữ liệu đó.');
  }
  return names.filter(name => name !== CONTROL_COLLECTION);
}

export async function claimTestDatabase(db, runId) {
  if (!validTestDatabase(db.databaseName) || !runPattern.test(runId)) fail('Đích hoặc mã lượt test không hợp lệ.');
  await inspectCollections(db);
  const control = db.collection(CONTROL_COLLECTION);
  const marker = await control.findOne({ _id: 'environment' });
  if (marker) {
    assertLeaseMarker(marker, db.databaseName, null);
    const result = await control.updateOne({ _id: 'environment', activeRun: null, purpose, version: 1, database: db.databaseName }, { $set: { activeRun: runId, startedAt: new Date() } });
    if (result.modifiedCount !== 1) fail('Database test đang có lượt chạy khác.');
  } else {
    if (await control.findOne({})) fail('Collection điều khiển chứa dữ liệu không xác định.');
    await control.insertOne({ _id: 'environment', purpose, version: 1, database: db.databaseName, activeRun: runId, startedAt: new Date() });
  }
  // A second check after claiming catches writers racing the initial read.
  try { await inspectCollections(db); }
  catch (error) {
    await control.updateOne({ _id: 'environment', activeRun: runId }, { $set: { activeRun: null } });
    throw error;
  }
  return { database: db.databaseName, runId };
}

export async function cleanupTestRecords(db, lease) {
  if (!validTestDatabase(db.databaseName) || db.databaseName !== lease.database || !runPattern.test(lease.runId)) fail('Từ chối dọn sai database/lượt test.');
  const control = db.collection(CONTROL_COLLECTION);
  assertLeaseMarker(await control.findOne({ _id: 'environment' }), db.databaseName, lease.runId);
  // Validate every collection before the first delete. Never drop DBs/collections.
  const names = await inspectCollections(db, lease.runId);
  const deleted = {};
  for (const name of names) {
    const owned = gridCollections.includes(name) ? gridTestOwnership(name, lease.runId) : { _testRunId: lease.runId };
    const result = await db.collection(name).deleteMany(owned);
    deleted[name] = result.deletedCount;
    if (await db.collection(name).findOne(owned, { projection: { _id: 1 } })) fail('Còn bản ghi của lượt test; giữ khóa để kiểm tra.');
  }
  const result = await control.updateOne({ _id: 'environment', activeRun: lease.runId }, { $set: { activeRun: null, finishedAt: new Date() } });
  if (result.modifiedCount !== 1) fail('Không thể kết thúc quyền sở hữu lượt test.');
  return deleted;
}

export function createTestStorage(config) {
  if (canonical(config.storageBase) !== config.storageBase || config.protectedRoots.some(root => overlaps(root, canonical(config.storageBase)))) fail('Đường dẫn test đã thay đổi hoặc chồng lấn thư mục đang vận hành.');
  fs.mkdirSync(config.storageBase, { recursive: true });
  if (canonical(config.storageBase) !== config.storageBase) fail('Thư mục test đã đổi đích.');
  const root = fs.mkdtempSync(path.join(config.storageBase, 'run-'));
  const runId = randomUUID().replaceAll('-', '');
  const storage = { root, base: config.storageBase, runId, protectedRoots: config.protectedRoots };
  fs.writeFileSync(path.join(root, '.flowrequest-test-owner.json'), JSON.stringify({ purpose, runId }), { flag: 'wx', mode: 0o600 });
  return storage;
}

export async function cleanupTestStorage(storage) {
  const target = path.resolve(storage.root);
  const actual = await realpath(target);
  if (lexicalPath(actual) !== lexicalPath(target) || canonical(storage.base) !== storage.base || path.dirname(canonical(target)) !== storage.base || !path.basename(target).startsWith('run-') || !runPattern.test(storage.runId) || storage.protectedRoots.some(root => overlaps(root, canonical(target)))) fail('Từ chối xóa thư mục không thuộc lượt test.');
  const owner = JSON.parse(await readFile(path.join(target, '.flowrequest-test-owner.json'), 'utf8'));
  if (owner.purpose !== purpose || owner.runId !== storage.runId) fail('Không khớp marker thư mục test; giữ nguyên tệp.');
  await rm(target, { recursive: true, force: false });
}

export function useIsolatedTestProcess(storage) {
  const keys = Object.keys(process.env).filter(key => /^(?:FLOWREQUEST_ENV|NODE_ENV|JWT_SECRET|MONGO_URI|(?:DEMO|PRODUCTION|RESEND|EMAIL)_.*)$/.test(key));
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  const chosen = { NODE_ENV: 'test', FLOWREQUEST_ENV: 'demo', DEMO_STORAGE_ROOT: storage.root, DEMO_JWT_SECRET: randomBytes(48).toString('base64url') };
  Object.assign(process.env, chosen);
  return () => {
    for (const key of [...keys, ...Object.keys(chosen)]) delete process.env[key];
    Object.assign(process.env, previous);
  };
}

export function tagTestModels(models, runId) {
  if (!runPattern.test(runId)) fail('Mã lượt test không hợp lệ.');
  for (const model of models) {
    if (!TEST_COLLECTIONS.includes(model.collection.collectionName)) fail('Model không thuộc bộ kiểm thử MongoDB.');
    model.schema.add({ _testRunId: { type: String, default: runId, required: true, immutable: true } });
    model.recompileSchema();
  }
}

export async function financeUserFixtures() {
  const users = [], passwords = new Map();
  for (const role of ['EMPLOYEE', 'MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'HR_ADMIN', 'SYSTEM_ADMIN']) {
    const password = 'Aa1!' + randomBytes(24).toString('base64url');
    passwords.set(role, password);
    users.push({ name: role, email: role.toLowerCase() + '@finance.test', password: await bcrypt.hash(password, 10), department: 'Finance Test', role });
  }
  return { users, passwords };
}
