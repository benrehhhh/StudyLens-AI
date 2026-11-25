import { CheckSquare, Plus, Play, RotateCcw, Sparkles } from "lucide-react";
import type { Quiz, Subject, User } from "../../../types";
import { Pagination, slicePage } from "../../../components/Pagination";
import { QuizCatalogCard } from "./QuizCatalogCard";
import type { SavedQuizProgress } from "./assessmentUtils";

interface AssessmentCatalogProps {
  quizzes: Quiz[];
  subjects: Subject[];
  selectedSubjectFilter: string;
  onSubjectFilterChange: (value: string) => void;
  quizPage: number;
  onPageChange: (page: number) => void;
  visibleQuizzes: Quiz[];
  savedProgresses: Record<string, SavedQuizProgress>;
  currentUser: User | null;
  onShowCreate: () => void;
  onNavigateAi: () => void;
  onPreview: (quiz: Quiz) => void;
  onStartQuiz: (quiz: Quiz, resume?: boolean) => void;
  onDiscardProgress: (quizId: string) => void;
  onTogglePublish: (quiz: Quiz) => void;
  onOpenAssignSubject: (quiz: Quiz) => void;
  onOpenEdit: (quiz: Quiz) => void;
  onRequestDelete: (quiz: Quiz) => void;
}

export function AssessmentCatalog({
  quizzes,
  subjects,
  selectedSubjectFilter,
  onSubjectFilterChange,
  quizPage,
  onPageChange,
  visibleQuizzes,
  savedProgresses,
  currentUser,
  onShowCreate,
  onNavigateAi,
  onPreview,
  onStartQuiz,
  onDiscardProgress,
  onTogglePublish,
  onOpenAssignSubject,
  onOpenEdit,
  onRequestDelete,
}: AssessmentCatalogProps) {
  const firstSaved = Object.values(savedProgresses)[0];

  return (
    <div className="space-y-6">
      {/* Unfinished Quiz Resume Alert Banner */}
      {Object.keys(savedProgresses).length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground mt-0.5">
                {firstSaved.quizTitle} ({firstSaved.subjectName})
              </p>
              <p className="text-xs text-muted-foreground">
                Stopped at Question {firstSaved.currentQIndex + 1} of {firstSaved.totalQuestions} ({Object.keys(firstSaved.userAnswers || {}).length} answered)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-center">
            {/* Resolve the saved quiz to check whether it is a personal/practice quiz. */}
            {(() => {
              const foundQuiz = quizzes.find((q) => q.id === firstSaved.quizId) || firstSaved.savedQuiz;
              const isPracticeQuiz = Boolean(foundQuiz && foundQuiz.quizType === 'student' && foundQuiz.createdById === currentUser?.id);
              return (
                <>
                  <button
                    onClick={() => {
                      if (foundQuiz) onStartQuiz(foundQuiz, true);
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-sm cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Resume Quiz</span>
                  </button>
                  {isPracticeQuiz && (
                    <button
                      onClick={() => onDiscardProgress(firstSaved.quizId)}
                      className="px-3 py-2 bg-muted hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Discard
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Quiz Type Tabs & Subject Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border w-fit max-w-full overflow-x-auto shrink-0">
            <span className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap bg-card text-foreground shadow-xs border border-border">
              All Quizzes ({quizzes.length})
            </span>
          </div>

          {/* Subject Filter Dropdown */}
          <div className="flex items-center space-x-1 pl-2 border-l border-border">
            <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">Subject:</span>
            <select
              value={selectedSubjectFilter}
              onChange={(e) => onSubjectFilterChange(e.target.value)}
              className="px-3 py-1.5 bg-card border border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Subjects Filter</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code} - {sub.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={onShowCreate}
            className="px-3.5 py-2.5 bg-structure hover:bg-structure-strong text-structure-foreground rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Quiz</span>
          </button>

          <button
            onClick={onNavigateAi}
            className="px-4 py-2.5 bg-cta-gradient hover:brightness-110 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>AI Quiz Generator</span>
          </button>
        </div>
      </div>

      {/* Quizzes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleQuizzes.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-card border border-border rounded-2xl p-6">
            <CheckSquare className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-40" />
            <h3 className="text-sm font-bold text-foreground">No assessments match your criteria</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Try switching subject filters or quiz tabs, or create a new assessment above.
            </p>
          </div>
        ) : (
          slicePage(visibleQuizzes, quizPage).map((quiz) => (
            <QuizCatalogCard
              key={quiz.id}
              quiz={quiz}
              saved={savedProgresses[quiz.id]}
              currentUser={currentUser}
              onPreview={onPreview}
              onStartQuiz={onStartQuiz}
              onTogglePublish={onTogglePublish}
              onOpenAssignSubject={onOpenAssignSubject}
              onOpenEdit={onOpenEdit}
              onRequestDelete={onRequestDelete}
            />
          ))
        )}
      </div>
      <Pagination
        page={quizPage}
        total={visibleQuizzes.length}
        onPageChange={onPageChange}
      />
    </div>
  );
}
