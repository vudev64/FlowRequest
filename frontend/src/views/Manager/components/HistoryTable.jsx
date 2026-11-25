// Lịch sử tìm kiếm
import { useState } from "react";

import {
  ArrowRight,
  Check,
  Search,
  X,
} from "lucide-react";

import { typeMeta } from "../ManagerData";

export function HistoryTable({ history = [] }) {
  const [search, setSearch] = useState("");

  const filtered = history.filter((item) =>
    `${item.requester} ${item.id} ${item.department}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const approvedCount = history.filter(
    (item) => item.outcome === "APPROVED"
  ).length;

  const rejectedCount = history.filter(
    (item) => item.outcome === "REJECTED"
  ).length;

  return (
    <>
      <PageIntro
        eyebrow="AUDIT TRAIL"
        title="Lịch sử phê duyệt"
        desc="Toàn bộ quyết định Manager đã xử lý trong team, mới nhất ở trên."
        actions={
          <div className="search-box history-search">
            <Search size={16} />

            <input
              aria-label="Tìm lịch sử"
              placeholder="Tìm trong lịch sử"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        }
      />

      {/* History Summary */}
      <div className="history-summary">
        <div>
          <div className="summary-number">{history.length}</div>

          <div>
            <strong>quyết định</strong>
            <span>đã ghi nhận trong tháng</span>
          </div>
        </div>

        <div className="summary-divider" />

        <div>
          <div className="mini-legend green" />

          <div>
            <strong>{approvedCount} đơn đã duyệt</strong>
            <span>Chuyển sang bước kế tiếp</span>
          </div>
        </div>

        <div>
          <div className="mini-legend coral" />

          <div>
            <strong>{rejectedCount} đơn từ chối</strong>
            <span>Kết thúc luồng</span>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Thời điểm xử lý</th>
                <th>Nhân viên</th>
                <th>Loại đơn</th>
                <th>Kết quả</th>
                <th>Chuyển tới</th>
                <th>Ghi chú</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((item) => {
                const meta = typeMeta[item.type];
                const Icon = meta.icon;

                return (
                  <tr key={`${item.id}-${item.processedAt}`}>
                    <td>
                      <strong>{item.processedAt}</strong>
                      <span className="muted-cell">#{item.id}</span>
                    </td>

                    <td>
                      <div className="table-person">
                        <div
                          className={`avatar avatar-${meta.accent} avatar-sm`}
                        >
                          {item.requester
                            .split(" ")
                            .map((part) => part[0])
                            .slice(-2)
                            .join("")}
                        </div>

                        <div>
                          <strong>{item.requester}</strong>
                          <span>{item.department}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`type-badge compact ${meta.className}`}
                      >
                        <Icon size={13} />
                        {meta.label}
                      </span>
                    </td>

                    <td>
                      <span
                        className={
                          item.outcome === "APPROVED"
                            ? "result-badge approved"
                            : "result-badge rejected"
                        }
                      >
                        {item.outcome === "APPROVED" ? (
                          <Check size={13} />
                        ) : (
                          <X size={13} />
                        )}

                        {item.outcome === "APPROVED"
                          ? "Đã duyệt"
                          : "Từ chối"}
                      </span>
                    </td>

                    <td>
                      {item.outcome === "APPROVED" ? (
                        <span className="role-cell">
                          <ArrowRight size={14} />
                          {item.nextRole}
                        </span>
                      ) : (
                        <span className="muted-cell">—</span>
                      )}
                    </td>

                    <td>
                      <span className="note-cell">{item.note}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="table-empty">
              Không tìm thấy dữ liệu phù hợp.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function PageIntro({ eyebrow, title, desc, actions }) {
  return (
    <div className="page-intro">
      <div>
        <div className="eyebrow">
          <span className="eyebrow-line" />
          {eyebrow}
        </div>

        <h1>{title}</h1>
        <p>{desc}</p>
      </div>

      {actions && (
        <div className="intro-actions">
          {actions}
        </div>
      )}
    </div>
  );
}
