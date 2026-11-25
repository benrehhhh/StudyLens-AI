export type UserRole = 'student' | 'teacher' | 'admin';
export type AssessmentType = 'multiple_choice' | 'true_false' | 'identification' | 'short_answer';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface User {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  roleId?: number;
  avatar?: string | null;
  department?: string;
  studentId?: string;
  status?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  description?: string;
  teacherId: string;
  teacherName: string;
  teacherDepartment?: string;
  semester?: string;
  course?: string;
  schoolYear?: string;
  studentCount: number;
  materialCount: number;
  createdAt: string;
}

export interface Material {
  id: string;
  title: string;
  description?: string;
  /** Null until a teacher files the material under a subject (AI resources and
   *  personal notes are subjectless by design). */
  subjectId: string | null;
  subjectName?: string;
  /** `ai-summary` / `ai-reviewer` / `ai-flashcards` are generated resources with
   *  no uploaded file - the generated content itself is the document. */
  fileType: string;
  fileUrl?: string;
  fileSize?: string;
  extractedText?: string;
  uploadedBy: string;
  uploaderRole: string;
  uploaderId?: string;
  materialType?: string;
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  type: AssessmentType;
  options?: string[];
  correctAnswer: number | string | number[];
  explanation?: string;
  bloomsLevel?: string;
  difficulty: DifficultyLevel;
  topicTag?: string;
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  subjectId: string;
  subjectName: string;
  materialId?: string;
  createdById: string;
  createdByName: string;
  quizType?: string;
  questions: QuizQuestion[];
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

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  topicTag?: string;
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

export interface StudySummary {
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

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorName: string;
  authorId?: string;
  targetAudience: string;
  priority: string;
  createdAt: string;
  subjectId?: string;
  subjectName?: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
}

export interface SystemInfo {
  platformName: string;
  institution: string;
  degree: string;
  version: string;
  techStack: Record<string, string>;
  sdgs: string[];
  capstoneTeam: Record<string, string>;
}

export interface SystemSettings {
  require2FA: boolean;
  maintenanceMode: boolean;
  sessionTimeoutMins: number;
  autoAuditArchiving: boolean;
}
