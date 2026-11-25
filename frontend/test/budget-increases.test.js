import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('budget panels reuse saved themes and languages while separating Accountant creation from Director review', async t => {
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), mode: 'demo', server: { middlewareMode: true, open: false, ws: false }, appType: 'custom' });
  const previous = globalThis.localStorage;
  t.after(async () => { await server.close(); if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous; });
  const { AdminPreferencesProvider } = await server.ssrLoadModule('/src/views/AdminPreferences.jsx');
  const { default: Panel } = await server.ssrLoadModule('/src/views/BudgetIncreasePanel.jsx');
  for (const lang of ['vi','en']) for (const theme of ['light','dark']) {
    globalThis.localStorage = { getItem: key => key === 'flowrequest_admin_preferences' ? JSON.stringify({ lang, theme }) : null, setItem() {} };
    const render = props => renderToStaticMarkup(React.createElement(AdminPreferencesProvider, null, React.createElement(Panel, { request: async () => {}, ...props })));
    const accountant = render({ role: 'ACCOUNTANT', budgets: [{ id: 'budget', name: 'IT', allocatedAmount: 1000 }] });
    assert.ok(accountant.includes(lang === 'en' ? 'Request increase' : 'Yêu cầu bổ sung'));
    assert.ok(accountant.includes(lang === 'en' ? 'Only Director-approved' : 'Chỉ yêu cầu được Giám đốc duyệt'));
    assert.ok(!accountant.includes('class="dir-panel"'));
    const empty = render({ role: 'ACCOUNTANT' });
    assert.ok(empty.includes(lang === 'en' ? 'Set up a department budget' : 'Cần thiết lập ngân sách'));
    const director = render({ role: 'DIRECTOR' });
    assert.ok(director.includes(lang === 'en' ? 'Review accounting requests' : 'Xét duyệt yêu cầu từ Kế toán'));
    assert.ok(!director.includes(lang === 'en' ? 'Request increase</button>' : 'Yêu cầu bổ sung</button>'));
    assert.ok(director.includes('value="PENDING" selected=""'));
  }
});
