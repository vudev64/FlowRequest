import { IS_DEMO } from './environment.js';
export const DEMO_ACCOUNTS = IS_DEMO ? Object.fromEntries(
  [
    'employee',
    'manager',
    'hr_admin',
    'accountant',
    'director',
    'system_admin',
  ].map((role) => [
    role,
    {
      email: `${role}@teck-flowrequest.com`,
      password: `Demo-${role}`,
    },
  ]),
) : {};
