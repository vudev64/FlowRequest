import './support/unitTestStorage.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import router from '../src/Router/request.js';
import User from '../src/models/User.js';
import SystemSettings from '../src/models/SystemSettings.js';
import BudgetIncreaseRequest from '../src/models/BudgetIncreaseRequest.js';

test('budget increase API denies other roles and rejects tampered requests before persistence', async t => {
  const actor = { _id: new mongoose.Types.ObjectId(), role: 'ACCOUNTANT' };
  const originalUser = User.findById, originalSettings = SystemSettings.findOne, originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'isolated-budget-increase-unit-key';
  const chain = value => ({ select() { return this; }, maxTimeMS() { return this; }, lean: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
  User.findById = () => chain(actor); SystemSettings.findOne = () => chain(null);
  t.after(() => { User.findById = originalUser; SystemSettings.findOne = originalSettings; originalSecret === undefined ? delete process.env.JWT_SECRET : process.env.JWT_SECRET = originalSecret; });
  const app = express(); app.use(express.json()); app.use('/api/request', router);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/request/finance/budget-increases`;
  const token = jwt.sign({ id: actor._id }, process.env.JWT_SECRET);
  const body = { departmentId: String(new mongoose.Types.ObjectId()), amount: 100, reason: 'Test request' };
  const call = (method, suffix = '', data = body) => fetch(base + suffix, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': 'isolated-unit-key-12345' }, ...(method === 'GET' ? {} : { body: JSON.stringify(data) }) });
  assert.equal((await fetch(base)).status, 401);
  for (const role of ['EMPLOYEE','MANAGER','HR_ADMIN','SYSTEM_ADMIN']) {
    actor.role = role;
    assert.equal((await call('GET')).status, 403); assert.equal((await call('POST')).status, 403);
    assert.equal((await call('PATCH', '/' + body.departmentId + '/decision', { action: 'APPROVED' })).status, 403);
  }
  actor.role = 'DIRECTOR'; assert.equal((await call('POST')).status, 403);
  actor.role = 'ACCOUNTANT'; assert.equal((await call('PATCH', '/' + body.departmentId + '/decision', { action: 'APPROVED' })).status, 403);
  assert.equal((await call('GET', '?page=9007199254740991')).status, 400);
  for (const patch of [{ amount: 0 }, { amount: -1 }, { amount: 1.5 }, { amount: '100' }, { reason: '' }, { reason: ' '.repeat(10) }, { reason: 'x'.repeat(2001) }, { departmentId: 'invalid' }, { status: 'APPROVED' }, { createdBy: body.departmentId }]) {
    assert.equal((await call('POST', '', { ...body, ...patch })).status, 400);
  }
});

test('budget increase records store VND integer amounts and are independent of business requests', () => {
  const value = { department: new mongoose.Types.ObjectId(), departmentName: 'IT', amount: 100,
    reason: 'Capacity', createdBy: new mongoose.Types.ObjectId(), idempotencyKey: 'isolated-model-fixture' };
  const record = new BudgetIncreaseRequest(value);
  assert.equal(record.validateSync(), undefined); assert.equal(record.status, 'PENDING');
  for (const amount of [-1, 0, 0.5, Number.MAX_SAFE_INTEGER + 1]) assert.ok(new BudgetIncreaseRequest({ ...value, amount }).validateSync());
  assert.equal(record.schema.path('amount').options.immutable, true);
  assert.equal(record.schema.path('createdBy').options.immutable, true);
});
