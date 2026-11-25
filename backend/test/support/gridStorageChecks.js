import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { configuredDocumentStorage } from '../../src/services/DocumentStorage.js';
import { gridCharge, GRID_QUOTA, GRID_LEDGER, GRID_BUCKET } from '../../src/services/GridDocumentStorage.js';

export async function checkGridStorage({ t, app, db, storage, base, pay, purchase, voucherURL, token, users, mongoose, Request, Payment, AuditLog }) {
  assert.equal(db.databaseName, 'flowrequest_test');
  const [employee, manager, director, accountant, hr, admin] = users;
  const previous = app.locals.documentStorage;
  const grid = configuredDocumentStorage({ FLOWREQUEST_ENV: 'demo', DEMO_STORAGE_ROOT: storage.root, DEMO_STORAGE_DRIVER: 'gridfs' });
  const makeName = grid.filename.bind(grid);
  grid.filename = name => makeName('test-' + storage.runId + '-' + name);
  app.locals.documentStorage = grid;
  t.after(() => { app.locals.documentStorage = previous; });
  const ledger = db.collection(GRID_LEDGER), files = db.collection(GRID_BUCKET + '.files'), chunks = db.collection(GRID_BUCKET + '.chunks');
  const counter = { _id: 'quota', _testRunId: storage.runId };
  await ledger.insertOne({ ...counter, bytes: 0, active: 0 });
  const auth = user => ({ Authorization: 'Bearer ' + token(user) });
  const bytes = Buffer.from('%PDF-1.4\n' + 'a'.repeat(300000));
  const hash = buffer => createHash('sha256').update(buffer).digest('hex');
  const submit = (key = randomUUID()) => pay(purchase, 1, key, accountant, { pdf: bytes });
  const baseline = (await Request.findById(purchase)).paidAmount;
  const charge = gridCharge(bytes.length);
  const legacy = await fetch(voucherURL, { headers: auth(accountant) });
  assert.equal(legacy.status, 200); assert.match(await legacy.text(), /^%PDF-/);
  let url;

  await t.test('concurrent quota reservation, multi-chunk voucher, ownership and Local reads', async () => {
    const occupied = GRID_QUOTA - 1024 ** 2 - charge;
    await ledger.updateOne(counter, { $set: { bytes: occupied } });
    const attempts = await Promise.all([submit(), submit()]);
    assert.deepEqual(attempts.map(v => v.status).sort(), [201, 507], JSON.stringify(attempts));
    assert.equal((await ledger.findOne(counter)).bytes, occupied + charge);
    await ledger.updateOne(counter, { $inc: { bytes: -occupied } });
    const id = attempts.find(v => v.status === 201).body.data.id;
    const payment = await Payment.findById(id);
    assert.equal(payment.voucher.sha256, hash(bytes));
    assert.equal(await files.countDocuments(), 1); assert.equal(await chunks.countDocuments(), 2);
    url = base + '/finance/payments/' + id + '/voucher';
    assert.equal((await fetch(url)).status, 401);
    for (const user of [employee,manager,hr,admin]) assert.equal((await fetch(url, { headers: auth(user) })).status, 403);
    app.locals.documentStorage = previous;
    try {
      for (const user of [director, accountant]) {
        const response = await fetch(url, { headers: auth(user) });
        assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
        assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(bytes));
      }
    } finally { app.locals.documentStorage = grid; }
  });
  await t.test('abort, simultaneous replay and lost commit reply preserve only committed vouchers', async () => {
    const badAudit = t.mock.method(AuditLog, 'create', async () => { throw Error('isolated abort'); });
    try { assert.equal((await submit()).status, 500); } finally { badAudit.mock.restore(); }
    assert.equal(await files.countDocuments(), 1); assert.equal(await chunks.countDocuments(), 2);
    assert.equal((await ledger.findOne(counter)).bytes, charge);
    const key = randomUUID();
    const results = await Promise.all([submit(key), submit(key)]);
    assert.deepEqual(results.map(v => v.status).sort(), [200,201], JSON.stringify(results));
    assert.equal((await pay(purchase, 2, key)).status, 409);
    const start = mongoose.startSession.bind(mongoose);
    const lost = t.mock.method(mongoose, 'startSession', async () => {
      const session = await start(), transact = session.withTransaction.bind(session);
      session.withTransaction = async fn => { await transact(fn); throw Error('lost commit response'); };
      return session;
    });
    const unknown = randomUUID();
    try { assert.equal((await submit(unknown)).status, 500); } finally { lost.mock.restore(); }
    const replay = await submit(unknown); assert.equal(replay.status, 200);
    const res = await fetch(base + '/finance/payments/' + replay.body.data.id + '/voucher', { headers: auth(accountant) });
    assert.equal(hash(Buffer.from(await res.arrayBuffer())), hash(bytes));
    assert.equal((await Request.findById(purchase)).paidAmount, baseline + 3);
    assert.equal(await files.countDocuments(), 3); assert.equal((await ledger.findOne(counter)).bytes, 3 * charge);
  });
  await t.test('stale partial uploads return quota once; linked evidence survives reconciliation', async () => {
    const key = 'uploads/' + grid.filename('abandoned.pdf'), owner = key + ':' + randomUUID();
    await grid.grid.reserve(key, charge, owner);
    await chunks.insertOne({ files_id: owner, n: 0, data: bytes.subarray(0, 16) });
    await ledger.updateOne({ _id: key, owner }, { $set: { started: new Date(0) } });
    await Promise.all([grid.grid.reconcileExpired(), grid.grid.reconcileExpired()]);
    assert.equal(await chunks.countDocuments({ files_id: owner }), 0);
    assert.equal(await ledger.findOne({ _id: key }), null);
    const budget = await ledger.findOne(counter);
    assert.equal(budget.bytes, 3 * charge); assert.equal(budget.active, 0);
    assert.equal((await fetch(url, { headers: auth(accountant) })).status, 200);
  });
  await t.test('attachment size cap, authorized HR download and request rollback', async () => {
    const send = async data => {
      const body = new FormData();
      for (const [k,v] of Object.entries({ type: 'TRAINING', title: 'GridFS fixture', content: 'Owned fixture',
        extraDetails: JSON.stringify({ courseName: 'Test', provider: 'Test', fromDate: '2026-01-01', toDate: '2026-01-02' }) })) body.set(k,v);
      body.set('attachment', new Blob([data], { type: 'application/pdf' }), 'test.pdf');
      return fetch(base, { method: 'POST', headers: auth(employee), body });
    };
    assert.equal((await send(Buffer.alloc(2 * 1024 ** 2 + 1))).status, 400);
    const failed = t.mock.method(Request, 'create', async () => { throw Error('isolated request write failure'); });
    try { assert.equal((await send(bytes)).status, 500); } finally { failed.mock.restore(); }
    assert.equal((await ledger.findOne(counter)).bytes, 3 * charge);
    const created = await send(bytes); assert.equal(created.status, 201);
    const id = (await created.json()).data._id;
    for (const [endpoint,user] of [[base + '/' + id + '/attachment', employee], [base.replace('/api/request','/api/hr') + '/requests/' + id + '/attachment', hr]]) {
      const res = await fetch(endpoint, { headers: auth(user) });
      assert.equal(res.status, 200); assert.equal(hash(Buffer.from(await res.arrayBuffer())), hash(bytes));
    }
    assert.equal((await fetch(base + '/' + id + '/attachment', {headers: auth(director)})).status,404);
    assert.equal((await ledger.findOne(counter)).bytes, 4 * charge);
  });
  await t.test('four DB-wide reservations and recovery after a stream integrity error', async () => {
    const owners = Array.from({ length: 4 }, () => {
      const key = 'uploads/' + grid.filename('slot.pdf');
      return { key, owner: key + ':' + randomUUID() };
    });
    await Promise.all(owners.map(({key, owner}) => grid.grid.reserve(key, charge, owner)));
    const fifth = 'uploads/' + grid.filename('overflow.pdf');
    await assert.rejects(grid.grid.reserve(fifth, charge, fifth + ':' + randomUUID()), { status: 429 });
    for (const {key, owner} of owners) await grid.grid.release(key, owner);
    const dir = grid.uploadDirectory('uploads'), filename = grid.filename('mismatch.pdf');
    const file = { path: path.join(dir, filename), filename, mimetype: 'application/pdf', size: bytes.length };
    await mkdir(dir, { recursive: true }); await writeFile(file.path, bytes);
    try {
      await assert.rejects(grid.persist('uploads', file, { sha256: '0'.repeat(64) }), { status: 409 });
      const key = 'uploads/' + filename;
      await ledger.updateOne({ _id: key }, { $set: { started: new Date(0) } });
      const restarted = configuredDocumentStorage({ FLOWREQUEST_ENV: 'demo', DEMO_STORAGE_ROOT: storage.root, DEMO_STORAGE_DRIVER: 'gridfs' });
      await restarted.grid.reconcileExpired();
      assert.equal(await ledger.findOne({ _id: key }), null);
      assert.equal(await files.countDocuments(), 4); assert.equal(await chunks.countDocuments(), 8);
      const budget = await ledger.findOne(counter);
      assert.equal(budget.active, 0); assert.equal(budget.bytes, 4 * charge);
    } finally { await grid.removeTemporary('uploads', file); }
  });
}
