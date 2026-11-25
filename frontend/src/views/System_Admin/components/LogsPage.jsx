import { systemTimeZone } from "../../../lib/systemConfiguration";
import { useAdminPreferences } from "../../AdminPreferences";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileClock, Filter, RefreshCw, Search } from 'lucide-react';
import { ACTION_LABELS, formatDateTime, formatDateShort, LOG_ACTION_OPTIONS, ROLE_LABELS, systemAdminApi as apiClient } from '../SystemAdminData.js';
import { Badge, Button, EmptyState, ErrorState, LoadingRows, Modal, PageHeader } from './AdminShared.jsx';

// ==========================================
// 1. LOG FILTERS
// ==========================================

const INITIAL_FILTERS = {
  search: '',
  action: '',
  result: '',
  from: '',
  to: '',
  page: 1
};

// ==========================================
// 2. LOG FILTER COMPONENT
// ==========================================

function LogFilters({
  filters,
  onUpdate,
  onClear
}) {
  const {
    t: translate
  } = useAdminPreferences();
  return <div className="filter-card">
      <div className="filter-title">
        <Filter size={17} />
        <strong>{translate("B\u1ED9 l\u1ECDc nh\u1EADt k\xFD")}</strong>
        <span>{translate("L\u1ECDc ph\xEDa server")}</span>
      </div>

      <div className="filter-grid">

        {/* Search */}
        <label className="search-field">
          <span>{translate("T\xECm ki\u1EBFm")}</span>

          <div className="input-icon">
            <Search size={16} />

            <input value={filters.search} onChange={event => onUpdate('search', event.target.value)} placeholder={translate("Người thực hiện, đối tượng, IP...")} />
          </div>
        </label>

        {/* Action Filter */}
        <label>
          <span>{translate("H\xE0nh \u0111\u1ED9ng")}</span>

          <select value={filters.action} onChange={event => onUpdate('action', event.target.value)}>
            <option value="">{translate("T\u1EA5t c\u1EA3 h\xE0nh \u0111\u1ED9ng")}</option>

            {LOG_ACTION_OPTIONS.map(option => <option key={option.value} value={option.value}>
                {translate(option.label)}
              </option>)}
          </select>
        </label>

        {/* Result Filter */}
        <label>
          <span>{translate("K\u1EBFt qu\u1EA3")}</span>

          <select value={filters.result} onChange={event => onUpdate('result', event.target.value)}>
            <option value="">{translate("T\u1EA5t c\u1EA3 k\u1EBFt qu\u1EA3")}</option>
            <option value="SUCCESS">{translate("Th\xE0nh c\xF4ng")}</option>
            <option value="FAIL">{translate("Th\u1EA5t b\u1EA1i")}</option>
          </select>
        </label>

        {/* Date Filters */}
        <label>
          <span>{translate("T\u1EEB ng\xE0y")}</span>

          <input type="date" value={filters.from} onChange={event => onUpdate('from', event.target.value)} />
        </label>

        <label>
          <span>{translate("\u0110\u1EBFn ng\xE0y")}</span>

          <input type="date" value={filters.to} onChange={event => onUpdate('to', event.target.value)} />
        </label>

        {/* Clear Filters */}
        <Button variant="ghost" onClick={onClear}>{translate("X\xF3a b\u1ED9 l\u1ECDc")}</Button>

      </div>
    </div>;
}

// ==========================================
// 3. LOG TABLE ROW
// ==========================================

