import jwt from 'jsonwebtoken';
import { authConfig } from '../config/environment.js';
export function effectiveSessionMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) throw new Error('Thời hạn phiên không hợp lệ.');
  return authConfig().environment === 'demo' ? Math.min(minutes, 120) : minutes;
}
export function signAccessToken(id, role, version, sessionMinutes) {
  const config = authConfig();
  if (!config.secret) throw new Error('Thiếu khóa JWT của môi trường.');
  return jwt.sign({ id, role, version, environment: config.environment }, config.secret,
    { algorithm: 'HS256', expiresIn: effectiveSessionMinutes(sessionMinutes) * 60, issuer: config.issuer, audience: config.audience });
}
export function verifyAccessToken(token) {
  const config = authConfig();
  const decoded = jwt.verify(token, config.secret, { algorithms: ['HS256'], ...(config.environment === 'production' ? { issuer: config.issuer, audience: config.audience } : {}) });
  if (config.environment === 'production' && decoded.environment !== 'production') throw new Error('Token không thuộc Production.');
  if (config.environment === 'demo' && ((decoded.environment && decoded.environment !== 'demo') || (decoded.iss && decoded.iss !== config.issuer) || (decoded.aud && decoded.aud !== config.audience))) throw new Error('Token không thuộc Demo.');
  return decoded;
}
