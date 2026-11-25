import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { saveTextFile } from '../utils/fileExport';
import { Download, Award, Flame, Target, BookOpen, Sparkles, FileText, ChevronRight, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Card, StatCard, SectionHeader, ProgressBar, EmptyState, Modal } from '../components/ui';
import { ThemedBarChart, ThemedLineChart } from '../components/Charts';
import { formatRelative } from '../utils/time';
import { openQuizById, navTo } from '../navigation/navigationRef';
import {
  getApiBaseUrl,
  getAuthToken,
  fetchStudentProgress,
  StudentProgress,
  EMPTY_STUDENT_PROGRESS,
} from '../services/api';

interface TopicStat {
  topic: string;
  correct: number;
  wrong: number;
  accuracy: number;
}

interface ServerRecommendationStep {
  step: number;
  type: string;
  title: string;
  targetId: string | null;
  difficultyTarget: string;
}

interface ServerRecommendation {
  id: string;
  weakTopic: string;
  recommendationType: string;
  title: string;
  description: string;
  targetId: string;
  difficultyTarget: string;
  accuracyPercentage?: number | null;
  steps?: ServerRecommendationStep[];
}

function stepLabel(type: string): string {
  if (type === 'review') return 'Read';
  if (type === 'reviewer') return 'AI Reviewer';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export default function AnalyticsScreen({
  onNavigate,
  onOpenWeakTopic,
}: {
  onNavigate: (tab: string) => void;
  onOpenWeakTopic?: (topic: string) => void;
}) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const userId = currentUser?.id || '';

  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverRecs, setServerRecs] = useState<ServerRecommendation[] | null>(null);
  const [detailCard, setDetailCard] = useState<'average' | 'assessments' | 'best' | 'weak' | null>(null);

  useEffect(() => {
    if (!getAuthToken()) {
      setLoading(false);
      return;
    }
    fetchStudentProgress(userId)
      .then((data) => {
        setProgress(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load student progress:", err);
        setError("Could not load progress data.");
        setLoading(false);
      });
  }, [userId]);

  useEffect(() => {
    if (!getAuthToken()) return;
    let cancelled = false;
    fetch(`${getApiBaseUrl()}/recommendations/${userId}`, {
      headers: { 'X-Client-Type': 'mobile', Authorization: `Bearer ${getAuthToken()}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ServerRecommendation[] | null) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) setServerRecs(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) return null;

  const progressData = progress ?? EMPTY_STUDENT_PROGRESS(userId);
  const sorted = [...(progressData.recentQuizAttempts ?? [])]
    .map((a) => ({ ...a, completedAt: a.submittedAt || a.completedAt }))
    .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());

  const avg = progressData.averageScore;
  const best = sorted.reduce((max, a) => Math.max(max, a.percentage), 0);
  const passedCount = sorted.filter((a) => a.passed).length;

  const topicStats = progressData.topicPerformances.map((t) => ({
    topic: t.topic,
    correct: t.correctAnswers,
    wrong: Math.max(0, t.totalQuestions - t.correctAnswers),
    accuracy: t.accuracyPercentage,
  }));
  topicStats.sort((a, b) => a.accuracy - b.accuracy);

  const weakTopics = progressData.weakTopics;
  const masteredTopics = (progressData.masteredTopics ?? []).map((m) => m.topic);

  const chartTopics = [...topicStats]
    .sort((a, b) => (b.correct + b.wrong) - (a.correct + a.wrong))
    .slice(0, 5);
  const trend = sorted.slice(-8);

  const exportReport = async () => {
    const lines = [
      'StudyLens AI - Learning Progress Report',
      '==========================================',
      `Generated: ${new Date().toLocaleString()}`,
      `Total Assessments: ${sorted.length}`,
      `Average Score: ${Math.round(avg)}%`,
      `Best Score: ${best}%`,
      `Passed: ${passedCount}/${sorted.length}`,
      '',
      'Topic Accuracy',
      '--------------',
      ...topicStats.map((t) => `${t.topic}: ${t.accuracy}%`),
      '',
      'Attempt History',
      '---------------',
      ...sorted.map((a) => `${a.completedAt.slice(0, 10)} - ${a.quizTitle}: ${a.percentage}% ${a.passed ? '(PASS)' : '(FAIL)'}`),
      '',
      'Recommendations',
      '---------------',
      ...weakTopics.map((t) => `Review ${t} using materials + AI reviewer`),
    ];
    try {
      const outcome = await saveTextFile('StudyLens-Progress-Report.txt', lines.join('\n'), 'text/plain', 'Learning Progress Report');
      if (outcome === 'saved') showToast('Report saved to the selected folder.', 'success');
      else if (outcome === 'shared') showToast('Report ready.', 'success');
    } catch {
      showToast('Could not export the report.', 'error');
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.banner, { backgroundColor: colors.surfaceAlt }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: colors.foreground }]}>Progress Analytics</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
            Based on your recorded quiz attempts.
          </Text>
        </View>
        <TouchableOpacity onPress={exportReport} style={[styles.exportBtn, { backgroundColor: colors.primary }]}>
          <Download size={15} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>Report</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Average Score" value={`${Math.round(avg)}%`} delta={`${best}% best`} icon={<Award size={18} color={colors.primary} />} onPress={() => setDetailCard('average')} />
        <StatCard label="Assessments" value={String(sorted.length)} delta={`${passedCount} passed`} icon={<FileText size={18} color={colors.success} />} onPress={() => setDetailCard('assessments')} />
        <StatCard label="Best Score" value={`${best}%`} icon={<Flame size={18} color={colors.warning} />} onPress={() => setDetailCard('best')} />
        <StatCard label="Weak Topics" value={String(weakTopics.length)} delta="Review below" icon={<Target size={18} color={colors.danger} />} onPress={() => setDetailCard('weak')} />
      </View>

      <Modal
        visible={detailCard === 'average'}
        onClose={() => setDetailCard(null)}
        title="Average Score"
        subtitle={`Overall average: ${Math.round(avg)}% (passing mark is 70%).`}
      >
        <View style={{ gap: 8 }}>
          {sorted.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Take a quiz to build your score history.</Text>
          ) : (
            sorted.map((a, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.detailRow, { borderColor: colors.border }]}
                activeOpacity={0.7}
                onPress={() => {
                  setDetailCard(null);
                  onNavigate('quiz');
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                    {a.quizTitle}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{a.subjectName}</Text>
                </View>
                <Text style={{ color: a.percentage >= 70 ? colors.success : colors.danger, fontSize: 12, fontWeight: '800' }}>
                  {a.percentage}%
                </Text>
                <ChevronRight size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </Modal>

      <Modal
        visible={detailCard === 'assessments'}
        onClose={() => setDetailCard(null)}
        title="Assessments Taken"
        subtitle={`${sorted.length} assessment${sorted.length === 1 ? '' : 's'} completed, ${passedCount} passed.`}
      >
        <View style={{ gap: 8 }}>
          {sorted.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>No assessments recorded yet.</Text>
          ) : (
            sorted.map((a, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.detailRow, { borderColor: colors.border }]}
                activeOpacity={0.7}
                onPress={() => {
                  setDetailCard(null);
                  onNavigate('quiz');
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                    {a.quizTitle}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{formatRelative(a.completedAt)}</Text>
                </View>
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: '900',
                    backgroundColor: a.passed ? colors.success : colors.danger,
                    borderRadius: 6,
                    paddingHorizontal: 7,
                    paddingVertical: 3,
                    overflow: 'hidden',
                  }}
                >
                  {a.passed ? 'PASS' : 'FAIL'}
                </Text>
                <ChevronRight size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </Modal>

      <Modal
        visible={detailCard === 'best'}
        onClose={() => setDetailCard(null)}
        title="Best Score"
        subtitle={`Your highest score so far is ${best}%.`}
      >
        <View style={{ gap: 8 }}>
          {sorted.filter((a) => a.percentage === best).length === 0 ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>No attempts recorded yet.</Text>
          ) : (
            sorted
              .filter((a) => a.percentage === best)
              .map((a, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.detailRow, { borderColor: colors.border }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setDetailCard(null);
                    onNavigate('quiz');
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                      {a.quizTitle}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{a.subjectName}</Text>
                  </View>
                  <Text style={{ color: colors.success, fontSize: 12, fontWeight: '800' }}>{a.percentage}%</Text>
                  <ChevronRight size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))
          )}
        </View>
      </Modal>

      <Modal
        visible={detailCard === 'weak'}
        onClose={() => setDetailCard(null)}
        title="Weak Topics"
        subtitle={`${weakTopics.length} topic${weakTopics.length === 1 ? '' : 's'} below the 70% accuracy mark.`}
      >
        <View style={{ gap: 8 }}>
          {weakTopics.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>No weak topics detected. Great job!</Text>
          ) : (
            weakTopics.map((topicName) => {
              const stat = topicStats.find((t) => t.topic === topicName);
              return (
                <TouchableOpacity
                  key={topicName}
                  style={[styles.detailRow, { borderColor: colors.border }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setDetailCard(null);
                    if (onOpenWeakTopic) onOpenWeakTopic(topicName);
                    else onNavigate('ai-assistant');
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>
                      {topicName}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>Tap to study with AI</Text>
                  </View>
                  <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '800' }}>
                    {stat ? `${stat.accuracy}%` : '—'}
                  </Text>
                  <ChevronRight size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </Modal>

      {topicStats.length > 0 ? (
        <Card style={{ gap: 12 }}>
          <SectionHeader title="Topic Accuracy" subtitle="Your performance by learning topic" />
          <ThemedBarChart
            data={{
              labels: chartTopics.map((t) => t.topic.slice(0, 10)),
              values: chartTopics.map((t) => t.accuracy),
            }}
            suffix="%"
          />
        </Card>
      ) : (
        <EmptyState icon={<BookOpen size={36} color={colors.mutedForeground} />} title="No topic data yet" />
      )}

      {trend.length > 0 && (
        <Card style={{ gap: 12 }}>
          <SectionHeader title="Score Progression" subtitle="Last 8 assessment scores" />
          <ThemedLineChart
            data={{
              labels: trend.map((a) => a.completedAt.slice(5, 10)),
              values: trend.map((a) => a.percentage),
            }}
            color={colors.success}
          />
        </Card>
      )}

      <Card style={{ gap: 12 }}>
        <SectionHeader title="Recommendations" subtitle="Based on your weakest topics" />
        {serverRecs && serverRecs.length > 0 ? (
          serverRecs.map((rec) => (
            <View key={rec.id} style={[styles.recoCard, { borderColor: colors.border, flexDirection: 'column', alignItems: 'flex-start' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' }}>
                <View style={[styles.recoIcon, { backgroundColor: colors.dangerSoft }]}>
                  <Target size={16} color={colors.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '800' }}>{rec.weakTopic}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>
                    {typeof rec.accuracyPercentage === 'number' ? `${rec.accuracyPercentage}% accuracy - ` : ''}
                    {rec.title}
                  </Text>
                </View>
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 11, lineHeight: 17 }}>{rec.description}</Text>
              {rec.steps && rec.steps.length > 0 && (
                <View style={{ gap: 6, width: '100%' }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Suggested steps
                  </Text>
                  {rec.steps.map((s) => (
                    <TouchableOpacity
                      key={`${rec.id}-${s.step}`}
                      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}
                      activeOpacity={0.7}
                      onPress={() => {
                        if (s.type === 'quiz' && s.targetId) {
                          openQuizById(s.targetId);
                        } else if (s.type === 'flashcard') {
                          navTo('flashcards');
                        } else if (s.type === 'reviewer' || s.type === 'summary') {
                          navTo('ai-assistant');
                        } else {
                          navTo('materials');
                        }
                      }}
                    >
                      <View style={[styles.stepDot, { backgroundColor: colors.primary }]}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>{s.step}</Text>
                      </View>
                      <Text style={{ color: colors.foreground, fontSize: 12, flex: 1 }}>
                        <Text style={{ fontWeight: '800' }}>{stepLabel(s.type)}: </Text>
                        {s.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))
        ) : weakTopics.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>No weak topics detected. Keep up the excellent work!</Text>
        ) : (
          weakTopics.map((topicName) => {
            const stat = topicStats.find((t) => t.topic === topicName);
            return (
              <View key={topicName} style={[styles.recoCard, { borderColor: colors.border }]}>
                <View style={[styles.recoIcon, { backgroundColor: colors.dangerSoft }]}>
                  <Target size={16} color={colors.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '800' }}>
                    {topicName}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>
                    {stat ? `${stat.accuracy}%` : '—'}% accuracy - review materials and retake quizzes
                  </Text>
                  <View style={styles.recoBar}>
                    <ProgressBar value={stat ? stat.accuracy : 0} color={colors.danger} height={6} />
                  </View>
                </View>
              </View>
            );
          })
        )}
        {masteredTopics.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.success, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Overcome ({masteredTopics.length})
            </Text>
            {masteredTopics.slice(0, 4).map((topic) => {
              const stat = topicStats.find((s) => s.topic === topic);
              return (
                <View key={topic} style={[styles.recoCard, { borderColor: colors.border }]}>
                  <View style={[styles.recoIcon, { backgroundColor: colors.successSoft }]}>
                    <CheckCircle2 size={16} color={colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '800' }}>{topic}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>
                      Mastered · now at {stat ? `${stat.accuracy}%` : '70%+'} accuracy
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        <View style={styles.recoActions}>
          <TouchableOpacity onPress={() => onNavigate('materials')} style={[styles.recoBtn, { backgroundColor: colors.indigoSoft }]}>
            <BookOpen size={15} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Review Materials</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onNavigate('ai-assistant')} style={[styles.recoBtn, { backgroundColor: colors.successSoft }]}>
            <Sparkles size={15} color={colors.success} />
            <Text style={{ color: colors.success, fontSize: 12, fontWeight: '700' }}>AI Study Tools</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onNavigate('quiz')} style={[styles.recoBtn, { backgroundColor: colors.warningSoft }]}>
            <Target size={15} color={colors.warning} />
            <Text style={{ color: colors.warning, fontSize: 12, fontWeight: '700' }}>Retake Quiz</Text>
          </TouchableOpacity>
        </View>
      </Card>

      <Card style={{ gap: 10 }}>
        <SectionHeader title="Recent Attempts" />
        {sorted.slice(0, 5).map((a) => (
          <View key={a.id} style={[styles.attemptRow, { borderColor: colors.border }]}>
            <View style={[styles.attemptBadge, { backgroundColor: a.passed ? colors.successSoft : colors.dangerSoft }]}>
              <Text style={{ color: a.passed ? colors.success : colors.danger, fontSize: 11, fontWeight: '900' }}>{a.percentage}%</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                {a.quizTitle}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                {new Date(a.completedAt).toLocaleDateString()} - {a.subjectName}
              </Text>
            </View>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16 },
  bannerTitle: { fontSize: 16, fontWeight: '800' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  recoCard: { flexDirection: 'row', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center' },
  recoIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  recoBar: { marginTop: 6 },
  stepDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  recoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  attemptRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, paddingBottom: 10 },
  attemptBadge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
});