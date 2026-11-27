import React from "react";
import { Activity, X } from "lucide-react";
import type { ActivityLog } from "../../../types";
import { actionLabel, actionCategory } from "./adminDashboardUtils";

interface LogInspectionModalProps {
  open: boolean;
  onClose: () => void;
  log: ActivityLog | null;
  showToast: (message: string, type?: string, duration?: number) => void;
}

export const LogInspectionModal: React.FC<LogInspectionModalProps> = ({ open, onClose, log, showToast }) => {
  if (!open || !log) return null;

  return (
    <div
      role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">Audit Event Inspector</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-xl border border-border font-mono">
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-sans">Event Action</span>
              <span className={`font-bold text-sm ${actionCategory(log.action).badge}`}>{actionLabel(log.action)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-sans">Log ID</span>
              <span className="font-bold text-foreground">{log.id}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted/20 rounded-xl border border-border">
              <span className="text-muted-foreground block text-[10px] uppercase font-bold">Triggered By</span>
              <p className="font-bold text-foreground text-xs mt-0.5">{log.userName}</p>
              <p className="text-[10px] text-muted-foreground font-mono">ID: {log.userId}</p>
              <span className="inline-block px-2 py-0.5 mt-1 rounded bg-structure text-primary text-[10px] font-bold uppercase">
                Role: {log.userRole}
              </span>
            </div>

            <div className="p-3 bg-muted/20 rounded-xl border border-border">
              <span className="text-muted-foreground block text-[10px] uppercase font-bold">Origin & Timestamp</span>
              <p className="font-mono text-xs font-bold text-foreground mt-0.5">
                IP: {log.ipAddress || "127.0.0.1"}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono mt-1">
                {new Date(log.timestamp).toUTCString()}
              </p>
            </div>
          </div>

          <div className="p-3 bg-muted/30 rounded-xl border border-border space-y-1">
            <span className="text-muted-foreground text-[10px] uppercase font-bold">Event Description</span>
            <p className="text-foreground font-semibold leading-relaxed">{log.details}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted/20 rounded-xl border border-border">
              <span className="text-muted-foreground block text-[10px] uppercase font-bold">Device</span>
              <p className="font-semibold text-foreground text-xs mt-0.5 break-words">
                {log.device || "Web Browser"}
              </p>
            </div>
            <div className="p-3 bg-muted/20 rounded-xl border border-border">
              <span className="text-muted-foreground block text-[10px] uppercase font-bold">Browser</span>
              <p className="font-semibold text-foreground text-xs mt-0.5 break-words">
                {log.browser || "Chrome/Edge"}
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end space-x-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(log, null, 2));
              showToast("Log JSON copied");
            }}
            className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl cursor-pointer"
          >
            Copy JSON
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-structure hover:bg-structure-strong text-structure-foreground text-xs font-bold rounded-xl cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