function LogTableRow({
  log,
  onSelect
}) {
  const {
    t: translate
  } = useAdminPreferences();
  const actorInitials = log.actorName.split(' ').slice(-2).map(part => part[0]).join('');
  return <tr className="clickable-row" onClick={() => onSelect(log)} tabIndex="0" onKeyDown={event => {
    if (event.key === 'Enter') {
      onSelect(log);
    }
  }}>
      {/* Timestamp */}
      <td>
        <div className="cell-primary">
          {formatDateShort(log.createdAt)}
        </div>

        <div className="cell-secondary">
          {new Intl.DateTimeFormat('vi-VN', {
          timeStyle: 'short',
          timeZone: systemTimeZone()
        }).format(new Date(log.createdAt))}
        </div>
      </td>

      {/* Actor */}
      <td>
        <div className="actor-cell">
          <div className="avatar avatar-small">
            {actorInitials}
          </div>

          <div>
            <div className="cell-primary">
              {log.actorName}
            </div>

            <div className="cell-secondary">
              {translate(ROLE_LABELS[log.actorRole] || log.actorRole)}
            </div>
          </div>
        </div>
      </td>

      {/* Action */}
      <td>
        <span className="action-label">
          <span className="action-mark" />

          {translate(ACTION_LABELS[log.action] || log.action)}
        </span>
      </td>

      {/* Target */}
      <td>
        <span className="target-cell">
          {log.target}
        </span>
      </td>

      {/* IP */}
      <td>
        <code>{log.ip}</code>
      </td>

      {/* Result */}
      <td>
        <Badge tone={log.result === 'SUCCESS' ? 'success' : 'danger'} dot>
          {log.result === 'SUCCESS' ? translate('Thành công') : translate('Thất bại')}
        </Badge>
      </td>
    </tr>;
}

// ==========================================
// 4. LOG TABLE
// ==========================================

function LogTable({
  data,
  onSelect
}) {
  const {
    t: translate
  } = useAdminPreferences();
  if (!data) {
    return <LoadingRows columns={6} />;
  }
  if (data.items.length === 0) {
    return <EmptyState icon={FileClock} title={translate("Không tìm thấy nhật ký phù hợp")} description={translate("Thử điều chỉnh bộ lọc hoặc xóa bộ lọc để xem lại toàn bộ dữ liệu.")} />;
  }
  return <div className="table-wrap">
      <table className="logs-table">
        <thead>
          <tr>
            <th>{translate("Th\u1EDDi gian")}</th>
            <th>{translate("Ng\u01B0\u1EDDi th\u1EF1c hi\u1EC7n")}</th>
            <th>{translate("H\xE0nh \u0111\u1ED9ng")}</th>
            <th>{translate("\u0110\u1ED1i t\u01B0\u1EE3ng")}</th>
            <th>IP</th>
            <th>{translate("K\u1EBFt qu\u1EA3")}</th>
          </tr>
        </thead>

        <tbody>
          {data.items.map(log => <LogTableRow key={log.id} log={log} onSelect={onSelect} />)}
        </tbody>
      </table>
    </div>;
}

// ==========================================
// 5. LOG PAGINATION
// ==========================================

function LogPagination({
  data,
  onChangePage
}) {
  const {
    t: translate
  } = useAdminPreferences();
  return <div className="pagination">
      <span>{translate("Trang")}{data?.page || 1}/{data?.totalPages || 1}
        {' '}
        <em>·</em>
        {' '}
        {data?.total || 0}{translate("b\u1EA3n ghi")}</span>

      <div>
        <button className="icon-button" disabled={!data || data.page <= 1} onClick={() => onChangePage(-1)} aria-label={translate("Trang trước")}>
          <ChevronLeft size={17} />
        </button>

        <button className="icon-button" disabled={!data || data.page >= data.totalPages} onClick={() => onChangePage(1)} aria-label="Trang sau">
          <ChevronRight size={17} />
        </button>
      </div>
    </div>;
}

// ==========================================
// 6. LOG DETAIL MODAL
// ==========================================

