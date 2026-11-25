import { useEffect, useId, useRef, useState } from 'react';
import { formatMoney } from '../DirectorData';
import { useDirectorLanguage } from '../DirectorLanguage';
import './MonthlyPurchaseChart.css';

export default function MonthlyPurchaseChart({ months, year }) {
  const { lang, t } = useDirectorLanguage();
  const id = useId();
  const stage = useRef(null);
  const groups = useRef([]);
  const [active, setActive] = useState(null);
  const maximum = Math.max(0, ...months.flatMap(month => [month.proposed, month.approved]));
  const magnitude = maximum ? 10 ** Math.floor(Math.log10(maximum / 4)) : 1;
  const step = [1, 2, 2.5, 5, 10].map(value => value * magnitude).find(value => value >= maximum / 4) || magnitude;
  const ceiling = maximum ? step * 4 : 1;
  const compact = new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'vi-VN', { notation: 'compact', maximumFractionDigits: 1 });
  const monthNames = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'vi-VN', { month: 'short', timeZone: 'UTC' });
  const selected = active ? months[active.index] : null;
  const tooltipOpen = Boolean(active);

  useEffect(() => {
    if (!tooltipOpen) return;
    const closeOutside = event => { if (!stage.current?.contains(event.target)) setActive(null); };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [tooltipOpen]);

  function showMonth(index, target) {
    const bounds = stage.current.getBoundingClientRect();
    const group = target.getBoundingClientRect();
    const tooltipWidth = Math.min(260, bounds.width - 16);
    const left = Math.max(8, Math.min(bounds.width - tooltipWidth - 8, group.left + group.width / 2 - bounds.left - tooltipWidth / 2));
    setActive({ index, left });
  }

  function navigateMonth(event, index) {
    const next = { ArrowLeft: (index + months.length - 1) % months.length, ArrowRight: (index + 1) % months.length, Home: 0, End: months.length - 1 }[event.key];
    if (next !== undefined) { event.preventDefault(); groups.current[next]?.focus(); }
    if (event.key === 'Escape') { event.preventDefault(); setActive(null); }
  }

  return <figure className="dir-monthly-chart" aria-labelledby={`${id}-caption`}>
    <figcaption className="dir-chart-sr-only" id={`${id}-caption`}>{t('Giá trị đề xuất và giá trị đã duyệt — năm {year} (VNĐ)', { year })}</figcaption>
    <div className="dir-monthly-legend">
      <span><i className="dir-monthly-swatch dir-monthly-proposed" aria-hidden="true"/>{t('Tổng đề xuất')}</span>
      <span><i className="dir-monthly-swatch dir-monthly-approved" aria-hidden="true"/>{t('Đã duyệt')}</span>
      <small>{t('VNĐ')}</small>
    </div>
    <div className="dir-chart-sr-only" id={`${id}-instructions`}>{t('Dùng phím mũi tên để chuyển tháng, Escape để đóng tooltip.')}</div>
    <div className="dir-monthly-stage" ref={stage} onPointerLeave={() => {
      if (!groups.current.includes(document.activeElement)) setActive(null);
    }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setActive(null); }}>
      <div className="dir-monthly-scroll" tabIndex={0} role="region" aria-label={t('Biểu đồ mua sắm 12 tháng')}>
        <div className="dir-monthly-canvas">
          <div className="dir-monthly-plot">
            <div className="dir-monthly-grid" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <div className="dir-monthly-gridline" key={index} style={{ bottom: `${index * 25}%` }}>
              <span>{maximum || index === 0 ? compact.format(ceiling * index / 4) : ''}</span>
            </div>)}</div>
            <div className="dir-monthly-groups">{months.map((month, index) => <button
              key={month.month}
              ref={node => { groups.current[index] = node; }}
              className={`dir-monthly-group${active?.index === index ? ' is-active' : ''}`}
              type="button"
              aria-label={`${t('Tháng {month}', { month: month.month })} ${year}. ${t('Tổng đề xuất')}: ${formatMoney(month.proposed, lang)}. ${t('Đã duyệt')}: ${formatMoney(month.approved, lang)}.`}
              aria-describedby={active?.index === index ? `${id}-tooltip` : `${id}-instructions`}
              onPointerEnter={event => { if (event.pointerType !== 'touch') showMonth(index, event.currentTarget); }}
              onFocus={event => showMonth(index, event.currentTarget)}
              onClick={event => showMonth(index, event.currentTarget)}
              onKeyDown={event => navigateMonth(event, index)}
            >
              <span className="dir-monthly-bar dir-monthly-proposed" style={{ height: `${month.proposed / ceiling * 100}%` }} aria-hidden="true"/>
              <span className="dir-monthly-bar dir-monthly-approved" style={{ height: `${month.approved / ceiling * 100}%` }} aria-hidden="true"/>
              <span className="dir-monthly-month dir-monthly-full-month" aria-hidden="true">{monthNames.format(new Date(Date.UTC(Number(year), month.month - 1, 1)))}</span>
              <span className="dir-monthly-month dir-monthly-compact-month" aria-hidden="true">{month.month}</span>
            </button>)}</div>
          </div>
          <span className="dir-monthly-axis-label" aria-hidden="true">{t('Tháng')}</span>
        </div>
      </div>
      {selected && <div className="dir-monthly-tooltip" role="tooltip" id={`${id}-tooltip`} style={{ '--dir-tooltip-left': `${active.left}px` }}>
        <strong>{t('Tháng {month}', { month: selected.month })} {year}</strong>
        <dl><div><dt><i className="dir-monthly-swatch dir-monthly-proposed" aria-hidden="true"/>{t('Tổng đề xuất')}</dt><dd>{formatMoney(selected.proposed, lang)}</dd></div>
          <div><dt><i className="dir-monthly-swatch dir-monthly-approved" aria-hidden="true"/>{t('Đã duyệt')}</dt><dd>{formatMoney(selected.approved, lang)}</dd></div></dl>
      </div>}
    </div>
  </figure>;
}
