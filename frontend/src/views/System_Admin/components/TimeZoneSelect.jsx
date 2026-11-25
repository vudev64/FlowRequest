import { useId, useState } from 'react';
import { matchingTimeZones, supportedTimeZones } from '../../../lib/timeZones';

export default function TimeZoneSelect({ value, onChange, lang }) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [zones] = useState(() => supportedTimeZones(value));
  const matches = matchingTimeZones(zones, query);
  const text = (vi, en) => lang === 'vi' ? vi : en;
  const currentIsListed = matches.includes(value);
  return <div className="settings-time-zone">
    <label htmlFor={`${id}-select`}>{text('Múi giờ IANA', 'IANA time zone')}</label>
    <input id={`${id}-search`} type="search" value={query} onChange={event => setQuery(event.target.value)}
      aria-label={text('Tìm múi giờ', 'Search time zones')} aria-controls={`${id}-select`} aria-describedby={`${id}-hint`}
      placeholder={text('Tìm thành phố hoặc mã IANA…', 'Search by city or IANA code…')} />
    <select id={`${id}-select`} value={value} required aria-describedby={`${id}-hint`}
      onChange={event => { onChange(event.target.value); setQuery(''); }}>
      {!currentIsListed && <optgroup label={text('Đang chọn', 'Current selection')}><option value={value}>{value}</option></optgroup>}
      {matches.map(zone => <option key={zone} value={zone}>{zone}</option>)}
    </select>
    <small id={`${id}-hint`} className="settings-time-zone-hint" role="status">
      {matches.length ? text(`${matches.length} múi giờ phù hợp. Mở danh sách để chọn.`, `${matches.length} matching time zones. Open the list to choose.`) : text('Không tìm thấy. Thử tên thành phố hoặc nhập mã IANA đầy đủ.', 'No matches. Try a city name or enter a complete IANA code.')}
      {' '}{text('Có thể nhập mã khác, ví dụ Asia/Ho_Chi_Minh hoặc UTC.', 'You can also enter a code such as Asia/Ho_Chi_Minh or UTC.')}
    </small>
  </div>;
}
