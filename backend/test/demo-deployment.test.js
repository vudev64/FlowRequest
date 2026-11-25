import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimeConfig } from '../src/config/environment.js';
import { assertDemoDatabasePrivileges } from '../src/config/database.js';
import { inspectDatabase } from '../src/config/database.js';

test('public Demo requires explicit origins, strong JWT and a scoped authenticated MongoDB user', () => {
  const env = { FLOWREQUEST_ENV: 'demo', NODE_ENV: 'production', MONGO_URI: 'mongodb://demo-only:fixture@offline.invalid/demo', DEMO_JWT_SECRET: 'fixture-only-strong-demo-key-123456789', DEMO_ALLOWED_ORIGINS: 'https://demo.example.invalid', DEMO_TRUSTED_PROXIES: '127.0.0.1,::1' };
  const actual = runtimeConfig(env); assert.equal(actual.publicDemo, true); assert.equal(actual.environment, 'demo'); assert.deepEqual(actual.trustedProxies, ['127.0.0.1', '::1']);
  for (const changed of [{ DEMO_ALLOWED_ORIGINS: '' }, { DEMO_ALLOWED_ORIGINS: '*' }, { DEMO_JWT_SECRET: 'weak' }, { MONGO_URI: 'mongodb://offline.invalid/demo' }, { DEMO_TRUSTED_PROXIES: 'true' }]) assert.throws(() => runtimeConfig({ ...env, ...changed }));
  const status = { authInfo: { authenticatedUsers: [{ user: 'demo-only', db: 'admin' }], authenticatedUserPrivileges: [{ resource: { db: 'demo', collection: '' }, actions: ['find', 'insert', 'update', 'remove'] }] } };
  assert.doesNotThrow(() => assertDemoDatabasePrivileges(status, 'demo'));
  for (const resource of [{ db: '', collection: '' }, { db: 'production', collection: '' }, { cluster: true }, { anyResource: true }]) assert.throws(() => assertDemoDatabasePrivileges({ authInfo: { ...status.authInfo, authenticatedUserPrivileges: [...status.authInfo.authenticatedUserPrivileges, { resource, actions: ['find'] }] } }, 'demo'));
  assert.throws(() => assertDemoDatabasePrivileges({}, 'demo'));
  assert.equal(runtimeConfig({ ...env, NODE_ENV: 'development', DEMO_ALLOWED_ORIGINS: '' }).publicDemo, false, 'Local Demo development remains available');
});

test('Demo refuses a database owned by the isolated integration harness without any writes', async () => {
  const queried = [];
  const db = { collection: name => ({ findOne: async () => { queried.push(name); return name === 'flowrequest_test_control' ? { purpose: 'flowrequest-isolated-mongo-test', database: 'frft_demo_checks' } : null; } }) };
  await assert.rejects(inspectDatabase(db, 'demo'), /môi trường kiểm thử/);
  assert.deepEqual(queried, ['runtimeenvironments', 'flowrequest_test_control']);
});
