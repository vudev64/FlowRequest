import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Cloud,
  Code2,
  Filter,
  Laptop,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  CalendarDays,
} from "lucide-react";

import { cn } from "../../../lib/utils";
import { statusClass, statusLabel, formatMonthYear } from "../EmployeeData";

const PAGE_SIZE = 5; // Đổi thành 10 hoặc 20 nếu muốn nhiều đơn mỗi trang.

function RequestTypeIcon({ type = "" }) {
  if (type.includes("Cloud")) return <Cloud size={15} />;
  if (type.includes("Thiết bị") || type.includes("Mua sắm")) return <Laptop size={15} />;
  if (type.includes("OT")) return <Clock3 size={15} />;
  if (type.includes("Nghỉ")) return <CalendarDays size={15} />;
  return <Code2 size={15} />;
}

export function StatCard({ icon, label, value, hint, tone, trend }) {
  return (
    <div className="stat-card">
      <div className={cn("stat-icon", tone)}>{icon}</div>
      <div className="stat-copy">
        <div className="stat-label">
          {label}
          {trend && <span className={cn("stat-trend", tone)}>{trend}</span>}
        </div>
        <div className="stat-value">{value}</div>
        <div className="stat-hint">{hint}</div>
      </div>
      <div className={cn("stat-accent", tone)} />
    </div>
  );
}

function RequestRow({ item, lang, onOpen, t }) {
  return (
    <tr className="request-row">
      <td>
        <button className="request-id" onClick={onOpen}>
          {item.id} <ArrowUpRight size={13} />
        </button>
        <span className="request-title">{item.title}</span>
      </td>
      <td>
        <div className="type-cell">
          <span className="type-icon"><RequestTypeIcon type={item.type} /></span>
          <span>{item.type}</span>
        </div>
      </td>
      <td><span className="date-cell">{item.createdAt}</span></td>
      <td><strong className="value-cell">{item.value}</strong></td>
      <td>
        <div className="approval-cell">
          <div className={cn("approval-progress", item.status === "Đã duyệt" && "complete")}>
            <span /><span /><span /><span /><span />
          </div>
          <span>{item.currentStep}</span>
        </div>
      </td>
      <td>
        <span className={cn("status-badge", statusClass(item.status))}>
          <span className="status-dot" />
          {statusLabel(item.status, lang)}
        </span>
      </td>
      <td><span className="updated-cell">{item.updatedAt}</span></td>
      <td>
        <button className="row-action" onClick={onOpen}>
          {t.detail} <ChevronRight size={14} />
        </button>
      </td>
    </tr>
  );
}

