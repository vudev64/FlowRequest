// API bảo mật và luồng xử lý
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  FileText,
  LockKeyhole,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

export function SecurityPanel({ apiMessage, setApiMessage }) {
  const layers = [
    {
      name: "authenticate",
      desc: "Xác thực session và currentUser",
    },
    {
      name: "authorizeRoles('MANAGER')",
      desc: "Chỉ role MANAGER được đi tiếp",
    },
    {
      name: "loadTeamRequest",
      desc: "Kiểm tra requester.managerId",
    },
    {
      name: "validateTransition",
      desc: "Chỉ PENDING mới được xử lý",
    },
  ];

  const simulate = (code) => {
    const messages = {
      "403": {
        title: "Forbidden · Sai quyền truy cập",
        detail:
          "Role MANAGER không hợp lệ hoặc request không thuộc team.",
      },
      "409": {
        title: "Conflict · Đơn đã được xử lý",
        detail:
          "Trạng thái hiện tại không còn là PENDING. Không thể xử lý lại.",
      },
      "422": {
        title: "Validation Error · Dữ liệu không hợp lệ",
        detail:
          "Trường note khi từ chối phải có tối thiểu 10 ký tự.",
      },
    };

    setApiMessage({
      code,
      ...messages[code],
    });
  };

  return (
    <>
      <PageIntro
        eyebrow="DEVELOPER CONSOLE"
        title="API & bảo mật"
        desc="Khu vực mô phỏng để kiểm tra các lớp bảo vệ của API Manager trước khi nối backend thật."
        actions={
          <div className="demo-badge">
            <span className="live-dot" />
            API giả lập
          </div>
        }
      />

      <div className="security-grid">
        {/* Middleware Chain */}
        <section className="panel security-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">MIDDLEWARE CHAIN</span>
              <h2>Lớp bảo vệ request</h2>
            </div>

            <ShieldCheck size={22} className="panel-heading-icon" />
          </div>

          <p className="panel-desc">
            Role check một mình chưa đủ. Mọi request cần đi qua đủ lớp kiểm
            tra ownership và transition.
          </p>

          <div className="layer-list">
            {layers.map((layer, index) => (
              <div className="layer-row" key={layer.name}>
                <div className="layer-index">
                  0{index + 1}
                </div>

                <div className="layer-copy">
                  <strong>{layer.name}</strong>
                  <span>{layer.desc}</span>
                </div>

                <span className="required-pill">
                  <Check size={12} />
                  Bắt buộc
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* API Error Simulation */}
        <section className="panel test-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">FAULT INJECTION</span>
              <h2>Thử lỗi API</h2>
            </div>

            <CircleAlert
              size={22}
              className="panel-heading-icon warning"
            />
          </div>

          <p className="panel-desc">
            Bấm để xem cách UI phản hồi các lỗi thường gặp từ
            `/api/manager`.
          </p>

          <div className="error-buttons">
            <button type="button" onClick={() => simulate("403")}>
              <span>403</span>

              <div>
                <strong>Forbidden</strong>
                <small>Sai quyền hoặc ngoài team</small>
              </div>

              <ArrowRight size={16} />
            </button>

            <button type="button" onClick={() => simulate("409")}>
              <span>409</span>

              <div>
                <strong>Conflict</strong>
                <small>Đơn đã được xử lý trước đó</small>
              </div>

              <ArrowRight size={16} />
            </button>

            <button type="button" onClick={() => simulate("422")}>
              <span>422</span>

              <div>
                <strong>Validation</strong>
                <small>Lý do từ chối chưa đủ dài</small>
              </div>

              <ArrowRight size={16} />
            </button>
          </div>

          {apiMessage && (
            <div className="api-result">
              <div className="api-code">{apiMessage.code}</div>

              <div>
                <strong>{apiMessage.title}</strong>
                <span>{apiMessage.detail}</span>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={() => setApiMessage(null)}
                aria-label="Đóng thông báo"
              >
                <X size={15} />
              </button>
            </div>
          )}
        </section>
      </div>

      {/* System Workflow */}
      <section className="panel workflow-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">SYSTEM WORKFLOW</span>
            <h2>Luồng xử lý đơn</h2>
          </div>

          <CheckCircle2 size={22} className="panel-heading-icon" />
        </div>

        <p className="panel-desc">
          Theo dõi đơn đi qua từng bước sau khi nhân viên gửi yêu cầu.
        </p>

        <div className="workflow-track">
          <div className="workflow-step done">
            <div className="workflow-node">
              <FileText size={15} />
            </div>

            <div>
              <strong>Nhân viên gửi đơn</strong>
              <span>Đơn được tạo với trạng thái PENDING</span>
            </div>
          </div>

          <div className="workflow-connector done" />

          <div className="workflow-step active">
            <div className="workflow-node">
              <Users size={15} />
            </div>

            <div>
              <strong>Manager duyệt cấp 1</strong>
              <span>Kiểm tra ownership và nội dung đơn</span>
            </div>
          </div>

          <div className="workflow-connector" />

          <div className="workflow-step">
            <div className="workflow-node">
              <ArrowRight size={15} />
            </div>

            <div>
              <strong>Chuyển bước tiếp theo</strong>
              <span>
                LEAVE/OT → HR_ADMIN · PURCHASE → ACCOUNTANT
              </span>
            </div>
          </div>
        </div>

        <div className="workflow-footer">
          <div>
            <span className="status-dot" />
            <strong>Hệ thống đang hoạt động</strong>
            <span>Luồng phê duyệt sẵn sàng tiếp nhận đơn mới</span>
          </div>

          <div className="workflow-rule">
            <LockKeyhole size={14} />
            Chỉ Manager đúng team được xử lý
          </div>
        </div>
      </section>
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
