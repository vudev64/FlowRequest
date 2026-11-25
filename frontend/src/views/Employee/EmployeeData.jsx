// EmployeeData.js
import { systemTimeZone } from '../../lib/systemConfiguration';
// API codes retain the existing MongoDB enum, including BUNSINESS_TRIP.

export const requestTypeOptions = [
  "Tất cả",
  // Nhân sự
  "Nghỉ phép",
  "Đăng ký OT dự án",
  "Điều chỉnh chấm công",
  "Làm việc từ xa",
  // Mua sắm
  "Mua sắm Thiết bị/MacBook",
  "Bản quyền Tool/IDE",
  "Tài nguyên Cloud Server",
  // Đề xuất khác
  "Đăng ký công tác",
  "Đề xuất đào tạo",
  "Đề xuất tuyển dụng"
];

// Dung cho form tao don: khong cho chon "Tat ca".
export const creatableRequestTypeOptions = requestTypeOptions.filter(
  (option) => option !== "Tất cả"
);

export const statusOptions = [
  "Tất cả",
  "Bản nháp",
  "Đang xử lý",
  "Đã duyệt",
  "Cần bổ sung",
  "Đã từ chối",
  "Đã hủy",
];

// PURCHASE retains its three existing categories.
export const requestTypeToApi = Object.freeze({
  "Nghỉ phép": { type: "LEAVE", category: null },
  "Đăng ký OT dự án": { type: "OVERTIME", category: null },
  "Mua sắm Thiết bị/MacBook": { type: "PURCHASE", category: "EQUIPMENT" },
  "Bản quyền Tool/IDE": { type: "PURCHASE", category: "SOFTWARE_LICENSE" },
  "Tài nguyên Cloud Server": { type: "PURCHASE", category: "CLOUD_RESOURCE" },
  "Điều chỉnh chấm công": { type: "ATTENDANCE", category: null },
  "Làm việc từ xa (WFH)": { type: "WFH", category: null },
  "Làm việc từ xa": { type: "WFH", category: null },
  "Đăng ký công tác": { type: "BUNSINESS_TRIP", category: null },
  "Đăng ký cộng tác": { type: "BUNSINESS_TRIP", category: null },
  "Đề xuất đào tạo": { type: "TRAINING", category: null },
  "Đề xuất tuyển dụng": { type: "RECRUITMENT", category: null },
  LEAVE: { type: "LEAVE", category: null },
  OVERTIME: { type: "OVERTIME", category: null },
  PURCHASE: { type: "PURCHASE", category: "EQUIPMENT" },
});

const requestTypeLabels = {
  LEAVE: "Nghỉ phép",
  OVERTIME: "Đăng ký OT dự án",
  PURCHASE: "Mua sắm",
  ATTENDANCE: "Điều chỉnh chấm công",
  WFH : "Làm việc từ xa",
  BUNSINESS_TRIP : "Đăng ký công tác",
  BUSINESS_TRIP : "Đăng ký công tác",
  TRAINING : "Đề xuất đào tạo",
  RECRUITMENT : "Đề xuất tuyển dụng"
};
const categoryLabels = {
  EQUIPMENT: "Mua sắm Thiết bị/MacBook",
  SOFTWARE_LICENSE: "Bản quyền Tool/IDE",
  CLOUD_RESOURCE: "Tài nguyên Cloud Server",
};
export function getRequestTypeLabel(request) {
  if (request?.type === "PURCHASE") {
    return categoryLabels[request.category] || requestTypeLabels.PURCHASE;
  }
  return requestTypeLabels[request?.type] || request?.type || "—";
}

const requestStatusLabels = {
  DRAFT: "Bản nháp",
  PENDING_MANAGER: "Đang xử lý",
  PENDING_DIRECTOR: "Đang xử lý",
  PENDING_HRADMIN: "Đang xử lý",
  PENDING_ACCOUNTANT: "Đang xử lý",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã hủy",
};

