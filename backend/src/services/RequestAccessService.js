import { ROLES, REQUEST_STATUS, REQUEST_TYPES } from '../constants/enums.js';

// Detail and attachment access must use the same document-level checks.
export function requestScopeQuery(user) {
  const query = {};
  switch (user.role) {
    case ROLES.EMPLOYEE: query.author = user._id; break;
    case ROLES.MANAGER:
      query.$or = [{ currentApprover: user._id }, { 'approvalHistory.approverId': user._id }, { author: user._id }]; break;
    case ROLES.DIRECTOR:
      // Director decisions are role-based in the existing workflow.
      query.$or = [{ currentApprover: user._id }, { requiresDirector: true }, { 'approvalHistory.approverId': user._id }, { status: REQUEST_STATUS.PENDING_DIRECTOR }]; break;
    case ROLES.HR_ADMIN:
      query.type = { $in: [REQUEST_TYPES.LEAVE,REQUEST_TYPES.OVERTIME,REQUEST_TYPES.ATTENDANCE_ADJUSTMENT,REQUEST_TYPES.TRAINING,REQUEST_TYPES.RECRUITMENT] }; break;
    case ROLES.ACCOUNTANT:
      query.type = { $in: [REQUEST_TYPES.PURCHASE,REQUEST_TYPES.OVERTIME,REQUEST_TYPES.BUSINESS_TRIP,REQUEST_TYPES.TRAINING] }; break;
    case ROLES.SYSTEM_ADMIN: break;
    default: return null;
  }
  return { $and: [query, { $or: [{ status: { $ne: REQUEST_STATUS.DRAFT } }, { author: user._id }] }] };
}
export function requestDetailQuery(user, id) {
  const scope = requestScopeQuery(user);
  return scope ? { $and: [{ _id: id, ...scope.$and[0] }, ...scope.$and.slice(1)] } : null;
}
