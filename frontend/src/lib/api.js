import { readApiResponse } from './apiResponse';
import { IS_DEMO, TOKEN_KEY, assertApiEnvironment } from './environment';

export const API_BASE_URL =
  (IS_DEMO ? import.meta.env.VITE_DEMO_API_URL || '/demo-api' : import.meta.env.VITE_PRODUCTION_API_URL || '/api').replace(/\/$/, '');

export async function apiRequest(path, { method = "GET", body, signal, binary = false } = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = {};
  const isMultipart = typeof FormData !== 'undefined' && body instanceof FormData;

  if (body !== undefined && !isMultipart) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : isMultipart ? body : JSON.stringify(body),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error(
      "Không thể kết nối máy chủ. Hãy kiểm tra backend và cấu hình API.",
    );
  }

  if (binary && response.ok) {
    assertApiEnvironment(response);
    if (response.headers.get('content-type')?.includes('text/html')) throw new Error('Máy chủ trả về trang web thay vì tệp đính kèm.');
    return response.blob();
  }
  return readApiResponse(response, path);
}
