import { verifyAccessToken, effectiveSessionMinutes } from '../services/TokenService.js';
import { isReservedDemoEmail } from '../config/accountPolicy.js';
import User from '../models/User.js';
import { getEffectiveSettings } from '../services/SettingsService.js';

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Lấy token từ Header
      token = req.headers.authorization.split(' ')[1];

      // Decode token sử dụng JWT_SECRET từ env
      const decoded = verifyAccessToken(token);

      // Query thông tin user từ DB ,loại bỏ field password
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user || isReservedDemoEmail(req.user.email) || req.user.status === 'INACTIVE' || (decoded.version || 0) !== (req.user.tokenVersion || 0)) {
        return res
          .status(401)
          .json({ message: 'Phiên đăng nhập đã hết hiệu lực hoặc tài khoản bị khóa. Vui lòng đăng nhập lại.' });
      }

      const { security } = await getEffectiveSettings();
      if (!decoded.iat || Date.now() / 1000 - decoded.iat >= effectiveSessionMinutes(security.sessionMinutes) * 60) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn theo cấu hình hệ thống. Vui lòng đăng nhập lại.' });
      next();
    } catch (error) {
      console.error('Lỗi Auth Middleware:', error.message);
      return res
        .status(401)
        .json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
    }
  }

  if (!token) {
    return res
      .status(401)
      .json({ message: 'Không tìm thấy Token, truy cập bị từ chối' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Quyền '${req.user.role}' không được phép thực hiện thao tác này`,
      });
    }
    next();
  };
};
