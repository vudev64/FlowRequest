import React from "react";

// Dùng cùng dữ liệu với GET /api/request/:id và mapApiRequestToEmployee().
// Không tự suy đoán giá trị: dữ liệu chưa lưu sẽ hiển thị “Chưa cung cấp”.
const EMPTY = "Chưa cung cấp";
const LABELS = {
  LEAVE: "Thông tin nghỉ phép",
  OVERTIME: "Thông tin tăng ca",
  ATTENDANCE_ADJUSTMENT: "Thông tin điều chỉnh chấm công",
  ATTENDANCE: "Thông tin điều chỉnh chấm công",
  WFH: "Thông tin làm việc từ xa",
  BUSINESS_TRIP: "Thông tin công tác",
  TRAINING: "Thông tin đào tạo",
  RECRUITMENT: "Thông tin tuyển dụng",
  EQUIPMENT: "Thông tin thiết bị",
  SOFTWARE_LICENSE: "Thông tin bản quyền phần mềm",
  CLOUD_RESOURCE: "Thông tin Cloud Server",
};
const TYPE_BY_LABEL = {
  "Nghỉ phép": "LEAVE", "Đăng ký OT dự án": "OVERTIME",
  "Điều chỉnh chấm công": "ATTENDANCE_ADJUSTMENT",
  "Làm việc từ xa": "WFH", "Làm việc từ xa (WFH)": "WFH",
  "Đăng ký công tác": "BUSINESS_TRIP", "Đăng ký cộng tác": "BUSINESS_TRIP",
  "Đề xuất đào tạo": "TRAINING", "Đề xuất tuyển dụng": "RECRUITMENT",
  "Mua sắm Thiết bị/MacBook": "PURCHASE", "Bản quyền Tool/IDE": "PURCHASE",
  "Tài nguyên Cloud Server": "PURCHASE",
};
const CATEGORY_BY_LABEL = {
  "Mua sắm Thiết bị/MacBook": "EQUIPMENT",
  "Bản quyền Tool/IDE": "SOFTWARE_LICENSE",
  "Tài nguyên Cloud Server": "CLOUD_RESOURCE",
};
const LEAVE_LABELS = {
  ANNUAL: "Nghỉ phép năm", UNPAID: "Nghỉ không lương",
  SICK: "Nghỉ ốm", PERSONAL: "Nghỉ việc riêng", MATERNITY: "Nghỉ thai sản", OTHER: "Nghỉ khác",
};
const DAY_PART_LABELS = { FULL: "Cả ngày", AM: "Nửa ngày (sáng)", PM: "Nửa ngày (chiều)" };

