import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { S3Client } from '@aws-sdk/client-s3';
import { DocumentStorage } from '../../src/services/DocumentStorage.js';
import { storagePaths } from '../../src/config/environment.js';

// Exercise the actual S3 HTTP client with disposable credentials and a loopback-only endpoint.
export async function r2Fixture(t, root) {
  const objects = new Map(), calls = [];
  const fixture = { objects, calls, failWrites: false };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const key = url.pathname.slice('/test-bucket/'.length);
    function fail(status, code) {
      res.writeHead(status, { 'Content-Type': 'application/xml' });
      res.end('<Error><Code>' + code + '</Code></Error>');
    }
    if (!url.pathname.startsWith('/test-bucket/') || !req.headers.authorization?.startsWith('AWS4-HMAC-SHA256 ')) return fail(403, 'AccessDenied');
    calls.push({ method: req.method, key });
    if (req.method === 'PUT') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      if (fixture.failWrites) return fail(503, 'ServiceUnavailable');
      if (req.headers['if-none-match'] !== '*') return fail(400, 'MissingPrecondition');
      if (objects.has(key)) return fail(412, 'PreconditionFailed');
      const bytes = Buffer.concat(chunks);
      if (createHash('md5').update(bytes).digest('base64') !== req.headers['content-md5']) return fail(400, 'BadDigest');
      objects.set(key, { bytes, sha256: req.headers['x-amz-meta-sha256'] });
      return res.end();
    }
    if (req.method === 'DELETE') { objects.delete(key); res.writeHead(204); return res.end(); }
    if (req.method !== 'GET' || !objects.has(key)) return fail(404, 'NoSuchKey');
    const { bytes } = objects.get(key);
    res.writeHead(200, { 'Content-Length': bytes.length }); res.end(bytes);
  });
  server.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const client = new S3Client({ region: 'auto', forcePathStyle: true, maxAttempts: 1,
    endpoint: 'http://127.0.0.1:' + server.address().port, requestChecksumCalculation: 'WHEN_REQUIRED',
    credentials: { accessKeyId: 'test-only', secretAccessKey: 'test-only' } });
  fixture.store = new DocumentStorage(storagePaths({ FLOWREQUEST_ENV: 'demo', DEMO_STORAGE_ROOT: root }), { client, bucket: 'test-bucket' });
  t.after(async () => { client.destroy(); await new Promise(resolve => server.close(resolve)); });
  return fixture;
}
