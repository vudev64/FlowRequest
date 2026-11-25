import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { settingsDefaults } from '../../backend/src/config/settingsDefaults.js';
import { WORKFLOW } from '../../backend/src/config/workflow.js';

test('admin pages render the saved language and theme without altering employee names', async t => {
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), mode: 'demo', server: { middlewareMode: true, open: false, ws: false }, appType: 'custom' });
  const previous = globalThis.localStorage;
  t.after(async () => { await server.close(); if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous; });
  const { default: HR } = await server.ssrLoadModule('/src/views/Hr_Admin/HRAdminDashboard.jsx');
  const { AdminLayout } = await server.ssrLoadModule('/src/views/System_Admin/components/AdminLayout.jsx');
  const { SystemAdminDashboard } = await server.ssrLoadModule('/src/views/System_Admin/SystemAdminDashboard.jsx');
  const { RoleBadge } = await server.ssrLoadModule('/src/views/System_Admin/components/AdminShared.jsx');
  const { SystemSettingsForm } = await server.ssrLoadModule('/src/views/System_Admin/components/SystemSettingsPage.jsx');
  const actor = { id: 'hr', name: 'Nguyễn Văn A', role: 'hr_admin' };
  for (const lang of ['vi', 'en']) {
    globalThis.localStorage = { getItem: () => JSON.stringify({ lang, theme: 'dark' }), setItem: () => {} };
    const hr = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/hr'] }, React.createElement(HR, { user: actor })));
    assert.match(hr, /data-theme="dark"/);
    assert.ok(hr.includes(lang === 'en' ? 'People management' : 'Quản lý nhân sự'));
    assert.ok(hr.includes(lang === 'en' ? 'Pending HR requests' : 'Đơn chờ ghi nhận'));
    assert.ok(hr.includes('Nguyễn Văn A'));
    const admin = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/admin/settings'] }, React.createElement(AdminLayout, { currentUser: actor }, 'Test')));
    assert.match(admin, /data-theme="dark"/);
    assert.ok(admin.includes(lang === 'en' ? 'System settings' : 'Cấu hình hệ thống'));
    for (const role of ['HR_ADMIN', 'SYSTEM_ADMIN', 'DIRECTOR']) {
      const badge = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(AdminLayout, { currentUser: actor }, React.createElement(RoleBadge, { role }))));
      assert.ok(badge.includes(role === 'HR_ADMIN' ? (lang === 'en' ? 'HR administrator' : 'Quản trị nhân sự') : role === 'DIRECTOR' ? (lang === 'en' ? 'Director' : 'Giám đốc') : (lang === 'en' ? 'System administrator' : 'Quản trị hệ thống')));
    }
    for (const route of ['/hr/users', '/hr/approvals', '/hr/history', '/hr/permissions']) {
      const page = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [route] }, React.createElement(HR, { user: actor })));
      assert.match(page, /data-theme="dark"/);
      assert.ok(page.includes(lang === 'en' ? 'People management' : 'Quản lý nhân sự'));
    }
    for (const route of ['/admin/accounts', '/admin/logs']) {
      const page = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [route] }, React.createElement(AdminLayout, { currentUser: actor }, React.createElement(SystemAdminDashboard, { notify: () => {} }))));
      assert.match(page, /data-theme="dark"/);
    }
    const initial = { ...settingsDefaults(), revision: 0, persisted: false, updatedAt: null, updatedBy: null, runtime: { databaseConnected: true, emailKeyConfigured: false, jwtConfigured: true }, readOnly: { supportedExtensions: ['.pdf'], roles: ['SYSTEM_ADMIN'], directorThreshold: 50000000, workflow: Object.entries(WORKFLOW).map(([status, step]) => ({ status, role: step.role, types: step.types })) } };
    const settings = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(AdminLayout, { currentUser: actor }, React.createElement(SystemSettingsForm, { initial, onSaved: async () => {} }))));
    assert.ok(settings.includes(lang === 'en' ? 'Login security' : 'Bảo mật đăng nhập'));
    assert.ok(settings.includes(lang === 'en' ? 'Save settings' : 'Lưu cấu hình'));
    assert.ok(settings.includes('PENDING_MANAGER'));
    assert.ok(settings.includes('onboarding@resend.dev'));
    assert.ok(settings.includes(lang === 'en' ? 'Search time zones' : 'Tìm múi giờ'));
    assert.match(settings, /<option value="Asia\/Bangkok" selected="">Asia\/Bangkok<\/option>/);
    assert.ok(settings.includes('<option value="Asia/Tokyo">'));
    assert.ok(settings.includes('<option value="Europe/London">'));
    assert.ok(settings.includes('<option value="UTC">'));
    assert.ok(!settings.includes('<datalist'));
  }
});
