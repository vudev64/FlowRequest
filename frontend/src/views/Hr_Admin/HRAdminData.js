// HRConstants.js: bản JavaScript của file TypeScript gốc.
// Kiểu dữ liệu được giữ lại dưới dạng JSDoc để editor (VS Code) vẫn gợi ý được.
/**
 * @typedef {"DIRECTOR" | "SYSTEM_ADMIN" | "HR_ADMIN" | "MANAGER" | "ACCOUNTANT" | "EMPLOYEE"} HRRole
 * @typedef {"LEAVE" | "OT" | "PURCHASE"} HRRequestType
 */

// Tương đương "as const" của TypeScript: đóng băng toàn bộ object/array lồng nhau.
const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

/** @type {Record<HRRole, string>} */
export const HR_ROLE_LABELS = {
  DIRECTOR: "DIRECTOR",
  SYSTEM_ADMIN: "SYSTEM_ADMIN",
  HR_ADMIN: "HR_ADMIN",
  MANAGER: "MANAGER",
  ACCOUNTANT: "ACCOUNTANT",
  EMPLOYEE: "EMPLOYEE",
};

/** @type {HRRole[]} */
export const HR_CAN_CREATE = ["EMPLOYEE", "MANAGER", "ACCOUNTANT"];

/** @type {HRRole[]} */
export const HR_PROTECTED_ROLES = ["HR_ADMIN", "DIRECTOR", "SYSTEM_ADMIN"];

/** @type {HRRequestType[]} */
export const HR_APPROVABLE_TYPES = ["LEAVE", "OT"];

export const HR_NAV_ITEMS = deepFreeze([
  { key: "overview", label: "Tổng quan", href: "/hr" },
  { key: "users", label: "Quản lý nhân sự", href: "/hr/users" },
  { key: "approvals", label: "Duyệt phép & OT", href: "/hr/approvals" },
  { key: "permissions", label: "Phân quyền & liên kết", href: "/hr/permissions" },
]);

export const HR_PERMISSION_MATRIX = deepFreeze([
  { label: "Xem danh sách nhân sự", SYSTEM_ADMIN: true, HR_ADMIN: true, DIRECTOR: true },
  { label: "Cấp HR_ADMIN / DIRECTOR", SYSTEM_ADMIN: true, HR_ADMIN: false, DIRECTOR: false },
  { label: "Cấp role thường", SYSTEM_ADMIN: true, HR_ADMIN: true, DIRECTOR: false },
  { label: "Khóa tài khoản thường", SYSTEM_ADMIN: true, HR_ADMIN: true, DIRECTOR: false },
  { label: "Duyệt cuối LEAVE / OT", SYSTEM_ADMIN: false, HR_ADMIN: true, DIRECTOR: false },
  { label: "Duyệt Cấp 1 MANAGER / HR", SYSTEM_ADMIN: false, HR_ADMIN: false, DIRECTOR: true },
]);

export const HR_API_GUARDS = deepFreeze([
  { action: "Tạo HR_ADMIN", code: "403 ROLE_NOT_ALLOWED" },
  { action: "Tạo DIRECTOR", code: "403 ROLE_NOT_ALLOWED" },
  { action: "Khóa SYSTEM_ADMIN", code: "403 PROTECTED_ROLE" },
  { action: "Khóa Manager còn cấp dưới", code: "409 HAS_SUBORDINATES" },
  { action: "Xử lý đơn Mua sắm", code: "403 TYPE_NOT_ALLOWED" },
  { action: "Tự duyệt đơn của HR", code: "403 SELF_PROCESS" },
]);

export const HR_ROUTE_CONTRACT = deepFreeze({
  readUsers: ["HR_ADMIN", "DIRECTOR", "SYSTEM_ADMIN"],
  writeUsers: ["HR_ADMIN", "SYSTEM_ADMIN"],
  processRequests: ["HR_ADMIN"],
});