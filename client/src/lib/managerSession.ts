export const MANAGER_STORAGE_KEYS = ["manager_token", "manager_name", "manager_email"] as const;

export function getManagerEntryPath(hasManagerToken: boolean) {
  return hasManagerToken ? "/manager/dashboard" : "/manager/login";
}

export function isManagerPath(pathname: string) {
  return pathname === "/manager" || pathname.startsWith("/manager/");
}

export function clearManagerSession(storage: Pick<Storage, "removeItem">) {
  MANAGER_STORAGE_KEYS.forEach((key) => storage.removeItem(key));
}
