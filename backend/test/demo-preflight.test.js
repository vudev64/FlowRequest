import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDemoDeployment } from '../src/cli/checkDemoDeployment.js';

const env = { MONGO_URI: 'mongodb://scoped-demo:fixture-only@offline.invalid/demo', DEMO_JWT_SECRET: 'isolated-demo-preflight-fixture-secret', DEMO_ALLOWED_ORIGINS: 'https://demo.example.invalid' };
function client(privileges = [{ resource: { db: 'demo', collection: '' }, actions: ['find', 'insert', 'update', 'remove'] }], topology = { setName: 'replica' }) {
  const calls = [];
  return { calls, connect: async () => calls.push('connect'), close: async () => calls.push('close'), db: () => ({
    collection: () => ({ findOne: async () => null }),
    command: async command => { calls.push(Object.keys(command)[0]); return command.hello ? topology : { authInfo: { authenticatedUsers: [{ user: 'scoped-demo' }], authenticatedUserPrivileges: privileges } }; },
  }) };
}
test('Demo preflight checks scoped privileges and transaction topology using read-only commands', async () => {
  const connection = client();
  const result = await checkDemoDeployment({ env, clientFactory: () => connection, checkStorage: async () => {} });
  assert.equal(result.passed, true); assert.deepEqual(connection.calls, ['connect', 'connectionStatus', 'hello', 'close']);
  assert.ok(result.notCovered.includes('Real MongoDB finance integration tests'));
});
test('Demo preflight fails closed on missing origins, cross-DB privileges, missing storage and offline checks', async () => {
  let opened = false;
  const missing = await checkDemoDeployment({ env: { ...env, DEMO_ALLOWED_ORIGINS: '' }, clientFactory: () => { opened = true; } });
  assert.equal(missing.passed, false); assert.equal(opened, false);
  for (const connection of [client([{ resource: { db: '', collection: '' }, actions: ['find'] }]), client([{ resource: { db: 'demo', collection: '' }, actions: ['find'] }]), client(undefined, {})]) {
    const result = await checkDemoDeployment({ env, clientFactory: () => connection, checkStorage: async () => {} });
    assert.equal(result.passed, false); assert.ok(connection.calls.includes('close'));
  }
  const offline = await checkDemoDeployment({ env, offline: true, checkStorage: async () => { throw new Error('No storage'); } });
  assert.equal(offline.passed, false); assert.ok(offline.checks.some(c => c.status === 'NOT_VERIFIED'));
});
