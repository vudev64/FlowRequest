import { ShieldCheck } from "lucide-react";
import { HR_API_GUARDS, HR_PERMISSION_MATRIX } from "./HRAdminData";
import { HRPageHeader } from "./HRAdminShared";

const mark = (allowed) => (allowed ? "✓" : "—");

export function HRPermissionsPage() {
  return (
    <section className="hr-permissions-page">
      <HRPageHeader
        eyebrow={<><ShieldCheck size={14} /> Kiểm soát truy cập</>}
        title="Phân quyền & liên kết"
        description="Ma trận quyền và các lớp bảo vệ dành riêng cho HR_ADMIN."
      />

      <div className="permission-card">
        <table className="matrix">
          <thead>
            <tr>
              <th>Quyền</th>
              <th>SYSTEM_ADMIN</th>
              <th>HR_ADMIN</th>
              <th>DIRECTOR</th>
            </tr>
          </thead>
          <tbody>
            {HR_PERMISSION_MATRIX.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{mark(row.SYSTEM_ADMIN)}</td>
                <td>{mark(row.HR_ADMIN)}</td>
                <td>{mark(row.DIRECTOR)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="test-list">
          {HR_API_GUARDS.map((test) => (
            <div className="test-row" key={test.action}>
              <span>{test.action}</span>
              <code>{test.code}</code>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}