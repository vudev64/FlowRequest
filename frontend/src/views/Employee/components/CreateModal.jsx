import { useState } from "react";
import { ArrowUpRight, ChevronDown, CircleHelp, X } from "lucide-react";
import { requestTypeOptions } from "../EmployeeData";
import { useSystemConfiguration } from '../../SystemConfiguration';
import DynamicRequestFields, {
  EMPTY_REQUEST_DETAILS,
  getRequestKind,
  getRequestExtraPayload,
  validateRequestDetails,
} from "./DynamicRequestFields";

// Typed details are sent through the existing API without changing its workflow.
export default function CreateModal({ lang = "vi", t, onClose, onSubmit }) {
  const { settings, error: settingsError } = useSystemConfiguration();
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState(requestTypeOptions[1]);
  const [description, setDescription] = useState("");
  const [budgetCode, setBudgetCode] = useState("");
  const [details, setDetails] = useState({ ...EMPTY_REQUEST_DETAILS });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const kind = getRequestKind(type);
  const isPurchase = ["DEVICE", "LICENSE", "CLOUD"].includes(kind);

  const calculatedAmount = kind === "DEVICE"
    ? Number(details.quantity || 0) * Number(details.unitPrice || 0)
    : kind === "LICENSE"
      ? Number(details.licenseCost || 0)
      : kind === "CLOUD"
        ? Number(details.cloudCost || 0)
        : kind === "TRIP" ? Number(details.tripCost || 0)
        : kind === "TRAINING" ? Number(details.trainingCost || 0)
        : 0;
  const amount = Number.isFinite(calculatedAmount) && calculatedAmount >= 0
    ? calculatedAmount
    : 0;

  const handleTypeChange = (event) => {
    setType(event.target.value);
    setDetails({ ...EMPTY_REQUEST_DETAILS });
    setBudgetCode("");
    setError("");
  };

  const handleSubmit = async (isSubmit) => {
    if (submitting) return;
    setError("");
    if (!isSubmit && !title.trim()) {
      // Bản nháp cho phép tiêu đề mặc định, giống Backend hiện tại.
    }
    if (isSubmit && (!title.trim() || !description.trim())) {
      setError(lang === "vi"
        ? "Vui lòng nhập tên đề xuất và lý do/mô tả."
        : "Please enter a title and description.");
      return;
    }
    if (isSubmit) {
      const validationError = validateRequestDetails(type, details);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    // Giữ giao diện với giao thức onSubmit(draft, isSubmit) hiện tại.
    // amount ở dạng chuỗi số để mapEmployeeDraftToApi xử lý đúng.
    const draft = {
      attachmentFile,
      title,
      type,
      value: String(amount),
      description,
      budgetCode,
      ...getRequestExtraPayload(type, details),
    };
    try {
      setSubmitting(true);
      await Promise.resolve(onSubmit(draft, isSubmit));
    } catch (err) {
      setError(err?.message || "Không thể lưu đơn, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-layer">
      <button className="drawer-backdrop" onClick={onClose} aria-label={t.close} />
      <div className="create-modal" role="dialog" aria-modal="true" aria-label={t.createTitle}>
        <div className="modal-header">
          <div>
            <div className="drawer-overline">NEW REQUEST <span>•</span> STEP 01</div>
            <h2>{t.createTitle}</h2>
            <p>{t.createDesc}</p>
          </div>
          <button className="icon-button bordered" onClick={onClose} aria-label={t.close}>
            <X size={17} />
          </button>
        </div>

        <div className="modal-body">
          <label>
            {t.proposalName}
            <input value={title} onChange={(event) => setTitle(event.target.value)}
              placeholder={kind === "LEAVE" ? "Đơn xin nghỉ phép" : t.proposalNamePlaceholder} />
          </label>

          <label>
            {t.requestType}
            <div className="select-wrap full">
              <select value={type} onChange={handleTypeChange}>
                {requestTypeOptions.slice(1).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <ChevronDown size={14} />
            </div>
          </label>

          <DynamicRequestFields type={type} value={details} onChange={setDetails} />

          {(isPurchase || kind === "TRIP" || kind === "TRAINING") && (
            <div className="form-grid" style={{ marginTop: 16 }}>
              <label>
                {lang === "vi" ? "Tổng giá trị dự kiến" : "Estimated total"}
                <input readOnly value={amount.toLocaleString("vi-VN") + " ₫"} />
              </label>
              {isPurchase && <label>
                {lang === "vi" ? "Mã ngân sách (nếu có)" : "Budget code (optional)"}
                <input value={budgetCode} onChange={(event) => setBudgetCode(event.target.value)}
                  placeholder="ENG-2026-XXX" />
              </label>}
            </div>
          )}

          <label style={{ marginTop: 16 }}>
            {kind === "LEAVE"
              ? (lang === "vi" ? "Lý do nghỉ phép" : "Leave reason")
              : kind === "OVERTIME"
                ? (lang === "vi" ? "Lý do tăng ca" : "Overtime reason")
                : t.reason}
            <textarea value={description} onChange={(event) => setDescription(event.target.value)}
              placeholder={lang === "vi" ? "Mô tả nhu cầu và lý do đề xuất..." : "Describe the request and reason..."}
              rows={4} />
          </label>

          <label>{lang === 'vi' ? 'Tệp đính kèm (không bắt buộc)' : 'Attachment (optional)'}
            <input type="file" disabled={submitting || !settings?.attachments} accept={settings?.attachments?.extensions.join(',')} onChange={event => {
              const file = event.target.files?.[0];
              if (!file) { setAttachmentFile(null); return; }
              const policy = settings?.attachments;
              const extension = '.' + file.name.split('.').at(-1).toLowerCase();
              if (!policy || !policy.extensions.includes(extension) || file.size > policy.maxSizeMB * 1024 * 1024) {
                setError(lang === 'vi' ? 'Tệp không phù hợp chính sách hiện tại.' : 'File does not meet the current upload policy.');
                event.target.value = ''; setAttachmentFile(null); return;
              }
              setError(''); setAttachmentFile(file);
            }} />
            <small>{settings?.attachments ? `${settings.attachments.maxSizeMB} MB · ${settings.attachments.extensions.join(', ')}` : settingsError ? (lang === 'vi' ? 'Chưa tải được chính sách tệp. Vui lòng tải lại trang.' : 'File policy is unavailable. Please reload.') : (lang === 'vi' ? 'Đang tải chính sách tệp…' : 'Loading file policy…')}</small>
          </label>
          <div className="form-hint">
            <CircleHelp size={14} />
            {lang === "vi"
              ? "Thông tin sẽ được lưu theo loại đề xuất và chuyển đến người duyệt phù hợp."
              : "Request details are saved according to type and routed for approval."}
          </div>
          {error && <p role="alert" style={{ color: "#b42318", marginTop: 12 }}>{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="ghost-button" onClick={onClose} disabled={submitting}>{t.close}</button>
          <button className="ghost-button" onClick={() => handleSubmit(false)} disabled={submitting}>
            {t.saveDraft}
          </button>
          <button className="primary-button" onClick={() => handleSubmit(true)} disabled={submitting}>
            {t.submit} <ArrowUpRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
