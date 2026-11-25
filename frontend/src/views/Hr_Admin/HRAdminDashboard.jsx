import { systemTimeZone, passwordMeetsPolicy } from "../../lib/systemConfiguration";
import "./HRAdmin.css";
import { SystemBrandName, SystemLogo, useSystemConfiguration } from '../SystemConfiguration';
import "./HRTypography.css";
import { AdminPreferencesProvider, AdminPreferenceControls, useAdminPreferences } from '../AdminPreferences';
import { apiRequest } from '../../lib/api';
import HRRequestsPanel from './components/HRRequestsPanel';
import { HR_TYPES } from './HRRequestData';
import HRImportModal from './components/HRImportModal';
import HRPermissionsPanel from './components/HRPermissionsPanel';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { Activity, ArrowRight, Check, ChevronDown, CircleAlert, ClipboardCheck, FileSpreadsheet, Filter, KeyRound, LayoutDashboard, LogOut, Menu, MoreHorizontal, Plus, Search, ShieldCheck, SlidersHorizontal, UserRound, Users, X } from "lucide-react";

/**
 * @typedef {"DIRECTOR" | "SYSTEM_ADMIN" | "HR_ADMIN" | "MANAGER" | "ACCOUNTANT" | "EMPLOYEE"} Role
 * @typedef {"ACTIVE" | "INACTIVE"} UserStatus
 * @typedef {"LEAVE" | "OT" | "PURCHASE"} RequestType
 * @typedef {{ id: number|string, name: string, email: string, title?: string, department?: string, role: Role, manager?: string, managerId?: number|string, status: UserStatus, initials?: string, createdAt?: string }} Employee
 * @typedef {{ id: number|string, name: string, role: Role, type: RequestType, department?: string, reason?: string, duration?: string, approver?: string, approverRole?: string, approvedAt?: string, note?: string }} Approval
 * @typedef {{ id: number|string, name: string, type: RequestType, outcome: "APPROVED" | "REJECTED", processedAt: string, note?: string }} Processed
 */

// Không còn dữ liệu mẫu: danh sách mặc định rỗng, thêm vào là tự hiện.
// Có thể truyền dữ liệu có sẵn qua props initialUsers / initialApprovals / initialProcessed.
const EMPTY = [];

// ==================== CẤU HÌNH (không phải dữ liệu) ====================

const ROLES = ["DIRECTOR", "SYSTEM_ADMIN", "HR_ADMIN", "MANAGER", "ACCOUNTANT", "EMPLOYEE"];
const roleClass = {
  DIRECTOR: "role-director",
  SYSTEM_ADMIN: "role-system",
  HR_ADMIN: "role-hr",
  MANAGER: "role-manager",
  ACCOUNTANT: "role-accountant",
  EMPLOYEE: "role-employee"
};
const typeLabels = {
  ...HR_TYPES,
  OT: "Tăng ca OT",
  PURCHASE: "Mua sắm"
};
const ALL_ROLES = "Tất cả role";
const ALL_DEPTS = "Tất cả phòng ban";
const ASSIGNABLE_ROLES = ["EMPLOYEE", "MANAGER", "ACCOUNTANT"];
const PROTECTED_ROLES = ["DIRECTOR", "HR_ADMIN", "SYSTEM_ADMIN"];
const MANAGER_ROLES = ["MANAGER", "DIRECTOR"];
const PAGE_TITLES = {
  overview: ["Tổng quan", "Theo dõi nhanh tình hình nhân sự và các yêu cầu cần xử lý."],
  users: ["Quản lý nhân sự", "Quản lý thông tin, vai trò và trạng thái truy cập của nhân sự toàn công ty."],
  history: ["Lịch sử phê duyệt", "Tra cứu các đơn đã được HR xử lý."],
  approvals: ["Xét duyệt đơn nhân sự", "Các đề xuất thuộc phạm vi xử lý của HR."],
  permissions: ["Phân quyền & liên kết", "Kiểm tra ma trận quyền và các lớp bảo vệ API của HR Workspace."]
};

