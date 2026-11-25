import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GeneratedReport } from "../../types";
import { ChartGradientDefs } from "../../utils/chartTheme";
import { chartTooltipProps, BRAND_BAR_FILL } from "../../utils/chartThemeConstants";

export function ReportDetails({ report }: { report: GeneratedReport }) {
  const s = (report.summary || {}) as Record<string, unknown>;

  if (report.reportType === "Quiz Analytics" && Array.isArray(s.quizzes)) {
    const qrows = s.quizzes as Record<string, unknown>[];
    return (
      <div className="space-y-4">
        {qrows.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No quiz analytics data available.</p>}
        {qrows.length > 0 && (
          <div className="space-y-3">
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={qrows.map((q) => ({ name: (q.quizTitle || "Quiz").slice(0, 24), avg: q.averageScore ?? 0 }))} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <ChartGradientDefs />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "currentColor" }} interval={0} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "currentColor" }} />
                  <Tooltip {...chartTooltipProps} />
                  <Bar dataKey="avg" fill={BRAND_BAR_FILL} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                  <th className="py-2 pr-2">Quiz</th>
                  <th className="py-2 px-2">Subject</th>
                  <th className="py-2 px-2 text-right">Attempts</th>
                  <th className="py-2 px-2 text-right">Avg</th>
                  <th className="py-2 px-2 text-right">Pass Rate</th>
                  <th className="py-2 px-2 text-right">High / Low</th>
                </tr>
              </thead>
              <tbody>
                {qrows.map((q, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 pr-2 font-semibold text-foreground">{String(q.quizTitle || "Quiz")}</td>
                    <td className="py-2 px-2 text-muted-foreground">{String(q.subjectName || "—")}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{Number(q.attempts ?? 0)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{Number(q.averageScore ?? 0)}%</td>
                    <td className="py-2 px-2 text-right tabular-nums">{Number(q.passRate ?? 0)}%</td>
                    <td className="py-2 px-2 text-right tabular-nums">{Number(q.highestScore ?? 0)} / {Number(q.lowestScore ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (report.reportType === "Subject Summary" && Array.isArray(s.subjects)) {
    const srows = s.subjects as Record<string, unknown>[];
    return (
      <div className="space-y-4">
        {srows.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No subject summary data available.</p>}
        {srows.length > 0 && (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                <th className="py-2 pr-2">Subject</th>
                <th className="py-2 px-2">Teacher</th>
                <th className="py-2 px-2 text-right">Materials</th>
                <th className="py-2 px-2 text-right">Quizzes</th>
                <th className="py-2 px-2 text-right">AI Items</th>
                <th className="py-2 px-2 text-right">Attempts</th>
                <th className="py-2 px-2 text-right">Avg</th>
              </tr>
            </thead>
            <tbody>
              {srows.map((srow, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 pr-2 font-semibold text-foreground">{String(srow.subjectName || "—")}</td>
                  <td className="py-2 px-2 text-muted-foreground">{String(srow.teacherName || "—")}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{Number(srow.materials ?? 0)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{Number(srow.quizzes ?? 0)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{Number(srow.aiGeneratedItems ?? 0)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{Number(srow.quizAttempts ?? 0)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{Number(srow.averageScore ?? 0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  if (report.reportType === "Student Performance") {
    const allStudents = s.allStudents === true;
    const students = Array.isArray(s.students) ? (s.students as Record<string, unknown>[]) : [];
    const attempts = Array.isArray(s.recentAttempts) ? (s.recentAttempts as Record<string, unknown>[]) : [];
    let content: JSX.Element | null = null;

    if (allStudents) {
      content = (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-muted/20 border border-border">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Students</p>
              <p className="text-base font-bold text-foreground">{Number(s.studentCount ?? 0)}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/20 border border-border">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Quizzes Taken</p>
              <p className="text-base font-bold text-foreground">{Number(s.quizzesTaken ?? 0)}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/20 border border-border">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Average Score</p>
              <p className="text-base font-bold text-foreground">{Number(s.averageScore ?? 0)}%</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/20 border border-border">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Pass Rate</p>
              <p className="text-base font-bold text-foreground">{Number(s.passRate ?? 0)}%</p>
            </div>
          </div>
          {students.length === 0
            ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No students found for this report.</p>
            )
            : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                    <th className="py-2 pr-2">Student</th>
                    <th className="py-2 px-2 text-right">Quizzes Taken</th>
                    <th className="py-2 px-2 text-right">Average Score</th>
                    <th className="py-2 px-2 text-right">Pass Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((st, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 pr-2 font-semibold text-foreground">{String(st.studentName || "Student")}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{Number(st.quizzesTaken ?? 0)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{Number(st.averageScore ?? 0)}%</td>
                      <td className="py-2 px-2 text-right tabular-nums">{Number(st.passRate ?? 0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      );
  } else {
    return (
      <div className="space-y-4">
      {attempts.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No recent attempts for this student.</p>}
      {attempts.length > 0 && (
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
              <th className="py-2 pr-2">Quiz</th>
              <th className="py-2 px-2">Subject</th>
              <th className="py-2 px-2 text-right">Score</th>
              <th className="py-2 px-2 text-right">%</th>
              <th className="py-2 px-2 text-center">Result</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((a, i) => (
              <tr key={i} className="border-b border-border/50">
                <td className="py-2 pr-2 font-semibold text-foreground">{String(a.quizTitle || "Quiz")}</td>
                <td className="py-2 px-2 text-muted-foreground">{String(a.subjectName || "—")}</td>
                <td className="py-2 px-2 text-right tabular-nums">{Number(a.score ?? 0)}/{Number(a.maxScore ?? a.totalPoints ?? 0)}</td>
                <td className="py-2 px-2 text-right tabular-nums">{Number(a.percentage ?? 0)}%</td>
                <td className="py-2 px-2 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${a.passed ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}>
                    {a.passed ? "Passed" : "Failed"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
  }

  return <div className="space-y-4">{content}</div>;
}

  if (report.reportType === "AI Usage" && s.breakdown && typeof s.breakdown === "object") {
    const b = s.breakdown as Record<string, unknown>;
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {Object.entries(b).map(([k, v]) => (
            <span key={k} className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary">
              {k}: {String(v)}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
