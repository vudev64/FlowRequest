import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { testStorageRoot } from './support/unitTestStorage.js';
import { configuredDocumentStorage } from '../src/services/DocumentStorage.js';
import { r2Fixture } from './support/r2Fixture.js';
import { gridCharge, GRID_QUOTA, GRID_CONCURRENCY } from '../src/services/GridDocumentStorage.js';

test('GridFS uses separate staging, bounded charges and the public cap without mutating local settings', () => {
  const env = { FLOWREQUEST_ENV: 'demo', DEMO_STORAGE_ROOT: testStorageRoot };
  const local = configuredDocumentStorage(env);
  const grid = configuredDocumentStorage({ ...env, DEMO_STORAGE_DRIVER: 'gridfs' });
  const policy = { maxSizeMB: 5 };
  assert.equal(grid.attachmentPolicy(policy).maxSizeMB, 2);
  assert.equal(local.attachmentPolicy(policy).maxSizeMB, 5);
  assert.equal(grid.attachmentPolicy({ maxSizeMB: 1 }).maxSizeMB, 1);
  assert.notEqual(grid.uploadDirectory('uploads'), local.uploadDirectory('uploads'));
  assert.match(grid.filename('../file.pdf'), /^gridfs-[\w.-]+\.pdf$/);
  assert.equal(GRID_QUOTA, 100 * 1024 ** 2);
  assert.equal(GRID_CONCURRENCY, 4);
  for (const size of [0, -1, NaN, 2 * 1024 ** 2 + 1]) assert.throws(() => gridCharge(size), { status: 413 });
  assert.ok(gridCharge(2 * 1024 ** 2) > 2 * 1024 ** 2);
});

test('R2 is explicit, requires all configuration and cannot inherit Demo credentials in Production', () => {
  const env = { DEMO_STORAGE_ROOT: testStorageRoot };
  assert.equal(configuredDocumentStorage(env).remote, null);
  assert.throws(() => configuredDocumentStorage({ ...env, DEMO_STORAGE_DRIVER: 'r2' }));
  assert.throws(() => configuredDocumentStorage({ ...env, DEMO_STORAGE_DRIVER: 'invalid' }));
  assert.equal(configuredDocumentStorage({ ...env, FLOWREQUEST_ENV: 'production', PRODUCTION_STORAGE_ROOT: path.join(testStorageRoot,'prod'), DEMO_STORAGE_DRIVER: 'r2' }).remote, null);
});

test('a missing local voucher in GridFS mode resolves only its original authorized key', async t => {
  const grid = configuredDocumentStorage({ DEMO_STORAGE_ROOT: testStorageRoot, DEMO_STORAGE_DRIVER: 'gridfs' });
  const reference = '/payment-vouchers/123-456-proof.pdf';
  const res = { set() {}, download(target, name, cb) { cb(Object.assign(new Error('fixture missing'), { code: 'ENOENT' })); } };
  const reader = t.mock.method(grid.grid, 'download', async (response, key, name) => {
    assert.equal(response, res); assert.equal(key, reference.slice(1)); assert.equal(name, 'proof.pdf');
  });
  await grid.download(res, 'payment-vouchers', reference, 'proof.pdf');
  await assert.rejects(grid.download(res, 'payment-vouchers', '/uploads/123-456-proof.pdf'), { status: 404 });
  assert.equal(reader.mock.callCount(), 1);
});

test('signed R2 upload protects bytes and refuses to overwrite or roll back a pre-existing key', async t => {
  const { store, objects } = await r2Fixture(t, testStorageRoot);
  const kind = 'payment-vouchers', filename = store.filename('proof.pdf'), dir = store.uploadDirectory(kind);
  await mkdir(dir, { recursive: true });
  const bytes = Buffer.from('%PDF-1.4\nTest only');
  const file = { path: path.join(dir, filename), filename, size: bytes.length, mimetype: 'application/pdf' };
  await writeFile(file.path, bytes);
  const key = (await store.persist(kind, file)).slice(1);
  assert.deepEqual(objects.get(key), { bytes, sha256: createHash('sha256').update(bytes).digest('hex') });
  const collision = { ...file };
  await assert.rejects(store.persist(kind, collision), { status: 503 });
  await store.discard(kind, collision);
  assert.deepEqual(objects.get(key).bytes, bytes);
  await store.discard(kind, file);
  await store.removeTemporary(kind, file);
  assert.equal(objects.size, 0); assert.deepEqual(await readdir(dir), []);
});
