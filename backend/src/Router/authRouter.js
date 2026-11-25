import express from 'express';
import { register, login } from '../Controllers/authController.js';
import { protect, authorize } from '../middleware/authMiddleware.js'; // sửa theo tên thật
import { ROLES } from '../constants/enums.js';

const router = express.Router();

// Tạo tài khoản: chỉ HR_ADMIN và SYSTEM_ADMIN
router.post('/register', protect, authorize(ROLES.HR_ADMIN, ROLES.SYSTEM_ADMIN), register);

// Đăng nhập: ai cũng gọi được
router.post('/login', login);

export default router;