const requestStepLabels = {
  DRAFT: "Bản nháp",
  PENDING_MANAGER: "Manager",
  PENDING_DIRECTOR: "Director",
  PENDING_HRADMIN: "HR_ADMIN",
  PENDING_ACCOUNTANT: "Accountant",
  APPROVED: "Đã hoàn tất",
  REJECTED: "Đã hoàn tất",
  CANCELLED: "Đã hủy",
};

const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());

export function formatDate(date = new Date(), lang = "vi") {
  const parsed = date instanceof Date ? date : new Date(date);
  if (!isValidDate(parsed)) return "—";

  return parsed.toLocaleDateString(
    lang === "vi" ? "vi-VN" : "en-US",
    lang === "vi"
      ? { day: "2-digit", month: "2-digit", year: "numeric", timeZone: systemTimeZone() }
      : { month: "short", day: "2-digit", year: "numeric", timeZone: systemTimeZone() }
  );
}

export function formatMonthYear(date = new Date(), lang = "vi") {
  const parsed = date instanceof Date ? date : new Date(date);
  if (!isValidDate(parsed)) return "—";

  return parsed.toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US", {
    timeZone: systemTimeZone(),
    month: "long",
    year: "numeric",
  });
}

export function mapApiRequestToEmployee(request, lang = "vi") {
  const amount = Number(request?.amount);
  const validAmount = Number.isFinite(amount) && amount >= 0 ? amount : 0;
  const duration = request?.type === "LEAVE"
    ? (request.leaveDays != null ? `${request.leaveDays} ngày` : "—")
    : request?.type === "OVERTIME"
      ? (request.overtimeHours != null ? `${request.overtimeHours} giờ` : "—") : "—";
  return {
    id: request?._id ?? request?.id ?? "",
    title: request?.title ?? "",
    type: getRequestTypeLabel(request),
    typeLabel: getRequestTypeLabel(request),
    typeCode: request?.type ?? "",
    rawType: request?.type ?? "",
    category: request?.category ?? null,
    purchaseDetails: request?.purchaseDetails ?? null,
    extraDetails: request?.extraDetails ?? null,
    leaveType: request?.leaveType ?? null,
    startDate: request?.startDate ?? null,
    endDate: request?.endDate ?? null,
    dayPart: request?.dayPart ?? "FULL",
    leaveDays: request?.leaveDays ?? null,
    overtimeDate: request?.overtimeDate ?? null,
    overtimeStart: request?.overtimeStart ?? null,
    overtimeEnd: request?.overtimeEnd ?? null,
    overtimeHours: request?.overtimeHours ?? null,
    projectName: request?.projectName ?? "",
    amount: validAmount,
    value: ["PURCHASE", "BUNSINESS_TRIP", "BUSINESS_TRIP", "TRAINING"].includes(request?.type)
      ? new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(validAmount)
      : duration,
    durationText: duration,
    createdAt: request?.createdAt ? formatDate(request.createdAt, lang) : "—",
    updatedAt: request?.updatedAt ? formatDate(request.updatedAt, lang) : "—",
    createdAtRaw: request?.createdAt ?? null,
    updatedAtRaw: request?.updatedAt ?? null,
    currentStep: requestStepLabels[request?.status] || "—",
    status: requestStatusLabels[request?.status] || request?.status || "—",
    statusCode: request?.status ?? "",
    rawStatus: request?.status ?? "",
    description: request?.content ?? "",
    content: request?.content ?? "",
    comment: request?.approvalHistory?.at(-1)?.comment ?? "",
    approvalHistory: request?.approvalHistory ?? [],
    author: request?.author ?? null,
    department: request?.department ?? null,
    currentApprover: request?.currentApprover ?? null,
    requiresDirector: Boolean(request?.requiresDirector),
    attachment: request?.attachment ?? "",
  };
}

function parseNonNegativeAmount(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  // Chi nhan chuoi so nguyen, co the kem dau phan cach hang nghin / 'đ'.
  const normalized = raw.replace(/\s|\.|,|₫|đ|VND/gi, "");
  if (!/^\d+$/.test(normalized)) {
    throw new Error("Số tiền không hợp lệ");
  }
  const amount = Number(normalized);
  if (!Number.isSafeInteger(amount)) {
    throw new Error("Số tiền vượt phạm vi cho phép");
  }
  return amount;
}

