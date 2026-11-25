import { apiRequest } from '../../lib/api';
import { mapApiRequestToEmployee } from './EmployeeData';

export async function loadEmployeeRequest(item, lang, signal) {
  const id = String(item?.id || item?._id || '');
  if (!id) throw new Error('Không xác định được đơn cần xem.');
  const result = await apiRequest('/request/' + encodeURIComponent(id), { signal });
  if (!result.data || Array.isArray(result.data) || String(result.data._id || result.data.id) !== id) throw new Error('Dữ liệu chi tiết đơn không hợp lệ.');
  return mapApiRequestToEmployee(result.data, lang);
}

export function loadEmployeeAttachment(item) {
  const id = String(item?.id || item?._id || '');
  if (!id) throw new Error('Không xác định được đơn cần tải tệp.');
  return apiRequest('/request/' + encodeURIComponent(id) + '/attachment', { binary: true });
}
