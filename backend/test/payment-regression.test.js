import { testStorageRoot } from './support/unitTestStorage.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import path from 'node:path';
import { writeFile, access, mkdir } from 'node:fs/promises';
import Request from '../src/models/Request.js';
import Payment from '../src/models/Payment.js';
import Department from '../src/models/Department.js';
import AuditLog from '../src/models/Auditlog.js';
import User from '../src/models/User.js';
import SystemSettings from '../src/models/SystemSettings.js';
import { recordPayment, financeSummary } from '../src/Controllers/financeController.js';

const chain = value => ({ session() { return this; }, select() { return this; }, populate() { return this; }, sort() { return this; }, maxTimeMS() { return this; }, lean: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const reply = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('payment ledger separates commitments/actual spending, rejects replay conflicts/overpayment and rolls back audit failures', async t => {
  await mkdir(path.join(testStorageRoot, 'private-vouchers'), { recursive: true });
  const restore = [], patch = (obj, key, value) => { const old = obj[key]; restore.push(() => obj[key] = old); obj[key] = value; };
  t.after(() => restore.reverse().forEach(fn => fn()));
  const accountant = { _id: new mongoose.Types.ObjectId(), role: 'ACCOUNTANT' }, director = { _id: new mongoose.Types.ObjectId(), role: 'DIRECTOR' };
  const department = { _id: new mongoose.Types.ObjectId(), name: 'Real-shaped department', annualBudget: 1000, usedBudget: 100, budgetRevision: 1 };
  let row = { _id: new mongoose.Types.ObjectId(), author: new mongoose.Types.ObjectId(), type: 'PURCHASE', title: 'Real-shaped approved purchase', status: 'APPROVED', amount: 100, approvedAmount: 100, approvedAt: new Date('2026-01-01T00:00:00Z'), approvedBy: accountant._id, budgetDepartment: department._id, budgetChargedAmount: 100, paidAmount: 0, requiresDirector: true };
  let payments = [], audits = [], auditFails = false, stale = false, budgetWrites = 0, fileNumber = 0;
  patch(SystemSettings, 'findOne', () => chain(null));
  patch(Payment, 'init', async () => {});
  patch(Request, 'findById', () => chain(row));
  patch(Request, 'findOneAndUpdate', async (filter, change) => {
    if (stale || row.status !== filter.status || row.paidAmount + change.$inc.paidAmount > filter.$expr.$lte[1]) return null;
    row = { ...row, ...change.$set, paidAmount: row.paidAmount + change.$inc.paidAmount }; return row;
  });
  patch(Payment, 'findOne', query => chain(payments.find(p => p.idempotencyKey === query.idempotencyKey) || null));
  patch(Payment, 'aggregate', () => chain(payments.length ? [{ amount: payments.reduce((sum, p) => sum + p.amount, 0) }] : []));
  patch(Payment, 'create', async values => { const doc = new Payment(values[0]); await doc.validate(); const created = doc.toObject(); payments.push(created); return [created]; });
  patch(Payment, 'exists', async query => payments.some(p => p.voucher.path === query['voucher.path']));
  patch(AuditLog, 'create', async docs => { if (auditFails) throw new Error('Audit unavailable'); audits.push(...docs); });
  patch(Department, 'findOneAndUpdate', async () => { budgetWrites++; throw new Error('Payment must not debit budget'); });
  patch(mongoose, 'startSession', async () => ({ endSession: async () => {}, withTransaction: async fn => {
    const previous = { row: { ...row }, payments: [...payments], audits: [...audits] };
    try { await fn(); } catch (error) { row = previous.row; payments = previous.payments; audits = previous.audits; throw error; }
  } }));
  patch(Request, 'find', () => chain([row])); patch(Department, 'find', () => chain([department])); patch(User, 'distinct', async () => ['Real-shaped department']);
  const summaryFor = async actor => {
    // Match the two real aggregation group keys used by the summary controller.
    const previousAggregate = Payment.aggregate;
    Payment.aggregate = pipeline => chain([{ _id: pipeline[1].$group._id === '$department' ? department._id : row._id, amount: payments.reduce((sum, p) => sum + p.amount, 0) }]);
    try { const res = reply(); await financeSummary({ user: actor }, res); assert.equal(res.statusCode, 200); return res.body.data; }
    finally { Payment.aggregate = previousAggregate; }
  };
  async function pay(amount, key, actor = accountant) {
    const filename = `owned-payment-${++fileNumber}.pdf`, filePath = path.join(testStorageRoot, 'private-vouchers', filename);
    await writeFile(filePath, '%PDF-1.4\nSame evidence for idempotent replay');
    const res = reply();
    await recordPayment({ params: { id: String(row._id) }, body: { amount, paidOn: '2026-01-02', note: 'Evidence' }, user: actor, ip: '127.0.0.1', get: name => name === 'Idempotency-Key' ? key : 'isolated-test', file: { path: filePath, filename, originalname: 'evidence.pdf', mimetype: 'application/pdf' } }, res);
    return { ...res, filePath };
  }
  const first = await pay(40, 'first-payment-key-0001'); assert.equal(first.statusCode, 201); assert.equal(row.paidAmount, 40); assert.equal(row.approvedAmount, 100);
  assert.equal(payments.length, 1); assert.equal(audits.length, 1); assert.equal(String(payments[0].performedBy), String(accountant._id)); assert.equal(payments[0].paidOn, '2026-01-02');
  for (const actor of [accountant, director]) {
    const summary = await summaryFor(actor);
    assert.deepEqual([summary.approvedAmount, summary.paidAmount, summary.outstandingAmount], [100, 40, 60]);
    assert.equal(summary.budgets[0].committedAmount, 100); assert.equal(summary.budgets[0].paidAmount, 40);
  }
  const replay = await pay(40, 'first-payment-key-0001'); assert.equal(replay.statusCode, 200); assert.equal(replay.body.data.replayed, true);
  assert.equal(payments.length, 1); assert.equal(audits.length, 1); assert.equal(row.paidAmount, 40);
  await access(first.filePath); await assert.rejects(access(replay.filePath));
  assert.equal((await pay(41, 'first-payment-key-0001')).statusCode, 409);
  assert.equal((await pay(61, 'overpayment-key-0002')).statusCode, 400);
  assert.equal((await pay(1, 'self-payment-key-0003', { _id: row.author, role: 'ACCOUNTANT' })).statusCode, 403);
  auditFails = true; assert.equal((await pay(20, 'audit-failure-key-0004')).statusCode, 500);
  assert.equal(row.paidAmount, 40); assert.equal(payments.length, 1); assert.equal(audits.length, 1);
  auditFails = false; stale = true; assert.equal((await pay(20, 'stale-payment-key-0005')).statusCode, 409); assert.equal(row.paidAmount, 40); stale = false;
  row.paidAmount = 39; assert.equal((await pay(1, 'mismatch-payment-key-0006')).statusCode, 409); row.paidAmount = 40;
  assert.equal((await pay(60, 'second-payment-key-0007')).statusCode, 201);
  assert.equal((await pay(1, 'fully-paid-key-0008')).statusCode, 400);
  assert.equal(row.paidAmount, 100); assert.equal(row.approvedAmount, 100); assert.equal(payments.length, 2); assert.equal(audits.length, 2);
  assert.equal(budgetWrites, 0); assert.equal(department.usedBudget, 100);
  // Both dashboards consume the same ledger, not the approved amount as spending.
  const summaries = [];
  for (const actor of [accountant, director]) summaries.push(await summaryFor(actor));
  assert.deepEqual(summaries.map(s => [s.approvedAmount, s.paidAmount, s.outstandingAmount]), [[100, 100, 0], [100, 100, 0]]);
  assert.equal(summaries[0].budgets[0].committedAmount, 100); assert.equal(summaries[0].budgets[0].paidAmount, 100);
});
