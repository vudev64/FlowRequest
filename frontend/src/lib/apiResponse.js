import { assertApiEnvironment } from './environment.js';

export async function readApiResponse(response, path) {
  assertApiEnvironment(response);
  const responseText = await response.text();
  let result;
  try {
    result = responseText ? JSON.parse(responseText) : {};
  } catch {
    const message = response.status === 404
      ? 'Chức năng này chưa có trên máy chủ (404). Vui lòng liên hệ quản trị hệ thống.'
      : 'Máy chủ trả về trang web thay vì dữ liệu API. Vui lòng kiểm tra cấu hình kết nối.';
    const error = new Error(message);
    error.status = response.status;
    error.path = path;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(result?.message || `Yêu cầu thất bại (${response.status}).`);
    error.status = response.status;
    error.path = path;
    error.errors = result?.errors;
    throw error;
  }
  return result;
}
