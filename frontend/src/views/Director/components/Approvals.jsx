import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Download, FileText, Paperclip } from 'lucide-react';
import { useDialogFocus } from './useDialogFocus';
import { useDirectorLanguage } from '../DirectorLanguage';
import {
  canDirectorDecide,
  categoryLabel,
  formatDate,
  formatMoney,
  getId,
  isDirectorPending,
  requestTypeLabel,
  roleLabel,
  statusLabel,
  textOf,
} from '../DirectorData';

const PER_PAGE = 6;

/* ---------- Helpers ---------- */

const requestCodeOf = (item) => item.requestCode || item.code;

const matchesQuery = (item, query) => {
  if (!query) return true;
  const fields = [
    item.requestCode,
    item.code,
    item.title,
    getId(item),
    textOf(item.author),
    textOf(item.department),
  ];
  return fields.some((value) => String(value || '').toLowerCase().includes(query));
};

const attachmentLabel = (attachment, fallback = 'Có file đính kèm') =>
  typeof attachment === 'string'
    ? attachment
    : attachment.originalName || attachment.filename || fallback;

/* ---------- Chi tiết đơn ---------- */

const DETAIL_LABELS = {
  deviceName: 'Thiết bị', quantity: 'Số lượng', unitPrice: 'Đơn giá',
  softwareName: 'Phần mềm', licenseCount: 'Số giấy phép', durationMonths: 'Thời hạn (tháng)',
  cloudProvider: 'Nhà cung cấp cloud', resourceType: 'Loại tài nguyên', configuration: 'Cấu hình', budgetCode: 'Mã ngân sách',
  attendanceDate: 'Ngày chấm công', actualCheckIn: 'Giờ vào thực tế', actualCheckOut: 'Giờ ra thực tế', workLocation: 'Địa điểm làm việc',
  fromDate: 'Từ ngày', toDate: 'Đến ngày', destination: 'Điểm đến', purpose: 'Mục đích',
  courseName: 'Khóa đào tạo', provider: 'Đơn vị đào tạo', position: 'Vị trí tuyển dụng', headcount: 'Số lượng tuyển', requestedDepartment: 'Bộ phận tuyển dụng',
  leaveType: 'Loại nghỉ phép', startDate: 'Bắt đầu nghỉ', endDate: 'Kết thúc nghỉ', dayPart: 'Buổi nghỉ', leaveDays: 'Số ngày nghỉ',
  projectName: 'Dự án', overtimeDate: 'Ngày tăng ca', overtimeStart: 'Bắt đầu tăng ca', overtimeEnd: 'Kết thúc tăng ca', overtimeHours: 'Số giờ tăng ca',
};
const ENUM_LABELS = { ANNUAL: 'Phép năm', SICK: 'Nghỉ ốm', PERSONAL: 'Việc riêng', UNPAID: 'Không lương', FULL: 'Cả ngày', AM: 'Buổi sáng', PM: 'Buổi chiều' };

function DetailStatus({ status }) {
  const { lang, t } = useDirectorLanguage();
  const tone = status === 'REJECTED' ? 'danger' : status === 'APPROVED' ? 'success' : !status || ['DRAFT', 'CANCELLED'].includes(status) ? 'muted' : 'pending';
  return <span className={`dir-detail-status dir-detail-status--${tone}`}>{status ? statusLabel(status, lang) : t('Xử lý')}</span>;
}

