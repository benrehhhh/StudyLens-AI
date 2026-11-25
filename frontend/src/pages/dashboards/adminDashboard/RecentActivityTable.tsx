import React from "react";
import { ChevronRight } from "lucide-react";
import type { ActivityLog } from "../../../types";
import { actionLabel, actionCategory } from "./adminDashboardUtils";

interface RecentActivityTableProps {
  logs: ActivityLog[];
  onLogClick: (log: ActivityLog) => void;
  onViewAll: () => void;
}

export const RecentActivityTable: React.FC<RecentActivityTableProps> = ({ logs, onLogClick, onViewAll }) => (
  <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="text-base font-bold text-foreground">Recent Activity</h3>
      <button
        onClick={onViewAll}
        className="text-xs font-bold text-primary hover:text-primary/80 flex items-center space-x-1 cursor-pointer"
      >
        <span>View Full Audit Console →</span>
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="uppercase text-muted-foreground border-b border-border bg-muted/40">
          <tr>
            <th className="p-3 font-semibold">Event Action</th>
            <th className="p-3 font-semibold">Triggered By</th>
            <th className="p-3 font-semibold">Details</th>
            <th className="p-3 font-semibold">Timestamp</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {logs.slice(0, 5).map((log, index) => (
            <tr key={`${log.id}-${index}`} onClick={() => onLogClick(log)} className="hover:bg-muted/20 cursor-pointer">
              <td className="p-3">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${actionCategory(log.action).badge}`}>
                  {actionLabel(log.action)}
                </span>
              </td>
              <td className="p-3 font-bold text-foreground">{log.userName}</td>
              <td className="p-3 text-muted-foreground truncate max-w-xs">{log.details}</td>
              <td className="p-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                {new Date(log.timestamp).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
