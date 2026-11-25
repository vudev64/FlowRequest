import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Request from '../src/models/Request.js';
import AuditLog from '../src/models/Auditlog.js';
import SystemSettings from '../src/models/SystemSettings.js';
import hrRouter from '../src/Router/hr.js';
import adminRouter from '../src/Router/admin.js';
import { protect } from '../src/middleware/authMiddleware.js';
import { demoRateLimit } from '../src/middleware/demoRateLimit.js';
import { signAccessToken } from '../src/services/TokenService.js';
import { sendEmail } from '../src/services/EmailService.js';
import { settingsDefaults } from '../src/config/settingsDefaults.js';
import { createApp } from '../src/app.js';
import { getRequests, getDashboard, updateRequestStatus } from '../src/Controllers/requestController.js';

const chain = value => ({ select() { return this; }, session() { return this; }, maxTimeMS() { return this; }, lean: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
function patcher(t) { const restore = []; t.after(() => restore.reverse().forEach(fn => fn())); return (obj, key, value) => { const old = obj[key]; restore.push(() => obj[key] = old); obj[key] = value; }; }
function demoEnv(t) {
  for (const [key, value] of Object.entries({ FLOWREQUEST_ENV: 'demo', JWT_SECRET: 'isolated-security-test-secret-123456789', DEMO_JWT_SECRET: '' })) {
    const old = process.env[key]; t.after(() => old === undefined ? delete process.env[key] : process.env[key] = old); process.env[key] = value;
  }
}
async function serve(t, app) { const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); t.after(() => new Promise(resolve => server.close(resolve))); return `http://127.0.0.1:${server.address().port}`; }

test('HR changes revoke old sessions permanently; protected Demo accounts reject HR/Admin mutations', async t => {
  demoEnv(t); const patch = patcher(t);
  const actor = { _id: new mongoose.Types.ObjectId(), role: 'HR_ADMIN', status: 'ACTIVE', tokenVersion: 0 };
  let target = { _id: new mongoose.Types.ObjectId(), name: 'Employee', email: 'person@example.invalid', department: 'IT', role: 'EMPLOYEE', status: 'ACTIVE', tokenVersion: 0 };
  let writes = 0;
  const doc = value => ({ ...value, toObject: () => ({ ...value }) });
  const config = settingsDefaults(); config.security.sessionMinutes = 10080;
  patch(SystemSettings, 'findOne', () => chain(config));
  patch(User, 'findById', id => chain(doc(String(id) === String(actor._id) ? actor : target)));
  patch(User, 'findOne', () => chain(doc(target)));
  patch(User, 'exists', () => chain(null)); patch(Request, 'exists', () => chain(null));
  patch(User, 'findOneAndUpdate', (filter, update) => {
    writes++;
    if (String(filter._id) === String(target._id)) { Object.assign(target, update.$set); target.tokenVersion += update.$inc?.tokenVersion || 0; }
    return chain(doc(target));
  });
  patch(AuditLog, 'create', async () => {});
  patch(mongoose, 'startSession', async () => ({ withTransaction: async fn => fn(), endSession: async () => {} }));
  const app = express(); app.use(express.json()); app.use('/hr', hrRouter); app.use('/admin', adminRouter); app.get('/protected', protect, (req, res) => res.json({ ok: true }));
  const base = await serve(t, app);
  const actorHeaders = () => ({ Authorization: `Bearer ${signAccessToken(actor._id, actor.role, actor.tokenVersion, 60)}`, 'Content-Type': 'application/json' });
  const targetToken = signAccessToken(target._id, target.role, 0, 10080);
  const decoded = jwt.decode(targetToken); assert.equal(decoded.exp - decoded.iat, 7200);
  const access = token => fetch(base + '/protected', { headers: { Authorization: `Bearer ${token}` } });
  const edit = body => fetch(`${base}/hr/users/${target._id}`, { method: 'PATCH', headers: actorHeaders(), body: JSON.stringify(body) });
  assert.equal((await access(targetToken)).status, 200);
  assert.equal((await edit({ status: 'INACTIVE' })).status, 200);
  assert.equal((await access(targetToken)).status, 401);
  assert.equal((await edit({ status: 'ACTIVE' })).status, 200);
  assert.equal((await access(targetToken)).status, 401, 'Reactivating must not restore an old token');
  const fresh = signAccessToken(target._id, target.role, target.tokenVersion, 60);
  assert.equal((await access(fresh)).status, 200);
  assert.equal((await edit({ role: 'MANAGER' })).status, 200);
  assert.equal((await access(fresh)).status, 401);
  const before = writes;
  for (const role of ['EMPLOYEE', 'MANAGER', 'ACCOUNTANT']) {
    target.role = role; target.email = `${role.toLowerCase()}@teck-flowrequest.com`;
    assert.equal((await edit({ status: 'INACTIVE' })).status, 403);
    assert.equal((await edit({ email: 'takeover@example.invalid' })).status, 403);
  }
  assert.equal(writes, before);
  actor.role = 'SYSTEM_ADMIN';
  for (const role of ['HR_ADMIN', 'DIRECTOR', 'SYSTEM_ADMIN']) {
    target.role = role; target.email = `${role.toLowerCase()}@teck-flowrequest.com`;
    assert.equal((await fetch(`${base}/admin/accounts/${target._id}/reset-password`, { method: 'POST', headers: actorHeaders() })).status, 403);
    assert.equal((await fetch(`${base}/admin/accounts/${target._id}/status`, { method: 'PATCH', headers: actorHeaders(), body: JSON.stringify({ status: 'INACTIVE' }) })).status, 403);
    assert.equal(target.status, 'ACTIVE');
  }
});

test('Demo rate limits reject excess attempts and ignore forged forwarding headers; reset after window', async t => {
  let time = 1000; const app = express();
  app.use(demoRateLimit({ limit: 2, windowMs: 1000, now: () => time })); app.get('/', (req, res) => res.json({ ok: true }));
  const base = await serve(t, app);
  for (let i = 0; i < 2; i++) assert.equal((await fetch(base, { headers: { 'X-Forwarded-For': `192.0.2.${i}` } })).status, 200);
  const blocked = await fetch(base, { headers: { 'X-Forwarded-For': '192.0.2.99' } }); assert.equal(blocked.status, 429); assert.equal(blocked.headers.get('Retry-After'), '1');
  time += 1001; assert.equal((await fetch(base)).status, 200);
});

test('Demo skips email before settings lookup and never contacts a provider', async t => {
  demoEnv(t); const patch = patcher(t); let externalCalls = 0;
  patch(SystemSettings, 'findOne', () => { throw new Error('No settings query should run for skipped Demo email'); });
  patch(globalThis, 'fetch', async () => { externalCalls++; throw new Error('Unexpected external call'); });
  const result = await sendEmail({ to: 'nobody@example.invalid', subject: 'test', html: 'test' });
  assert.equal(result.reason, 'DEMO_EXTERNAL_EMAIL_DISABLED'); assert.equal(externalCalls, 0);
});

test('app login limiter is active even for malformed credentials and sends safe headers', async t => {
  demoEnv(t);
  const base = await serve(t, createApp({ environment: 'demo', origins: [] }));
  for (let i = 0; i < 30; i++) assert.equal((await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 400);
  const last = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.25' }, body: '{}' });
  assert.equal(last.status, 429); assert.equal(last.headers.get('X-Content-Type-Options'), 'nosniff'); assert.equal(last.headers.get('Cache-Control'), 'no-store');
});

test('request list, statistics and approval never return internal database error text', async t => {
  const patch = patcher(t), marker = 'private-database-error-fixture';
  const fail = () => { throw new Error(marker); };
  patch(Request, 'find', fail); patch(Request, 'aggregate', fail); patch(Request, 'findById', fail); patch(console, 'error', () => {});
  for (const controller of [getRequests, getDashboard, updateRequestStatus]) {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await controller({ user: { _id: new mongoose.Types.ObjectId(), role: 'MANAGER' }, params: { id: String(new mongoose.Types.ObjectId()) }, body: { action: 'APPROVED' } }, res);
    assert.equal(res.statusCode, 500); assert.equal(JSON.stringify(res.body).includes(marker), false); assert.equal(res.body.error, undefined);
  }
});
