import React, { useMemo, useState } from 'react';
import { calendarDay, formatMoney, isDirectorPending, isPurchase, monthlyPurchases, textOf } from '../DirectorData';
import { useDirectorLanguage } from '../DirectorLanguage';
import MonthlyPurchaseChart from './MonthlyPurchaseChart';

const TOP_DEPARTMENTS = 6;

/* ---------- Helpers ---------- */

const amountOf = (request) => Number(request.amount) || 0;

const sumAmount = (list) => list.reduce((sum, r) => sum + amountOf(r), 0);

// Tổng tiền mua sắm đã duyệt theo phòng ban, sắp xếp giảm dần
const approvedByDepartment = (approvedPurchases) => {
  const totals = new Map();
  approvedPurchases.forEach((r) => {
    const dept = textOf(r.department, '');
    totals.set(dept, (totals.get(dept) || 0) + amountOf(r));
  });
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_DEPARTMENTS);
};

const buildSummary = (requests) => {
  const pending = requests.filter(isDirectorPending);
  const purchases = requests.filter(isPurchase);
  const approvedPurchases = purchases.filter((r) => r.status === 'APPROVED');

  const approvedCount = requests.filter((r) => r.status === 'APPROVED').length;
  const rejectedCount = requests.filter((r) => r.status === 'REJECTED').length;
  const decidedCount = approvedCount + rejectedCount;

  return {
    pendingCount: pending.length,
    pendingAmount: sumAmount(pending.filter(isPurchase)),
    approvedAmount: sumAmount(approvedPurchases),
    approvalRate: decidedCount ? `${Math.round((approvedCount / decidedCount) * 100)}%` : '—',
    byDept: approvedByDepartment(approvedPurchases),
  };
};

/* ---------- Component ---------- */

