import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Menu, X, Bell, LogOut, ChevronRight,
  User
} from "lucide-react";
import { motion } from "motion/react";
import { Button } from "./ui/button";
import { DarkModeToggle } from "./DarkModeToggle";
import { useAnnouncements, type BellItem } from "../context/AnnouncementsContext";
import { useAuth } from "../context/AuthContext";
import { RelativeTime } from "../utils/time";
import { authFetch } from "../utils/authFetch";
import { avatarUrl } from "../utils/avatar";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

// Cache materialId -> subjectId so a material-notification tap deep-links to
// the flagged material's subject without refetching the catalog every time.
const materialSubjectCache = new Map<string, string | null>();

async function resolveMaterialSubjectId(materialId: string): Promise<string | null> {
  if (materialSubjectCache.has(materialId)) return materialSubjectCache.get(materialId) ?? null;
  try {
    const res = await authFetch("/api/materials");
    if (!res.ok) return null;
    const materials = (await res.json()) as { id: string; subjectId?: string | null }[];
    const subjectId = materials.find((m) => m.id === materialId)?.subjectId || null;
    materialSubjectCache.set(materialId, subjectId);
    return subjectId;
  } catch {
    return null;
  }
}

export interface MenuItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: string;
}

export interface DashboardLayoutProps {
  children: React.ReactNode;
  menuItems: MenuItem[];
  userRole: "Student" | "Teacher" | "Administrator";
  userName: string;
  activePath?: string;
  /**
   * Called when the user activates the nav item for the page they are already
   * on. That click is a no-op in react-router, so the layout forwards it to the
   * app to force a remount of the current page.
   */
  onNavigateActive?: () => void;
  onLogout?: () => void;
}

