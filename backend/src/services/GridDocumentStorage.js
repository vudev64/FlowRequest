import { createReadStream } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { GridFSBucket } from 'mongodb';
import mongoose from 'mongoose';

const MiB = 1024 ** 2;
export const GRID_QUOTA = 100 * MiB;
export const GRID_MAX_MB = 2;
export const GRID_CONCURRENCY = 4;
export const GRID_BUCKET = 'flowdocuments';
export const GRID_LEDGER = 'flowdocumentquota';
const quotaId = 'quota';
const failure = (status, message) => Object.assign(new Error(message), { status });

// Charge payload plus a conservative allowance for BSON, indexes and the ledger.
// Leave another MiB for fixed collection/index overhead on the M0 cluster.
export function gridCharge(size) {
  if (!Number.isSafeInteger(size) || size < 1 || size > GRID_MAX_MB * MiB)
    throw failure(413, 'Tệp phải có nội dung và tối đa 2 MiB.');
  return size + 4096 + Math.ceil(size / (255 * 1024)) * 512;
}

export class GridDocumentStorage {
  constructor(database = () => mongoose.connection.db) {
    this.database = database;
    this.owners = new WeakMap();
  }
  get db() { return this.database(); }
  get ledger() { return this.db.collection(GRID_LEDGER); }
  get bucket() { return new GridFSBucket(this.db, { bucketName: GRID_BUCKET, timeoutMS: 60000 }); }

  async reserve(key, charge, owner) {
    // Index only unfinished receipts. Recovery should not scan the payment archive on each upload.
    this.recoveryIndex ??= this.ledger.createIndex({ started: 1 }, {
      partialFilterExpression: { state: { $in: ['pending', 'discarding'] } },
    }).catch(error => { this.recoveryIndex = null; throw error; });
    await this.recoveryIndex;
    await this.reconcileExpired();
    const { atlasSize } = await this.db.command({ atlasSize: 1 });
    // Leave room for concurrent uploads and ordinary business writes on the shared M0.
    if (atlasSize == null || !Number.isFinite(Number(atlasSize))) throw failure(503, 'Chưa xác minh được dung lượng Atlas.');
    if (Number(atlasSize) + charge > (512 - 32) * MiB)
      throw failure(507, 'Atlas không còn đủ dung lượng dự phòng để lưu tệp.');
    await this.ledger.updateOne({ _id: quotaId }, { $setOnInsert: { bytes: 0, active: 0 } }, { upsert: true });
    await this.db.client.withSession(session => session.withTransaction(async () => {
      const budget = await this.ledger.findOneAndUpdate({
        _id: quotaId, active: { $lt: GRID_CONCURRENCY }, bytes: { $lte: GRID_QUOTA - MiB - charge },
      }, { $inc: { bytes: charge, active: 1 } }, { session });
      if (!budget) {
        const current = await this.ledger.findOne({ _id: quotaId }, { session });
        if (current?.active >= GRID_CONCURRENCY) throw failure(429, 'Có nhiều tệp đang được xử lý. Vui lòng thử lại.');
        throw failure(507, 'Đã đạt hạn mức lưu chứng từ của Demo.');
      }
      await this.ledger.insertOne({ _id: key, owner, charge, state: 'pending', started: new Date() }, { session });
    }));
  }

  async persist(key, file, sha256) {
    const owner = key + ':' + randomUUID();
    await this.reserve(key, gridCharge(file.size), owner);
    this.owners.set(file, owner);
    const stream = this.bucket.openUploadStreamWithId(owner, key, { metadata: { sha256, mimeType: file.mimetype } });
    const digest = createHash('sha256');
    let length = 0;
    const verify = new Transform({
      transform(chunk, encoding, done) {
        length += chunk.length;
        if (length > file.size) return done(failure(409, 'Kích thước chứng từ đã thay đổi.'));
        digest.update(chunk);
        done(null, chunk);
      },
      flush(done) {
        done(length === file.size && digest.digest('hex') === sha256 ? null : failure(409, 'Không xác minh được SHA-256 của chứng từ.'));
      },
    });
    try { await pipeline(createReadStream(file.path), verify, stream); }
    catch (error) {
      // Some chunk writes can outlive a failed stream. Keep the charge and let recovery
      // remove them after the driver timeout rather than racing an outstanding insert.
      this.owners.delete(file);
      throw error.status ? error : failure(503, 'Chưa thể lưu chứng từ lên GridFS.');
    }
  }

  // Fences cleanup against commit, including ambiguous commit responses and transaction retries.
  async bind(key, file, session) {
    const result = await this.ledger.updateOne({ _id: key, owner: this.owners.get(file), state: 'pending' },
      { $set: { state: 'linked' } }, { session });
    if (!result.modifiedCount) throw failure(409, 'Phiên tải chứng từ đã hết hạn.');
    await this.ledger.updateOne({ _id: quotaId }, { $inc: { active: -1 } }, { session });
  }

  async discard(key, file) {
    const owner = this.owners.get(file);
    if (owner) await this.release(key, owner);
  }

  async release(key, owner) {
    // A linked receipt cannot be claimed. Keep the charge until BOTH metadata and chunks are gone.
    const entry = await this.ledger.findOneAndUpdate({ _id: key, owner, state: { $in: ['pending','discarding'] } },
      { $set: { state: 'discarding' } }, { returnDocument: 'after' });
    if (!entry) return;
    await this.db.collection(GRID_BUCKET + '.files').deleteOne({ _id: owner });
    await this.db.collection(GRID_BUCKET + '.chunks').deleteMany({ files_id: owner });
    await this.db.client.withSession(session => session.withTransaction(async () => {
      const removed = await this.ledger.deleteOne({ _id: key, owner, state: 'discarding' }, { session });
      if (removed.deletedCount) await this.ledger.updateOne({ _id: quotaId },
        { $inc: { active: -1, bytes: -entry.charge } }, { session });
    }));
  }

  async reconcileExpired() {
    // Longer than the driver's one-minute stream timeout and the transaction retry window.
    const expired = await this.ledger.find({ state: { $in: ['pending', 'discarding'] },
      started: { $lt: new Date(Date.now() - 5 * 60000) } }).limit(GRID_CONCURRENCY).toArray();
    for (const entry of expired) await this.release(entry._id, entry.owner);
  }

  async download(res, key, displayName) {
    const link = await this.ledger.findOne({ _id: key, state: 'linked' });
    const file = link && await this.db.collection(GRID_BUCKET + '.files').findOne({ _id: link.owner, filename: key });
    if (!file) throw failure(404, 'Không tìm thấy tài liệu.');
    res.attachment(displayName);
    res.set('Content-Length', String(file.length));
    await pipeline(this.bucket.openDownloadStream(link.owner), res);
  }
}
