import { systemTimeZone } from '../../lib/systemConfiguration';

export function paymentDay(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: systemTimeZone() }).formatToParts(new Date(value));
  const part = key => parts.find(item => item.type === key).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function paymentDate(value, lang) {
  return value ? new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'vi-VN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)) : '—';
}
export function paymentError(error, lang) {
  const message = error?.message;
  if (lang !== 'en') return message || 'Không thể ghi nhận thanh toán.';
  const messages = {
    'Ngân sách đã thay đổi. Hãy tải lại trước khi lưu.': 'The budget changed. Reload before saving.',
    'Không thể giảm ngân sách dưới số đã cam kết.': 'The budget cannot be reduced below its committed amount.',
    'Cần chọn phòng ban có thật, mã và số cam kết ban đầu hợp lệ.': 'Choose an existing department and enter a valid code and opening commitment.',
    'Số tiền thanh toán vượt số còn được phép chi.': 'Payment exceeds the remaining approved amount.',
    'Cần tải lên chứng từ thanh toán.': 'A payment voucher is required.',
    'Số tiền thanh toán phải là số nguyên dương hợp lệ.': 'Payment must be a positive whole number.',
    'Không ghi nhận ngày thanh toán trong tương lai.': 'A payment date cannot be in the future.',
    'Ngày thanh toán không được trước ngày phê duyệt.': 'Payment cannot predate approval.',
    'Số liệu thanh toán cần đối soát trước khi ghi nhận tiếp.': 'Payment figures require reconciliation before another payment.',
    'Người tạo không tự xác nhận thanh toán cho đơn của mình.': 'You cannot confirm payment for your own request.',
    'Đơn chưa được duyệt hợp lệ hoặc thiếu lịch sử duyệt để ghi nhận thanh toán.': 'The request is not approved or its approval history needs review.',
    'Mã ghi nhận đã được dùng với dữ liệu khác. Hãy tải lại lịch sử thanh toán.': 'This payment key was used with different data. Reload payment history before continuing.',
  };
  return Object.hasOwn(messages, message) ? messages[message] : error?.status === 401 ? 'Your session expired. Please sign in again.' : 'Unable to complete the operation. Reload the latest data before retrying.';
}
