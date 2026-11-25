import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Bell, GraduationCap, Pencil, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useAnnouncements, type AnnouncementItem } from "../context/AnnouncementsContext";
import { useToast } from "../context/ToastContext";
import { authFetch } from "../utils/authFetch";
import { RelativeTime } from "../utils/time";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { AnnouncementComposer } from "../components/AnnouncementComposer";
import type { Subject } from "../types";

export const AnnouncementsView: React.FC = () => {
  const { currentUser } = useAuth();
  const { announcements, deleteAnnouncement } = useAnnouncements();
  const { showToast } = useToast();
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("all");
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Post/Edit Announcement Modal
  const [showPostModal, setShowPostModal] = useState(false);
  const [editingAnn, setEditingAnn] = useState<AnnouncementItem | null>(null);
  const [annToDelete, setAnnToDelete] = useState<string | null>(null);

  // Selected Announcement Detail Modal
  const [detailItem, setDetailItem] = useState<AnnouncementItem | null>(null);
  const [dismissedTargetId, setDismissedTargetId] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const targetId = queryParams.get("id");

  // Fetch Subjects for Dropdown
  useEffect(() => {
    authFetch("/api/subjects")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSubjects(data);
      })
      .catch(() => {});
  }, []);

  // Open detail if targetId query param is present
  useEffect(() => {
    if (targetId && targetId !== dismissedTargetId && detailItem?.id !== targetId) {
      const found = announcements.find((a) => a.id === targetId);
      if (found) {
        const timer = setTimeout(() => {
          setDetailItem(found);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [targetId, dismissedTargetId, announcements, detailItem]);

  const handleCloseDetail = () => {
    if (targetId) {
      setDismissedTargetId(targetId);
    }
    setDetailItem(null);
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.has("id")) {
      searchParams.delete("id");
      const searchStr = searchParams.toString();
      navigate(`${location.pathname}${searchStr ? `?${searchStr}` : ""}`, { replace: true });
    }
  };

  const openEditAnnouncement = (ann: AnnouncementItem) => {
    setEditingAnn(ann);
    setShowPostModal(true);
  };

  const isTeacherOrAdmin = currentUser?.role === "teacher" || currentUser?.role === "admin";
  // Only the author can edit/delete an announcement; teacher/admin cannot manage
  // the other role's posts (enforced on both the client and the server).
  const isAnnouncementAuthor = (ann: AnnouncementItem) =>
    !!currentUser?.id && currentUser.id === ann.authorId;

  const filtered = announcements.filter((a) => {
    if (selectedSubjectFilter !== "all" && a.subjectId !== selectedSubjectFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 flex-wrap">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto min-w-0">
          {/* Subject Filter */}
          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="w-full sm:w-auto min-w-0 px-3 py-1.5 bg-muted/50 border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Subjects</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.code} - {sub.name}
              </option>
            ))}
          </select>

          <div className="flex items-center space-x-1 p-1 bg-muted/50 rounded-xl border border-border text-xs">
            <button
              onClick={() => setSelectedSubjectFilter("all")}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedSubjectFilter === "all" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({announcements.length})
            </button>
          </div>

          {isTeacherOrAdmin && (
            <button
              onClick={() => {
                setEditingAnn(null);
                setShowPostModal(true);
              }}
              className="px-4 py-1.5 bg-cta-gradient hover:brightness-110 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              <span>Post Announcement</span>
            </button>
          )}
        </div>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="p-8 text-center bg-card border border-border rounded-2xl">
            <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-foreground">No announcements found</p>
            <p className="text-xs text-muted-foreground">No announcements posted yet.</p>
          </div>
        ) : (
          filtered.map((item) => {
            const isTargeted = targetId === item.id;
            return (
              <div
                key={item.id}
                id={`announcement-${item.id}`}
                onClick={() => {
                  setDetailItem(item);
                }}
                className={`p-5 rounded-2xl border transition-all space-y-3 cursor-pointer group ${
                  isTargeted
                    ? "bg-structure border-primary ring-2 ring-ring/30 shadow-md"
                    : "bg-card border-border hover:border-primary/50 opacity-90 hover:opacity-100"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-border/30">
                  <div className="flex items-center space-x-2 flex-wrap gap-1.5">
                    <span
                      className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full uppercase tracking-wider ${
                        item.priority === "high"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          : item.priority === "medium"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          : "bg-structure text-primary dark:text-indigo-300 border border-structure-strong"
                      }`}
                    >
                      {item.tag || item.priority.toUpperCase()}
                    </span>
                    {item.subjectName && (
                      <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-structure text-primary dark:text-indigo-300 border border-structure-strong">
                        {item.subjectName}
                      </span>
                    )}
                    {isTargeted && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950 uppercase tracking-wider">
                        Selected
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 shrink-0 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
                    <RelativeTime iso={item.createdAt} className="text-xs text-muted-foreground" />
                    {isAnnouncementAuthor(item) && (
                      <>
                        <button
                          onClick={() => openEditAnnouncement(item)}
                          className="p-1.5 text-amber-600 hover:bg-amber-500/10 rounded-lg cursor-pointer"
                          title="Edit Announcement"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setAnnToDelete(item.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                          title="Delete Announcement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-2">{item.content}</p>
                </div>

                <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Posted by <strong className="text-foreground">{item.authorName}</strong></span>
                  <span className="capitalize text-[11px]">Audience: {item.targetAudience}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <AnnouncementComposer
        open={showPostModal}
        onClose={() => { setShowPostModal(false); setEditingAnn(null); }}
        editingAnn={editingAnn}
      />

      {/* ANNOUNCEMENT DETAIL VIEW MODAL */}
      {detailItem && (
        <div
          role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
          onClick={handleCloseDetail}
        >
          <div
            className="bg-card border border-border p-6 rounded-2xl max-w-xl w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2 flex-wrap gap-1">
                  <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-primary/10 text-primary border border-primary/20">
                    {detailItem.tag || detailItem.priority.toUpperCase()}
                  </span>
                  {detailItem.subjectName && (
                    <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-structure text-primary dark:text-indigo-300 border border-structure-strong">
                      {detailItem.subjectName}
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-muted text-muted-foreground capitalize">
                    Audience: {detailItem.targetAudience}
                  </span>
                </div>

                <h2 className="text-lg font-bold text-foreground leading-snug">{detailItem.title}</h2>
              </div>

              <button
                onClick={handleCloseDetail}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Author and Date Meta */}
            <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-foreground">{detailItem.authorName}</p>
                  <p className="text-[10px] text-muted-foreground">Course Announcement Author</p>
                </div>
              </div>
              <RelativeTime iso={detailItem.createdAt} className="font-medium text-foreground" />
            </div>

            {/* Content Body */}
            <div className="bg-muted/20 p-4 rounded-xl border border-border/60 text-xs text-foreground leading-relaxed whitespace-pre-wrap min-h-[120px]">
              {detailItem.content}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button
                onClick={handleCloseDetail}
                className="px-5 py-2 bg-structure hover:bg-structure-strong text-structure-foreground rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close Notice
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={annToDelete !== null}
        title="Delete Announcement?"
        message="This announcement will be permanently removed for everyone. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (annToDelete) {
            const deleted = await deleteAnnouncement(annToDelete);
            showToast(deleted ? "Announcement deleted." : "Could not delete the announcement.", deleted ? "success" : "error");
          }
          setAnnToDelete(null);
        }}
        onCancel={() => setAnnToDelete(null)}
      />
    </div>
  );
};
