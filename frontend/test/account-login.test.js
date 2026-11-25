import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

test('accountant login stores the normalized role and authenticated account route survives a reload', async t => {
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), mode: 'demo', server: { middlewareMode: true, open: false, ws: false }, appType: 'custom' });
  const oldFetch = globalThis.fetch, oldStorage = globalThis.localStorage;
  const stored = new Map();
  globalThis.localStorage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) };
  t.after(async () => { await server.close(); globalThis.fetch = oldFetch; if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage; });
  const { login } = await server.ssrLoadModule('/src/features/auth/authService.js');
  const { AppContent } = await server.ssrLoadModule('/src/App.jsx');
  const { API_BASE_URL } = await server.ssrLoadModule('/src/lib/api.js');
  const actor = { id: 'accountant-user', name: 'Kế toán kiểm thử', role: 'ACCOUNTANT', email: 'accountant@example.test', department: 'Finance' };
  let outgoing;
  globalThis.fetch = async (url, options) => { outgoing = { url, options }; return new Response(JSON.stringify({ user: actor, token: 'test-token' }), { status: 200 }); };
  const result = await login(' accountant@example.test ', 'test-password');
  assert.equal(result.success, true);
  assert.equal(result.user.role, 'accountant');
  assert.equal(stored.get('flowrequest_token'), 'test-token');
  assert.equal(JSON.parse(stored.get('flowrequest_user')).role, 'accountant');
  assert.equal(outgoing.url, `${API_BASE_URL}/auth/login`);
  assert.equal(JSON.parse(outgoing.options.body).email, actor.email);
  for (const path of ['/account', '/Account', '/account/overview']) {
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(AppContent)));
    assert.ok(html.includes('acc-shell'), `Account workspace failed at ${path}`);
    assert.ok(html.includes(actor.name));
    assert.ok(html.includes('Tổng quan tài chính'));
    assert.ok(!html.includes('hr-admin-shell'));
  }
  // Restoring an older session with the backend's uppercase role also works.
  stored.set('flowrequest_user', JSON.stringify(actor));
  const restored = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/account'] }, React.createElement(AppContent)));
  assert.ok(restored.includes('acc-shell'));
  stored.set('flowrequest_user', JSON.stringify({ ...actor, role: 'employee' }));
  const denied = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/account'] }, React.createElement(AppContent)));
  assert.ok(!denied.includes('acc-shell'));
  stored.clear();
  const anonymous = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/account'] }, React.createElement(AppContent)));
  assert.ok(!anonymous.includes('acc-shell'));
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Email hoặc mật khẩu không chính xác!' }), { status: 400 });
  assert.equal((await login(actor.email, 'wrong-password')).success, false);
  assert.equal(stored.has('flowrequest_token'), false);
  globalThis.fetch = async () => new Response(JSON.stringify({ user: { ...actor, role: 'UNSUPPORTED_ROLE' }, token: 'test-token' }), { status: 200 });
  assert.equal((await login(actor.email, 'test-password')).success, false);
  assert.equal(stored.has('flowrequest_token'), false);
});
