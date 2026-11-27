import { ACTION_LABELS, actionLabel } from "../../../utils/activity";

export { ACTION_LABELS, actionLabel };

export const LOG_PAGE_SIZE = 10;

export const ACTION_CATEGORY: Record<string, { group: string; badge: string }> = {
  USER_LOGIN: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  USER_REGISTER: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  USER_CREATED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  USER_UPDATED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  USER_STATUS_CHANGED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  USER_DELETED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  PASSWORD_RESET: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  RESET_OTP_REQUESTED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  PASSWORD_CHANGED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  LOGIN_FAILED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  LOGIN_LOCKED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  ACCOUNT_LOCKED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  LOGIN_DISABLED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  EMAIL_VERIFY_REQUIRED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  EMAIL_VERIFY_RESUMED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  EMAIL_VERIFIED: { group: "Accounts & Authentication", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  TWO_FACTOR_REQUIRED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  LOGOUT_ALL_DEVICES: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  MATERIAL_UPLOAD: { group: "Learning Materials", badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  MATERIAL_UPDATE: { group: "Learning Materials", badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  MATERIAL_DELETE: { group: "Learning Materials", badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  MATERIAL_AI_SAVE: { group: "Learning Materials", badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  MATERIAL_FLAG: { group: "Learning Materials", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  MATERIAL_FLAG_RESOLVED: { group: "Learning Materials", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  QUIZ_CREATE: { group: "Quizzes & Assessments", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  QUIZ_UPDATE: { group: "Quizzes & Assessments", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  QUIZ_DELETE: { group: "Quizzes & Assessments", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  QUIZ_PUBLISH: { group: "Quizzes & Assessments", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  QUIZ_UNPUBLISH: { group: "Quizzes & Assessments", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  QUIZ_SUBMIT: { group: "Quizzes & Assessments", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  SUBJECT_CREATE: { group: "Subjects & Enrollments", badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  SUBJECT_UPDATE: { group: "Subjects & Enrollments", badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  SUBJECT_DELETE: { group: "Subjects & Enrollments", badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  SUBJECT_ENROLL: { group: "Subjects & Enrollments", badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  SUBJECT_UNENROLL: { group: "Subjects & Enrollments", badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  AI_QUIZ_GENERATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  AI_SUMMARY_GENERATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  AI_REVIEWER_GENERATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  AI_FLASHCARDS_GENERATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  AI_RESOURCE_GENERATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  AI_RESOURCE_SAVE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  AI_SERVICE_DOWN: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  FLASHCARD_UPDATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  FLASHCARD_DELETE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  SUMMARY_UPDATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  SUMMARY_DELETE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  REVIEWER_UPDATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  REVIEWER_DELETE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  ANNOUNCEMENT_POSTED: { group: "System & Announcements", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  ANNOUNCEMENT_DELETED: { group: "System & Announcements", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  SETTINGS_UPDATED: { group: "System & Announcements", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  SYSTEM_BOOT: { group: "System & Announcements", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  REPORT_GENERATE: { group: "System & Announcements", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  LOGS_CLEARED: { group: "System & Announcements", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  DIAGNOSTIC_CHECK: { group: "System & Announcements", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
};

export const LOG_CATEGORIES: { value: string; label: string }[] = [
  { value: "accounts", label: "Accounts & Security" },
  { value: "materials", label: "Learning Materials" },
  { value: "quizzes", label: "Quizzes & Assessments" },
  { value: "subjects", label: "Subjects & Enrollment" },
  { value: "ai", label: "AI & Study Resources" },
  { value: "system", label: "System & Announcements" },
];

export const actionCategory = (code: string): { group: string; badge: string } =>
  ACTION_CATEGORY[code] || { group: "Other", badge: "bg-muted text-muted-foreground" };

export const DEFAULT_SEMESTERS = ["1st Semester", "2nd Semester", "Summer"];

export const DEFAULT_COURSES = ["BSIT", "BSCS", "BSIS", "BSCPE"];
