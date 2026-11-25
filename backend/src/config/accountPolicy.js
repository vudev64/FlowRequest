import { environmentName } from './environment.js';
export const ACCOUNT_CREATION_ROLES = Object.freeze({
  SYSTEM_ADMIN: Object.freeze(['HR_ADMIN', 'DIRECTOR']),
  HR_ADMIN: Object.freeze(['EMPLOYEE', 'MANAGER', 'ACCOUNTANT']),
});
export function isSharedDemoAccount(email, environment = environmentName()) {
  return environment === 'demo' && /^(employee|manager|hr_admin|accountant|director|system_admin)@teck-flowrequest\.com$/i.test(String(email).trim());
}
export function isReservedDemoEmail(email, environment = environmentName()) {
  return environment === 'production' && /^(employee|manager|hr_admin|accountant|director|system_admin)@teck-flowrequest\.com$/i.test(String(email).trim());
}
