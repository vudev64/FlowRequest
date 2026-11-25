import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import router from '../src/Router/request.js';
import User from '../src/models/User.js';
import Department from '../src/models/Department.js';
import SystemSettings from '../src/models/SystemSettings.js';
import AuditLog from '../src/models/Auditlog.js';
import { approvalSnapshot, financeScope, calendarDay, paymentDto } from '../src/services/FinanceService.js';

const chain = value => ({ select() { return this; }, session() { return this; }, maxTimeMS() { return this; }, lean: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });

test('finance preserves approved snapshots, requires final accounting evidence and protects Director scope', () => {
  const actor = new mongoose.Types.ObjectId(), at = new Date('2026-01-02T01:00:00Z');
  const original = { type: 'PURCHASE', status: 'APPROVED', amount: 10_000_000, approvalHistory: [{ role: 'ACCOUNTANT', action: 'APPROVED', toStatus: 'APPROVED', approverId: actor, timestamp: at }] };
  assert.equal(approvalSnapshot(original).verified, true);
  assert.equal(approvalSnapshot({ ...original, amount: 20_000_000, approvedAmount: 10_000_000, approvedAt: at, approvedBy: actor }).amount, 10_000_000);
  for (const changed of [{ status: 'PENDING_ACCOUNTANT' }, { type: 'LEAVE' }, { approvalHistory: [] }, { amount: -1 }, { amount: 1.5 }, { approvalHistory: [{ ...original.approvalHistory[0], timestamp: 'invalid' }] }]) assert.equal(approvalSnapshot({ ...original, ...changed }).verified, false);
  assert.equal(financeScope({ role: 'ACCOUNTANT', _id: actor }).$or, undefined);
  assert.deepEqual(financeScope({ role: 'DIRECTOR', _id: actor }).$or, [{ currentApprover: actor }, { requiresDirector: true }, { 'approvalHistory.approverId': actor }]);
  assert.equal(calendarDay('2026-01-01T18:00:00Z', 'Asia/Bangkok'), '2026-01-02');
  const dto = paymentDto({ _id: actor, request: { _id: actor, title: 'Real title', type: 'PURCHASE' }, performedBy: { _id: actor, name: 'Recorder' }, amount: 10, voucher: { originalName: 'proof.pdf', path: '/private', sha256: 'secret' } });
  assert.equal(dto.performedBy.name, 'Recorder');
  assert.equal(JSON.stringify(dto).includes('/private'), false);
  assert.equal(dto.amount, 10);
});

test('budget API restricts roles, validates real departments, rejects stale writes and rolls back when audit fails', async t => {
  const restore = [], mock = (obj, key, value) => { const old = obj[key]; restore.push(() => obj[key] = old); obj[key] = value; };
  const secret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'isolated-finance-unit-test';
  t.after(() => { restore.reverse().forEach(fn => fn()); secret === undefined ? delete process.env.JWT_SECRET : process.env.JWT_SECRET = secret; });
  const actor = { _id: new mongoose.Types.ObjectId(), role: 'ACCOUNTANT', tokenVersion: 0 };
  let budget = null, audit = [], auditFails = false;
  mock(User, 'findById', () => chain(actor)); mock(User, 'exists', async query => query.department === 'Existing Department');
  mock(SystemSettings, 'findOne', () => chain(null));
  mock(Department, 'create', async docs => { budget = { _id: new mongoose.Types.ObjectId(), ...docs[0] }; return [budget]; });
  mock(Department, 'findById', () => chain(budget));
  mock(Department, 'findOneAndUpdate', async (filter, update) => {
    if ((budget.budgetRevision || 0) !== filter.$expr.$eq[1] || budget.usedBudget > filter.usedBudget.$lte) return null;
    budget = { ...budget, ...update.$set, budgetRevision: (budget.budgetRevision || 0) + 1 }; return budget;
  });
  mock(AuditLog, 'create', async docs => { if (auditFails) throw new Error('Audit unavailable'); audit.push(...docs); });
  mock(mongoose, 'startSession', async () => ({ endSession: async () => {}, withTransaction: async fn => {
    const previous = budget && { ...budget }, count = audit.length;
    try { await fn(); } catch (error) { budget = previous; audit.length = count; throw error; }
  } }));
  const app = express(); app.use(express.json()); app.use('/request', router);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/request`, token = jwt.sign({ id: actor._id }, process.env.JWT_SECRET);
  const call = (body, editing = false) => fetch(base + '/finance/budgets' + (editing ? '/' + budget._id : ''), { method: editing ? 'PATCH' : 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const opening = { name: 'Existing Department', code: 'DEP', allocatedAmount: 100, openingCommittedAmount: 40 };
  assert.equal((await fetch(base + '/finance/budgets', { method: 'POST' })).status, 401);
  for (const role of ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'DIRECTOR', 'SYSTEM_ADMIN']) { actor.role = role; assert.equal((await call(opening)).status, 403); }
  actor.role = 'ACCOUNTANT';
  for (const changed of [{ name: 'Invented Department' }, { openingCommittedAmount: 101 }, { allocatedAmount: 0.5 }, { allocatedAmount: '100' }, { openingCommittedAmount: -1 }, { usedBudget: 0 }]) assert.equal((await call({ ...opening, ...changed })).status, 400);
  assert.equal(budget, null);
  assert.equal((await call(opening)).status, 201); assert.equal(budget.usedBudget, 40); assert.equal(audit.length, 1);
  assert.equal((await call({ allocatedAmount: 39, revision: 1 }, true)).status, 400);
  assert.equal((await call({ allocatedAmount: 90, revision: 0 }, true)).status, 409);
  assert.equal((await call({ allocatedAmount: 150, revision: 1, openingCommittedAmount: 0 }, true)).status, 400);
  assert.equal((await call({ allocatedAmount: 150, revision: 1 }, true)).status, 403);
  assert.equal(budget.annualBudget, 100); assert.equal(audit.length, 1);
  assert.equal((await call({ allocatedAmount: 90, revision: 1 }, true)).status, 200);
  assert.equal(budget.usedBudget, 40); assert.equal(budget.budgetRevision, 2); assert.equal(audit.length, 2);
  auditFails = true;
  assert.equal((await call({ allocatedAmount: 80, revision: 2 }, true)).status, 500);
  assert.equal(budget.annualBudget, 90); assert.equal(budget.usedBudget, 40); assert.equal(budget.budgetRevision, 2); assert.equal(audit.length, 2);
});
