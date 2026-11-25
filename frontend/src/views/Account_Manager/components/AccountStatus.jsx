import { statusLabel } from '../AccountData';
import { useAccountLanguage } from '../AccountLanguage';
export default function AccountStatus({ status }) {
  const { lang } = useAccountLanguage();
  const tone = status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'danger' : status?.startsWith('PENDING_') ? 'pending' : 'neutral';
  return <span className={`acc-status acc-status--${tone}`}>{statusLabel(status, lang)}</span>;
}
