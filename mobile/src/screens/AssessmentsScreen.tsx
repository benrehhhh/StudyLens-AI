import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Sparkles,
  GraduationCap,
  CheckCircle2,
  XCircle,
  Play,
  ChevronDown,
  RotateCw,
  Trash2,
  Pencil,
  Download,
} from 'lucide-react-native';
import { fetchQuizzes, fetchSubjects, submitQuizAttempt, updateQuiz, deleteQuiz, createQuiz, fetchQuizHint, downloadQuizPdf, Quiz, QuizQuestion, Subject, DifficultyLevel, QuizAttempt } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Card,
  Badge,
  Modal,
  PrimaryButton,
  OutlineButton,
  LoadingView,
  EmptyState,
  ProgressBar,
  SectionHeader,
  Field,
} from '../components/ui';
import {
  getQuizProgresses,
  saveQuizProgress,
  removeQuizProgress,
  addAttempt,
  SavedQuizProgress,
  LocalAttempt,
} from '../utils/storage';
import { saveBytesFile } from '../utils/fileExport';

type AnswerValue = number | string | number[] | null;

interface ResultFeedback {
  index: number;
  question: string;
  type: string;
  yourAnswer: string;
  correctAnswer: string;
  correct: boolean;
  explanation?: string;
  topicTag?: string;
}

interface FinishedResult {
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  autoSubmitted: boolean;
  feedback: ResultFeedback[];
}

