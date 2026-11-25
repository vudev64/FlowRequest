import { ClipboardCheck } from "lucide-react";
import { HRPageHeader } from "./HRAdminShared";

export function HRApprovalsPage() {
  return (
    <section className="hr-approvals-page">
      <HRPageHeader
        eyebrow={<><ClipboardCheck size={14} /> Hàng đợi phê duyệt</>}
        title="Duyệt phép & OT"
        description="Các đơn đã qua Cấp 1 và đang chờ HR ghi nhận ở bước cuối."
      />
      <div className="approval-summary">
        <span className="pulse-dot" /> Các đơn LEAVE/OT có currentApproverRole = HR_ADMIN
      </div>
    </section>
  );
}