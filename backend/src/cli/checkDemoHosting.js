import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function checkDemoHosting(origin, { request = fetch } = {}) {
  const base = new URL(origin);
  if (base.protocol !== 'https:' || base.origin !== origin || base.username || base.password) throw new Error('Chỉ nhận HTTPS origin, không có đường dẫn, query hoặc thông tin đăng nhập.');
  const checks = [];
  for (const [id, route, expected] of [
    ['frontend', '/', 200], ['backend-ready', '/health/ready', 200],
    ['demo-public-settings', '/demo-api/system/settings', 200], ['anonymous-requests-denied', '/demo-api/request', 401],
  ]) {
    try {
      const response = await request(base.origin + route, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
      let valid = response.status === expected;
      if (id === 'frontend') valid &&= Boolean(response.headers.get('content-type')?.includes('text/html'));
      else {
        const body = await response.json();
        valid &&= response.headers.get('X-FlowRequest-Environment') === 'demo';
        if (id === 'backend-ready') valid &&= body.environment === 'demo' && body.ready === true;
        if (id === 'demo-public-settings') valid &&= Boolean(body.general?.systemName);
      }
      checks.push({ id, status: valid ? 'PASS' : 'FAIL', httpStatus: response.status });
    } catch { checks.push({ id, status: 'NOT_VERIFIED', message: 'Không xác minh được HTTPS, routing hoặc JSON của hosting.' }); }
  }
  return { scope: 'public-demo-readonly-smoke', passed: checks.every(check => check.status === 'PASS'), checks, writes: 0,
    notCovered: ['MongoDB finance integration suite', 'Persistent storage across host restarts', 'Expected load and cross-role browser tests', 'Budget data reconciliation'] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const origin = process.argv.find(value => value.startsWith('--url='))?.slice(6);
    if (!origin || process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error();
    const result = await checkDemoHosting(origin); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.passed ? 0 : 1;
  } catch { console.error('Cần --url=https://<domain-demo-thật> và kiểm tra chứng chỉ TLS bình thường. Chưa có domain thì chưa xác minh hosting.'); process.exitCode = 1; }
}
