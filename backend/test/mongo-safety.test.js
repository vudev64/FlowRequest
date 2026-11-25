import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { CONTROL_COLLECTION, backendRoot, validateTestConfig, readTestConfig, assertTestPrivileges, claimTestDatabase, cleanupTestRecords, createTestStorage, cleanupTestStorage, useIsolatedTestProcess, tagTestModels, financeUserFixtures } from './support/mongoTestEnvironment.js';

const run = 'a'.repeat(32), otherRun = 'b'.repeat(32);
const values = () => ({ FINANCE_TEST_URI: 'mongodb://test-runner:test-only@mongo.invalid/frft_integration?authSource=admin', FINANCE_TEST_DB_NAME: 'frft_integration', FINANCE_TEST_STORAGE_ROOT: path.join(backendRoot, '.data', 'isolated-finance-test') });
const protect = () => [{ MONGO_URI: 'mongodb://demo-runner:test-only@mongo.invalid/test', PRODUCTION_MONGO_URI: 'mongodb://prod-runner:test-only@mongo.invalid/company', PRODUCTION_DB_NAME: 'company', PRODUCTION_STORAGE_ROOT: path.join(backendRoot, '.data', 'production') }];

// In-memory MongoDB adapter: these safety tests never open a database connection.
function databaseFixture(initial = {}, databaseName = 'frft_integration') {
  const data = new Map(Object.entries(initial).map(([key, docs]) => [key, structuredClone(docs)]));
  const calls = [];
  const matches = (row, query) => Object.entries(query).every(([key, value]) => {
    if (key === '$nor') return !value.some(filter => matches(row, filter));
    if (key === '$or') return value.some(filter => matches(row, filter));
    if (value instanceof RegExp) return typeof row[key] === 'string' && value.test(row[key]);
    return value && typeof value === 'object' && '$ne' in value ? row[key] !== value.$ne : row[key] === value;
  });
  const database = { databaseName, data, calls, failDelete: false,
    listCollections: () => ({ toArray: async () => [...data.keys()].map(name => ({ name })) }),
    collection(name) {
      return {
        findOne: async query => structuredClone((data.get(name) || []).find(row => matches(row, query)) || null),
        insertOne: async row => {
          const rows = data.get(name) || [];
          if (rows.some(existing => existing._id === row._id)) throw Object.assign(new Error('duplicate'), { code: 11000 });
          rows.push(structuredClone(row)); data.set(name, rows);
        },
        updateOne: async (query, update) => {
          const row = (data.get(name) || []).find(row => matches(row, query));
          if (!row) return { modifiedCount: 0 };
          Object.assign(row, update.$set); return { modifiedCount: 1 };
        },
        deleteMany: async query => {
          calls.push({ name, query });
          if (database.failDelete === true || database.failDelete === name) throw new Error('Simulated cleanup failure');
          const old = data.get(name) || [], remaining = old.filter(row => !matches(row, query));
          data.set(name, remaining); return { deletedCount: old.length - remaining.length };
        },
        drop: async () => assert.fail('Collection deletion is forbidden'),
      };
    },
    dropDatabase: async () => assert.fail('Database deletion is forbidden'),
  };
  return database;
}

test('Mongo test config rejects missing values, shared credentials/databases/storage and Production processes', () => {
  const config = validateTestConfig(values(), protect());
  assert.equal(config.database, 'frft_integration'); assert.equal(config.username, 'test-runner');
  for (const key of Object.keys(values())) assert.throws(() => validateTestConfig({ ...values(), [key]: '' }, protect()));
  for (const uri of ['mongodb://mongo.invalid/frft_integration', 'mongodb://demo-runner:x@mongo.invalid/frft_integration', 'mongodb://prod-runner:x@mongo.invalid/frft_integration', 'mongodb://test-runner:x@mongo.invalid/test', 'mongodb://test-runner:x@mongo.invalid/']) assert.throws(() => validateTestConfig({ ...values(), FINANCE_TEST_URI: uri }, protect()));
  for (const root of [backendRoot, path.join(backendRoot, 'uploads'), path.join(backendRoot, 'private-vouchers', 'nested'), path.join(backendRoot, '.data', 'production', 'nested'), 'relative-test-storage']) assert.throws(() => validateTestConfig({ ...values(), FINANCE_TEST_STORAGE_ROOT: root }, protect()));
  const absentRoot = path.join(backendRoot, '.data', 'no-env-test-fixture');
  assert.equal(readTestConfig({ env: { MONGO_URI: 'not-a-test-default' }, root: absentRoot }), null);
  assert.throws(() => readTestConfig({ env: { FINANCE_TEST_URI: values().FINANCE_TEST_URI }, root: absentRoot }), /FINANCE_TEST_DB_NAME/);
  assert.throws(() => readTestConfig({ env: { ...values(), FLOWREQUEST_ENV: 'production' }, root: absentRoot }), /Production/);
});

