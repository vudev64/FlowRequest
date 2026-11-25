import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './Router/authRouter.js';
import requestRouter from './Router/request.js';
import hrRouter from './Router/hr.js';
import adminRouter from './Router/admin.js';
import settingsRouter, { publicSettingsRouter } from './Router/settings.js';
import { environmentName } from './config/environment.js';
import { demoRateLimit } from './middleware/demoRateLimit.js';
import { configuredDocumentStorage } from './services/DocumentStorage.js';

export function createApp(config) {
  if (config.environment !== environmentName()) throw new Error('Backend phải khởi động trong đúng môi trường đã chọn.');
  const app = express();
  if (config.storage) app.locals.documentStorage = configuredDocumentStorage(process.env, config.storage);
  app.disable('x-powered-by');
  // Only explicit proxy addresses are trusted; never accept arbitrary X-Forwarded-For.
  if (config.trustedProxies?.length) app.set('trust proxy', config.trustedProxies);
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
    next();
  });
  app.use((req, res, next) => { res.set('X-FlowRequest-Environment', config.environment); next(); });
  app.use(cors({ origin: config.origins.length ? (origin, next) => next(null, !origin || config.origins.includes(origin)) : '*', exposedHeaders: ['X-FlowRequest-Environment'] }));
  app.use(express.json());
  if (config.environment === 'demo') {
    app.use('/api/auth/login', demoRateLimit({ limit: 30, windowMs: 600000 }));
    const writes = demoRateLimit({ limit: 120, windowMs: 600000 });
    app.use('/api', demoRateLimit({ limit: 600, windowMs: 60000 }), (req, res, next) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? next() : writes(req, res, next));
  }
  app.use('/api/request', requestRouter);
  app.use('/api/auth', authRoutes);
  app.use('/api/hr', hrRouter);
  app.use('/api/system/settings', publicSettingsRouter);
  app.use('/api/admin/settings', settingsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', (req, res) => res.status(404).json({ message: 'Không tìm thấy chức năng API được yêu cầu.' }));
  app.get('/', (req, res) => res.json({ message: 'Small Business Workflow API đang hoạt động', environment: config.environment }));
  app.get('/health/ready', (req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ environment: config.environment, ready: mongoose.connection.readyState === 1 }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 500;
    res.status(status).json({ message: status === 400 ? 'Dữ liệu JSON không hợp lệ.' : status === 413 ? 'Dữ liệu gửi lên quá lớn.' : 'Không thể xử lý yêu cầu.' });
  });
  return app;
}
