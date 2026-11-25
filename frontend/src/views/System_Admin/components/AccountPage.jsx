import { useAdminPreferences } from "../../AdminPreferences";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Building2, Check, CheckCircle2, Copy, KeyRound, Lock, MoreHorizontal, Plus, UserCog, Users } from 'lucide-react';
import { ADMIN_ROLE_OPTIONS, STATUS_LABELS, systemAdminApi as apiClient } from '../SystemAdminData.js';
import { Badge, Button, ConfirmModal, EmptyState, ErrorState, LoadingRows, Modal, PageHeader, RoleBadge, cx } from './AdminShared.jsx';

// ==========================================
// 1. INITIAL STATE
// ==========================================

const INITIAL_FORM = {
  name: '',
  email: '',
  role: 'DIRECTOR',
  departmentId: ''
};

// ==========================================
// 2. ACCOUNT SUMMARY
// ==========================================

function AccountSummary({
  accounts
}) {
  const {
    t: translate
  } = useAdminPreferences();
  const totalAccounts = accounts ? accounts.length : '—';
  const activeAccounts = accounts ? accounts.filter(item => item.status === 'ACTIVE').length : '—';
  return <div className="account-summary">
      <div>
        <div className="summary-icon teal">
          <Users size={19} />
        </div>

        <div>
          <span>{translate("T\u1ED5ng t\xE0i kho\u1EA3n")}</span>
          <strong>{totalAccounts}</strong>
        </div>
      </div>

      <div>
        <div className="summary-icon green">
          <CheckCircle2 size={19} />
        </div>

        <div>
          <span>{translate("\u0110ang ho\u1EA1t \u0111\u1ED9ng")}</span>
          <strong>{activeAccounts}</strong>
        </div>
      </div>

      <div>
        <div className="summary-icon amber">
          <KeyRound size={19} />
        </div>

        <div>
          <span>{translate('Đã khóa')}</span>
          <strong>{accounts ? accounts.filter(item => item.status === 'INACTIVE').length : '—'}</strong>
        </div>
      </div>
    </div>;
}

// ==========================================
// 3. ACCOUNT TABLE ROW
// ==========================================

function AccountTableRow({
  account,
  onReset,
  onToggle
}) {
  const {
    t: translate
  } = useAdminPreferences();
  const isActive = account.status === 'ACTIVE';
  const isCurrentActive = account.isCurrentUser && isActive;
  const avatarInitials = account.name.split(' ').slice(-2).map(part => part[0]).join('');
  return <tr>
      <td>
        <div className="actor-cell">
          <div className={cx('avatar', account.isCurrentUser ? 'avatar-teal' : 'avatar-slate')}>
            {avatarInitials}
          </div>

          <div>
            <div className="cell-primary">
              {account.name}

              {account.isCurrentUser && <span className="you-label">{translate("B\u1EA1n")}</span>}
            </div>

            <div className="cell-secondary">
              {account.email}
            </div>
          </div>
        </div>
      </td>

      <td>
        <RoleBadge role={account.role} />
      </td>

      <td>
        <span className="department-cell">
          <Building2 size={14} />
          {account.department}
        </span>
      </td>

      <td>
        <Badge tone={isActive ? 'success' : 'neutral'} dot>
          {translate(STATUS_LABELS[account.status])}
        </Badge>
      </td>

      <td>
        <div className="row-actions">
          <button className="text-button" onClick={() => onReset(account.id)}>
            <KeyRound size={14} />
            Reset
          </button>

          <button className={cx('text-button', isActive && 'text-danger')} disabled={isCurrentActive} title={isCurrentActive ? 'Không thể tự khóa chính mình' : undefined} onClick={() => onToggle(account)}>
            {isActive ? <Lock size={14} /> : <Check size={14} />}

            {isActive ? translate('Khóa') : translate('Mở khóa')}
          </button>
        </div>
      </td>
    </tr>;
}

// ==========================================
// 4. ACCOUNT TABLE
// ==========================================