// ==================== HÀM TIỆN ÍCH ====================

function getUserInitials(name) {
  return name?.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join("").toUpperCase() || "—";
}
const monthKey = d => { const parts = Object.fromEntries(new Intl.DateTimeFormat("en", { timeZone: systemTimeZone(), year: "numeric", month: "2-digit" }).formatToParts(d).map(p => [p.type, p.value])); return `${parts.year}-${parts.month}`; };
function greetingFor(hour) {
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 14) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

// Số liệu thống kê luôn được TÍNH từ dữ liệu hiện có
function buildStats({
  users,
  approvals,
  processed
}) {
  const total = users.length;
  const active = users.filter(u => u.status === "ACTIVE").length;
  const thisMonth = monthKey(new Date());
  const hasCreatedAt = users.some(u => u.createdAt);
  const joined = users.filter(u => u.createdAt && monthKey(new Date(u.createdAt)) === thisMonth).length;
  const processedThisMonth = processed.filter(p => monthKey(new Date(p.processedAt)) === thisMonth).length;
  return [{
    label: "Tổng nhân sự",
    value: String(total),
    meta: hasCreatedAt ? `+${joined} tháng này` : "",
    icon: Users,
    color: "indigo"
  }, {
    label: "Đang hoạt động",
    value: String(active),
    meta: total ? `${Math.round(active / total * 100)}% tổng số` : "",
    icon: Activity,
    color: "green"
  }, {
    label: "Đơn chờ ghi nhận",
    value: String(approvals.length),
    meta: "Đơn thuộc phạm vi HR",
    icon: ClipboardCheck,
    color: "amber"
  }, {
    label: "Đã xử lý trong tháng",
    value: String(processedThisMonth),
    meta: "",
    icon: Check,
    color: "blue"
  }];
}

// ==================== COMPONENT DÙNG CHUNG ====================

