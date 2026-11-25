import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, AlertTriangle, RefreshCw, BarChart2, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuth } from "../../context/AuthContext";
import { authFetch } from "../../utils/authFetch";
import { CardDetailModal } from "../../components/CardDetailModal";
import { ChartGradientDefs } from "../../utils/chartTheme";
import { chartTooltipProps, BRAND_BAR_FILL } from "../../utils/chartThemeConstants";

interface AtRiskStudent {
  id: string;
  name: string;
  averageScore: number;
}

interface SubjectAnalytics {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  teacherName: string;
  studentCount: number;
  quizCount: number;
  attempts: number;
  averageScore: number;
  passRate: number;
  weakTopics: string[];
  atRiskStudents: AtRiskStudent[];
}

interface TeacherAnalytics {
  teacherId: string;
  subjects: SubjectAnalytics[];
  totals: {
    subjectCount: number;
    studentCount: number;
    attempts: number;
    averageScore: number;
    passRate: number;
    atRiskCount: number;
  };
}

export const TeacherAnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [analytics, setAnalytics] = useState<TeacherAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAtRiskModal, setShowAtRiskModal] = useState(false);
  const [detailCard, setDetailCard] = useState<"subjects" | "students" | "attempts" | "average" | "passrate" | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/analytics/teacher?teacherId=${encodeURIComponent(currentUser.id)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Could not load class analytics.");
        return;
      }
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error("Teacher analytics error:", err);
      setError("Could not reach the analytics service.");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAnalytics();
  }, [fetchAnalytics]);

  const t = analytics?.totals;
  const chartData = (analytics?.subjects ?? []).map((s) => ({
    name: s.subjectCode || s.subjectName,
    avg: s.averageScore,
    pass: s.passRate,
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Class Performance Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Real-time performance across your assigned subjects.
          </p>
        </div>
        <button
          onClick={fetchAnalytics}
          disabled={loading}
          className="px-3 py-1.5 bg-muted/50 hover:bg-muted text-foreground rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 border border-border cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <p className="text-xs text-rose-600 font-bold">{error}</p>
        </div>
      ) : loading && !analytics ? (
        <div className="bg-card border border-border rounded-2xl p-10 flex items-center justify-center text-muted-foreground text-xs">
          Loading class analytics...
        </div>
      ) : (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => setDetailCard("subjects")}
              className="text-left bg-card p-5 rounded-2xl border border-border shadow-xs cursor-pointer hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all group"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">Assigned Subjects</p>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
              </div>
              <p className="text-3xl font-black text-foreground mt-1">{t?.subjectCount ?? 0}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Click to see your subjects</p>
            </button>
            <button
              type="button"
              onClick={() => setDetailCard("students")}
              className="text-left bg-card p-5 rounded-2xl border border-border shadow-xs cursor-pointer hover:border-sky-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all group"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">Enrolled Students</p>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-sky-500 transition-colors" />
              </div>
              <p className="text-3xl font-black text-foreground mt-1">{t?.studentCount ?? 0}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Click to see enrollment by subject</p>
            </button>
            <button
              type="button"
              onClick={() => setDetailCard("attempts")}
              className="text-left bg-card p-5 rounded-2xl border border-border shadow-xs cursor-pointer hover:border-emerald-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all group"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">Quiz Attempts Graded</p>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-emerald-500 transition-colors" />
              </div>
              <p className="text-3xl font-black text-foreground mt-1">{t?.attempts ?? 0}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Click to see attempts by subject</p>
            </button>
            <button
              type="button"
              onClick={() => setDetailCard("average")}
              className="text-left bg-card p-5 rounded-2xl border border-border shadow-xs cursor-pointer hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all group"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">Class Average</p>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
              </div>
              <p className="text-3xl font-black text-foreground mt-1">{t?.averageScore ?? 0}%</p>
              <p className="text-[11px] text-muted-foreground mt-1">Click to see averages per subject</p>
            </button>
            <button
              type="button"
              onClick={() => setDetailCard("passrate")}
              className="text-left bg-card p-5 rounded-2xl border border-border shadow-xs cursor-pointer hover:border-emerald-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all group"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">Pass Rate</p>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-emerald-500 transition-colors" />
              </div>
              <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{t?.passRate ?? 0}%</p>
              <p className="text-[11px] text-muted-foreground mt-1">Click to see pass rates per subject</p>
            </button>
            <button
              type="button"
              onClick={() => setShowAtRiskModal(true)}
              className="text-left bg-card p-5 rounded-2xl border border-border shadow-xs cursor-pointer hover:border-amber-500/60 hover:shadow-md hover:-translate-y-0.5 transition-all group"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">At-Risk Students</p>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-amber-500 transition-colors" />
              </div>
              <p className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">{t?.atRiskCount ?? 0}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Click to see who needs support</p>
            </button>
          </div>

          {/* Chart */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Average Score by Subject (%)</h3>
              <BarChart2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="h-64 w-full">
              {chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  No subject performance data yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <ChartGradientDefs />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "currentColor" }} interval={0} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "currentColor" }} />
                    <Tooltip
                      {...chartTooltipProps}
                    />
                    <Bar dataKey="avg" fill={BRAND_BAR_FILL} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Per-subject breakdown */}
          {analytics && analytics.subjects.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center">
              <GraduationCap className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No subjects assigned to you yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(analytics?.subjects ?? []).map((s) => (
                <div key={s.subjectId} className="bg-card border border-border rounded-2xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-foreground">
                        {s.subjectCode} - {s.subjectName}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {s.teacherName} · {s.studentCount} students · {s.quizCount} quizzes
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-2xl font-black text-foreground tabular-nums">{s.averageScore}%</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Average</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{s.passRate}%</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pass rate</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {s.weakTopics.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground bg-muted/40 border border-border rounded-full px-3 py-1">
                        No weak topics detected
                      </span>
                    ) : (
                      s.weakTopics.map((topic) => (
                        <span key={topic} className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1">
                          {topic}
                        </span>
                      ))
                    )}
                  </div>

                  {s.atRiskStudents.length > 0 && (
                    <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2">
                      <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> At-risk students
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {s.atRiskStudents.map((st) => (
                          <span key={st.id} className="text-[11px] bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-full px-3 py-1 font-semibold">
                            {st.name} ({st.averageScore}%)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <CardDetailModal
        open={showAtRiskModal}
        title="At-Risk Students"
        subtitle={`${t?.atRiskCount ?? 0} student${(t?.atRiskCount ?? 0) === 1 ? "" : "s"} below the 70% average across your subjects.`}
        onClose={() => setShowAtRiskModal(false)}
      >
        {(analytics?.subjects ?? []).filter((s) => s.atRiskStudents.length > 0).length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No at-risk students detected. Great class performance!
          </p>
        ) : (
          (analytics?.subjects ?? [])
            .filter((s) => s.atRiskStudents.length > 0)
            .map((s) => (
              <div key={s.subjectId} className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pt-1">
                  {s.subjectCode} - {s.subjectName}
                </p>
                {s.atRiskStudents.map((st) => (
                  <div
                    key={st.id}
                    onClick={() => {
                      setShowAtRiskModal(false);
                      navigate("/reports");
                    }}
                    className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/40 flex items-center justify-between gap-3 cursor-pointer group transition-all"
                  >
                    <span className="text-xs font-bold text-foreground">{st.name}</span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full border text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30 tabular-nums">
                      {st.averageScore}% avg
                    </span>
                  </div>
                ))}
              </div>
            ))
        )}
      </CardDetailModal>

      <CardDetailModal
        open={detailCard === "subjects"}
        title="Assigned Subjects"
        subtitle={`You manage ${t?.subjectCount ?? 0} course subject${(t?.subjectCount ?? 0) === 1 ? "" : "s"}.`}
        onClose={() => setDetailCard(null)}
      >
        {(analytics?.subjects ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No subjects assigned to you yet.</p>
        ) : (
          (analytics?.subjects ?? []).map((s) => (
            <button
              key={s.subjectId}
              type="button"
              onClick={() => {
                setDetailCard(null);
                navigate(`/subjects/${s.subjectId}`);
              }}
              className="w-full flex items-center justify-between gap-3 p-3 mb-2 rounded-xl border border-border bg-muted/20 hover:bg-primary/5 hover:border-primary/40 text-left transition-all cursor-pointer group"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">
                  {s.subjectCode} - {s.subjectName}
                </p>
                <p className="text-[11px] text-muted-foreground">{s.quizCount} quiz{s.quizCount === 1 ? "" : "zes"}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
            </button>
          ))
        )}
      </CardDetailModal>

      <CardDetailModal
        open={detailCard === "students"}
        title="Enrolled Students"
        subtitle={`${t?.studentCount ?? 0} student${(t?.studentCount ?? 0) === 1 ? "" : "s"} enrolled across all of your subjects.`}
        onClose={() => setDetailCard(null)}
      >
        {(analytics?.subjects ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No subjects assigned to you yet.</p>
        ) : (
          (analytics?.subjects ?? []).map((s) => (
            <button
              key={s.subjectId}
              type="button"
              onClick={() => {
                setDetailCard(null);
                navigate(`/subjects/${s.subjectId}`);
              }}
              className="w-full flex items-center justify-between gap-3 p-3 mb-2 rounded-xl border border-border bg-muted/20 hover:bg-primary/5 hover:border-primary/40 text-left transition-all cursor-pointer group"
            >
              <p className="text-xs font-bold text-foreground truncate">
                {s.subjectCode} - {s.subjectName}
              </p>
              <span className="flex items-center gap-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 tabular-nums">
                {s.studentCount} students
                <ChevronRight className="w-3.5 h-3.5 group-hover:text-primary transition-colors" />
              </span>
            </button>
          ))
        )}
      </CardDetailModal>

      <CardDetailModal
        open={detailCard === "attempts"}
        title="Quiz Attempts Graded"
        subtitle={`${t?.attempts ?? 0} attempt${(t?.attempts ?? 0) === 1 ? "" : "s"} automatically graded across your subjects.`}
        onClose={() => setDetailCard(null)}
      >
        {(analytics?.subjects ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No subjects assigned to you yet.</p>
        ) : (
          (analytics?.subjects ?? []).map((s) => (
            <button
              key={s.subjectId}
              type="button"
              onClick={() => {
                setDetailCard(null);
                navigate(`/subjects/${s.subjectId}`);
              }}
              className="w-full flex items-center justify-between gap-3 p-3 mb-2 rounded-xl border border-border bg-muted/20 hover:bg-primary/5 hover:border-primary/40 text-left transition-all cursor-pointer group"
            >
              <p className="text-xs font-bold text-foreground truncate">
                {s.subjectCode} - {s.subjectName}
              </p>
              <span className="flex items-center gap-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 tabular-nums">
                {s.attempts} attempts
                <ChevronRight className="w-3.5 h-3.5 group-hover:text-primary transition-colors" />
              </span>
            </button>
          ))
        )}
      </CardDetailModal>

      <CardDetailModal
        open={detailCard === "average"}
        title="Class Average"
        subtitle={`Overall class average is ${t?.averageScore ?? 0}% (passing mark is 70%).`}
        onClose={() => setDetailCard(null)}
      >
        {(analytics?.subjects ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No subjects assigned to you yet.</p>
        ) : (
          (analytics?.subjects ?? []).map((s) => (
            <button
              key={s.subjectId}
              type="button"
              onClick={() => {
                setDetailCard(null);
                navigate(`/subjects/${s.subjectId}`);
              }}
              className="w-full space-y-1.5 p-3 mb-2 rounded-xl border border-border bg-muted/20 hover:bg-primary/5 hover:border-primary/40 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-foreground truncate">
                  {s.subjectCode} - {s.subjectName}
                </p>
                <span className="flex items-center gap-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-structure text-primary dark:text-indigo-300 tabular-nums">
                  {s.averageScore}%
                  <ChevronRight className="w-3.5 h-3.5 group-hover:text-primary transition-colors" />
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${s.averageScore >= 70 ? "bg-emerald-500" : "bg-amber-500"}`}
                  style={{ width: `${Math.min(100, Math.max(0, s.averageScore))}%` }}
                />
              </div>
            </button>
          ))
        )}
      </CardDetailModal>

      <CardDetailModal
        open={detailCard === "passrate"}
        title="Pass Rate"
        subtitle={`${t?.passRate ?? 0}% of graded attempts scored above the passing mark.`}
        onClose={() => setDetailCard(null)}
      >
        {(analytics?.subjects ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No subjects assigned to you yet.</p>
        ) : (
          (analytics?.subjects ?? []).map((s) => (
            <button
              key={s.subjectId}
              type="button"
              onClick={() => {
                setDetailCard(null);
                navigate(`/subjects/${s.subjectId}`);
              }}
              className="w-full space-y-1.5 p-3 mb-2 rounded-xl border border-border bg-muted/20 hover:bg-primary/5 hover:border-primary/40 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-foreground truncate">
                  {s.subjectCode} - {s.subjectName}
                </p>
                <span className="flex items-center gap-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {s.passRate}%
                  <ChevronRight className="w-3.5 h-3.5 group-hover:text-primary transition-colors" />
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${s.passRate >= 70 ? "bg-emerald-500" : "bg-amber-500"}`}
                  style={{ width: `${Math.min(100, Math.max(0, s.passRate))}%` }}
                />
              </div>
            </button>
          ))
        )}
      </CardDetailModal>
    </div>
  );
};
