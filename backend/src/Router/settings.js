import express from 'express';
import mongoose from 'mongoose';
import SystemSettings from '../models/SystemSettings.js';
import AuditLog from '../models/Auditlog.js';
import { getEffectiveSettings } from '../services/SettingsService.js';
import { FILE_TYPES, validateSettings } from '../config/settingsDefaults.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { WORKFLOW } from '../config/workflow.js';
import { FINANCIAL, ROLES } from '../constants/enums.js';
import { authConfig, emailConfig } from '../config/environment.js';
import { storageFor } from '../services/DocumentStorage.js';
export const publicSettingsRouter = express.Router();
publicSettingsRouter.get('/', async (req, res) => {
  try { const settings = await getEffectiveSettings(); res.set('Cache-Control', 'no-store').json({ general: settings.general, attachments: storageFor(req).attachmentPolicy(settings.attachments), passwordPolicy: settings.security.password, notificationsEnabled: settings.notifications.enabled }); }
  catch { res.status(503).json({ message: 'Chưa thể tải cấu hình hệ thống.' }); }
});
const router = express.Router();
router.use(protect, authorize('SYSTEM_ADMIN'));
router.get('/', async (req, res) => {
  try {
    const s = await getEffectiveSettings();
    const editor = s.updatedBy ? await mongoose.model('User').findById(s.updatedBy).select('name') : null;
    res.set('Cache-Control', 'no-store').json({ ...Object.fromEntries(['general','security','attachments','notifications','revision','updatedAt'].map(k => [k, s[k]])), updatedBy: editor?.name || null, persisted: s.revision > 0,
      runtime: { databaseConnected: mongoose.connection.readyState === 1, emailKeyConfigured: Boolean(emailConfig().apiKey), jwtConfigured: Boolean(authConfig().secret) },
      readOnly: { directorThreshold: FINANCIAL.DIRECTOR, roles: Object.values(ROLES), workflow: Object.entries(WORKFLOW).map(([status, step]) => ({ status, role: step.role, types: step.types, byAssignee: step.byAssignee })), supportedExtensions: Object.keys(FILE_TYPES) },
    });
  } catch { res.status(503).json({ message: 'Không thể tải cấu hình. Vui lòng thử lại.' }); }
});
router.put('/', async (req, res) => {
  const { value, errors } = validateSettings(req.body);
  if (!value) return res.status(400).json({ message: 'Cấu hình chưa hợp lệ.', errors });
  let session;
  try {
    await SystemSettings.init();
    session = await mongoose.startSession();
    let saved;
    await session.withTransaction(async () => {
      const old = await SystemSettings.findOne({ key: 'system' }).session(session).lean();
      if ((old?.revision || 0) !== req.body.revision) throw Object.assign(new Error('Cấu hình đã được thay đổi ở phiên khác. Hãy tải lại trước khi lưu.'), { status: 409 });
      if (old) saved = await SystemSettings.findOneAndUpdate({ key: 'system', revision: old.revision }, { $set: { ...value, updatedBy: req.user._id }, $inc: { revision: 1 } }, { session, new: true, runValidators: true });
      else [saved] = await SystemSettings.create([{ key: 'system', ...value, revision: 1, updatedBy: req.user._id }], { session });
      if (!saved) throw Object.assign(new Error('Cấu hình đã thay đổi. Hãy tải lại.'), { status: 409 });
      await AuditLog.create([{ actor: req.user._id, action: 'UPDATE_SYSTEM_SETTINGS', targetEntity: 'SystemSettings', targetId: saved._id,
        changes: { oldValue: old ? Object.fromEntries(Object.keys(value).map(k => [k, old[k]])) : null, newValue: value },
        ipAddress: req.ip, userAgent: req.get('user-agent') || 'UNKNOWN',
      }], { session });
    });
    res.json({ message: 'Đã lưu cấu hình hệ thống.', revision: saved.revision });
  } catch (error) { res.status(error.status || (error.code === 11000 ? 409 : 500)).json({ message: error.status ? error.message : error.code === 11000 ? 'Cấu hình vừa được khởi tạo ở phiên khác. Hãy tải lại.' : 'Không thể lưu cấu hình. Thay đổi chưa được áp dụng.' }); }
  finally { if (session) await session.endSession(); }
});
export default router;
