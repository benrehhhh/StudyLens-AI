import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { authFetch } from "../../../utils/authFetch";
import type { Quiz, QuizQuestion, QuizAttempt, Subject } from "../../../types";
import {
  FIXED_PASS_PERCENTAGE,
  FIXED_DIFFICULTY,
  toLocalInputValue,
  isQuizOverdue,
  normalizeQuestionForEdit,
  validateQuizQuestion,
  type SavedQuizProgress,
} from "./assessmentUtils";

export function useAssessmentPage() {
  const { currentUser } = useAuth();
  const canManageCourseQuizzes = currentUser?.role === "teacher";
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuizId = searchParams.get("quizId");
  const returnTo = searchParams.get("returnTo");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);

  // Filter Tab & Subject State
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("all");
  const [quizPage, setQuizPage] = useState(1);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuizPage(1);
  }, [selectedSubjectFilter]);

  // Unified Quiz Creator (shared with the Subject page) — course quizzes for teachers.
  // Create Quiz Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);


  // Quiz Deletion Modal
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null);

  // Quiz Preview Modal (read-only view of a quiz's contents)
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);

  // Assign Subject Modal State (teacher quizzes, mirroring Upload & Manage Materials)
  const [assignQuiz, setAssignQuiz] = useState<Quiz | null>(null);
  const [assignQuizSubjectId, setAssignQuizSubjectId] = useState("");
  const [isAssigningQuizSubject, setIsAssigningQuizSubject] = useState(false);
  const [assignQuizMsg, setAssignQuizMsg] = useState<string | null>(null);

  // Edit Quiz Modal
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [editDiscardOpen, setEditDiscardOpen] = useState(false);
  const [editDirty, setEditDirty] = useState(false);
  const editPendingRef = useRef<(() => void) | null>(null);
  const markEditDirty = useCallback(() => setEditDirty(true), []);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSubjectId, setEditSubjectId] = useState("");
  const [editQuizType, setEditQuizType] = useState<"teacher" | "student">("teacher");
  const [editTimeLimit, setEditTimeLimit] = useState<number>(15);
  const [editLimitAttempts, setEditLimitAttempts] = useState(false);
  const [editAttempts, setEditAttempts] = useState<number>(3);
  const [editRevealAnswers, setEditRevealAnswers] = useState(true);
  const [editDeadline, setEditDeadline] = useState<string>("");
  const [editQuestions, setEditQuestions] = useState<QuizQuestion[]>([]);
  const editQuestionListRef = useRef<HTMLDivElement>(null);
  const editPromptRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [editScrollTick, setEditScrollTick] = useState(0);

  // When a question is added via "Add Question", scroll the list to the new card and
  // focus its prompt so the next one can be typed immediately.
  useEffect(() => {
    if (editScrollTick === 0) return;
    const el = editQuestionListRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    const prompts = editPromptRefs.current;
    prompts[prompts.length - 1]?.focus();
  }, [editScrollTick]);

  // Active Quiz Taking State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, unknown>>({});
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60); // 15 mins in seconds
  const [targetEndTime, setTargetEndTime] = useState<number | null>(null);
  const autoSubmitFiredRef = useRef(false);
  const [hintsByQuestion, setHintsByQuestion] = useState<Record<string, string>>({});
  const [hintErrorsByQuestion, setHintErrorsByQuestion] = useState<Record<string, string>>({});
  const [hintLoadingFor, setHintLoadingFor] = useState<string | null>(null);

  // Saved Progresses Map (quizId -> SavedQuizProgress) initialized lazily from localStorage
  const [savedProgresses, setSavedProgresses] = useState<Record<string, SavedQuizProgress>>(() => {
    if (typeof window === "undefined") return {};
    const userId = currentUser?.id || "guest";
    const map: Record<string, SavedQuizProgress> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`studylens_quiz_progress_${userId}_`)) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const parsed = JSON.parse(item) as SavedQuizProgress;
            map[parsed.quizId] = parsed;
          }
        } catch (e) {
          console.error("Error reading quiz progress from localStorage:", e);
        }
      }
    }
    return map;
  });

  // Completed Attempt State
  const [completedAttempt, setCompletedAttempt] = useState<QuizAttempt | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleStartQuiz = useCallback((quiz: Quiz, resume = false) => {
    if (!resume && currentUser?.role !== "teacher" && currentUser?.role !== "admin" && quiz.isPublished === false) {
      showToast("This quiz has not been published yet and is not available to students.", "info");
      return;
    }
    const quizAttemptsAllowed = quiz.attemptsAllowed || 0;
    if (quiz.quizType !== "student" && quizAttemptsAllowed > 0 && (quiz.attemptsUsed || 0) >= quizAttemptsAllowed) {
      showToast("You have reached the maximum number of attempts allowed for this quiz.", "error");
      return;
    }
    if (currentUser?.role === "student" && isQuizOverdue(quiz)) {
      showToast("The deadline for this quiz has passed. It has been recorded as Missing.", "error");
      return;
    }
    autoSubmitFiredRef.current = false;
    const userId = currentUser?.id || "guest";
    const storageKey = `studylens_quiz_progress_${userId}_${quiz.id}`;
    const saved = savedProgresses[quiz.id];

    if (resume && saved) {
      setActiveQuiz(saved.savedQuiz || quiz);
      setCurrentQIndex(saved.currentQIndex || 0);
      setUserAnswers(saved.userAnswers || {});

      let endTime = saved.targetEndTime;
      if (!endTime) {
        endTime = Date.now() + (saved.timeLeft ?? (quiz.timeLimitMinutes || 15) * 60) * 1000;
      }

      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTargetEndTime(endTime);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        showToast("The time limit for this quiz has expired while away! Automatically calculating your score now...", "info");
      }
    } else {
      // Starting fresh - clear previous saved progress for this quiz
      localStorage.removeItem(storageKey);
      setSavedProgresses((prev) => {
        const copy = { ...prev };
        delete copy[quiz.id];
        return copy;
      });

      const durationSeconds = (quiz.timeLimitMinutes || 15) * 60;
      const endTime = Date.now() + durationSeconds * 1000;

      setActiveQuiz(quiz);
      setCurrentQIndex(0);
      setUserAnswers({});
      setTargetEndTime(endTime);
      setTimeLeft(durationSeconds);
    }

    setCompletedAttempt(null);
    setHintsByQuestion({});
    setHintErrorsByQuestion({});
    setHintLoadingFor(null);
    setSubmitError(null);
  }, [currentUser, showToast, savedProgresses]);

  // Fetch Quizzes and Subjects
  useEffect(() => {
    let isSubscribed = true;
    const fetchCatalogData = async () => {
      try {
        const [qRes, sRes] = await Promise.all([
          authFetch(`/api/quizzes?studentId=${currentUser?.id || ""}&userRole=${currentUser?.role || ""}`),
          authFetch("/api/subjects"),
        ]);
        if (qRes.ok && isSubscribed) {
          const qData = await qRes.json();
          setQuizzes(qData);
          if (initialQuizId) {
            const target = qData.find((q: Quiz) => q.id === initialQuizId);
            if (target) {
              // Route through the same entry path as a manual open so the real
              // time limit applies and the countdown actually starts.
              handleStartQuiz(target);
            }
          }
        }
        if (sRes.ok && isSubscribed) {
          const sData = await sRes.json();
          setSubjects(sData);
        }
      } catch (err) {
        console.error("Fetch catalog data error:", err);
      }
    };

    fetchCatalogData();
    return () => {
      isSubscribed = false;
    };
  }, [currentUser?.id, currentUser?.role, initialQuizId, handleStartQuiz]);

  // Submit Quiz Handler
  const handleSubmitQuiz = useCallback(async () => {
    if (!activeQuiz) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const answersPayload = Object.entries(userAnswers).map(([questionId, answer]) => ({
      questionId,
      answer,
    }));

    try {
      const res = await authFetch(`/api/quizzes/${activeQuiz.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: currentUser?.id,
          studentName: currentUser?.name,
          answers: answersPayload,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setSubmitError(
          `Could not submit your assessment. ${data?.error || `Server returned status ${res.status}`}`
        );
        if (res.status === 409) {
          setQuizzes((prev) =>
            prev.map((q) =>
              q.id === activeQuiz.id
                ? { ...q, attemptsUsed: data?.attemptsUsed ?? q.attemptsUsed, attemptsAllowed: data?.attemptsAllowed ?? q.attemptsAllowed }
                : q
            )
          );
        }
        return;
      }

      const data = await res.json();

      // RESET / CLEAR SAVED PROGRESS FOR THIS QUIZ UPON COMPLETION
      const userId = currentUser?.id || "guest";
      const storageKey = `studylens_quiz_progress_${userId}_${activeQuiz.id}`;
      localStorage.removeItem(storageKey);
      setSavedProgresses((prev) => {
        const copy = { ...prev };
        delete copy[activeQuiz.id];
        return copy;
      });

      setCompletedAttempt(data.attempt);
      setQuizzes((prev) =>
        prev.map((q) =>
          q.id === activeQuiz.id
            ? {
                ...q,
                attemptsUsed: (q.attemptsUsed || 0) + 1,
                lastScoreRaw: data.attempt?.score ?? q.lastScoreRaw,
                lastMaxScore: data.attempt?.maxScore ?? data.attempt?.totalPoints ?? q.lastMaxScore,
                lastScore: data.attempt?.percentage ?? q.lastScore,
              }
            : q
        )
      );
    } catch (err) {
      console.error("Submit quiz error:", err);
      setSubmitError(`Could not submit your assessment. ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [activeQuiz, currentUser, userAnswers]);

  // Timer effect: remaining seconds are computed against targetEndTime so the
  // countdown keeps running even if the component re-renders.
  useEffect(() => {
    if (!activeQuiz || completedAttempt || !targetEndTime) return;

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((targetEndTime - now) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0 && !autoSubmitFiredRef.current) {
        autoSubmitFiredRef.current = true;
        showToast("Time ran out. Auto-submitting your quiz.", "info");
        handleSubmitQuiz();
      }
    };

    updateTimer(); // Run calculation immediately
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [activeQuiz, completedAttempt, targetEndTime, handleSubmitQuiz, showToast]);

  // Auto-Save Quiz Progress to localStorage whenever state changes while taking active quiz
  useEffect(() => {
    if (activeQuiz && !completedAttempt && targetEndTime) {
      const userId = currentUser?.id || "guest";
      const storageKey = `studylens_quiz_progress_${userId}_${activeQuiz.id}`;
      const progressData: SavedQuizProgress = {
        quizId: activeQuiz.id,
        quizTitle: activeQuiz.title,
        subjectName: activeQuiz.subjectName,
        currentQIndex,
        userAnswers,
        timeLeft,
        targetEndTime,
        totalQuestions: activeQuiz.questions.length,
        lastUpdated: Date.now(),
        savedQuiz: activeQuiz,
      };
      localStorage.setItem(storageKey, JSON.stringify(progressData));
    }
  }, [activeQuiz, currentQIndex, userAnswers, timeLeft, targetEndTime, completedAttempt, currentUser?.id]);

  const handleDiscardProgress = (quizId: string) => {
    const userId = currentUser?.id || "guest";
    const storageKey = `studylens_quiz_progress_${userId}_${quizId}`;
    localStorage.removeItem(storageKey);
    setSavedProgresses((prev) => {
      const copy = { ...prev };
      delete copy[quizId];
      return copy;
    });
  };

  const hintKeyFor = (questionId: string | undefined) =>
    `${activeQuiz?.id ?? "quiz"}:${questionId || currentQIndex}`;

  const clearHintFor = (key: string) => {
    setHintsByQuestion((prev) => {
      if (!(key in prev)) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    setHintErrorsByQuestion((prev) => {
      if (!(key in prev)) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleSelectAnswer = (qId: string, answer: unknown) => {
    clearHintFor(hintKeyFor(qId));
    setUserAnswers({ ...userAnswers, [qId]: answer });
  };

  const handleToggleMultiAnswer = (qId: string, optionIndex: number) => {
    const saved = userAnswers[qId];
    const current = Array.isArray(saved) ? (saved as number[]) : [];
    setUserAnswers({
      ...userAnswers,
      [qId]: current.includes(optionIndex)
        ? current.filter((i) => i !== optionIndex)
        : [...current, optionIndex],
    });
  };

  const handleFetchHint = async (question: QuizQuestion) => {
    const key = hintKeyFor(question.id);
    setHintLoadingFor(key);
    setHintErrorsByQuestion((prev) => {
      if (!(key in prev)) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });

    try {
      const res = await authFetch("/api/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.question,
          options: question.options || [],
          questionType: question.type,
          topicTag: question.topicTag,
        }),
      });
      if (!res.ok) {
        throw new Error(`Hint request failed with status ${res.status}`);
      }
      const data = await res.json();
      const hint = typeof data?.hint === "string" ? data.hint.trim() : "";
      if (!hint) {
        throw new Error("Hint response was empty");
      }
      setHintsByQuestion((prev) => ({ ...prev, [key]: hint }));
    } catch (err) {
      console.error("Fetch hint error:", err);
      setHintErrorsByQuestion((prev) => ({
        ...prev,
        [key]: "Could not generate a hint for this question right now. Please try again.",
      }));
    } finally {
      setHintLoadingFor((prev) => (prev === key ? null : prev));
    }
  };

  const handleOpenEditModal = (quiz: Quiz) => {
    setEditingQuiz(quiz);
    setEditTitle(quiz.title);
    setEditDescription(quiz.description || "");
    // Personal practice drills stay subjectless: never silently assign one.
    setEditSubjectId(quiz.quizType === "student" ? quiz.subjectId || "" : quiz.subjectId || (subjects[0] ? subjects[0].id : "sub-101"));
    setEditQuizType(quiz.quizType || "teacher");
    setEditTimeLimit(quiz.timeLimitMinutes || 15);
    setEditLimitAttempts((quiz.attemptsAllowed || 0) > 0);
    setEditAttempts(quiz.attemptsAllowed || 3);
    setEditRevealAnswers(quiz.revealAnswers !== false);
    setEditDeadline(toLocalInputValue(quiz.deadline));
    setEditQuestions((quiz.questions || []).map(normalizeQuestionForEdit));
  };

  const handleSaveEditQuiz = async () => {
    if (!editingQuiz) return;
    for (let i = 0; i < editQuestions.length; i++) {
      const error = validateQuizQuestion(editQuestions[i], { requireAllOptions: true });
      if (error) {
        showToast(`Question ${i + 1}: ${error}`, "error");
        return;
      }
    }
    try {
      // Practice drills cannot move subjects or change scope: omit those keys
      // entirely so the backend ownership guard accepts the update.
      const isPractice = editingQuiz.quizType === "student";
      const selectedSubject = subjects.find((s) => s.id === editSubjectId);
      const res = await authFetch(`/api/quizzes/${editingQuiz.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          ...(isPractice
            ? {}
            : {
                subjectId: editSubjectId,
                subjectName: selectedSubject ? `${selectedSubject.code} - ${selectedSubject.name}` : editingQuiz.subjectName,
                quizType: editQuizType,
              }),
          timeLimitMinutes: editTimeLimit,
          passPercentage: FIXED_PASS_PERCENTAGE,
          difficulty: FIXED_DIFFICULTY,
          attemptsAllowed: editLimitAttempts ? editAttempts : 0,
          revealAnswers: editRevealAnswers,
          deadline: editDeadline ? new Date(editDeadline).toISOString() : null,
          questions: editQuestions,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setQuizzes((prev) => prev.map((q) => (q.id === editingQuiz.id ? updated : q)));
        setEditingQuiz(null);
      } else {
        const body = await res.json().catch(() => null);
        showToast(typeof body?.error === "string" ? body.error : "Could not save the quiz changes. Please try again.", "error");
      }
    } catch (err) {
      console.error("Save edit quiz error:", err);
    }
  };

  const confirmEditDiscard = useCallback(() => {
    const after = editPendingRef.current;
    editPendingRef.current = null;
    setEditDiscardOpen(false);
    setEditingQuiz(null);
    after?.();
  }, []);

  const cancelEditDiscard = useCallback(() => {
    editPendingRef.current = null;
    setEditDiscardOpen(false);
  }, []);

  const requestCloseEdit = useCallback((afterClose?: () => void) => {
    if (editDirty) {
      editPendingRef.current = afterClose ?? null;
      setEditDiscardOpen(true);
      return;
    }
    setEditingQuiz(null);
    afterClose?.();
  }, [editDirty]);

  // Escape key closes the discard dialog, or the whole modal when clean.
  useEffect(() => {
    if (!editingQuiz) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (editDiscardOpen) { setEditDiscardOpen(false); return; }
      requestCloseEdit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingQuiz, editDiscardOpen, requestCloseEdit]);

  // Native unsaved-changes prompt on browser refresh / close tab.
  useEffect(() => {
    if (!editingQuiz || !editDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [editingQuiz, editDirty]);

  const handleTogglePublish = async (quiz: Quiz) => {
    const publish = !quiz.isPublished;
    if (publish && !quiz.subjectId) {
      openAssignQuizSubject(quiz, "Assign this quiz to a subject before publishing it.");
      return;
    }
    try {
      const res = await authFetch(`/api/quizzes/${quiz.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: publish }),
      });
      if (res.ok) {
        setQuizzes((prev) =>
          prev.map((q) => (q.id === quiz.id ? { ...q, isPublished: publish } : q))
        );
        showToast(publish ? "Quiz published." : "Quiz unpublished.");
      } else {
        const body = await res.json().catch(() => null);
        showToast(typeof body?.error === "string" ? body.error : "Could not update the quiz.", "error");
      }
    } catch (err) {
      console.error("Toggle publish error:", err);
    }
  };

  const openAssignQuizSubject = (quiz: Quiz, msg?: string | null) => {
    setAssignQuiz(quiz);
    setAssignQuizSubjectId(quiz.subjectId && quiz.subjectId !== "" && quiz.subjectId !== "personal" ? quiz.subjectId : "");
    setAssignQuizMsg(msg ?? null);
  };

  const handleAssignQuizSubject = async () => {
    if (!assignQuiz || !assignQuizSubjectId) {
      setAssignQuizMsg("Please select an assigned subject.");
      return;
    }
    setIsAssigningQuizSubject(true);
    setAssignQuizMsg(null);
    try {
      const selectedSubject = subjects.find((s) => s.id === assignQuizSubjectId);
      const res = await authFetch(`/api/quizzes/${assignQuiz.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: assignQuizSubjectId,
          subjectName: selectedSubject ? `${selectedSubject.code} - ${selectedSubject.name}` : assignQuiz.subjectName,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setQuizzes((prev) => prev.map((q) => (q.id === assignQuiz.id ? updated : q)));
        setAssignQuiz(null);
        showToast("Subject assigned to quiz.");
      } else {
        const body = await res.json().catch(() => ({}));
        showToast(typeof body?.error === "string" ? body.error : "Could not assign the subject. Please try again.", "error");
      }
    } catch {
      showToast("Could not assign the subject. Please try again.", "error");
    } finally {
      setIsAssigningQuizSubject(false);
    }
  };

  const handleConfirmDeleteQuiz = async () => {
    if (!quizToDelete) return;
    try {
      const res = await authFetch(`/api/quizzes/${quizToDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        setQuizzes((prev) => prev.filter((q) => q.id !== quizToDelete.id));
        const userId = currentUser?.id || "guest";
        localStorage.removeItem(`studylens_quiz_progress_${userId}_${quizToDelete.id}`);
        setSavedProgresses((prev) => {
          const copy = { ...prev };
          delete copy[quizToDelete.id];
          return copy;
        });
        showToast("Quiz deleted.");
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData?.error || "Could not delete the quiz. Please try again.", "error");
      }
    } catch (err) {
      console.error("Delete quiz error:", err);
      showToast("Could not delete the quiz. Please try again.", "error");
    } finally {
      setQuizToDelete(null);
    }
  };

  const handleQuizCreated = (saved: Quiz) => {
    setQuizzes((prev) => [saved, ...prev]);
  };

  // Filter Quizzes according to Privacy Rule and Subject selection
  const visibleQuizzes = quizzes.filter((q) => {
    // Unpublished quizzes are hidden from students entirely (staff still see them).
    if (q.isPublished === false && currentUser?.role !== "teacher" && currentUser?.role !== "admin") return false;
    if (selectedSubjectFilter !== "all" && q.subjectId !== selectedSubjectFilter) return false;
    return true;
  });

  return {
    currentUser,
    canManageCourseQuizzes,
    navigate,
    returnTo,
    quizzes,
    subjects,
    activeQuiz,
    setActiveQuiz,
    selectedSubjectFilter,
    setSelectedSubjectFilter,
    quizPage,
    setQuizPage,
    showCreateModal,
    setShowCreateModal,
    quizToDelete,
    setQuizToDelete,
    previewQuiz,
    setPreviewQuiz,
    assignQuiz,
    setAssignQuiz,
    assignQuizSubjectId,
    setAssignQuizSubjectId,
    isAssigningQuizSubject,
    assignQuizMsg,
    editingQuiz,
    editDiscardOpen,
    editDirty,
    editTitle,
    setEditTitle,
    editDescription,
    setEditDescription,
    editSubjectId,
    setEditSubjectId,
    editQuizType,
    setEditQuizType,
    editTimeLimit,
    setEditTimeLimit,
    editLimitAttempts,
    setEditLimitAttempts,
    editAttempts,
    setEditAttempts,
    editRevealAnswers,
    setEditRevealAnswers,
    editDeadline,
    setEditDeadline,
    editQuestions,
    setEditQuestions,
    editQuestionListRef,
    editPromptRefs,
    editScrollTick,
    setEditScrollTick,
    markEditDirty,
    currentQIndex,
    setCurrentQIndex,
    userAnswers,
    timeLeft,
    hintsByQuestion,
    hintErrorsByQuestion,
    hintLoadingFor,
    savedProgresses,
    completedAttempt,
    setCompletedAttempt,
    isSubmitting,
    submitError,
    setSubmitError,
    handleSubmitQuiz,
    handleStartQuiz,
    handleDiscardProgress,
    clearHintFor,
    handleSelectAnswer,
    handleToggleMultiAnswer,
    handleFetchHint,
    handleOpenEditModal,
    handleSaveEditQuiz,
    confirmEditDiscard,
    cancelEditDiscard,
    requestCloseEdit,
    handleTogglePublish,
    openAssignQuizSubject,
    handleAssignQuizSubject,
    handleConfirmDeleteQuiz,
    handleQuizCreated,
    visibleQuizzes,
  };
}

export type AssessmentPageState = ReturnType<typeof useAssessmentPage>;
