import { ROLES, REQUEST_STATUS, REQUEST_TYPES } from '../constants/enums.js';

export const FINANCE_TYPES = [REQUEST_TYPES.PURCHASE, REQUEST_TYPES.BUSINESS_TRIP, REQUEST_TYPES.TRAINING];
export const entityId = value => String(value?._id || value?.id || value || '');
export function financeScope(user) {
  const query = { type: { $in: FINANCE_TYPES }, status: REQUEST_STATUS.APPROVED };
  if (user.role === ROLES.DIRECTOR) query.$or = [
    { currentApprover: user._id }, { requiresDirector: true }, { 'approvalHistory.approverId': user._id },
  ];
  return query;
}
export function approvalSnapshot(request) {
  const final = [...(request.approvalHistory || [])].reverse().find(entry => entry.role === ROLES.ACCOUNTANT && entry.action === REQUEST_STATUS.APPROVED && entry.toStatus === REQUEST_STATUS.APPROVED);
  const stored = Number.isSafeInteger(request.approvedAmount) && request.approvedAmount >= 0;
  const amount = stored ? request.approvedAmount : request.amount;
  const approvedAt = stored ? request.approvedAt || final?.timestamp || request.completedAt : final?.timestamp || request.completedAt;
  const approvedBy = stored ? request.approvedBy || final?.approverId : final?.approverId;
  const verified = Boolean(FINANCE_TYPES.includes(request.type) && request.status === REQUEST_STATUS.APPROVED && Number.isSafeInteger(amount) && amount >= 0 && approvedAt && !Number.isNaN(new Date(approvedAt).getTime()) && approvedBy);
  return { amount: Number.isSafeInteger(amount) && amount >= 0 ? amount : 0, approvedAt, approvedBy, verified };
}
export function calendarDay(value, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).formatToParts(new Date(value));
  const part = key => parts.find(item => item.type === key).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function paymentDto(payment) {
  const request = payment.request;
  return { id: entityId(payment), requestId: entityId(request), requestTitle: request?.title || '', requestType: request?.type || '', amount: payment.amount, paidAt: payment.paidAt, paidOn: payment.paidOn, timeZone: payment.timeZone, performedBy: { id: entityId(payment.performedBy), name: payment.performedBy?.name || '—' }, voucherName: payment.voucher.originalName, note: payment.note, createdAt: payment.createdAt };
}
