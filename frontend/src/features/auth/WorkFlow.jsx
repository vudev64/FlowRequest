import { ArrowUpRight, Check, LockKeyhole, ShieldCheck, Zap } from 'lucide-react';

export function Workflow() {
  return (
    <div className="workflow-illustration" aria-label="Minh họa quy trình phê duyệt">
      <div className="workflow-orbit workflow-orbit--one" />
      <div className="workflow-orbit workflow-orbit--two" />
      <div className="workflow-grid" />

      <svg className="workflow-lines" viewBox="0 0 760 300" fill="none" aria-hidden="true">
        <path d="M42 222C138 222 114 74 224 74C322 74 274 228 394 228C510 228 448 92 585 92C650 92 652 144 710 144" />
        <path d="M148 260C248 260 236 136 338 136C440 136 426 260 548 260C607 260 604 218 690 218" />
        <path className="workflow-lines__ghost" d="M58 110C172 110 180 24 286 24C398 24 400 174 506 174C582 174 594 44 722 44" />
      </svg>

      <div className="workflow-node workflow-node--lock" title="Bảo mật nội bộ">
        <LockKeyhole size={16} />
      </div>
      <div className="workflow-node workflow-node--zap" title="Tự động hóa">
        <Zap size={17} />
      </div>
      <div className="workflow-node workflow-node--arrow" title="Chuyển tiếp">
        <ArrowUpRight size={16} />
      </div>
      <div className="workflow-node workflow-node--check" title="Đã xác nhận">
        <Check size={15} />
      </div>

      <article className="workflow-card workflow-card--request">
        <div className="workflow-card__icon workflow-card__icon--green"><Check size={15} strokeWidth={2.8} /></div>
        <div>
          <p className="workflow-card__eyebrow">EMPLOYEE WORKSPACE</p>
          <h3>Request submitted</h3>
          <span className="workflow-card__status"><span />Ready for review</span>
        </div>
      </article>

      <article className="workflow-card workflow-card--approval">
        <div className="workflow-card__icon workflow-card__icon--violet"><ShieldCheck size={16} /></div>
        <div>
          <p className="workflow-card__eyebrow">SECURE ROUTING</p>
          <h3>Approval workflow</h3>
          <span className="workflow-card__route">Manager <b>→</b> HR_ADMIN <b>→</b> Director</span>
        </div>
      </article>

      <span className="workflow-label workflow-label--top">AUTO-ROUTED</span>
      <span className="workflow-label workflow-label--bottom">AUDIT READY</span>
    </div>
  );
}