test('Mongo test requires effective privileges limited to the dedicated test database', () => {
  const config = validateTestConfig(values());
  const status = privileges => ({ authInfo: { authenticatedUsers: [{ user: 'test-runner' }], authenticatedUserPrivileges: privileges } });
  assertTestPrivileges(status([{ resource: { db: config.database, collection: '' }, actions: ['find', 'insert', 'remove'] }]), config);
  for (const resource of [{ db: 'test', collection: '' }, { db: 'company', collection: '' }, { db: '', collection: '' }, { anyResource: true }, { cluster: true }]) assert.throws(() => assertTestPrivileges(status([{ resource, actions: ['find'] }]), config));
  assert.throws(() => assertTestPrivileges(status([]), config));
  assert.throws(() => assertTestPrivileges({ authInfo: { authenticatedUsers: [] } }, config));
});

test('flowrequest_test is an exact additional name and retains configuration, credential and privilege boundaries', () => {
  const chosen = { ...values(), FINANCE_TEST_URI: 'mongodb://test-runner:test-only@mongo.invalid/flowrequest_test?authSource=admin', FINANCE_TEST_DB_NAME: 'flowrequest_test' };
  const config = validateTestConfig(chosen, protect());
  assert.equal(config.database, 'flowrequest_test');
  assert.equal(validateTestConfig(values(), protect()).database, 'frft_integration');
  for (const name of ['flowrequest_test2', 'flowrequest_test_extra', 'FLOWREQUEST_TEST', 'flowrequest_test ', 'flowrequest_production', 'test', 'frft_ab']) {
    assert.throws(() => validateTestConfig({ ...chosen, FINANCE_TEST_DB_NAME: name }, protect()), /Database test phải/);
  }
  assert.throws(() => validateTestConfig({ ...chosen, FINANCE_TEST_URI: values().FINANCE_TEST_URI }, protect()), /phải trùng/);
  for (const user of ['demo-runner', 'prod-runner']) assert.throws(() => validateTestConfig({ ...chosen, FINANCE_TEST_URI: `mongodb://${user}:test-only@mongo.invalid/flowrequest_test` }, protect()), /database user/);
  for (const protectedConfig of [
    { MONGO_URI: 'mongodb://other-user:fixture@mongo.invalid/flowrequest_test' },
    { PRODUCTION_MONGO_URI: 'mongodb://other-user:fixture@mongo.invalid/company', PRODUCTION_DB_NAME: 'flowrequest_test' },
  ]) assert.throws(() => validateTestConfig(chosen, [protectedConfig]), /trùng tên database/);
  assert.throws(() => validateTestConfig({ ...chosen, FINANCE_TEST_STORAGE_ROOT: path.join(backendRoot, 'uploads') }, protect()), /chồng lấn/);
  const status = resource => ({ authInfo: { authenticatedUsers: [{ user: config.username }], authenticatedUserPrivileges: [{ resource, actions: ['find', 'insert', 'update', 'remove'] }] } });
  assert.doesNotThrow(() => assertTestPrivileges(status({ db: 'flowrequest_test', collection: '' }), config));
  for (const resource of [{ db: 'frft_integration', collection: '' }, { db: 'test', collection: '' }, { db: 'company', collection: '' }, { cluster: true }, { anyResource: true }]) assert.throws(() => assertTestPrivileges(status(resource), config));
});

