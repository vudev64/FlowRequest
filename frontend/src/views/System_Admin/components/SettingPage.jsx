import React, { useEffect, useRef } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  X,
  XCircle,
} from 'lucide-react';

import { ROLE_LABELS } from '../SystemAdminData.js';
export const cx = (...classes) =>
  classes.filter(Boolean).join(' ');

export const initials = (name) =>
  name
    ? name
        .split(' ')
        .slice(-2)
        .map((part) => part[0])
        .join('')
        .toUpperCase()
    : '—';

export function Button({
  children,
  variant = 'primary',
  icon: Icon,
  loading = false,
  className = '',
  ...props
}) {
  return (
    <button
      className={cx('button', `button-${variant}`, className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <span className="spinner" aria-hidden="true" />
      ) : Icon ? (
        <Icon size={16} strokeWidth={2} />
      ) : null}

      {children}
    </button>
  );
}

export function Badge({ children, tone = 'neutral', dot = false }) {
  return (
    <span className={cx('badge', `badge-${tone}`)}>
      {dot && (
        <span className="badge-dot" aria-hidden="true" />
      )}
      {children}
    </span>
  );
}

export function Toast({ toast, onClose }) {
  if (!toast) return null;

  const Icon =
    toast.type === 'success' ? CheckCircle2 : XCircle;

  return (
    <div
      className={cx('toast', `toast-${toast.type}`)}
      role="status"
    >
      <Icon size={18} />

      <div>
        <strong>{toast.title}</strong>
        <p>{toast.message}</p>
      </div>

      <button
        className="icon-button toast-close"
        onClick={onClose}
        aria-label="Đóng thông báo"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function Modal({
  title,
  eyebrow,
  children,
  onClose,
  width = '520px',
  footer,
  danger = false,
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;

    panelRef.current?.focus();

    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={cx('modal', danger && 'modal-danger')}
        style={{ '--modal-width': width }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex="-1"
        ref={panelRef}
      >
        <div className="modal-head">
          <div>
            {eyebrow && (
              <div className="eyebrow">{eyebrow}</div>
            )}

            <h2 id="modal-title">{title}</h2>
          </div>

          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {children}
        </div>

        {footer && (
          <div className="modal-foot">
            {footer}
          </div>
        )}
      </section>
    </div>
  );
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Xác nhận',
  onConfirm,
  onClose,
  loading = false,
  danger = false,
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      width="460px"
      danger={danger}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>

          <Button
            variant={danger ? 'danger' : 'primary'}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="confirm-copy">
        <div
          className={cx(
            'confirm-icon',
            danger
              ? 'confirm-icon-danger'
              : 'confirm-icon-warn'
          )}
        >
          <AlertCircle size={22} />
        </div>

        <p>{message}</p>
      </div>
    </Modal>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
}) {
  return (
    <div className="page-header">
      <div>
        <div className="breadcrumb">
          <span>System Admin</span>
          <ArrowRight size={13} />
          <span>{eyebrow}</span>
        </div>

        <h1>{title}</h1>
        <p>{description}</p>

        {meta && (
          <div className="page-meta">
            {meta}
          </div>
        )}
      </div>

      {actions && (
        <div className="page-actions">
          {actions}
        </div>
      )}
    </div>
  );
}

export function SectionHeader({
  icon: Icon,
  title,
  description,
  actions,
}) {
  return (
    <div className="section-header">
      <div className="section-title">
        <div className="section-icon">
          <Icon size={18} />
        </div>

        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>

      {actions && (
        <div className="section-actions">
          {actions}
        </div>
      )}
    </div>
  );
}


export function LoadingRows({ columns = 5 }) {
  return (
    <div
      className="loading-rows"
      aria-label="Đang tải dữ liệu"
    >
      {[1, 2, 3].map((row) => (
        <div className="loading-row" key={row}>
          {Array.from({ length: columns }).map((_, index) => (
            <span
              className="skeleton"
              key={index}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon = ClipboardList,
  title,
  description,
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={22} />
      </div>

      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function ErrorState({ onRetry }) {
  return (
    <div className="error-state">
      <XCircle size={20} />

      <div>
        <strong>Không thể tải dữ liệu</strong>
        <p>Kiểm tra kết nối và thử lại.</p>
      </div>

      <Button
        variant="secondary"
        icon={RefreshCw}
        onClick={onRetry}
      >
        Thử lại
      </Button>
    </div>
  );
}


export function RoleBadge({ role }) {
  const tone =
    role === 'SYSTEM_ADMIN'
      ? 'teal'
      : role === 'HR_ADMIN'
        ? 'blue'
        : 'purple';

  return (
    <Badge tone={tone}>
      {ROLE_LABELS[role] || role}
    </Badge>
  );
}
