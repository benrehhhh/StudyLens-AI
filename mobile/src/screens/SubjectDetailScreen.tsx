import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  TextInput,
} from 'react-native';
import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { saveTextFile, saveBytesFile } from '../utils/fileExport';
import {
  ArrowLeft,
  Users,
  FileText,
  GraduationCap,
  Bell,
  Eye,
  Download,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Plus,
  Megaphone,
  ShieldCheck,
  UserCheck,
ChevronRight,
  Play,
  BarChart2,
  RotateCw,
  Flag,
} from 'lucide-react-native';
import {
  fetchMaterials,
  fetchQuizzes,
  fetchSubjectStudents,
  fetchSubjectGrades,
  fetchAdminUsers,
  fetchMaterialFlags,
  flagMaterial,
  resolveMaterialFlag,
  assignStudentsToSubject,
  removeStudentsFromSubject,
  resolveMaterialFileUrl,
  updateMaterial,
  deleteMaterial,
  updateQuiz,
  deleteQuiz,
  createAnnouncement,
  convertToPdf,
  Material,
  MaterialFlag,
  MaterialFlagCategory,
  Quiz,
  QuizAttempt,
  Subject,
  SubjectStudent,
  SubjectGrades,
  User,
  Announcement,
} from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAnnouncements } from '../context/AnnouncementsContext';
import { Card, Badge, LoadingView, EmptyState, Modal, Field, PrimaryButton, OutlineButton } from '../components/ui';
import { getQuizProgresses, SavedQuizProgress } from '../utils/storage';
import { MaterialFileViewer, materialViewerExt } from '../components/MaterialFileViewer';

type TabKey = 'people' | 'materials' | 'quizzes' | 'announcements' | 'grades';

const RENDERABLE_TYPES = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'mp4', 'webm', 'ogg', 'mov'];

const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
};

const fileExt = (m: Material): string => (m.fileType || '').toLowerCase().replace(/^\./, '');
const isRenderable = (m: Material): boolean => RENDERABLE_TYPES.includes(fileExt(m));
const mimeFor = (m: Material): string => MIME_MAP[fileExt(m)] || 'application/octet-stream';

interface AttemptGroup {
  title: string;
  entries: QuizAttempt[];
}

function groupAttemptsByQuiz(attempts: QuizAttempt[]): AttemptGroup[] {
  const groups: AttemptGroup[] = [];
  for (const att of attempts) {
    let g = groups.find((x) => x.title === att.quizTitle);
    if (!g) {
      g = { title: att.quizTitle, entries: [] };
      groups.push(g);
    }
    g.entries.push(att);
  }
  return groups;
}
const safeFileName = (m: Material): string => (m.title || 'material').replace(/[^\w\s-]/g, '').slice(0, 40);