test('flowrequest_test claims and cleans only its own run while preserving namespace, marker and foreign-record protections', async () => {
  const db = databaseFixture({}, 'flowrequest_test');
  const lease = await claimTestDatabase(db, run);
  assert.equal(lease.database, 'flowrequest_test');
  await assert.rejects(claimTestDatabase(db, otherRun));
  db.data.set('users', [{ _id: 'ours', _testRunId: run }]);
  db.data.set('requests', [{ _id: 'foreign', _testRunId: otherRun }]);
  const before = structuredClone([...db.data]);
  await assert.rejects(cleanupTestRecords(db, lease));
  assert.deepEqual([...db.data], before); assert.equal(db.calls.length, 0);
  db.data.set('requests', [{ _id: 'ours', _testRunId: run }]);
  await assert.rejects(cleanupTestRecords({ ...db, databaseName: 'flowrequest_test_extra' }, lease));
  await assert.rejects(cleanupTestRecords(db, { ...lease, runId: otherRun }));
  const marker = db.data.get(CONTROL_COLLECTION)[0];
  marker.database = 'frft_integration';
  await assert.rejects(cleanupTestRecords(db, lease)); assert.equal(db.calls.length, 0);
  marker.database = 'flowrequest_test';
  assert.deepEqual(await cleanupTestRecords(db, lease), { users: 1, requests: 1 });
  assert.equal(db.data.has('users'), true); assert.equal(db.data.has('requests'), true);
  assert.equal(marker.activeRun, null);
  assert.deepEqual(db.calls, [{ name: 'users', query: { _testRunId: run } }, { name: 'requests', query: { _testRunId: run } }]);
  for (const initial of [{ users: [{ _id: 'existing' }] }, { runtimeenvironments: [{ _id: 'identity', environment: 'demo' }] }, { unrelated: [] }]) {
    const occupied = databaseFixture(initial, 'flowrequest_test'), original = structuredClone([...occupied.data]);
    await assert.rejects(claimTestDatabase(occupied, run));
    assert.deepEqual([...occupied.data], original); assert.equal(occupied.calls.length, 0);
  }
});

test('GridFS cleanup validates every file, chunk and quota owner before the first delete', async () => {
  const db = databaseFixture({}, 'flowrequest_test'), lease = await claimTestDatabase(db, run);
  const key = 'uploads/gridfs-' + 'a'.repeat(36) + '-test-' + run + '-proof.pdf';
  const id = key + ':upload-owner';
  db.data.set('flowdocuments.files', [{ _id: id }]);
  db.data.set('flowdocuments.chunks', [{ files_id: id }]);
  db.data.set('flowdocumentquota', [{ _id: 'quota', _testRunId: run }, { _id: key }]);
  const legacy = 'payment-vouchers/1795229604395-123-' + run + '.pdf';
  const owner = legacy + ':' + 'a'.repeat(36);
  db.data.get('flowdocuments.files').push({ _id: owner });
  db.data.get('flowdocuments.chunks').push({ files_id: owner });
  db.data.get('flowdocumentquota').push({ _id: legacy });
  for (const [name, foreign] of [['flowdocuments.files', { _id: id.replace(run + '-proof', otherRun + '-proof') }],
    ['flowdocuments.chunks', { files_id: 'foreign' }], ['flowdocuments.files', { _id: owner.replace(run + '.pdf', otherRun + '.pdf') }],
    ['flowdocumentquota', { _id: legacy + '.unexpected' }], ['flowdocumentquota', { _id: 'quota', _testRunId: otherRun }]]) {
    db.data.get(name).push(foreign);
    await assert.rejects(cleanupTestRecords(db, lease));
    assert.equal(db.calls.length, 0);
    db.data.get(name).pop();
  }
  assert.deepEqual(await cleanupTestRecords(db, lease), { 'flowdocuments.files': 2, 'flowdocuments.chunks': 2, flowdocumentquota: 3 });
});

