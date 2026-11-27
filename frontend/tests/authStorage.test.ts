import { beforeEach, describe, expect, it } from "vitest";
import {
  clearStoredUser,
  getRememberPreference,
  readRememberedEmail,
  readStoredUser,
  REMEMBER_KEY,
  REMEMBERED_EMAIL_KEY,
  setRememberPreference,
  USER_KEY,
  writeRememberedEmail,
  writeStoredUser,
} from "../src/utils/authStorage";

describe("authStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("persists the session to localStorage when remembered", () => {
    setRememberPreference(true);
    writeStoredUser({ id: "usr-1", email: "a@test.com" });

    expect(JSON.parse(localStorage.getItem(USER_KEY) || "null")).toEqual({ id: "usr-1", email: "a@test.com" });
    expect(sessionStorage.getItem(USER_KEY)).toBeNull();
    expect(readStoredUser()).toEqual({ id: "usr-1", email: "a@test.com" });
  });

  it("keeps the session in sessionStorage when not remembered", () => {
    setRememberPreference(false);
    writeStoredUser({ id: "usr-2" });

    expect(JSON.parse(sessionStorage.getItem(USER_KEY) || "null")).toEqual({ id: "usr-2" });
    expect(localStorage.getItem(USER_KEY)).toBeNull();
    expect(readStoredUser()).toEqual({ id: "usr-2" });
  });

  it("clears the stored user from both storages", () => {
    localStorage.setItem(USER_KEY, JSON.stringify({ id: "usr-1" }));
    sessionStorage.setItem(USER_KEY, JSON.stringify({ id: "usr-2" }));

    clearStoredUser();

    expect(localStorage.getItem(USER_KEY)).toBeNull();
    expect(sessionStorage.getItem(USER_KEY)).toBeNull();
    expect(readStoredUser()).toBeNull();
  });

  it("treats an existing localStorage session as remembered for legacy users", () => {
    expect(getRememberPreference()).toBe(false);
    localStorage.setItem(USER_KEY, JSON.stringify({ id: "usr-legacy" }));
    expect(getRememberPreference()).toBe(true);
  });

  it("honours an explicit preference over the legacy default", () => {
    localStorage.setItem(USER_KEY, JSON.stringify({ id: "usr-legacy" }));
    setRememberPreference(false);
    expect(getRememberPreference()).toBe(false);

    setRememberPreference(true);
    expect(getRememberPreference()).toBe(true);
    expect(localStorage.getItem(REMEMBER_KEY)).toBe("1");
  });

  it("saves and clears the remembered email", () => {
    writeRememberedEmail("student@test.com");
    expect(readRememberedEmail()).toBe("student@test.com");
    expect(localStorage.getItem(REMEMBERED_EMAIL_KEY)).toBe("student@test.com");

    writeRememberedEmail(null);
    expect(readRememberedEmail()).toBe("");
    expect(localStorage.getItem(REMEMBERED_EMAIL_KEY)).toBeNull();
  });
});