function AccountTable({
  accounts,
  onReset,
  onToggle
}) {
  const {
    t: translate
  } = useAdminPreferences();
  return <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{translate("H\u1ECD t\xEAn")}</th>
            <th>{translate("Vai tr\xF2")}</th>
            <th>{translate("Ph\xF2ng ban")}</th>
            <th>{translate("Tr\u1EA1ng th\xE1i")}</th>
            <th className="align-right">{translate("H\xE0nh \u0111\u1ED9ng")}</th>
          </tr>
        </thead>

        <tbody>
          {accounts.map(account => <AccountTableRow key={account.id} account={account} onReset={onReset} onToggle={onToggle} />)}
        </tbody>
      </table>
    </div>;
}

// ==========================================
// 5. ACCOUNT TABLE CARD
// ==========================================

function AccountTableCard({
  data,
  error,
  onRetry,
  onReset,
  onToggle
}) {
  const {
    t: translate
  } = useAdminPreferences();
  return <div className="section-card account-card">
      <div className="table-toolbar">
        <div>
          <strong>{translate("Danh s\xE1ch t\xE0i kho\u1EA3n")}</strong>
          <span>{translate("\xB7 Quy\u1EC1n k\u1EF9 thu\u1EADt trong h\u1EC7 th\u1ED1ng")}</span>
        </div>

        <button className="more-button" aria-label={translate("Tùy chọn khác")}>
          <MoreHorizontal size={18} />
        </button>
      </div>

      {error ? <ErrorState onRetry={onRetry} message={error} /> : !data ? <LoadingRows columns={6} /> : data.accounts.length === 0 ? <EmptyState icon={UserCog} title={translate("Chưa có tài khoản quản trị")} description={translate("Cấp tài khoản đầu tiên để quản lý khu vực kỹ thuật.")} /> : <AccountTable accounts={data.accounts} onReset={onReset} onToggle={onToggle} />}

      <div className="table-note">
        <AlertCircle size={15} />{translate("EMPLOYEE, MANAGER, ACCOUNTANT do HR_ADMIN c\u1EA5p. M\u1EADt kh\u1EA9u t\u1EA1m kh\xF4ng \u0111\u01B0\u1EE3c ghi v\xE0o audit log.")}</div>
    </div>;
}

// ==========================================
// 6. CREATE ACCOUNT MODAL
// ==========================================

function CreateAccountModal({
  data,
  form,
  setForm,
  saving,
  onClose,
  onSubmit
}) {
  const {
    t: translate
  } = useAdminPreferences();
  return <Modal title={translate("Cấp tài khoản quản trị")} eyebrow={translate("Tài khoản mới")} onClose={onClose} width="600px" footer={<>
          <Button variant="ghost" onClick={onClose}>{translate("H\u1EE7y")}</Button>

          <Button type="submit" form="create-admin-account-form" loading={saving}>{translate("C\u1EA5p t\xE0i kho\u1EA3n")}</Button>
        </>}>
      <form id="create-admin-account-form" onSubmit={onSubmit} className="form-stack">
        <div className="form-callout">
          <KeyRound size={17} />

          <span>{translate('Mật khẩu được tạo ngẫu nhiên và chỉ hiển thị một lần. Hãy chuyển qua kênh riêng cho người dùng.')}</span>
        </div>

        <label>{translate("H\u1ECD t\xEAn")}<span className="required">*</span>

          <input autoFocus value={form.name} onChange={e => setForm({
          ...form,
          name: e.target.value
        })} placeholder={translate("Nhập họ tên đầy đủ")} />
        </label>

        <label>
          Email<span className="required">*</span>

          <input type="email" value={form.email} onChange={e => setForm({
          ...form,
          email: e.target.value
        })} placeholder={translate("Nhập địa chỉ email")} />
        </label>

        <div className="form-grid">
          <label>{translate("Vai tr\xF2")}<span className="required">*</span>

            <select value={form.role} onChange={e => setForm({
            ...form,
            role: e.target.value
          })}>
              {ADMIN_ROLE_OPTIONS.map(option => <option key={option.value} value={option.value}>
                  {translate(option.label)}
                </option>)}
            </select>
          </label>

          <label>{translate("Ph\xF2ng ban")}<span className="required">*</span>

            <select value={form.departmentId} onChange={e => setForm({
            ...form,
            departmentId: e.target.value
          })}>
              {data?.departments.map(department => <option value={department.id} key={department.id}>
                  {department.name}
                </option>)}
            </select>
          </label>
        </div>
      </form>
    </Modal>;
}