const first = (...values) => values.find((value) => value !== null && value !== undefined && value !== "");
const display = (value) => {
  if (value === null || value === undefined || value === "") return EMPTY;
  if (typeof value === "object") return EMPTY;
  return String(value);
};
const dateText = (value, lang) => {
  if (!value) return EMPTY;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  if (Number.isNaN(d.getTime())) return EMPTY;
  return d.toLocaleDateString(lang === "en" ? "en-GB" : "vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
};
const moneyText = (value) => {
  if (value === null || value === undefined || value === "") return EMPTY;
  const n = Number(value);
  return Number.isFinite(n) ? `${new Intl.NumberFormat("vi-VN").format(n)} đ` : EMPTY;
};
const unitText = (value, unit) => value === null || value === undefined || value === "" ? EMPTY : `${value} ${unit}`;
const row = (label, value) => ({ label, value: display(value) });

export function getSpecificDetailFields(item = {}, lang = "vi") {
  const rawType = first(item.typeCode, item.rawType, TYPE_BY_LABEL[item.type], item.type);
  const type = rawType === 'BUNSINESS_TRIP' ? 'BUSINESS_TRIP' : rawType;
  const category = first(item.category, CATEGORY_BY_LABEL[item.type]);
  const p = item.purchaseDetails || {};
  const x = item.extraDetails || {};
  const d = item.details || {}; // Tương thích một số bản form cũ.

  if (type === "LEAVE") return {
    title: LABELS.LEAVE,
    fields: [
      row("Loại nghỉ phép", LEAVE_LABELS[first(item.leaveType, d.leaveType)] || first(item.leaveType, d.leaveType)),
      row("Ngày bắt đầu", dateText(first(item.startDate, d.startDate), lang)),
      row("Ngày kết thúc", dateText(first(item.endDate, d.endDate), lang)),
      row("Hình thức nghỉ", DAY_PART_LABELS[first(item.dayPart, d.dayPart)] || first(item.dayPart, d.dayPart)),
      row("Số ngày nghỉ", unitText(item.leaveDays, "ngày")),
    ],
  };
  if (type === "OVERTIME") return {
    title: LABELS.OVERTIME,
    fields: [
      row("Tên dự án", first(item.projectName, d.projectName)),
      row("Ngày tăng ca", dateText(first(item.overtimeDate, d.overtimeDate), lang)),
      row("Giờ bắt đầu", first(item.overtimeStart, d.startTime, d.overtimeStart)),
      row("Giờ kết thúc", first(item.overtimeEnd, d.endTime, d.overtimeEnd)),
      row("Tổng giờ OT", unitText(item.overtimeHours, "giờ")),
    ],
  };
  if (type === "PURCHASE") {
    const common = [row("Mã ngân sách", first(p.budgetCode, item.budgetCode, d.budgetCode)), row("Tổng chi phí dự kiến", moneyText(item.amount))];
    if (category === "EQUIPMENT") return {
      title: LABELS.EQUIPMENT,
      fields: [
        row("Tên thiết bị", first(p.deviceName, p.itemName, d.itemName)),
        row("Số lượng", first(p.quantity, d.quantity)),
        row("Đơn giá", moneyText(first(p.unitPrice, d.unitPrice))),
        ...common,
      ],
    };
    if (category === "SOFTWARE_LICENSE") return {
      title: LABELS.SOFTWARE_LICENSE,
      fields: [
        row("Tên phần mềm", first(p.softwareName, p.licenseName, d.licenseName)),
        row("Số lượng license", first(p.licenseCount, p.licenseQuantity, d.licenseQuantity)),
        row("Thời hạn", unitText(first(p.durationMonths, p.licenseMonths, d.licenseMonths), "tháng")),
        ...common,
      ],
    };
    if (category === "CLOUD_RESOURCE") return {
      title: LABELS.CLOUD_RESOURCE,
      fields: [
        row("Nhà cung cấp", first(p.cloudProvider, d.cloudProvider)),
        row("Tài nguyên", first(p.resourceType, p.cloudResource, d.cloudResource)),
        row("Cấu hình", first(p.configuration, d.configuration)),
        row("Thời hạn", unitText(first(p.durationMonths, p.cloudMonths, d.cloudMonths), "tháng")),
        ...common,
      ],
    };
    return { title: "Thông tin mua sắm", fields: common };
  }
  if (type === "ATTENDANCE_ADJUSTMENT" || type === "ATTENDANCE") return {
    title: LABELS.ATTENDANCE_ADJUSTMENT,
    fields: [
      row("Ngày điều chỉnh", dateText(first(x.attendanceDate, d.attendanceDate), lang)),
      row("Giờ vào đề nghị", first(x.actualCheckIn, d.actualCheckIn)),
      row("Giờ ra đề nghị", first(x.actualCheckOut, d.actualCheckOut)),
    ],
  };
  if (type === "WFH") return {
    title: LABELS.WFH,
    fields: [
      row("Ngày bắt đầu", dateText(first(x.fromDate, d.fromDate), lang)),
      row("Ngày kết thúc", dateText(first(x.toDate, d.toDate), lang)),
      row("Địa điểm làm việc", first(x.workLocation, d.workLocation)),
    ],
  };
  if (type === "BUSINESS_TRIP") return {
    title: LABELS.BUSINESS_TRIP,
    fields: [
      row("Ngày đi", dateText(first(x.fromDate, d.fromDate), lang)),
      row("Ngày về", dateText(first(x.toDate, d.toDate), lang)),
      row("Nơi công tác", first(x.destination, d.destination)),
      row("Mục đích công tác", first(x.purpose, d.purpose)),
      row("Chi phí dự kiến", moneyText(item.amount)),
    ],
  };
  if (type === "TRAINING") return {
    title: LABELS.TRAINING,
    fields: [
      row("Khóa học", first(x.courseName, d.courseName)),
      row("Đơn vị đào tạo", first(x.provider, d.provider)),
      row("Ngày bắt đầu", dateText(first(x.fromDate, d.fromDate), lang)),
      row("Ngày kết thúc", dateText(first(x.toDate, d.toDate), lang)),
      row("Học phí", moneyText(item.amount)),
    ],
  };
  if (type === "RECRUITMENT") return {
    title: LABELS.RECRUITMENT,
    fields: [
      row("Vị trí tuyển dụng", first(x.position, d.position)),
      row("Phòng ban tuyển dụng", first(x.requestedDepartment, d.requestedDepartment)),
      row("Số lượng cần tuyển", first(x.headcount, d.headcount)),
    ],
  };
  return null;
}

export default function RequestSpecificDetails({ item, lang = "vi", inheritColor = false }) {
  const section = getSpecificDetailFields(item, lang);
  if (!section) return null;
  return (
    <section className="request-specific-section" aria-label={section.title} style={{ marginTop: 24, marginBottom: 24 }}>
      <h3 style={{ marginBottom: 14, fontSize: 16, color: inheritColor ? 'inherit' : "#263453" }}>{section.title}</h3>
      <div className="detail-grid">
        {section.fields.map(({ label, value }, index) => (
          <div className="detail-field" key={`${label}-${index}`}>
            <span className="detail-label">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