function LogDetailModal({
  log,
  onClose
}) {
  const {
    t: translate
  } = useAdminPreferences();
  if (!log) return null;
  return <Modal title={translate("Chi tiết nhật ký")} eyebrow={ACTION_LABELS[log.action] || log.action} onClose={onClose} width="720px" footer={<Button variant="secondary" onClick={onClose}>{translate("\u0110\xF3ng")}</Button>}>
      <div className="log-detail-grid">

        {/* Timestamp */}
        <div>
          <span className="detail-label">{translate("Th\u1EDDi gian")}</span>
          <strong>{formatDateTime(log.createdAt)}</strong>
        </div>

        {/* Result */}
        <div>
          <span className="detail-label">{translate("K\u1EBFt qu\u1EA3")}</span>

          <Badge tone={log.result === 'SUCCESS' ? 'success' : 'danger'} dot>
            {log.result === 'SUCCESS' ? translate('Thành công') : translate('Thất bại')}
          </Badge>
        </div>

        {/* Actor */}
        <div>
          <span className="detail-label">{translate("Ng\u01B0\u1EDDi th\u1EF1c hi\u1EC7n")}</span>
          <strong>{log.actorName}</strong>

          <span className="cell-secondary">
            {translate(ROLE_LABELS[log.actorRole] || log.actorRole)}
          </span>
        </div>

        {/* IP and Device */}
        <div>
          <span className="detail-label">{translate("IP / Thi\u1EBFt b\u1ECB")}</span>
          <strong>{log.ip}</strong>

          <span className="cell-secondary">
            {log.userAgent}
          </span>
        </div>

        {/* Target */}
        <div className="detail-full">
          <span className="detail-label">{translate("\u0110\u1ED1i t\u01B0\u1EE3ng")}</span>
          <strong>{log.target}</strong>
        </div>

        {/* Old Value */}
        <div className="json-block">
          <div className="json-title">{translate("Gi\xE1 tr\u1ECB c\u0169")}</div>

          <pre>
            {JSON.stringify(log.oldValue ?? '—', null, 2)}
          </pre>
        </div>

        {/* New Value */}
        <div className="json-block">
          <div className="json-title">{translate("Gi\xE1 tr\u1ECB m\u1EDBi")}</div>

          <pre>
            {JSON.stringify(log.newValue ?? '—', null, 2)}
          </pre>
        </div>

      </div>
    </Modal>;
}

// ==========================================
// 7. LOG PAGE
// ==========================================

export function LogsPage({
  notify
}) {
  const {
    t: translate
  } = useAdminPreferences();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState(null);
  const loadSequence = useRef(0);

  // ----------------------------------------
  // Load Logs
  // ----------------------------------------

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setError(false);
    setData(null);
    try {
      const result = await apiClient.getLogs(filters);
      if (sequence === loadSequence.current) setData(result);
    } catch (error) {
      if (sequence === loadSequence.current) setError(error.message);
    }
  }, [filters]);
  useEffect(() => {
    const timeout = setTimeout(load, 260);
    return () => {
      clearTimeout(timeout);
      loadSequence.current++;
    };
  }, [load]);

  // ----------------------------------------
  // Filter Handlers
  // ----------------------------------------

  const updateFilter = (key, value) => {
    setFilters(current => ({
      ...current,
      [key]: value,
      page: 1
    }));
  };
  const clearFilters = () => {
    setFilters({
      ...INITIAL_FILTERS
    });
  };

  // ----------------------------------------
  // Pagination Handler
  // ----------------------------------------

  const changePage = direction => {
    setFilters(current => ({
      ...current,
      page: current.page + direction
    }));
  };

  // ========================================
  // Render
  // ========================================

  return <>
      {/* Page Header */}
      <PageHeader eyebrow={translate("Nhật ký hệ thống")} title={translate("Nhật ký hệ thống")} description={translate("Theo dõi các thao tác và sự kiện bảo mật trong toàn bộ hệ thống.")} meta={<>
            <span className="meta-dot" />
            {' '}{translate("Ch\u1EC9 xem: kh\xF4ng th\u1EC3 s\u1EEDa ho\u1EB7c x\xF3a log")}<span className="meta-separator">•</span>{translate("M\u1EDBi nh\u1EA5t tr\u01B0\u1EDBc")}</>} actions={<Button variant="secondary" icon={RefreshCw} onClick={load}>{translate("L\xE0m m\u1EDBi")}</Button>} />

      {/* Filters */}
      <LogFilters filters={filters} onUpdate={updateFilter} onClear={clearFilters} />

      {/* Log Table */}
      <div className="section-card log-card">

        <div className="table-toolbar">
          <div>
            <strong>
              {data ? `${data.total} bản ghi` : translate('Đang tải bản ghi')}
            </strong>

            <span>{translate("\xB7 C\xE1c thao t\xE1c m\u1EDBi nh\u1EA5t")}</span>
          </div>

          <div className="toolbar-view">
            <span className="live-dot" />{translate("C\u1EADp nh\u1EADt theo th\u1EDDi gian th\u1EF1c")}</div>
        </div>

        {error ? <ErrorState onRetry={load} message={error} /> : <LogTable data={data} onSelect={setSelected} />}

        {/* Pagination */}
        <LogPagination data={data} onChangePage={changePage} />

      </div>

      {/* Log Details */}
      <LogDetailModal log={selected} onClose={() => setSelected(null)} />
    </>;
}
