import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDemoHosting } from '../src/cli/checkDemoHosting.js';

const origin = 'https://demo.example.invalid';
function response(url) {
  const route = new URL(url).pathname;
  if (route === '/') return new Response('<html>Demo</html>', { headers: { 'Content-Type': 'text/html' } });
  return new Response(JSON.stringify(route === '/health/ready' ? { environment: 'demo', ready: true } : route.endsWith('/settings') ? { general: { systemName: 'FlowRequest' } } : { message: 'Unauthorized' }), { status: route.endsWith('/request') ? 401 : 200, headers: { 'X-FlowRequest-Environment': 'demo' } });
}
test('hosting smoke performs only anonymous GET checks and requires Demo routing/authentication', async () => {
  const calls = [];
  const report = await checkDemoHosting(origin, { request: async (url, options) => { calls.push(url); assert.equal(options.method, undefined); assert.equal(options.redirect, 'manual'); return response(url); } });
  assert.equal(report.passed, true); assert.equal(report.writes, 0); assert.equal(calls.length, 4);
  assert.ok(report.notCovered.includes('MongoDB finance integration suite'));
});
test('hosting check rejects insecure URLs, frontend fallbacks and unavailable hosting', async () => {
  for (const value of ['http://demo.example.invalid', origin + '/path', origin + '?token=x', 'https://user:password@demo.example.invalid']) await assert.rejects(checkDemoHosting(value));
  const fallback = await checkDemoHosting(origin, { request: async () => new Response('<html>Fallback</html>', { headers: { 'Content-Type': 'text/html' } }) });
  assert.equal(fallback.passed, false);
  const offline = await checkDemoHosting(origin, { request: async () => { throw new Error('Unavailable'); } });
  assert.equal(offline.passed, false); assert.ok(offline.checks.every(row => row.status === 'NOT_VERIFIED'));
});