export function mapEmployeeDraftToApi(draft, isDraft = false) {
  const choice = requestTypeToApi[draft?.type];
  if (!choice) throw new Error("Vui lòng chọn loại đề xuất hợp lệ");
  const title = String(draft?.title ?? "").trim();
  const content = String(draft?.description ?? "").trim();
  if (!isDraft && (!title || !content)) {
    throw new Error("Vui lòng nhập tên đề xuất và mô tả");
  }
  const { type, category } = choice;
  const amount = ["PURCHASE", "BUNSINESS_TRIP", "TRAINING"].includes(type) ? parseNonNegativeAmount(draft?.value) : 0;
  // Chỉ chuyển các trường được Backend hỗ trợ, không chuyển nguyên object details.
  const payload = {
    title: title || "Đề xuất mới",
    content: content || "Chưa có mô tả.",
    type, amount, isDraft,
  };
  if (type === "PURCHASE") {
    payload.category = category;
    payload.purchaseDetails = draft.purchaseDetails || {};
    if (draft.budgetCode) payload.purchaseDetails.budgetCode = draft.budgetCode;
  } else if (type === "LEAVE") {
    for (const key of ["leaveType", "startDate", "endDate", "dayPart"]) {
      if (draft[key]) payload[key] = draft[key];
    }
  } else if (type === "OVERTIME") {
    for (const key of ["projectName", "overtimeDate", "overtimeStart", "overtimeEnd"]) {
      if (draft[key]) payload[key] = draft[key];
    }
  } else if (["ATTENDANCE", "WFH", "BUNSINESS_TRIP", "TRAINING", "RECRUITMENT"].includes(type)) {
    payload.extraDetails = draft.extraDetails || {};
  }
  return payload;
}

