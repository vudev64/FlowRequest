import path from 'node:path';
import { createReadStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { environmentName, storagePaths } from '../config/environment.js';
import { GridDocumentStorage, GRID_MAX_MB } from './GridDocumentStorage.js';

const unavailable = () => Object.assign(new Error('Kho chứng từ tạm thời không khả dụng.'), { status: 503 });
const missing = () => Object.assign(new Error('Không tìm thấy tài liệu.'), { status: 404 });
const remoteName = /^r2-[a-f0-9-]{36}-/;

export async function fileDigests(file) {
  const sha = createHash('sha256'), md5 = createHash('md5');
  for await (const chunk of createReadStream(file.path)) { sha.update(chunk); md5.update(chunk); }
  return { sha256: sha.digest('hex'), contentMD5: md5.digest('base64') };
}

export function configuredDocumentStorage(env = process.env, roots = storagePaths(env)) {
  const driver = environmentName(env) === 'demo' ? env.DEMO_STORAGE_DRIVER ?? 'local' : 'local';
  if (driver === 'local') return new DocumentStorage(roots);
  if (driver === 'gridfs') return new DocumentStorage(roots, null, true);
  if (driver !== 'r2' || !/^[a-f0-9]{32}$/i.test(env.DEMO_R2_ACCOUNT_ID || '') ||
      !env.DEMO_R2_BUCKET || !env.DEMO_R2_ACCESS_KEY_ID || !env.DEMO_R2_SECRET_ACCESS_KEY) {
    throw new Error('Cấu hình kho chứng từ Demo không hợp lệ.');
  }
  const client = new S3Client({
    endpoint: `https://${env.DEMO_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, region: 'auto',
    forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED',
    credentials: { accessKeyId: env.DEMO_R2_ACCESS_KEY_ID, secretAccessKey: env.DEMO_R2_SECRET_ACCESS_KEY },
  });
  return new DocumentStorage(roots, { client, bucket: env.DEMO_R2_BUCKET });
}

export function storageFor(req) {
  if (!req.app) return configuredDocumentStorage();
  return req.app.locals.documentStorage ??= configuredDocumentStorage();
}

export class DocumentStorage {
  constructor(roots, remote = null, writeGrid = false) {
    this.roots = roots;
    this.remote = remote;
    this.writeGrid = writeGrid;
    this.grid = new GridDocumentStorage();
    this.receiving = 0;
    this.uploaded = new WeakSet();
  }
  localDirectory(kind) {
    if (kind === 'uploads') return this.roots.uploads;
    if (kind === 'payment-vouchers') return this.roots.vouchers;
    throw new Error('Loại chứng từ không hợp lệ.');
  }
  uploadDirectory(kind) {
    if (this.writeGrid) return path.join(this.roots.root, '.gridfs-staging', kind);
    return this.remote ? path.join(this.roots.root, '.r2-staging', kind) : this.localDirectory(kind);
  }
  filename(original) {
    const safe = original.replace(/[^a-zA-Z0-9.-]/g, '_');
    if (this.writeGrid) return `gridfs-${randomUUID()}-${safe.slice(-170)}`;
    if (!this.remote) return `${Date.now()}-${BigInt('0x' + randomBytes(16).toString('hex'))}-${safe.slice(-170)}`;
    return `r2-${randomUUID()}-${safe.slice(-170)}`;
  }
  attachmentPolicy(settings) {
    return this.writeGrid ? { ...settings, maxSizeMB: Math.min(GRID_MAX_MB, settings.maxSizeMB) } : settings;
  }
  ownsFile(kind, file) {
    return file && /^[\w.-]+$/.test(file.filename) && !['.', '..'].includes(file.filename) &&
      path.resolve(file.path) === path.join(this.uploadDirectory(kind), file.filename);
  }
  async persist(kind, file, digests) {
    if (!this.ownsFile(kind, file)) throw missing();
    const key = `${kind}/${file.filename}`;
    if (this.writeGrid) {
      const { sha256 } = digests ?? await fileDigests(file);
      await this.grid.persist(key, file, sha256);
    }
    if (this.remote) {
      const { sha256, contentMD5 } = digests ?? await fileDigests(file);
      const stream = createReadStream(file.path);
      try {
        await this.remote.client.send(new PutObjectCommand({
          Bucket: this.remote.bucket, Key: key, Body: stream, ContentLength: file.size,
          ContentType: file.mimetype, ContentMD5: contentMD5, Metadata: { sha256 }, IfNoneMatch: '*',
        }));
        this.uploaded.add(file);
      } catch (error) {
        // A timeout can follow a successful PUT. Never delete an unconfirmed or colliding key.
        console.error('Ghi kho chứng từ chưa thành công:', key, error.$metadata?.httpStatusCode ?? 'unknown');
        throw unavailable();
      } finally { stream.destroy(); }
    }
    return '/' + key;
  }
  async removeTemporary(kind, file) {
    if ((this.remote || this.writeGrid) && this.ownsFile(kind, file)) await this.unlink(file);
  }
  async unlink(file) {
    try { await unlink(file.path); }
    catch (error) { if (error.code !== 'ENOENT') console.error('Cần đối soát tệp:', file.filename); }
  }
  async discard(kind, file) {
    if (!this.ownsFile(kind, file)) return;
    if (this.writeGrid) {
      try { await this.grid.discard(kind + '/' + file.filename, file); }
      catch { console.error('Cần đối soát lượt ghi GridFS:', file.filename); }
      return;
    }
    if (!this.remote) return this.unlink(file);
    if (this.uploaded.has(file)) {
      const Key = kind + '/' + file.filename;
      try { await this.remote.client.send(new DeleteObjectCommand({ Bucket: this.remote.bucket, Key })); }
      catch { console.error('Cần đối soát tệp chưa dọn được:', Key); }
    }
  }
  async download(res, kind, reference, originalName) {
    const name = path.posix.basename(reference || '');
    if (!/^[\w.-]+$/.test(name) || ['.', '..'].includes(name) || reference !== '/' + kind + '/' + name) throw missing();
    const displayName = path.basename(originalName || name);
    res.set('Cache-Control', 'private, no-store');
    if (/^gridfs-[a-f0-9-]{36}-/.test(name)) return this.grid.download(res, reference.slice(1), displayName);
    if (!remoteName.test(name)) {
      try {
        return await new Promise((resolve, reject) => res.download(path.join(this.localDirectory(kind), name), displayName,
          error => error ? reject(error) : resolve()));
      } catch (error) {
        if (error.code !== 'ENOENT' || res.headersSent) throw error;
        // An approved legacy copy can retain its immutable business reference.
        if (this.writeGrid) return this.grid.download(res, reference.slice(1), displayName);
        throw missing();
      }
    }
    if (!this.remote) throw unavailable();
    let object;
    try { object = await this.remote.client.send(new GetObjectCommand({ Bucket: this.remote.bucket, Key: reference.slice(1) })); }
    catch (error) { throw error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404 ? missing() : unavailable(); }
    res.attachment(displayName);
    if (object.ContentLength != null) res.set('Content-Length', String(object.ContentLength));
    await pipeline(object.Body, res);
  }
}
