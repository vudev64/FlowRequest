import React, { useMemo, useState } from 'react';
import { calendarDay, formatDate, formatMoney, getId, STATUS_LABEL, statusLabel, textOf } from '../DirectorData';
import { useDirectorLanguage } from '../DirectorLanguage';

const PER_PAGE = 8;

/* ---------- Helpers ---------- */

const matchesFilters = (request, { status, department, dateFrom, dateTo }) => {
  const day = calendarDay(request.createdAt);

  if (status !== 'ALL' && request.status !== status) return false;
  if (department !== 'ALL' && textOf(request.department) !== department) return false;
  if (dateFrom && (!day || day < dateFrom)) return false;
  if (dateTo && (!day || day > dateTo)) return false;
  return true;
};

const byNewest = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);

/* ---------- Component ---------- */

export default function Reports({ requests, onView }) {
  const { lang, t } = useDirectorLanguage();
  // Bộ lọc
  const [status, setStatus] = useState('ALL');
  const [department, setDepartment] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Phân trang
  const [page, setPage] = useState(1);

  const departments = useMemo(
    () => [...new Set(requests.map((r) => textOf(r.department)))].sort(),
    [requests]
  );

  const rows = useMemo(() => {
    const filters = { status, department, dateFrom, dateTo };
    return requests.filter((r) => matchesFilters(r, filters)).sort(byNewest);
  }, [requests, status, department, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const visible = rows.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  // Đổi bộ lọc thì quay về trang 1
  const updateFilter = (setter, value) => {
    setter(value);
    setPage(1);
  };

  return (
    <section className="dir-page" aria-labelledby="dir-reports-title">
      {/* Tiêu đề trang */}
      <div className="dir-page-heading">
        <div>
          <span className="dir-eyebrow">{t('PHÂN TÍCH ĐIỀU HÀNH')}</span>
          <h1 id="dir-reports-title">{t('Báo cáo & lịch sử')}</h1>
          <p>{t('Bộ lọc theo dữ liệu được API trả về; không thay thế báo cáo tài chính toàn công ty.')}</p>
        </div>
      </div>

      <div className="dir-panel">
        {/* Bộ lọc */}
        <div className="dir-filters">
          <label>
            {t('Trạng thái')}
            <select
              className="dir-input"
              value={status}
              onChange={(e) => updateFilter(setStatus, e.target.value)}
            >
              <option value="ALL">{t('Tất cả')}</option>
              {Object.keys(STATUS_LABEL).map(key => (
                <option key={key} value={key}>
                  {statusLabel(key, lang)}
                </option>
              ))}
            </select>
          </label>

          <label>
            {t('Phòng ban')}
            <select
              className="dir-input"
              value={department}
              onChange={(e) => updateFilter(setDepartment, e.target.value)}
            >
              <option value="ALL">{t('Tất cả')}</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <label>
            {t('Từ ngày')}
            <input
              className="dir-input"
              type="date"
              value={dateFrom}
              onChange={(e) => updateFilter(setDateFrom, e.target.value)}
            />
          </label>

          <label>
            {t('Đến ngày')}
            <input
              className="dir-input"
              type="date"
              value={dateTo}
              onChange={(e) => updateFilter(setDateTo, e.target.value)}
            />
          </label>
        </div>

        {/* Bảng đơn */}
        <div className="dir-table-wrap">
          <table className="dir-table">
            <thead>
              <tr>
                <th>{t('Đơn')}</th>
                <th>{t('Người tạo')}</th>
                <th>{t('Phòng ban')}</th>
                <th>{t('Giá trị')}</th>
                <th>{t('Trạng thái')}</th>
                <th>{t('Ngày tạo')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={getId(r)}>
                  <td>
                    <strong>{r.title || '—'}</strong>
                    <small>{r.requestCode || r.code || getId(r).slice(-8)}</small>
                    <button className="dir-btn dir-btn-outline" type="button" onClick={() => onView(getId(r))}>{t('Xem chi tiết & lịch sử')}</button>
                  </td>
                  <td>{textOf(r.author)}</td>
                  <td>{textOf(r.department)}</td>
                  <td>{formatMoney(r.amount, lang)}</td>
                  <td>
                    <span className="dir-pill">{statusLabel(r.status, lang)}</span>
                  </td>
                  <td>{formatDate(r.createdAt, lang)}</td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={6} className="dir-empty">
                    {t('Không có dữ liệu phù hợp.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        <div className="dir-pagination">
          <span>
            {t('{count} đơn · Trang {page}/{pages}', { count: rows.length, page: currentPage, pages: totalPages })}
          </span>
          <div>
            <button
              className="dir-btn dir-btn-ghost"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t('Trước')}
            </button>
            <button
              className="dir-btn dir-btn-ghost"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('Sau')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
