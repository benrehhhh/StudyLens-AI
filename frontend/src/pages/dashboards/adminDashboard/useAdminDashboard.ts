import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useAnnouncements, type AnnouncementItem } from "../../../context/AnnouncementsContext";
import { useToast } from "../../../context/ToastContext";
import { authFetch } from "../../../utils/authFetch";
import { checkPasswordStrength } from "../../../utils/password";
import type { User, ActivityLog, UserRole, Subject } from "../../../types";
import {
  LOG_PAGE_SIZE,
  LOG_CATEGORIES,
  actionLabel,
  actionCategory,
  DEFAULT_SEMESTERS,
  DEFAULT_COURSES,
} from "./adminDashboardUtils";
import { slicePage } from "../../../components/Pagination";

export type AdminDashboardState = ReturnType<typeof useAdminDashboard>;

export function useAdminDashboard(defaultTab: "overview" | "logs" | "users" | "announcements" | "settings" | "subjects" = "overview") {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    announcements: globalAnnouncements,
    addAnnouncement,
    updateAnnouncement,
    deleteAnnouncement: removeGlobalAnnouncement,
  } = useAnnouncements();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "users" | "announcements" | "settings" | "subjects">(defaultTab);

  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveTab(defaultTab);
    }, 0);
    return () => clearTimeout(timer);
  }, [defaultTab]);

  // Data State
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Log Refresh State
  const [lastRefreshed, setLastRefreshed] = useState<string>(new Date().toLocaleTimeString());

  // Log Filters & Search State (raw setters; page-resetting wrappers are exposed below)
  const [searchLog, setSearchLogState] = useState("");
  const [selectedActionFilter, setSelectedActionFilterState] = useState("all");
  const [selectedLogRoleFilter, setSelectedLogRoleFilterState] = useState("all");
  const [selectedLogModal, setSelectedLogModal] = useState<ActivityLog | null>(null);

  const setSearchLog = useCallback((value: string) => {
    setSearchLogState(value);
    setLogPage(1);
  }, []);

  const setSelectedActionFilter = useCallback((value: string) => {
    setSelectedActionFilterState(value);
    setLogPage(1);
  }, []);

  const setSelectedLogRoleFilter = useCallback((value: string) => {
    setSelectedLogRoleFilterState(value);
    setLogPage(1);
  }, []);

  const [searchUser, setSearchUser] = useState("");
  const [selectedUserRoleFilter, setSelectedUserRoleFilter] = useState<string>(searchParams.get("role") || "all");
  const [selectedUserStatusFilter, setSelectedUserStatusFilter] = useState<string>(searchParams.get("status") || "all");
  const [userPage, setUserPage] = useState(1);

  // Modal States - Add User & Edit User
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("student");
  const [newUserDept, setNewUserDept] = useState("College of Computer Studies");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserConfirmPassword, setNewUserConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserRole, setEditUserRole] = useState<UserRole>("student");
  const [editUserDept, setEditUserDept] = useState("");
  const [editUserStatus, setEditUserStatus] = useState<"active" | "suspended">("active");

  // Announcement Management State (Teacher / Admin Process Sync)
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annAudience, setAnnAudience] = useState<"all" | "students" | "teachers">("all");
  const [annPriority, setAnnPriority] = useState<"high" | "medium" | "low">("medium");
  const [annSubjectId, setAnnSubjectId] = useState("");

  const [editingAnn, setEditingAnn] = useState<AnnouncementItem | null>(null);
  const [editAnnTitle, setEditAnnTitle] = useState("");
  const [editAnnContent, setEditAnnContent] = useState("");
  const [editAnnAudience, setEditAnnAudience] = useState<"all" | "students" | "teachers">("all");
  const [editAnnPriority, setEditAnnPriority] = useState<"high" | "medium" | "low">("medium");

  // Subject Management State
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subCode, setSubCode] = useState("");
  const [subName, setSubName] = useState("");
  const [subDesc, setSubDesc] = useState("");
  const [subTeacherId, setSubTeacherId] = useState("");
  const [subSemester, setSubSemester] = useState("1st Semester");
  const [subCourse, setSubCourse] = useState("BSIT");
  const [subYear, setSubYear] = useState("2026-2027");

  // Roster Management State
  const [rosterSubject, setRosterSubject] = useState<Subject | null>(null);
  const [rosterStudents, setRosterStudents] = useState<{ id: string; name: string; email: string; avatar?: string | null; studentId?: string; dateEnrolled?: string }[]>([]);
  const [assignStudentIds, setAssignStudentIds] = useState<string[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [assignFilter, setAssignFilter] = useState<"all" | "enrolled" | "unenrolled">("all");
  const [assignSearch, setAssignSearch] = useState("");

  // System Settings State
  const [systemSettings, setSystemSettings] = useState({
    require2FA: false,
    maintenanceMode: false,
    sessionTimeoutMins: 60,
    autoAuditArchiving: true,
  });

  // Banner message state (settings / subjects / roster feedback)
  const [settingsSavedMessage, setSettingsSavedMessage] = useState<string | null>(null);
  const [settingsSavedAt, setSettingsSavedAt] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [exportingLogs, setExportingLogs] = useState(false);
  const [subMsg, setSubMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [rosterMsg, setRosterMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);

  // Fetch Core Data — activity logs are fetched server-side (filtered + paginated)
  const fetchLogs = useCallback(async (page: number = logPage, limit: number = LOG_PAGE_SIZE) => {
    setLoadingLogs(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (selectedActionFilter !== "all") params.set("category", selectedActionFilter);
      if (selectedLogRoleFilter !== "all") params.set("role", selectedLogRoleFilter);
      if (searchLog.trim()) params.set("search", searchLog.trim());
      const res = await authFetch(`/api/logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setLogsTotal(data.total || 0);
        setLogPage(data.page || 1);
        setLastRefreshed(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  }, [searchLog, selectedActionFilter, selectedLogRoleFilter, logPage]);

  // Refetch logs whenever filters / page change (page-size is fixed at 10).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs(logPage, LOG_PAGE_SIZE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchLog, selectedActionFilter, selectedLogRoleFilter, logPage]);

  useEffect(() => {
    let isMounted = true;
    const loadAllData = async () => {
      try {
        const [logsRes, usersRes, subRes, setRes] = await Promise.all([
          authFetch("/api/logs?page=1&limit=10"),
          authFetch("/api/users"),
          authFetch("/api/subjects"),
          authFetch("/api/system/settings"),
        ]);
        if (!isMounted) return;
        if (logsRes.ok) {
          const data = await logsRes.json();
          setLogs(data.logs || []);
          setLogsTotal(data.total || 0);
          setLogPage(data.page || 1);
        }
        if (usersRes.ok) setUsers(await usersRes.json());
        if (subRes.ok) setSubjects(await subRes.json());
        if (setRes.ok) setSystemSettings(await setRes.json());
        setLastRefreshed(new Date().toLocaleTimeString());
      } catch (err) {
        console.error("Error loading initial admin data:", err);
      }
    };
    loadAllData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreateUser = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;
    if (!newUserPassword) {
      showToast("Please set a password for the new account.", "error");
      return;
    }
    const strengthError = checkPasswordStrength(newUserPassword);
    if (strengthError) {
      showToast(strengthError, "error");
      return;
    }
    if (newUserPassword !== newUserConfirmPassword) {
      showToast("Password and confirmation do not match.", "error");
      return;
    }

    try {
      const res = await authFetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          role: newUserRole,
          department: newUserDept,
          status: "active",
          password: newUserPassword,
        }),
      });
      if (res.ok) {
        const createdUser = await res.json();
        setUsers((prev) => [createdUser, ...prev]);
        setShowAddUserModal(false);
        setNewUserName("");
        setNewUserEmail("");
        setNewUserPassword("");
        setNewUserConfirmPassword("");
        fetchLogs();
        showToast("User account created successfully.");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data?.error || "Could not create the user account. Please try again.", "error");
      }
    } catch (err) {
      console.error("Create user failed:", err);
      showToast("Could not create the user account. Please try again.", "error");
    }
  }, [
    newUserName,
    newUserEmail,
    newUserRole,
    newUserDept,
    newUserPassword,
    newUserConfirmPassword,
    fetchLogs,
    showToast,
  ]);

  const handleOpenEditUser = useCallback((user: User) => {
    setEditingUser(user);
    setEditUserName(user.name);
    setEditUserRole(user.role);
    setEditUserDept(user.department || "General");
    setEditUserStatus(user.status || "active");
  }, []);

  const handleSaveUserEdit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const res = await authFetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editUserName,
          role: editUserRole,
          department: editUserDept,
          status: editUserStatus,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        setEditingUser(null);
        fetchLogs();
        showToast("User account updated successfully.");
      }
    } catch (err) {
      console.error("Save user edit failed:", err);
      showToast("Could not update the user account. Please try again.", "error");
    }
  }, [editingUser, editUserName, editUserRole, editUserDept, editUserStatus, fetchLogs, showToast]);

  const handleToggleUserStatus = useCallback(async (user: User) => {
    const nextStatus = user.status === "suspended" ? "active" : "suspended";
    try {
      const res = await authFetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        fetchLogs();
        showToast(nextStatus === "active" ? "User account activated." : "User account suspended.");
      }
    } catch (err) {
      console.error("Toggle user status failed:", err);
      showToast("Could not update the account status. Please try again.", "error");
    }
  }, [fetchLogs, showToast]);

  const handleDeleteUser = useCallback(async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this user account?")) return;
    try {
      const res = await authFetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== id));
        fetchLogs();
        showToast("User account deleted.");
      }
    } catch (err) {
      console.error("Delete user failed:", err);
      showToast("Could not delete the user account. Please try again.", "error");
    }
  }, [fetchLogs, showToast]);

  const handleResetPassword = useCallback(async (user: User) => {
    const tempPass = `A!${Math.floor(100000 + Math.random() * 900000)}x`;
    const resetting = window.confirm(`Generate a temporary password for ${user.name} (${user.email})?\n\nThe account password will be reset to a new temporary value.`);
    if (!resetting) return;
    try {
      const res = await authFetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: tempPass }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(`Could not reset the password: ${data?.error || "Please try again."}`, "error");
        return;
      }
      showToast(`Temporary password generated for ${user.name} (${user.email}): ${tempPass}`, "success", 10000);
    } catch {
      showToast("Could not reach the server. Please check your connection and try again.", "error");
      return;
    }
    // Submit log
    authFetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: currentUser?.id || "usr-admin-1",
        userName: currentUser?.name || "System Admin",
        userRole: "admin",
        action: "PASSWORD_RESET",
        details: `Reset password for user account ${user.name} (${user.email})`,
      }),
    }).then(() => fetchLogs());
  }, [currentUser, fetchLogs, showToast]);

  // Announcement Actions (Same process as Teachers & AnnouncementsContext)
  const handlePostAnnouncement = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;

    const selectedSub = subjects.find((s) => s.id === annSubjectId);
    const subName = selectedSub ? `${selectedSub.code} - ${selectedSub.name}` : undefined;

    addAnnouncement({
      title: annTitle.trim(),
      content: annContent.trim(),
      authorName: `${currentUser?.name || "Dr. Arthur Vance"} (Admin)`,
      targetAudience: annAudience,
      priority: annPriority,
      subjectId: selectedSub ? selectedSub.id : undefined,
      subjectName: subName,
      tag: selectedSub ? selectedSub.code : annPriority === "high" ? "Urgent Notice" : "System Bulletin",
    });

    setShowAnnounceModal(false);
    setAnnTitle("");
    setAnnContent("");
    setAnnSubjectId("");
    setTimeout(() => fetchLogs(), 500);
    showToast("Announcement posted.");
  }, [annTitle, annContent, annSubjectId, annAudience, annPriority, subjects, currentUser, addAnnouncement, fetchLogs, showToast]);

  const handleOpenEditAnn = useCallback((ann: AnnouncementItem) => {
    setEditingAnn(ann);
    setEditAnnTitle(ann.title);
    setEditAnnContent(ann.content);
    setEditAnnAudience(ann.targetAudience);
    setEditAnnPriority(ann.priority);
  }, []);

  const handleSaveAnnEdit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnn) return;

    try {
      await updateAnnouncement(editingAnn.id, {
        title: editAnnTitle,
        content: editAnnContent,
        targetAudience: editAnnAudience,
        priority: editAnnPriority,
      });
      setEditingAnn(null);
      fetchLogs();
      showToast("Announcement updated.");
    } catch (err) {
      console.error("Save announcement edit failed:", err);
      showToast(err instanceof Error ? err.message : "Could not update the announcement. Please try again.", "error");
    }
  }, [editingAnn, editAnnTitle, editAnnContent, editAnnAudience, editAnnPriority, updateAnnouncement, fetchLogs, showToast]);

  const [annToDelete, setAnnToDelete] = useState<string | null>(null);
  const [detailCard, setDetailCard] = useState<"users" | "subjects" | null>(null);

  const handleDeleteAnnouncement = useCallback((id: string) => {
    setAnnToDelete(id);
  }, []);

  const confirmDeleteAnnouncement = useCallback(async () => {
    if (annToDelete) {
      const deleted = await removeGlobalAnnouncement(annToDelete);
      if (deleted) {
        setTimeout(() => fetchLogs(), 500);
        showToast("Announcement deleted.");
      } else {
        showToast("Could not delete the announcement. Please try again.", "error");
      }
    }
    setAnnToDelete(null);
  }, [annToDelete, removeGlobalAnnouncement, fetchLogs, showToast]);

  // Subject Management Actions
  const teachers = users.filter((u) => u.role === "teacher");

  const handleOpenAddSubject = useCallback(() => {
    setEditingSubject(null);
    setSubCode("");
    setSubName("");
    setSubDesc("");
    setSubTeacherId(teachers[0]?.id || "");
    setSubSemester("1st Semester");
    setSubCourse("BSIT");
    setSubYear("2026-2027");
    setShowSubjectModal(true);
  }, [teachers]);

  const handleOpenEditSubject = useCallback((sub: Subject) => {
    setEditingSubject(sub);
    setSubCode(sub.code);
    setSubName(sub.name);
    setSubDesc(sub.description || "");
    setSubTeacherId(sub.teacherId);
    setSubSemester(sub.semester || "1st Semester");
    setSubCourse(sub.course || "BSIT");
    setSubYear(sub.schoolYear || "2026-2027");
    setShowSubjectModal(true);
  }, []);

  const handleSaveSubject = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subCode.trim() || !subName.trim() || !subTeacherId) {
      showToast("Subject code, name, and assigned teacher are required.", "error");
      return;
    }
    const payload = {
      code: subCode.trim(),
      name: subName.trim(),
      description: subDesc.trim(),
      teacherId: subTeacherId,
      semester: subSemester,
      course: subCourse,
      schoolYear: subYear,
    };
    try {
      const res = editingSubject
        ? await authFetch(`/api/subjects/${editingSubject.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await authFetch("/api/subjects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubMsg({ type: "error", text: data?.error || "Could not save the subject. Please try again." });
        showToast(data?.error || "Could not save the subject. Please try again.", "error");
        return;
      }
      if (editingSubject) {
        setSubjects((prev) => prev.map((s) => (s.id === data.id ? data : s)));
        setSubMsg({ type: "success", text: "Subject updated successfully." });
        showToast("Subject updated successfully.");
      } else {
        setSubjects((prev) => [data, ...prev]);
        setSubMsg({ type: "success", text: "Subject created successfully." });
        showToast("Subject created successfully.");
      }
      setShowSubjectModal(false);
      fetchLogs();
    } catch {
      setSubMsg({ type: "error", text: "Could not reach the server. Please try again." });
      showToast("Could not reach the server. Please try again.", "error");
    }
  }, [subCode, subName, subDesc, subTeacherId, subSemester, subCourse, subYear, editingSubject, showToast, fetchLogs]);

  const handleDeleteSubject = useCallback(async (sub: Subject) => {
    if (!window.confirm(`Delete subject "${sub.code} - ${sub.name}"? Students will be removed from this subject.`)) return;
    try {
      const res = await authFetch(`/api/subjects/${sub.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error || "Could not delete this subject.", "error");
        return;
      }
      setSubjects((prev) => prev.filter((s) => s.id !== sub.id));
      fetchLogs();
      showToast("Subject deleted successfully.");
    } catch {
      showToast("Could not reach the server. Please try again.", "error");
    }
  }, [showToast, fetchLogs]);

  const handleOpenRoster = useCallback(async (sub: Subject) => {
    setRosterSubject(sub);
    setRosterStudents([]);
    setAssignStudentIds([]);
    setRosterLoading(true);
    try {
      const res = await authFetch(`/api/subjects/${sub.id}/students`);
      if (res.ok) {
        setRosterStudents(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch roster:", err);
    } finally {
      setRosterLoading(false);
    }
  }, []);

  const handleAssignStudents = useCallback(async () => {
    if (!rosterSubject || assignStudentIds.length === 0) return;
    setRosterLoading(true);
    try {
      const res = await authFetch(`/api/subjects/${rosterSubject.id}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: assignStudentIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRosterMsg({ type: "error", text: data?.error || "Could not assign the selected students." });
        showToast(data?.error || "Could not assign the selected students.", "error");
        return;
      }
      setRosterStudents(data.students || rosterStudents);
      setAssignStudentIds([]);
      setRosterMsg({ type: "success", text: `${data.added || assignStudentIds.length} student(s) assigned.` });
      showToast(`${data.added || assignStudentIds.length} student(s) assigned.`);
      const updated = await authFetch("/api/subjects");
      if (updated.ok) setSubjects(await updated.json());
      fetchLogs();
    } catch {
      showToast("Could not reach the server. Please try again.", "error");
    } finally {
      setRosterLoading(false);
    }
  }, [rosterSubject, assignStudentIds, rosterStudents, showToast, setSubjects, fetchLogs]);

  const handleRemoveRosterStudent = useCallback(async (studentId: string) => {
    if (!rosterSubject) return;
    if (!window.confirm("Remove this student from the subject?")) return;
    setRosterLoading(true);
    try {
      const res = await authFetch(`/api/subjects/${rosterSubject.id}/students`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: [studentId] }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRosterStudents(data.students || rosterStudents);
        const updated = await authFetch("/api/subjects");
        if (updated.ok) setSubjects(await updated.json());
        fetchLogs();
        setRosterMsg({ type: "success", text: "Student removed from subject." });
        showToast("Student removed from subject.");
      }
    } catch {
      showToast("Could not reach the server. Please try again.", "error");
    } finally {
      setRosterLoading(false);
    }
  }, [rosterSubject, rosterStudents, setSubjects, fetchLogs, showToast]);

  // Audit Logs Actions
  const handleClearAuditLogs = useCallback(async () => {
    if (!window.confirm("Are you sure you want to archive and clear all active audit logs?")) return;
    try {
      const res = await authFetch("/api/logs", { method: "DELETE" });
      if (res.ok) {
        fetchLogs();
      }
    } catch (err) {
      console.error("Clear logs failed:", err);
    }
  }, [fetchLogs]);

  const handleExportLogsCSV = useCallback(async () => {
    if (exportingLogs) return;
    setExportingLogs(true);
    try {
      const limit = 500;
      let page = 1;
      let allLogs: ActivityLog[] = [];
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        if (selectedActionFilter !== "all") params.set("category", selectedActionFilter);
        if (selectedLogRoleFilter !== "all") params.set("role", selectedLogRoleFilter);
        if (searchLog.trim()) params.set("search", searchLog.trim());
        const res = await authFetch(`/api/logs?${params.toString()}`);
        if (!res.ok) {
          showToast("Could not export audit logs. Please try again.", "error");
          return;
        }
        const data = await res.json();
        const pageLogs = Array.isArray(data.logs) ? data.logs : [];
        allLogs = allLogs.concat(pageLogs);
        const pages = data.pages || 1;
        if (page >= pages) hasMore = false;
        else page += 1;
      }

      const csvContent =
        "data:text/csv;charset=utf-8," +
        "Log ID,Timestamp,User Name,Role,Action,Details,IP Address\n" +
        allLogs
          .map(
            (l) =>
              `"${l.id}","${l.timestamp}","${l.userName}","${l.userRole}","${l.action}","${l.details.replace(
                /"/g,
                '""'
              )}","${l.ipAddress || "127.0.0.1"}"`
          )
          .join("\n");

      const ts = new Date().getTime();
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `StudyLens_Audit_Trail_${ts}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Audit logs exported successfully.");
    } catch (err) {
      console.error("Export logs failed:", err);
      showToast("Could not export audit logs. Please try again.", "error");
    } finally {
      setExportingLogs(false);
    }
  }, [exportingLogs, selectedActionFilter, selectedLogRoleFilter, searchLog, showToast]);

  const handleSaveSettings = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const timeoutMins = Number(systemSettings.sessionTimeoutMins);
    if (!Number.isFinite(timeoutMins) || timeoutMins < 5 || timeoutMins > 1440) {
      setSettingsSavedMessage(null);
      showToast("Session timeout must be between 5 and 1440 minutes.", "error");
      return;
    }
    setSavingSettings(true);
    try {
      const res = await authFetch("/api/system/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...systemSettings, sessionTimeoutMins: timeoutMins }),
      });
      if (res.ok) {
        const saved = await res.json();
        setSystemSettings(saved);
        setSettingsSavedMessage("System configuration saved.");
        setSettingsSavedAt(new Date().toLocaleString());
        showToast("System configuration saved.");
        fetchLogs();
      } else {
        const data = await res.json().catch(() => ({}));
        setSettingsSavedMessage(null);
        showToast(data?.error || "Could not save the settings. Please try again.", "error");
      }
    } catch (err) {
      console.error("Save settings error:", err);
      showToast("Could not save the settings. Please try again.", "error");
    } finally {
      setSavingSettings(false);
    }
  }, [systemSettings, fetchLogs, showToast]);

  const handleResetSettings = useCallback(() => {
    setSystemSettings({
      require2FA: false,
      maintenanceMode: false,
      sessionTimeoutMins: 60,
      autoAuditArchiving: true,
    });
    showToast("Settings reset in the form. Press Save to apply them.");
  }, [showToast]);

  const handleExportSystemBackup = useCallback(async () => {
    setBackupLoading(true);
    try {
      const res = await authFetch("/api/system/backup");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data?.error || "Could not create the backup. Please try again.", "error");
        return;
      }
      const backupData = await res.json();
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().getTime();
      a.download = `StudyLens_System_Backup_${ts}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Full database backup downloaded.");
    } catch (err) {
      console.error("Backup error:", err);
      showToast("Could not create the backup. Please try again.", "error");
    } finally {
      setBackupLoading(false);
    }
  }, [showToast]);

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.email.toLowerCase().includes(searchUser.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(searchUser.toLowerCase()));
    const matchesRole = selectedUserRoleFilter === "all" || u.role === selectedUserRoleFilter;
    const matchesStatus =
      selectedUserStatusFilter === "all" ||
      (selectedUserStatusFilter === "active" ? u.status !== "suspended" : u.status === "suspended");
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Reset the user page whenever any user filter changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserPage(1);
  }, [searchUser, selectedUserRoleFilter, selectedUserStatusFilter]);

  const pagedUsers = slicePage(filteredUsers, userPage);

  return {
    currentUser,
    navigate,
    globalAnnouncements,
    addAnnouncement,
    removeGlobalAnnouncement,
    showToast,
    activeTab,
    setActiveTab,
    defaultTab,
    users,
    setUsers,
    logs,
    setLogs,
    logsTotal,
    setLogsTotal,
    logPage,
    setLogPage,
    subjects,
    setSubjects,
    loadingLogs,
    setLoadingLogs,
    exportingLogs,
    lastRefreshed,
    setLastRefreshed,
    searchLog,
    setSearchLog,
    selectedActionFilter,
    setSelectedActionFilter,
    selectedLogRoleFilter,
    setSelectedLogRoleFilter,
    selectedLogModal,
    setSelectedLogModal,
    searchUser,
    setSearchUser,
    selectedUserRoleFilter,
    setSelectedUserRoleFilter,
    selectedUserStatusFilter,
    setSelectedUserStatusFilter,
    userPage,
    setUserPage,
    showAddUserModal,
    setShowAddUserModal,
    newUserName,
    setNewUserName,
    newUserEmail,
    setNewUserEmail,
    newUserRole,
    setNewUserRole,
    newUserDept,
    setNewUserDept,
    newUserPassword,
    setNewUserPassword,
    newUserConfirmPassword,
    setNewUserConfirmPassword,
    showNewPassword,
    setShowNewPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    editingUser,
    setEditingUser,
    editUserName,
    setEditUserName,
    editUserRole,
    setEditUserRole,
    editUserDept,
    setEditUserDept,
    editUserStatus,
    setEditUserStatus,
    showAnnounceModal,
    setShowAnnounceModal,
    annTitle,
    setAnnTitle,
    annContent,
    setAnnContent,
    annAudience,
    setAnnAudience,
    annPriority,
    setAnnPriority,
    annSubjectId,
    setAnnSubjectId,
    editingAnn,
    setEditingAnn,
    editAnnTitle,
    setEditAnnTitle,
    editAnnContent,
    setEditAnnContent,
    editAnnAudience,
    setEditAnnAudience,
    editAnnPriority,
    setEditAnnPriority,
    showSubjectModal,
    setShowSubjectModal,
    editingSubject,
    setEditingSubject,
    subCode,
    setSubCode,
    subName,
    setSubName,
    subDesc,
    setSubDesc,
    subTeacherId,
    setSubTeacherId,
    subSemester,
    setSubSemester,
    subCourse,
    setSubCourse,
    subYear,
    setSubYear,
    rosterSubject,
    setRosterSubject,
    rosterStudents,
    setRosterStudents,
    assignStudentIds,
    setAssignStudentIds,
    rosterLoading,
    setRosterLoading,
    assignFilter,
    setAssignFilter,
    assignSearch,
    setAssignSearch,
    systemSettings,
    setSystemSettings,
    settingsSavedMessage,
    setSettingsSavedMessage,
    settingsSavedAt,
    setSettingsSavedAt,
    savingSettings,
    setSavingSettings,
    backupLoading,
    setBackupLoading,
    subMsg,
    setSubMsg,
    rosterMsg,
    setRosterMsg,
    annToDelete,
    setAnnToDelete,
    detailCard,
    setDetailCard,
    fetchLogs,
    handleCreateUser,
    handleOpenEditUser,
    handleSaveUserEdit,
    handleToggleUserStatus,
    handleDeleteUser,
    handleResetPassword,
    handlePostAnnouncement,
    handleOpenEditAnn,
    handleSaveAnnEdit,
    handleDeleteAnnouncement,
    confirmDeleteAnnouncement,
    handleOpenAddSubject,
    handleOpenEditSubject,
    handleSaveSubject,
    handleDeleteSubject,
    handleOpenRoster,
    handleAssignStudents,
    handleRemoveRosterStudent,
    handleClearAuditLogs,
    handleExportLogsCSV,
    handleSaveSettings,
    handleResetSettings,
    handleExportSystemBackup,
    teachers,
    filteredUsers,
    pagedUsers,
    actionLabel,
    actionCategory,
    LOG_CATEGORIES,
    DEFAULT_SEMESTERS,
    DEFAULT_COURSES,
  };
}
