import React from 'react';

// Component chỉ quản lý những trường riêng của từng loại đề xuất.
// Props:
//   type: tên loại đã chọn từ EmployeeData.js
//   value: object chứa trường đặc thù, ví dụ { startDate: '2026-11-20' }
//   onChange: (nextValue) => void
// Không tự gửi API: ghép với form hiện tại để giữ nguyên các tính năng đang có.

export const EMPTY_REQUEST_DETAILS = {
  leaveType: 'ANNUAL', startDate: '', endDate: '', dayPart: 'FULL',
  projectName: '', overtimeDate: '', startTime: '', endTime: '',
  itemName: '', quantity: '1', unitPrice: '',
  licenseName: '', licenseQuantity: '1', licenseMonths: '12', licenseCost: '',
  cloudProvider: '', cloudResource: '', cloudMonths: '1', cloudCost: '',
  attendanceDate:'', actualCheckIn:'', actualCheckOut:'', fromDate:'', toDate:'',
  workLocation:'', destination:'', purpose:'', tripCost:'', courseName:'',
  provider:'', trainingCost:'', position:'', headcount:'1', requestedDepartment:'',
};

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '12px 14px',
  border: '1px solid #dce1ee', borderRadius: 10,
  background: '#fff', color: '#263453', font: 'inherit',
};
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 };
const fieldStyle = { display: 'grid', gap: 7, minWidth: 0 };
const labelStyle = { fontWeight: 600, fontSize: 14, color: '#27324d' };

export function getRequestKind(type) {
  const kinds = {
    'Nghỉ phép': 'LEAVE',
    'Đăng ký OT dự án': 'OVERTIME',
    'Mua sắm Thiết bị/MacBook': 'DEVICE',
    'Bản quyền Tool/IDE': 'LICENSE',
    'Tài nguyên Cloud Server': 'CLOUD',
    'Điều chỉnh chấm công': 'ATTENDANCE',
    'Làm việc từ xa (WFH)': 'WFH',
    'Làm việc từ xa': 'WFH',
    'Đăng ký công tác': 'TRIP',
    'Đăng ký cộng tác': 'TRIP',
    'Đề xuất đào tạo': 'TRAINING',
    'Đề xuất tuyển dụng': 'RECRUITMENT',
  };
  return kinds[type] ?? null;
}

function Field({ label, children }) {
  return <label style={fieldStyle}><span style={labelStyle}>{label}</span>{children}</label>;
}

export function validateRequestDetails(type, details = {}) {
  const kind = getRequestKind(type);
  if (!kind) return 'Vui lòng chọn loại đề xuất hợp lệ.';
  const required = (key) => String(details[key] ?? '').trim().length > 0;
  const positive = (key) => Number.isFinite(Number(details[key])) && Number(details[key]) > 0;

  if (kind === 'LEAVE') {
    if (!required('startDate') || !required('endDate')) return 'Vui lòng chọn ngày bắt đầu và kết thúc nghỉ phép.';
    if (details.endDate < details.startDate) return 'Ngày kết thúc không được trước ngày bắt đầu.';
    if (!['ANNUAL', 'SICK', 'PERSONAL', 'UNPAID'].includes(details.leaveType)) return 'Loại nghỉ phép không hợp lệ.';
    if (!['FULL', 'AM', 'PM'].includes(details.dayPart)) return 'Hình thức nghỉ không hợp lệ.';
    if (details.dayPart !== 'FULL' && details.startDate !== details.endDate) return 'Nghỉ nửa ngày chỉ áp dụng cho một ngày.';
  }
  if (kind === 'OVERTIME') {
    if (!required('projectName') || !required('overtimeDate') || !required('startTime') || !required('endTime')) {
      return 'Vui lòng nhập dự án, ngày và khoảng giờ tăng ca.';
    }
    if (details.endTime <= details.startTime) return 'Giờ kết thúc phải sau giờ bắt đầu (OT qua đêm cần quy tắc riêng).';
  }
  if (kind === 'DEVICE' && (!required('itemName') || !positive('quantity') || !positive('unitPrice'))) {
    return 'Vui lòng nhập tên thiết bị, số lượng và đơn giá hợp lệ.';
  }
  if (kind === 'LICENSE' && (!required('licenseName') || !positive('licenseQuantity') || !positive('licenseMonths') || !positive('licenseCost'))) {
    return 'Vui lòng nhập tên phần mềm, số license, thời hạn và chi phí.';
  }
  if (kind === 'CLOUD' && (!required('cloudProvider') || !required('cloudResource') || !positive('cloudMonths') || !positive('cloudCost'))) {
    return 'Vui lòng nhập nhà cung cấp, tài nguyên Cloud, thời hạn và chi phí.';
  }
  if (kind === 'ATTENDANCE' && (!required('attendanceDate') || !required('actualCheckIn') || !required('actualCheckOut') || details.actualCheckIn >= details.actualCheckOut)) return 'Nhập ngày và giờ chấm công hợp lệ.';
  if (kind === 'WFH' && (!required('fromDate') || !required('toDate') || !required('workLocation') || details.toDate < details.fromDate)) return 'Nhập thời gian và địa điểm WFH hợp lệ.';
  if (kind === 'TRIP' && (!required('fromDate') || !required('toDate') || !required('destination') || !required('purpose') || details.toDate < details.fromDate || Number(details.tripCost || 0) < 0)) return 'Nhập thông tin công tác và chi phí hợp lệ.';
  if (kind === 'TRAINING' && (!required('courseName') || !required('provider') || !required('fromDate') || !required('toDate') || details.toDate < details.fromDate || Number(details.trainingCost || 0) < 0)) return 'Nhập thông tin đào tạo hợp lệ.';
  if (kind === 'RECRUITMENT' && (!required('position') || !required('requestedDepartment') || !Number.isInteger(Number(details.headcount)) || Number(details.headcount) < 1)) return 'Nhập vị trí, phòng ban và số lượng tuyển dụng.';
  return null;
}

