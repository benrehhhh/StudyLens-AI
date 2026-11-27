import React from "react";
import { Users, Activity, BookOpen, ChevronRight } from "lucide-react";
import type { ActivityLog } from "../../../types";
import { RecentActivityTable } from "./RecentActivityTable";
import { QuickBulletins } from "./QuickBulletins";

interface AdminOverviewTabProps {
  users: { length: number }[];
  subjects: { length: number }[];
  logsTotal: number;
  logs: ActivityLog[];
  onDetailUsers: () => void;
  onDetailSubjects: () => void;
  onActivityLogs: () => void;
  onLogClick: (log: ActivityLog) => void;
  announcements: { id: string; title: string; content: string; priority: string; targetAudience: string; authorName: string; createdAt: string; tag?: string; subjectName?: string }[];
  onBroadcast: () => void;
  onManage: () => void;
}

export const AdminOverviewTab: React.FC<AdminOverviewTabProps> = ({
  users,
  subjects,
  logsTotal,
  logs,
  onDetailUsers,
  onDetailSubjects,
  onActivityLogs,
  onLogClick,
  announcements,
  onBroadcast,
  onManage,
}) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <button
        type="button"
        onClick={onDetailUsers}
        className="text-left bg-card p-5 rounded-2xl border border-border shadow-2xs flex items-start justify-between cursor-pointer hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all group"
      >
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">User Accounts</p>
          <p className="text-3xl font-extrabold text-foreground tracking-tight">{users.length}</p>
        </div>
        <div className="p-3 bg-structure text-primary dark:text-indigo-300 rounded-2xl shrink-0 relative">
          <Users className="w-6 h-6" />
          <ChevronRight className="w-3 h-3 absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </button>

      <button
        type="button"
        onClick={onDetailSubjects}
        className="text-left bg-card p-5 rounded-2xl border border-border shadow-2xs flex items-start justify-between cursor-pointer hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all group"
      >
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Course Subjects</p>
          <p className="text-3xl font-extrabold text-foreground tracking-tight">{subjects.length}</p>
        </div>
        <div className="p-3 bg-structure text-primary dark:text-indigo-300 rounded-2xl shrink-0 relative">
          <BookOpen className="w-6 h-6" />
          <ChevronRight className="w-3 h-3 absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </button>

      <button
        type="button"
        onClick={onActivityLogs}
        className="text-left bg-card p-5 rounded-2xl border border-border shadow-2xs flex items-start justify-between cursor-pointer hover:border-emerald-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all group"
      >
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Activity Events</p>
          <p className="text-3xl font-extrabold text-foreground tracking-tight">{logsTotal.toLocaleString()}</p>
        </div>
        <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl shrink-0 relative">
          <Activity className="w-6 h-6" />
          <ChevronRight className="w-3 h-3 absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </button>
    </div>

    <RecentActivityTable logs={logs.slice(0, 5)} onLogClick={onLogClick} onViewAll={onActivityLogs} />

    <QuickBulletins
      announcements={announcements}
      onBroadcast={onBroadcast}
      onManage={onManage}
    />
  </div>
);