export function DashboardLayout({
  children,
  menuItems,
  userRole,
  userName,
  activePath,
  onNavigateActive,
  onLogout,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [pendingQuiz, setPendingQuiz] = useState<{ id: string; title: string } | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const { currentUser } = useAuth();
  const { notifications, unreadCount, markAllNotificationsRead, markNotificationRead, dbNotifications } = useAnnouncements();

  // Close the bell dropdown on any outside pointer-down or Escape. A fixed
  // backdrop cannot be used here: the header's backdrop-blur creates a
  // containing block that would trap it inside the header box.
  useEffect(() => {
    if (!notifOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotifOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [notifOpen]);

  const currentPath = activePath || location.pathname;

  // Determine dynamic page title
  const activeMenuItem = menuItems.find(
    (item) => currentPath === item.path || (item.path !== "/" && currentPath.startsWith(item.path))
  );

  let pageTitle = activeMenuItem?.label;
  if (!pageTitle) {
    if (currentPath.includes("ai-assistant")) pageTitle = "AI Study Generator";
    else if (currentPath.includes("materials")) pageTitle = "Learning Materials";
    else if (currentPath.includes("assessments")) pageTitle = "Assessments & Tests";
    else if (currentPath.includes("flashcards")) pageTitle = "Flashcards";
    else if (currentPath.includes("analytics")) pageTitle = "Adaptive Progress";
    else if (/\/subjects\/[^/]+/.test(currentPath)) pageTitle = "Subject Details";
    else if (currentPath.includes("subjects")) pageTitle = "Course Subjects";
    else if (currentPath.includes("announcements")) pageTitle = "Announcements";
    else if (currentPath.includes("users")) pageTitle = "User Management";
    else if (currentPath.includes("activity-logs")) pageTitle = "Audit Activity Logs";
    else if (currentPath.includes("profile")) pageTitle = "My Profile";
    else if (currentPath.includes("student")) pageTitle = "Student Dashboard";
    else if (currentPath.includes("teacher")) pageTitle = "Teacher Dashboard";
    else if (currentPath.includes("admin")) pageTitle = "Admin Dashboard";
    else pageTitle = "Dashboard";
  }

  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    } else {
      navigate("/");
    }
  };

  const handleNotificationClick = async (item: BellItem) => {
    if (item.kind !== "notification") {
      navigate(`/announcements?id=${item.announcementId || item.id}`);
      return;
    }
    markNotificationRead(item.id.replace(/^notif-/, ""));
    if (item.target && item.target.startsWith("quiz:")) {
      const quizId = item.target.slice(5);
      setPendingQuiz({ id: quizId, title: item.title });
      return;
    }
    if (item.target && item.target.startsWith("material:")) {
      const materialId = item.target.slice(9);
      const subjectId = await resolveMaterialSubjectId(materialId);
      navigate(
        subjectId
          ? `/subjects/${encodeURIComponent(subjectId)}?tab=materials&material=${encodeURIComponent(materialId)}`
          : `/subjects?material=${encodeURIComponent(materialId)}`
      );
      return;
    }
    navigate("/assessments");
  };

  return (
    <div className="h-screen bg-background text-foreground flex overflow-hidden">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 h-full bg-structure border-r border-structure-strong transform transition-[transform,width] duration-200 ease-in-out lg:translate-x-0 lg:static flex flex-col justify-between p-4 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${sidebarCollapsed ? "lg:w-[76px]" : "lg:w-64"}`}
      >
        <div className="flex flex-col h-full justify-between">
          <div>
            <div className={`flex items-center justify-between mb-6 px-2 ${sidebarCollapsed ? "lg:justify-center lg:px-0" : ""}`}>
              <Link to="/" className="flex items-center gap-2.5 group">
                <img
                  src="/studylens.png"
                  alt="StudyLens"
                  className="h-9 w-9 rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform"
                />
                <div className={sidebarCollapsed ? "lg:hidden" : ""}>
                  <h1 className="font-bold text-base leading-none tracking-tight text-foreground">
                    StudyLens
                  </h1>
                </div>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close sidebar"
                className="lg:hidden"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  currentPath === item.path ||
                  (item.path !== "/" && currentPath.startsWith(item.path));

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={(e) => {
                      // Re-clicking the item for the current page must refresh it.
                      // preventDefault stops the Link from pushing a duplicate
                      // history entry, which would otherwise make the back
                      // button need two presses to leave the page. Compared
                      // exactly, not by the prefix rule used for highlighting
                      // above: on /subjects/abc the "My Subjects" item is
                      // highlighted but still has to navigate.
                      if (currentPath === item.path) {
                        e.preventDefault();
                        onNavigateActive?.();
                      }
                      setSidebarOpen(false);
                    }}
                    title={sidebarCollapsed ? item.label : undefined}
                    aria-current={isActive ? "page" : undefined}
                    className={`group relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? "text-structure-foreground font-bold"
                        : "text-structure-foreground/80 hover:bg-structure-strong/50 hover:text-structure-foreground"
                    } ${sidebarCollapsed ? "lg:justify-center lg:px-0" : ""}`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="nav-active-pill"
                        className="absolute inset-0 rounded-xl bg-structure-strong"
                        transition={{ type: "spring", stiffness: 500, damping: 38 }}
                      >
                        <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-brand-gradient" />
                      </motion.span>
                    )}
                    <div className="relative flex items-center gap-3">
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary dark:text-indigo-300" : "text-structure-foreground/70"}`} />
                      <span className={sidebarCollapsed ? "lg:hidden" : ""}>{item.label}</span>
                    </div>
                    <div className={`relative flex items-center gap-1.5 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
                      {item.badge && (
                        <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-md ${
                          "bg-primary/15 text-primary"
                        }`}>
                          {item.badge}
                        </span>
                      )}
                      <ChevronRight className={`h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 ${isActive ? "text-primary" : "opacity-40"}`} />
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
          
          <div className="pt-4 border-t border-border space-y-3">
            <div
              onClick={() => navigate("/profile")}
              className={`flex items-center gap-3 px-2 cursor-pointer hover:bg-structure-strong/60 p-1.5 rounded-xl transition-colors group ${sidebarCollapsed ? "lg:justify-center lg:px-0" : ""}`}
              title="Click to view full user profile"
            >
              {avatarUrl(currentUser?.avatar) ? (
                <img
                  src={avatarUrl(currentUser?.avatar)!}
                  alt={userName}
                  className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/20 shrink-0 group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-structure-strong text-structure-foreground flex items-center justify-center font-bold text-xs ring-2 ring-primary/20 shrink-0 group-hover:scale-105 transition-transform">
                  {userName ? userName.charAt(0).toUpperCase() : "J"}
                </div>
              )}
              <div className={`flex-1 truncate ${sidebarCollapsed ? "lg:hidden" : ""}`}>
                <p className="text-xs font-bold truncate text-foreground group-hover:text-primary transition-colors">{userName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{userRole}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className={`w-full justify-start gap-2 text-red-400 hover:text-red-500 hover:bg-transparent rounded-xl text-xs font-semibold cursor-pointer ${sidebarCollapsed ? "lg:w-10 lg:h-10 lg:justify-center lg:px-0 mx-auto" : ""}`}
              onClick={handleLogoutClick}
              title={sidebarCollapsed ? "Logout" : undefined}
            >
              <LogOut className="h-4 w-4" /> <span className={sidebarCollapsed ? "lg:hidden" : ""}>Logout</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <header className="h-14 border-b border-border bg-card/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle sidebar"
              className="text-foreground"
              onClick={() => {
                if (window.matchMedia("(min-width: 1024px)").matches) {
                  setSidebarCollapsed((c) => !c);
                } else {
                  setSidebarOpen((o) => !o);
                }
              }}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold text-foreground">{pageTitle}</h1>
          </div>

          <div className="flex items-center space-x-2.5 ml-auto">
            <DarkModeToggle />

            {/* Notification Popover Dropdown connected to Announcements */}
            <div className="relative" ref={notifRef}>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                aria-expanded={notifOpen}
                onClick={() => {
                  const opening = !notifOpen;
                  setNotifOpen(opening);
                  if (opening) markAllNotificationsRead();
                }}
                className="relative text-muted-foreground hover:text-foreground rounded-xl cursor-pointer"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-background">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-88 sm:w-96 bg-card border border-border rounded-2xl shadow-2xl p-4 z-50 space-y-3 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div className="flex items-center space-x-2">
                      <Bell className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-bold text-foreground">Notifications</h3>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                      {notifications.length} New
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">No notifications yet.</p>
                    ) : (
                      notifications.map((a) => (
                          <div
                            key={a.id}
                            onClick={() => {
                              setNotifOpen(false);
                              void handleNotificationClick(a);
                            }}
                            className={`p-3 rounded-xl border text-xs space-y-2 transition-all cursor-pointer group bg-muted/30 border-border/80 opacity-80 hover:opacity-100 hover:bg-muted/60`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-foreground truncate group-hover:text-primary transition-colors">
                                {a.title}
                              </span>
                              <div className="flex items-center space-x-1 shrink-0">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${a.kind === "notification" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary"}`}>
                                  {a.kind === "notification" ? "Notice" : a.tag || a.priority}
                                </span>
                              </div>
                            </div>

                            {a.subjectName && (
                              <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-structure text-primary dark:text-indigo-300">
                                {a.subjectName}
                              </span>
                            )}

                            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                              {a.content}
                            </p>

                            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                              <span className="font-semibold text-foreground">{a.authorName || (a.kind === "notification" ? "System" : "Administrator")}</span>
                              <div className="flex items-center space-x-1 text-primary font-semibold">
                                <RelativeTime iso={a.createdAt} />
                                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="pt-2 border-t border-border">
                      <button
                        onClick={() => {
                          setNotifOpen(false);
                          setViewAllOpen(true);
                        }}
                        className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold text-center transition-colors cursor-pointer flex items-center justify-center space-x-1"
                      >
                        <span>View All Notifications</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
              )}
            </div>

            {/* User Profile Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-8 w-8 rounded-full bg-structure-strong text-structure-foreground flex items-center justify-center font-bold text-xs ring-2 ring-primary/20 hover:scale-105 transition-transform cursor-pointer overflow-hidden">
                  {avatarUrl(currentUser?.avatar) ? (
                    <img src={avatarUrl(currentUser?.avatar)!} alt={userName} className="h-full w-full object-cover" />
                  ) : (
                    (userName ? userName.slice(0, 2).toUpperCase() : "SL")
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl">
                <DropdownMenuLabel className="font-bold text-xs">{userName}</DropdownMenuLabel>
                <p className="text-[11px] text-muted-foreground px-2 pb-1">{userRole} Account</p>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")} className="gap-2 cursor-pointer text-xs">
                  <User className="h-4 w-4" /> View My Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogoutClick} className="gap-2 cursor-pointer text-xs text-destructive">
                  <LogOut className="h-4 w-4" /> Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto space-y-6 overflow-y-auto min-h-0">
          <motion.div
            key={currentPath}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* View All Notifications modal */}
      {viewAllOpen && (
        <div
          role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setViewAllOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center space-x-2">
                <Bell className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">All Notifications</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => markAllNotificationsRead()}
                  className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                >
                  Mark all read
                </button>
                <button
                  onClick={() => setViewAllOpen(false)}
                  className="h-7 w-7 rounded-lg bg-muted/50 hover:bg-muted/80 text-muted-foreground flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-3 space-y-2.5 overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-10">No notifications yet.</p>
              ) : (
                notifications.map((a) => (
                  <div
                    key={`all-${a.id}`}
                    onClick={() => {
                      setViewAllOpen(false);
                      void handleNotificationClick(a);
                    }}
                    className="p-3 rounded-xl border text-xs space-y-2 transition-all cursor-pointer group bg-muted/30 border-border/80 hover:bg-muted/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {a.title}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${a.kind === "notification" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary"}`}>
                        {a.kind === "notification" ? "Notice" : a.tag || a.priority}
                      </span>
                    </div>
                    {a.subjectName && (
                      <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-structure text-primary dark:text-indigo-300">
                        {a.subjectName}
                      </span>
                    )}
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{a.content}</p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                      <span className="font-semibold text-foreground">
                        {a.authorName || (a.kind === "notification" ? "System" : "Administrator")}
                      </span>
                      <div className="flex items-center space-x-1 text-primary font-semibold">
                        <RelativeTime iso={a.createdAt} />
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <span className="text-[11px] text-muted-foreground">
                {dbNotifications.filter((n) => !n.isRead).length + notifications.filter((n) => n.kind === "announcement").length} unread
              </span>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setViewAllOpen(false);
                  navigate("/announcements");
                }}
                className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors"
              >
                Go to Announcements
              </a>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={pendingQuiz !== null}
        title="Start a timed quiz?"
        message={`This quiz is timed. The timer begins immediately when you open "${pendingQuiz?.title || "the quiz"}". Do you want to start it now?`}
        confirmLabel="Start Quiz"
        cancelLabel="Not now"
        onConfirm={() => {
          if (pendingQuiz) {
            navigate(`/assessments?quizId=${encodeURIComponent(pendingQuiz.id)}`);
          }
          setPendingQuiz(null);
        }}
        onCancel={() => setPendingQuiz(null)}
      />
    </div>
  );
}