// Return the typed fields already supported by the current Backend.
export function getRequestExtraPayload(type, details = {}) {
  const kind = getRequestKind(type);
  switch (kind) {
    case 'LEAVE': return {
      leaveType: details.leaveType,
      startDate: details.startDate,
      endDate: details.endDate,
      dayPart: details.dayPart,
    };
    case 'OVERTIME': return {
      projectName: details.projectName,
      overtimeDate: details.overtimeDate,
      overtimeStart: details.startTime,
      overtimeEnd: details.endTime,
    };
    case 'DEVICE': return { purchaseDetails: {
      deviceName: details.itemName,
      quantity: Number(details.quantity),
      unitPrice: Number(details.unitPrice),
    }};
    case 'LICENSE': return { purchaseDetails: {
      softwareName: details.licenseName,
      licenseCount: Number(details.licenseQuantity),
      durationMonths: Number(details.licenseMonths),
    }};
    case 'CLOUD': return { purchaseDetails: {
      cloudProvider: details.cloudProvider,
      resourceType: details.cloudResource,
      durationMonths: Number(details.cloudMonths),
    }};
    case 'ATTENDANCE': return { extraDetails: { attendanceDate:details.attendanceDate, actualCheckIn:details.actualCheckIn, actualCheckOut:details.actualCheckOut } };
    case 'WFH': return { extraDetails: { fromDate:details.fromDate, toDate:details.toDate, workLocation:details.workLocation } };
    case 'TRIP': return { extraDetails: { fromDate:details.fromDate, toDate:details.toDate, destination:details.destination, purpose:details.purpose } };
    case 'TRAINING': return { extraDetails: { courseName:details.courseName, provider:details.provider, fromDate:details.fromDate, toDate:details.toDate } };
    case 'RECRUITMENT': return { extraDetails: { position:details.position, requestedDepartment:details.requestedDepartment, headcount:Number(details.headcount) } };
    default: return {};
  }
}