export default function SubjectDetailScreen({
  subject,
  onBack,
  onNavigate,
  onOpenQuiz,
  initialTab,
}: {
  subject: Subject;
  onBack: () => void;
  onNavigate: (tab: string) => void;
  onOpenQuiz: (quiz: Quiz) => void;
  initialTab?: TabKey | null;
}) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const { announcements, addLocalAnnouncement, reloadAnnouncements } = useAnnouncements();

  const [tab, setTab] = useState<TabKey>(initialTab || 'materials');

  useEffect(() => {
    if (initialTab && initialTab !== tab) setTab(initialTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [savedMap, setSavedMap] = useState<Record<string, SavedQuizProgress>>({});
  const [students, setStudents] = useState<SubjectStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [grades, setGrades] = useState<SubjectGrades | null>(null);
  const [gradesLoading, setGradesLoading] = useState(false);

  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null);


  const [allStudents, setAllStudents] = useState<User[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [assigningStudents, setAssigningStudents] = useState(false);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);

  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null);
  const [previewBusy, setPreviewBusy] = useState<string | null>(null);
  const [matVisible, setMatVisible] = useState(15);
  const [quizVisible, setQuizVisible] = useState(15);
  const [annVisible, setAnnVisible] = useState(15);

  const [materialFlags, setMaterialFlags] = useState<MaterialFlag[]>([]);
  const [flagTarget, setFlagTarget] = useState<Material | null>(null);
  const [flagCategory, setFlagCategory] = useState<MaterialFlagCategory>('Wrong file');
  const [flagNote, setFlagNote] = useState('');
  const [flagBusy, setFlagBusy] = useState(false);
  const [showFlagsModal, setShowFlagsModal] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<MaterialFlag | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolvingFlag, setResolvingFlag] = useState(false);

  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [eqTitle, setEqTitle] = useState('');
  const [eqDescription, setEqDescription] = useState('');
  const [eqDifficulty, setEqDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [eqTimeLimit, setEqTimeLimit] = useState(15);
  const [eqPassPct, setEqPassPct] = useState(70);
  const [eqLimitAttempts, setEqLimitAttempts] = useState(false);
  const [eqAttempts, setEqAttempts] = useState(3);
  const [eqRevealAnswers, setEqRevealAnswers] = useState(true);

  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annPriority, setAnnPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [postingAnn, setPostingAnn] = useState(false);

  const isStaff =
    currentUser?.role === 'admin' || (currentUser?.role === 'teacher' && currentUser.id === subject.teacherId);

  const canManage =
    currentUser?.role === 'teacher' && currentUser.id === subject.teacherId;

  const attemptsExhausted = (q: Quiz): boolean => {
    const allowed = q.attemptsAllowed || 0;
    return q.quizType !== 'student' && allowed > 0 && (q.attemptsUsed || 0) >= allowed;
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    const uid = currentUser?.id || 'guest';
    Promise.all([
      fetchMaterials(),
      fetchQuizzes(currentUser?.role, currentUser?.id),
      fetchSubjectStudents(subject.id),
      fetchSubjectGrades(subject.id),
      getQuizProgresses(uid),
      fetchMaterialFlags(),
    ])
      .then(([mats, qs, stus, grds, progs, flags]) => {
        if (!active) return;
        setMaterials(mats.filter((m) => m.subjectId === subject.id));
        const qlist = qs.filter((q) => q.subjectId === subject.id);
        setQuizzes(isStaff ? qlist : qlist.filter((q) => q.isPublished !== false));
        setStudents(stus);
        setGrades(grds);
        const map: Record<string, SavedQuizProgress> = {};
        (progs as SavedQuizProgress[]).forEach((p) => {
          map[p.quizId] = p;
        });
        setSavedMap(map);
        setMaterialFlags(Array.isArray(flags) ? flags.filter((f) => f.subjectId === subject.id) : []);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [subject.id, isStaff, currentUser?.id]);

  useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    let active = true;
    fetchAdminUsers()
      .then((users) => {
        if (!active) return;
        setAllStudents(users.filter((u) => u.role === 'student'));
      })
      .catch(() => {
        // Student directory unavailable; admin can still view the roster.
      });
    return () => {
      active = false;
    };
  }, [currentUser?.role]);

  const openAssignStudents = () => {
    setAssignMsg(null);
    setSelectedStudentIds(new Set(students.map((s) => s.id)));
    setShowAssignModal(true);
  };

  const toggleAssignStudent = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const saveAssignment = async () => {
    if (currentUser?.role !== 'admin') return;
    setAssigningStudents(true);
    setAssignMsg(null);
    const enrolled = new Set(students.map((s) => s.id));
    const toAdd = Array.from(selectedStudentIds).filter((id) => !enrolled.has(id));
    const toRemove = Array.from(enrolled).filter((id) => !selectedStudentIds.has(id));
    try {
      if (toAdd.length > 0) await assignStudentsToSubject(subject.id, toAdd);
      if (toRemove.length > 0) await removeStudentsFromSubject(subject.id, toRemove);
      setStudents(await fetchSubjectStudents(subject.id));
      setShowAssignModal(false);
    } catch (err) {
      setAssignMsg((err as Error).message || 'Could not update the roster.');
    } finally {
      setAssigningStudents(false);
    }
  };

  const subjectAnnouncements = announcements.filter((a) => a.subjectId === subject.id);

  const openFile = async (m: Material) => {
    const url = resolveMaterialFileUrl(m.fileUrl);
    if (!url) {
      showToast('This material has no attached file.', 'error');
      return;
    }
    if (Platform.OS === 'web') {
      Linking.openURL(url).catch(() => showToast('Could not open the file.', 'error'));
      return;
    }
    if (isRenderable(m)) {
      Linking.openURL(url).catch(() => showToast('Could not open the file.', 'error'));
      return;
    }
    try {
      setBusyId(m.id);
      const file = await File.downloadFileAsync(url, new Directory(Paths.cache));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: mimeFor(m), dialogTitle: m.title });
      } else {
        showToast(`File saved to device: ${safeFileName(m)}.${fileExt(m)}`, 'success');
      }
} catch {
      showToast('Could not download the file. Check the server connection.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDownloadTxt = async (m: Material) => {
    const text = `================================================\n${m.title}\n================================================\n\n${m.extractedText || m.description || ''}`;
    try {
      if (Platform.OS === 'web') {
        showToast(`Downloading ${m.title}...`, 'info');
      } else {
        const name = `${m.title.replace(/[^\w\s]/g, '').slice(0, 40)}.txt`;
        const outcome = await saveTextFile(name, text, 'text/plain', m.title);
        if (outcome === 'saved') showToast(`Saved ${name} to the selected folder.`, 'success');
      }
    } catch {
      showToast('Could not export the file.', 'error');
    }
  };

  const handleDownloadPdf = async (m: Material) => {
    setPreviewBusy('pdf');
    try {
      if (Platform.OS === 'web') {
        showToast(`Generating ${m.title}.pdf...`, 'info');
        return;
      }
      const bytes = await convertToPdf({
        title: m.title,
        metaLine: `${m.subjectName || 'Unassigned'} · ${m.uploadedBy || ''}`.trim(),
        content: m.extractedText || m.description || m.title,
        items: [],
      });
      const name = `${m.title.replace(/[^\w\s]/g, '').slice(0, 40) || 'material'}.pdf`;
      const outcome = await saveBytesFile(name, bytes, 'application/pdf', m.title);
      if (outcome === 'saved') showToast(`Saved ${name} to the selected folder.`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not export the PDF.', 'error');
    } finally {
      setPreviewBusy(null);
    }
  };

  const openEditMaterial = (m: Material) => {
    setEditingMaterial(m);
    setEditTitle(m.title || '');
    setEditDescription(m.description || '');
    setEditText(m.extractedText || '');
  };

  const saveEditMaterial = async () => {
    if (!editingMaterial) return;
    setSavingEdit(true);
    try {
      const updated = await updateMaterial(editingMaterial.id, {
        title: editTitle,
        description: editDescription,
        textInput: editText,
      });
      setMaterials((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setEditingMaterial(null);
      showToast('Material updated successfully.');
    } catch (err) {
      showToast((err as Error).message || 'Could not update the material.', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

const confirmDeleteMaterial = (m: Material) => {
    Alert.alert('Delete Material', `Delete "${m.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMaterial(m.id);
            setMaterials((prev) => prev.filter((x) => x.id !== m.id));
          } catch (err) {
            showToast((err as Error).message || 'Could not delete the material.', 'error');
          }
        },
      },
    ]);
  };

  const pendingFlagFor = (m: Material) => materialFlags.find((f) => f.materialId === m.id && f.status === 'pending');

  const submitFlag = async () => {
    if (!flagTarget) return;
    setFlagBusy(true);
    try {
      await flagMaterial(flagTarget.id, { category: flagCategory, note: flagNote.trim() || undefined });
      showToast(`Flagged "${flagTarget.title}" for review. The teacher has been notified.`);
      setFlagTarget(null);
      setFlagNote('');
      setFlagCategory('Wrong file');
      const flags = await fetchMaterialFlags();
      setMaterialFlags(Array.isArray(flags) ? flags.filter((f) => f.subjectId === subject.id) : []);
    } catch (err) {
      showToast((err as Error).message || 'Could not flag the material.', 'error');
    } finally {
      setFlagBusy(false);
    }
  };

  const submitResolve = async () => {
    if (!resolveTarget) return;
    setResolvingFlag(true);
    try {
      await resolveMaterialFlag(resolveTarget.id, resolutionNote.trim() || undefined);
      showToast('Flag resolved.');
      setResolveTarget(null);
      setResolutionNote('');
      const flags = await fetchMaterialFlags();
      setMaterialFlags(Array.isArray(flags) ? flags.filter((f) => f.subjectId === subject.id) : []);
    } catch (err) {
      showToast((err as Error).message || 'Could not resolve the flag.', 'error');
    } finally {
      setResolvingFlag(false);
    }
  };

  const togglePublish = async (q: Quiz) => {
    try {
      const updated = await updateQuiz(q.id, { isPublished: !q.isPublished });
      setQuizzes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      showToast((err as Error).message || 'Could not update the quiz.', 'error');
    }
  };

  const openEditQuiz = (q: Quiz) => {
    setEditingQuiz(q);
    setEqTitle(q.title || '');
    setEqDescription(q.description || '');
    setEqDifficulty(q.difficulty || 'medium');
    setEqTimeLimit(q.timeLimitMinutes || 15);
    setEqPassPct(q.passPercentage || 70);
    setEqLimitAttempts((q.attemptsAllowed || 0) > 0);
    setEqAttempts(q.attemptsAllowed || 3);
    setEqRevealAnswers(q.revealAnswers !== false);
  };

  const saveEditQuiz = async () => {
    if (!editingQuiz) return;
    try {
      const updated = await updateQuiz(editingQuiz.id, {
        title: eqTitle,
        description: eqDescription,
        difficulty: eqDifficulty,
        timeLimitMinutes: eqTimeLimit,
        passPercentage: eqPassPct,
        attemptsAllowed: eqLimitAttempts ? eqAttempts : 0,
        revealAnswers: eqRevealAnswers,
      });
      setQuizzes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setEditingQuiz(null);
      showToast('Quiz updated successfully.');
    } catch (err) {
      showToast((err as Error).message || 'Could not update the quiz.', 'error');
    }
  };

  const confirmDeleteQuiz = (q: Quiz) => {
    Alert.alert('Delete Quiz', `Delete "${q.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteQuiz(q.id);
            setQuizzes((prev) => prev.filter((x) => x.id !== q.id));
          } catch (err) {
            showToast((err as Error).message || 'Could not delete the quiz.', 'error');
          }
        },
      },
    ]);
  };

  const postAnnouncement = async () => {
    if (!annTitle.trim() || !annContent.trim()) return;
    setPostingAnn(true);
    try {
      const created = await createAnnouncement({
        title: annTitle.trim(),
        content: annContent.trim(),
        authorName: `${currentUser?.name || 'Faculty'} (${subject.code})`,
        targetAudience: 'students',
        priority: annPriority,
        subjectId: subject.id,
        subjectName: `${subject.code} - ${subject.name}`,
      });
      addLocalAnnouncement(created);
      reloadAnnouncements();
      setAnnTitle('');
      setAnnContent('');
      setShowAnnounceModal(false);
      showToast('Announcement posted.');
    } catch (err) {
      showToast((err as Error).message || 'Could not post the announcement.', 'error');
    } finally {
      setPostingAnn(false);
    }
  };

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<any>; count?: number }[] = [
    { key: 'people', label: 'People', icon: Users, count: students.length + 1 },
    { key: 'materials', label: 'Materials', icon: FileText, count: materials.length },
    { key: 'quizzes', label: 'Quizzes', icon: GraduationCap, count: quizzes.length },
    { key: 'announcements', label: 'Announcements', icon: Bell, count: subjectAnnouncements.length },
    { key: 'grades', label: 'Grades', icon: BarChart2, count: isStaff ? grades?.students?.length : grades?.attemptCount },
  ];

  const renderAttemptGroups = (attempts: QuizAttempt[]) => (
    <View style={{ gap: 8 }}>
      {groupAttemptsByQuiz(attempts).map((grp) => (
        <View key={grp.entries[0].id} style={{ gap: 5 }}>
          <View style={[styles.rowCard, { borderColor: colors.border }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                  {grp.title}
                </Text>
                {grp.entries.length > 1 && (
                  <Badge text="Latest" color={colors.primary} bg={colors.indigoSoft} />
                )}
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                {new Date(grp.entries[0].completedAt).toLocaleDateString()}
              </Text>
            </View>
            <Text style={{ color: colors.foreground, fontSize: 11, fontFamily: 'monospace', fontWeight: '700' }}>
              {grp.entries[0].score}/{grp.entries[0].maxScore}
            </Text>
            <Badge
              text={`${grp.entries[0].percentage}%`}
              color={grp.entries[0].passed ? colors.success : colors.danger}
              bg={grp.entries[0].passed ? colors.successSoft : colors.dangerSoft}
            />
          </View>
          {grp.entries.slice(1).map((att) => (
            <View
              key={att.id}
              style={[styles.rowCard, { borderColor: colors.border, backgroundColor: colors.surfaceAlt, marginLeft: 14 }]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 10 }} numberOfLines={1}>
                  Previous attempt · {new Date(att.completedAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: 'monospace', fontWeight: '700' }}>
                {att.score}/{att.maxScore}
              </Text>
              <Text
                style={{
                  color: att.passed ? colors.success : colors.danger,
                  fontSize: 10,
                  fontWeight: '700',
                }}
              >
                {att.percentage}%
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );

  if (loading) return <LoadingView label="Loading subject workspace..." />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {/* Back */}
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <ArrowLeft size={16} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: '600' }}>Back to Subjects</Text>
      </TouchableOpacity>

      {/* Header card */}
      <View style={[styles.header, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <View style={styles.headerTop}>
          <Badge text={subject.code} mono color={colors.primary} />
          {subject.semester && <Badge text={subject.semester} color={colors.success} bg={colors.successSoft} />}
        </View>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{subject.name}</Text>
        {subject.description && (
          <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>{subject.description}</Text>
        )}
        <View style={styles.headerStats}>
          <View style={styles.headerStat}>
            <Users size={14} color={colors.primary} />
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>{subject.studentCount}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>students</Text>
          </View>
          <View style={styles.headerStat}>
            <FileText size={14} color={colors.primary} />
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>{materials.length}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>materials</Text>
          </View>
          {subject.course && (
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Program: {subject.course}</Text>
          )}
        </View>
        <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600', marginTop: 8 }}>
          Faculty: {subject.teacherName || 'Faculty'}
        </Text>
        {subject.teacherDepartment && (
          <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: 2 }}>
            Department: {subject.teacherDepartment}
          </Text>
        )}
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tabItem, active && { backgroundColor: colors.primary }]}
            >
              <Icon size={14} color={active ? '#fff' : colors.mutedForeground} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : colors.mutedForeground }}>
                {t.label}
              </Text>
              {(t.count || 0) > 0 && (
                <View style={[styles.tabCount, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : colors.surface }]}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: active ? '#fff' : colors.mutedForeground }}>
                    {t.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ===== People ===== */}
      {tab === 'people' && (
        <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.panelHeader}>
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>People in this Subject</Text>
            {currentUser?.role === 'admin' && (
              <TouchableOpacity
                onPress={openAssignStudents}
                style={[styles.chipBtn, { backgroundColor: colors.primary }]}
              >
                <UserCheck size={13} color="#fff" />
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>Assign Students</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: 12 }}>
            {students.length + 1} people
          </Text>

          <View style={[styles.teacherCard, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <ShieldCheck size={16} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '800' }} numberOfLines={1}>
                {subject.teacherName || 'Faculty'}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                {subject.teacherDepartment || 'College of Computer Studies'}
              </Text>
            </View>
            <Badge text="Teacher" color={colors.primary} bg={colors.primarySoft} />
          </View>

          <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 8 }}>
            Enrolled Students ({students.length})
          </Text>
          {students.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: 'center', paddingVertical: 16 }}>
              No students are enrolled in this subject yet.
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {students.map((s) => (
                <View key={s.id} style={[styles.studentRow, { borderColor: colors.border }]}>
                  <View style={[styles.avatar, { backgroundColor: colors.indigoSoft }]}>
                    <UserCheck size={15} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11 }} numberOfLines={1}>
                      Student ID: {s.studentId || s.email}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ===== Materials ===== */}
      {tab === 'materials' && (
<View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>
                {'Materials'}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: 8 }}>
                {materials.length} document(s)
              </Text>
            </View>
            {isStaff && materialFlags.length > 0 && (
              <TouchableOpacity
                onPress={() => setShowFlagsModal(true)}
                style={[styles.flagChip, { backgroundColor: colors.warningSoft }]}
              >
                <Flag size={14} color={colors.warning} />
                <Text style={{ color: colors.warning, fontSize: 11, fontWeight: '800' }}>
                  {materialFlags.filter((f) => f.status === 'pending').length} Pending
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {materials.length === 0 ? (
            <EmptyState
              icon={<FileText size={36} color={colors.mutedForeground} />}
              title="No materials yet"
              subtitle="Ask your teacher to publish lecture notes, or check back later."
            />
          ) : (
            <View style={{ gap: 10 }}>
{materials.slice(0, matVisible).map((m) => (
                <View key={m.id} style={[styles.rowCard, { borderColor: colors.border }]}>
                  <TouchableOpacity
                    onPress={() => setPreviewMaterial(m)}
                    activeOpacity={0.7}
                    style={{ flexDirection: 'row', flex: 1, alignItems: 'flex-start', gap: 10 }}
                  >
                    <View style={[styles.fileIconTile, { backgroundColor: colors.primarySoft || colors.indigoSoft }]}>
                      <FileText size={18} color={colors.primary} />
                    </View>
                    <View style={styles.rowMain}>
                      <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '800' }} numberOfLines={1}>
                        {m.title}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                        {(fileExt(m).toUpperCase() || 'TEXT') + (m.fileSize ? ` • ${m.fileSize}` : '')}
                      </Text>
                      {m.description && (
                        <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 17 }} numberOfLines={2}>
                          {m.description}
                        </Text>
                      )}
                      <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                        {new Date(m.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.rowActions}>
                    {resolveMaterialFileUrl(m.fileUrl) && (
                      <TouchableOpacity
                        onPress={() => openFile(m)}
                        disabled={busyId === m.id}
                        style={[styles.iconBtn, { backgroundColor: colors.indigoSoft }]}
                      >
                        {busyId === m.id ? (
                          <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800' }}>...</Text>
                        ) : isRenderable(m) ? (
                          <Eye size={15} color={colors.primary} />
) : (
                          <Download size={15} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    )}
{currentUser?.role === 'admin' && (
                      <TouchableOpacity
                        onPress={() => {
                          setFlagTarget(m);
                          setFlagCategory('Wrong file');
                          setFlagNote('');
                        }}
                        disabled={!!pendingFlagFor(m)}
                        style={[styles.iconBtn, { backgroundColor: pendingFlagFor(m) ? colors.successSoft : colors.dangerSoft, opacity: pendingFlagFor(m) ? 0.7 : 1 }]}
                      >
                        <Flag size={15} color={pendingFlagFor(m) ? colors.success : colors.danger} />
                      </TouchableOpacity>
                    )}
{canManage && (
                      <>
                        <TouchableOpacity
                          onPress={() => openEditMaterial(m)}
                          style={[styles.iconBtn, { backgroundColor: colors.warningSoft }]}
                        >
                          <Pencil size={15} color={colors.warning} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => confirmDeleteMaterial(m)}
                          style={[styles.iconBtn, { backgroundColor: colors.dangerSoft }]}
                        >
                          <Trash2 size={15} color={colors.danger} />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
          {matVisible < materials.length && (
            <TouchableOpacity onPress={() => setMatVisible((c) => c + 15)} style={{ paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>Load More ({materials.length - matVisible} remaining)</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ===== Quizzes ===== */}
      {tab === 'quizzes' && (
        <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.foreground }]}>
            {'Quizzes'}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: 12 }}>
            {quizzes.length} quiz(zes)
          </Text>
          {quizzes.length === 0 ? (
            <EmptyState
              icon={<GraduationCap size={36} color={colors.mutedForeground} />}
              title="No quizzes yet"
              subtitle={isStaff ? 'Create quizzes from the Assessments page.' : 'No quizzes published for this subject yet.'}
            />
          ) : (
            <View style={{ gap: 10 }}>
              {quizzes.slice(0, quizVisible).map((q) => {
                const saved = savedMap[q.id];
                const exhausted = attemptsExhausted(q);
                return (
                  <View key={q.id} style={[styles.rowCard, { borderColor: colors.border, ...(saved ? { borderColor: colors.warning, borderWidth: 1.2 } : {}) }]}>
                    <View style={styles.rowMain}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '800', flex: 1 }} numberOfLines={1}>
                          {q.title}
                        </Text>
                        {(q.attemptsUsed ?? 0) > 0 && (
                          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800' }}>
                            {q.lastScoreRaw ?? 0}/{q.lastMaxScore ?? 0}
                          </Text>
                        )}
                      </View>
                      <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                        {q.questions?.length || 0} questions · {q.difficulty} ·{' '}
                        {q.timeLimitMinutes ? `${q.timeLimitMinutes} min` : 'No time limit'} · Pass {q.passPercentage}%
                        {(q.attemptsUsed ?? 0) > 0 && q.attemptsAllowed
                          ? ` · ${Math.max(0, (q.attemptsAllowed || 0) - (q.attemptsUsed ?? 0))} left`
                          : ''}
                      </Text>
                    </View>
                    <View style={styles.rowActions}>
                      {canManage ? (
                        <>
                          <TouchableOpacity
                            onPress={() => togglePublish(q)}
                            style={[
                              styles.chipBtn,
                              q.isPublished
                                ? { backgroundColor: colors.successSoft }
                                : { backgroundColor: colors.warningSoft },
                            ]}
                          >
                            {q.isPublished ? (
                              <CheckCircle2 size={13} color={colors.success} />
                            ) : (
                              <XCircle size={13} color={colors.warning} />
                            )}
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: '700',
                                color: q.isPublished ? colors.success : colors.warning,
                              }}
                            >
                              {q.isPublished ? 'Published' : 'Draft'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => openEditQuiz(q)}
                            style={[styles.iconBtn, { backgroundColor: colors.warningSoft }]}
                          >
                            <Pencil size={15} color={colors.warning} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => confirmDeleteQuiz(q)}
                            style={[styles.iconBtn, { backgroundColor: colors.dangerSoft }]}
                          >
                            <Trash2 size={15} color={colors.danger} />
                          </TouchableOpacity>
                        </>
                      ) : exhausted ? (
                        <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: '700' }}>Attempts Exhausted</Text>
                      ) : saved ? (
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity
                            onPress={() => onOpenQuiz(q)}
                            style={[styles.chipBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
                          >
                            <RotateCw size={13} color={colors.foreground} />
                            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.foreground }}>Restart</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => onOpenQuiz(q)}
                            style={[styles.chipBtn, { backgroundColor: colors.warning }]}
                          >
                            <Play size={13} color="#fff" />
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>Resume</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => onOpenQuiz(q)}
                          style={[styles.chipBtn, { backgroundColor: colors.primary }]}
                        >
                          <Play size={13} color="#fff" />
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>
                            {(q.attemptsUsed ?? 0) > 0 ? 'Retake Quiz' : 'Take Quiz'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          {quizVisible < quizzes.length && (
            <TouchableOpacity onPress={() => setQuizVisible((c) => c + 15)} style={{ paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>Load More ({quizzes.length - quizVisible} remaining)</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ===== Announcements ===== */}
      {tab === 'announcements' && (
        <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.panelHeader}>
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>Class Announcements</Text>
{canManage && (
              <TouchableOpacity
                onPress={() => setShowAnnounceModal(true)}
                style={[styles.chipBtn, { backgroundColor: colors.primary }]}
              >
                <Plus size={13} color="#fff" />
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>Post</Text>
              </TouchableOpacity>
            )}
          </View>
          {subjectAnnouncements.length === 0 ? (
            <EmptyState
              icon={<Bell size={36} color={colors.mutedForeground} />}
              title="No announcements"
              subtitle="No announcements posted for this subject yet."
            />
          ) : (
            <View style={{ gap: 10, marginTop: 12 }}>
              {subjectAnnouncements.slice(0, annVisible).map((a) => (
                <TouchableOpacity
                  key={a.id}
                  onPress={() => setSelectedAnn(a)}
                  activeOpacity={0.85}
                  style={[styles.annCard, { borderColor: colors.border }]}
                >
                  <View style={styles.annTop}>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '800', flex: 1 }} numberOfLines={1}>
                      {a.title}
                    </Text>
                    <Badge
                      text={a.priority}
                      color={a.priority === 'high' ? colors.danger : a.priority === 'low' ? colors.mutedForeground : colors.warning}
                      bg={a.priority === 'high' ? colors.dangerSoft : a.priority === 'low' ? colors.surfaceAlt : colors.warningSoft}
                    />
                  </View>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }} numberOfLines={3}>{a.content}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                      {a.authorName} · {new Date(a.createdAt).toLocaleString()}
                    </Text>
                    <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800' }}>View</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {annVisible < subjectAnnouncements.length && (
            <TouchableOpacity onPress={() => setAnnVisible((c) => c + 15)} style={{ paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>Load More ({subjectAnnouncements.length - annVisible} remaining)</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ===== Grades ===== */}
      {tab === 'grades' && (
        <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.panelHeader}>
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>Quiz Grades & Final Grade</Text>
          </View>
          <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: 12 }}>
            Average of all quiz scores in this subject
          </Text>

          {isStaff ? (
            grades?.students && grades.students.length === 0 ? (
              <EmptyState
                icon={<BarChart2 size={36} color={colors.mutedForeground} />}
                title="No grades yet"
                subtitle="No quiz attempts recorded for this subject yet."
              />
            ) : (
              <View style={{ gap: 12 }}>
                {(grades?.students || []).map((st) => (
                  <View key={st.studentId} style={[styles.rowCard, { borderColor: colors.border, flexDirection: 'column', alignItems: 'stretch' }]}>
                    <View style={styles.rowMain}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '800', flex: 1 }} numberOfLines={1}>
                          {st.studentName}
                        </Text>
                        <Badge
                          text={`Final Grade: ${st.averagePercentage}%`}
                          color={st.averagePercentage >= 75 ? colors.success : st.averagePercentage >= 60 ? colors.warning : colors.danger}
                          bg={st.averagePercentage >= 75 ? colors.successSoft : st.averagePercentage >= 60 ? colors.warningSoft : colors.dangerSoft}
                        />
                      </View>
<Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{st.attemptCount} attempt(s)</Text>
                    </View>
                    {st.attempts.length > 0 && (
                      <View style={{ marginTop: 4 }}>{renderAttemptGroups(st.attempts)}</View>
                    )}
                  </View>
                ))}
              </View>
            )
          ) : grades && (grades.attempts || []).length === 0 ? (
            <EmptyState
              icon={<BarChart2 size={36} color={colors.mutedForeground} />}
              title="No grades yet"
              subtitle="You haven't taken any quizzes in this subject yet. Take a quiz to see your grade."
            />
          ) : (
            <View style={{ gap: 12 }}>
              <View style={[styles.gradeCard, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Final Grade
                  </Text>
                  <Text style={{ color: colors.primary, fontSize: 32, fontWeight: '900', letterSpacing: -1 }}>
                    {grades?.averagePercentage || 0}%
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                    {grades?.attemptCount || 0} quiz attempt(s)
                  </Text>
                </View>
                <BarChart2 size={34} color={colors.primary} />
              </View>

<View style={{ gap: 8 }}>
                {renderAttemptGroups(grades?.attempts || [])}
              </View>
            </View>
          )}
        </View>
      )}

      {/* ===== Preview Material Modal ===== */}
      <Modal
        visible={!!previewMaterial}
        onClose={() => setPreviewMaterial(null)}
        title={previewMaterial?.title}
        subtitle={`${previewMaterial?.fileType?.toUpperCase() || 'DOC'} Document - ${previewMaterial?.subjectName || 'Unassigned'}`}
      >
        <ScrollView style={{ maxHeight: 380 }}>
          <View style={[styles.previewPaper, { backgroundColor: colors.surfaceAlt }]}>
            <View style={{ gap: 6, marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Badge text={previewMaterial?.subjectName || 'Unassigned'} color={colors.primary} />
                <Badge text={previewMaterial?.fileType?.toUpperCase() || 'DOC'} color={colors.warning} />
              </View>
              <Text style={[styles.previewTitle, { color: colors.foreground }]}>{previewMaterial?.title}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                {previewMaterial ? new Date(previewMaterial.createdAt).toLocaleString() : ''} · {previewMaterial?.uploadedBy}
                {previewMaterial?.fileSize ? ` · ${previewMaterial.fileSize}` : ''}
              </Text>
            </View>
            {previewMaterial && materialViewerExt(previewMaterial) ? (
              <MaterialFileViewer material={previewMaterial} height={320} />
            ) : (
              <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 21 }}>
                {previewMaterial?.extractedText || previewMaterial?.description || previewMaterial?.title}
              </Text>
            )}
          </View>
        </ScrollView>
        <View style={{ gap: 10, marginTop: 14 }}>
          {previewMaterial && resolveMaterialFileUrl(previewMaterial.fileUrl) && (
            <OutlineButton
              label={previewBusy === 'file' ? 'Opening...' : 'Open / View File'}
              onPress={() => {
                setPreviewBusy('file');
                const m = previewMaterial;
                if (m) openFile(m).finally(() => setPreviewBusy(null));
              }}
            />
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <OutlineButton
              label={previewBusy === 'pdf' ? 'Generating...' : 'Download PDF'}
              onPress={() => previewMaterial && handleDownloadPdf(previewMaterial)}
              style={{ flex: 1 }}
            />
            <OutlineButton
              label="Download TXT"
              onPress={() => previewMaterial && handleDownloadTxt(previewMaterial)}
              style={{ flex: 1 }}
            />
          </View>
          <PrimaryButton label="Close" onPress={() => setPreviewMaterial(null)} />
        </View>
      </Modal>

      {/* ===== Edit Material Modal ===== */}
      <Modal
        visible={!!editingMaterial}
        onClose={() => setEditingMaterial(null)}
        title="Edit Material"
        subtitle={editingMaterial?.title}
      >
        <View style={{ gap: 12 }}>
          <Field label="Title" value={editTitle} onChangeText={setEditTitle} placeholder="e.g. Module 4: Lecture Notes" />
          <Field label="Description" value={editDescription} onChangeText={setEditDescription} placeholder="Brief summary" multiline />
          <Field label="Text content" value={editText} onChangeText={setEditText} placeholder="Paste or edit the text content used for study..." multiline />
          <View style={styles.modalActions}>
            <OutlineButton label="Cancel" onPress={() => setEditingMaterial(null)} style={styles.flexBtn} />
            <PrimaryButton label={savingEdit ? 'Saving...' : 'Save Changes'} onPress={saveEditMaterial} loading={savingEdit} style={styles.flexBtn} />
          </View>
        </View>
      </Modal>

      {/* ===== Edit Quiz Modal ===== */}
      <Modal
        visible={!!editingQuiz}
        onClose={() => setEditingQuiz(null)}
        title="Edit Quiz"
        subtitle={editingQuiz?.title}
      >
        <View style={{ gap: 12 }}>
          <Field label="Title" value={eqTitle} onChangeText={setEqTitle} placeholder="Quiz title" />
          <Field label="Description" value={eqDescription} onChangeText={setEqDescription} placeholder="Short description" multiline />
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Difficulty</Text>
            <View style={styles.chipRow}>
              {(['easy', 'medium', 'hard'] as const).map((d) => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setEqDifficulty(d)}
                  style={[
                    styles.filterChip,
                    eqDifficulty === d ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'capitalize', color: eqDifficulty === d ? '#fff' : colors.foreground }}>
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Time limit (minutes)</Text>
            <View style={styles.chipRow}>
              {[10, 15, 20, 30, 45, 60].map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setEqTimeLimit(t)}
                  style={[
                    styles.filterChip,
                    eqTimeLimit === t ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: eqTimeLimit === t ? '#fff' : colors.foreground }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Pass percentage: {eqPassPct}%</Text>
            <View style={styles.chipRow}>
              {[50, 60, 70, 75, 80].map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setEqPassPct(p)}
                  style={[
                    styles.filterChip,
                    eqPassPct === p ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: eqPassPct === p ? '#fff' : colors.foreground }}>{p}%</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Limit attempts per student</Text>
            <View style={styles.chipRow}>
              {[false, true].map((on) => (
                <TouchableOpacity
                  key={String(on)}
                  onPress={() => setEqLimitAttempts(on)}
                  style={[
                    styles.filterChip,
                    eqLimitAttempts === on ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: eqLimitAttempts === on ? '#fff' : colors.foreground }}>
                    {on ? 'On' : 'Off (Unlimited)'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {eqLimitAttempts && (
              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Max attempts</Text>
                <TextInput
                  value={String(eqAttempts)}
                  onChangeText={(t) => setEqAttempts(Math.max(1, Math.min(99, Number(t) || 1)))}
                  keyboardType="number-pad"
                  style={{
                    backgroundColor: colors.surfaceAlt,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: colors.foreground,
                    fontSize: 13,
                    fontWeight: '700',
                  }}
                />
              </View>
            )}
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Show correct answers to students</Text>
            <View style={styles.chipRow}>
              {[true, false].map((on) => (
                <TouchableOpacity
                  key={String(on)}
                  onPress={() => setEqRevealAnswers(on)}
                  style={[
                    styles.filterChip,
                    eqRevealAnswers === on ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: eqRevealAnswers === on ? '#fff' : colors.foreground }}>
                    {on ? 'Yes' : 'No'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.modalActions}>
            <OutlineButton label="Cancel" onPress={() => setEditingQuiz(null)} style={styles.flexBtn} />
            <PrimaryButton label="Save Changes" onPress={saveEditQuiz} style={styles.flexBtn} />
          </View>
        </View>
      </Modal>

      {/* ===== Post Announcement Modal ===== */}
      <Modal visible={showAnnounceModal} onClose={() => setShowAnnounceModal(false)} title="Post Announcement" subtitle={`${subject.code} - ${subject.name}`}>
        <View style={{ gap: 12 }}>
          <Field label="Title" value={annTitle} onChangeText={setAnnTitle} placeholder="e.g. Midterm review schedule" />
          <Field label="Message" value={annContent} onChangeText={setAnnContent} placeholder="Write your announcement..." multiline />
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Priority</Text>
            <View style={styles.chipRow}>
              {(['low', 'medium', 'high'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setAnnPriority(p)}
                  style={[
                    styles.filterChip,
                    annPriority === p ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'capitalize', color: annPriority === p ? '#fff' : colors.foreground }}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.modalActions}>
            <OutlineButton label="Cancel" onPress={() => setShowAnnounceModal(false)} style={styles.flexBtn} />
            <PrimaryButton label={postingAnn ? 'Posting...' : 'Post Announcement'} onPress={postAnnouncement} loading={postingAnn} style={styles.flexBtn} />
          </View>
        </View>
      </Modal>

      {/* ===== Assign Students Modal (admin only) ===== */}
      <Modal visible={showAssignModal} onClose={() => setShowAssignModal(false)} title="Assign Students" subtitle={`${subject.code} - ${subject.name}`}>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: '600' }}>
              {selectedStudentIds.size} selected of {allStudents.length} students
            </Text>
            <TouchableOpacity
              onPress={() =>
                setSelectedStudentIds(
                  selectedStudentIds.size === allStudents.length
                    ? new Set()
                    : new Set(allStudents.map((s) => s.id))
                )
              }
            >
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800' }}>
                {selectedStudentIds.size === allStudents.length ? 'Clear all' : 'Select all'}
              </Text>
            </TouchableOpacity>
          </View>

          {allStudents.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: 'center', paddingVertical: 14 }}>
              No student accounts found. Create student accounts from the admin dashboard.
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 8 }}>
              {allStudents.map((s) => {
                const checked = selectedStudentIds.has(s.id);
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => toggleAssignStudent(s.id)}
                    style={[
                      styles.assignRow,
                      { borderColor: checked ? colors.primary : colors.border, backgroundColor: checked ? colors.primarySoft : colors.surfaceAlt },
                    ]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                        {s.name}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 10 }} numberOfLines={1}>
                        {s.email}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: 'monospace' }}>
                        {s.studentId || '-'}
                      </Text>
                      <View
                        style={[
                          styles.checkbox,
                          checked && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                      >
                        {checked && <CheckCircle2 size={12} color="#fff" />}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {assignMsg && <Text style={{ color: colors.danger, fontSize: 11, fontWeight: '600' }}>{assignMsg}</Text>}

          <View style={styles.modalActions}>
            <OutlineButton label="Cancel" onPress={() => setShowAssignModal(false)} style={styles.flexBtn} />
            <PrimaryButton label={assigningStudents ? 'Saving...' : 'Save Enrollment'} onPress={saveAssignment} loading={assigningStudents} style={styles.flexBtn} />
          </View>
        </View>
</Modal>

      <Modal
        visible={!!selectedAnn}
        onClose={() => setSelectedAnn(null)}
        title="Announcement"
      >
        {selectedAnn && (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: '900', flex: 1 }}>
                {selectedAnn.title}
              </Text>
              <Badge
                text={selectedAnn.priority}
                color={selectedAnn.priority === 'high' ? colors.danger : selectedAnn.priority === 'low' ? colors.mutedForeground : colors.warning}
                bg={selectedAnn.priority === 'high' ? colors.dangerSoft : selectedAnn.priority === 'low' ? colors.surfaceAlt : colors.warningSoft}
              />
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
              {selectedAnn.authorName} · {new Date(selectedAnn.createdAt).toLocaleString()}
            </Text>
            <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 20 }}>
              {selectedAnn.content}
            </Text>
            {selectedAnn.subjectName ? (
              <Badge text={selectedAnn.subjectName} color={colors.primary} bg={colors.surfaceAlt} />
            ) : null}
            <OutlineButton label="Close" onPress={() => setSelectedAnn(null)} />
          </View>
        )}
      </Modal>

      {/* Flag a material (admin only) */}
      <Modal
        visible={!!flagTarget}
        onClose={() => setFlagTarget(null)}
        title="Flag Material for Review"
        subtitle={flagTarget ? flagTarget.title : ''}
      >
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
            Flagging asks the assigning teacher to review this material for correctness.
          </Text>
          <View>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>Category</Text>
            <View style={styles.chipRow}>
              {(['Wrong file', 'Wrong subject', 'Incomplete content', 'Other'] as MaterialFlagCategory[]).map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setFlagCategory(c)}
                  style={[styles.filterChip, { backgroundColor: flagCategory === c ? colors.primary : colors.surfaceAlt }]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: flagCategory === c ? '#fff' : colors.foreground }}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Field label="Note (optional)" value={flagNote} onChangeText={setFlagNote} placeholder="What should be reviewed?" multiline />
          <View style={styles.modalActions}>
            <OutlineButton label="Cancel" onPress={() => setFlagTarget(null)} style={styles.flexBtn} />
            <PrimaryButton label="Submit Flag" onPress={submitFlag} loading={flagBusy} style={styles.flexBtn} />
          </View>
        </View>
      </Modal>

      {/* Resolve a flag (assigned teacher / admin) */}
      <Modal
        visible={!!resolveTarget}
        onClose={() => setResolveTarget(null)}
        title="Resolve Flag"
        subtitle={resolveTarget ? resolveTarget.materialTitle : ''}
      >
        {resolveTarget && (
          <View style={{ gap: 12 }}>
            <View style={styles.rowBadges}>
              <Badge text={resolveTarget.category} color={colors.warning} bg={colors.warningSoft} />
              <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                Flagged by {resolveTarget.flaggedByName} · {new Date(resolveTarget.createdAt).toLocaleDateString()}
              </Text>
            </View>
            {resolveTarget.note ? <Text style={{ color: colors.foreground, fontSize: 12, lineHeight: 18 }}>{resolveTarget.note}</Text> : null}
            <Field label="Resolution note (optional)" value={resolutionNote} onChangeText={setResolutionNote} placeholder="e.g. File was corrected." multiline />
            <View style={styles.modalActions}>
              <OutlineButton label="Cancel" onPress={() => setResolveTarget(null)} style={styles.flexBtn} />
              <PrimaryButton label="Mark Resolved" onPress={submitResolve} loading={resolvingFlag} style={styles.flexBtn} />
            </View>
          </View>
        )}
      </Modal>

      {/* Flags history (staff) */}
      <Modal visible={showFlagsModal} onClose={() => setShowFlagsModal(false)} title="Material Flags" subtitle={`${materialFlags.filter((f) => f.status === 'pending').length} pending for this subject`}>
        {materialFlags.length === 0 ? (
          <EmptyState icon={<Flag size={30} color={colors.mutedForeground} />} title="No flags" subtitle="No materials have been flagged for this subject." />
        ) : (
          <ScrollView style={{ maxHeight: 380 }}>
            <View style={{ gap: 10 }}>
              {materialFlags.map((f) => (
                <View key={f.id} style={[styles.rowCard, { borderColor: f.status === 'pending' ? colors.warning : colors.border, alignItems: 'flex-start' }]}>
                  <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                    <View style={styles.rowBadges}>
                      <Badge
                        text={f.status === 'pending' ? 'Pending' : 'Resolved'}
                        color={f.status === 'pending' ? colors.warning : colors.success}
                        bg={f.status === 'pending' ? colors.warningSoft : colors.successSoft}
                      />
                      <Badge text={f.category} color={colors.primary} bg={colors.indigoSoft} />
                    </View>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{f.materialTitle}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                      {f.flaggedByName} · {new Date(f.createdAt).toLocaleDateString()}
                    </Text>
                    {f.note ? <Text style={{ color: colors.mutedForeground, fontSize: 11, lineHeight: 16 }} numberOfLines={3}>{f.note}</Text> : null}
                    {f.status === 'resolved' && (
                      <Text style={{ color: colors.success, fontSize: 11 }}>
                        Resolved by {f.resolvedByName}
                        {f.resolutionNote ? ` — ${f.resolutionNote}` : ''}
                      </Text>
                    )}
                  </View>
                  {f.status === 'pending' && (canManage || currentUser?.role === 'admin') && (
                    <TouchableOpacity
                      onPress={() => {
                        setResolveTarget(f);
                        setResolutionNote('');
                        setShowFlagsModal(false);
                      }}
                      style={[styles.iconBtn, { backgroundColor: colors.successSoft }]}
                    >
                      <CheckCircle2 size={16} color={colors.success} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
        <View style={styles.modalActions}>
          <PrimaryButton label="Close" onPress={() => setShowFlagsModal(false)} style={styles.flexBtn} />
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  header: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  headerStats: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 2 },
  headerStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tabBar: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 4, gap: 4, overflow: 'hidden' },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10 },
  tabCount: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  panel: { borderRadius: 16, borderWidth: 1, padding: 16 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panelTitle: { fontSize: 16, fontWeight: '800' },
  teacherCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  studentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 10 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12 },
  rowMain: { flex: 1, gap: 4, minWidth: 0 },
  rowBadges: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fileIconTile: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  previewPaper: { borderRadius: 12, padding: 14 },
  previewTitle: { fontSize: 16, fontWeight: '800' },
iconBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  flagChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99 },
  chipBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  annCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
  annTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  flexBtn: { flex: 1 },
  gradeCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, borderWidth: 1, padding: 14 },
  assignRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

