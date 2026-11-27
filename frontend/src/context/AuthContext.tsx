import React, { createContext, useContext, useEffect, useState } from "react";
import type { User, UserRole } from "../types";
import { authFetch, setCsrfToken } from "../utils/authFetch";
import { avatarUrl } from "../utils/avatar";
import {
  clearStoredUser,
  readStoredUser,
  setRememberPreference,
  writeStoredUser,
} from "../utils/authStorage";

interface AuthContextType {
  currentUser: User | null;
  pendingEmailVerification: { userId: string; email: string; devCode?: string } | null;
  pending2FA: { userId: string; email: string; expiresInMinutes?: number; devCode?: string } | null;
  login: (emailOrUser: string | Partial<User>, role?: UserRole, password?: string, rememberMe?: boolean) => Promise<void>;
  register: (name: string, email: string, role: UserRole, department?: string, password?: string) => Promise<void>;
  verifyEmail: (userId: string, code: string) => Promise<void>;
  resendEmailCode: (userId: string) => Promise<void>;
  clearEmailVerification: () => void;
  verify2FA: (userId: string, code: string) => Promise<void>;
  resend2FA: (userId: string) => Promise<void>;
  clear2FA: () => void;
  updateUser: (updated: User) => Promise<void>;
  refreshSession: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PENDING_VERIFY_KEY = "studylens_pending_verification";
const PENDING_2FA_KEY = "studylens_pending_2fa";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Guard against corrupted avatar placeholders ("None"/"null"/"undefined")
  // that must render as the initials fallback instead of a broken image.
  const sanitizeAvatar = (u: User | null): User | null => {
    if (!u) return u;
    const raw = (u as { avatar?: unknown }).avatar;
    const resolved = typeof raw === "string" ? avatarUrl(raw) : null;
    return { ...u, avatar: resolved ?? undefined } as User;
  };

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = readStoredUser<User>();
    return saved ? sanitizeAvatar(saved) : null;
  });
  const [pendingEmailVerification, setPendingEmailVerification] = useState<{ userId: string; email: string; devCode?: string } | null>(() => {
    try {
      const saved = localStorage.getItem(PENDING_VERIFY_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [pending2FA, setPending2FAState] = useState<{ userId: string; email: string; expiresInMinutes?: number; devCode?: string } | null>(() => {
    try {
      const saved = localStorage.getItem(PENDING_2FA_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const saveUserSession = (user: User) => {
    const cleanUser = sanitizeAvatar(user);
    setCurrentUser(cleanUser);
    writeStoredUser(cleanUser);
  };

  // Persists the pending email-verification step (userId + email only, never
  // the devCode) so the Verify Email panel survives a reload / tab discard.
  // Cleared once the step completes, the user bails out, or they sign in.
  const setPendingVerification = (pending: { userId: string; email: string; devCode?: string } | null) => {
    setPendingEmailVerification(pending);
    try {
      if (pending) {
        localStorage.setItem(PENDING_VERIFY_KEY, JSON.stringify({ userId: pending.userId, email: pending.email }));
      } else {
        localStorage.removeItem(PENDING_VERIFY_KEY);
      }
    } catch (e) {
      console.error("Failed to persist pending email verification", e);
    }
  };

  // Persists the pending two-factor step (userId + email only, never the
  // devCode) so the Confirm Sign-In panel survives a reload / tab discard.
  // Cleared once the step completes, the user bails out, or they sign in.
  const setPending2FA = (pending: { userId: string; email: string; expiresInMinutes?: number; devCode?: string } | null) => {
    setPending2FAState(pending);
    try {
      if (pending) {
        localStorage.setItem(PENDING_2FA_KEY, JSON.stringify({ userId: pending.userId, email: pending.email, expiresInMinutes: pending.expiresInMinutes }));
      } else {
        localStorage.removeItem(PENDING_2FA_KEY);
      }
    } catch (e) {
      console.error("Failed to persist pending two-factor verification", e);
    }
  };

  const login = async (
    emailOrUser: string | Partial<User>,
    role?: UserRole,
    password?: string,
    rememberMe = false
  ) => {
    try {
      let emailStr = "";
      let userRole = role;
      let customUser: Partial<User> | null = null;
      let userPassword: string | undefined = password;

      if (typeof emailOrUser === "string") {
        emailStr = emailOrUser;
      } else if (emailOrUser && typeof emailOrUser === "object") {
        customUser = emailOrUser;
        emailStr = emailOrUser.email || "";
        userRole = emailOrUser.role || role;
        userPassword = (emailOrUser as { password?: string }).password || password;
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailStr, role: userRole, user: customUser, password: userPassword, rememberMe }),
      });

      if (res.ok) {
        const data = await res.json();
        // Persist the choice before branching so the email-verification / 2FA
        // steps save the eventual session into the same storage.
        setRememberPreference(rememberMe);
        if (data.csrfToken) {
          setCsrfToken(data.csrfToken);
        }
        if (data.requiresEmailVerification) {
          setPendingVerification({
            userId: data.userId,
            email: data.email,
            devCode: data.devCode,
          });
          return;
        }
        if (data.twoFactorRequired) {
          setPendingVerification(null);
          setPending2FA({
            userId: data.userId,
            email: data.email,
            expiresInMinutes: data.expiresInMinutes,
            devCode: data.devCode,
          });
          return;
        }
        setPendingVerification(null);
        setPending2FA(null);
        saveUserSession(data.user);
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Login failed. Please check your credentials.");
      }
    } catch (err) {
      console.warn("Login notice:", err);
      throw err;
    }
  };

  const register = async (name: string, email: string, role: UserRole, department?: string, password?: string) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, department, password }),
      });
      if (res.ok) {
        const data = await res.json();
        // Sign-ups are kept signed in across restarts (there is no remember-me
        // checkbox on the registration form).
        setRememberPreference(true);
        if (data.requiresEmailVerification) {
          setPendingVerification({
            userId: data.userId,
            email: data.email,
            devCode: data.devCode,
          });
          return;
        }
        setPendingVerification(null);
        saveUserSession(data.user);
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Registration failed.");
      }
    } catch (err) {
      console.warn("Registration notice:", err);
      throw err;
    }
  };

  const verifyEmail = async (userId: string, code: string) => {
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not verify the email. Please try again.");
      }
      if (data.requiresEmailVerification) {
        setPendingVerification({
          userId: data.userId,
          email: data.email,
          devCode: data.devCode,
        });
        return;
      }
      if (data.csrfToken) {
        setCsrfToken(data.csrfToken);
      }
      saveUserSession(data.user);
      setPendingVerification(null);
    } catch (err) {
      console.warn("Email verification notice:", err);
      throw err;
    }
  };

  const resendEmailCode = async (userId: string) => {
    const res = await fetch("/api/auth/resend-email-code", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Could not resend the verification code.");
    }
    if (data.devCode) {
      setPendingVerification({ userId, email: pendingEmailVerification?.email || data.email, devCode: data.devCode });
    }
  };

  const clearEmailVerification = () => {
    setPendingVerification(null);
  };

  const verify2FA = async (userId: string, code: string) => {
    const res = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, code }),
      });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Terminal states force a fresh sign-in; invalid codes keep the panel open.
      if (["EXPIRED_2FA", "NOT_FOUND", "ACCOUNT_LOCKED"].includes(data.code)) {
        setPending2FA(null);
      }
      throw new Error(data.error || "Verification failed. Please try again.");
    }
    if (data.csrfToken) {
      setCsrfToken(data.csrfToken);
    }
    setPending2FA(null);
    setPendingVerification(null);
    saveUserSession(data.user);
  };

  const resend2FA = async (userId: string) => {
    const res = await fetch("/api/auth/resend-2fa", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (["NO_PENDING_2FA", "NOT_FOUND", "2FA_NOT_REQUIRED", "ACCOUNT_LOCKED"].includes(data.code)) {
        setPending2FA(null);
      }
      throw new Error(data.error || "Could not resend the verification code.");
    }
    if (pending2FA) {
      setPending2FA({ ...pending2FA, expiresInMinutes: data.expiresInMinutes, devCode: data.devCode });
    }
  };

  const clear2FA = () => {
    setPending2FA(null);
  };

  const updateUser = async (updated: User) => {
    const res = await authFetch(`/api/users/${updated.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      // Send only editable fields; never echo role/status/tokenVersion.
      body: JSON.stringify({ name: updated.name, email: updated.email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || "Could not update your profile. Please try again.");
    }
    saveUserSession(data as User);
  };

  // Replaces the stored session after a server-side security event (e.g. a
  // password change bumped token_version, so the old JWT is now invalid and a
  // fresh one was issued in the response).
  const refreshSession = (user: User) => {
    saveUserSession(user);
  };

  const logout = () => {
    setCurrentUser(null);
    setPendingVerification(null);
    setPending2FA(null);
    setCsrfToken(null);
    // Keep the remembered email/preference so the sign-in form still prefills
    // for users who opted into "Remember me".
    clearStoredUser();
  };

  useEffect(() => {
    const onSessionExpired = () => {
      setCurrentUser(null);
      setPendingVerification(null);
      setPending2FA(null);
      setCsrfToken(null);
      clearStoredUser();
    };
    window.addEventListener("auth:session-expired", onSessionExpired);
    return () => window.removeEventListener("auth:session-expired", onSessionExpired);
  }, []);

  return (
    <AuthContext.Provider
      value={{ currentUser, pendingEmailVerification, pending2FA, login, register, verifyEmail, resendEmailCode, clearEmailVerification, verify2FA, resend2FA, clear2FA, updateUser, refreshSession, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