export default function Overview({
  requests,
  onNavigate,
  analytics,
  dataScope = 'Các đơn thuộc quyền truy cập của Giám đốc',
}) {
  const { lang, t } = useDirectorLanguage();
  const summary = useMemo(() => buildSummary(requests), [requests]);
  const currentYear = calendarDay(new Date()).slice(0, 4);
  const [selectedYear, setSelectedYear] = useState('');
  const year = selectedYear || currentYear;
  const years = [...new Set([
    currentYear,
    ...requests.filter(isPurchase).filter(r => !['DRAFT', 'CANCELLED'].includes(r.status))
      .map(r => calendarDay(r.createdAt).slice(0, 4)).filter(Boolean),
    // Keep an explicit selection through refreshes and calendar-year changes.
    ...(selectedYear ? [selectedYear] : []),
  ])].sort((a, b) => Number(b) - Number(a));
  const months = monthlyPurchases(requests, year);

  const max = Math.max(1, ...summary.byDept.map(([, value]) => value));
  const paidAmount = analytics?.paidAmount ?? analytics?.totalPaidAmount;
  const budgets = Array.isArray(analytics?.budgets) ? analytics.budgets : [];

  const stats = [
    {
      label: 'Đơn chờ Giám đốc',
      value: summary.pendingCount,
      note: 'Trạng thái PENDING_DIRECTOR',
    },
    {
      label: 'Giá trị mua sắm chờ duyệt',
      value: formatMoney(summary.pendingAmount, lang),
      note: 'Trong danh sách đã tải',
    },
    {
      label: 'Mua sắm đã phê duyệt',
      value: formatMoney(summary.approvedAmount, lang),
      note: 'Không đồng nghĩa đã thanh toán',
    },
    {
      label: 'Tỷ lệ đơn được duyệt',
      value: summary.approvalRate,
      note: 'APPROVED / (APPROVED + REJECTED)',
    },
  ];

  return (
    <section className="dir-page" aria-labelledby="dir-overview-title">
      {/* Tiêu đề trang */}
      <div className="dir-page-heading">
        <div>
          <span className="dir-eyebrow">{t('BAN GIÁM ĐỐC')}</span>
          <h1 id="dir-overview-title">{t('Tổng quan điều hành')}</h1>
          <p>{t('Thống kê từ dữ liệu được Backend cấp quyền truy cập.')}</p>
        </div>
        <button
          className="dir-btn dir-btn-primary"
          type="button"
          onClick={() => onNavigate('approvals')}
        >
          {t('Xem đơn chờ duyệt →')}
        </button>
      </div>

      {/* Thống kê nhanh */}
      <div className="dir-stats-grid">
        {stats.map(({ label, value, note }) => (
          <div className="dir-stat" key={label}>
            <span>{t(label)}</span>
            <strong>{value}</strong>
            <small>{t(note)}</small>
          </div>
        ))}
      </div>

      <div className="dir-two-col">
        {/* Chi tiêu theo phòng ban */}
        <section className="dir-panel">
          <div className="dir-panel-head">
            <h2>{t('Chi tiêu được phê duyệt theo phòng ban')}</h2>
            <span className="dir-muted">{t('VNĐ')}</span>
          </div>

          {summary.byDept.length ? (
            <div className="dir-bars">
              {summary.byDept.map(([dept, value]) => (
                <div className="dir-bar-row" key={dept}>
                  <div className="dir-bar-label">
                    <strong>{dept || t('Chưa xác định')}</strong>
                    <span>{formatMoney(value, lang)}</span>
                  </div>
                  <div className="dir-bar-track">
                    <div className="dir-bar-fill" style={{ width: `${(value / max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="dir-empty">{t('Chưa có đơn mua sắm hoàn tất để thống kê.')}</p>
          )}
        </section>

        {/* Ngân sách và thanh toán */}
        <section className="dir-panel">
          <div className="dir-panel-head">
            <h2>{t('Thông tin ngân sách và thanh toán')}</h2>
          </div>

          <div className="dir-info-row">
            <span>{t('Giá trị tài chính đã duyệt')}</span>
            <strong>{analytics?.approvedAmount == null ? t('Chưa có dữ liệu') : formatMoney(analytics.approvedAmount, lang)}</strong>
          </div>
          <div className="dir-info-row">
            <span>{t('Số tiền thực tế đã thanh toán')}</span>
            <strong>{paidAmount == null ? t('Chưa có dữ liệu') : formatMoney(paidAmount, lang)}</strong>
          </div>
          <div className="dir-info-row"><span>{t('Còn phải thanh toán')}</span><strong>{analytics?.outstandingAmount == null ? t('Chưa có dữ liệu') : formatMoney(analytics.outstandingAmount, lang)}</strong></div>
          <p className="dir-muted">
            {t('Thực trả được tổng hợp từ lịch sử thanh toán có chứng từ. Phạm vi gồm các đơn mua sắm, công tác và đào tạo bạn được quyền xem; không suy ra tiền đã trả từ trạng thái APPROVED.')}
          </p>
          {budgets.map(budget => <div className="dir-info-row" key={budget.id}><span>{budget.name}<small className="dir-muted"> · {t('Ngân sách còn khả dụng')}</small></span><strong>{formatMoney(budget.availableAmount, lang)}<small className="dir-muted"> / {formatMoney(budget.allocatedAmount, lang)}</small></strong></div>)}
          <div className="dir-info-row">
            <span>{t('Phạm vi số liệu ở trên')}</span>
            <strong>{t(dataScope)}</strong>
          </div>
        </section>
      </div>

      <section className="dir-panel" aria-labelledby="dir-monthly-title">
        <div className="dir-panel-head dir-monthly-header">
          <h2 id="dir-monthly-title">{t('So sánh giá trị mua sắm theo tháng')}</h2>
          <label className="dir-monthly-year-filter" htmlFor="dir-monthly-year">
            <span>{t('Năm')}</span>
            <select id="dir-monthly-year" className="dir-input" aria-label={t('Năm thống kê mua sắm')} value={year} onChange={event => setSelectedYear(event.target.value)}>
              {years.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>
        <MonthlyPurchaseChart key={year} months={months} year={year}/>
        {!months.some(month => month.count) && <p className="dir-empty">{t('Chưa có đơn mua sắm để so sánh theo tháng.')}</p>}
        <p className="dir-muted dir-monthly-chart-note">{t('Theo tháng tạo đơn và trạng thái hiện tại, trong phạm vi được cấp quyền. Tổng đề xuất không gồm nháp hoặc đơn đã hủy; đã duyệt là trạng thái APPROVED, chưa phải tiền đã thanh toán.')}</p>
      </section>
    </section>
  );
}
