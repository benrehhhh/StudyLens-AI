import React from "react";
import { Eye } from "lucide-react";
import { Pagination } from "../../../components/Pagination";
import type { ActivityLog } from "../../../types";
import { actionLabel, actionCategory } from "./adminDashboardUtils";

interface ActivityLogsTableProps {
  logs: ActivityLog[];
  loadingLogs: boolean;
  logsTotal: number;
  logPage: number;
  setLogPage: (page: number) => void;
  onLogClick: (log: ActivityLog) => void;
}

export const ActivityLogsTable: React.FC<ActivityLogsTableProps> = ({
  logs,
  loadingLogs,
  logsTotal,
  logPage,
  setLogPage,
  onLogClick,
}) => (
  <>
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-xs">
        <thead className="uppercase text-muted-foreground border-b border-border bg-muted/50 font-bold">
          <tr>
            <th className="p-3">Event</th>
            <th className="p-3">User & Role</th>
            <th className="p-3">Details & Scope</th>
            <th className="p-3">IP Address</th>
            <th className="p-3">Timestamp</th>
            <th className="p-3 text-right">Inspect</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {loadingLogs ? (
            <tr>
              <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">
                Loading activity logs...
              </td>
            </tr>
          ) : logs.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-8 text-center text-muted-foreground">
                No matching activity logs found. Try adjusting search query or filters.
              </td>
            </tr>
          ) : (
            logs.map((log, index) => (
              <tr
                key={`${log.id}-${index}`}
                onClick={() => onLogClick(log)}
                className="hover:bg-muted/30 transition-colors cursor-pointer group"
              >
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${actionCategory(log.action).badge}`}>
                    {actionLabel(log.action)}
                  </span>
                </td>
                <td className="p-3">
                  <p className="font-bold text-foreground">{log.userName}</p>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">{log.userRole}</span>
                </td>
                <td className="p-3 text-foreground font-medium">{log.details}</td>
                <td className="p-3 font-mono text-[11px] text-muted-foreground">
                  {log.ipAddress || "127.0.0.1"}
                </td>
                <td className="p-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLogClick(log);
                    }}
                    className="p-1.5 bg-muted group-hover:bg-primary group-hover:text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>

    <Pagination page={logPage} total={logsTotal} onPageChange={setLogPage} />
  </>
);