export default function DynamicRequestFields({ type, value = EMPTY_REQUEST_DETAILS, onChange }) {
  const kind = getRequestKind(type);
  const field = (key, inputType = 'text', placeholder = '') => ({
    type: inputType, value: value[key] ?? '', placeholder,
    onChange: (event) => onChange({ ...value, [key]: event.target.value }),
    style: inputStyle,
  });
  const select = (key, options) => (
    <select value={value[key] ?? options[0][0]} onChange={(e) => onChange({ ...value, [key]: e.target.value })} style={inputStyle}>
      {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
    </select>
  );

  if (!kind) return null;
  return (
    <section style={{ display: 'grid', gap: 16, marginTop: 20 }}>
      <div style={{ borderTop: '1px solid #e5e8f1', paddingTop: 16, fontWeight: 700, color: '#27324d' }}>
        Thông tin {kind === 'LEAVE' ? 'nghỉ phép' : kind === 'OVERTIME' ? 'tăng ca' : kind === 'DEVICE' ? 'thiết bị' : kind === 'LICENSE' ? 'bản quyền phần mềm' : 'Cloud Server'}
      </div>
      {kind === 'LEAVE' && <>
        <Field label="Loại nghỉ phép">{select('leaveType', [['ANNUAL', 'Nghỉ phép năm'], ['SICK', 'Nghỉ ốm'], ['PERSONAL', 'Nghỉ việc riêng'], ['UNPAID', 'Nghỉ không lương']])}</Field>
        <div style={gridStyle}>
          <Field label="Từ ngày"><input {...field('startDate', 'date')} /></Field>
          <Field label="Đến ngày"><input {...field('endDate', 'date')} /></Field>
        </div>
        <Field label="Hình thức nghỉ">{select('dayPart', [['FULL', 'Cả ngày'], ['AM', 'Buổi sáng (nửa ngày)'], ['PM', 'Buổi chiều (nửa ngày)']])}</Field>
        <small style={{ color: '#69758e' }}>Số ngày phép cần được Backend tính theo lịch làm việc và ngày lễ của công ty.</small>
      </>}
      {kind === 'OVERTIME' && <>
        <Field label="Tên dự án"><input {...field('projectName', 'text', 'Ví dụ: ERP nội bộ')} /></Field>
        <Field label="Ngày tăng ca"><input {...field('overtimeDate', 'date')} /></Field>
        <div style={gridStyle}>
          <Field label="Từ giờ"><input {...field('startTime', 'time')} /></Field>
          <Field label="Đến giờ"><input {...field('endTime', 'time')} /></Field>
        </div>
      </>}
      {kind === 'DEVICE' && <>
        <Field label="Tên thiết bị"><input {...field('itemName', 'text', 'MacBook Pro, màn hình...')} /></Field>
        <div style={gridStyle}>
          <Field label="Số lượng"><input {...field('quantity', 'number')} min="1" step="1" /></Field>
          <Field label="Đơn giá dự kiến (VNĐ)"><input {...field('unitPrice', 'number')} min="0" step="1" /></Field>
        </div>
      </>}
      {kind === 'LICENSE' && <>
        <Field label="Tên phần mềm"><input {...field('licenseName', 'text', 'JetBrains, Figma...')} /></Field>
        <div style={gridStyle}>
          <Field label="Số license"><input {...field('licenseQuantity', 'number')} min="1" step="1" /></Field>
          <Field label="Thời hạn (tháng)"><input {...field('licenseMonths', 'number')} min="1" step="1" /></Field>
        </div>
        <Field label="Tổng chi phí dự kiến (VNĐ)"><input {...field('licenseCost', 'number')} min="0" step="1" /></Field>
      </>}
      {kind === 'ATTENDANCE' && <>
        <Field label="Ngày điều chỉnh"><input {...field('attendanceDate','date')} /></Field>
        <div style={gridStyle}><Field label="Giờ vào thực tế"><input {...field('actualCheckIn','time')} /></Field><Field label="Giờ ra thực tế"><input {...field('actualCheckOut','time')} /></Field></div>
      </>}
      {kind === 'WFH' && <>
        <div style={gridStyle}><Field label="Từ ngày"><input {...field('fromDate','date')} /></Field><Field label="Đến ngày"><input {...field('toDate','date')} /></Field></div>
        <Field label="Địa điểm làm việc"><input {...field('workLocation','text','Tại nhà, địa điểm khác...')} /></Field>
      </>}
      {kind === 'TRIP' && <>
        <div style={gridStyle}><Field label="Từ ngày"><input {...field('fromDate','date')} /></Field><Field label="Đến ngày"><input {...field('toDate','date')} /></Field></div>
        <Field label="Nơi công tác"><input {...field('destination','text')} /></Field>
        <Field label="Mục đích công tác"><input {...field('purpose','text')} /></Field>
        <Field label="Chi phí dự kiến (VNĐ)"><input {...field('tripCost','number')} min="0" /></Field>
      </>}
      {kind === 'TRAINING' && <>
        <Field label="Tên khóa học"><input {...field('courseName','text')} /></Field>
        <Field label="Đơn vị đào tạo"><input {...field('provider','text')} /></Field>
        <div style={gridStyle}><Field label="Từ ngày"><input {...field('fromDate','date')} /></Field><Field label="Đến ngày"><input {...field('toDate','date')} /></Field></div>
        <Field label="Học phí dự kiến (VNĐ)"><input {...field('trainingCost','number')} min="0" /></Field>
      </>}
      {kind === 'RECRUITMENT' && <>
        <Field label="Vị trí tuyển dụng"><input {...field('position','text')} /></Field>
        <Field label="Phòng ban tuyển dụng"><input {...field('requestedDepartment','text')} /></Field>
        <Field label="Số lượng cần tuyển"><input {...field('headcount','number')} min="1" step="1" /></Field>
      </>}
      {kind === 'CLOUD' && <>
        <Field label="Nhà cung cấp"><input {...field('cloudProvider', 'text', 'AWS, Azure, Google Cloud...')} /></Field>
        <Field label="Loại tài nguyên"><input {...field('cloudResource', 'text', 'VM, Database, Storage...')} /></Field>
        <div style={gridStyle}>
          <Field label="Thời hạn sử dụng (tháng)"><input {...field('cloudMonths', 'number')} min="1" step="1" /></Field>
          <Field label="Tổng chi phí dự kiến (VNĐ)"><input {...field('cloudCost', 'number')} min="0" step="1" /></Field>
        </div>
      </>}
    </section>
  );
}
