import { FileSpreadsheet, Plus, Users } from "lucide-react";
import { HRPageHeader } from "./HRAdminShared";

/**
 * Khung page quản lý nhân sự; bảng/modal hiện đã được render trong HRAdminDashboard.
 * @param {{ onCreate?: () => void, onImport?: () => void }} props
 */
export function HRAccountPage({ onCreate, onImport }) {
  return (
    <section className="hr-account-page">
      <HRPageHeader
        eyebrow={<><Users size={14} /> Danh mục nhân sự</>}
        title="Quản lý nhân sự & cấp tài khoản"
        description="Quản lý thông tin, vai trò và trạng thái truy cập của nhân sự toàn công ty."
        action={
          <button className="primary-button" onClick={onCreate}>
            <Plus size={17} /> Cấp tài khoản mới
          </button>
        }
      />
      <div className="toolbar">
        <button className="secondary-button" onClick={onImport}>
          <FileSpreadsheet size={16} /> Import Excel
        </button>
      </div>
    </section>
  );
}