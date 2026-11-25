import { useAdminPreferences } from "../../AdminPreferences";
import { useRef, useState } from 'react';
import { apiRequest } from '../../../lib/api';
import { useSystemConfiguration } from '../../SystemConfiguration';
import { passwordMeetsPolicy } from '../../../lib/systemConfiguration';
export default function HRImportModal({
  onClose,
  users,
  onImported
}) {
  const { settings } = useSystemConfiguration();
  const {
    t: translate
  } = useAdminPreferences();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);
  const lock = useRef(false);
  async function readFile(file) {
    setError('');
    setResults([]);
    setRows([]);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError('File tối đa 5 MB.');
    setBusy(true);
    try {
      const XLSX = await import('xlsx');
      const book = XLSX.read(await file.arrayBuffer(), {
        type: 'array',
        sheetRows: 502
      });
      const data = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], {
        defval: '',
        raw: false
      });
      if (!data.length || data.length > 500) throw new Error('File cần có từ 1 đến 500 dòng dữ liệu.');
      const emails = new Set();
      const mapped = data.map((r, index) => {
        const row = {
          name: String(r.Fullname || '').trim(),
          email: String(r.Email || '').trim().toLowerCase(),
          password: String(r.Password || ''),
          department: String(r.Department || '').trim(),
          role: String(r.Role || '').trim().toUpperCase(),
          title: String(r.Title || '').trim()
        };
        if (!row.name || !row.department || !/^\S+@\S+\.\S+$/.test(row.email) || !passwordMeetsPolicy(row.password, settings?.passwordPolicy) || !['EMPLOYEE', 'MANAGER', 'ACCOUNTANT'].includes(row.role)) throw new Error(`Dòng ${index + 2}: kiểm tra họ tên, email, phòng ban, vai trò và chính sách mật khẩu hiện hành.`);
        if (emails.has(row.email) || users.some(u => u.email.toLowerCase() === row.email)) throw new Error(`Dòng ${index + 2}: email bị trùng.`);
        emails.add(row.email);
        if (r.ManagerEmail) {
          const manager = users.find(u => u.email.toLowerCase() === String(r.ManagerEmail).trim().toLowerCase() && u.status !== 'INACTIVE' && ['MANAGER', 'DIRECTOR'].includes(u.role));
          if (!manager) throw new Error(`Dòng ${index + 2}: quản lý phải là tài khoản đang hoạt động có sẵn trong hệ thống.`);
          row.managerId = manager.id;
        }
        return row;
      });
      setRows(mapped);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setResults([]);
    const failed = [];
    try {
      for (const row of rows) {
        try {
          const result = await apiRequest('/hr/users', {
            method: 'POST',
            body: row
          });
          onImported({
            ...result.data,
            id: result.data._id,
            status: result.data.status || 'ACTIVE'
          });
          setResults(previous => [...previous, `${row.email}: đã tạo`]);
        } catch (e) {
          failed.push(row);
          setResults(previous => [...previous, `${row.email}: ${e.message}`]);
        }
      }
      setRows(failed);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return <div className="modal-backdrop"><div className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="hr-import-title"><div className="modal-header"><h2 id="hr-import-title">{translate("Import nh\xE2n s\u1EF1 t\u1EEB Excel / CSV")}</h2></div><div className="hr-decision-body"><p>{translate("T\u1ED1i \u0111a 5 MB, 500 d\xF2ng; \u0111\u1ECDc sheet \u0111\u1EA7u ti\xEAn. M\u1ED7i t\xE0i kho\u1EA3n \u0111\u01B0\u1EE3c l\u01B0u ri\xEAng v\xE0 c\xF3 k\u1EBFt qu\u1EA3 c\u1EE5 th\u1EC3.")}</p><p>{translate("C\u1ED9t b\u1EAFt bu\u1ED9c:")}<code>Fullname, Email, Password, Role, Department</code>{translate(". T\xF9y ch\u1ECDn:")}<code>Title, ManagerEmail</code>{translate(". Vai tr\xF2: EMPLOYEE, MANAGER, ACCOUNTANT.")}</p><label>{translate("Ch\u1ECDn file")}<input disabled={busy} type="file" accept=".xlsx,.csv" onChange={e => readFile(e.target.files?.[0])} /></label>{error && <p role="alert" className="inline-error">{translate(error)}</p>}{rows.length > 0 && <p>{translate("\u0110\xE3 ki\u1EC3m tra")}{rows.length}{translate("t\xE0i kho\u1EA3n. B\u1EA5m nh\u1EADp \u0111\u1EC3 l\u01B0u v\xE0o h\u1EC7 th\u1ED1ng.")}</p>}{results.length > 0 && <ul className="hr-import-results" aria-live="polite">{results.map((r, i) => <li key={i}>{r}</li>)}</ul>}</div><div className="modal-actions"><button className="secondary-button" disabled={busy} onClick={onClose}>{translate("\u0110\xF3ng")}</button><button className="primary-button" disabled={busy || !rows.length} onClick={submit}>{busy ? translate('Đang xử lý…') : `Nhập ${rows.length} tài khoản`}</button></div></div></div>;
}