export default function RequestTable({
  requests = [], lang, t, onOpen, search = "", setSearch,
  typeFilter, setTypeFilter, statusFilter, setStatusFilter,
  requestTypeOptions = [], statusOptions = [], onCreate,
}) {
  const [currentPage, setCurrentPage] = useState(1);

  // Lọc trước rồi mới phân trang: không đếm các đơn bị ẩn bởi bộ lọc.
  const normalizedSearch = String(search ?? "").toLowerCase().trim();
  const filteredRequests = requests.filter((item) => {
    const matchesSearch = !normalizedSearch ||
      `${item.id ?? ""} ${item.title ?? ""} ${item.type ?? ""}`
        .toLowerCase().includes(normalizedSearch);
    const matchesType = !typeFilter || typeFilter === "Tất cả" || item.type === typeFilter;
    const matchesStatus = !statusFilter || statusFilter === "Tất cả" || item.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedRequests = filteredRequests.slice(startIndex, startIndex + PAGE_SIZE);

  // Reset khi thay bộ lọc; nếu dữ liệu giảm đột ngột, safePage tự kẹp trang hợp lệ.
  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, statusFilter]);

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("Tất cả");
    setStatusFilter("Tất cả");
    setCurrentPage(1);
  };

  // Với nhiều trang, chỉ hiện tối đa 5 số trang xung quanh trang hiện tại.
  const firstNumber = Math.max(1, Math.min(safePage - 2, totalPages - 4));
  const visiblePages = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => Math.max(1, firstNumber) + index
  );

  return (
    <>
      <div className="action-row">
        <div className="action-left">
          <button className="primary-button" onClick={onCreate}>
            <Plus size={17} strokeWidth={2.6} />{t.newRequest}
          </button>
          <span className="action-helper"><ShieldCheck size={14} />Secure approval workflow</span>
        </div>
        <div className="filter-cluster">
          <div className="filter-label"><Filter size={14} />Filter by</div>
          <div className="select-wrap">
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label={t.allTypes}>
              {requestTypeOptions.map((option) => (
                <option key={option} value={option}>{option === "Tất cả" ? t.allTypes : option}</option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>
          <div className="select-wrap">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label={t.allStatus}>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "Tất cả" ? t.allStatus : statusLabel(option, lang)}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-card-header">
          <div>
            <div className="table-kicker"><span className="live-pulse" />LIVE REQUESTS</div>
            <h2>{t.listTitle}</h2>
            <p>{requests.length} {lang === "vi" ? "đề xuất của bạn" : "requests"}</p>
          </div>
          <div className="table-header-actions">
            <button className="ghost-button" type="button">
              {formatMonthYear(new Date(), lang)}<ChevronDown size={13} />
            </button>
            <button className="icon-button bordered" type="button" aria-label="More actions">
              <MoreHorizontal size={17} />
            </button>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t.code}</th><th>{t.requestType}</th><th>{t.created}</th>
                <th>{t.amount}</th><th>{t.approval}</th><th>{t.state}</th>
                <th>{t.lastUpdate}</th><th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {paginatedRequests.map((item) => (
                <RequestRow
                  key={item.id} item={item} lang={lang}
                  onOpen={() => onOpen(item)} t={t}
                />
              ))}
            </tbody>
          </table>
        </div>

        {filteredRequests.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon"><Search size={20} /></div>
            <strong>{t.noResults}</strong>
            <span>{t.noResultsBody}</span>
            <button className="text-button" onClick={clearFilters}>
              {lang === "vi" ? "Xóa bộ lọc" : "Clear filters"}
            </button>
          </div>
        )}

        <div className="table-footer">
          <span>
            {filteredRequests.length === 0
              ? (lang === "vi" ? "Không có đơn phù hợp" : "No matching requests")
              : `${lang === "vi" ? "Hiển thị" : "Showing"} ${startIndex + 1}–${Math.min(startIndex + PAGE_SIZE, filteredRequests.length)} / ${filteredRequests.length} ${lang === "vi" ? "đơn" : "requests"}`}
          </span>

          <nav className="pagination" aria-label={lang === "vi" ? "Phân trang đề xuất" : "Request pagination"}>
            <button
              type="button" className="page-button" onClick={() => setCurrentPage(safePage - 1)}
              disabled={safePage === 1} aria-label={lang === "vi" ? "Trang trước" : "Previous page"}
            ><ChevronLeft size={14} /></button>

            {visiblePages.map((page) => (
              <button
                type="button" key={page}
                className={cn("page-button", safePage === page && "active")}
                onClick={() => setCurrentPage(page)}
                aria-current={safePage === page ? "page" : undefined}
                aria-label={`${lang === "vi" ? "Trang" : "Page"} ${page}`}
              >{page}</button>
            ))}

            <button
              type="button" className="page-button" onClick={() => setCurrentPage(safePage + 1)}
              disabled={safePage === totalPages} aria-label={lang === "vi" ? "Trang sau" : "Next page"}
            ><ChevronRight size={14} /></button>
          </nav>

          <span className="table-foot-note"><CircleHelp size={13} />Need help? Contact People Ops</span>
        </div>
      </div>
    </>
  );
}
