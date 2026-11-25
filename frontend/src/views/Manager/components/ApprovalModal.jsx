// Dialog duyệt/từ chối
import { useState } from "react";

import {
  Check,
  CircleAlert,
  X,
  XCircle,
} from "lucide-react";

import { typeMeta } from "../ManagerData";
import RequestSpecificDetails from '../../Employee/components/RequestSpecificDetails';

export function ApprovalModal({
  kind,
  request,
  onClose,
  onApprove,
  onReject,
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const isReject = kind === "reject";
  const meta = typeMeta[request.type];

  const submit = () => {
    if (isReject && note.trim().length < 10) {
      setError("Lý do từ chối cần tối thiểu 10 ký tự.");
      return;
    }

    if (isReject) {
      onReject(request, note.trim());
    } else {
      onApprove(request, note.trim());
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div
          className={
            isReject
              ? "modal-accent reject"
              : "modal-accent approve"
          }
        />

        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <span className="modal-kicker">
              {isReject
                ? "KẾT THÚC LUỒNG"
                : "CHUYỂN BƯỚC KẾ TIẾP"}
            </span>

            <h2 id="modal-title">
              {isReject ? "Từ chối đơn" : "Duyệt đơn"}
            </h2>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Request Information */}
        <div className="modal-request">
          <div className={`avatar avatar-${meta.accent}`}>
            {request.requester
              .split(" ")
              .map((part) => part[0])
              .slice(-2)
              .join("")}
          </div>

          <div>
            <strong>{request.requester}</strong>
            <span>
              {meta.label} · #{request.id}
            </span>
          </div>

          <div className="modal-metric">
            {request.metric}
            <small>{request.metricLabel}</small>
          </div>
        </div>

        <RequestSpecificDetails item={request} inheritColor />

        {/* Note Input */}
        <label className="field-label" htmlFor="note">
          {isReject
            ? "Lý do từ chối *"
            : "Ghi chú cho bước tiếp theo"}

          <span>
            {isReject
              ? "Bắt buộc · tối thiểu 10 ký tự"
              : "Không bắt buộc"}
          </span>
        </label>

        <textarea
          id="note"
          autoFocus
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setError("");
          }}
          placeholder={
            isReject
              ? "Ví dụ: Chưa đủ nhân sự thay ca trong ngày đề xuất..."
              : "Ví dụ: Đã kiểm tra lịch trực team..."
          }
          aria-invalid={Boolean(error)}
        />

        {error && (
          <div className="field-error">
            <CircleAlert size={14} />
            {error}
          </div>
        )}

        {/* Modal Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="text-button"
            onClick={onClose}
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            className={
              isReject
                ? "modal-submit reject-submit"
                : "modal-submit"
            }
            onClick={submit}
          >
            {isReject ? (
              <>
                <XCircle size={16} />
                Từ chối đơn
              </>
            ) : (
              <>
                <Check size={16} />
                Xác nhận duyệt
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
