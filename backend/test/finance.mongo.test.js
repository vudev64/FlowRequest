import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { MongoClient } from 'mongodb';
import { readTestConfig, assertTestPrivileges, claimTestDatabase, cleanupTestRecords, createTestStorage, cleanupTestStorage, useIsolatedTestProcess, tagTestModels, financeUserFixtures } from './support/mongoTestEnvironment.js';
import { checkBudgetIncreases } from './support/budgetIncreaseChecks.js';

// No application imports until configuration, DB ownership and storage are isolated.
const config = readTestConfig();
if (!config && process.env.FLOWREQUEST_REQUIRE_MONGO_TEST === 'true') throw new Error('Bài MongoDB bắt buộc chưa có cấu hình test riêng. Không được đánh giá đạt khi bị bỏ qua.');
test('real MongoDB finance: atomic commitments, payment ledger, idempotency, races, vouchers and scope', { skip: config ? false : 'Requires a dedicated backend/.env.test or all FINANCE_TEST_* variables', timeout: 180000 }, async t => {
  const storage = await createTestStorage(config);
  const restoreEnvironment = useIsolatedTestProcess(storage);
  const client = new MongoClient(config.uri, { dbName: config.database, appName: 'FlowRequestIsolatedFinanceTest', serverSelectionTimeoutMS: 10000, maxPoolSize: 2 });
  const db = client.db(config.database);
  let server, mongoose, lease;
  t.after(async () => {
    const errors = [];
    const attempt = async action => { try { await action(); } catch (error) { errors.push(error); } };
    try {
      if (server) await attempt(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
      if (lease && !errors.length) await attempt(async () => {
        assert.equal(mongoose?.connection.name || config.database, config.database);
        await cleanupTestRecords(db, lease);
      });
      if (mongoose) await attempt(() => mongoose.disconnect());
      await attempt(() => client.close());
      // Preserve evidence when DB cleanup or disconnection cannot be confirmed.
      if (!errors.length) await attempt(() => cleanupTestStorage(storage));
    } finally { restoreEnvironment(); }
    if (errors.length) {
      console.error(`MongoDB test teardown incomplete; retained owned test storage: ${storage.root}`);
      throw new AggregateError(errors, 'Test cleanup failed; no database or collection was dropped.');
    }
  });
  await client.connect();
  assertTestPrivileges(await db.command({ connectionStatus: 1, showPrivileges: true }), config);
  const topology = await db.admin().command({ hello: 1 });
  assert.ok(topology.setName || topology.msg === 'isdbgrid', 'Finance tests require a replica set or sharded MongoDB supporting transactions.');
  lease = await claimTestDatabase(db, storage.runId);

  mongoose = (await import('mongoose')).default;
  const express = (await import('express')).default;
  const router = (await import('../src/Router/request.js')).default;
  const [Request, User, Department, Payment, AuditLog, SystemSettings, BudgetIncreaseRequest] = await Promise.all(['Request', 'User', 'Department', 'Payment', 'Auditlog', 'SystemSettings', 'BudgetIncreaseRequest'].map(async name => (await import(`../src/models/${name}.js`)).default));
  const { settingsDefaults } = await import('../src/config/settingsDefaults.js');
  const { calendarDay } = await import('../src/services/FinanceService.js');
  const { signAccessToken } = await import('../src/services/TokenService.js');
  tagTestModels([User, Request, Department, Payment, AuditLog, SystemSettings, BudgetIncreaseRequest], storage.runId);
  await mongoose.connect(config.uri, { dbName: config.database, serverSelectionTimeoutMS: 10000 });
  assert.equal(mongoose.connection.name, config.database);
  await Promise.all([User.init(), Request.init(), Department.init(), Payment.init(), AuditLog.init(), SystemSettings.init(), BudgetIncreaseRequest.init()]);
  const fixtures = await financeUserFixtures();
  const users = await User.create(fixtures.users);
  for (const user of users) {
    assert.equal(user._testRunId, storage.runId);
    assert.notEqual(user.password, fixtures.passwords.get(user.role));
    assert.equal(await bcrypt.compare(fixtures.passwords.get(user.role), user.password), true);
  }
  const [employee, manager, director, accountant, hr, admin] = users;
  await User.updateOne({ _id: employee._id }, { $set: { managerId: manager._id } });
  const dept = await Department.create({ name: 'Finance Test', code: 'FT', annualBudget: 1_000_000_000, usedBudget: 0 });
  const settings = settingsDefaults(); settings.notifications.enabled = false;
  await SystemSettings.create({ key: 'system', revision: 1, ...settings, updatedBy: admin._id });
  const app = express(); app.use(express.json()); app.use('/api/request', router);
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/request`;
  const token = user => signAccessToken(user._id, user.role, user.tokenVersion || 0, 60);
  async function call(user, suffix = '', method = 'GET', body, headers = {}) {
    const response = await fetch(base + suffix, { method, headers: { Authorization: `Bearer ${token(user)}`, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  }
  async function create(amount = 10_000_000, author = employee) {
    const response = await call(author, '', 'POST', { type: 'PURCHASE', title: 'Isolated finance purchase', content: 'Test only', amount, category: 'EQUIPMENT', purchaseDetails: { deviceName: 'Test device', quantity: 1, unitPrice: amount } });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    return response.body.data._id;
  }
  const approve = (user, id) => call(user, `/${id}/status`, 'PATCH', { action: 'APPROVED' });
  const paidOn = calendarDay(new Date(), settings.general.timeZone);
  async function pay(id, amount, key = randomUUID(), user = accountant, options = {}) {
    const body = new FormData(); body.set('amount', String(amount)); body.set('paidOn', options.paidOn || paidOn); body.set('note', options.note || 'Actual voucher in an isolated test');
    if (!options.noFile) body.set('voucher', new Blob([options.pdf || '%PDF-1.4\nIsolated finance test voucher'], { type: 'application/pdf' }), `${storage.runId}.pdf`);
    const response = await fetch(base + `/${id}/payments`, { method: 'POST', headers: { Authorization: `Bearer ${token(user)}`, 'Idempotency-Key': key }, body });
    return { status: response.status, body: await response.json() };
  }
  const id = await create(); assert.equal((await approve(manager, id)).status, 200);
  assert.equal((await pay(id, 1)).status, 400, 'Pending requests cannot be paid');
  assert.equal((await approve(accountant, id)).status, 200);
  const approved = await Request.findById(id).lean();
  assert.equal(approved.approvedAmount, 10_000_000); assert.equal(String(approved.approvedBy), String(accountant._id)); assert.equal(approved.paidAmount, 0); assert.equal(approved.budgetChargedAmount, 10_000_000);
  assert.equal((await Department.findById(dept._id)).usedBudget, 10_000_000);
  assert.equal((await approve(accountant, id)).status, 400); assert.equal((await Department.findById(dept._id)).usedBudget, 10_000_000);
  assert.equal((await pay(id, 1, randomUUID(), employee)).status, 403);
  assert.equal((await pay(id, 1, randomUUID(), accountant, { noFile: true })).status, 400);
  assert.equal((await pay(id, 1, randomUUID(), accountant, { paidOn: '2099-01-01' })).status, 400);
  assert.equal((await pay(id, 1, randomUUID(), accountant, { paidOn: '2026-99-99' })).status, 400);
  const key = randomUUID(), first = await pay(id, 4_000_000, key); assert.equal(first.status, 201, JSON.stringify(first.body));
  const replay = await pay(id, 4_000_000, key); assert.equal(replay.status, 200, JSON.stringify(replay.body)); assert.equal(first.body.data.id, replay.body.data.id);
  assert.equal((await pay(id, 5_000_000, key)).status, 409);
  assert.equal((await Payment.countDocuments({ request: id })), 1); assert.equal((await Request.findById(id)).paidAmount, 4_000_000);
  assert.equal((await pay(id, 6_000_000)).status, 201); assert.equal((await pay(id, 1)).status, 400);
  assert.equal((await Request.findById(id)).paidAmount, 10_000_000); assert.equal((await Department.findById(dept._id)).usedBudget, 10_000_000, 'Payment must not charge the committed budget a second time');
  const history = await call(accountant, `/finance/payments?requestId=${id}`); assert.equal(history.status, 200); assert.equal(history.body.data.total, 2); assert.equal(history.body.data.items[0].performedBy.name, accountant.name); assert.equal(history.body.data.items[0].paidOn, paidOn);
  const voucherURL = base + `/finance/payments/${first.body.data.id}/voucher`;
  assert.equal((await fetch(voucherURL)).status, 401); assert.equal((await fetch(voucherURL, { headers: { Authorization: `Bearer ${token(employee)}` } })).status, 403);
  const voucher = await fetch(voucherURL, { headers: { Authorization: `Bearer ${token(accountant)}` } }); assert.equal(voucher.status, 200); assert.equal(voucher.headers.get('cache-control'), 'private, no-store'); assert.ok((await voucher.text()).startsWith('%PDF-'));
  assert.equal((await call(director, `/finance/payments?requestId=${id}`)).status, 404, 'Director scope must not expand to unrelated low-value requests');
  const managerId = await create(50_000_000, manager); assert.equal((await approve(director, managerId)).status, 200); assert.equal((await approve(accountant, managerId)).status, 200);
  assert.equal((await pay(managerId, 5_000_000)).status, 201);
  const directorSummary = await call(director, '/finance/summary'), accountantSummary = await call(accountant, '/finance/summary');
  assert.equal(directorSummary.body.data.approvedAmount, 50_000_000); assert.equal(directorSummary.body.data.paidAmount, 5_000_000); assert.equal(accountantSummary.body.data.paidAmount, 15_000_000);
  assert.equal((await call(hr, '/finance/summary')).status, 403); assert.equal((await call(admin, '/finance/summary')).status, 403);
  const raced = await create(); await approve(manager, raced); await approve(accountant, raced);
  const racing = await Promise.all([pay(raced, 7_000_000), pay(raced, 7_000_000)]); assert.equal(racing.filter(result => result.status === 201).length, 1, JSON.stringify(racing)); assert.equal((await Request.findById(raced)).paidAmount, 7_000_000); assert.equal(await Payment.countDocuments({ request: raced }), 1);
  const concurrent = await create(); await approve(manager, concurrent);
  const beforeBudget = (await Department.findById(dept._id)).usedBudget;
  const approvals = await Promise.all([approve(accountant, concurrent), approve(accountant, concurrent)]); assert.equal(approvals.filter(result => result.status === 200).length, 1); assert.equal((await Department.findById(dept._id)).usedBudget, beforeBudget + 10_000_000);
  const rollback = await create(); await approve(manager, rollback); await approve(accountant, rollback);
  const originalCreate = Payment.create; Payment.create = async () => { throw new Error('Isolated ledger write failure'); };
  try { assert.equal((await pay(rollback, 1_000_000)).status, 500); } finally { Payment.create = originalCreate; }
  assert.equal((await Request.findById(rollback)).paidAmount, 0); assert.equal(await Payment.countDocuments({ request: rollback }), 0, 'A ledger failure must roll back the request counter');
  const auditRollback = await create(); await approve(manager, auditRollback); await approve(accountant, auditRollback);
  const originalAuditCreate = AuditLog.create;
  AuditLog.create = async () => { throw new Error('Isolated payment audit failure'); };
  try { assert.equal((await pay(auditRollback, 1_000_000)).status, 500); } finally { AuditLog.create = originalAuditCreate; }
  assert.equal((await Request.findById(auditRollback)).paidAmount, 0);
  assert.equal(await Payment.countDocuments({ request: auditRollback }), 0, 'An audit failure must roll back both ledger and request counter');
  const legacy = await Request.create({ title: 'Legacy approved', type: 'PURCHASE', content: 'Existing record', amount: 2_000_000, author: employee._id, department: dept._id, status: 'APPROVED', completedAt: new Date(), approvalHistory: [{ approverId: accountant._id, role: 'ACCOUNTANT', action: 'APPROVED', toStatus: 'APPROVED', timestamp: new Date() }] });
  const legacyBudget = (await Department.findById(dept._id)).usedBudget;
  assert.equal((await pay(legacy._id, 1_000_000)).status, 201); assert.equal((await Department.findById(dept._id)).usedBudget, legacyBudget, 'Legacy snapshots must never debit the budget again');
  const unknownLegacy = await Request.create({ title: 'Legacy missing evidence', type: 'PURCHASE', content: 'Existing record', amount: 1000, author: employee._id, status: 'APPROVED' });
  assert.equal((await pay(unknownLegacy._id, 1)).status, 400);
  await t.test('private R2 HTTP storage with Mongo transactions, historical local evidence and all six role scopes', async t => {
    const { r2Fixture } = await import('./support/r2Fixture.js');
    const remote = await r2Fixture(t, storage.root);
    const previousStorage = app.locals.documentStorage;
    app.locals.documentStorage = remote.store;
    t.after(() => { app.locals.documentStorage = previousStorage; });
    app.use('/api/hr', (await import('../src/Router/hr.js')).default);
    const auth = user => ({ Authorization: 'Bearer ' + token(user) });
    const local = await fetch(voucherURL, { headers: auth(accountant) });
    assert.equal(local.status, 200); assert.match(await local.text(), /^%PDF-/);
    assert.equal(remote.calls.length, 0);

    const proof = '%PDF-1.4\nIsolated R2 evidence';
    const expectedHash = createHash('sha256').update(proof).digest('hex');
    const purchase = await create(50_000_000);
    for (const actor of [manager, director, accountant]) assert.equal((await approve(actor, purchase)).status, 200);
    const paymentKey = randomUUID();
    const submit = () => pay(purchase, 200, paymentKey, accountant, { pdf: proof });
    const first = await submit(); assert.equal(first.status, 201, JSON.stringify(first.body));
    const stored = await Payment.findById(first.body.data.id).lean();
    const key = stored.voucher.path.slice(1);
    assert.equal(stored.voucher.sha256, expectedHash);
    assert.equal(remote.objects.get(key).sha256, expectedHash);
    const writes = remote.calls.length;
    remote.failWrites = true;
    try {
      assert.equal((await submit()).body.data.id, first.body.data.id);
      assert.equal((await pay(purchase, 200, paymentKey, accountant, { pdf: proof + ' changed' })).status, 409);
    } finally { remote.failWrites = false; }
    assert.equal(remote.calls.length, writes);
    assert.equal(await Payment.countDocuments({ request: purchase }), 1);
    assert.equal((await Request.findById(purchase)).paidAmount, 200);
    const url = base + '/finance/payments/' + stored._id + '/voucher';
    const beforeDenials = remote.calls.length;
    assert.equal((await fetch(url)).status, 401);
    for (const actor of [employee, manager, hr, admin]) assert.equal((await fetch(url, { headers: auth(actor) })).status, 403);
    assert.equal(remote.calls.length, beforeDenials);
    for (const actor of [director, accountant]) {
      const response = await fetch(url, { headers: auth(actor) });
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), expectedHash);
    }

    const failedAudit = t.mock.method(AuditLog, 'create', async () => { throw new Error('Isolated abort'); });
    try { assert.equal((await pay(purchase, 300)).status, 500); } finally { failedAudit.mock.restore(); }
    remote.failWrites = true;
    try { assert.equal((await pay(purchase, 300)).status, 503); } finally { remote.failWrites = false; }
    assert.deepEqual([...remote.objects.keys()], [key]);
    assert.equal(await Payment.countDocuments({ request: purchase }), 1);
    assert.equal((await Request.findById(purchase)).paidAmount, 200);

    const form = new FormData();
    for (const [k,v] of Object.entries({ type: 'TRAINING', title: 'Test R2 attachment', content: 'Owned fixture',
      extraDetails: JSON.stringify({ courseName: 'Course', provider: 'Provider', fromDate: paidOn, toDate: paidOn }) })) form.set(k,v);
    form.set('attachment', new Blob([proof], {type: 'application/pdf'}), 'course.pdf');
    const created = await fetch(base, { method: 'POST', headers: auth(employee), body: form });
    const body = await created.json(); assert.equal(created.status, 201, JSON.stringify(body));
    const attachment = base + '/' + body.data._id + '/attachment';
    for (const [endpoint, actor] of [[attachment, employee], [base.replace('/api/request','/api/hr') + '/requests/' + body.data._id + '/attachment', hr]]) {
      const res = await fetch(endpoint, { headers: auth(actor) });
      assert.equal(res.status, 200); assert.equal(await res.text(), proof);
    }
    assert.equal((await fetch(attachment, { headers: auth(director) })).status, 404);
    const invalid = t.mock.method(Request, 'create', async () => { throw Object.assign(new Error('Test only'), { name: 'ValidationError' }); });
    try { assert.equal((await fetch(base, { method: 'POST', headers: auth(employee), body: form })).status, 400); }
    finally { invalid.mock.restore(); }
    assert.equal(remote.objects.size, 2);
    const raceKey = randomUUID();
    const parallel = await Promise.all([pay(purchase, 100, raceKey), pay(purchase, 100, raceKey)]);
    assert.equal(parallel.filter(result => result.status === 201).length, 1);
    assert.ok(parallel.every(result => [200, 201, 409].includes(result.status)));
    assert.equal((await pay(purchase, 100, raceKey)).status, 200);
    assert.equal((await Request.findById(purchase)).paidAmount, 300);
    assert.equal(await Payment.countDocuments({ request: purchase }), 2);
    assert.equal(remote.objects.size, 3);
    // Simulate losing the reply after Mongo has actually committed the transaction.
    const startSession = mongoose.startSession.bind(mongoose);
    const lostReply = t.mock.method(mongoose, 'startSession', async () => {
      const session = await startSession();
      const transact = session.withTransaction.bind(session);
      session.withTransaction = async callback => {
        await transact(callback);
        throw new Error('Isolated lost commit response');
      };
      return session;
    });
    const ambiguousKey = randomUUID();
    try { assert.equal((await pay(purchase, 50, ambiguousKey)).status, 500); } finally { lostReply.mock.restore(); }
    const recovered = await pay(purchase, 50, ambiguousKey);
    assert.equal(recovered.status, 200);
    assert.equal((await Request.findById(purchase)).paidAmount, 350);
    assert.equal(await Payment.countDocuments({ request: purchase }), 3);
    const recoveredVoucher = await fetch(base + '/finance/payments/' + recovered.body.data.id + '/voucher', { headers: auth(accountant) });
    assert.equal(recoveredVoucher.status, 200); assert.match(await recoveredVoucher.text(), /^%PDF-/);
    assert.equal(remote.objects.size, 4);
    for (const kind of ['uploads', 'payment-vouchers']) assert.deepEqual(await readdir(remote.store.uploadDirectory(kind)), []);
  });
  await checkBudgetIncreases({ t, call, create, approve, users, dept, User, Department, Request, Payment, AuditLog, BudgetIncreaseRequest });
  if (config.database === 'flowrequest_test') await t.test('GridFS on owned Atlas test database', async t => {
    const { checkGridStorage } = await import('./support/gridStorageChecks.js');
    await checkGridStorage({ t, app, db, storage, base, pay, purchase: managerId, voucherURL, token, users, mongoose, Request, Payment, AuditLog });
  });
});