export default function AssessmentsScreen({
  onNavigate,
  autoOpenQuizId,
  onAutoOpenHandled,
  hasReturnOrigin,
  onReturnToOrigin,
}: {
  onNavigate: (tab: string) => void;
  autoOpenQuizId?: string | null;
  onAutoOpenHandled?: () => void;
  hasReturnOrigin?: boolean;
  onReturnToOrigin?: () => void;
}) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const userId = currentUser?.id || '';

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumable, setResumable] = useState<SavedQuizProgress | null>(null);
  const [savedMap, setSavedMap] = useState<Record<string, SavedQuizProgress>>({});
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const [assignQuiz, setAssignQuiz] = useState<Quiz | null>(null);
  const [assignSubjectId, setAssignSubjectId] = useState('');
  const [assigningSubject, setAssigningSubject] = useState(false);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);

  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
  const [highlightQuizId, setHighlightQuizId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const cardY = useRef<Record<string, number>>({});

  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const answersRef = useRef<Record<number, AnswerValue>>({});
  const [textInput, setTextInput] = useState<Record<number, string>>({});
  const [hintsByQuestion, setHintsByQuestion] = useState<Record<string, string>>({});
  const [hintErrorsByQuestion, setHintErrorsByQuestion] = useState<Record<string, string>>({});
  const [hintLoadingFor, setHintLoadingFor] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [autoFinishPending, setAutoFinishPending] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [result, setResult] = useState<FinishedResult | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);

  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [eqTitle, setEqTitle] = useState('');
  const [eqDescription, setEqDescription] = useState('');
  const [eqDifficulty, setEqDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [eqTimeLimit, setEqTimeLimit] = useState(15);
  const [eqPassPct, setEqPassPct] = useState(70);
  const [eqLimitAttempts, setEqLimitAttempts] = useState(false);
  const [eqAttempts, setEqAttempts] = useState(3);
  const [eqRevealAnswers, setEqRevealAnswers] = useState(true);
  const [eqDeadline, setEqDeadline] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const isStaff = currentUser?.role === 'teacher';

  // Download is allowed only for quizzes the requester personally created:
  // teachers for any quiz they authored, students for the practice quizzes they
  // generated themselves (never a teacher-assigned course quiz).
  const canDownloadQuizFor = (q: Quiz): boolean => {
    if (currentUser?.role === 'teacher') return q.createdById === currentUser.id;
    if (currentUser?.role === 'student') return q.quizType === 'student' && q.createdById === currentUser.id;
    return false;
  };

  const downloadQuiz = async (q: Quiz) => {
    try {
      const bytes = await downloadQuizPdf(q.id);
      const name = `${(q.title || 'quiz').replace(/[^\w\s-]/g, '').trim().slice(0, 40) || 'quiz'}.pdf`;
      const outcome = await saveBytesFile(name, bytes, 'application/pdf', q.title);
      if (outcome === 'saved') showToast(`Saved ${name} to the selected folder.`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not download the quiz.', 'error');
    }
  };

  const [showCreate, setShowCreate] = useState(false);
  const [cqType, setCqType] = useState<'teacher' | 'student'>(isStaff ? 'teacher' : 'student');
  const [cqTitle, setCqTitle] = useState('');
  const [cqSubjectId, setCqSubjectId] = useState('');
  const [cqTime, setCqTime] = useState(15);
  const [cqTopic, setCqTopic] = useState('');
  const [cqDifficulty, setCqDifficulty] = useState<DifficultyLevel>('medium');
  const [cqLimitAttempts, setCqLimitAttempts] = useState(false);
  const [cqAttempts, setCqAttempts] = useState(3);
  const [cqReveal, setCqReveal] = useState(true);
  const [cqDeadline, setCqDeadline] = useState('');
  const [cqQuestions, setCqQuestions] = useState<QuizQuestion[]>([]);
  const [savingCreate, setSavingCreate] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  const [dq, setDq] = useState<DraftQuestion | null>(null);
  const [dqError, setDqError] = useState<string | null>(null);

  const loadQuizzes = useCallback(() => {
    setLoading(true);
    Promise.all([fetchQuizzes(currentUser?.role, currentUser?.id), fetchSubjects(), getQuizProgresses(userId)]).then(([q, s, progs]) => {
      const now = Date.now();
      let first: SavedQuizProgress | null = null;
      const map: Record<string, SavedQuizProgress> = {};
      for (const p of progs) {
        const quiz = q.find((x) => x.id === p.quizId);
        const expired = now - new Date(p.lastUpdated || now).getTime() > 7 * 24 * 3600 * 1000;
        const exhausted =
          !!quiz && quiz.quizType !== 'student' && (quiz.attemptsAllowed || 0) > 0 && (quiz.attemptsUsed || 0) >= (quiz.attemptsAllowed || 0);
        const usable = !!quiz && quiz.isPublished !== false && !expired && !exhausted;
        if (usable) {
          map[p.quizId] = p;
          if (!first) first = p;
        } else {
          removeQuizProgress(userId, p.quizId);
        }
      }
      setQuizzes(q);
      setSubjects(s);
      setResumable(first);
      setSavedMap(map);
      setLoading(false);
    });
  }, [userId]);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  // Keep a ref in sync with `answers` so timer-triggered completion and any
  // async paths always read the latest answers instead of a stale closure.
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const openAssignSubject = (q: Quiz) => {
    setAssignQuiz(q);
    setAssignSubjectId(q.subjectId && q.subjectId !== '' && q.subjectId !== 'personal' ? q.subjectId : '');
    setAssignMsg(null);
  };

  const handleAssignSubject = async () => {
    if (!assignQuiz || !assignSubjectId) {
      setAssignMsg('Please select an assigned subject.');
      return;
    }
    setAssigningSubject(true);
    setAssignMsg(null);
    try {
      const sub = subjects.find((s) => s.id === assignSubjectId);
      const updated = await updateQuiz(assignQuiz.id, {
        subjectId: assignSubjectId,
        subjectName: sub ? `${sub.code} - ${sub.name}` : assignQuiz.subjectName,
      });
      setQuizzes((prev) => prev.map((q) => (q.id === assignQuiz.id ? updated : q)));
      setAssignQuiz(null);
      showToast('Quiz updated.');
    } catch (err) {
      setAssignMsg((err as Error).message || 'Could not assign the subject. Please try again.');
    } finally {
      setAssigningSubject(false);
    }
  };

  const togglePublish = async (q: Quiz) => {
    const publish = !q.isPublished;
    if (publish && !q.subjectId) {
      openAssignSubject(q);
      setAssignMsg('Assign this quiz to a subject before publishing it.');
      return;
    }
    setPublishingId(q.id);
    try {
      const updated = await updateQuiz(q.id, { isPublished: publish });
      setQuizzes((prev) => prev.map((x) => (x.id === q.id ? updated : x)));
      showToast(publish ? 'Quiz published.' : 'Quiz unpublished.');
    } catch (err) {
      showToast((err as Error).message || 'Could not update the quiz publish status.', 'error');
    } finally {
      setPublishingId(null);
    }
  };

  const openEditQuiz = (q: Quiz) => {
    setEditingQuiz(q);
    setEqTitle(q.title || '');
    setEqDescription(q.description || '');
    setEqDifficulty((q.difficulty as 'easy' | 'medium' | 'hard') || 'medium');
    setEqTimeLimit(q.timeLimitMinutes || 15);
    setEqPassPct(q.passPercentage || 70);
    setEqLimitAttempts((q.attemptsAllowed || 0) > 0);
    setEqAttempts(q.attemptsAllowed || 3);
    setEqRevealAnswers(q.revealAnswers !== false);
    setEqDeadline(toDateInputValue(q.deadline));
  };

  const saveEditQuiz = async () => {
    if (!editingQuiz) return;
    setSavingEdit(true);
    try {
      const updated = await updateQuiz(editingQuiz.id, {
        title: eqTitle,
        description: eqDescription,
        difficulty: eqDifficulty,
        timeLimitMinutes: eqTimeLimit,
        passPercentage: eqPassPct,
        attemptsAllowed: eqLimitAttempts ? eqAttempts : 0,
        revealAnswers: eqRevealAnswers,
        deadline: toDeadlineISO(eqDeadline) ?? null,
      });
      setQuizzes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setEditingQuiz(null);
      showToast('Quiz updated successfully.');
    } catch (err) {
      showToast((err as Error).message || 'Could not update the quiz.', 'error');
    } finally {
      setSavingEdit(false);
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
            showToast('Quiz deleted.');
          } catch (err) {
            showToast((err as Error).message || 'Could not delete the quiz.', 'error');
          }
        },
      },
    ]);
  };

  const openCreateQuiz = () => {
    setCqType(isStaff ? 'teacher' : 'student');
    setCqTitle('');
    setCqSubjectId(isStaff && subjects.length > 0 ? subjects[0].id : '');
    setCqTime(15);
    setCqTopic('');
    setCqDifficulty('medium');
    setCqLimitAttempts(false);
    setCqAttempts(3);
    setCqReveal(true);
    setCqDeadline('');
    setCqQuestions([]);
    setCreateMsg(null);
    setShowCreate(true);
  };

  const saveQuestionDraft = () => {
    if (!dq) return;
    const error = validateDraftQuestion(dq);
    if (error) {
      setDqError(error);
      return;
    }
    if (dq.type === 'identification') {
      const q: QuizQuestion = {
        id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        question: dq.question.trim(),
        type: 'identification',
        options: [],
        correctAnswer: dq.identAnswer.trim(),
        difficulty: cqDifficulty,
        topicTag: cqTopic.trim() || undefined,
        bloomsLevel: dq.bloomsLevel || undefined,
        explanation: dq.explanation.trim() || undefined,
      };
      setCqQuestions((prev) => {
        if (dq.index !== undefined && dq.index >= 0 && dq.index < prev.length) {
          const next = [...prev];
          next[dq.index] = q;
          return next;
        }
        return [...prev, q];
      });
      setDq(null);
      setDqError(null);
      return;
    }
    const options = dq.options.map((o) => o.trim());
    const q: QuizQuestion = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      question: dq.question.trim(),
      type: dq.type,
      options,
      correctAnswer: dq.correct,
      difficulty: cqDifficulty,
      topicTag: cqTopic.trim() || undefined,
      bloomsLevel: dq.bloomsLevel || undefined,
      explanation: dq.explanation.trim() || undefined,
    };
    setCqQuestions((prev) => {
      if (dq.index !== undefined && dq.index >= 0 && dq.index < prev.length) {
        const next = [...prev];
        next[dq.index] = q;
        return next;
      }
      return [...prev, q];
    });
    setDq(null);
    setDqError(null);
  };

  const handleCreateQuiz = async () => {
    if (!cqTitle.trim()) {
      setCreateMsg('Quiz title is required.');
      return;
    }
    if (cqType === 'teacher' && !cqSubjectId) {
      setCreateMsg('Select an associated course subject.');
      return;
    }
    if (cqQuestions.length === 0) {
      setCreateMsg('Add at least one question, or use the AI Quiz Generator instead.');
      return;
    }
    for (let i = 0; i < cqQuestions.length; i++) {
      const error = validateQuizQuestion(cqQuestions[i]);
      if (error) {
        setCreateMsg(`Question ${i + 1}: ${error}`);
        return;
      }
    }
    setSavingCreate(true);
    setCreateMsg(null);
    try {
      const subject = subjects.find((s) => s.id === cqSubjectId);
      const created = await createQuiz({
        title: cqTitle.trim(),
        description: cqTopic.trim() ? `Topic: ${cqTopic.trim()}` : undefined,
        subjectId: cqType === 'teacher' && cqSubjectId ? cqSubjectId : 'personal',
        subjectName: subject ? `${subject.code} - ${subject.name}` : (cqType === 'teacher' ? 'General' : 'Personal Practice'),
        quizType: cqType,
        questions: cqQuestions,
        isPublished: cqType === 'teacher',
        timeLimitMinutes: cqTime,
        passPercentage: 75,
        difficulty: 'medium',
        attemptsAllowed: cqLimitAttempts ? cqAttempts : 0,
        revealAnswers: cqReveal,
        deadline: toDeadlineISO(cqDeadline),
        userRole: currentUser?.role as 'student' | 'teacher' | 'admin',
        createdById: currentUser?.id,
        createdByName: currentUser?.name,
      });
      setShowCreate(false);
      setQuizzes((prev) => [created, ...prev]);
      showToast(cqType === 'teacher' ? 'Course quiz published.' : 'Practice quiz created.');
    } catch (err) {
      setCreateMsg((err as Error).message || 'Could not create the quiz.');
    } finally {
      setSavingCreate(false);
    }
  };

  // When opened from a notification, surface the target quiz on the catalog
  // instead of auto-starting it. Clearing the subject filter guarantees the
  // card is visible; we highlight it and open its preview so the student can
  // deliberately choose to start (or resume) it.
  useEffect(() => {
    if (!autoOpenQuizId) return;
    if (quizzes.length === 0) return;
    const target = quizzes.find((q) => q.id === autoOpenQuizId);
    if (target) {
      setSubjectFilter('all');
      setHighlightQuizId(target.id);
      const t = setTimeout(() => {
        setPreviewQuiz(target);
        const y = cardY.current[target.id];
        if (y != null && scrollRef.current) {
          scrollRef.current.scrollTo({ y: Math.max(0, y - 90), animated: true });
        }
        setTimeout(() => setHighlightQuizId(null), 4000);
        if (onAutoOpenHandled) onAutoOpenHandled();
      }, 120);
      return () => clearTimeout(t);
    }
    if (onAutoOpenHandled) onAutoOpenHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenQuizId, quizzes]);

  const activeQuestions = activeQuiz?.questions || [];
  const totalQuestions = activeQuestions.length;
  const question: QuizQuestion | undefined = activeQuestions[currentIndex];
  const questionHintKey = question
    ? `${activeQuiz?.id ?? 'quiz'}:${question.id || currentIndex}`
    : '';
  const currentHint = questionHintKey ? hintsByQuestion[questionHintKey] : undefined;
  const currentHintError = questionHintKey ? hintErrorsByQuestion[questionHintKey] : undefined;
  const isCurrentHintLoading = questionHintKey !== '' && hintLoadingFor === questionHintKey;

  const attemptsExhausted = (q: Quiz): boolean => {
    const allowed = q.attemptsAllowed || 0;
    return q.quizType !== 'student' && allowed > 0 && (q.attemptsUsed || 0) >= allowed;
  };

  const isOverdue = (q: Quiz): boolean =>
    !!q.deadline && new Date(q.deadline).getTime() < Date.now();

  const lastPct = (q: Quiz): number => Math.round(((q.lastScoreRaw ?? 0) / Math.max(q.lastMaxScore ?? 1, 1)) * 100);

  const retakeLabel = (q: Quiz): string | null => {
    if ((q.attemptsUsed ?? 0) <= 0) return null;
    if (attemptsExhausted(q)) return `Last ${lastPct(q)}% · Exceeded`;
    const allowed = q.attemptsAllowed || 0;
    return allowed > 0
      ? `Retake  Last ${lastPct(q)}% � ${allowed - (q.attemptsUsed ?? 0)} left`
      : `Retake � Last ${lastPct(q)}%`;
  };

  const startQuiz = (q: Quiz, resumeFrom?: SavedQuizProgress) => {
    if (!resumeFrom && currentUser?.role !== 'teacher' && currentUser?.role !== 'admin' && q.isPublished === false) {
      showToast('This quiz has not been published yet and is not available to students.', 'error');
      return;
    }
    const allowed = q.attemptsAllowed || 0;
    if (q.quizType !== 'student' && allowed > 0 && (q.attemptsUsed || 0) >= allowed) {
      showToast('You have reached the maximum number of attempts allowed for this quiz.', 'error');
      return;
    }
    if (currentUser?.role === 'student' && isOverdue(q)) {
      showToast('The deadline for this quiz has passed. It has been recorded as Missing.', 'error');
      return;
    }
    setActiveQuiz(q);
    setQuizFinished(false);
    setResult(null);
    setHintsByQuestion({});
    setHintErrorsByQuestion({});
    setHintLoadingFor(null);
    setAutoSubmitted(false);
    setAutoFinishPending(false);
    if (resumeFrom) {
      setCurrentIndex(resumeFrom.currentQIndex);
      setAnswers((resumeFrom.userAnswers || {}) as Record<number, AnswerValue>);
      answersRef.current = (resumeFrom.userAnswers || {}) as Record<number, AnswerValue>;
      setSecondsLeft(resumeFrom.timeLeft ?? (q.timeLimitMinutes || 15) * 60);
    } else {
      setCurrentIndex(0);
      setAnswers({});
      answersRef.current = {};
      setTextInput({});
      setSecondsLeft((q.timeLimitMinutes || 15) * 60);
    }
  };

  const saveProgress = () => {
    if (!activeQuiz) return;
    saveQuizProgress(userId, {
      quizId: activeQuiz.id,
      quizTitle: activeQuiz.title,
      subjectName: activeQuiz.subjectName,
      currentQIndex: currentIndex,
      userAnswers: answers as Record<string, unknown>,
      timeLeft: secondsLeft,
      totalQuestions: activeQuestions.length,
      lastUpdated: new Date().toISOString(),
      savedQuiz: activeQuiz,
    });
  };

  useEffect(() => {
    if (activeQuiz && !quizFinished) {
      const t = setTimeout(saveProgress, 600);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, answers, secondsLeft, activeQuiz, quizFinished]);

  useEffect(() => {
    if (!activeQuiz || quizFinished) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          setAutoFinishPending(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuiz, quizFinished]);

  // Run completion in a fresh render so finishQuiz closes over the latest
  // answers (read via answersRef) rather than a stale timer closure.
  useEffect(() => {
    if (autoFinishPending) {
      finishQuiz(true);
      setAutoFinishPending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFinishPending]);

  const handleSelect = (optionIndex: number) => {
    if (!question) return;
    if (question.type === 'identification' || question.type === 'short_answer') return;
    if (Array.isArray(question.correctAnswer)) {
      const current = Array.isArray(answers[currentIndex]) ? (answers[currentIndex] as number[]) : [];
      setAnswers((prev) => ({
        ...prev,
        [currentIndex]: current.includes(optionIndex)
          ? current.filter((i) => i !== optionIndex)
          : [...current, optionIndex],
      }));
      return;
    }
    setAnswers((prev) => ({ ...prev, [currentIndex]: optionIndex }));
  };

  const handleTextAnswer = (value: string) => {
    setTextInput((prev) => ({ ...prev, [currentIndex]: value }));
    setAnswers((prev) => ({ ...prev, [currentIndex]: value }));
  };

  const optionIndex = (value: AnswerValue): number => {
    if (value === null || value === undefined) return -1;
    const raw = String(value).trim();
    if (/^[A-Da-d]$/.test(raw)) return 'ABCD'.indexOf(raw.toUpperCase());
    const idx = Number(raw);
    return Number.isInteger(idx) ? idx : -1;
  };

  const formatAnswer = (q: QuizQuestion, value: AnswerValue): string => {
    if (value === null || value === undefined) return 'No answer';
    if (q.type === 'identification' || q.type === 'short_answer') return String(value);
    if (Array.isArray(value)) {
      const parts = value
        .map((v) => {
          const idx = optionIndex(v as number | string);
          return q.options && q.options[idx] !== undefined ? q.options[idx] : 'No answer';
        })
        .filter((t) => t !== 'No answer');
      return parts.length > 0 ? parts.join(', ') : 'No answer';
    }
    if (typeof value === 'string' && value.trim() === '') return 'No answer';
    const idx = optionIndex(value);
    return q.options && q.options[idx] !== undefined ? q.options[idx] : 'No answer';
  };

  const correctAnswerText = (q: QuizQuestion): string => {
    if (q.type === 'identification' || q.type === 'short_answer') return String(q.correctAnswer);
    if (Array.isArray(q.correctAnswer)) {
      const parts = q.correctAnswer
        .map((c) => {
          const idx = optionIndex(c);
          return q.options && q.options[idx] !== undefined ? q.options[idx] : 'No answer';
        })
        .filter((t) => t !== 'No answer');
      return parts.length > 0 ? parts.join(', ') : 'No answer';
    }
    const idx = optionIndex(q.correctAnswer);
    return q.options && q.options[idx] !== undefined ? q.options[idx] : 'No answer';
  };

  const isAnswerCorrect = (q: QuizQuestion, value: AnswerValue): boolean => {
    if (value === null || value === undefined) return false;
    if (q.type === 'identification' || q.type === 'short_answer') {
      return String(value).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
    }
    if (Array.isArray(q.correctAnswer)) {
      const selected = Array.isArray(value) ? value : [value];
      const selectedIdx = selected.map((v) => optionIndex(v as number | string));
      const correctIdx = q.correctAnswer.map((c) => optionIndex(c));
      if (selectedIdx.length === 0 || selectedIdx.some((i) => i < 0) || correctIdx.some((i) => i < 0)) {
        return false;
      }
      return selectedIdx.length === correctIdx.length && selectedIdx.every((i) => correctIdx.includes(i));
    }
    const idx = optionIndex(value);
    const correct = optionIndex(q.correctAnswer);
    return idx >= 0 && idx === correct;
  };

  const buildLocalResult = (): FinishedResult => {
    let score = 0;
    const feedback: ResultFeedback[] = activeQuiz!.questions.map((q, i) => {
      const ans = answersRef.current[i] !== undefined ? answersRef.current[i] : null;
      const correct = isAnswerCorrect(q, ans);
      if (correct) score += 1;
      return {
        index: i,
        question: q.question,
        type: q.type,
        yourAnswer: formatAnswer(q, ans),
        correctAnswer: correctAnswerText(q),
        correct,
        explanation: q.explanation,
        topicTag: q.topicTag,
      };
    });
    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
    const passed = percentage >= (activeQuiz!.passPercentage || 70);
    return { score, maxScore: totalQuestions, percentage, passed, autoSubmitted: false, feedback };
  };

  // Convert the server's graded feedback into the same shape the result screen
  // expects. The server is authoritative: it knows the correct answers even for
  // teacher quizzes where the answer key is hidden from students upfront.
  const mapServerFeedback = (serverFeedback: any[], questions: QuizQuestion[]): ResultFeedback[] =>
    (serverFeedback || []).map((f: any, i: number) => {
      const q = questions[i] || { question: '', type: 'multiple_choice', options: [] as string[] };
      const userAnswer = f.userAnswer;
      let correctText = '';
      const rawCorrect = f.correctAnswer;
      if (rawCorrect !== undefined && rawCorrect !== null) {
        if (Array.isArray(rawCorrect)) {
          correctText = rawCorrect
            .map((c: number | string) => {
              const idx = optionIndex(c);
              return q.options && q.options[idx] !== undefined ? q.options[idx] : 'No answer';
            })
            .filter((t: string) => t !== 'No answer')
            .join(', ');
        } else {
          const idx = optionIndex(rawCorrect as number | string);
          correctText =
            idx >= 0 && q.options && q.options[idx] !== undefined ? q.options[idx] : String(rawCorrect);
        }
      }
      return {
        index: i,
        question: (q.question as string) || f.question || `Question ${i + 1}`,
        type: (q.type as string) || 'multiple_choice',
        yourAnswer: formatAnswer(q, userAnswer as AnswerValue),
        correctAnswer: correctText || String(rawCorrect ?? ''),
        correct: !!f.isCorrect,
        explanation: f.explanation || q.explanation,
        topicTag: f.topic || q.topicTag,
      };
    });

  const finishQuiz = async (auto = false) => {
    if (!activeQuiz) return;
    const localResult = buildLocalResult();
    localResult.autoSubmitted = auto;

    // Server-grade when online (matches web). Offline falls back to local
    // grading. The server knows the correct answers even for teacher quizzes
    // where the answer key is hidden from students upfront.
    const totalSecs = (activeQuiz.timeLimitMinutes || 15) * 60;
    let serverResult: FinishedResult | null = null;
    try {
      const data = await submitQuizAttempt(activeQuiz.id, {
        studentId: userId,
        studentName: currentUser?.name || 'Student',
        timeTaken: Math.max(0, totalSecs - secondsLeft),
        answers: activeQuiz.questions.map((q, i) => ({
          questionId: q.id ?? String(i),
          selectedAnswer: answersRef.current[i] !== undefined ? (answersRef.current[i] as number | string | number[]) : '',
        })),
      });
      const serverAttempt = (data as { attempt?: QuizAttempt })?.attempt || (data as QuizAttempt);
      if (serverAttempt && serverAttempt.id && !String(serverAttempt.id).startsWith('att-local')) {
        const sFeedback = Array.isArray(serverAttempt.answers)
          ? serverAttempt.answers
          : Array.isArray((serverAttempt as unknown as { feedback?: unknown[] }).feedback)
            ? (serverAttempt as unknown as { feedback: unknown[] }).feedback
            : [];
        const serverFeedback = mapServerFeedback(sFeedback, activeQuiz.questions);
        const finalFeedback = serverFeedback.length > 0 ? serverFeedback : localResult.feedback;
        const finalScore =
          Number.isFinite(Number(serverAttempt.score)) && Number(serverAttempt.score) > 0
            ? Number(serverAttempt.score)
            : localResult.score;
        serverResult = {
          score: finalScore,
          maxScore: Number.isFinite(Number(serverAttempt.maxScore)) && Number(serverAttempt.maxScore) > 0
            ? Number(serverAttempt.maxScore)
            : localResult.maxScore,
          percentage: Number.isFinite(Number(serverAttempt.percentage))
            ? Number(serverAttempt.percentage)
            : localResult.percentage,
          passed: !!serverAttempt.passed,
          autoSubmitted: auto,
          feedback: finalFeedback,
        };
        setQuizzes((prev) =>
          prev.map((x) => (x.id === activeQuiz.id ? { ...x, attemptsUsed: (x.attemptsUsed || 0) + 1 } : x))
        );
      }
    } catch {
      // Offline: the attempt is already saved locally on this device.
    }

    const finalResult = serverResult || localResult;
    const wrong = finalResult.feedback.filter((f) => !f.correct);
    const attempt: LocalAttempt = {
      id: `att-${Date.now()}`,
      quizId: activeQuiz.id,
      quizTitle: activeQuiz.title,
      subjectName: activeQuiz.subjectName,
      score: finalResult.score,
      maxScore: finalResult.maxScore,
      percentage: finalResult.percentage,
      passed: finalResult.passed,
      weakTopics: Array.from(new Set(wrong.map((f) => f.topicTag || 'General').filter((t) => !!t))),
      strongTopics: Array.from(new Set(finalResult.feedback.filter((f) => f.correct).map((f) => f.topicTag || 'General').filter((t) => !!t))),
      completedAt: new Date().toISOString(),
    };
    addAttempt(userId, attempt);
    removeQuizProgress(userId, activeQuiz.id)
      .then(() => getQuizProgresses(userId))
      .then((progs) => setResumable(progs.length > 0 ? progs[0] : null));

    setAutoSubmitted(auto);
    setResult(finalResult);
    setQuizFinished(true);
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const goNext = () => {
    if (currentIndex + 1 >= totalQuestions) {
      finishQuiz(false);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const getHint = async () => {
    if (!question) return;
    const key = questionHintKey;
    setHintLoadingFor(key);
    setHintErrorsByQuestion((prev) => {
      if (!(key in prev)) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });

    try {
      const data = await fetchQuizHint(
        question.question,
        question.options || [],
        question.type,
        question.topicTag
      );
      const hint = typeof data.hint === 'string' ? data.hint.trim() : '';
      if (!hint) {
        throw new Error('Hint response was empty');
      }
      setHintsByQuestion((prev) => ({ ...prev, [key]: hint }));
    } catch (err) {
      console.warn('[Mobile] Hint request failed', err);
      setHintErrorsByQuestion((prev) => ({
        ...prev,
        [key]: 'Could not generate a hint for this question right now. Please try again.',
      }));
    } finally {
      setHintLoadingFor((prev) => (prev === key ? null : prev));
    }
  };

  const exitQuiz = () => {
    if (quizFinished) {
      if (hasReturnOrigin && onReturnToOrigin) {
        setActiveQuiz(null);
        setQuizFinished(false);
        setResult(null);
        onReturnToOrigin();
        return;
      }
      setActiveQuiz(null);
      setQuizFinished(false);
      setResult(null);
      return;
    }
    saveProgress();
    setActiveQuiz(null);
    setQuizFinished(false);
    setResult(null);
    setConfirmExit(false);
  };

  if (loading) return <LoadingView label="Loading assessments..." />;

  // ---------------- PLAYER ----------------
  if (activeQuiz) {
    if (quizFinished && result) {
      return (
        <View style={[styles.flex, { backgroundColor: colors.background }]}>
          <ScrollView contentContainerStyle={styles.resultWrap}>
            <View style={[styles.resultIcon, { backgroundColor: result.passed ? colors.successSoft : colors.warningSoft }]}>
              <GraduationCap size={40} color={result.passed ? colors.success : colors.warning} />
            </View>
            <Text style={[styles.resultTitle, { color: colors.foreground }]}>Quiz Completed!</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>You scored</Text>
            <Text style={[styles.resultScore, { color: colors.primary }]}>
              {result.score} / {result.maxScore}
            </Text>
            <View style={[styles.resultPctBadge, { backgroundColor: result.passed ? colors.successSoft : colors.dangerSoft }]}>
              <Text style={{ color: result.passed ? colors.success : colors.danger, fontSize: 18, fontWeight: '900' }}>{result.percentage}%</Text>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
              {result.passed ? `Passed! (minimum ${activeQuiz.passPercentage || 70}%)` : `Below passing mark (minimum ${activeQuiz.passPercentage || 70}%)`}
            </Text>
            {result.autoSubmitted && (
              <Text style={{ color: colors.warning, fontSize: 12, fontWeight: '700' }}>Timer expired - auto-submitted with unanswered questions.</Text>
            )}

            <View style={{ width: '100%', marginTop: 14, gap: 10 }}>
              <SectionHeader
                title={activeQuiz.revealAnswers === false ? 'Feedback' : 'Feedback & Explanations'}
                subtitle={activeQuiz.revealAnswers === false ? 'Correct answers are hidden by your instructor' : 'Review each question to reinforce weak topics'}
              />
              {result.feedback.map((f) => (
                <View key={f.index} style={[styles.feedbackCard, { borderColor: f.correct ? colors.success : colors.danger, backgroundColor: f.correct ? colors.successSoft : colors.dangerSoft }]}>
                  <View style={styles.feedbackHead}>
                    {f.correct ? <CheckCircle2 size={16} color={colors.success} /> : <XCircle size={16} color={colors.danger} />}
                    <Text style={{ flex: 1, color: f.correct ? colors.success : colors.danger, fontSize: 13, fontWeight: '800' }}>Q{f.index + 1}</Text>
                    {f.topicTag && <Badge text={f.topicTag} color={f.correct ? colors.success : colors.danger} bg={colors.card} />}
                  </View>
                  <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>{f.question}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Your answer: {f.yourAnswer}</Text>
                  {activeQuiz.revealAnswers !== false && (
                    <>
                      <Text style={{ color: f.correct ? colors.success : colors.danger, fontSize: 12, fontWeight: '700' }}>
                        Correct answer: {f.correctAnswer}
                      </Text>
                      {f.explanation && <Text style={{ color: colors.mutedForeground, fontSize: 11, lineHeight: 16 }}>{f.explanation}</Text>}
                    </>
                  )}
                </View>
              ))}
            </View>

            <View style={styles.resultActions}>
              {!attemptsExhausted(activeQuiz) && (
                <OutlineButton label="Try Again" onPress={() => startQuiz(activeQuiz)} />
              )}
              <PrimaryButton label={hasReturnOrigin ? 'Back to Subject Quizzes' : 'Back to Assessments'} onPress={exitQuiz} />
            </View>
          </ScrollView>
        </View>
      );
    }

    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.playerWrap}>
          <View style={styles.playerHead}>
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>
              {activeQuiz.title}
            </Text>
            <View style={styles.playerMeta}>
              <Badge text={`Question ${currentIndex + 1} of ${totalQuestions}`} color={colors.primary} />
              <Badge text={formatTime(secondsLeft)} color={secondsLeft <= 60 ? colors.danger : colors.success} bg={secondsLeft <= 60 ? colors.dangerSoft : colors.successSoft} />
            </View>
            <ProgressBar value={((currentIndex + 1) / totalQuestions) * 100} />
          </View>

          {question && (
            <View style={styles.questionBlock}>
              <View style={styles.questionTop}>
                <Badge text={typeLabel(question.type)} color={colors.warning} bg={colors.warningSoft} />
                {question.topicTag && <Badge text={question.topicTag} color={colors.primary} />}
              </View>
              <Text style={[styles.questionText, { color: colors.foreground }]}>{question.question}</Text>

              {question.type === 'identification' || question.type === 'short_answer' ? (
                <View style={{ gap: 10 }}>
                  <TextInput
                    value={textInput[currentIndex] || ''}
                    onChangeText={handleTextAnswer}
                    placeholder="Type your answer..."
                    placeholderTextColor={colors.mutedForeground}
                    style={[styles.answerInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.foreground }]}
                  />
                  {answers[currentIndex] !== undefined && (
                    <Text style={{ color: colors.success, fontSize: 11, fontWeight: '700' }}>Answer recorded - press Next to continue</Text>
                  )}
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {Array.isArray(question.correctAnswer) && (
                    <Text style={{ color: colors.warning, fontSize: 12, fontWeight: '700' }}>
                      Select all correct answers that apply.
                    </Text>
                  )}
                  {(question.options || []).map((opt, idx) => {
                    const isMulti = Array.isArray(question.correctAnswer);
                    const current = isMulti && Array.isArray(answers[currentIndex])
                      ? (answers[currentIndex] as number[])
                      : [];
                    const selected = isMulti
                      ? current.includes(idx)
                      : answers[currentIndex] !== undefined && Number(answers[currentIndex]) === idx;
                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => handleSelect(idx)}
                        style={[
                          styles.optionBtn,
                          { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.indigoSoft : colors.card },
                        ]}
                      >
                        <Text style={{ color: selected ? colors.primary : colors.foreground, fontSize: 14, fontWeight: '600', flex: 1 }}>
                          {String.fromCharCode(65 + idx)}. {opt}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={styles.hintZone}>
                {currentHint ? (
                  <View style={[styles.hintBox, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
                    <Lightbulb size={15} color={colors.warning} />
                    <Text style={{ color: colors.warning, fontSize: 12, lineHeight: 17, flex: 1 }}>{currentHint}</Text>
                  </View>
                ) : activeQuiz.quizType !== 'teacher' ? (
                  <View>
                    <TouchableOpacity
                      onPress={getHint}
                      disabled={isCurrentHintLoading}
                      style={[styles.hintBtn, isCurrentHintLoading && { opacity: 0.5 }]}
                    >
                      <Sparkles size={14} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
                        {isCurrentHintLoading ? 'Getting hint...' : 'Get a Hint'}
                      </Text>
                    </TouchableOpacity>
                    {currentHintError ? (
                      <Text style={{ color: colors.danger, fontSize: 11, lineHeight: 15, marginTop: 4 }}>
                        {currentHintError}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>
          )}

          <View style={styles.playerNav}>
            <TouchableOpacity
              onPress={goPrev}
              disabled={currentIndex === 0}
              style={[styles.navCircle, { borderColor: colors.border }, currentIndex === 0 && { opacity: 0.35 }]}
            >
              <ChevronLeft size={20} color={colors.foreground} />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => setConfirmExit(true)} style={[styles.exitBtn, { borderColor: colors.border }]}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: '700' }}>Save & Exit</Text>
            </TouchableOpacity>
            {answers[currentIndex] !== undefined ? (
              <TouchableOpacity onPress={goNext} style={[styles.nextBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{currentIndex + 1 >= totalQuestions ? 'Finish Quiz' : 'Next Question'}</Text>
                <ChevronRight size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={currentIndex >= totalQuestions - 1 ? () => finishQuiz(true) : goNext}
                style={[styles.nextBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
              >
                <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: '700' }}>Next</Text>
                <ChevronRight size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        <Modal visible={confirmExit} onClose={() => setConfirmExit(false)} title="Exit Quiz?" subtitle="Your progress will be saved and you can resume anytime.">
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <OutlineButton label="Keep Quizzing" onPress={() => setConfirmExit(false)} style={{ flex: 1 }} />
            <PrimaryButton label="Save & Exit" onPress={exitQuiz} style={{ flex: 1 }} />
          </View>
        </Modal>
      </View>
    );
  }

  // ---------------- CATALOG ----------------
  const filteredQuizzes = quizzes.filter((q) => {
    if (q.isPublished === false && currentUser?.role !== 'teacher' && currentUser?.role !== 'admin') return false;
    if (subjectFilter !== 'all' && q.subjectId !== subjectFilter) return false;
    return true;
  });

  return (
    <ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.banner, { backgroundColor: colors.surfaceAlt }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: colors.foreground }]}>Assessments & Quizzes</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
            Practice quizzes from your subjects, with instant feedback.
          </Text>
        </View>
      </View>

      <View style={styles.toolbarRow}>
        <PrimaryButton label="Create Quiz" onPress={openCreateQuiz} style={{ flex: 1 }} />
        <PrimaryButton label="AI Quiz Generator" onPress={() => onNavigate('ai-assistant')} style={{ flex: 1 }} />
      </View>

      {resumable && (
        <TouchableOpacity
          onPress={() => {
            const q = quizzes.find((x) => x.id === resumable.quizId);
            if (q) startQuiz(q, resumable);
          }}
          style={[styles.resumeBanner, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}
        >
          <Play size={18} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.warning, fontSize: 11, fontWeight: '800' }}>RESUME IN-PROGRESS QUIZ</Text>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '800' }}>{resumable.quizTitle}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
              Question {resumable.currentQIndex + 1} of {resumable.totalQuestions} - {formatTime(resumable.timeLeft)} left
            </Text>
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.filterBlock}>
        <SectionHeader title="Quiz Catalog" subtitle={`${filteredQuizzes.length} assessment(s)`} />
        <View style={styles.filterBar}>
          <View style={[styles.allTab, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>All Quizzes ({quizzes.length})</Text>
          </View>
          <TouchableOpacity
            onPress={() => setSubjectPickerOpen(true)}
            style={[styles.subjectDrop, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: '600' }}>Subject:</Text>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700', flex: 1 }} numberOfLines={1}>
              {subjectFilter === 'all' ? 'All Subjects Filter' : (() => { const s = subjects.find((x) => x.id === subjectFilter); return s ? `${s.code} - ${s.name}` : 'All Subjects Filter'; })()}
            </Text>
            <ChevronDown size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={subjectPickerOpen} onClose={() => setSubjectPickerOpen(false)} title="Filter by Subject" subtitle="Choose a subject to filter the quiz catalog">
        <View style={{ gap: 8 }}>
          <TouchableOpacity
            onPress={() => { setSubjectFilter('all'); setSubjectPickerOpen(false); }}
            style={[styles.pickerItem, { backgroundColor: subjectFilter === 'all' ? colors.indigoSoft : colors.surfaceAlt, borderColor: subjectFilter === 'all' ? colors.primary : colors.border }]}
          >
            <Text style={{ color: subjectFilter === 'all' ? colors.primary : colors.foreground, fontSize: 13, fontWeight: '700' }}>All Subjects Filter</Text>
          </TouchableOpacity>
          {subjects.map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => { setSubjectFilter(s.id); setSubjectPickerOpen(false); }}
              style={[styles.pickerItem, { backgroundColor: subjectFilter === s.id ? colors.indigoSoft : colors.surfaceAlt, borderColor: subjectFilter === s.id ? colors.primary : colors.border }]}
            >
              <Text style={{ color: subjectFilter === s.id ? colors.primary : colors.foreground, fontSize: 13, fontWeight: '700' }}>{s.code} - {s.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {filteredQuizzes.length === 0 ? (
        <EmptyState icon={<CheckSquare size={36} color={colors.mutedForeground} />} title="No quizzes found" subtitle="Use the AI generator to create a new practice quiz." />
      ) : (
        <View style={{ gap: 12 }}>
          {filteredQuizzes.map((q) => (
            <Card
              key={q.id}
              style={{
                gap: 10,
                backgroundColor: highlightQuizId === q.id ? colors.warningSoft : colors.card,
                borderColor: highlightQuizId === q.id ? colors.warning : colors.border,
                borderWidth: highlightQuizId === q.id ? 2 : 1,
              }}
              onPress={() => setPreviewQuiz(q)}
              onLayout={(e: any) => { cardY.current[q.id] = e.nativeEvent.layout.y; }}
            >
              <View style={styles.quizTop}>
                {q.subjectName ? (
                  <Badge text={q.subjectName} color={colors.primary} />
                ) : (
                  <Badge text="Unassigned" color="#d97706" bg="rgba(217,119,6,0.12)" />
                )}
                <View style={styles.quizTopActions}>
                  {(q.attemptsUsed ?? 0) > 0 && (
                    <View style={[styles.retakeChip, { backgroundColor: attemptsExhausted(q) ? colors.dangerSoft : colors.indigoSoft }]}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: attemptsExhausted(q) ? colors.danger : colors.primary }}>
                        {retakeLabel(q)}
                      </Text>
                    </View>
                  )}
                  {canDownloadQuizFor(q) && (
                    <TouchableOpacity
                      onPress={() => downloadQuiz(q)}
                      style={[styles.downloadBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                      accessibilityLabel="Download quiz as PDF"
                    >
                      <Download size={15} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <Text style={[styles.quizTitle, { color: colors.foreground }]} numberOfLines={1}>
                {q.title}
              </Text>
              {q.description && cleanQuizDescription(q.description) && (
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }} numberOfLines={1}>
                  {cleanQuizDescription(q.description)}
                </Text>
              )}
              <View style={styles.quizMeta}>
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{q.questions.length} Questions</Text>
                {q.quizType === 'teacher' ? (
                  <Text
                    style={
                      attemptsExhausted(q)
                        ? { color: colors.danger, fontSize: 11, fontWeight: '700' }
                        : { color: colors.mutedForeground, fontSize: 11 }
                    }
                  >
                    {(q.attemptsAllowed || 0) > 0
                      ? `${q.attemptsUsed || 0}/${q.attemptsAllowed} attempts`
                      : 'Unlimited attempts'}
                  </Text>
                ) : (
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{q.difficulty}</Text>
                )}
              </View>
              <View style={styles.quizActions}>
                {isStaff ? (
                  <TouchableOpacity
                    onPress={() => togglePublish(q)}
                    disabled={publishingId === q.id}
                    style={[
                      styles.pubBtn,
                      q.isPublished
                        ? { backgroundColor: 'rgba(217,119,6,0.12)', borderColor: '#d97706' }
                        : { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: '#10b981' },
                    ]}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '800', color: q.isPublished ? '#d97706' : '#10b981' }}>
                      {publishingId === q.id ? '...' : q.isPublished ? 'Unpublish' : 'Publish'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {isStaff ? (
                  q.quizType === 'teacher' ? (
                    <OutlineButton
                      label={q.subjectId ? 'Change Subject' : 'Assign Subject'}
                      onPress={() => openAssignSubject(q)}
                      style={{ flex: 1 }}
                    />
                  ) : null
                ) : null}
                {isStaff ? (
                  <OutlineButton label="Edit" onPress={() => openEditQuiz(q)} style={{ flex: 1 }} />
                ) : null}
                {!isStaff && savedMap[q.id] ? (
                  <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
                    <OutlineButton label="Restart" onPress={() => startQuiz(q)} style={{ flex: 1 }} />
                    <PrimaryButton label="Resume" onPress={() => startQuiz(q, savedMap[q.id])} style={{ flex: 1 }} />
                  </View>
                ) : (
                  <PrimaryButton
                    label={attemptsExhausted(q) ? 'Attempts Exceeded' : (q.attemptsUsed ?? 0) > 0 ? 'Retake Quiz' : 'Start Quiz'}
                    disabled={attemptsExhausted(q)}
                    onPress={() => startQuiz(q)}
                    style={{ flex: 1 }}
                  />
                )}
              </View>
            </Card>
          ))}
        </View>
      )}

      <Modal
        visible={!!previewQuiz}
        onClose={() => setPreviewQuiz(null)}
        title={previewQuiz ? `${previewQuiz.title}${(previewQuiz.attemptsUsed ?? 0) > 0 ? ` � Last ${lastPct(previewQuiz)}%` : ''}` : ''}
        subtitle={previewQuiz ? `${previewQuiz.subjectName || 'Unassigned'} � ${previewQuiz.questions.length} Questions � ${previewQuiz.timeLimitMinutes || 15} min � Pass ${previewQuiz.passPercentage || 70}%` : ''}
      >
        <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 10 }}>
          {previewQuiz && (isStaff || previewQuiz.createdById === currentUser?.id) ? (
            previewQuiz.questions.map((q, idx) => (
            <View key={q.id || idx} style={[styles.previewQ, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '800' }}>Question {idx + 1}</Text>
                <Badge text={typeLabel(q.type)} color={colors.warning} bg={colors.warningSoft} />
                {Array.isArray(q.correctAnswer) && (
                  <Badge text="Multiple Answers" color={colors.primary} bg={colors.indigoSoft} />
                )}
              </View>
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '600', lineHeight: 19 }}>{q.question}</Text>
              {q.type === 'multiple_choice' && q.options && q.options.length > 0 && (
                <View style={{ gap: 3 }}>
                  {q.options.map((opt, oIdx) => (
                    <Text key={oIdx} style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      {String.fromCharCode(65 + oIdx)}. {opt}
                    </Text>
                  ))}
                </View>
              )}
              {q.topicTag && <Badge text={q.topicTag} color={colors.primary} />}
            </View>
          ))
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 28, gap: 6 }}>
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>Questions hidden until you start</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
                The questions and answer choices for this quiz are revealed only when you take it.
              </Text>
            </View>
          )}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          {isStaff ? (
            previewQuiz?.quizType === 'teacher' ? (
              <OutlineButton
                label={previewQuiz.subjectId ? 'Change Subject' : 'Assign Subject'}
                onPress={() => {
                  if (previewQuiz) openAssignSubject(previewQuiz);
                  setPreviewQuiz(null);
                }}
                style={{ flex: 1 }}
              />
            ) : null
          ) : null}
          {isStaff ? (
            previewQuiz ? (
              <OutlineButton
                label="Delete"
                onPress={() => {
                  if (previewQuiz) confirmDeleteQuiz(previewQuiz);
                  setPreviewQuiz(null);
                }}
                style={{ flex: 1 }}
                color={colors.danger}
              />
            ) : null
          ) : null}
          {previewQuiz && canDownloadQuizFor(previewQuiz) ? (
            <OutlineButton
              label="Download"
              onPress={() => downloadQuiz(previewQuiz)}
              style={{ flex: 1 }}
            />
          ) : null}
          <PrimaryButton
                label={
                  previewQuiz && attemptsExhausted(previewQuiz)
                    ? 'Attempts Exceeded'
                    : previewQuiz && savedMap[previewQuiz.id]
                      ? 'Resume Quiz'
                      : previewQuiz && (previewQuiz.attemptsUsed ?? 0) > 0
                        ? 'Retake Quiz'
                        : 'Start Quiz'
                }
                disabled={!!previewQuiz && attemptsExhausted(previewQuiz)}
                onPress={() => {
                  if (previewQuiz) {
                    const saved = savedMap[previewQuiz.id];
                    if (saved) startQuiz(previewQuiz, saved);
                    else startQuiz(previewQuiz);
                  }
                  setPreviewQuiz(null);
                }}
                style={{ flex: 1 }}
              />
        </View>
      </Modal>

      <Modal
        visible={!!editingQuiz}
        onClose={() => setEditingQuiz(null)}
        title="Edit Quiz"
        subtitle={editingQuiz?.title}
      >
        <View style={{ gap: 12 }}>
          <Field label="Title" value={eqTitle} onChangeText={setEqTitle} placeholder="Quiz title" />
          <Field label="Description" value={eqDescription} onChangeText={setEqDescription} placeholder="Short description" multiline />
          <Field label="Deadline (optional)" value={eqDeadline} onChangeText={setEqDeadline} placeholder="YYYY-MM-DD" />
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Difficulty</Text>
            <View style={styles.filterChipRow}>
              {(['easy', 'medium', 'hard'] as const).map((d) => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setEqDifficulty(d)}
                  style={[styles.filterChip, eqDifficulty === d ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
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
            <View style={styles.filterChipRow}>
              {[10, 15, 20, 30, 45, 60].map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setEqTimeLimit(t)}
                  style={[styles.filterChip, eqTimeLimit === t ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: eqTimeLimit === t ? '#fff' : colors.foreground }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Pass percentage: {eqPassPct}%</Text>
            <View style={styles.filterChipRow}>
              {[50, 60, 70, 75, 80].map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setEqPassPct(p)}
                  style={[styles.filterChip, eqPassPct === p ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: eqPassPct === p ? '#fff' : colors.foreground }}>{p}%</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Limit attempts per student</Text>
            <View style={styles.filterChipRow}>
              {[false, true].map((on) => (
                <TouchableOpacity
                  key={String(on)}
                  onPress={() => setEqLimitAttempts(on)}
                  style={[styles.filterChip, eqLimitAttempts === on ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
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
                  style={[styles.answerInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.foreground }]}
                />
              </View>
            )}
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Show correct answers to students</Text>
            <View style={styles.filterChipRow}>
              {[true, false].map((on) => (
                <TouchableOpacity
                  key={String(on)}
                  onPress={() => setEqRevealAnswers(on)}
                  style={[styles.filterChip, eqRevealAnswers === on ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: eqRevealAnswers === on ? '#fff' : colors.foreground }}>
                    {on ? 'Yes' : 'No'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <OutlineButton label="Cancel" onPress={() => setEditingQuiz(null)} style={{ flex: 1 }} />
            <PrimaryButton label={savingEdit ? 'Saving...' : 'Save Changes'} onPress={saveEditQuiz} loading={savingEdit} style={{ flex: 1 }} />
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!assignQuiz}
        onClose={() => setAssignQuiz(null)}
        title="Assign Subject"
        subtitle={assignQuiz ? `${assignQuiz.title} � ${assignQuiz.questions.length} Questions` : ''}
      >
        {assignMsg && <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 8, fontWeight: '600' }}>{assignMsg}</Text>}
        <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8 }}>
          The quiz is published to students of the selected subject.
        </Text>
        <View style={{ gap: 8 }}>
          {subjects
            .filter((s) => currentUser?.role !== 'teacher' || s.teacherId === currentUser?.id)
            .map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => setAssignSubjectId(s.id)}
                style={[styles.chip, assignSubjectId === s.id ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: assignSubjectId === s.id ? '#fff' : colors.foreground }}>
                  {s.code} - {s.name}
                </Text>
              </TouchableOpacity>
            ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <OutlineButton label="Cancel" onPress={() => setAssignQuiz(null)} style={{ flex: 1 }} />
          <PrimaryButton label={assigningSubject ? 'Assigning...' : 'Assign Subject'} onPress={handleAssignSubject} loading={assigningSubject} style={{ flex: 1 }} />
        </View>
      </Modal>

      <Modal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Quiz"
        subtitle={isStaff ? 'Publish a course quiz or build a personal practice drill.' : 'Build your own practice quiz.'}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 10, paddingBottom: 60 }}>
            <View style={{ gap: 10 }}>
          {createMsg && <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '600' }}>{createMsg}</Text>}
          <Field label="Quiz title" value={cqTitle} onChangeText={setCqTitle} placeholder="e.g. Photosynthesis Basics" />
          {isStaff && (
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Quiz scope</Text>
              <View style={styles.filterChipRow}>
                {[
                  { v: 'teacher', l: 'Course Quiz (Published)' },
                  { v: 'student', l: 'Personal Practice' },
                ].map((o) => (
                  <TouchableOpacity
                    key={o.v}
                    onPress={() => setCqType(o.v as 'teacher' | 'student')}
                    style={[styles.filterChip, cqType === o.v ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: cqType === o.v ? '#fff' : colors.foreground }}>{o.l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          {cqType === 'teacher' && (
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Subject</Text>
              <View style={styles.filterChipRow}>
                {subjects
                  .filter((s) => currentUser?.role !== 'teacher' || s.teacherId === currentUser?.id)
                  .map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => setCqSubjectId(s.id)}
                      style={[styles.chip, cqSubjectId === s.id ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: cqSubjectId === s.id ? '#fff' : colors.foreground }}>
                        {s.code} - {s.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Time limit (mins)" value={String(cqTime)} onChangeText={(t) => setCqTime(Math.max(1, Math.min(180, Number(t) || 1)))} placeholder="15" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Topic tag (optional)" value={cqTopic} onChangeText={setCqTopic} placeholder="e.g. Cells" />
            </View>
          </View>
          <Field label="Deadline (optional)" value={cqDeadline} onChangeText={setCqDeadline} placeholder="YYYY-MM-DD" />
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Limit attempts per user</Text>
            <View style={styles.filterChipRow}>
              {[false, true].map((on) => (
                <TouchableOpacity
                  key={String(on)}
                  onPress={() => setCqLimitAttempts(on)}
                  style={[styles.filterChip, cqLimitAttempts === on ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: cqLimitAttempts === on ? '#fff' : colors.foreground }}>
                    {on ? 'On' : 'Off (Unlimited)'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {cqLimitAttempts && (
              <TextInput
                value={String(cqAttempts)}
                onChangeText={(t) => setCqAttempts(Math.max(1, Math.min(99, Number(t) || 1)))}
                keyboardType="number-pad"
                style={[styles.answerInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.foreground }]}
              />
            )}
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Show correct answers to students</Text>
            <View style={styles.filterChipRow}>
              {[true, false].map((on) => (
                <TouchableOpacity
                  key={String(on)}
                  onPress={() => setCqReveal(on)}
                  style={[styles.filterChip, cqReveal === on ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: cqReveal === on ? '#fff' : colors.foreground }}>
                    {on ? 'Yes' : 'No'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Questions ({cqQuestions.length})</Text>
            {cqQuestions.length === 0 && (
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                No questions yet — add them below or use the AI Quiz Generator.
              </Text>
            )}
            {cqQuestions.map((q, i) => (
              <View key={q.id} style={[styles.feedbackCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <View style={styles.feedbackHead}>
                  <Text style={{ flex: 1, color: colors.foreground, fontSize: 12, fontWeight: '700' }}>
                    {i + 1}. {q.question}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setDq(toDraftQuestion(q, i));
                      setDqError(null);
                    }}
                  >
                    <Pencil size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCqQuestions((prev) => prev.filter((_, x) => x !== i))}
                  >
                    <Trash2 size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                  {typeLabel(q.type)} · {q.options?.filter(Boolean).length || 0} options · correct: {typeof q.correctAnswer === 'string' ? q.correctAnswer : String.fromCharCode(65 + (((q.correctAnswer as number) || 0) % 26))}
                </Text>
              </View>
            ))}
            <OutlineButton
              label="Add Question"
              onPress={() => {
                setDq({
                  question: '',
                  type: 'multiple_choice',
                  options: ['', '', '', ''],
                  correct: -1,
                  identAnswer: '',
                  bloomsLevel: 'Understanding',
                  explanation: '',
                });
                setDqError(null);
              }}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <OutlineButton label="Cancel" onPress={() => setShowCreate(false)} style={{ flex: 1 }} />
            <PrimaryButton label={savingCreate ? 'Creating...' : 'Create Quiz'} onPress={handleCreateQuiz} loading={savingCreate} style={{ flex: 1 }} />
          </View>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={!!dq}
        onClose={() => {
          setDq(null);
          setDqError(null);
        }}
        title={dq?.index !== undefined ? 'Edit Question' : 'Add Question'}
        subtitle="Build a question for this quiz"
      >
        <ScrollView style={{ maxHeight: 420 }}>
        <View style={{ gap: 14 }}>
          {dqError && <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '600' }}>{dqError}</Text>}
          <Field label="Question" value={dq?.question || ''} onChangeText={(t) => dq && setDq({ ...dq, question: t })} placeholder="Type the question..." />
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Question type</Text>
            <View style={styles.filterChipRow}>
              {QUESTION_TYPE_OPTIONS.map((o) => (
                <TouchableOpacity
                  key={o.value}
                  onPress={() => {
                    if (!dq) return;
                    const options = o.value === 'true_false' ? ['True', 'False'] : [...dq.options];
                    if (o.value === 'multiple_choice') {
                      while (options.length < 4) options.push('');
                    }
                    setDq({ ...dq, type: o.value, options, correct: -1 });
                    setDqError(null);
                  }}
                  style={[styles.filterChip, dq?.type === o.value ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: dq?.type === o.value ? '#fff' : colors.foreground }}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Bloom's level</Text>
            <View style={styles.filterChipRow}>
              {BLOOMS_OPTIONS.map((b) => (
                <TouchableOpacity
                  key={b}
                  onPress={() => dq && setDq({ ...dq, bloomsLevel: b })}
                  style={[styles.filterChip, dq?.bloomsLevel === b ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: dq?.bloomsLevel === b ? '#fff' : colors.foreground }}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Field
            label="Explanation (optional)"
            value={dq?.explanation || ''}
            onChangeText={(t) => dq && setDq({ ...dq, explanation: t })}
            placeholder="Why this is the correct answer"
            multiline
          />
          {dq?.type === 'identification' ? (
            <Field label="Exact answer" value={dq.identAnswer} onChangeText={(t) => dq && setDq({ ...dq, identAnswer: t })} placeholder="Type the exact answer students must enter" />
          ) : (
            <>
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Answer options — tap the correct one</Text>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => dq && setDq({ ...dq, correct: i })}
                    style={[
                      { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
                      dq?.correct === i ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.border },
                    ]}
                  >
                    <CheckCircle2 size={16} color={dq?.correct === i ? '#fff' : colors.mutedForeground} />
                  </TouchableOpacity>
                  <TextInput
                    value={dq?.options[i] || ''}
                    onChangeText={(t) => dq && setDq({ ...dq, options: dq.options.map((o, j) => (j === i ? t : o)) })}
                    placeholder={`Option ${String.fromCharCode(65 + i)}${dq?.type === 'true_false' ? ' (locked)' : ''}`}
                    editable={dq?.type !== 'true_false'}
                    style={[styles.answerInput, { flex: 1, backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.foreground, opacity: dq?.type === 'true_false' ? 0.7 : 1 }]}
                  />
                </View>
              ))}
            </>
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <OutlineButton
              label="Cancel"
              onPress={() => {
                setDq(null);
                setDqError(null);
              }}
              style={{ flex: 1 }}
            />
            <PrimaryButton label="Save Question" onPress={saveQuestionDraft} style={{ flex: 1 }} />
          </View>
          </View>
        </ScrollView>
      </Modal>
    </ScrollView>
  );
}

interface DraftQuestion {
  index?: number;
  question: string;
  type: QuizQuestion['type'];
  options: string[];
  // -1 means no correct answer has been selected yet.
  correct: number;
  identAnswer: string;
  bloomsLevel: string;
  explanation: string;
}

function validateDraftQuestion(dq: DraftQuestion): string | null {
  if (!dq.question.trim()) return 'Question text is required.';
  if (dq.type === 'identification') {
    return dq.identAnswer.trim()
      ? null
      : 'Provide the exact answer for the identification question.';
  }
  if (dq.type === 'true_false') {
    return dq.correct === 0 || dq.correct === 1
      ? null
      : 'Select whether the correct answer is True or False.';
  }
  const options = dq.options.map((o) => o.trim());
  if (options.length < 4 || options.some((o) => !o)) {
    return 'Fill in all four answer options (A–D).';
  }
  return dq.correct >= 0 && dq.correct < options.length
    ? null
    : 'Select which option is the correct answer.';
}

function validateQuizQuestion(q: QuizQuestion): string | null {
  if (!q.question.trim()) return 'Question text is required.';
  if (q.type === 'identification' || q.type === 'short_answer') {
    return typeof q.correctAnswer === 'string' && q.correctAnswer.trim()
      ? null
      : 'Provide the exact answer for the identification question.';
  }
  if (q.type === 'true_false') {
    const tf = Number(q.correctAnswer);
    return tf === 0 || tf === 1
      ? null
      : 'Select whether the correct answer is True or False.';
  }
  const options = (q.options || []).map((o) => String(o).trim());
  if (options.length < 4 || options.some((o) => !o)) {
    return 'Fill in all four answer options (A–D).';
  }
  if (Array.isArray(q.correctAnswer)) {
    if (q.correctAnswer.length === 0) return 'Select at least one correct answer.';
    const invalid = q.correctAnswer.some((value) => {
      const idx = Number(value);
      return !Number.isInteger(idx) || idx < 0 || idx >= options.length;
    });
    return invalid ? 'Select a valid correct answer.' : null;
  }
  const idx = Number(q.correctAnswer);
  return Number.isInteger(idx) && idx >= 0 && idx < options.length
    ? null
    : 'Select which option is the correct answer.';
}

function toDraftQuestion(q: QuizQuestion, index: number): DraftQuestion {
  const isMultipleChoice = q.type === 'multiple_choice';
  const options =
    q.type === 'true_false'
      ? ['True', 'False']
      : [...(q.options || [])];
  if (isMultipleChoice) {
    while (options.length < 4) options.push('');
  }

  let correct = -1;
  if (q.type === 'true_false') {
    const tf = Number(q.correctAnswer);
    correct = tf === 1 ? 1 : tf === 0 ? 0 : -1;
  } else if (isMultipleChoice) {
    if (Array.isArray(q.correctAnswer)) {
      const first = Number(q.correctAnswer[0]);
      correct = Number.isInteger(first) ? first : -1;
    } else if (typeof q.correctAnswer === 'number') {
      correct = q.correctAnswer;
    } else if (typeof q.correctAnswer === 'string') {
      const answerText = q.correctAnswer.toLowerCase().trim();
      correct = options.findIndex((option) => option.trim().toLowerCase() === answerText);
    }
  }

  return {
    index,
    question: q.question,
    type: q.type || 'multiple_choice',
    options,
    correct,
    identAnswer: typeof q.correctAnswer === 'string' ? q.correctAnswer : '',
    bloomsLevel: q.bloomsLevel || 'Understanding',
    explanation: q.explanation || '',
  };
}

const BLOOMS_OPTIONS = ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating'];

function toDeadlineISO(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = new Date(`${trimmed}T23:59:59`);
  return isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function toDateInputValue(iso?: string | null): string {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

const QUESTION_TYPE_OPTIONS: { value: QuizQuestion['type']; label: string }[] = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'identification', label: 'Identification' },
];

function typeLabel(t: string) {
  return t === 'multiple_choice'
    ? 'Multiple Choice'
    : t === 'true_false'
      ? 'True / False'
      : t === 'identification'
        ? 'Identification'
        : 'Short Answer';
}

const AI_DEFAULT_QUIZ_DESCRIPTION = "Automated Bloom's Taxonomy Quiz generated via Groq Inference (GPT-OSS-120B).";

function cleanQuizDescription(desc: string): string {
  return desc.replace(AI_DEFAULT_QUIZ_DESCRIPTION, '').trim();
}

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16 },
  bannerTitle: { fontSize: 16, fontWeight: '800' },
  resumeBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  filterBlock: { gap: 12 },
  toolbarRow: { flexDirection: 'row', gap: 10 },
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  allTab: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  subjectDrop: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  pickerItem: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1 },
  filterChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  quizTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  quizTopActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },
  retakeChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99 },
  downloadBtn: { padding: 6, borderRadius: 10, borderWidth: 1 },
  quizTitle: { fontSize: 15, fontWeight: '800' },
  quizMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quizActions: { flexDirection: 'row', gap: 10 },
  previewQ: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
  pubBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  playerWrap: { padding: 16, paddingBottom: 40, gap: 18 },
  playerHead: { gap: 10 },
  playerMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  questionBlock: { gap: 16 },
  questionTop: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  questionText: { fontSize: 23, fontWeight: '800', lineHeight: 31 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 2, padding: 15 },
  answerInput: { borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 15, fontWeight: '600' },
  hintZone: { minHeight: 40, justifyContent: 'center' },
  hintBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, borderWidth: 1, padding: 10 },
  hintBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  playerNav: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navCircle: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  exitBtn: { borderRadius: 10, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 12 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20 },
  resultWrap: { padding: 20, paddingBottom: 40, alignItems: 'center', gap: 8 },
  resultIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  resultTitle: { fontSize: 26, fontWeight: '900' },
  resultScore: { fontSize: 30, fontWeight: '900' },
  resultPctBadge: { borderRadius: 99, paddingHorizontal: 16, paddingVertical: 5, marginTop: 4 },
  resultActions: { flexDirection: 'row', gap: 10, marginTop: 18, width: '100%' },
  feedbackCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 5 },
  feedbackHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
});

