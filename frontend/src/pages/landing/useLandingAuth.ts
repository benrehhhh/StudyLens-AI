import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { checkPasswordStrength } from "../../utils/password";
import { getRememberPreference, readRememberedEmail, writeRememberedEmail } from "../../utils/authStorage";
import type { UserRole } from "../../types";
import {
  FORGOT_RESET_KEY,
  readForgotReset,
  readStoredPending,
} from "./landingStorage";

export type LandingTab = "home" | "features" | "about" | "contact";

export function useLandingAuth() {
  const {
    login,
    register,
    verifyEmail,
    resendEmailCode,
    clearEmailVerification,
    pendingEmailVerification,
    pending2FA,
    verify2FA,
    resend2FA,
    clear2FA,
  } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<LandingTab>("home");
  const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return (
        document.documentElement.classList.contains("dark") ||
        localStorage.getItem("theme") === "dark" ||
        (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)
      );
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(() => readRememberedEmail());
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<UserRole>("student");
  const [rememberMe, setRememberMe] = useState<boolean>(() => getRememberPreference());

  const [forgotOpen, setForgotOpen] = useState(() => readForgotReset().open);
  const [forgotEmail, setForgotEmail] = useState(() => readForgotReset().email);
  const [forgotStep, setForgotStep] = useState<"request" | "verify" | "reset">(() => readForgotReset().step);
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotPassword, setForgotPassword] = useState("");
  const [forgotConfirm, setForgotConfirm] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotNotice, setForgotNotice] = useState("");

  useEffect(() => {
    try {
      const step = forgotStep === "reset" ? "verify" : forgotStep;
      localStorage.setItem(FORGOT_RESET_KEY, JSON.stringify({ open: forgotOpen, email: forgotEmail, step }));
    } catch {
      // ignore persistence failures
    }
  }, [forgotOpen, forgotEmail, forgotStep]);

  const [restoredPending, setRestoredPending] = useState<{ userId: string; email: string } | null>(() => readStoredPending());
  const effectivePending = pendingEmailVerification || restoredPending;

  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setRestoredPending(
      pendingEmailVerification
        ? { userId: pendingEmailVerification.userId, email: pendingEmailVerification.email }
        : null
    );
  }, [pendingEmailVerification]);

  const resetAuthFields = (mode: "login" | "register" | null) => {
    setFirstName("");
    setLastName("");
    setEmail(mode === "login" ? readRememberedEmail() : "");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setRole("student");
    setRememberMe(mode === "login" ? getRememberPreference() : false);
    setVerifyCode("");
    setVerifyError("");
    setVerifyNotice("");
    setF2aCode("");
    setF2aError("");
    setF2aNotice("");
  };

  const changeAuthModal = (mode: "login" | "register" | null) => {
    if (mode !== authModal) {
      // Opening a fresh sign-in/sign-up form must never inherit another user's
      // pending verification/2FA step from localStorage.
      if (mode) {
        clearEmailVerification();
        clear2FA();
        setRestoredPending(null);
      }
      resetAuthFields(mode);
    }
    setAuthModal(mode);
  };

  const clearPendingState = () => {
    clearEmailVerification();
    clear2FA();
    setRestoredPending(null);
  };

  const handleUseDifferentAccount = () => {
    clearPendingState();
    resetAuthFields("login");
    setAuthModal("login");
  };

  const handleBackToHome = () => {
    clearPendingState();
    resetAuthFields(null);
    setAuthModal(null);
  };

  const openRegisterModal = () => {
    changeAuthModal("register");
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (authModal === "register") {
        if (!firstName.trim()) {
          showToast("Please enter your first name.", "error");
          return;
        }
        if (!lastName.trim()) {
          showToast("Please enter your last name.", "error");
          return;
        }
        if (!email.trim()) {
          showToast("Please enter a valid email address.", "error");
          return;
        }
        if (password && confirmPassword && password !== confirmPassword) {
          showToast("Passwords do not match.", "error");
          return;
        }
        if (!password) {
          showToast("Please enter a password.", "error");
          return;
        }
        const strengthErr = checkPasswordStrength(password);
        if (strengthErr) {
          showToast(strengthErr, "error");
          return;
        }

        const computedFullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
        const dept = "College of Computer Studies";
        await register(computedFullName, email.trim(), role, dept, password);
        setPassword("");
        setConfirmPassword("");
      } else {
        if (!email.trim()) {
          showToast("Please enter your email address.", "error");
          return;
        }
        await login(email.trim(), role, password, rememberMe);
        setPassword("");
        setConfirmPassword("");
        writeRememberedEmail(rememberMe ? email.trim() : null);
      }
    } catch (err) {
      const errMsg = (err as Error).message || "Authentication failed. Please check your credentials.";
      if (errMsg.toLowerCase().includes("already registered") || errMsg.toLowerCase().includes("already exists")) {
        showToast(
          `This email (${email.trim()}) is already registered in our system. Would you like to log in instead?`,
          "error"
        );
      } else {
        showToast(errMsg, "error");
      }
    }
  };

  const [verifyCode, setVerifyCode] = useState("");
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [verifyResending, setVerifyResending] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [verifyNotice, setVerifyNotice] = useState("");

  const handleVerifyEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError("");
    if (!effectivePending) return;
    if (!/^\d{6}$/.test(verifyCode.trim())) {
      setVerifyError("Please enter the 6-digit code sent to your email.");
      return;
    }
    setVerifySubmitting(true);
    try {
      await verifyEmail(effectivePending.userId, verifyCode.trim());
    } catch (err) {
      setVerifyError((err as Error).message || "Could not verify the email. Please try again.");
    } finally {
      setVerifySubmitting(false);
    }
  };

  const handleResendVerifyCode = async () => {
    setVerifyError("");
    if (!effectivePending) return;
    setVerifyResending(true);
    try {
      await resendEmailCode(effectivePending.userId);
      setVerifyNotice("A new verification code has been sent.");
    } catch (err) {
      setVerifyError((err as Error).message || "Could not resend the verification code.");
    } finally {
      setVerifyResending(false);
    }
  };

  const [f2aCode, setF2aCode] = useState("");
  const [f2aSubmitting, setF2aSubmitting] = useState(false);
  const [f2aResending, setF2aResending] = useState(false);
  const [f2aError, setF2aError] = useState("");
  const [f2aNotice, setF2aNotice] = useState("");

  const handleVerify2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setF2aError("");
    if (!pending2FA) return;
    if (!/^\d{6}$/.test(f2aCode.trim())) {
      setF2aError("Please enter the 6-digit code sent to your email.");
      return;
    }
    setF2aSubmitting(true);
    try {
      await verify2FA(pending2FA.userId, f2aCode.trim());
      setF2aCode("");
    } catch (err) {
      setF2aError((err as Error).message || "Could not complete sign-in. Please try again.");
    } finally {
      setF2aSubmitting(false);
    }
  };

  const handleResend2FASubmit = async () => {
    setF2aError("");
    setF2aNotice("");
    if (!pending2FA) return;
    setF2aResending(true);
    try {
      await resend2FA(pending2FA.userId);
      setF2aNotice("A new verification code has been sent.");
      setF2aCode("");
    } catch (err) {
      setF2aError((err as Error).message || "Could not resend the verification code.");
    } finally {
      setF2aResending(false);
    }
  };

  const handleUseDifferent2FA = () => {
    handleUseDifferentAccount();
  };

  const scrollToSection = (id: LandingTab) => {
    setActiveTab(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleFeatureCardClick = () => {
    scrollToSection("features");
  };

  const handleForgotSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !forgotEmail.includes("@")) {
      showToast("Please enter a valid email address.", "error");
      return;
    }
    setForgotSubmitting(true);
    setForgotNotice("");
    try {
      const res = await fetch("/api/auth/reset-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error || "Could not issue a reset code. Please try again.", "error");
        return;
      }
      setForgotStep("verify");
      setForgotOtp("");
      setForgotPassword("");
      setForgotConfirm("");
      setForgotNotice(data?.message || "A 6-digit verification code was sent to your email.");
      showToast(res.status === 200 ? "Verification code sent." : data?.message || "Code sent.");
    } catch {
      showToast("Could not reach the server. Please check your connection and try again.", "error");
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleForgotVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtp.trim() || forgotOtp.trim().length !== 6) {
      showToast("Please enter the 6-digit verification code.", "error");
      return;
    }
    setForgotSubmitting(true);
    try {
      const res = await fetch("/api/auth/verify-reset-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim(), otp: forgotOtp.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error || "That verification code is incorrect. Please try again.", "error");
        return;
      }
      setForgotStep("reset");
      setForgotNotice("Code verified. Choose your new password.");
      showToast("Verification code confirmed.");
    } catch {
      showToast("Could not reach the server. Please check your connection and try again.", "error");
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleForgotResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPassword) {
      showToast("Please enter a new password.", "error");
      return;
    }
    const forgotError = checkPasswordStrength(forgotPassword);
    if (forgotError) {
      showToast(forgotError, "error");
      return;
    }
    if (forgotPassword !== forgotConfirm) {
      showToast("Passwords do not match.", "error");
      return;
    }
    setForgotSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim(), otp: forgotOtp.trim(), newPassword: forgotPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error || "Could not reset the password. Please try again.", "error");
        return;
      }
      showToast("Password reset successfully! You can now sign in with your new password.");
      setTimeout(() => {
        setForgotOpen(false);
        setForgotEmail("");
        setForgotOtp("");
        setForgotPassword("");
        setForgotConfirm("");
        setForgotStep("request");
        setForgotNotice("");
      }, 2200);
    } catch {
      showToast("Could not reach the server. Please check your connection and try again.", "error");
    } finally {
      setForgotSubmitting(false);
    }
  };

  const closeForgotModal = () => {
    setForgotOpen(false);
    setForgotStep("request");
    setForgotEmail("");
    setForgotOtp("");
    setForgotPassword("");
    setForgotConfirm("");
    setForgotNotice("");
  };

  return {
    activeTab,
    authModal,
    setAuthModal: changeAuthModal,
    darkMode,
    setDarkMode,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    role,
    setRole,
    rememberMe,
    setRememberMe,
    forgotOpen,
    forgotEmail,
    setForgotEmail,
    forgotStep,
    setForgotStep,
    forgotOtp,
    setForgotOtp,
    forgotPassword,
    setForgotPassword,
    forgotConfirm,
    setForgotConfirm,
    forgotSubmitting,
    forgotNotice,
    setForgotOpen,
    effectivePending,
    pending2FA,
    verifyCode,
    setVerifyCode,
    verifySubmitting,
    verifyResending,
    verifyError,
    verifyNotice,
    f2aCode,
    setF2aCode,
    f2aSubmitting,
    f2aResending,
    f2aError,
    f2aNotice,
    openRegisterModal,
    handleAuthSubmit,
    handleVerifyEmailSubmit,
    handleResendVerifyCode,
    handleVerify2FASubmit,
    handleResend2FASubmit,
    handleUseDifferent2FA,
    handleUseDifferentAccount,
    handleBackToHome,
    handleFeatureCardClick,
    handleForgotSendCode,
    handleForgotVerifyOtp,
    handleForgotResetSubmit,
    closeForgotModal,
    scrollToSection,
    clearEmailVerification,
  };
}

export type LandingAuthController = ReturnType<typeof useLandingAuth>;
