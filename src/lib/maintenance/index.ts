export type MaintenanceMode = {
  enabled: boolean;
  message: string;
  allowAdminAccess: boolean;
};

export const defaultMaintenanceMode: MaintenanceMode = {
  enabled: false,
  message: "We are improving the studio. Please check back soon.",
  allowAdminAccess: true
};

export function shouldShowMaintenance(pathname: string, mode = defaultMaintenanceMode) {
  if (!mode.enabled) return false;
  if (mode.allowAdminAccess && pathname.startsWith("/admin")) return false;
  return true;
}
