import { systemTimeZone } from "../../lib/systemConfiguration";
import { FileText, PackageCheck, Zap } from "lucide-react";
export const typeMeta = {
  LEAVE: {
    label: "Nghỉ phép",
    icon: FileText,
    className: "badge-leave",
    accent: "leave"
  },
  OT: {
    label: "Tăng ca (OT)",
    icon: Zap,
    className: "badge-ot",
    accent: "ot"
  },
  PURCHASE: {
    label: "Mua sắm",
    icon: PackageCheck,
    className: "badge-purchase",
    accent: "purchase"
  },
  ATTENDANCE: { label: 'Điều chỉnh chấm công', icon: FileText, className: 'badge-leave', accent: 'leave' },
  WFH: { label: 'Làm việc từ xa', icon: FileText, className: 'badge-leave', accent: 'leave' },
  BUNSINESS_TRIP: { label: 'Công tác', icon: FileText, className: 'badge-leave', accent: 'leave' },
  TRAINING: { label: 'Đào tạo', icon: FileText, className: 'badge-leave', accent: 'leave' },
  RECRUITMENT: { label: 'Tuyển dụng', icon: FileText, className: 'badge-leave', accent: 'leave' },
  UNKNOWN: { label: 'Đề xuất', icon: FileText, className: 'badge-leave', accent: 'leave' },
};
export function nextApprovalRole(request) {
  const type=request.type, amount=Number(request.amount)||0;
  if (request.status === 'PENDING_ACCOUNTANT') return 'Đã hoàn tất';
  if (request.status === 'PENDING_HRADMIN') return type==='TRAINING'&&amount>0?'Accountant':'Đã hoàn tất';
  if (!['PENDING_MANAGER','PENDING_DIRECTOR'].includes(request.status)) return 'Đã kết thúc';
  if (type==='PURCHASE') return request.status==='PENDING_MANAGER'&&request.requiresDirector?'Director':'Accountant';
  if (['LEAVE','OVERTIME','ATTENDANCE','TRAINING','RECRUITMENT'].includes(type)) return 'HR_ADMIN';
  if (type==='BUNSINESS_TRIP') return amount>0?'Accountant':'Đã hoàn tất';
  if (type==='WFH') return 'Đã hoàn tất';
  return 'Chưa xác định';
}
export function formatCurrency(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(value || 0);
}
export function getInitials(name = "") {
  return name.trim().split(/\s+/).map(word => word[0]).slice(-2).join("").toUpperCase();
}
export function mapApiRequestToManager(request) {
  const rawType=request.type;
  const type = rawType === 'OVERTIME' ? 'OT' : Object.hasOwn(typeMeta,rawType) ? rawType : 'UNKNOWN';
  const submittedAt = request.createdAt ? new Intl.DateTimeFormat("vi-VN", {
    timeZone: systemTimeZone()
  }).format(new Date(request.createdAt)) : "—";
  const amount = Number(request.amount) || 0;
  const nextRole = nextApprovalRole(request);
  const financial=['PURCHASE','BUNSINESS_TRIP','TRAINING'].includes(rawType);
  const metric=rawType==='LEAVE'?request.leaveDays:rawType==='OVERTIME'?request.overtimeHours:financial?amount:null;
  return {
    id: String(request._id),
    requester: request.author?.name || "Nhân viên",
    department: request.author?.department || "—",
    type,
    rawType,
    typeCode: rawType,
    category: request.category,
    purchaseDetails: request.purchaseDetails,
    extraDetails: request.extraDetails,
    leaveType: request.leaveType,
    startDate: request.startDate,
    endDate: request.endDate,
    dayPart: request.dayPart,
    leaveDays: request.leaveDays,
    overtimeDate: request.overtimeDate,
    overtimeStart: request.overtimeStart,
    overtimeEnd: request.overtimeEnd,
    overtimeHours: request.overtimeHours,
    projectName: request.projectName,
    attachment: request.attachment,
    financial,
    submittedAt,
    reason: request.content || "",
    metric: metric==null?'—':new Intl.NumberFormat('vi-VN').format(metric),
    metricLabel: rawType==='LEAVE'?'ngày':rawType==='OVERTIME'?'giờ':financial?'VND':'',
    nextRole,
    managerId: String(request.currentApprover?._id || request.currentApprover || ""),
    statusCode: request.status,
    amount
  };
}
export function mapApiRequestToManagerHistory(request, managerId) {
  const mappedRequest = mapApiRequestToManager(request);
  return (request.approvalHistory || []).filter(entry => {
    const approverId = String(entry.approverId?._id || entry.approverId || "");
    return approverId === String(managerId);
  }).map(entry => ({
    ...mappedRequest,
    processedAt: entry.timestamp ? new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: systemTimeZone()
    }).format(new Date(entry.timestamp)) : "—",
    outcome: entry.action,
    note: entry.comment || "—"
  }));
}
export function calculateStats(requests = [], history = []) {
  return {
    pending: requests.length,
    approved: history.filter(item => item.outcome === "APPROVED").length,
    rejected: history.filter(item => item.outcome === "REJECTED").length,
    pendingPurchase: requests.filter(item => item.type === "PURCHASE").reduce((total, item) => total + (Number(item.amount) || 0), 0)
  };
}
