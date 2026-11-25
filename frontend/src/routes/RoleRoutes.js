export const roleRoutes = {
  employee: {
    path: "/employee",
    allowedRoles: ["employee"],
  },

  manager: {
    path: "/manager",
    allowedRoles: ["manager"],
  },

  hr_admin: {
    path: "/hr-admin",
    allowedRoles: ["hr_admin"],
  },

  director: {
    path: "/director",
    allowedRoles: ["director"],
  },

  account_manager: {
    path: "/account-manager",
    allowedRoles: ["account_manager"],
  },

  system_admin: {
    path: "/system-admin",
    allowedRoles: ["system_admin"],
  },
};