test('all six finance test accounts have independently salted bcrypt passwords and ownership tags', async () => {
  const fixture = await financeUserFixtures();
  assert.equal(fixture.users.length, 6);
  assert.equal(new Set(fixture.users.map(row => row.password)).size, 6);
  for (const user of fixture.users) {
    assert.match(user.password, /^\$2[aby]\$10\$/);
    assert.notEqual(user.password, fixture.passwords.get(user.role));
    assert.equal(await bcrypt.compare(fixture.passwords.get(user.role), user.password), true);
  }
  const models = await Promise.all(['User', 'Request', 'Department', 'Payment', 'Auditlog', 'SystemSettings', 'BudgetIncreaseRequest', 'LoginAttempt'].map(async name => (await import(`../src/models/${name}.js`)).default));
  tagTestModels(models, run);
  for (const Model of models) {
    assert.equal(new Model({}).get('_testRunId'), run);
    assert.equal(new Model({}).toObject()._testRunId, run);
  }
});

test('Mongo test claims an empty database, rejects concurrent runs and cleans only its tagged documents', async () => {
  const racingDb = databaseFixture();
  const attempts = await Promise.allSettled([claimTestDatabase(racingDb, run), claimTestDatabase(racingDb, otherRun)]);
  assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(attempts.filter(result => result.status === 'rejected').length, 1);
  await cleanupTestRecords(racingDb, attempts.find(result => result.status === 'fulfilled').value);
  const db = databaseFixture();
  const lease = await claimTestDatabase(db, run);
  await assert.rejects(claimTestDatabase(db, otherRun));
  db.data.set('users', [{ _id: 'new-user', _testRunId: run }]);
  db.data.set('requests', [{ _id: 'new-request', _testRunId: run }]);
  const deleted = await cleanupTestRecords(db, lease);
  assert.deepEqual(deleted, { users: 1, requests: 1 });
  assert.equal(db.data.get(CONTROL_COLLECTION)[0].activeRun, null);
  assert.equal(db.data.has('users'), true); assert.equal(db.data.has('requests'), true);
  assert.deepEqual(db.calls, [{ name: 'users', query: { _testRunId: run } }, { name: 'requests', query: { _testRunId: run } }]);
  const next = await claimTestDatabase(db, otherRun);
  await cleanupTestRecords(db, next);
});

test('pre-existing records and application environment markers are refused without writes/deletes', async () => {
  for (const initial of [{ users: [{ _id: 'old' }] }, { users: [{ _id: 'old-test', _testRunId: otherRun }] }, { runtimeenvironments: [{ _id: 'identity', environment: 'production' }] }, { unrelated: [] }, { [CONTROL_COLLECTION]: [{ _id: 'foreign' }] }]) {
    const db = databaseFixture(initial), before = structuredClone([...db.data]);
    await assert.rejects(claimTestDatabase(db, run));
    assert.deepEqual([...db.data], before); assert.equal(db.calls.length, 0);
  }
});

test('cleanup checks every collection and the lease before deleting, and preserves ownership on failure', async () => {
  const db = databaseFixture(); const lease = await claimTestDatabase(db, run);
  db.data.set('users', [{ _id: 'ours', _testRunId: run }]);
  db.data.set('requests', [{ _id: 'foreign', _testRunId: otherRun }]);
  await assert.rejects(cleanupTestRecords(db, lease));
  assert.equal(db.calls.length, 0); assert.equal(db.data.get('users').length, 1);
  db.data.set('requests', []);
  await assert.rejects(cleanupTestRecords({ ...db, databaseName: 'test' }, lease));
  await assert.rejects(cleanupTestRecords(db, { ...lease, runId: otherRun }));
  assert.equal(db.calls.length, 0);
  db.data.set('requests', [{ _id: 'ours-too', _testRunId: run }]);
  db.failDelete = 'requests';
  await assert.rejects(cleanupTestRecords(db, lease));
  assert.equal(db.data.get('users').length, 0);
  assert.equal(db.data.get('requests').length, 1);
  assert.equal(db.data.get(CONTROL_COLLECTION)[0].activeRun, run);
  db.failDelete = false; await cleanupTestRecords(db, lease);
});

