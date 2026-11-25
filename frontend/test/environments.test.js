import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

test('login defaults to Production and explicit Demo paths select separate API, sessions and all six accounts', async t => {
  const keys = ['VITE_API_URL', 'VITE_APP_ENV', 'VITE_PRODUCTION_API_URL', 'VITE_DEMO_API_URL', 'VITE_ENABLE_PRODUCTION'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const original = { localStorage: globalThis.localStorage, window: globalThis.window, fetch: globalThis.fetch };
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    for (const [key, value] of Object.entries(original)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  });
  const stored = new Map();
  globalThis.localStorage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) };
  delete process.env.VITE_API_URL;
  process.env.VITE_ENABLE_PRODUCTION = 'true';
  process.env.VITE_PRODUCTION_API_URL = '/api'; process.env.VITE_DEMO_API_URL = '/demo-api';
  for (const mode of ['demo', 'production']) for (const active of ['production', 'demo']) {
    process.env.VITE_APP_ENV = mode;
    globalThis.window = { location: { pathname: active === 'demo' ? '/demo/dang-nhap-demo' : '/login' } };
    const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), mode, server: { middlewareMode: true, ws: false, open: false }, appType: 'custom' });
    try {
      const env = await server.ssrLoadModule('/src/lib/environment.js');
      const { LoginPage } = await server.ssrLoadModule('/src/features/pages/LoginPage.jsx');
      const { LandingPage } = await server.ssrLoadModule('/src/features/pages/LandingPage.jsx');
      const { AppContent } = await server.ssrLoadModule('/src/App.jsx');
      const { ADMIN_ROLE_OPTIONS } = await server.ssrLoadModule('/src/views/System_Admin/SystemAdminData.js');
      const auth = await server.ssrLoadModule('/src/features/auth/authService.js');
      const { API_BASE_URL, apiRequest } = await server.ssrLoadModule('/src/lib/api.js');
      const render = (element, route = '/login') => renderToStaticMarkup(React.createElement(MemoryRouter, { basename: env.APP_BASE_PATH || '/', initialEntries: [env.APP_BASE_PATH + route] }, element));
      assert.equal(env.APP_ENV, active);
      assert.equal(env.environmentForPath('/demo/dashboard'), 'demo');
      assert.equal(env.environmentForPath('/demo-api'), 'production');
      assert.equal(env.environmentForPath('/demolition'), 'production');
      assert.equal(API_BASE_URL, active === 'demo' ? '/demo-api' : '/api');
      assert.equal(auth.SUPPORTED_LOGIN_ROLES.length, 6);
      assert.deepEqual(ADMIN_ROLE_OPTIONS.map(row => row.value).sort(), ['DIRECTOR', 'HR_ADMIN']);
      stored.clear();
      const page = render(React.createElement(LoginPage));
      assert.equal(page.includes('@teck-flowrequest.com'), false);
      assert.equal(page.includes('demo-accounts__row'), false);
      assert.ok(page.includes(active === 'demo' ? 'Quay lại đăng nhập thực tế' : 'Trải nghiệm Demo'));
      assert.ok(render(React.createElement(LandingPage)).includes('href="/demo/dang-nhap-demo"'));
      const choice = render(React.createElement(AppContent), '/dang-nhap-demo');
      assert.equal((choice.match(/demo-login__table-row/g) || []).length, active === 'demo' ? 6 : 0);
      if (active === 'demo') assert.ok(choice.includes('Quay lại đăng nhập thực tế'));
      else assert.equal(render(React.createElement(LoginPage, { initialCredentials: { email: 'employee@teck-flowrequest.com', password: 'Demo-employee' } })).includes('@teck-flowrequest.com'), false);

      const otherToken = active === 'demo' ? 'flowrequest_production_token' : 'flowrequest_token';
      const otherUser = active === 'demo' ? 'flowrequest_production_user' : 'flowrequest_user';
      stored.set(otherUser, JSON.stringify({ id: 'other', role: 'employee', name: 'Other environment' }));
      stored.set(otherToken, 'other-token');
      assert.equal(render(React.createElement(AppContent), '/dashboard').includes('employee-shell'), false);
      stored.set(env.TOKEN_KEY, 'selected-token');
      let outgoing;
      globalThis.fetch = async (url, options) => {
        outgoing = { url, options };
        return new Response(JSON.stringify({ user: { id: 'same-id', role: 'EMPLOYEE', name: 'Account', email: 'employee@company.example' }, token: 'new-selected-token' }), { headers: { 'X-FlowRequest-Environment': active } });
      };
      assert.equal((await auth.login('employee@company.example', 'fixture-only')).success, true);
      assert.equal(outgoing.url, API_BASE_URL + '/auth/login');
      assert.equal(outgoing.options.headers.Authorization, 'Bearer selected-token');
      assert.equal(stored.get(env.TOKEN_KEY), 'new-selected-token');
      assert.equal(stored.get(otherToken), 'other-token');
      assert.equal(JSON.parse(stored.get(otherUser)).id, 'other');
      let attempts = 0;
      globalThis.fetch = async () => { attempts++; return new Response('{}', { headers: { 'X-FlowRequest-Environment': active === 'demo' ? 'production' : 'demo' } }); };
      await assert.rejects(apiRequest('/request'), error => error.kind === 'environment');
      assert.equal(attempts, 1, 'Never retry against the other backend');
      if (active === 'production') assert.throws(() => env.assertApiEnvironment(new Response('{}')));
    } finally { await server.close(); }
  }
});

