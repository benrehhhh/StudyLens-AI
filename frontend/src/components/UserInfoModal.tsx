import React from "react";
import { X, Mail, User, ShieldCheck, Building2 } from "lucide-react";
import { avatarUrl } from "../utils/avatar";

interface UserInfoModalProps {
  open: boolean;
  onClose: () => void;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    department?: string | null;
    studentId?: string | null;
    status?: string | null;
    avatar?: string | null;
  };
}

export const UserInfoModal: React.FC<UserInfoModalProps> = ({
  open,
  onClose,
  user,
}) => {
  if (!open) return null;

  const roleLabels: Record<string, { label: string; icon: React.ElementType }> = {
    student: { label: "Student", icon: GraduationCap },
    teacher: { label: "Teacher / Faculty", icon: ShieldCheck },
    admin: { label: "Administrator", icon: Building2 },
  };

  const roleInfo = roleLabels[user.role] || { label: user.role, icon: User };

  return (
    <div
      role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-2xl max-w-md w-full shadow-xl animate-in fade-in zoom-in-95 flex flex-col max-h-[80vh]">
        <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b border-border">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              {user.name}
            </h3>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                user.role === "student"
                  ? "text-primary dark:text-indigo-300 bg-structure border-structure-strong"
                  : user.role === "teacher"
                    ? "text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/30"
                    : "text-muted-foreground bg-slate-500/10 border-slate-500/30"
              }`}
            >
              {roleInfo.label}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 pt-4 overflow-y-auto space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
              {user.avatar ? (
                <img src={avatarUrl(user.avatar)} alt={user.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-[12px] font-bold text-muted-foreground">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {user.role === "student"
                  ? "Student ID"
                  : user.role === "teacher"
                    ? "Teacher ID"
                    : "Admin ID"}
              </p>
              <p className="text-sm font-mono text-foreground truncate">{user.studentId || user.id}</p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email</p>
                <p className="text-sm text-foreground truncate">{user.email || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Department</p>
                <p className="text-sm text-foreground truncate">{user.department || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</p>
                <p className={`text-sm font-bold ${
                  user.status === "suspended"
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}>
                  {user.status === "suspended" ? "Suspended" : "Active"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