// ==========================================
// 7. PASSWORD MODAL
// ==========================================

function PasswordModal({
  modal,
  onClose,
  onCopy
}) {
  const {
    t: translate
  } = useAdminPreferences();
  return <Modal title={modal.title} eyebrow={translate("Mật khẩu tạm · chỉ hiển thị một lần")} onClose={onClose} width="500px" footer={<Button variant="secondary" onClick={onClose}>{translate("\u0110\xF3ng")}</Button>}>
      <div className="password-reveal">
        <div className="password-lock">
          <Lock size={20} />
        </div>

        <p>{translate("H\xE3y sao ch\xE9p v\xE0 g\u1EEDi m\u1EADt kh\u1EA9u qua k\xEAnh an to\xE0n. \u0110\xF3ng c\u1EEDa s\u1ED5 n\xE0y s\u1EBD kh\xF4ng th\u1EC3 xem l\u1EA1i.")}</p>

        <div className="password-box">
          <code>{modal.password}</code>

          <button className="icon-button" onClick={onCopy} aria-label={translate("Sao chép mật khẩu")}>
            <Copy size={17} />
          </button>
        </div>

        <div className="one-time-note">
          <CheckCircle2 size={15} />{translate("M\u1EADt kh\u1EA9u t\u1EA1m kh\xF4ng \u0111\u01B0\u1EE3c ghi v\xE0o log.")}</div>
      </div>
    </Modal>;
}

// ==========================================
// 8. ACCOUNTS PAGE
// ==========================================