function Avatar({
  initials,
  tone = "indigo"
}) {
  return <div className={`avatar avatar-${tone}`}>{initials}</div>;
}
function Stats({
  cards
}) {
  const {
    t: translate
  } = useAdminPreferences();
  return <div className="stats-grid">
      {cards.map(card => {
      const Icon = card.icon;
      return <div className="stat-card" key={translate(card.label)}>
            <div className={`stat-icon ${card.color}`}><Icon size={19} /></div>
            <div>
              <p>{translate(card.label)}</p>
              <strong>{card.value}</strong>
              {card.meta && <span>{translate(card.meta)}</span>}
            </div>
          </div>;
    })}
    </div>;
}
function Sidebar({
  active,
  currentUser,
  pendingCount,
  onLogout,
  onNavigate
}) {
  const {
    t: translate
  } = useAdminPreferences();
  const items = [{
    href: "/hr",
    key: "overview",
    label: "Tổng quan",
    icon: LayoutDashboard
  }, {
    href: "/hr/users",
    key: "users",
    label: "Quản lý nhân sự",
    icon: Users
  }, {
    href: "/hr/approvals",
    key: "approvals",
    label: "Xét duyệt đơn",
    icon: ClipboardCheck
  }, {
    href: "/hr/history",
    key: "history",
    label: "Lịch sử phê duyệt",
    icon: ClipboardCheck
  }, {
    href: "/hr/permissions",
    key: "permissions",
    label: "Phân quyền & liên kết",
    icon: ShieldCheck
  }];
  return <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><SystemLogo fallback={<><span></span><span></span><span></span></>} /></div>
        <div><b><SystemBrandName /></b><small>HR WORKSPACE</small></div>
      </div>
      <div className="nav-label">{translate("Kh\xF4ng gian l\xE0m vi\u1EC7c")}</div>
      <nav>
        {items.map(item => {
        const Icon = item.icon;
        return <Link key={item.key} to={item.href} onClick={onNavigate} className={`nav-item ${active === item.key ? "active" : ""}`}>
              <Icon size={18} />
              <span>{translate(item.label)}</span>
              {item.key === "approvals" && pendingCount > 0 && <em>{pendingCount}</em>}
            </Link>;
      })}
      </nav>
      <div className="sidebar-bottom">
        <div className="profile">
          <Avatar initials={getUserInitials(currentUser?.name)} tone="purple" />
          <div>
            <b>{currentUser?.name || "HR Admin"}</b>
            <span>HR_ADMIN{currentUser?.department ? ` · ${currentUser.department}` : ""}</span>
          </div>
          <button className="icon-button" type="button" aria-label={translate("Đăng xuất")} onClick={onLogout}>
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>;
}
function Header({
  title,
  subtitle,
  onMenu,
  currentUser,
  hasPending
}) {
  const {
    settings
  } = useSystemConfiguration();
  const {
    t: translate
  } = useAdminPreferences();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const role = String(currentUser?.role || 'HR_ADMIN').toUpperCase();
  useEffect(() => {
    if (!profileOpen) return;
    const closeOutside = event => {
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false);
    };
    const closeOnEscape = event => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        profileRef.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [profileOpen]);
  return <header className="topbar">
      <button className="mobile-menu" onClick={onMenu}><Menu size={20} /></button>
      <div>
        <h1>{translate(title)}</h1>
        <p>{translate(subtitle)}</p>
      </div>
      <div className="top-actions">
        <AdminPreferenceControls />
        {settings?.notificationsEnabled !== false && <button className="icon-button" aria-label={translate("Thông báo")}>
          <Activity size={18} />
          {hasPending && <i></i>}
        </button>}
        <div className="hr-profile-menu" ref={profileRef}>
          <button type="button" className="top-user hr-profile-trigger" aria-expanded={profileOpen} aria-controls="hr-profile-details" onClick={() => setProfileOpen(open => !open)}>
            <Avatar initials={getUserInitials(currentUser?.name)} tone="purple" />
            <span>{currentUser?.name || "HR Admin"}</span>
            <ChevronDown size={15} className={profileOpen ? 'is-open' : ''} />
          </button>
          {profileOpen && <section id="hr-profile-details" className="hr-profile-dropdown" aria-label={translate('Thông tin tài khoản')}>
            <h2>{translate('Thông tin tài khoản')}</h2>
            <dl>
              <div><dt>{translate('Họ tên')}</dt><dd>{currentUser?.name || '—'}</dd></div>
              <div><dt>{translate('Vai trò')}</dt><dd>{role === 'HR_ADMIN' ? translate('Quản trị nhân sự') : role}<small>{role}</small></dd></div>
            </dl>
          </section>}
        </div>
      </div>
    </header>;
}
function Modal({
  title,
  children,
  onClose,
  wide = false
}) {
  const {
    t: translate
  } = useAdminPreferences();
  return <div className="modal-backdrop" onMouseDown={onClose}>
      <div className={`modal ${wide ? "modal-wide" : ""}`} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{translate(title)}</h2>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>;
}

// ==================== CÁC TRANG ====================

