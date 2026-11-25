import express from 'express';
import { createRequest, getRequests, getRequestById, updateRequestStatus, getDashboard } from '../Controllers/requestController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/upload.js';
import { ROLES } from '../constants/enums.js';
import { downloadRequestAttachment } from '../Controllers/requestAttachmentController.js';
import { financeSummary, paymentHistory, recordPayment, downloadPaymentVoucher, saveBudget } from '../Controllers/financeController.js';
import { listBudgetIncreases, getBudgetIncrease, createBudgetIncrease, decideBudgetIncrease } from '../Controllers/budgetIncreaseController.js';

const router = express.Router();
router.get('/finance/budget-increases', protect, authorize(ROLES.ACCOUNTANT, ROLES.DIRECTOR), listBudgetIncreases);
router.get('/finance/budget-increases/:id', protect, authorize(ROLES.ACCOUNTANT, ROLES.DIRECTOR), getBudgetIncrease);
router.post('/finance/budget-increases', protect, authorize(ROLES.ACCOUNTANT), createBudgetIncrease);
router.patch('/finance/budget-increases/:id/decision', protect, authorize(ROLES.DIRECTOR), decideBudgetIncrease);
router.get('/finance/summary', protect, authorize(ROLES.ACCOUNTANT, ROLES.DIRECTOR), financeSummary);
router.get('/finance/payments', protect, authorize(ROLES.ACCOUNTANT, ROLES.DIRECTOR), paymentHistory);
router.post('/finance/budgets', protect, authorize(ROLES.ACCOUNTANT), saveBudget);
router.patch('/finance/budgets/:departmentId', protect, authorize(ROLES.ACCOUNTANT), saveBudget);
router.get('/finance/payments/:paymentId/voucher', protect, authorize(ROLES.ACCOUNTANT, ROLES.DIRECTOR), downloadPaymentVoucher);
router.post('/:id/payments', protect, authorize(ROLES.ACCOUNTANT), upload.single('voucher', { cleanupOnFailure: false, privateStorage: true }), recordPayment);
router.get('/:id/attachment', protect, authorize(ROLES.EMPLOYEE, ROLES.MANAGER, ROLES.ACCOUNTANT, ROLES.HR_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.DIRECTOR), downloadRequestAttachment);
// 1. Route báo cáo thống kê Dashboard
// Cho phép Manager, Director, HR, Kế toán và System Admin xem Dashboard
router.get(
  '/stats/dashboard',
  protect,
  authorize(ROLES.MANAGER, ROLES.DIRECTOR, ROLES.HR_ADMIN, ROLES.ACCOUNTANT, ROLES.SYSTEM_ADMIN),
  getDashboard
);

// 2.Lấy chi tiết đơn theo ID
router.get(
    '/:id',
    protect,
    authorize(
        ROLES.EMPLOYEE,
        ROLES.MANAGER,
        ROLES.ACCOUNTANT,
        ROLES.HR_ADMIN,
        ROLES.SYSTEM_ADMIN,
        ROLES.DIRECTOR
    ),
    getRequestById
);

// 3. Tạo đơn mới
// Tất cả nhân sự trong công ty đều có quyền tạo đề xuất cá nhân
router.post(
  '/',
  protect,
  authorize(ROLES.EMPLOYEE, ROLES.MANAGER, ROLES.DIRECTOR, ROLES.HR_ADMIN, ROLES.ACCOUNTANT),
  upload.single('attachment', { cleanupOnFailure: false }),
  createRequest
);

// 4. Lấy danh sách đơn
// Tất cả các Role đều được truy cập (Controller sẽ tự filter dữ liệu tương ứng với Role)
router.get(
  '/',
  protect,
  authorize(ROLES.EMPLOYEE, ROLES.MANAGER, ROLES.DIRECTOR, ROLES.HR_ADMIN, ROLES.ACCOUNTANT, ROLES.SYSTEM_ADMIN),
  getRequests
);

// 5. Phê duyệt hoặc từ chối đơn
// Cho phép Manager, Director, HR Admin và Kế toán xử lý đơn theo từng công đoạn
router.patch(
  '/:id/status',
  protect,
  authorize(ROLES.MANAGER, ROLES.DIRECTOR, ROLES.HR_ADMIN, ROLES.ACCOUNTANT),
  updateRequestStatus
);

export default router;
