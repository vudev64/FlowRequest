import mongoose from 'mongoose';
import { storageFor } from '../services/DocumentStorage.js';
import Request from '../models/Request.js';
import { requestDetailQuery } from '../services/RequestAccessService.js';

export async function downloadRequestAttachment(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'ID đơn không hợp lệ.' });
  const query = requestDetailQuery(req.user, req.params.id);
  if (!query) return res.status(403).json({ message: 'Bạn không có quyền xem đơn.' });
  try {
    const request = await Request.findOne(query).select('attachment');
    if (!request?.attachment || !/^\/uploads\/[a-zA-Z0-9_.-]+$/.test(request.attachment)) return res.status(404).json({ message: 'Không tìm thấy tài liệu hoặc bạn không có quyền xem.' });
    await storageFor(req).download(res, 'uploads', request.attachment);
  } catch (error) { if (!res.headersSent && !res.destroyed) res.status(error.status || 500).json({ message: 'Không thể tải tài liệu.' }); }
}
