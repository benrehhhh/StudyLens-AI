import React, { useState, useEffect } from "react";
import { CountUp } from "../../components/ui/count-up";
import { useNavigate } from "react-router-dom";
import {
  Users, FolderKanban, BookCheck, Award, Plus, Download,
  BarChart2, MessageSquare, Layers, Megaphone, Trash2, ChevronRight, Pencil
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "../../context/AuthContext";
import { useAnnouncements, type AnnouncementItem } from "../../context/AnnouncementsContext";
import { useToast } from "../../context/ToastContext";
import { authFetch } from "../../utils/authFetch";
import { RelativeTime, isNewUser } from "../../utils/time";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { AnnouncementComposer } from "../../components/AnnouncementComposer";
import { CardDetailModal, DetailRow } from "../../components/CardDetailModal";
import type { Subject, Quiz } from "../../types";
import { ChartGradientDefs } from "../../utils/chartTheme";
import { chartTooltipProps, BRAND_BAR_FILL } from "../../utils/chartThemeConstants";

interface TeacherDashboardProps {
  onNavigate: (tab: string) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { announcements, deleteAnnouncement } = useAnnouncements();
  const { showToast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [analytics, setAnalytics] = useState<{ subjects: Record<string, unknown>[] } | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [annToDelete, setAnnToDelete] = useState<string | null>(null);
  const [detailCard, setDetailCard] = useState<"students" | "courses" | "assessments" | "materials" | null>(null);
  const [editingAnn, setEditingAnn] = useState<AnnouncementItem | null>(null);

  const openEditAnnouncement = (ann: AnnouncementItem) => {
    setEditingAnn(ann);
    setShowPostModal(true);
  };

  useEffect(() => {
    let isSubscribed = true;
    const fetchData = async () => {
      try {
        const [subRes, qzRes, anRes] = await Promise.all([
          authFetch("/api/subjects"),
          authFetch(`/api/quizzes?userId=${encodeURIComponent(currentUser?.id || "")}&userRole=teacher`),
          currentUser?.id
            ? authFetch(`/api/analytics/teacher?teacherId=${encodeURIComponent(currentUser.id)}`)
            : Promise.resolve(null),
        ]);
        if (subRes.ok && isSubscribed) {
          const subData = await subRes.json();
          setSubjects(subData);
        }
        if (qzRes.ok && isSubscribed) {
          const qzData = await qzRes.json();
          setQuizzes(qzData);
        }
        if (anRes && anRes.ok && isSubscribed) {
          const anData = await anRes.json();
          setAnalytics(anData);
        }
      } catch (err) {
        console.error("Teacher dashboard fetch error:", err);
      }
    };
    fetchData();
    return () => {
      isSubscribed = false;
    };
  }, [currentUser?.id]);

  const totalStudents = analytics?.totals?.studentCount ?? subjects.reduce((sum, s) => sum + (s.studentCount || 0), 0);
  const totalMaterials = subjects.reduce((sum, s) => sum + (s.materialCount || 0), 0);
  const totalQuizzes = quizzes.length;
  const publishedQuizzes = quizzes.filter((q) => q.isPublished).length;

  const handleExportReport = () => {
    const anMap = new Map<string, Record<string, unknown>>(
      (analytics?.subjects ?? []).map((s) => [String(s.subjectId), s])
    );
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Subject Code,Subject Name,Enrolled Students,Created Materials,Assessments,Avg Score (%),Pass Rate (%)\n" +
      subjects
        .map((s) => {
          const a = anMap.get(s.id);
          const avg = typeof a?.averageScore === "number" ? a.averageScore : "—";
          const pass = typeof a?.passRate === "number" ? a.passRate : "—";
          return `"${s.code}","${s.name}",${s.studentCount},${s.materialCount},${
            quizzes.filter((q) => q.subjectId === s.id).length
          },${avg},${pass}`;
        })
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `StudyLens_Faculty_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Faculty report exported as CSV.");
  };

  const enrollmentData = subjects.map((s) => ({
    name: s.code,
    students: s.studentCount || 0,
  }));

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            {isNewUser(currentUser?.createdAt) ? "Welcome" : "Welcome back"}, {currentUser?.name?.split(" ")[0] || "there"}!
          </h1>
          <p className="text-sm text-muted-foreground">
            Here's what's happening in your classes today.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              setEditingAnn(null);
              setShowPostModal(true);
            }}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Megaphone className="w-4 h-4" />
            <span>Post Notice</span>
          </button>
          <button
            onClick={handleExportReport}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-300" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Faculty Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setDetailCard("students")}
          className="text-left bg-card p-5 rounded-2xl border border-border shadow-2xs flex items-start justify-between cursor-pointer hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all group"
        >
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Active Students</p>
            <p className="text-3xl font-extrabold text-foreground tracking-tight"><CountUp value={totalStudents} /></p>
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              Enrolled across {subjects.length} subject{subjects.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="p-3 bg-structure text-primary dark:text-indigo-300 rounded-2xl shrink-0 relative">
            <Users className="w-6 h-6" />
            <ChevronRight className="w-3 h-3 absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setDetailCard("courses")}
          className="text-left bg-card p-5 rounded-2xl border border-border shadow-2xs flex items-start justify-between cursor-pointer hover:border-indigo-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all group"
        >
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Assigned Courses</p>
            <p className="text-3xl font-extrabold text-foreground tracking-tight"><CountUp value={subjects.length} /></p>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl shrink-0 relative">
            <FolderKanban className="w-6 h-6" />
            <ChevronRight className="w-3 h-3 absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setDetailCard("assessments")}
          className="text-left bg-card p-5 rounded-2xl border border-border shadow-2xs flex items-start justify-between cursor-pointer hover:border-emerald-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all group"
        >
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Assessments Created</p>
            <p className="text-3xl font-extrabold text-foreground tracking-tight"><CountUp value={totalQuizzes} /></p>
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              {publishedQuizzes} published to students
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl shrink-0 relative">
            <BookCheck className="w-6 h-6" />
            <ChevronRight className="w-3 h-3 absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setDetailCard("materials")}
          className="text-left bg-card p-5 rounded-2xl border border-border shadow-2xs flex items-start justify-between cursor-pointer hover:border-amber-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all group"
        >
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Materials Uploaded</p>
            <p className="text-3xl font-extrabold text-foreground tracking-tight"><CountUp value={totalMaterials} /></p>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0 relative">
            <Award className="w-6 h-6" />
            <ChevronRight className="w-3 h-3 absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>
      </div>

      {/* Main Grid: Subject Distribution Chart + Grading Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subject Enrollment & Performance Chart (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-primary dark:text-indigo-300" /> Class Size by Subject
                </h3>
                <p className="text-xs text-muted-foreground">Enrolled student count per subject</p>
              </div>
            </div>

            {enrollmentData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-10 text-center">No subjects yet.</p>
            ) : (
              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={enrollmentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <ChartGradientDefs />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} />
                    <Tooltip
                      {...chartTooltipProps}
                    />
                    <Bar dataKey="students" fill={BRAND_BAR_FILL} name="Enrolled Students" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Active Subjects Table / Cards */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Faculty Subject List</h3>
                <p className="text-xs text-muted-foreground">Course overview and materials uploaded</p>
              </div>
              <button
                onClick={() => onNavigate("subjects")}
                className="px-3 py-1.5 bg-structure text-primary dark:text-indigo-300 hover:bg-structure-strong rounded-lg text-xs font-semibold transition-all flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add / Manage Subject</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subjects.map((sub) => (
                <div
                  key={sub.id}
                  className="p-4 rounded-xl border border-border bg-muted/30 space-y-3 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => navigate(`/subjects/${sub.id}?tab=people`)}
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 bg-structure text-primary dark:text-indigo-300 rounded-md font-mono text-xs font-bold">
                      {sub.code}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {sub.studentCount} Students
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{sub.name}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{sub.description}</p>
                  </div>
                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span>{sub.materialCount} Documents</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate("materials");
                      }}
                      className="text-primary dark:text-indigo-300 hover:underline font-semibold text-[11px] cursor-pointer"
                    >
                      View Documents →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Course Bulletins & Announcements */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">Announcements</h3>

              <button
                onClick={() => onNavigate("announcements")}
                className="text-xs font-bold text-primary dark:text-indigo-300 hover:underline cursor-pointer"
              >
                View All →
              </button>
            </div>

            <div className="space-y-3">
              {announcements.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-border">
                  No active announcements published yet. Click "Post Notice" to broadcast a message.
                </div>
              ) : (
                announcements.slice(0, 3).map((ann) => (
                  <div
                    key={ann.id}
                    className="p-4 rounded-xl border border-border bg-muted/20 space-y-2 hover:border-primary/50 transition-all"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            ann.priority === "high"
                              ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                              : ann.priority === "medium"
                              ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                              : "bg-structure text-primary border border-structure-strong"
                          }`}
                        >
                          {ann.priority || "medium"}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <RelativeTime iso={ann.createdAt} className="text-[11px] text-muted-foreground" />
                        <button
                          onClick={() => openEditAnnouncement(ann)}
                          className="p-1 text-amber-600 hover:text-amber-700 rounded cursor-pointer"
                          title="Edit Bulletin"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setAnnToDelete(ann.id)}
                          className="p-1 text-rose-600 hover:text-rose-700 rounded cursor-pointer"
                          title="Delete Bulletin"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-foreground">{ann.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{ann.content}</p>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                      <span>Author: {ann.authorName}</span>
                      {ann.subjectName && (
                        <span className="text-primary dark:text-indigo-300 font-semibold">{ann.subjectName}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Column: Quick AI Actions */}
        <div className="space-y-6">
          <div className="bg-card p-5 rounded-2xl border border-border shadow-2xs space-y-3">
            <h4 className="text-sm font-bold text-foreground">Generate Study Materials</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Create quizzes, flashcards, or summaries from your lecture notes and documents.
            </p>
            <button
              onClick={() => onNavigate("ai-assistant")}
              className="w-full py-2.5 bg-cta-gradient hover:brightness-110 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Launch AI Study Assistant</span>
            </button>
            <button
              onClick={() => onNavigate("flashcards")}
              className="w-full py-2.5 bg-structure hover:bg-structure-strong text-structure-foreground font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-1"
            >
              <Layers className="w-4 h-4" />
              <span>Open Flashcards Deck</span>
            </button>
          </div>
        </div>
      </div>

      <AnnouncementComposer
        open={showPostModal}
        onClose={() => { setShowPostModal(false); setEditingAnn(null); }}
        editingAnn={editingAnn}
      />

      <ConfirmDialog
        open={annToDelete !== null}
        title="Delete Bulletin"
        message='Are you sure you want to delete this announcement? This action cannot be undone.'
        confirmLabel="Yes, Delete"
        destructive
        onConfirm={async () => {
          if (annToDelete) {
            const deleted = await deleteAnnouncement(annToDelete);
            showToast(deleted ? "Announcement deleted." : "Could not delete the announcement.", deleted ? "success" : "error");
          }
          setAnnToDelete(null);
        }}
        onCancel={() => setAnnToDelete(null)}
      />

      <CardDetailModal
        open={detailCard === "students"}
        title="Active Students"
        subtitle={`${totalStudents} student${totalStudents === 1 ? "" : "s"} enrolled across your ${subjects.length} course subject${subjects.length === 1 ? "" : "s"}.`}
        onClose={() => setDetailCard(null)}
      >
        {subjects.length === 0 ? (
          <p className="text-xs text-muted-foreground">No assigned subjects yet.</p>
        ) : (
          <ul className="space-y-2">
            {subjects.map((s) => (
              <li key={s.id}>
                <DetailRow
                  label={`${s.code} — ${s.name}`}
                  trailing={
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-structure text-primary dark:text-indigo-300">
                      {s.studentCount || 0} enrolled
                    </span>
                  }
                  onClick={() => navigate(`/subjects/${s.id}`)}
                />
              </li>
            ))}
          </ul>
        )}
      </CardDetailModal>

      <CardDetailModal
        open={detailCard === "courses"}
        title="Assigned Courses"
        subtitle={`You are currently assigned to ${subjects.length} course subject${subjects.length === 1 ? "" : "s"}.`}
        onClose={() => setDetailCard(null)}
      >
        {subjects.length === 0 ? (
          <p className="text-xs text-muted-foreground">No assigned subjects yet.</p>
        ) : (
          <ul className="space-y-2">
            {subjects.map((s) => (
              <li key={s.id}>
                <DetailRow
                  label={`${s.code} — ${s.name}`}
                  sublabel={[s.semester, s.course].filter(Boolean).join(" • ") || undefined}
                  onClick={() => navigate(`/subjects/${s.id}`)}
                />
              </li>
            ))}
          </ul>
        )}
      </CardDetailModal>

      <CardDetailModal
        open={detailCard === "assessments"}
        title="Assessments Created"
        subtitle={`${totalQuizzes} assessment${totalQuizzes === 1 ? "" : "s"} total, ${publishedQuizzes} published to students.`}
        onClose={() => setDetailCard(null)}
      >
        {quizzes.length === 0 ? (
          <p className="text-xs text-muted-foreground">No assessments created yet.</p>
        ) : (
          <ul className="space-y-2">
            {quizzes.map((q) => (
              <li key={q.id}>
                <DetailRow
                  label={q.title}
                  sublabel={q.subjectName}
                  trailing={
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        q.isPublished
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {q.isPublished ? "Published" : "Draft"}
                    </span>
                  }
                  onClick={() => {
                    setDetailCard(null);
                    onNavigate("assessments");
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </CardDetailModal>

      <CardDetailModal
        open={detailCard === "materials"}
        title="Materials Uploaded"
        subtitle={`${totalMaterials} learning material${totalMaterials === 1 ? "" : "s"} across all of your subjects.`}
        onClose={() => setDetailCard(null)}
      >
        {subjects.length === 0 ? (
          <p className="text-xs text-muted-foreground">No assigned subjects yet.</p>
        ) : (
          <ul className="space-y-2">
            {subjects.map((s) => (
              <li key={s.id}>
                <DetailRow
                  label={`${s.code} — ${s.name}`}
                  sublabel={`Open the materials library for this subject`}
                  trailing={
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      {s.materialCount || 0} material{(s.materialCount || 0) === 1 ? "" : "s"}
                    </span>
                  }
                  onClick={() => {
                    setDetailCard(null);
                    onNavigate("materials");
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </CardDetailModal>
    </div>
  );
};
