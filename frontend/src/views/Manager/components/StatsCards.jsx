// 4 thẻ thống kê

import {
  CheckCircle2,
  Clock3,
  PackageCheck,
  XCircle,
} from "lucide-react";

import { formatCurrency } from "../ManagerData";

export function StatsCards({ stats }) {
  return (
    <section className="stats-grid">
      <StatCard
        tone="teal"
        icon={<Clock3 size={18} />}
        label="Đơn chờ duyệt"
        value={stats.pending}
        helper={stats.pending > 0 ? "Cần bạn xử lý" : "Đã xử lý hết"}
      />

      <StatCard
        tone="green"
        icon={<CheckCircle2 size={18} />}
        label="Đã duyệt trong tháng"
        value={stats.approved}
        helper="Manager cấp 1"
      />

      <StatCard
        tone="coral"
        icon={<XCircle size={18} />}
        label="Đã từ chối trong tháng"
        value={stats.rejected}
        helper="Luồng đã kết thúc"
      />

      <StatCard
        tone="amber"
        icon={<PackageCheck size={18} />}
        label="Mua sắm đang chờ"
        value={formatCurrency(stats.pendingPurchase)}
        helper="Chuyển tới Accountant"
      />
    </section>
  );
}

function StatCard({ icon, label, value, helper, tone }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-top">
        <div className="stat-icon">{icon}</div>
        <span className="stat-kicker">Tháng 10</span>
      </div>

      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-helper">{helper}</div>
    </div>
  );
}