export function AccountsPage({
  notify
}) {
  const {
    t: translate
  } = useAdminPreferences();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const loadSequence = useRef(0);
  const writeLock = useRef(false);

  // ------------------------------------------
  // 8.1. Load accounts
  // ------------------------------------------

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setError(false);
    try {
      const result = await apiClient.getAccounts();
      if (sequence === loadSequence.current) setData(result);
    } catch (error) {
      if (sequence === loadSequence.current) setError(error.message);
    }
  }, []);
  useEffect(() => {
    load();
    return () => { loadSequence.current++; };
  }, [load]);

  // ------------------------------------------
  // 8.2. Modal handlers
  // ------------------------------------------

  const openCreate = () => {
    setForm({
      ...INITIAL_FORM,
      departmentId: data?.departments[0]?.id || ''
    });
    setModal('create');
  };
  const openReset = id => {
    setModal({
      type: 'reset',
      id
    });
  };
  const openToggle = account => {
    setModal({
      type: 'toggle',
      id: account.id,
      nextStatus: account.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    });
  };

  // ------------------------------------------
  // 8.3. Create account
  // ------------------------------------------

  const createAccount = async event => {
    event.preventDefault();
    if (writeLock.current) return;
    if (!form.name.trim() || !form.email.trim() || !form.departmentId) {
      return notify('error', 'Chưa đủ thông tin', 'Vui lòng hoàn tất các trường bắt buộc.');
    }
    writeLock.current = true;
    setSaving(true);
    try {
      const result = await apiClient.createAccount(form);
      setModal({
        type: 'password',
        password: result.temporaryPassword,
        title: 'Tài khoản đã được cấp'
      });
      notify('success', 'Đã cấp tài khoản quản trị', 'Mật khẩu tạm chỉ hiển thị một lần.');
      await load();
    } catch (err) {
      notify('error', `Không thể cấp tài khoản (${err.code || 'SERVER'})`, err.message);
    } finally {
      writeLock.current = false;
      setSaving(false);
    }
  };

  // ------------------------------------------
  // 8.4. Reset password
  // ------------------------------------------

  const doReset = async () => {
    if (writeLock.current) return;
    writeLock.current = true;
    setSaving(true);
    try {
      const result = await apiClient.resetPassword(modal.id);
      setModal({
        type: 'password',
        password: result.temporaryPassword,
        title: 'Đã reset mật khẩu'
      });
      notify('success', 'Đã reset mật khẩu', 'Mật khẩu cũ đã mất hiệu lực ngay.');
    } catch (err) {
      setModal(null);
      notify('error', `Không thể reset mật khẩu (${err.code || 'SERVER'})`, err.message);
    } finally {
      writeLock.current = false;
      setSaving(false);
    }
  };

  // ------------------------------------------
  // 8.5. Toggle account status
  // ------------------------------------------

  const doToggle = async () => {
    if (writeLock.current) return;
    writeLock.current = true;
    setSaving(true);
    try {
      await apiClient.toggleAccountStatus(modal.id, modal.nextStatus);
      setModal(null);
      notify('success', modal.nextStatus === 'ACTIVE' ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản', 'Trạng thái tài khoản đã được cập nhật.');
      await load();
    } catch (err) {
      setModal(null);
      notify('error', `Không thể cập nhật trạng thái (${err.code || 'SERVER'})`, err.message);
    } finally {
      writeLock.current = false;
      setSaving(false);
    }
  };

  // ------------------------------------------
  // 8.6. Copy temporary password
  // ------------------------------------------

  const copyPassword = async () => {
    await navigator.clipboard?.writeText(modal.password);
    notify('success', 'Đã sao chép mật khẩu', 'Hãy gửi mật khẩu qua kênh an toàn cho người dùng.');
  };

  // ------------------------------------------
  // 8.7. Current target account
  // ------------------------------------------

  const targetAccount = modal?.id ? data?.accounts.find(item => item.id === modal.id) : null;

  // ------------------------------------------
  // 8.8. Render
  // ------------------------------------------

  return <>
      <PageHeader eyebrow={translate("Tài khoản quản trị")} title={translate("Tài khoản quản trị")} description={translate("Cấp quyền và quản lý các tài khoản có vai trò quản trị hệ thống.")} meta={<>
            <span className="meta-dot" />{translate("Ch\u1EC9 hi\u1EC3n th\u1ECB DIRECTOR, HR_ADMIN v\xE0 SYSTEM_ADMIN")}<span className="meta-separator">•</span>{translate("Lu\xF4n c\xF2n \xEDt nh\u1EA5t 1 SYSTEM_ADMIN \u0111ang ho\u1EA1t \u0111\u1ED9ng")}</>} actions={<Button icon={Plus} onClick={openCreate}>{translate("C\u1EA5p t\xE0i kho\u1EA3n qu\u1EA3n tr\u1ECB")}</Button>} />

      <AccountSummary accounts={data?.accounts} />

      <AccountTableCard data={data} error={error} onRetry={load} onReset={openReset} onToggle={openToggle} />

      {/* Create account */}
      {modal === 'create' && <CreateAccountModal data={data} form={form} setForm={setForm} saving={saving} onClose={() => setModal(null)} onSubmit={createAccount} />}

      {/* Reset password confirmation */}
      {modal?.type === 'reset' && targetAccount && <ConfirmModal title={translate("Reset mật khẩu?")} message={`Mật khẩu cũ của “${targetAccount.name}” sẽ mất hiệu lực ngay. Một mật khẩu tạm mới sẽ được sinh và chỉ hiển thị một lần.`} confirmLabel={translate("Reset mật khẩu")} loading={saving} onClose={() => setModal(null)} onConfirm={doReset} />}

      {/* Toggle account status confirmation */}
      {modal?.type === 'toggle' && targetAccount && <ConfirmModal title={modal.nextStatus === 'ACTIVE' ? translate('Mở khóa tài khoản?') : translate('Khóa tài khoản?')} message={modal.nextStatus === 'ACTIVE' ? `Tài khoản “${targetAccount.name}” sẽ có thể đăng nhập lại ngay.` : `Tài khoản “${targetAccount.name}” sẽ bị từ chối đăng nhập ngay sau khi khóa.`} confirmLabel={modal.nextStatus === 'ACTIVE' ? translate('Mở khóa') : translate('Khóa tài khoản')} danger={modal.nextStatus === 'INACTIVE'} loading={saving} onClose={() => setModal(null)} onConfirm={doToggle} />}

      {/* Temporary password */}
      {modal?.type === 'password' && <PasswordModal modal={modal} onClose={() => setModal(null)} onCopy={copyPassword} />}
    </>;
}