function Overview({
  onNavigate,
  approvals,
  security,
  currentUser
}) {
  const {
    t: translate
  } = useAdminPreferences();
  const now = new Date();
  const {
    lang: overviewLanguage
  } = useAdminPreferences();
  const dateLabel = now.toLocaleDateString(overviewLanguage === "en" ? "en-GB" : "vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: systemTimeZone()
  });
  const firstName = currentUser?.name?.split(/\s+/)[0] || "HR";
  return <>
      <div className="overview-grid">
        <div className="welcome-card">
          <div>
            <div className="eyebrow light"><span className="spark"></span> {dateLabel}</div>
            <h2>{translate(greetingFor(now.getHours()))}, {firstName}</h2>
            <p>
              {approvals.length > 0 ? <>{translate("B\u1EA1n c\xF3")}<b>{approvals.length}{translate("\u0111\u01A1n")}</b>{translate("c\u1EA7n ghi nh\u1EADn h\xF4m nay.")}</> : translate("Hiện không có đơn nào đang chờ ghi nhận.")}
            </p>
            <button className="light-button" onClick={() => onNavigate("approvals")}>{translate("Xem \u0111\u01A1n ch\u1EDD")}<ArrowRight size={15} /></button>
          </div>
          <div className="welcome-shape">
            <div className="shape-ring ring-one"></div>
            <div className="shape-ring ring-two"></div>
            <Users size={44} />
          </div>
        </div>
        <div className="quick-card">
          <div className="card-heading">
            <div><b>{translate("Truy c\u1EADp nhanh")}</b><span>{translate("C\xE1c t\xE1c v\u1EE5 th\u01B0\u1EDDng d\xF9ng")}</span></div>
            <MoreHorizontal size={18} />
          </div>
          <button onClick={() => onNavigate("users")}>
            <div className="quick-icon purple"><UserRound size={18} /></div>
            <span><b>{translate("C\u1EA5p t\xE0i kho\u1EA3n m\u1EDBi")}</b><small>{translate("T\u1EA1o user v\xE0 ph\xE2n quy\u1EC1n")}</small></span>
            <ArrowRight size={15} />
          </button>
          <button onClick={() => onNavigate("approvals")}>
            <div className="quick-icon amber"><ClipboardCheck size={18} /></div>
            <span><b>{translate("Ghi nh\u1EADn \u0111\u01A1n ch\u1EDD")}</b><small>{approvals.length}{translate("\u0111\u01A1n \u0111ang ch\u1EDD x\u1EED l\xFD")}</small></span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      <div className="overview-lower">
        <div className="recent-card">
          <div className="table-title">
            <div><b>{translate("\u0110\u01A1n c\u1EA7n ghi nh\u1EADn")}</b><span>{translate("\u01AFu ti\xEAn x\u1EED l\xFD trong h\xF4m nay")}</span></div>
            <button className="text-button" onClick={() => onNavigate("approvals")}>{translate("Xem t\u1EA5t c\u1EA3")}<ArrowRight size={15} /></button>
          </div>
          <div className="mini-requests">
            {approvals.length === 0 && <div className="empty-state"><p>{translate("Kh\xF4ng c\xF3 \u0111\u01A1n n\xE0o \u0111ang ch\u1EDD.")}</p></div>}
            {approvals.slice(0, 3).map(item => <div key={item.id}>
                <div className="request-person">
                  <Avatar initials={getUserInitials(item.name)} tone="gray" />
                  <span><b>{item.name}</b><small>{item.department}</small></span>
                </div>
                <span className={`request-badge ${item.type.toLowerCase()}`}>{translate(typeLabels[item.type] ?? item.type)}</span>
                <span className="time-label">{String(item.approvedAt ?? "").split(",")[0]}</span>
                <ArrowRight size={15} />
              </div>)}
          </div>
        </div>

        <div className="security-card">
          <div className="card-heading">
            <div><b>{translate("B\u1EA3o m\u1EADt t\xE0i kho\u1EA3n")}</b><span>{translate("C\u1EADp nh\u1EADt theo th\u1EDDi gian th\u1EF1c")}</span></div>
            <ShieldCheck size={19} />
          </div>
          {security ? <>
              <div className="security-score">
                <div className="score-ring"><strong>{security.score}</strong><span>/100</span></div>
                <div><b>{translate(security.label)}</b><p>{security.message}</p></div>
              </div>
              {(security.checks ?? []).map(c => <div className="security-line" key={translate(c.label)}>
                  <span><span className="green-dot"></span> {translate(c.label)}</span>
                  <b>{c.value}</b>
                </div>)}
            </> : <p>{translate("Ch\u01B0a c\xF3 d\u1EEF li\u1EC7u b\u1EA3o m\u1EADt.")}</p>}
        </div>
      </div>
    </>;
}
function UsersPage({
  users,
  setUsers
}) {
  const {
    t: translate
  } = useAdminPreferences();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState(ALL_ROLES);
  const [dept, setDept] = useState(ALL_DEPTS);
  const [modal, setModal] = useState(null); // "create" | "import" | null

  const departments = useMemo(() => [...new Set(users.map(u => u.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi")), [users]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter(u => `${u.name} ${u.email}`.toLowerCase().includes(q) && (role === ALL_ROLES || u.role === role) && (dept === ALL_DEPTS || u.department === dept));
  }, [users, query, role, dept]);
  const toggleStatus = async id => {
    const target = users.find(u => u.id === id);
    if (!target) return;
    if (target.status === "ACTIVE") {
      if (PROTECTED_ROLES.includes(target.role)) {
        toast.error("PROTECTED_ROLE · Chỉ SYSTEM_ADMIN mới được khóa role bảo vệ");
        return;
      }
      const hasSubordinates = users.some(u => u.id !== id && u.status === "ACTIVE" && (u.managerId != null ? u.managerId === id : u.manager === target.name));
      if (hasSubordinates) {
        toast.error("HAS_SUBORDINATES · Tài khoản còn nhân viên cấp dưới đang hoạt động");
        return;
      }
    }
    try {
      const result = await apiRequest('/hr/users/' + id, {
        method: 'PATCH',
        body: {
          status: target.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
        }
      });
      setUsers(rows => rows.map(u => u.id === id ? {
        ...result.data,
        id: result.data._id
      } : u));
      toast.success('Đã lưu thay đổi trên hệ thống.');
    } catch (error) {
      toast.error(error.message);
    }
  };
  return <>
      <div className="page-intro">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /><Users size={14} />{translate("Danh m\u1EE5c nh\xE2n s\u1EF1")}</div>
          <h1>{translate("Qu\u1EA3n l\xFD nh\xE2n s\u1EF1 & c\u1EA5p t\xE0i kho\u1EA3n")}</h1>
          <p>{translate("Qu\u1EA3n l\xFD th\xF4ng tin, vai tr\xF2 v\xE0 tr\u1EA1ng th\xE1i truy c\u1EADp c\u1EE7a nh\xE2n s\u1EF1 to\xE0n c\xF4ng ty.")}</p>
        </div>
        <div className="intro-actions">
          <button className="primary-button" onClick={() => setModal("create")}><Plus size={17} />{translate("C\u1EA5p t\xE0i kho\u1EA3n m\u1EDBi")}</button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Search size={17} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={translate("Tìm theo tên hoặc email...")} />
        </div>
        <div className="select-box">
          <Filter size={15} />
          <select value={dept} onChange={e => setDept(e.target.value)}>
            <option value={ALL_DEPTS}>{translate(ALL_DEPTS)}</option>
            {departments.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="select-box">
          <SlidersHorizontal size={15} />
          <select value={role} onChange={e => setRole(e.target.value)}>
            <option value={ALL_ROLES}>{translate(ALL_ROLES)}</option>
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <button className="secondary-button" onClick={() => setModal("import")}><FileSpreadsheet size={16} /> Import Excel</button>
      </div>

      <div className="table-card">
        <div className="table-title">
          <div><b>{translate("Danh s\xE1ch nh\xE2n s\u1EF1")}</b><span>{filtered.length} / {users.length}{translate("t\xE0i kho\u1EA3n")}</span></div>
          <button className="ghost-button"><MoreHorizontal size={18} /></button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{translate("H\u1ECD t\xEAn")}</th>
                <th>{translate("Ch\u1EE9c v\u1EE5")}</th>
                <th>{translate("Ph\xF2ng ban")}</th>
                <th>Role</th>
                <th>{translate("Qu\u1EA3n l\xFD tr\u1EF1c ti\u1EBFp")}</th>
                <th>{translate("Tr\u1EA1ng th\xE1i")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <p>{users.length === 0 ? translate("Chưa có nhân sự nào. Bấm “Cấp tài khoản mới” để thêm.") : translate("Không có nhân sự phù hợp bộ lọc.")}</p>
                    </div>
                  </td>
                </tr>}
              {filtered.map(user => <tr key={user.id} className={user.status === "INACTIVE" ? "is-inactive" : ""}>
                  <td>
                    <div className="person-cell">
                      <Avatar initials={user.initials || getUserInitials(user.name)} tone={user.role === "HR_ADMIN" ? "purple" : user.role === "MANAGER" ? "blue" : "gray"} />
                      <div><b>{user.name}</b><span>{user.email}</span></div>
                    </div>
                  </td>
                  <td>{user.title}</td>
                  <td>{user.department}</td>
                  <td><span className={`role-badge ${roleClass[user.role] ?? ""}`}>{user.role}</span></td>
                  <td>{users.find(u => u.id === String(user.managerId))?.name || "—"}</td>
                  <td>
                    <button disabled={PROTECTED_ROLES.includes(user.role)} className={`status-toggle ${user.status === "ACTIVE" ? "on" : "off"}`} onClick={() => toggleStatus(user.id)}>
                      <span></span>{user.status === "ACTIVE" ? "Hoạt động" : "Đã khóa"}
                    </button>
                  </td>
                  <td><button className="secondary-button" disabled={PROTECTED_ROLES.includes(user.role)} onClick={() => setModal({
                  edit: user
                })}>{translate("Ch\u1EC9nh s\u1EEDa")}</button></td>
                </tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {(modal === "create" || modal?.edit) && <CreateModal initial={modal?.edit} users={users} departments={departments} onClose={() => setModal(null)} onCreate={async newUser => {
      try {
        const result = await apiRequest(modal?.edit ? `/hr/users/${modal.edit.id}` : '/hr/users', {
          method: modal?.edit ? 'PATCH' : 'POST',
          body: newUser
        });
        setUsers(rows => [{
          ...result.data,
          id: result.data._id
        }, ...rows.filter(u => u.id !== result.data._id)]);
        setModal(null);
        toast.success('Đã lưu thay đổi trên hệ thống.');
      } catch (error) {
        toast.error(error.message);
        throw error;
      }
    }} />}
      {modal === "import" && <HRImportModal users={users} onImported={u => setUsers(rows => [u, ...rows])} onClose={() => setModal(null)} />}
    </>;
}
function CreateModal({
  users,
  departments,
  onClose,
  onCreate,
  initial
}) {
  const { settings } = useSystemConfiguration();
  const {
    t: translate
  } = useAdminPreferences();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    title: "",
    department: "",
    role: "",
    managerId: "",
    ...initial
  });
  const [error, setError] = useState("");
  const set = key => e => setForm(f => ({
    ...f,
    [key]: e.target.value
  }));
  const managers = useMemo(() => users.filter(u => u.status === "ACTIVE" && MANAGER_ROLES.includes(u.role)), [users]);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const submit = async () => {
    if (saveLock.current) return;
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    if (!name || !email) return setError("Vui lòng nhập họ tên và email công ty.");
    if (!initial && !passwordMeetsPolicy(form.password, settings?.passwordPolicy)) return setError(translate('Mật khẩu chưa đáp ứng chính sách hiện hành.'));
    if (!form.role) return setError("Vui lòng chọn role được cấp.");
    if (!ASSIGNABLE_ROLES.includes(form.role)) return setError("ROLE_NOT_ALLOWED · HR_ADMIN không thể cấp role bảo vệ.");
    if (users.some(u => u.id !== initial?.id && u.email?.toLowerCase() === email)) return setError("EMAIL_EXISTS · Email đã tồn tại trong hệ thống.");
    const manager = managers.find(m => String(m.id) === form.managerId);
    saveLock.current = true;
    setSaving(true);
    try {
      await onCreate({
        password: form.password,
        name,
        email,
        title: form.title.trim(),
        department: form.department.trim(),
        role: form.role,
        manager: manager?.name ?? "—",
        managerId: manager?.id || null,
        status: initial?.status || "ACTIVE",
        initials: getUserInitials(name),
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      setError(error.message);
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };
  return <Modal title={initial ? "Chỉnh sửa nhân sự" : "Cấp tài khoản mới"} onClose={saving ? () => {} : onClose}>
      <div className="modal-note"><KeyRound size={16} /><span>{translate("T\xE0i kho\u1EA3n \u0111\u01B0\u1EE3c l\u01B0u tr\xEAn h\u1EC7 th\u1ED1ng. H\xE3y chuy\u1EC3n m\u1EADt kh\u1EA9u qua k\xEAnh ri\xEAng.")}</span></div>
      <div className="form-grid">
        <label>{translate("H\u1ECD t\xEAn")}<input value={form.name} onChange={set("name")} placeholder={translate("Nguyễn Văn A")} /></label>
        <label>{translate("Email c\xF4ng ty")}<input value={form.email} onChange={set("email")} placeholder="ten@flowrequest.vn" type="email" /></label>
        {!initial && <label>{translate("M\u1EADt kh\u1EA9u m\u1EB7c \u0111\u1ECBnh")}<input value={form.password} onChange={set("password")} placeholder={`${Math.max(8, settings?.passwordPolicy?.minLength || 8)}+`} type="password" /><small>{translate('Tuân theo chính sách mật khẩu hệ thống.')}</small></label>}
        <label>{translate("Ch\u1EE9c v\u1EE5")}<input value={form.title} onChange={set("title")} placeholder={translate("Chuyên viên...")} /></label>
        <label>{translate("Ph\xF2ng ban")}<input value={form.department} onChange={set("department")} placeholder={translate("Nhập hoặc chọn phòng ban")} list="department-options" />
          <datalist id="department-options">{departments.map(d => <option key={d} value={d} />)}</datalist>
        </label>
        <label>Role
          <select value={form.role} onChange={set("role")}>
            <option value="">{translate("Ch\u1ECDn role")}</option>
            {ASSIGNABLE_ROLES.map(r => <option key={r}>{r}</option>)}
            {["DIRECTOR", "HR_ADMIN"].map(r => <option key={r} disabled>{r}{translate("\xB7 do SYSTEM_ADMIN c\u1EA5p")}</option>)}
          </select>
        </label>
        <label className="full">{translate("Qu\u1EA3n l\xFD tr\u1EF1c ti\u1EBFp")}<select value={form.managerId} onChange={set("managerId")}>
            <option value="">{managers.length ? translate("Chọn quản lý") : translate("Chưa có quản lý nào")}</option>
            {managers.filter(m => m.id !== initial?.id).map(m => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}
          </select>
        </label>
      </div>
      {error && <div className="inline-error"><CircleAlert size={16} />{translate(error)}</div>}
      <div className="modal-actions">
        <button className="secondary-button" disabled={saving} onClick={onClose}>{translate("H\u1EE7y")}</button>
        <button className="primary-button" disabled={saving} onClick={submit}><Plus size={16} /> {saving ? translate('Đang lưu…') : initial ? translate('Lưu thay đổi') : translate('Cấp tài khoản')}</button>
      </div>
    </Modal>;
}
function HRAdminWorkspace({
  user,
  onLogout,
  initialUsers = EMPTY,
  initialApprovals = EMPTY,
  initialProcessed = EMPTY,
  security = null
}) {
  const {
    t: translate
  } = useAdminPreferences();
  const {
    theme,
    lang
  } = useAdminPreferences();
  const {
    pathname
  } = useLocation();
  const navigate = useNavigate();
  const [users, setUsers] = useState(initialUsers);
  const [approvals, setApprovals] = useState(initialApprovals);
  const [processed, setProcessed] = useState(initialProcessed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const refreshSequence = useRef(0);
  const reload = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const results = await Promise.allSettled([apiRequest('/hr/users'), apiRequest('/request')]);
    if (sequence !== refreshSequence.current) return;
    if (results[0].status === 'fulfilled') setUsers((results[0].value.data || []).map(u => ({
      ...u,
      id: u._id,
      status: u.status || 'ACTIVE'
    })));
    if (results[1].status === 'fulfilled') {
      const data = (results[1].value.data || []).filter(r => HR_TYPES[r.type] && r.status !== 'DRAFT');
      setRequests(data);
      setApprovals(data.filter(r => r.status === 'PENDING_HRADMIN').map(r => ({
        id: r._id,
        name: r.author?.name || '—',
        department: r.author?.department,
        type: r.type,
        approvedAt: r.updatedAt
      })));
      setProcessed(data.flatMap(r => (r.approvalHistory || []).filter(e => e.role === 'HR_ADMIN').map(e => ({
        ...e,
        id: e._id,
        processedAt: e.timestamp
      }))));
    }
    setLoadError(results.map((result, index) => result.status === 'rejected' ? `${index === 0 ? 'Danh sách nhân sự' : 'Danh sách đơn'}: ${result.reason.message}` : '').filter(Boolean).join(' '));
    setLoading(false);
  }, []);
  useEffect(() => {
    reload();
    const timer = window.setInterval(reload, 30000);
    return () => {
      refreshSequence.current++;
      window.clearInterval(timer);
    };
  }, [reload]);
  const active = pathname.includes("history") ? "history" : pathname.includes("users") ? "users" : pathname.includes("approvals") ? "approvals" : pathname.includes("permissions") ? "permissions" : "overview";
  const statCards = useMemo(() => buildStats({
    users,
    approvals,
    processed
  }), [users, approvals, processed]);
  return <>
      {/* data-role phải là "HR_Admin" để khớp [data-role="HR_Admin"] trong dashboard.css (phân biệt hoa thường) */}
      <div className="app-shell hr-admin-shell" data-role="HR_Admin" data-theme={theme} lang={lang}>
        <div className={`mobile-overlay ${mobileOpen ? "show" : ""}`} onClick={() => setMobileOpen(false)}></div>
        <div className={`sidebar-wrap ${mobileOpen ? "open" : ""}`}>
          <Sidebar onNavigate={() => setMobileOpen(false)} active={active} currentUser={user} pendingCount={approvals.length} onLogout={onLogout} />
        </div>
        <main className="main-area">
          <Header title={PAGE_TITLES[active][0]} subtitle={PAGE_TITLES[active][1]} onMenu={() => setMobileOpen(true)} currentUser={user} hasPending={approvals.length > 0} />
          <div className="content-wrap">
            <div className="hr-sync-bar"><span>{loading ? translate('Đang tải dữ liệu…') : loadError ? translate('Chưa tải đầy đủ dữ liệu') : translate('Dữ liệu đã cập nhật')}</span><button className="secondary-button" onClick={reload}>{translate("L\xE0m m\u1EDBi")}</button></div>
            {loadError && <div role="alert" className="inline-error">{loadError} <button onClick={reload}>{translate("Th\u1EED l\u1EA1i")}</button></div>}
            <Stats cards={statCards} />
            {active === "overview" && <Overview onNavigate={key => navigate(key === "users" ? "/hr/users" : "/hr/approvals")} approvals={approvals} security={security} currentUser={user} />}
            {active === "users" && <UsersPage users={users} setUsers={setUsers} />}
            {active === "approvals" && <HRRequestsPanel requests={requests} user={user} reload={reload} />}
            {active === "history" && <HRRequestsPanel requests={requests} user={user} reload={reload} history />}
            {active === "permissions" && <HRPermissionsPanel />}
          </div>
        </main>
      </div>
      <Toaster position="top-right" richColors />
    </>;
}
export default function HRAdminDashboard(props) {
  return <AdminPreferencesProvider><HRAdminWorkspace {...props} /></AdminPreferencesProvider>;
}
