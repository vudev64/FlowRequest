import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { WORKFLOW } from '../../backend/src/config/workflow.js';

test('Director uses existing login, guarded routes, original views and scoped monthly figures', async t => {
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), mode: 'demo', server: { middlewareMode: true, open: false, ws: false }, appType: 'custom' });
  const oldStorage = globalThis.localStorage, oldFetch = globalThis.fetch, storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  t.after(async () => { await server.close(); globalThis.fetch = oldFetch; if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage; });
  const { login } = await server.ssrLoadModule('/src/features/auth/authService.js');
  const { AppContent } = await server.ssrLoadModule('/src/App.jsx');
  const { AdminPreferencesProvider } = await server.ssrLoadModule('/src/views/AdminPreferences.jsx');
  const data = await server.ssrLoadModule('/src/views/Director/DirectorData.jsx');
  const { setSystemConfiguration } = await server.ssrLoadModule('/src/lib/systemConfiguration.js');
  const { translateDirector } = await server.ssrLoadModule('/src/views/Director/DirectorLanguage.js');
  const { default: Approvals, RequestDetail } = await server.ssrLoadModule('/src/views/Director/components/Approvals.jsx');
  const { default: Reports } = await server.ssrLoadModule('/src/views/Director/components/Reports.jsx');
  const { default: Overview } = await server.ssrLoadModule('/src/views/Director/components/Overview.jsx');
  const { default: Dialog } = await server.ssrLoadModule('/src/views/Director/components/RequestDialog.jsx');
  const actor = { id: 'director-test', name: 'Nguyễn Giám Đốc', role: 'DIRECTOR', email: 'director@example.test', department: 'Executive' };
  globalThis.fetch = async () => new Response(JSON.stringify({ user: actor, token: 'director-test-token' }), { status: 200 });
  const auth = await login(actor.email, 'test-password');
  assert.equal(auth.success, true); assert.equal(auth.user.role, 'director'); assert.equal(storage.get('flowrequest_token'), 'director-test-token');
  assert.deepEqual([...data.DIRECTOR_REQUEST_TYPES].sort(), [...new Set(WORKFLOW.PENDING_DIRECTOR.types)].sort());
  const rows = data.DIRECTOR_REQUEST_TYPES.map((type, index) => ({ _id: 'request-' + index, type, title: 'Đề xuất Nguyễn Văn A ' + type, author: { _id: 'manager', name: 'Nguyễn Văn A' }, status: 'PENDING_DIRECTOR', amount: 1000, createdAt: '2026-11-20T02:00:00Z', content: 'Nội dung gốc', department: { name: 'Engineering' }, approvalHistory: [] }));
  for (const row of rows) {
    assert.equal(data.canDirectorDecide(row, actor), true);
    assert.equal(data.canDirectorDecide({ ...row, author: { _id: actor.id } }, actor), false);
    assert.equal(data.canDirectorDecide({ ...row, status: 'PENDING_MANAGER' }, actor), false);
    assert.equal(data.canDirectorDecide(row, { ...actor, role: 'HR_ADMIN' }), false);
  }
  assert.throws(() => data.extractRequests({ success: true }), /danh sách đơn hợp lệ/);
  assert.throws(() => data.extractRequest({ data: [] }), /chi tiết đơn hợp lệ/);
  storage.set('flowrequest_user', JSON.stringify(auth.user));
  const shell = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/director/approvals'] }, React.createElement(AppContent)));
  assert.ok(shell.includes('dir-workspace')); assert.ok(shell.includes(actor.name)); assert.ok(shell.includes('Phê duyệt'));
  const render = (Component, props) => renderToStaticMarkup(React.createElement(AdminPreferencesProvider, null, React.createElement(Component, props)));
  const inbox = render(Approvals, { requests: rows, user: actor });
  assert.ok(inbox.includes('Nguyễn Văn A')); assert.ok(inbox.includes('Xem &amp; duyệt'));
  const report = render(Reports, { requests: rows, onView: () => {} });
  assert.ok(report.includes('Báo cáo &amp; lịch sử')); assert.ok(report.includes('Xem chi tiết &amp; lịch sử')); assert.ok(report.includes('type="date"'));
  const detail = { ...rows[2], approvalHistory: [{ approverId: { _id: 'manager', name: 'Nguyễn Văn A' }, role: 'MANAGER', action: 'APPROVED', fromStatus: 'PENDING_MANAGER', toStatus: 'PENDING_DIRECTOR', timestamp: '2026-11-20T03:00:00Z', comment: 'Ghi chú gốc' }], purchaseDetails: { deviceName: 'Thiết bị nguyên bản', quantity: 1, unitPrice: 1000 }, attachment: '/uploads/example.pdf' };
  const info = render(RequestDetail, { request: { ...detail, dayPart: 'FULL' }, onDownload: () => {} });
  assert.ok(info.includes('Thiết bị nguyên bản')); assert.ok(info.includes('Ghi chú gốc')); assert.ok(info.includes('Nguyễn Văn A (Quản lý)')); assert.ok(info.includes('Tải chứng từ: example.pdf'));
  assert.ok(!info.includes('Buổi nghỉ'));
  assert.ok(render(RequestDetail, { request: { ...detail, type: 'LEAVE', dayPart: 'FULL' } }).includes('Buổi nghỉ'));
  const structuredDetails = render(RequestDetail, { request: { ...detail, purchaseDetails: { deviceName: 'Thiết bị nguyên bản', quantity: 1, unitPrice: 0, budgetCode: 'FIN-001' }, extraDetails: { fromDate: '2026-11-20T00:00:00Z', purpose: '<script>nội dung người dùng</script>', legacyField: { preserved: 'Thông tin cũ' }, zeroValue: 0 } } });
  assert.ok(structuredDetails.includes('Đơn giá')); assert.ok(structuredDetails.includes('FIN-001'));
  assert.ok(structuredDetails.includes(data.formatMoney(0)));
  assert.ok(structuredDetails.includes('Thông tin cũ')); assert.ok(structuredDetails.includes('zeroValue'));
  assert.ok(structuredDetails.includes('&lt;script&gt;nội dung người dùng&lt;/script&gt;'));
  assert.ok(!structuredDetails.includes('<script>'));
  const dialog = render(Dialog, { detail: { record: detail }, onClose: () => {} });
  assert.ok(dialog.includes('Lịch sử xử lý')); assert.ok(!dialog.includes('class="dir-decision"'));
  setSystemConfiguration({ general: { timeZone: 'Asia/Bangkok' } });
  const purchase = { ...rows[2], type: 'PURCHASE', status: 'APPROVED', amount: 50_000_000, createdAt: '2026-01-31T18:00:00Z' };
  const metricsRows = [purchase, { ...purchase, _id: 'pending', status: 'PENDING_ACCOUNTANT', amount: 60_000_000 }, { ...purchase, _id: 'rejected', status: 'REJECTED', amount: 10_000_000 }, { ...purchase, _id: 'draft', status: 'DRAFT', amount: 999_000_000 }, { ...purchase, _id: 'cancelled', status: 'CANCELLED', amount: 999_000_000 }, { ...purchase, _id: 'training', type: 'TRAINING', amount: 999_000_000 }, { ...purchase, _id: 'other-year', createdAt: '2025-01-01T00:00:00Z', amount: 999_000_000 }];
  const months = data.monthlyPurchases(metricsRows, '2026');
  assert.equal(months.length, 12); assert.equal(months[0].count, 0);
  assert.deepEqual(months[1], { month: 2, proposed: 120_000_000, approved: 50_000_000, count: 3 });
  assert.equal(months.reduce((sum, month) => sum + month.proposed, 0), 120_000_000);
  assert.equal(data.calendarDay(purchase.createdAt), '2026-02-01');
  const overview = render(Overview, { requests: metricsRows, onNavigate: () => {} });
  assert.ok(overview.includes('Chi tiêu được phê duyệt theo phòng ban')); assert.ok(overview.includes('Thông tin ngân sách và thanh toán')); assert.ok(overview.includes('So sánh giá trị mua sắm theo tháng')); assert.ok(overview.includes('Chưa có dữ liệu'));
  assert.ok(render(Overview, { requests: [], onNavigate: () => {} }).includes('Chưa có đơn mua sắm để so sánh theo tháng.'));
  const historicalRows = [
    { ...purchase, _id: 'previous-year', createdAt: '2025-12-31T16:59:59Z', amount: 20_000_000 },
    { ...purchase, _id: 'new-year', createdAt: '2025-12-31T17:00:00Z', amount: 30_000_000 },
    { ...purchase, _id: 'future-year', createdAt: '2042-02-15T00:00:00Z', amount: 40_000_000 },
  ];
  const originalHistory = JSON.stringify(historicalRows);
  const actualDate = globalThis.Date;
  for (const [instant, currentYear] of [
    ['2026-12-31T16:59:59Z', '2026'],
    ['2026-12-31T17:00:00Z', '2027'],
    ['2030-01-01T00:00:00Z', '2030'],
  ]) {
    globalThis.Date = class extends actualDate {
      constructor(...args) { super(...(args.length ? args : [instant])); }
      static now() { return actualDate.parse(instant); }
    };
    try {
      const yearlyOverview = render(Overview, { requests: historicalRows, onNavigate: () => {} });
      assert.ok(yearlyOverview.includes(`value="${currentYear}" selected=""`), 'Default must use the current company-calendar year, even when it has no data');
      assert.ok(yearlyOverview.includes('value="2025"')); assert.ok(yearlyOverview.includes('value="2042"'));
      const oldYear = data.monthlyPurchases(historicalRows, '2025'), nextYear = data.monthlyPurchases(historicalRows, '2026');
      assert.equal(oldYear.length, 12); assert.equal(nextYear.length, 12);
      assert.equal(oldYear[11].approved, 20_000_000); assert.equal(nextYear[0].approved, 30_000_000);
      assert.equal(JSON.stringify(historicalRows), originalHistory, 'Changing the calendar must never rewrite historical request dates or amounts');
    } finally { globalThis.Date = actualDate; }
  }
  for (const lang of ['vi', 'en']) for (const theme of ['light', 'dark']) {
    storage.set('flowrequest_admin_preferences', JSON.stringify({ lang, theme }));
    const savedShell = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/director/reports'] }, React.createElement(AppContent)));
    assert.ok(savedShell.includes(`data-theme="${theme}"`)); assert.ok(savedShell.includes(`lang="${lang}"`));
    assert.ok(savedShell.includes(lang === 'en' ? 'Switch to Vietnamese' : 'Chuyển sang tiếng Anh'));
    assert.ok(savedShell.includes(lang === 'en' ? 'Account information' : 'Thông tin tài khoản'));
    const localizedOverview = render(Overview, { requests: metricsRows, onNavigate: () => {} });
    assert.ok(localizedOverview.includes(lang === 'en' ? 'Approved purchase value by department' : 'Chi tiêu được phê duyệt theo phòng ban'));
    assert.ok(localizedOverview.includes(lang === 'en' ? 'Monthly purchase value comparison' : 'So sánh giá trị mua sắm theo tháng'));
    assert.ok(localizedOverview.includes(lang === 'en' ? 'Budget and payment information' : 'Thông tin ngân sách và thanh toán'));
    const localizedReport = render(Reports, { requests: rows, onView: () => {} });
    assert.ok(localizedReport.includes(lang === 'en' ? 'View details &amp; history' : 'Xem chi tiết &amp; lịch sử'));
    assert.ok(localizedReport.includes('Nguyễn Văn A'));
    const originalContent = { ...detail, title: 'Tổng quan', content: 'Nội dung đề xuất', approvalHistory: [{ ...detail.approvalHistory[0], comment: 'Từ chối' }] };
    const localizedDetail = render(Dialog, { detail: { record: originalContent }, onClose: () => {} });
    assert.ok(localizedDetail.includes('<h3>Tổng quan</h3>'));
    assert.ok(localizedDetail.includes('class="dir-long-text">Nội dung đề xuất</p>'));
    assert.ok(localizedDetail.includes('class="dir-history-comment">Từ chối</blockquote>'));
    assert.ok(localizedDetail.includes(lang === 'en' ? 'Approval history' : 'Lịch sử xử lý'));
    assert.ok(localizedDetail.includes(lang === 'en' ? 'Pending director' : 'Chờ giám đốc'));
    assert.ok(localizedDetail.includes(lang === 'en' ? 'Manager' : 'Quản lý'));
  }
  assert.equal(data.statusLabel('PENDING_ACCOUNTANT', 'en'), 'Pending accountant');
  assert.equal(data.requestTypeLabel('BUNSINESS_TRIP', 'en'), 'Business trip');
  assert.equal(translateDirector('Failed to fetch', 'vi'), 'Không thể kết nối tới máy chủ. Vui lòng thử lại.');
  assert.equal(translateDirector('Yêu cầu thất bại (503).', 'en'), 'Request failed (503).');
  assert.equal(translateDirector('constructor', 'en'), 'constructor');
  assert.equal(translateDirector('Đơn vừa được người khác xử lý, vui lòng tải lại trang', 'en'), 'Another reviewer has just processed this request. Please refresh the page.');
  setSystemConfiguration(null);
  storage.set('flowrequest_user', JSON.stringify({ ...actor, role: 'employee' }));
  assert.ok(!renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/director'] }, React.createElement(AppContent))).includes('dir-workspace'));
  storage.clear();
  assert.ok(!renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/director'] }, React.createElement(AppContent))).includes('dir-workspace'));
});
