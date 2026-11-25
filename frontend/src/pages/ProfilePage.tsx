import React, { useState, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { User, Mail, Shield, Building2, Calendar, Award, Lock, Edit3, Save, Camera, BookOpen, ShieldCheck, Trash2, Activity, PieChart, Eye, EyeOff } from "lucide-react";
import { authFetch } from "../utils/authFetch";
import { avatarUrl } from "../utils/avatar";
import { RelativeTime } from "../utils/time";
import { checkPasswordStrength } from "../utils/password";
import { PasswordRequirements } from "../components/PasswordRequirements";
import type { User as UserType, ActivityLog } from "../types";

const translations: Record<string, Record<string, string>> = {
  en: {
    "Account Details": "Account Details",
    "Full Name": "Full Name",
    "Department / Faculty (Read-only)": "Department / Faculty (Read-only)",
    "Email Address": "Email Address",
    "User Role": "User Role",
    "Department": "Department",
    "Security & Credentials": "Security & Credentials",
    "Password Authentication": "Password Authentication",
    "Keep your StudyLens account protected": "Keep your StudyLens account protected",
    "Change Password": "Change Password",
    "Set New Password": "Set New Password",
    "Current Password": "Current Password",
    "New Password": "New Password",
    "Confirm Password": "Confirm Password",
    "Update Password": "Update Password",
    "Cancel": "Cancel",
    "Account Stats": "Account Stats",
    "Quizzes Taken": "Quizzes Taken",
    "Flashcards Created": "Flashcards Created",
    "Study Hours": "Study Hours",
    "Materials Uploaded": "Materials Uploaded",
    "Recent Activity": "Recent Activity",
    "Profile updated": "Profile updated",
    "Password changed": "Password changed",
    "Account created": "Account created",
    "Preferences": "Preferences",
    "Dark Mode": "Dark Mode",
    "Switch between light and dark theme": "Switch between light and dark theme",
    "Email Notifications": "Email Notifications",
    "Receive updates about your learning progress": "Receive updates about your learning progress",
    "Language": "Language",
    "App display language": "App display language",
    "English": "English",
    "Filipino": "Filipino",
    "Edit Profile": "Edit Profile",
    "Save Edit": "Save Edit",
    "Save Changes": "Save Changes",
    "Profile updated successfully!": "Profile updated successfully!",
    "Full name is required.": "Full name is required.",
    "Please enter a valid email address.": "Please enter a valid email address.",
    "Just now": "Just now",
    "Earlier today": "Earlier today",
  },
  fil: {
    "Account Details": "Mga Detalye ng Kuwenta",
    "Full Name": "Pangalang Buo",
    "Department / Faculty (Read-only)": "Departamento / Kolehiya (Read-only)",
    "Email Address": "Email na Adres",
    "User Role": "Katungkulan ng Usuario",
    "Department": "Departamento",
    "Security & Credentials": "Seguridad at Mga Krekensiyal",
    "Password Authentication": "Pagpapatunay ng Password",
    "Keep your StudyLens account protected": "Protektahan ang inyong account sa StudyLens",
    "Change Password": "Baguhin ang Password",
    "Set New Password": "Itakda ang Bagong Password",
    "Current Password": "Nasa Kasalukuyang Password",
    "New Password": "Bagong Password",
    "Confirm Password": "Kumpirmahin ang Password",
    "Update Password": "I-update ang Password",
    "Cancel": "Kanselahin",
    "Account Stats": "Mga Estadistika ng Kuwenta",
    "Quizzes Taken": "Mga Quiz na Nakuha",
    "Flashcards Created": "Mga Flashcard na Likha",
    "Study Hours": "Oras ng Pag-aaral",
    "Materials Uploaded": "Mga Materyals na In-upload",
    "Recent Activity": "Kasalukuyang Aktibidad",
    "Profile updated": "Profile na-update",
    "Password changed": "Password na-bago",
    "Account created": "Kuwenta na-likha",
    "Preferences": "Mga Paging",
    "Dark Mode": "Dark Mode",
    "Switch between light and dark theme": "Mag-switch sa liwanag at dilim na theme",
    "Email Notifications": "Mga Notipikasyon sa Email",
    "Receive updates about your learning progress": "Tumanggap ng mga update sa inyong progreso sa pag-aaral",
    "Language": "Wika",
    "App display language": "Wika ng pagpapakita ng App",
    "English": "Ingles",
    "Filipino": "Filipino",
    "Edit Profile": "I-edit ang Profile",
    "Save Edit": "I-save ang Edit",
    "Save Changes": "I-save ang mga Pagbabago",
    "Profile updated successfully!": "Profile na-update nang maayos!",
    "Full name is required.": "Kinakailangan ang pangalang buo.",
    "Please enter a valid email address.": "Maaari pong pumili ng tunay na email na adres.",
    "Just now": "Nang kahapon",
    "Earlier today": "Nang mas maaga ngayon",
  },
};

const PasswordToggleInput = ({
  label,
  value,
  onChange,
  showPassword,
  setShowPassword,
  type = "password",
  placeholder = "••••••••",
  requirements,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  type?: string;
  placeholder?: string;
  requirements?: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">{label}</label>
    <div className="relative">
      <input
        type={showPassword ? "text" : type}
        required
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full pr-10 p-2.5 rounded-xl border border-border bg-background text-foreground text-xs font-medium"
      />
      <button
        type="button"
        onClick={() => setShowPassword((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
        aria-label={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
    {requirements}
  </div>
);

function t(key: string, lang: string): string {
  return translations[lang]?.[key] || translations["en"][key] || key;
}

export const ProfilePage: React.FC = () => {
  const { currentUser, updateUser, refreshSession } = useAuth();
  const { showToast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentUser?.name || "");
  const [email, setEmail] = useState((currentUser?.email || "").trim());

  // Password state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Avatar state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);

  // Preference state (loaded from localStorage, no UI controls remain)
  const [darkMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return (
        document.documentElement.classList.contains("dark") ||
        localStorage.getItem("theme") === "dark" ||
        (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)
      );
    }
    return false;
  });
  const [language] = useState(() => {
    try {
      return localStorage.getItem("studylens_language") || "en";
    } catch {
      return "en";
    }
  });

  // Stats state
  const [stats, setStats] = useState<{
    quizzesTaken: number;
    flashcardsCreated: number;
    studyHours: number;
    materialsUploaded: number;
  }>({ quizzesTaken: 0, flashcardsCreated: 0, studyHours: 0, materialsUploaded: 0 });

  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);

  React.useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const fetchStats = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await authFetch(`/api/users/${currentUser.id}/stats`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStats({
          quizzesTaken: data.quizzesTaken ?? 0,
          flashcardsCreated: data.flashcardsCreated ?? 0,
          studyHours: data.studyHours ?? 0,
          materialsUploaded: data.materialsUploaded ?? 0,
        });
        setRecentActivity(Array.isArray(data.recentActivity) ? data.recentActivity : []);
      }
    } catch {
      // ignore fetch failures, stats stay at 0
    }
  }, [currentUser]);

  React.useEffect(() => {
    if (!currentUser) return;
    const initial = setTimeout(() => fetchStats(), 0);
    const interval = setInterval(fetchStats, 20000);
    const onFocus = () => fetchStats();
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchStats();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [currentUser, fetchStats]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/gif", "image/webp"].includes(file.type)) {
      showToast("Please choose a PNG, JPG, GIF, or WEBP image.", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("The image must be 5 MB or smaller.", "error");
      return;
    }
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await authFetch(`/api/users/${currentUser!.id}/avatar`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error || "Could not upload the image. Please try again.", "error");
        return;
      }
      refreshSession(data);
      showToast("Profile photo updated.");
      void fetchStats();
    } catch {
      showToast("Could not reach the server. Please try again.", "error");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    if (!avatarUrl(currentUser?.avatar) || removingAvatar) return;
    setRemovingAvatar(true);
    try {
      const res = await authFetch(`/api/users/${currentUser!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error || "Could not remove the photo. Please try again.", "error");
        return;
      }
      refreshSession(data);
      showToast("Profile photo removed.");
      void fetchStats();
    } catch {
      showToast("Could not reach the server. Please try again.", "error");
    } finally {
      setRemovingAvatar(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No active user profile session.
      </div>
    );
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    performSave();
  };

  const startEditing = () => {
    setName(currentUser.name);
    setEmail(currentUser.email.trim());
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setName(currentUser.name);
    setEmail(currentUser.email.trim());
    setIsEditing(false);
  };

  const performSave = async () => {
    if (!name.trim()) {
      showToast("Full name is required.", "error");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      showToast("Please enter a valid email address.", "error");
      return;
    }
    const nextEmail = email.trim();
    const updated: UserType = {
      ...currentUser,
      name: name.trim() || currentUser.name,
      email: nextEmail,
    };
    try {
      await updateUser(updated);
      setIsEditing(false);
      showToast("Profile updated successfully!");
      void fetchStats();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not update your profile. Please try again.", "error");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const strengthErr = checkPasswordStrength(newPassword);
    if (strengthErr) {
      showToast(strengthErr, "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Passwords do not match.", "error");
      return;
    }
    setPasswordSubmitting(true);
    try {
      const res = await authFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error || "Could not update the password. Please try again.", "error");
        return;
      }
      showToast("Password updated successfully!");
      void fetchStats();
      // The backend bumped token_version when the password changed, so the old
      // JWT is invalid; swap in the freshly issued token to stay signed in.
      if (data.user) {
        refreshSession(data.user);
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordChange(false);
    } catch {
      showToast("Could not reach the server. Please check your connection and try again.", "error");
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const initials = currentUser.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const getRoleBadge = () => {
    switch (currentUser.role) {
      case "admin":
        return {
          label: "System Administrator",
          bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
          icon: ShieldCheck,
        };
      case "teacher":
        return {
          label: "Faculty Instructor",
          bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
          icon: Award,
        };
      default:
        return {
          label: "Enrolled Student",
          bg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
          icon: BookOpen,
        };
    }
  };

  const badge = getRoleBadge();
  const BadgeIcon = badge.icon;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner Header */}
      <div className="relative overflow-hidden rounded-xl bg-[#5b51d8] p-6 sm:p-8 text-white shadow-md">
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative shrink-0">
            {avatarUrl(currentUser.avatar) ? (
              <img
                src={avatarUrl(currentUser.avatar)!}
                alt={currentUser.name}
                className="h-20 w-20 rounded-full object-cover ring-4 ring-white/30 shadow-inner"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center font-bold text-2xl ring-4 ring-white/30 shadow-inner">
                {initials}
              </div>
            )}
            {isEditing && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                title={uploadingAvatar ? "Uploading..." : "Change profile photo"}
                aria-label={uploadingAvatar ? "Uploading profile photo" : "Change profile photo"}
                className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-white text-primary flex items-center justify-center shadow-md border border-white/60 hover:scale-105 transition-transform cursor-pointer disabled:opacity-60"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            )}
            {isEditing && avatarUrl(currentUser.avatar) && (
              <button
                onClick={handleRemovePhoto}
                disabled={removingAvatar}
                title={removingAvatar ? "Removing..." : "Remove photo"}
                aria-label={removingAvatar ? "Removing profile photo" : "Remove profile photo"}
                className="absolute bottom-0 left-0 h-7 w-7 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md border border-white/60 hover:scale-105 transition-transform cursor-pointer disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex-1 text-left sm:text-left space-y-2">
            <div className="flex flex-wrap items-start sm:items-center justify-start sm:justify-start gap-2 sm:gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-none">{currentUser.name}</h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-md bg-white/10 text-white border-white/20 shrink-0`}>
                <BadgeIcon className="h-3.5 w-3.5 shrink-0" />
                {badge.label}
              </span>
            </div>
            <p className="text-indigo-100 text-sm truncate max-w-full">{currentUser.email.trim()}</p>
            <div className="flex flex-wrap items-start sm:items-center justify-start sm:justify-start gap-4 sm:gap-5 text-xs text-indigo-200 pt-1">
              <span className="flex items-center gap-1 whitespace-nowrap">
                <Building2 className="w-3.5 h-3.5 shrink-0" /> {currentUser.department || "General Department"}
              </span>
              {currentUser.studentId && (
                <span className="flex items-center gap-1 font-mono whitespace-nowrap shrink-0">
                  ID: {currentUser.studentId}
                </span>
              )}
              <span className="flex items-center gap-1 whitespace-nowrap shrink-0">
                <Calendar className="w-3.5 h-3.5 shrink-0" /> Joined {new Date(currentUser.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {!isEditing ? (
            <button
              onClick={startEditing}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border border-white/20"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit Profile
            </button>
          ) : (
            <button
              onClick={performSave}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border border-white/20"
            >
              <Save className="w-3.5 h-3.5" /> Save Edit
            </button>
          )}
        </div>
      </div>

      {/* Account & Security (Combined) */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-sm">
        {/* Account Details Section */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-500" />
            {t("Account Details", language)}
          </h3>

          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  {t("Full Name", language)}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  {t("Department / Faculty (Read-only)", language)}
                </label>
                <input
                  type="text"
                  value={currentUser.department || "General"}
                  disabled
                  title="Department is managed by the administration"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-muted text-muted-foreground text-sm font-medium cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  {t("Email Address", language)}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Save className="w-4 h-4" /> {t("Save Changes", language)}
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {t("Cancel", language)}
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-muted/40 border border-border/60">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t("Full Name", language)}</p>
                <p className="text-sm font-bold text-foreground mt-1">{currentUser.name}</p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border/60">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t("Email Address", language)}</p>
                <p className="text-sm font-bold text-foreground mt-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
{currentUser.email.trim()}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border/60">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t("User Role", language)}</p>
                <p className="text-sm font-bold text-foreground mt-1 capitalize flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-500" />
                  {currentUser.role}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border/60">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t("Department", language)}</p>
                <p className="text-sm font-bold text-foreground mt-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  {currentUser.department || "General"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-border/60 my-2" />

        {/* Security & Credentials Section */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Lock className="w-4 h-4 text-indigo-500" />
            {t("Security & Credentials", language)}
          </h3>

          {!showPasswordChange ? (
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border">
              <div>
                <p className="text-sm font-bold text-foreground">{t("Password Authentication", language)}</p>
                <p className="text-xs text-muted-foreground">{t("Keep your StudyLens account protected", language)}</p>
              </div>
              <button
                onClick={() => setShowPasswordChange(true)}
                className="px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {t("Change Password", language)}
              </button>
            </div>
          ) : (
            <form onSubmit={handlePasswordChange} className="space-y-4 p-4 rounded-xl bg-muted/30 border border-border">
              <p className="text-xs font-bold text-foreground">{t("Set New Password", language)}</p>
              <PasswordToggleInput
                label={t("Current Password", language)}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                showPassword={showCurrentPassword}
                setShowPassword={setShowCurrentPassword}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <PasswordToggleInput
                    label={t("New Password", language)}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter your new password"
                    showPassword={showNewPassword}
                    setShowPassword={setShowNewPassword}
                    requirements={<PasswordRequirements password={newPassword} />}
                  />
                </div>
                <div>
                  <PasswordToggleInput
                    label={t("Confirm Password", language)}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your new password"
                    showPassword={showConfirmPassword}
                    setShowPassword={setShowConfirmPassword}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={passwordSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  {passwordSubmitting ? t("Update Password", language) : t("Update Password", language)}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasswordChange(false)}
                  className="px-3 py-2 bg-muted text-foreground hover:bg-muted/80 rounded-xl text-xs font-bold cursor-pointer"
                >
                  {t("Cancel", language)}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-500" />
          {t("Recent Activity", language)}
        </h3>
        {recentActivity.length > 0 ? (
          recentActivity.map((log) => (
            <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border">
              <Activity className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-foreground">{log.action}</p>
                <p className="text-[10px] text-muted-foreground truncate">{log.details || log.action}</p>
                <RelativeTime iso={log.timestamp} />
              </div>
            </div>
          ))
        ) : (
          <p className="text-[10px] text-muted-foreground text-center py-2">No recent activity yet.</p>
        )}
      </div>

      {/* Account Stats */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <PieChart className="w-4 h-4 text-indigo-500" />
          {t("Account Stats", language)}
        </h3>
        <div className="overflow-x-auto pb-2">
          <div className="flex flex-nowrap gap-3 min-w-full">
            <div className="p-3 rounded-xl bg-muted/50 border border-border text-center min-w-[120px] flex flex-col justify-between">
              <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider truncate">{t("Quizzes Taken", language)}</p>
              <p className="text-xl sm:text-2xl font-black text-foreground mt-1 leading-none">{stats.quizzesTaken}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/50 border border-border text-center min-w-[120px] flex flex-col justify-between">
              <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider truncate">{t("Flashcards Created", language)}</p>
              <p className="text-xl sm:text-2xl font-black text-foreground mt-1 leading-none">{stats.flashcardsCreated}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/50 border border-border text-center min-w-[120px] flex flex-col justify-between">
              <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider truncate">{t("Study Hours", language)}</p>
              <p className="text-xl sm:text-2xl font-black text-foreground mt-1 leading-none">{stats.studyHours}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/50 border border-border text-center min-w-[120px] flex flex-col justify-between">
              <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider truncate">{t("Materials Uploaded", language)}</p>
              <p className="text-xl sm:text-2xl font-black text-foreground mt-1 leading-none">{stats.materialsUploaded}</p>
            </div>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={handleAvatarChange}
        className="hidden"
      />
    </div>
  );
};
export default ProfilePage;
