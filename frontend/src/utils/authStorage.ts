export const USER_KEY = "studylens_user";
export const REMEMBER_KEY = "studylens_remember_me";
export const REMEMBERED_EMAIL_KEY = "studylens_remembered_email";

const safeGet = (storage: Storage, key: string): string | null => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (storage: Storage, key: string, value: string) => {
  try {
    storage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, quota); the session still works in memory.
  }
};

const safeRemove = (storage: Storage, key: string) => {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
};

export function getRememberPreference(): boolean {
  const stored = safeGet(localStorage, REMEMBER_KEY);
  if (stored === "1") return true;
  if (stored === "0") return false;
  // Legacy sessions predate the preference key: an existing localStorage user
  // means the account was being persisted, so keep treating it as remembered.
  return safeGet(localStorage, USER_KEY) !== null;
}

export function setRememberPreference(remember: boolean): void {
  safeSet(localStorage, REMEMBER_KEY, remember ? "1" : "0");
}

export function readStoredUser<T>(): T | null {
  const raw = safeGet(localStorage, USER_KEY) ?? safeGet(sessionStorage, USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeStoredUser(user: unknown): void {
  const serialized = JSON.stringify(user);
  if (getRememberPreference()) {
    safeSet(localStorage, USER_KEY, serialized);
    safeRemove(sessionStorage, USER_KEY);
  } else {
    safeSet(sessionStorage, USER_KEY, serialized);
    safeRemove(localStorage, USER_KEY);
  }
}

export function clearStoredUser(): void {
  safeRemove(localStorage, USER_KEY);
  safeRemove(sessionStorage, USER_KEY);
}

export function readRememberedEmail(): string {
  return safeGet(localStorage, REMEMBERED_EMAIL_KEY) || "";
}

export function writeRememberedEmail(email: string | null): void {
  if (email) {
    safeSet(localStorage, REMEMBERED_EMAIL_KEY, email);
  } else {
    safeRemove(localStorage, REMEMBERED_EMAIL_KEY);
  }
}