test('each run isolates uploads/vouchers and JWT, restores process config, and refuses wrong-owner file cleanup', async () => {
  const backupRoot = path.resolve(backendRoot, '../.backups');
  const temporary = await fs.mkdtemp(path.join(backupRoot, 'mongo-safety-unit-'));
  try {
    const config = validateTestConfig({ ...values(), FINANCE_TEST_STORAGE_ROOT: path.join(temporary, 'test-storage') });
    const first = await createTestStorage(config), second = await createTestStorage(config);
    assert.notEqual(first.root, second.root); assert.notEqual(first.runId, second.runId);
    for (const folder of ['uploads', 'private-vouchers']) {
      await fs.mkdir(path.join(first.root, folder));
      await fs.writeFile(path.join(first.root, folder, 'new-test.pdf'), '%PDF-1.4\nnew test only');
    }
    const previous = { ...process.env };
    const restore = useIsolatedTestProcess(first);
    try {
      assert.equal(process.env.DEMO_STORAGE_ROOT, first.root);
      assert.equal(process.env.NODE_ENV, 'test');
      for (const key of ['MONGO_URI', 'DEMO_MONGO_URI', 'PRODUCTION_MONGO_URI', 'RESEND_API_KEY', 'DEMO_RESEND_API_KEY', 'PRODUCTION_RESEND_API_KEY', 'PRODUCTION_JWT_SECRET']) assert.equal(process.env[key], undefined);
      assert.ok(process.env.DEMO_JWT_SECRET.length >= 48);
      assert.notEqual(process.env.DEMO_JWT_SECRET, previous.DEMO_JWT_SECRET);
    } finally { restore(); }
    assert.deepEqual({ ...process.env }, previous);
    await assert.rejects(cleanupTestStorage({ ...first, runId: second.runId }));
    await assert.rejects(cleanupTestStorage({ ...first, root: first.base }));
    assert.ok(await fs.stat(path.join(first.root, 'uploads', 'new-test.pdf')));
    await cleanupTestStorage(first); await cleanupTestStorage(second);
    assert.deepEqual(await fs.readdir(config.storageBase), []);
  } finally {
    const absolute = path.resolve(temporary);
    assert.equal(path.dirname(absolute), backupRoot);
    assert.ok(path.basename(absolute).startsWith('mongo-safety-unit-'));
    await fs.rm(absolute, { recursive: true, force: true });
  }
});

test('real upload middleware writes both destinations into the owned test root and cleanup also removes unlinked files', async () => {
  const config = validateTestConfig({ ...values(), FINANCE_TEST_STORAGE_ROOT: path.join(backendRoot, 'test-artifacts', 'mongo-upload-safety') });
  const storage = createTestStorage(config), restore = useIsolatedTestProcess(storage);
  let server, SystemSettings, originalFindOne;
  try {
    SystemSettings = (await import('../src/models/SystemSettings.js')).default;
    originalFindOne = SystemSettings.findOne;
    SystemSettings.findOne = () => ({ maxTimeMS() { return this; }, lean: async () => ({ attachments: { maxSizeMB: 1, extensions: ['.pdf'] } }) });
    const express = (await import('express')).default;
    const { upload } = await import('../src/middleware/upload.js');
    const app = express();
    app.post('/uploads', upload.single('attachment'), (req, res) => res.json({ path: req.file.path }));
    app.post('/vouchers', upload.single('attachment', { privateStorage: true }), (req, res) => res.json({ path: req.file.path }));
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    for (const [route, directory] of [['uploads', 'uploads'], ['vouchers', 'private-vouchers']]) {
      const form = new FormData(); form.set('attachment', new Blob(['%PDF-1.4\nOwned test fixture'], { type: 'application/pdf' }), 'fixture.pdf');
      const response = await fetch(`http://127.0.0.1:${server.address().port}/${route}`, { method: 'POST', body: form });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(path.dirname(result.path), path.join(storage.root, directory));
      assert.ok((await fs.readFile(result.path, 'utf8')).startsWith('%PDF-'));
      await fs.writeFile(path.join(storage.root, directory, 'unlinked-test-file.pdf'), '%PDF-orphan');
    }
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (SystemSettings && originalFindOne) SystemSettings.findOne = originalFindOne;
    restore(); await cleanupTestStorage(storage);
  }
  await assert.rejects(fs.stat(storage.root), { code: 'ENOENT' });
});
