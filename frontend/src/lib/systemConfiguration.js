let current = null;
export const setSystemConfiguration = value => { current = value; };
export const getSystemConfiguration = () => current;
export const systemTimeZone = () => current?.general?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
export function passwordMeetsPolicy(password, policy, minimum = 8) {
  if (password.length < Math.max(minimum, policy?.minLength || minimum) || new TextEncoder().encode(password).length > 72) return false;
  return (!policy?.uppercase || /[A-Z]/.test(password)) && (!policy?.lowercase || /[a-z]/.test(password)) && (!policy?.number || /[0-9]/.test(password)) && (!policy?.special || /[^a-zA-Z0-9\s]/.test(password));
}