export const copy = {
  vi: {
    overview: "Tổng quan Đề xuất Cá nhân",
    workspace: "Doanh nghiệp Công nghệ",
    search: "Tìm theo mã REQ hoặc tên đề xuất...",
    requests: "Đơn của tôi",
    newRequest: "Tạo đề xuất mới",
    history: "Lịch sử đề xuất",
    account: "Tài khoản",
    role: "Vai trò",
    language: "Ngôn ngữ",
    historyCaption: "Toàn bộ đề xuất đã tạo và cập nhật bởi bạn",
    logout: "Đăng xuất",
    hello: "Xin chào, Minh Anh",
    subtitle: "Theo dõi tiến độ các đề xuất và phê duyệt của bạn.",
    inProgress: "Đang xử lý",
    completed: "Đã hoàn tất",
    rejected: "Đã từ chối",
    pendingHint: "đang chờ cấp phê duyệt tiếp theo",
    approvedHint: "đề xuất đã đi hết quy trình",
    rejectedHint: "cần xem lại lý do từ chối",
    allTypes: "Tất cả loại đơn",
    allStatus: "Tất cả trạng thái",
    listTitle: "Danh sách đề xuất",
    detail: "Xem timeline",
    approval: "Cấp phê duyệt hiện tại",
    lastUpdate: "Cập nhật lần cuối",
    created: "Ngày tạo",
    amount: "Giá trị / Số ngày",
    requestType: "Loại đề xuất",
    code: "Mã đơn",
    state: "Trạng thái",
    process: "Quy trình phê duyệt",
    employee: "Employee",
    manager: "Manager",
    hrAdmin: "HR_ADMIN",
    accountant: "Accountant",
    director: "Director",
    sent: "Đã gửi",
    approved: "Đã duyệt",
    processing: "Đang xử lý",
    waiting: "Chờ xử lý",
    reason: "Lý do / Mô tả",
    createdBy: "Người tạo",
    value: "Giá trị",
    close: "Đóng",
    requestMore: "Yêu cầu bổ sung",
    createTitle: "Tạo đề xuất mới",
    createDesc: "Bắt đầu một luồng phê duyệt mới cho nhu cầu của bạn.",
    proposalName: "Tên đề xuất",
    proposalNamePlaceholder: "Ví dụ: MacBook Pro 14 M4",
    saveDraft: "Lưu bản nháp",
    submit: "Gửi phê duyệt",
    notificationTitle: "Thông báo mới",
    notificationBody: "REQ-2026-0146 cần bạn bổ sung thông tin.",
    noResults: "Không tìm thấy đề xuất phù hợp",
    noResultsBody: "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.",
    nextStep: "Bước tiếp theo",
    needAction: "Cần bạn xử lý",
    leave: "Nghỉ phép",
    overtime: "Đăng ký OT dự án",
    purchase: "Mua sắm",
    leaveType: "Loại nghỉ phép",
    startDate: "Ngày bắt đầu",
    endDate: "Ngày kết thúc",
    leaveDays: "Số ngày nghỉ",
  },
  en: {
    overview: "My Request Overview",
    workspace: "Technology Enterprise",
    search: "Search by REQ code or proposal name...",
    requests: "My requests",
    newRequest: "Create new request",
    history: "Request history",
    account: "Account",
    role: "Role",
    language: "Language",
    historyCaption: "All requests created and updated by you",
    logout: "Log out",
    hello: "Hello, Minh Anh",
    subtitle: "Track your proposals and approval progress.",
    inProgress: "In progress",
    completed: "Completed",
    rejected: "Rejected",
    pendingHint: "waiting for next approval",
    approvedHint: "requests completed",
    rejectedHint: "need a review of the reason",
    allTypes: "All request types",
    allStatus: "All statuses",
    listTitle: "Request list",
    detail: "View timeline",
    approval: "Current approval",
    lastUpdate: "Last updated",
    created: "Created",
    amount: "Value / Days",
    requestType: "Request type",
    code: "Request ID",
    state: "Status",
    process: "Approval workflow",
    employee: "Employee",
    manager: "Manager",
    hrAdmin: "HR_ADMIN",
    accountant: "Accountant",
    director: "Director",
    sent: "Submitted",
    approved: "Approved",
    processing: "In progress",
    waiting: "Waiting",
    reason: "Reason / Description",
    createdBy: "Created by",
    value: "Value",
    close: "Close",
    requestMore: "Additional information needed",
    createTitle: "Create new request",
    createDesc: "Start a new approval workflow for your request.",
    proposalName: "Proposal name",
    proposalNamePlaceholder: "Example: MacBook Pro 14 M4",
    saveDraft: "Save draft",
    submit: "Submit for approval",
    notificationTitle: "New notification",
    notificationBody: "REQ-2026-0146 needs additional information.",
    noResults: "No matching requests",
    noResultsBody: "Try changing your filters or search term.",
    nextStep: "Next step",
    needAction: "Action required",
    leave: "Leave request",
    overtime: "Project overtime",
    purchase: "Purchase request",
    leaveType: "Leave type",
    startDate: "Start date",
    endDate: "End date",
    leaveDays: "Leave days",
  },
};

export function statusLabel(status, lang = "vi") {
  const labels = {
    vi: {
      "Bản nháp": "Bản nháp",
      "Đang xử lý": "Đang xử lý",
      "Đã duyệt": "Đã duyệt",
      "Cần bổ sung": "Cần bổ sung",
      "Đã từ chối": "Đã từ chối",
      "Đã hủy": "Đã hủy",
    },
    en: {
      "Bản nháp": "Draft",
      "Đang xử lý": "In progress",
      "Đã duyệt": "Approved",
      "Cần bổ sung": "Needs info",
      "Đã từ chối": "Rejected",
      "Đã hủy": "Cancelled",
    },
  };
  return labels[lang]?.[status] || status;
}

export function statusClass(status) {
  return {
    "Bản nháp": "status-draft",
    "Đang xử lý": "status-progress",
    "Đã duyệt": "status-approved",
    "Cần bổ sung": "status-needs-info",
    "Đã từ chối": "status-rejected",
    "Đã hủy": "status-cancelled",
  }[status];
}
