import { CheckSquare, Clock, X } from "lucide-react";
import type { Quiz, QuizQuestion } from "../../../types";
import { CORRECT_ANSWER_CARD_CLASS, formatTime } from "./assessmentUtils";

interface ActiveQuizViewProps {
  activeQuiz: Quiz;
  currentQIndex: number;
  userAnswers: Record<string, unknown>;
  timeLeft: number;
  hintsByQuestion: Record<string, string>;
  hintErrorsByQuestion: Record<string, string>;
  hintLoadingFor: string | null;
  submitError: string | null;
  isSubmitting: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
  onSelectAnswer: (qId: string, answer: unknown) => void;
  onToggleMultiAnswer: (qId: string, optionIndex: number) => void;
  onClearHint: (key: string) => void;
  onFetchHint: (question: QuizQuestion) => void;
}

export function ActiveQuizView({
  activeQuiz,
  currentQIndex,
  userAnswers,
  timeLeft,
  hintsByQuestion,
  hintErrorsByQuestion,
  hintLoadingFor,
  submitError,
  isSubmitting,
  onPrevious,
  onNext,
  onSubmit,
  onSelectAnswer,
  onToggleMultiAnswer,
  onClearHint,
  onFetchHint,
}: ActiveQuizViewProps) {
  const isTeacherQuiz = (activeQuiz.quizType || (activeQuiz.createdById?.startsWith("usr-teacher") ? "teacher" : "student")) === "teacher";
  const currentQuestion = activeQuiz.questions[currentQIndex];
  const currentHintKey = currentQuestion
    ? `${activeQuiz.id}:${currentQuestion.id || currentQIndex}`
    : "";
  const currentHint = currentHintKey ? hintsByQuestion[currentHintKey] : undefined;
  const currentHintError = currentHintKey ? hintErrorsByQuestion[currentHintKey] : undefined;
  const isCurrentHintLoading = currentHintKey !== "" && hintLoadingFor === currentHintKey;

  return (
    <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden space-y-0">
      {/* Top Header Bar */}
      <div className="bg-card border-b border-border p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 bg-structure text-structure-foreground rounded-md text-[10px] font-bold uppercase tracking-wider">
              {activeQuiz.subjectName}
            </span>
          </div>
          <h2 className="text-lg font-bold mt-1 text-foreground">{activeQuiz.title}</h2>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 px-3.5 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl font-mono text-base font-bold border border-amber-500/30">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>{formatTime(timeLeft)}</span>
          </div>
        </div>
      </div>

      {/* Question Stepper Progress Bar */}
      <div className="w-full bg-muted h-1.5">
        <div
          className="bg-primary h-full transition-all duration-300"
          style={{
            width: `${((currentQIndex + 1) / activeQuiz.questions.length) * 100}%`,
          }}
        ></div>
      </div>

      {/* Active Question Body */}
      <div className="p-6 space-y-6">
        {activeQuiz.questions[currentQIndex] && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-bold text-foreground">
                Question {currentQIndex + 1} of {activeQuiz.questions.length}
              </span>
            </div>

            <h3 className="text-base font-bold text-foreground">
              {activeQuiz.questions[currentQIndex].question}
            </h3>

            {/* Question Options */}
            {Array.isArray(activeQuiz.questions[currentQIndex].correctAnswer) && (
              <p className="text-[11px] font-bold text-primary dark:text-indigo-300 flex items-center space-x-1.5">
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Select all correct answers that apply.</span>
              </p>
            )}
            {activeQuiz.questions[currentQIndex].options &&
            activeQuiz.questions[currentQIndex].options!.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {activeQuiz.questions[currentQIndex].options!.map((opt, oIdx) => {
                  const q = activeQuiz.questions[currentQIndex];
                  const isMulti = Array.isArray(q.correctAnswer);
                  const saved = userAnswers[q.id];
                  const isSelected = isMulti
                    ? Array.isArray(saved) && (saved as number[]).includes(oIdx)
                    : saved === oIdx;
                  return (
                    <button
                      key={oIdx}
                      onClick={() => {
                        if (isMulti) {
                          onToggleMultiAnswer(q.id, oIdx);
                        } else {
                          onSelectAnswer(q.id, oIdx);
                        }
                      }}
                      className={`p-3.5 rounded-xl border text-left text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? CORRECT_ANSWER_CARD_CLASS
                          : "bg-muted/40 border-border text-foreground hover:bg-muted"
                      }`}
                    >
                      <span>
                        <span className="font-bold mr-2">{String.fromCharCode(65 + oIdx)}.</span>
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="pt-2">
                <textarea
                  rows={3}
                  value={(userAnswers[activeQuiz.questions[currentQIndex].id] as string) || ""}
                  onChange={(e) =>
                    onSelectAnswer(activeQuiz.questions[currentQIndex].id, e.target.value)
                  }
                  placeholder="Type your open answer here..."
                  className="w-full p-3 border border-border bg-muted/30 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            {/* Study Hint Section - DISABLED FOR TEACHER QUIZZES */}
            <div className="pt-2">
              {!isTeacherQuiz && currentHint ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-200 space-y-1">
                  <span className="font-bold flex items-center justify-between gap-2 text-amber-600 dark:text-amber-400">
                    <span>Study Hint</span>
                    <button
                      type="button"
                      onClick={() => onClearHint(currentHintKey)}
                      aria-label="Dismiss hint"
                      className="p-0.5 rounded hover:bg-amber-500/20 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                  <p className="leading-relaxed">{currentHint}</p>
                </div>
              ) : !isTeacherQuiz ? (
                <div className="space-y-1">
                  <button
                    onClick={() => currentQuestion && onFetchHint(currentQuestion)}
                    disabled={isCurrentHintLoading}
                    className="px-3 py-1.5 bg-muted hover:bg-amber-500/10 text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <span>{isCurrentHintLoading ? "Fetching hint..." : "Get a hint"}</span>
                  </button>
                  {currentHintError && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 leading-relaxed">
                      {currentHintError}
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {submitError && (
          <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
            {submitError}
          </div>
        )}

        {/* Stepper Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <button
            onClick={onPrevious}
            disabled={currentQIndex === 0}
            className="px-4 py-2 border border-border text-foreground rounded-xl text-xs font-bold disabled:opacity-40 cursor-pointer"
          >
            Previous
          </button>

          {currentQIndex < activeQuiz.questions.length - 1 ? (
            <button
              onClick={onNext}
              className="px-5 py-2 bg-cta-gradient hover:brightness-110 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              Next Question →
            </button>
          ) : (
            <button
              onClick={onSubmit}
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              {isSubmitting ? "Submitting..." : "Submit Assessment"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
