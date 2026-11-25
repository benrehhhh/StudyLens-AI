export type UserRole = "student" | "teacher" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  department?: string;
  studentId?: string;
  status?: "active" | "suspended";
  createdAt: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  description: string;
  teacherId: string;
  teacherName: string;
  teacherAvatar?: string | null;
  teacherDepartment?: string | null;
  studentCount: number;
  materialCount: number;
  semester?: string;
  course?: string;
  schoolYear?: string;
  createdAt: string;
}

export interface LearningMaterial {
  id: string;
  title: string;
  description: string;
  /** Null until a teacher files the material under a subject (AI resources and
   *  personal notes are subjectless by design). */
  subjectId: string | null;
  subjectName: string;
  /** `ai-summary` / `ai-reviewer` / `ai-flashcards` are generated resources with
   *  no uploaded file - the generated content itself is the document. Other
   *  values mirror the uploaded file's extension (pdf, pptx, docx, txt, ...). */
  fileType: string;
  fileUrl?: string;
  fileSize?: string;
  extractedText: string;
  uploadedBy: string;
  uploaderRole: UserRole;
  uploaderId?: string;
  materialType?: "course" | "personal";
  createdAt: string;
}

export interface MaterialFlag {
  id: string;
  materialId: string;
  materialTitle: string;
  subjectId?: string | null;
  subjectName?: string | null;
  flaggedById: string;
  flaggedByName?: string | null;
  category: string;
  note?: string | null;
  status: "pending" | "resolved";
  createdAt: string;
  resolvedAt?: string | null;
  resolvedById?: string | null;
  resolvedByName?: string | null;
  resolutionNote?: string | null;
}

export type BloomsTaxonomy =
  | "Remembering"
  | "Understanding"
  | "Applying"
  | "Analyzing"
  | "Evaluating"
  | "Creating";

export type QuestionType =
  | "multiple_choice"
  | "true_false"
  | "identification"
  | "short_answer";

export type DifficultyLevel = "easy" | "medium" | "hard";

export interface QuizQuestion {
  id: string;
  question: string;
  type: QuestionType;
  options?: string[];
  correctAnswer: string | number | number[]; // index (or text for identification); array = multiple correct options
  explanation: string;
  bloomsLevel: BloomsTaxonomy;
  difficulty: DifficultyLevel;
  topicTag: string;
  isNew?: boolean; // flagged on questions added in a follow-up "add more" turn
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  subjectId: string;
  subjectName: string;
  materialId?: string;
  createdById: string;
  createdByName: string;
  quizType?: "teacher" | "student";
  questions: QuizQuestion[];
  instructions?: string | null;
  isPublished: boolean;
  timeLimitMinutes?: number;
  passPercentage: number;
  difficulty: DifficultyLevel;
  attemptsAllowed?: number; // 0 = unlimited (default)
  attemptsUsed?: number; // student requester only, from quiz list
  lastScore?: number; // latest attempt percentage (student requester only)
  bestScore?: number; // highest attempt percentage (student requester only)
  lastScoreRaw?: number; // latest attempt raw score (student requester only)
  lastMaxScore?: number; // latest attempt max score (student requester only)
  revealAnswers?: boolean; // teacher toggle: students can see correct answers
  deadline?: string | null; // ISO timestamp: submissions blocked after this
  createdAt: string;
}

export interface QuizAnswerSubmission {
  questionId: string;
  userAnswer: string | number;
  isCorrect: boolean;
}

export interface QuizFeedbackItem {
  questionId: string;
  question: string;
  options?: (string | number)[];
  userAnswer?: string | number | null;
  correctAnswer?: string | number | (string | number)[] | null;
  isCorrect: boolean;
  explanation?: string;
  topic?: string;
  bloomsLevel?: string;
  difficulty?: string;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  quizTitle: string;
  studentId: string;
  studentName: string;
  subjectId: string;
  subjectName: string;
  score: number;
  maxScore: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  answers: QuizAnswerSubmission[];
  feedback?: QuizFeedbackItem[];
  weakTopics: string[];
  strongTopics: string[];
  submittedAt: string;
  completedAt: string;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  topicTag: string;
  difficulty: DifficultyLevel;
}

export interface FlashcardDeck {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  materialId?: string;
  cards: Flashcard[];
  isPublished: boolean;
  createdById: string;
  createdAt: string;
}

export interface Summary {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  materialId?: string;
  executiveSummary: string;
  keyTakeaways: string[];
  bulletPoints: string[];
  createdById: string;
  createdAt: string;
}

export interface ReviewerTopic {
  topic: string;
  overview: string;
  keyConcepts: string[];
  formulasOrRules?: string[];
  sampleQuestions: { question: string; answer: string }[];
}

export interface Reviewer {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  materialId?: string;
  overview: string;
  topics: ReviewerTopic[];
  createdById: string;
  createdAt: string;
}

export interface TopicPerformance {
  topic: string;
  totalQuestions: number;
  correctAnswers: number;
  accuracyPercentage: number;
}

export interface MasteredTopic {
  topic: string;
  currentAccuracy: number;
  improvedFrom?: number | null;
}

export interface StudentProgress {
  studentId: string;
  totalQuizzesTaken: number;
  averageScore: number;
  totalPersonalMaterialsUploaded: number;
  totalFlashcardDecksGenerated: number;
  topicPerformances: TopicPerformance[];
  weakTopics: string[];
  strongTopics: string[];
  masteredTopics?: MasteredTopic[];
  recentQuizAttempts: QuizAttempt[];
}

export interface SubjectStudentGrade {
  studentId: string;
  studentName: string;
  attemptCount: number;
  averagePercentage: number;
  attempts: QuizAttempt[];
}

export interface SubjectGrades {
  subjectId: string;
  subjectName: string;
  studentId?: string;
  studentName?: string;
  attemptCount?: number;
  averagePercentage?: number;
  attempts?: QuizAttempt[];
  students?: SubjectStudentGrade[];
}

export interface RecommendationStep {
  step: number;
  type: "review" | "flashcard" | "reviewer" | "quiz" | "summary";
  title: string;
  targetId: string | null;
  difficultyTarget: DifficultyLevel;
}

export interface Recommendation {
  id: string;
  studentId: string;
  weakTopic: string;
  recommendationType: "reviewer" | "flashcard" | "quiz" | "summary";
  title: string;
  description: string;
  targetId: string; // quizId or reviewerId or deckId
  difficultyTarget: DifficultyLevel;
  accuracyPercentage?: number | null;
  steps?: RecommendationStep[];
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorName: string;
  targetAudience: "all" | "students" | "teachers";
  priority: "low" | "medium" | "high";
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
  ipAddress?: string;
  device?: string;
  browser?: string;
  timestamp: string;
}

export interface GeneratedReport {
  id: string;
  generatedBy: string;
  reportType: "Student Performance" | "Quiz Analytics" | "Subject Summary" | "AI Usage";
  generatedAt: string;
  title: string;
  targetId?: string | null;
  summary?: Record<string, unknown> | null;
}