function DetailSection({ title, data }) {
  const { lang, t } = useDirectorLanguage();
  const entries = Object.entries(data || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (!entries.length) return null;
  function displayValue(key, value) {
    if (typeof value === 'object') return <pre className="dir-detail-raw">{JSON.stringify(value, null, 2)}</pre>;
    if (key === 'unitPrice') return formatMoney(value, lang);
    if (['leaveType', 'dayPart'].includes(key)) return ENUM_LABELS[value] ? t(ENUM_LABELS[value]) : String(value);
    if (/Date$/.test(key)) {
      const date = new Date(value);
      // These fields represent calendar dates entered on request forms.
      if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'vi-VN', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
    }
    if (typeof value === 'boolean') return t(value ? 'Có' : 'Không');
    return String(value);
  }
  return <section className="dir-detail-section">
    <h4>{t(title)}</h4>
    <dl className="dir-detail-fields">{entries.map(([key, value]) => <div key={key}><dt>{t(DETAIL_LABELS[key] || key)}</dt><dd>{displayValue(key, value)}</dd></div>)}</dl>
  </section>;
}

export function RequestDetail({ request, onDownload }) {
  const { lang, t } = useDirectorLanguage();
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const missing = t('Chưa cập nhật');
  const details = [
    ['Mã đơn', requestCodeOf(request) || getId(request), 'dir-detail-code'],
    ['Ngày tạo', formatDate(request.createdAt, lang)],
    ['Người tạo', textOf(request.author, missing)],
    ['Phòng ban', textOf(request.department, missing)],
    ['Loại đề xuất', requestTypeLabel(request.type, lang)],
    ...(request.type === 'PURCHASE' ? [['Danh mục', request.category ? categoryLabel(request.category, lang) : missing]] : []),
  ];
  const typedKeys = request.type === 'LEAVE'
    ? ['leaveType', 'startDate', 'endDate', 'dayPart', 'leaveDays']
    : request.type === 'OVERTIME'
      ? ['projectName', 'overtimeDate', 'overtimeStart', 'overtimeEnd', 'overtimeHours']
      : [];
  const typedDetails = Object.fromEntries(typedKeys.map(key => [key, request[key]]));
  const history = Array.isArray(request.approvalHistory) ? request.approvalHistory : [];
  const fileName = request.attachment ? attachmentLabel(request.attachment, t('Có file đính kèm')).split('/').at(-1) : '';
  async function downloadAttachment() {
    setDownloading(true); setDownloadError('');
    try { await onDownload(request); }
    catch (err) { setDownloadError(err.message || 'Không thể tải chứng từ.'); }
    finally { setDownloading(false); }
  }

  return <div className="dir-detail-content">
    <div className="dir-detail-overview">
      <div className="dir-detail-heading"><h3>{request.title || t('Chi tiết đơn')}</h3><DetailStatus status={request.status}/></div>
      <div className="dir-detail-amount"><span>{t('Số tiền')}</span><strong>{formatMoney(request.amount, lang)}</strong></div>
    </div>

    <section className="dir-detail-section" aria-label={t('Thông tin đề xuất')}>
      <dl className="dir-detail-grid">{details.map(([label, value, className]) => <div key={label}>
        <dt>{t(label)}</dt><dd className={value === missing ? 'dir-detail-missing' : className}>{value}</dd>
      </div>)}</dl>
    </section>

    <section className="dir-detail-section"><h4>{t('Nội dung đề xuất')}</h4><p className="dir-long-text">{request.content || t('Không có nội dung')}</p></section>
    <DetailSection title="Thông tin bổ sung" data={typedDetails}/>
    <DetailSection title="Thông tin mua sắm" data={request.purchaseDetails}/>
    <DetailSection title="Thông tin bổ sung" data={request.extraDetails}/>

    <section className="dir-detail-section">
      <h4>{t('Chứng từ đính kèm')}</h4>
      {request.attachment ? <div className="dir-detail-attachment">
        <FileText size={20} aria-hidden="true"/>
        <span className="dir-detail-filename">{fileName}</span>
        <button className="dir-btn dir-btn-outline" type="button" disabled={downloading || !onDownload} onClick={downloadAttachment} aria-label={t('Tải chứng từ: {name}', { name: fileName })}>
          <Download size={15} aria-hidden="true"/>{t(downloading ? 'Đang tải...' : 'Tải xuống')}
        </button>
      </div> : <p className="dir-detail-empty"><Paperclip size={16} aria-hidden="true"/>{t('Không có file đính kèm.')}</p>}
      {downloadError && <p className="dir-error" role="alert">{t(downloadError)}</p>}
    </section>

    <section className="dir-detail-section">
      <h4>{t('Lịch sử xử lý')}</h4>
      {history.length ? <ol className="dir-timeline">{history.map((entry, index) => <li key={entry._id || index}>
        <div className="dir-history-heading"><strong>{textOf(entry.approverId)}{entry.role ? ` (${roleLabel(entry.role, lang)})` : ''}</strong><DetailStatus status={entry.action}/></div>
        <time dateTime={entry.timestamp || entry.createdAt}>{formatDate(entry.timestamp || entry.createdAt, lang)}</time>
        {entry.fromStatus && entry.toStatus && <p className="dir-history-transition"><span>{statusLabel(entry.fromStatus, lang)}</span><ArrowRight size={12} aria-hidden="true"/><span>{statusLabel(entry.toStatus, lang)}</span></p>}
        {entry.comment && <blockquote className="dir-history-comment">{entry.comment}</blockquote>}
      </li>)}</ol> : <p className="dir-detail-empty">{t('Chưa có bản ghi lịch sử được API trả về.')}</p>}
    </section>
  </div>;
}

/* ---------- Khu vực ra quyết định ---------- */

function DecisionPanel({ comment, onCommentChange, error, decision, onDecisionChange, busy, onSubmit }) {
  const { t } = useDirectorLanguage();
  const isApprove = decision === 'APPROVED';

  return (
    <div className="dir-decision">
      <label htmlFor="dir-comment">{t('Ghi chú phê duyệt / lý do từ chối')}</label>
      <textarea
        id="dir-comment"
        className="dir-input"
        rows={3}
        value={comment}
        onChange={(e) => onCommentChange(e.target.value)}
        placeholder={t('Nhập ghi chú...')}
        disabled={busy}
      />

      {error && (
        <p role="alert" className="dir-error">
          {t(error)}
        </p>
      )}

      {!decision ? (
        <div className="dir-modal-actions">
          <button
            className="dir-btn dir-btn-danger"
            disabled={busy}
            onClick={() => onDecisionChange('REJECTED')}
          >
            {t('Từ chối')}
          </button>
          <button
            className="dir-btn dir-btn-primary"
            disabled={busy}
            onClick={() => onDecisionChange('APPROVED')}
          >
            {t('Phê duyệt bước Director')}
          </button>
        </div>
      ) : (
        <div className="dir-confirm">
          <p>
            {t(isApprove
              ? 'Xác nhận duyệt và chuyển sang bước tiếp theo của workflow?'
              : 'Xác nhận từ chối đơn này?')}
          </p>
          <div className="dir-modal-actions">
            <button
              className="dir-btn dir-btn-ghost"
              onClick={() => onDecisionChange('')}
              disabled={busy}
            >
              {t('Quay lại')}
            </button>
            <button
              className={`dir-btn ${isApprove ? 'dir-btn-primary' : 'dir-btn-danger'}`}
              onClick={onSubmit}
              disabled={busy || (decision === 'REJECTED' && !comment.trim())}
            >
              {t(busy ? 'Đang xử lý...' : 'Xác nhận')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Trang duyệt ---------- */

export default function Approvals({ requests, user, busy, onFetchDetail, onDecide, onDownload }) {
  const { lang, t } = useDirectorLanguage();
  // Danh sách: tìm kiếm + phân trang
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Modal chi tiết
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  // Quyết định
  const [comment, setComment] = useState('');
  const [decision, setDecision] = useState('');
  const [error, setError] = useState('');
  const detailSequence = useRef(0);
  const modalRef = useRef(null);
  const closeModal = () => { if (!busy) { detailSequence.current++; setSelectedId(''); } };
  useDialogFocus(modalRef, Boolean(selectedId), closeModal, busy);

  const pending = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests.filter(isDirectorPending).filter((item) => matchesQuery(item, query));
  }, [requests, search]);

  const totalPages = Math.max(1, Math.ceil(pending.length / PER_PAGE));
  const rows = pending.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function openDetail(item) {
    const id = getId(item);
    if (!id) return;
    const sequence = ++detailSequence.current;

    setSelectedId(id);
    setDetail(null);
    setComment('');
    setDecision('');
    setDetailError('');
    setError('');
    setDetailLoading(true);

    try {
      const record = await onFetchDetail(id);
      if (sequence === detailSequence.current) setDetail(record);
    } catch (err) {
      if (sequence === detailSequence.current) setDetailError(err.message || 'Không tải được chi tiết đơn.');
    } finally {
      if (sequence === detailSequence.current) setDetailLoading(false);
    }
  }

  async function submitDecision() {
    if (!detail || !decision || busy) return;

    if (decision === 'REJECTED' && !comment.trim()) {
      setError('Bắt buộc nhập lý do khi từ chối.');
      return;
    }
    if (!canDirectorDecide(detail, user)) {
      setError('Đơn không thuộc quyền phê duyệt ở bước Giám đốc.');
      return;
    }

    setError('');
    try {
      await onDecide(getId(detail), decision, comment.trim());
      setSelectedId('');
      setDetail(null);
      setDecision('');
    } catch (err) {
      setError(err.message || 'Xử lý thất bại.');
      if ([400, 403, 409].includes(err.status)) {
        try { setDetail(await onFetchDetail(getId(detail))); setDecision(''); }
        catch (detailErr) { setDetailError(detailErr.message || 'Không tải được chi tiết đơn.'); }
      }
    }
  }

  const renderModalBody = () => {
    if (detailLoading) return <p>{t('Đang tải chi tiết...')}</p>;
    if (detailError) {
      return (
        <p role="alert" className="dir-error">
          {t(detailError)}
        </p>
      );
    }
    if (!detail) return null;

    return (
      <>
        <RequestDetail request={detail} onDownload={onDownload} />
        {canDirectorDecide(detail, user) ? <DecisionPanel
          comment={comment}
          onCommentChange={setComment}
          error={error}
          decision={decision}
          onDecisionChange={setDecision}
          busy={busy}
          onSubmit={submitDecision}
        /> : <p className="dir-muted">{t('Đơn không thuộc quyền phê duyệt của bạn hoặc đã chuyển sang bước tiếp theo.')}</p>}
      </>
    );
  };

  return (
    <section className="dir-page" aria-labelledby="dir-approvals-title">
      {/* Tiêu đề trang */}
      <div className="dir-page-heading">
        <div>
          <span className="dir-eyebrow">{t('DUYỆT ĐÚNG THẨM QUYỀN')}</span>
          <h1 id="dir-approvals-title">{t('Đơn chờ Giám đốc')}</h1>
          <p>{t('Chỉ các đơn có trạng thái PENDING_DIRECTOR. Backend quyết định bước tiếp theo.')}</p>
        </div>
      </div>

      {/* Danh sách đề xuất */}
      <div className="dir-panel">
        <div className="dir-panel-head">
          <h2>
            {t('Danh sách đề xuất')} <span className="dir-count">{pending.length}</span>
          </h2>
          <input
            className="dir-input dir-search"
            placeholder={t('Tìm mã đơn, tên, phòng ban...')}
            aria-label={t('Tìm đề xuất')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="dir-table-wrap">
          <table className="dir-table">
            <thead>
              <tr>
                <th>{t('Mã đơn')}</th>
                <th>{t('Đề xuất')}</th>
                <th>{t('Người tạo')}</th>
                <th>{t('Phòng ban')}</th>
                <th>{t('Giá trị')}</th>
                <th>{t('Thao tác')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={getId(r)}>
                  <td>{requestCodeOf(r) || getId(r).slice(-8)}</td>
                  <td>
                    <strong>{r.title || t('Không có tiêu đề')}</strong>
                    <small>{requestTypeLabel(r.type, lang)}</small>
                  </td>
                  <td>{textOf(r.author)}</td>
                  <td>{textOf(r.department)}</td>
                  <td>{formatMoney(r.amount, lang)}</td>
                  <td>
                    <button
                      type="button"
                      className="dir-btn dir-btn-outline"
                      onClick={() => openDetail(r)}
                    >
                      {t('Xem & duyệt')}
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="dir-empty">
                    {t('Không có đơn phù hợp.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="dir-pagination">
          <span>
            {t('Trang {page}/{pages}', { page, pages: totalPages })}
          </span>
          <div>
            <button
              className="dir-btn dir-btn-ghost"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
            >
              {t('Trước')}
            </button>
            <button
              className="dir-btn dir-btn-ghost"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
            >
              {t('Sau')}
            </button>
          </div>
        </div>
      </div>

      {/* Modal chi tiết & phê duyệt */}
      {selectedId && (
        <div
          className="dir-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) closeModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('Chi tiết và phê duyệt đề xuất')}
            className="dir-modal"
            ref={modalRef}
            tabIndex={-1}
          >
            <div className="dir-modal-head">
              <strong>{t('Chi tiết đề xuất')}</strong>
              <button
                type="button"
                aria-label={t('Đóng')}
                className="dir-icon-btn"
                disabled={busy}
                onClick={closeModal}
              >
                ×
              </button>
            </div>
            <div className="dir-modal-body">{renderModalBody()}</div>
          </div>
        </div>
      )}
    </section>
  );
}
