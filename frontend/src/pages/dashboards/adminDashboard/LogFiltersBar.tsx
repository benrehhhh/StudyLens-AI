import React from "react";
import { Search } from "lucide-react";
import { LOG_CATEGORIES } from "./adminDashboardUtils";

interface LogFiltersBarProps {
  searchLog: string;
  setSearchLog: (value: string) => void;
  selectedActionFilter: string;
  setSelectedActionFilter: (value: string) => void;
  selectedLogRoleFilter: string;
  setSelectedLogRoleFilter: (value: string) => void;
}

export const LogFiltersBar: React.FC<LogFiltersBarProps> = ({
  searchLog,
  setSearchLog,
  selectedActionFilter,
  setSelectedActionFilter,
  selectedLogRoleFilter,
  setSelectedLogRoleFilter,
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/20 p-3 rounded-2xl border border-border">
    <div className="relative">
      <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
      <input
        type="text"
        value={searchLog}
        onChange={(e) => setSearchLog(e.target.value)}
        placeholder="Search action, user, IP, or keyword..."
        className="w-full pl-9 pr-3 py-1.5 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-medium"
      />
    </div>

    <div>
      <select
        value={selectedActionFilter}
        onChange={(e) => setSelectedActionFilter(e.target.value)}
        className="w-full p-2 bg-card border border-border rounded-xl text-xs text-foreground font-semibold focus:outline-none"
      >
        <option value="all">All Categories</option>
        {LOG_CATEGORIES.map((category) => (
          <option key={category.value} value={category.value}>
            {category.label}
          </option>
        ))}
      </select>
    </div>

    <div>
      <select
        value={selectedLogRoleFilter}
        onChange={(e) => setSelectedLogRoleFilter(e.target.value)}
        className="w-full p-2 bg-card border border-border rounded-xl text-xs text-foreground font-semibold focus:outline-none"
      >
        <option value="all">All Roles (Students, Teachers, Admins)</option>
        <option value="student">Student Role</option>
        <option value="teacher">Faculty / Teacher Role</option>
        <option value="admin">Administrator Role</option>
      </select>
    </div>
  </div>
);
