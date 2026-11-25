//Yêu cầu card mỗi đơn
import {
  Check,
  Clock3,
  LockKeyhole,
  Users,
  XCircle,
} from "lucide-react";

import { typeMeta } from "../ManagerData";

export function RequestCard({ request, onApprove, onReject }) {
  const meta = typeMeta[request.type];
  const Icon = meta.icon;

  return (
    <article className={`request-card request-${meta.accent}`}>
      <div className="request-card-main">
        {/* Requester Information */}
        <div className="request-person">
          <div className={`avatar avatar-${meta.accent}`}>
            {request.requester
              .split(" ")
              .map((part) => part[0])
              .slice(-2)
              .join("")}
          </div>

          <div>
            <div className="person-line">
              <strong>{request.requester}</strong>
              <span className="request-id">#{request.id}</span>
            </div>

            <div className="person-meta">
              <Users size={13} />
              {request.department}
            </div>
          </div>
        </div>

        {/* Request Type */}
        <div className="request-type">
          <span className={`type-badge ${meta.className}`}>
            <Icon size={14} />
            {meta.label}
          </span>

          <span className="submitted">
            <Clock3 size={13} />
            {request.submittedAt}
          </span>
        </div>
      </div>

      {/* Request Details */}
      <div className="request-detail">
        <div className="reason-block">
          <span className="detail-label">Lý do</span>
          <p>{request.reason}</p>
        </div>

        <div className="metric-block">
          <span className="detail-label">
            {request.financial
              ? "Giá trị đề xuất"
              : "Thời lượng"}
          </span>

          <strong>{request.metric}</strong>
          <span>{request.metricLabel}</span>
        </div>

        <div className="next-block">
          <span className="detail-label">Bước kế tiếp</span>

          <div className="next-role">
            <span className="role-pulse" />
            {request.nextRole}
          </div>

          <span className="next-caption">
            Sau khi bạn duyệt
          </span>
        </div>
      </div>

      {/* Request Actions */}
      <div className="request-actions">
        <div className="request-policy">
          <LockKeyhole size={14} />
          Chỉ Manager của team mới có quyền xử lý
        </div>

        <div className="action-buttons">
          <button
            type="button"
            className="reject-button"
            onClick={onReject}
          >
            <XCircle size={16} />
            Từ chối
          </button>

          <button
            type="button"
            className="approve-button"
            onClick={onApprove}
          >
            <Check size={16} />
            Duyệt đơn
          </button>
        </div>
      </div>
    </article>
  );
}
