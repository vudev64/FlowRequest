import { signAccessToken } from '../services/TokenService.js';
import { ACCOUNT_CREATION_ROLES, isReservedDemoEmail, isSharedDemoAccount } from '../config/accountPolicy.js';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { ROLES } from '../constants/enums.js';
import { getEffectiveSettings, passwordError } from '../services/SettingsService.js';
import { loginKey, lockedUntil, recordLoginFailure, clearLoginFailures } from '../services/LoginSecurityService.js';

// Bắt buộc có JWT_SECRET, không dùng khóa dự phòng cố định
const generateToken = (id, role, version = 0, sessionMinutes) => {
  return signAccessToken(id, role, version, sessionMinutes);
};

// Ai được tạo tài khoản với role nào
const ASSIGNABLE_ROLES = ACCOUNT_CREATION_ROLES;

// 1. Tạo tài khoản (chỉ HR_ADMIN / SYSTEM_ADMIN, route phải có protect + authorize)
export const register = async (req, res) => {
  try {
    const { name, email: rawEmail, password, role, department } = req.body || {};
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

    if (typeof name !== 'string' || !name.trim() || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string' || typeof department !== 'string' || !department.trim() || isReservedDemoEmail(email)) {
      return res.status(400).json({ message: 'Thiếu tên, email hoặc mật khẩu' });
    }
    const { security } = await getEffectiveSettings();
    const policyError = passwordError(password, security.password);
    if (policyError) return res.status(400).json({ message: policyError });

    // Người đang đăng nhập chỉ được cấp các role trong danh sách của họ
    const allowed = ASSIGNABLE_ROLES[req.user.role] || [];
    const newRole = role || ROLES.EMPLOYEE;
    if (!allowed.includes(newRole)) {
      return res.status(403).json({ message: 'Bạn không có quyền cấp role này' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email này đã tồn tại' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: newRole,
      department,
    });

    // Không trả token: người tạo là HR/Admin, không phải người mới
    res.status(201).json({
      message: 'Tạo tài khoản thành công!',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi Server khi tạo tài khoản' });
  }
};

// 2. Đăng nhập
export const login = async (req, res) => {
  try {
    const { email: rawEmail, password } = req.body || {};
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : rawEmail;
    if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 1024) return res.status(400).json({ message: 'Thông tin đăng nhập không hợp lệ.' });
    if (isReservedDemoEmail(email)) return res.status(400).json({ message: 'Email hoặc mật khẩu không chính xác!' });
    const { security } = await getEffectiveSettings();
    const key = loginKey(email);
    const trackAccountFailures = security.maxFailedLogins > 0 && !isSharedDemoAccount(email);
    if (trackAccountFailures && await lockedUntil(key)) return res.status(429).set('Retry-After', String(security.lockoutMinutes * 60)).json({ message: 'Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau.' });

    const user = await User.findOne({ email });
    if (!user || user.status === 'INACTIVE') {
      if (trackAccountFailures) await recordLoginFailure(key, security);
      return res.status(400).json({ message: 'Email hoặc mật khẩu không chính xác!' });
    }

    const isPass = await bcrypt.compare(password, user.password);
    if (!isPass) {
      if (trackAccountFailures) await recordLoginFailure(key, security);
      return res.status(400).json({ message: 'Email hoặc mật khẩu không chính xác!' });
    }

    if (trackAccountFailures) await clearLoginFailures(key);
    res.json({
      message: 'Đăng nhập thành công!',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      },
      token: generateToken(user._id, user.role, user.tokenVersion || 0, security.sessionMinutes)
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi Server khi đăng nhập' });
  }
};