test('paused Production keeps all browser routes on Demo and removes Production links/proxy', async t => {
  const keys = ['VITE_APP_ENV', 'VITE_ENABLE_PRODUCTION', 'VITE_API_URL', 'VITE_DEMO_API_URL'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const original = { localStorage: globalThis.localStorage, window: globalThis.window };
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    for (const [key, value] of Object.entries(original)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  });
  process.env.VITE_APP_ENV = 'demo'; process.env.VITE_ENABLE_PRODUCTION = 'false';
  delete process.env.VITE_API_URL; process.env.VITE_DEMO_API_URL = '/demo-api';
  globalThis.window = { location: { pathname: '/login' } };
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const root = fileURLToPath(new URL('..', import.meta.url));
  const server = await createServer({ root, mode: 'demo', server: { middlewareMode: true, ws: false, open: false }, appType: 'custom' });
  try {
    assert.equal(path.resolve(server.config.envDir), path.resolve(root), 'Root launch must still load frontend environment files');
    const env = await server.ssrLoadModule('/src/lib/environment.js');
    assert.equal(env.APP_ENV, 'demo'); assert.equal(env.APP_BASE_PATH, '');
    assert.equal(env.TOKEN_KEY, 'flowrequest_token');
    assert.equal(env.environmentForPath('/login'), 'demo');
    assert.equal(env.environmentForPath('/admin/settings'), 'demo');
    const api = await server.ssrLoadModule('/src/lib/api.js');
    assert.equal(api.API_BASE_URL, '/demo-api');
    assert.equal(server.config.server.proxy['/api'], undefined);
    assert.ok(server.config.server.proxy['/demo-api']);
    const { AppContent } = await server.ssrLoadModule('/src/App.jsx');
    const render = route => renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [route] }, React.createElement(AppContent)));
    assert.ok(render('/login').includes('login-form'));
    assert.equal(render('/login').includes('Quay lại đăng nhập thực tế'), false);
    const choices = render('/dang-nhap-demo');
    assert.equal((choices.match(/demo-login__table-row/g) || []).length, 6);
    assert.equal(choices.includes('Quay lại đăng nhập thực tế'), false);
    assert.equal(choices.includes('Reset dữ liệu demo'), false);
  } finally { await server.close(); }
  await assert.rejects(createServer({ root, mode: 'production', server: { middlewareMode: true, ws: false, open: false } }), /Production đang tạm dừng/);
});
