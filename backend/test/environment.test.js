import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import express from 'express';
import path from 'node:path';
import { backendRoot, runtimeConfig, storagePaths, emailConfig } from '../src/config/environment.js';
import { signAccessToken, verifyAccessToken } from '../src/services/TokenService.js';
import { ACCOUNT_CREATION_ROLES } from '../src/config/accountPolicy.js';
import { inspectDatabase } from '../src/config/database.js';
import { validateBootstrap, bootstrapFirstAdmin } from '../src/services/BootstrapService.js';
import User from '../src/models/User.js';
import AuditLog from '../src/models/Auditlog.js';
import SystemSettings from '../src/models/SystemSettings.js';
import { register, login } from '../src/Controllers/authController.js';
import { createApp } from '../src/app.js';

function patches(t) { const undo = []; t.after(() => undo.reverse().forEach(fn => fn())); return (object, key, value) => { const old = object[key]; undo.push(() => object[key] = old); object[key] = value; }; }
function env(t, values) { for (const [key, value] of Object.entries(values)) { const old = process.env[key]; t.after(() => old === undefined ? delete process.env[key] : process.env[key] = old); value === undefined ? delete process.env[key] : process.env[key] = value; } }
const query = value => ({ session() { return this; }, maxTimeMS() { return this; }, select() { return this; }, lean: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const reply = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const productionConfig = () => ({ FLOWREQUEST_ENV: 'production', PRODUCTION_MONGO_URI: 'mongodb://prod-user:test-only@production-only.invalid/production', PRODUCTION_DB_NAME: 'production', PRODUCTION_JWT_SECRET: 'p'.repeat(48), PRODUCTION_ALLOWED_ORIGINS: 'https://company.example', PRODUCTION_STORAGE_ROOT: path.join(backendRoot, '.data', 'production-test') });

test('environment selection fails closed and keeps Demo storage unchanged', () => {
  assert.throws(() => runtimeConfig({ MONGO_URI: 'mongodb://demo.invalid/demo', JWT_SECRET: 'short' }));
  const demo = runtimeConfig({ MONGO_URI: 'mongodb://demo.invalid/demo', JWT_SECRET: 'd'.repeat(48) });
  assert.equal(demo.environment, 'demo'); assert.equal(demo.databaseName, 'demo'); assert.equal(demo.port, 5000);
  assert.equal(demo.storage.uploads, path.join(backendRoot, 'uploads'));
  const valid = productionConfig(); const actual = runtimeConfig(valid);
  assert.throws(() => runtimeConfig({ ...valid, PRODUCTION_ENABLED: 'false' }), /Production đang tạm dừng/);
  assert.equal(actual.environment, 'production'); assert.equal(actual.databaseName, 'production'); assert.equal(actual.port, 5001);
  for (const key of ['PRODUCTION_MONGO_URI', 'PRODUCTION_DB_NAME', 'PRODUCTION_JWT_SECRET', 'PRODUCTION_ALLOWED_ORIGINS', 'PRODUCTION_STORAGE_ROOT']) assert.throws(() => runtimeConfig({ ...valid, [key]: '', MONGO_URI: 'mongodb://demo.invalid/demo', JWT_SECRET: 'd'.repeat(48) }));
  assert.throws(() => runtimeConfig({ ...valid, PRODUCTION_JWT_SECRET: 'short' }));
  assert.throws(() => runtimeConfig({ ...valid, DEMO_JWT_SECRET: valid.PRODUCTION_JWT_SECRET }));
  assert.throws(() => runtimeConfig({ ...valid, DEMO_MONGO_URI: valid.PRODUCTION_MONGO_URI, DEMO_DB_NAME: valid.PRODUCTION_DB_NAME }));
  assert.throws(() => runtimeConfig({ ...valid, DEMO_MONGO_URI: valid.PRODUCTION_MONGO_URI, DEMO_DB_NAME: 'other-database' }));
  assert.throws(() => storagePaths({ ...valid, PRODUCTION_STORAGE_ROOT: backendRoot }));
  assert.throws(() => runtimeConfig({ ...valid, PRODUCTION_ALLOWED_ORIGINS: '*' }));
  assert.equal(emailConfig({ FLOWREQUEST_ENV: 'production', RESEND_API_KEY: 'demo-key' }).apiKey, undefined);
});

test('JWTs cannot cross environments even with matching user IDs or an accidentally reused signing key', t => {
  env(t, { FLOWREQUEST_ENV: 'demo', JWT_SECRET: 'd'.repeat(48), DEMO_JWT_SECRET: undefined, PRODUCTION_JWT_SECRET: 'p'.repeat(48) });
  const demo = signAccessToken('same-id', 'SYSTEM_ADMIN', 0, 60);
  const legacy = jwt.sign({ id: 'same-id', version: 0 }, process.env.JWT_SECRET, { expiresIn: 3600 });
  assert.equal(verifyAccessToken(demo).environment, 'demo'); assert.equal(verifyAccessToken(legacy).id, 'same-id');
  process.env.FLOWREQUEST_ENV = 'production';
  assert.throws(() => verifyAccessToken(demo)); assert.throws(() => verifyAccessToken(legacy));
  const production = signAccessToken('same-id', 'SYSTEM_ADMIN', 0, 60); assert.equal(verifyAccessToken(production).environment, 'production');
  process.env.JWT_SECRET = process.env.PRODUCTION_JWT_SECRET; process.env.FLOWREQUEST_ENV = 'demo';
  assert.throws(() => verifyAccessToken(production));
  const forgedEnvironment = jwt.sign({ id: 'same-id', environment: 'demo' }, process.env.PRODUCTION_JWT_SECRET, { issuer: 'flowrequest:production', audience: 'flowrequest:production:api' });
  process.env.FLOWREQUEST_ENV = 'production'; assert.throws(() => verifyAccessToken(forgedEnvironment));
});

test('database guard refuses cross-environment and nonempty bootstrap targets without writing', async () => {
  const db = (identity, hasData = false) => ({ collection: name => ({ findOne: async () => name === 'runtimeenvironments' ? identity : hasData ? { _id: 'existing' } : null }), listCollections: () => ({ toArray: async () => [{ name: 'users' }] }) });
  await inspectDatabase(db(null), 'demo'); await inspectDatabase(db({ environment: 'production' }), 'production');
  await assert.rejects(inspectDatabase(db({ environment: 'production' }), 'demo'));
  await assert.rejects(inspectDatabase(db({ environment: 'demo' }), 'production', true));
  await assert.rejects(inspectDatabase(db(null), 'production'));
  await assert.rejects(inspectDatabase(db(null, true), 'production', true));
  await inspectDatabase(db(null), 'production', true);
});

test('both environments share provisioning rules and Production rejects reserved Demo identities before database lookup', async t => {
  const patch = patches(t); let creates = [], queries = 0;
  patch(SystemSettings, 'findOne', () => query(null));
  patch(User, 'findOne', async () => { queries++; return null; });
  patch(User, 'create', async value => { creates.push(value); return { ...value, _id: new mongoose.Types.ObjectId() }; });
  env(t, { FLOWREQUEST_ENV: 'demo' });
  for (const environment of ['demo', 'production']) {
    process.env.FLOWREQUEST_ENV = environment;
    for (const actor of ['SYSTEM_ADMIN', 'HR_ADMIN']) for (const role of ['EMPLOYEE', 'MANAGER', 'ACCOUNTANT', 'HR_ADMIN', 'DIRECTOR', 'SYSTEM_ADMIN']) {
      const res = reply(); await register({ user: { role: actor }, body: { name: 'Person', email: `${actor}-${role}@example.test`, password: 'StrongPass123!', role, department: 'Real department' } }, res);
      assert.equal(res.statusCode, ACCOUNT_CREATION_ROLES[actor].includes(role) ? 201 : 403, `${environment}: ${actor} -> ${role}`);
    }
  }
  const before = queries;
  for (const role of ['employee', 'manager', 'hr_admin', 'accountant', 'director', 'system_admin']) {
    const res = reply(); await login({ body: { email: role + '@teck-flowrequest.com', password: 'any-value' } }, res); assert.equal(res.statusCode, 400);
  }
  assert.equal(queries, before, 'Reserved Demo accounts must not query Production users');
  assert.ok(creates.every(user => user.role !== 'SYSTEM_ADMIN'));
});

test('bootstrap creates one admin with audit and rolls back the singleton lock if audit fails', async t => {
  const patch = patches(t); const users = [], audits = [], state = new Map(); let auditFails = false;
  patch(User, 'init', async () => {}); patch(AuditLog, 'init', async () => {});
  patch(User, 'exists', () => query(users.length ? users[0] : null));
  patch(User, 'create', async docs => { users.push(...docs); return docs; });
  patch(AuditLog, 'create', async docs => { if (auditFails) throw new Error('audit failure'); audits.push(...docs); return docs; });
  patch(mongoose.connection, 'collection', () => ({ findOne: async filter => state.get(filter._id), insertOne: async value => { if (state.has(value._id)) throw Object.assign(new Error('duplicate'), { code: 11000 }); state.set(value._id, value); } }));
  patch(mongoose.connection, 'db', { createCollection: async () => {} }); patch(mongoose.connection, 'name', 'bootstrap-test');
  patch(mongoose, 'startSession', async () => ({ endSession: async () => {}, withTransaction: async fn => {
    const old = new Map(state), oldUsers = users.length, oldAudits = audits.length;
    try { await fn(); } catch (error) { state.clear(); for (const [key, value] of old) state.set(key, value); users.length = oldUsers; audits.length = oldAudits; throw error; }
  } }));
  const config = { environment: 'production', databaseName: 'bootstrap-test' }, input = { name: 'Real Admin', email: 'admin@company.example', department: 'Company', password: 'StrongBootstrap123!' };
  assert.throws(() => validateBootstrap({ ...input, email: 'system_admin@teck-flowrequest.com' })); assert.throws(() => validateBootstrap({ ...input, password: 'weak' }));
  auditFails = true; await assert.rejects(bootstrapFirstAdmin(config, input)); assert.equal(users.length, 0); assert.equal(state.size, 0);
  auditFails = false; await bootstrapFirstAdmin(config, input); assert.equal(users.length, 1); assert.equal(users[0].role, 'SYSTEM_ADMIN'); assert.notEqual(users[0].password, input.password); assert.equal(audits.length, 1);
  assert.equal(JSON.stringify(audits).includes(input.password), false);
  await assert.rejects(bootstrapFirstAdmin(config, input)); assert.equal(users.length, 1);
});

test('Production app tags responses and restricts browser origins without exposing stack traces', async t => {
  env(t, { FLOWREQUEST_ENV: 'production' });
  // No database connection or business writes: exercise startup-independent routes and JSON parser.
  const app = createApp({ environment: 'production', origins: ['https://company.example'] });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const allowed = await fetch(base, { headers: { Origin: 'https://company.example' } }); assert.equal(allowed.headers.get('X-FlowRequest-Environment'), 'production'); assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://company.example');
  const other = await fetch(base, { headers: { Origin: 'https://demo.example' } }); assert.equal(other.headers.get('access-control-allow-origin'), null);
  const bad = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }); assert.equal(bad.status, 400); assert.equal((await bad.text()).includes('SyntaxError'), false);
});
