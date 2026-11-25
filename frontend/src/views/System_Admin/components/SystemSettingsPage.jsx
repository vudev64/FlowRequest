import { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, ShieldCheck, Paperclip, Bell, RefreshCw, Save, LockKeyhole } from 'lucide-react';
import { systemAdminApi } from '../SystemAdminData';
import { PageHeader, Button, ErrorState } from './AdminShared';
import { useAdminPreferences } from '../../AdminPreferences';
import { useSystemConfiguration } from '../../SystemConfiguration';
import TimeZoneSelect from './TimeZoneSelect';
import './SystemSettingsPage.css';

const sections = ['general', 'security', 'attachments', 'notifications'];
const editable = settings => Object.fromEntries(sections.map(key => [key, structuredClone(settings[key])]));
export function SystemSettingsForm({ initial, onSaved, onSavingChange = () => {} }) {
  const { lang } = useAdminPreferences();
  const { refresh } = useSystemConfiguration();
  const text = (vi, en) => lang === 'vi' ? vi : en;
  const [draft, setDraft] = useState(() => editable(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [conflict, setConflict] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const writeLock = useRef(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(editable(initial));
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function update(group, key, value) {
    setDraft(previous => ({ ...previous, [group]: { ...previous[group], [key]: value } }));
    setFieldErrors({});
  }
  const updatePassword = (key, value) => update('security', 'password', { ...draft.security.password, [key]: value });
  const updateEmail = (key, value) => update('notifications', 'email', { ...draft.notifications.email, [key]: value });
  async function save(event) {
    event.preventDefault();
    if (writeLock.current || !dirty || conflict) return;
    if (!window.confirm(text('Áp dụng cấu hình mới? Chính sách đăng nhập, tệp và thông báo sẽ có hiệu lực sau khi lưu. Giảm thời hạn phiên có thể yêu cầu đăng nhập lại.', 'Apply these settings? Login, file and notification policies take effect after saving. Shorter sessions may require signing in again.'))) return;
    writeLock.current = true; setSaving(true); onSavingChange(true); setError(''); setFieldErrors({});
    try {
      await systemAdminApi.saveSettings({ revision: initial.revision, ...draft });
      await onSaved();
      await refresh().catch(() => {});
    } catch (err) { setError(err.message); setFieldErrors(err.errors || {}); if (err.status === 409) setConflict(true); }
    finally { setSaving(false); onSavingChange(false); writeLock.current = false; }
  }
  const field = (label, group, key, props = {}) => <label>{label}<input value={draft[group][key]} onChange={e => { if (key === 'logoUrl') setLogoError(false); update(group, key, props.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value); }} {...props} /></label>;
  const check = (label, checked, onChange) => <label className="settings-toggle"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><span>{label}</span></label>;
  return <form className="system-settings-form" onSubmit={save}>
    <div className="settings-meta"><span>{initial.persisted ? text('Cấu hình đã lưu trong database', 'Saved database configuration') : text('Đang áp dụng thiết lập hiện có; chưa có bản cấu hình riêng trong database.', 'Using existing application settings; no configuration has been saved yet.')}</span><span>{text('Phiên bản', 'Revision')} {initial.revision}{initial.updatedAt && ` · ${new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'short', timeStyle: 'short', timeZone: initial.general.timeZone }).format(new Date(initial.updatedAt))}`}{initial.updatedBy && ` · ${initial.updatedBy}`}</span></div>
    {error && <div role="alert" className="settings-error">{error}{Object.keys(fieldErrors).length > 0 && <ul>{Object.entries(fieldErrors).map(([key, value]) => <li key={key}>{key}: {value}</li>)}</ul>}{conflict && <p>{text('Hãy tải lại trang để lấy cấu hình mới nhất; bản nháp hiện tại vẫn được giữ cho đến khi tải lại.', 'Reload to get the latest configuration. Your current draft is kept until then.')}</p>}</div>}
    <fieldset disabled={saving}>
      <section className="section-card settings-section"><header><Building2 size={21} /><div><h2>{text('Cấu hình chung', 'General settings')}</h2><p>{text('Thông tin hiển thị và tùy chọn mặc định. Lựa chọn ngôn ngữ cá nhân được ưu tiên.', 'Branding and defaults. Personal language preferences take priority.')}</p></div></header><div className="settings-fields">
        {field(text('Tên công ty', 'Company name'), 'general', 'companyName', { maxLength: 150 })}
        {field(text('Tên hệ thống', 'System name'), 'general', 'systemName', { required: true, maxLength: 80 })}
        {field(text('Logo — đường dẫn ảnh HTTP/HTTPS', 'Logo — HTTP/HTTPS image URL'), 'general', 'logoUrl', { type: 'url', maxLength: 2048 })}
        <label>{text('Ngôn ngữ mặc định', 'Default language')}<select value={draft.general.language} onChange={e => update('general', 'language', e.target.value)}><option value="vi">Tiếng Việt</option><option value="en">English</option></select></label>
        <TimeZoneSelect value={draft.general.timeZone} onChange={zone => update('general', 'timeZone', zone)} lang={lang} />
      </div>{draft.general.logoUrl && <div className="settings-logo-preview">{logoError ? <p>{text('Không tải được logo từ đường dẫn này.', 'Unable to load this logo URL.')}</p> : <img src={draft.general.logoUrl} alt={text('Xem trước logo', 'Logo preview')} onError={() => setLogoError(true)} referrerPolicy="no-referrer" />}</div>}</section>
      <section className="section-card settings-section"><header><ShieldCheck size={21} /><div><h2>{text('Bảo mật đăng nhập', 'Login security')}</h2><p>{text('Không thay đổi quyền các vai trò. Chính sách mật khẩu chỉ áp dụng khi tạo/reset mật khẩu, không chặn tài khoản cũ vì mật khẩu hiện tại.', 'Role permissions are unchanged. Password policy applies to new or reset passwords; existing passwords remain usable.')}</p></div></header><div className="settings-fields">
        {field(text('Thời hạn phiên (phút)', 'Session duration (minutes)'), 'security', 'sessionMinutes', { type: 'number', min: 5, max: 43200, required: true })}
        {field(text('Số lần đăng nhập sai (0 = không giới hạn)', 'Failed login limit (0 = unlimited)'), 'security', 'maxFailedLogins', { type: 'number', min: 0, max: 20, required: true })}
        {field(text('Cửa sổ kiểm tra / thời gian khóa (phút)', 'Attempt window / lock duration (minutes)'), 'security', 'lockoutMinutes', { type: 'number', min: 1, max: 1440, required: true })}
        <label>{text('Độ dài mật khẩu tối thiểu', 'Minimum password length')}<input type="number" min={6} max={64} required value={draft.security.password.minLength} onChange={e => updatePassword('minLength', Number(e.target.value))} /></label>
      </div><div className="settings-checks">{[['uppercase',text('Có chữ hoa', 'Uppercase letter')],['lowercase',text('Có chữ thường', 'Lowercase letter')],['number',text('Có chữ số', 'Number')],['special',text('Có ký tự đặc biệt', 'Special character')]].map(([key,label]) => <div key={key}>{check(label, draft.security.password[key], value => updatePassword(key,value))}</div>)}</div><p className="settings-hint">{text('Luồng cấp tài khoản HR vẫn giữ tối thiểu 8 ký tự nếu chính sách chung thấp hơn.', 'HR account creation retains its existing 8-character minimum when the global minimum is lower.')}</p></section>
      <section className="section-card settings-section"><header><Paperclip size={21} /><div><h2>{text('Tệp đính kèm', 'Attachments')}</h2><p>{text('Áp dụng cho tệp đính kèm đề xuất. Chỉ cho chọn các định dạng đã được backend hỗ trợ; không áp dụng cho file import nhân sự.', 'Applies to request attachments, using backend-supported formats. Employee import files have their own limits.')}</p></div></header><div className="settings-fields">{field(text('Dung lượng tối đa (MB)', 'Maximum file size (MB)'), 'attachments', 'maxSizeMB', { type: 'number', min: 1, max: 25, required: true })}</div><div className="settings-checks">{initial.readOnly.supportedExtensions.map(extension => <div key={extension}>{check(extension, draft.attachments.extensions.includes(extension), enabled => update('attachments','extensions', enabled ? [...draft.attachments.extensions, extension] : draft.attachments.extensions.filter(e => e !== extension)))}</div>)}</div></section>
      <section className="section-card settings-section"><header><Bell size={21} /><div><h2>{text('Thông báo và Email', 'Notifications and email')}</h2><p>{text('Khóa API Resend chỉ quản lý tại môi trường backend, không được trả về trình duyệt. Địa chỉ gửi phải được Resend cho phép.', 'The Resend API key stays in the backend environment and is never returned to the browser. The sender address must be allowed by Resend.')}</p></div></header><div className="settings-checks">{check(text('Bật thông báo', 'Enable notifications'), draft.notifications.enabled, value => update('notifications','enabled',value))}{check(text('Bật gửi email', 'Enable email delivery'),draft.notifications.email.enabled, value => updateEmail('enabled',value))}</div><div className="settings-fields"><label>{text('Tên người gửi', 'Sender name')}<input value={draft.notifications.email.senderName} required maxLength={100} onChange={e => updateEmail('senderName',e.target.value)} /></label><label>{text('Địa chỉ email gửi', 'Sender email')}<input type="email" required value={draft.notifications.email.senderEmail} maxLength={254} onChange={e => updateEmail('senderEmail',e.target.value)} /></label></div></section>
    </fieldset>
    <section className="section-card settings-section"><header><LockKeyhole size={21}/><div><h2>{text('Trạng thái và quy tắc hiện hành', 'Current status and rules')}</h2><p>{text('Chỉ đọc. Không thay đổi phân quyền, cấp duyệt hoặc hạn mức nghiệp vụ tại đây.', 'Read only. Role permissions, approval steps and financial thresholds cannot be edited here.')}</p></div></header><div className="settings-runtime"><span>MongoDB: {initial.runtime.databaseConnected ? text('Đã kết nối','Connected') : text('Chưa kết nối','Disconnected')}</span><span>JWT: {initial.runtime.jwtConfigured ? text('Đã cấu hình','Configured') : text('Chưa cấu hình','Not configured')}</span><span>Resend API key: {initial.runtime.emailKeyConfigured ? text('Đã cấu hình','Configured') : text('Chưa cấu hình','Not configured')}</span><span>{text('Ngưỡng duyệt giám đốc','Director approval threshold')}: {new Intl.NumberFormat(lang === 'vi' ? 'vi-VN':'en-GB').format(initial.readOnly.directorThreshold)} VND</span></div><p className="settings-hint">{initial.readOnly.roles.join(" · ")}</p><div className="settings-workflow"><table><thead><tr><th>{text('Bước xử lý','Stage')}</th><th>{text('Vai trò','Role')}</th><th>{text('Loại đơn','Request types')}</th></tr></thead><tbody>{initial.readOnly.workflow.map(step => <tr key={step.status}><td>{step.status}</td><td>{step.role}</td><td>{[...new Set(step.types)].join(', ')}</td></tr>)}</tbody></table></div></section>
    <div className="settings-save-bar"><span>{dirty ? text('Có thay đổi chưa lưu','Unsaved changes') : text('Không có thay đổi','No changes')} · {text('Mọi lần lưu được ghi Audit Log','Every save is recorded in the audit log')}</span><Button type="submit" icon={Save} loading={saving} disabled={!dirty || conflict}>{text('Lưu cấu hình','Save settings')}</Button></div>
  </form>;
}
export function SystemSettingsPage() {
  const { lang } = useAdminPreferences();
  const [data,setData] = useState(null), [error,setError] = useState(''), [notice,setNotice] = useState('');
  const [loading,setLoading] = useState(false);
  const [saving,setSaving] = useState(false);
  const [loadedVersion, setLoadedVersion] = useState(0);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const request = ++sequence.current; setError(''); setLoading(true);
    try { const result = await systemAdminApi.getSettings(); if(request === sequence.current) { setData(result); setLoadedVersion(value => value + 1); } }
    catch(err) { if(request === sequence.current) setError(err.message); }
    finally { if(request === sequence.current) setLoading(false); }
  }, []);
  useEffect(() => { load(); return () => { sequence.current++; }; },[load]);
  return <><PageHeader eyebrow={lang === 'vi'?'Cấu hình hệ thống':'System settings'} title={lang === 'vi'?'Cấu hình hệ thống':'System settings'} description={lang === 'vi'?'Quản lý cấu hình vận hành, bảo mật và thông báo từ database.':'Manage database-backed operational settings, security and notifications.'} actions={<Button variant="secondary" icon={RefreshCw} disabled={loading || saving} onClick={() => { if(!data || window.confirm(lang === 'vi'?'Tải lại cấu hình? Thay đổi chưa lưu sẽ bị bỏ.':'Reload settings and discard unsaved changes?')) load(); }}>{lang === 'vi'?'Tải lại':'Reload'}</Button>} />{notice && <p role="status" className="settings-success">{notice}</p>}{error ? <ErrorState message={error} onRetry={load}/> : data ? <SystemSettingsForm key={`${data.revision}-${loadedVersion}`} initial={data} onSavingChange={setSaving} onSaved={async()=>{ setNotice(lang === 'vi'?'Đã lưu cấu hình và ghi Audit Log.':'Settings saved and audit log recorded.'); await load(); }}/>:<p role="status">{lang === 'vi'?'Đang tải cấu hình…':'Loading settings…'}</p>}</>;
}
