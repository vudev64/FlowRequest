export const PRODUCTION_ENABLED = import.meta.env?.VITE_ENABLE_PRODUCTION !== 'false';
export function environmentForPath(pathname) {
  return !PRODUCTION_ENABLED || /^\/demo(?:\/|$)/.test(pathname || '') ? 'demo' : 'production';
}
const browserPath = typeof window !== 'undefined' ? window.location?.pathname : undefined;
// A full document load selects one immutable API/session context for all roles.
// SSR fixtures can still explicitly select a build mode without a browser URL.
export const APP_ENV = !PRODUCTION_ENABLED ? 'demo' : browserPath === undefined ? import.meta.env?.VITE_APP_ENV || 'production' : environmentForPath(browserPath);
if (!['demo', 'production'].includes(APP_ENV)) throw new Error('Môi trường Frontend không hợp lệ.');
export const IS_DEMO = APP_ENV === 'demo';
export const APP_BASE_PATH = browserPath !== undefined && /^\/demo(?:\/|$)/.test(browserPath) ? '/demo' : '';
export const DEMO_LOGIN_URL = PRODUCTION_ENABLED ? '/demo/dang-nhap-demo' : '/dang-nhap-demo';
export const PRODUCTION_LOGIN_URL = '/login';
export const TOKEN_KEY = IS_DEMO ? 'flowrequest_token' : 'flowrequest_production_token';
export const USER_KEY = IS_DEMO ? 'flowrequest_user' : 'flowrequest_production_user';
export function assertApiEnvironment(response) {
  const actual = response.headers?.get('X-FlowRequest-Environment');
  if ((actual && actual !== APP_ENV) || (!IS_DEMO && actual !== 'production')) {
    throw Object.assign(new Error('API không thuộc môi trường đang sử dụng. Vui lòng kiểm tra cấu hình kết nối.'), { kind: 'environment', status: 409 });
  }
}
