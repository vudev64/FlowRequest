export const HR_TYPES = Object.freeze({ LEAVE: 'Nghỉ phép', OVERTIME: 'Tăng ca', ATTENDANCE: 'Điều chỉnh chấm công', TRAINING: 'Đào tạo', RECRUITMENT: 'Tuyển dụng' });
export function canHrProcess(request, user) {
  const actor = user?.id || user?._id;
  const author = request?.author?._id || request?.author;
  return String(user?.role).toUpperCase() === 'HR_ADMIN' && Boolean(actor) && Boolean(author) && Boolean(HR_TYPES[request?.type]) && request?.status === 'PENDING_HRADMIN' && String(author) !== String(actor);
}
