import test from 'node:test';
import assert from 'node:assert/strict';
import { readApiResponse } from '../src/lib/apiResponse.js';
const apiResponse = (body, options = {}) => new Response(body, { ...options, headers: { 'X-FlowRequest-Environment': 'production' } });

test('missing HR route reports 404, rather than a JSON parsing error', async () => {
  await assert.rejects(readApiResponse(apiResponse('<html>Cannot GET /api/hr/users</html>', { status: 404 }), '/hr/users'), error => error.status === 404 && error.path === '/hr/users' && error.message.includes('404'));
});
test('HTML fallback and JSON authorization errors are distinguished', async () => {
  await assert.rejects(readApiResponse(apiResponse('<!doctype html><html></html>'), '/hr/users'), /trang web/);
  await assert.rejects(readApiResponse(apiResponse('{"message":"Không có quyền"}', { status: 403 }), '/hr/users'), /Không có quyền/);
  assert.deepEqual(await readApiResponse(apiResponse('{"data":[]}'), '/hr/users'), { data: [] });
});
