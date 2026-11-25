import { useRef } from 'react';
import { RequestDetail } from './Approvals';
import { useDialogFocus } from './useDialogFocus';
import { useDirectorLanguage } from '../DirectorLanguage';

// Report details reuse the original approval detail view and modal styles.
export default function RequestDialog({ detail, onClose, onRetry, onDownload }) {
  const { t } = useDirectorLanguage();
  const ref = useRef(null);
  useDialogFocus(ref, true, onClose);
  return <div className="dir-modal-backdrop" role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <div className="dir-modal" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('Chi tiết và lịch sử đề xuất')}>
      <div className="dir-modal-head"><strong>{t('Chi tiết đề xuất')}</strong><button className="dir-icon-btn" type="button" onClick={onClose} aria-label={t('Đóng')}>×</button></div>
      <div className="dir-modal-body">{detail.loading ? <p role="status">{t('Đang tải chi tiết...')}</p> : detail.error ? <div><p className="dir-error" role="alert">{t(detail.error)}</p><button className="dir-btn dir-btn-ghost" type="button" onClick={onRetry}>{t('Thử lại')}</button></div> : detail.record && <RequestDetail request={detail.record} onDownload={onDownload}/>}</div>
      <div className="dir-modal-footer"><button className="dir-btn dir-btn-ghost" type="button" onClick={onClose}>{t('Đóng')}</button></div>
    </div>
  </div>;
}
