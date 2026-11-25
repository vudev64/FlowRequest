import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { storageFor } from '../services/DocumentStorage.js';
import { GRID_CONCURRENCY } from '../services/GridDocumentStorage.js';
import { getEffectiveSettings } from '../services/SettingsService.js';
import { FILE_TYPES } from '../config/settingsDefaults.js';

export function permittedFile(file, policy) {
  const extension = path.extname(file.originalname).toLowerCase();
  return policy.extensions.includes(extension) && Object.hasOwn(FILE_TYPES, extension) && file.mimetype === FILE_TYPES[extension];
}
function signatureMatches(file) {
  const handle = fs.openSync(file.path, 'r'), header = Buffer.alloc(8);
  try { fs.readSync(handle, header, 0, 8, 0); } finally { fs.closeSync(handle); }
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg'].includes(ext)) return header.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  if (ext === '.png') return header.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (ext === '.pdf') return header.subarray(0, 5).toString() === '%PDF-';
  if (ext === '.doc') return header.equals(Buffer.from([208, 207, 17, 224, 161, 177, 26, 225]));
  return ext === '.docx' && header.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4]));
}
const removeFile = file => { if (file?.path) fs.unlink(file.path, () => {}); };
export const upload = { single: (field, { cleanupOnFailure = true, privateStorage = false } = {}) => async (req, res, next) => {
  try {
    const documents = storageFor(req);
    const attachments = documents.attachmentPolicy((await getEffectiveSettings()).attachments);
    if (documents.writeGrid && req.is('multipart/form-data')) {
      if (documents.receiving >= GRID_CONCURRENCY) return res.status(429).json({ message: 'Có nhiều tệp đang được xử lý. Vui lòng thử lại.' });
      documents.receiving++;
      res.once('close', () => { documents.receiving--; });
    }
    const storage = multer.diskStorage({ destination: documents.uploadDirectory(privateStorage ? 'payment-vouchers' : 'uploads'),
      filename: (request, file, cb) => cb(null, documents.filename(file.originalname)) });
    const receive = multer({ storage, limits: { fileSize: attachments.maxSizeMB * 1024 * 1024, files: 1 }, fileFilter: (request, file, cb) => permittedFile(file, attachments) ? cb(null, true) : cb(new Error('Định dạng tệp không được phép theo cấu hình hệ thống.')) }).single(field);
    receive(req, res, error => {
      if (error) { removeFile(req.file); return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? `Tệp tối đa ${attachments.maxSizeMB} MB.` : error.message }); }
      try {
        if (req.file && !signatureMatches(req.file)) throw new Error();
        for (const key of ['purchaseDetails', 'extraDetails']) if (typeof req.body[key] === 'string') req.body[key] = JSON.parse(req.body[key]);
      } catch { removeFile(req.file); return res.status(400).json({ message: 'Tệp đính kèm hoặc dữ liệu biểu mẫu không hợp lệ.' }); }
      if (cleanupOnFailure) res.once('finish', () => { if (res.statusCode >= 400) removeFile(req.file); });
      next();
    });
  } catch { res.status(503).json({ message: 'Không thể kiểm tra chính sách tải tệp. Vui lòng thử lại.' }); }
} };
