import { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { Navigation } from "./components/Navigation";
import { Dashboard } from "./components/Dashboard";
import { Analytics } from "./components/Analytics";
import { ProjectManagement } from "./components/ProjectManagement";
import { EmployeeManagement } from "./components/EmployeeManagement";
import { Settings } from "./components/Settings";
import Calendar from "./components/Calendar";
import { LoginPage } from "./components/LoginPage";
import { useProjectsOffline } from "./hooks/useProjectsOffline";
import { useEmployeesOffline } from "./hooks/useEmployeesOffline";
import { supabase } from "./supabaseClient";
import { LogOut } from "lucide-react";
import LoadingScreen from "./components/LoadingScreen";
import { LastRefreshProvider } from "./contexts/LastRefreshContext";
import { useMobileNotifications } from "./hooks/useMobileNotifications";

interface SessionData {
  email: string;
  loginTime: number;
  sessionId: string;
  adminId?: string;
}

export function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [minLoadingDone, setMinLoadingDone] = useState(false);

  const {
    projects,
    refetch: refetchProjects,
    isOnline: projectsOnline,
    pendingChanges: projectsPending,
    isSyncing: projectsSyncing,
    syncNow: syncProjectsNow,
    lastSyncTime: projectsLastSync,
  } = useProjectsOffline();

  const {
    employees,
    refetch: refetchEmployees,
    isOnline: employeesOnline,
    pendingChanges: employeesPending,
    isSyncing: employeesSyncing,
    syncNow: syncEmployeesNow,
  } = useEmployeesOffline();

  const { requestPermission } = useMobileNotifications();

  const isOnline = projectsOnline && employeesOnline;
  const totalPendingChanges = projectsPending + employeesPending;
  const isSyncing = projectsSyncing || employeesSyncing;

  const syncAll = async () => {
    const projectsResult = await syncProjectsNow();
    const employeesResult = await syncEmployeesNow();
    return projectsResult && employeesResult;
  };

  useEffect(() => {
    if (isAuthenticated) {
      const timer = setTimeout(() => {
        requestPermission();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, requestPermission]);

  const fetchAdminId = async (email: string) => {
    try {
      const { data: admin, error } = await supabase
        .from('admin')
        .select('id')
        .eq('email', email)
        .single();

      if (!error && admin) {
        setCurrentUserId(admin.id);
        const sessionData = localStorage.getItem('ogo_session');
        if (sessionData) {
          const session: SessionData = JSON.parse(sessionData);
          session.adminId = admin.id;
          localStorage.setItem('ogo_session', JSON.stringify(session));
        }
      }
    } catch (error) {
      console.error('Error fetching admin ID:', error);
    }
  };

  const createSession = async (email: string) => {
    const { data: admin } = await supabase
      .from('admin')
      .select('id')
      .eq('email', email)
      .single();

    const sessionData: SessionData = {
      email,
      loginTime: Date.now(),
      sessionId:
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15),
      adminId: admin?.id || undefined,
    };
    localStorage.setItem('ogo_session', JSON.stringify(sessionData));

    if (admin?.id) {
      setCurrentUserId(admin.id);
    }
  };

  const clearSession = () => {
    localStorage.removeItem('ogo_session');
  };

  const logSessionExpiry = async (email: string) => {
    try {
      await supabase.from('log').insert({
        admin_email: email,
        action: 'session_expired',
      });
    } catch (error) {
      console.error('Error logging session expiry:', error);
    }
  };

  useEffect(() => {
    const checkExistingSession = () => {
      try {
        const sessionData = localStorage.getItem('ogo_session');
        if (sessionData) {
          const session: SessionData = JSON.parse(sessionData);
          const currentTime = Date.now();
          const sessionAge = currentTime - session.loginTime;
          const maxSessionAge = 24 * 60 * 60 * 1000;

          if (sessionAge < maxSessionAge) {
            setIsAuthenticated(true);
            setCurrentUserEmail(session.email);
            if (session.adminId) {
              setCurrentUserId(session.adminId);
            } else {
              void fetchAdminId(session.email);
            }
          } else {
            localStorage.removeItem('ogo_session');
            void logSessionExpiry(session.email);
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
        localStorage.removeItem('ogo_session');
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(checkExistingSession, 150);
    const minLoadingTimer = setTimeout(() => setMinLoadingDone(true), 5000);

    return () => {
      clearTimeout(timer);
      clearTimeout(minLoadingTimer);
    };
  }, []);

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = async () => {
    try {
      if (currentUserEmail) {
        await supabase.from('log').insert({
          admin_email: currentUserEmail,
          action: 'logout',
        });
      }
    } catch (error) {
      console.error('Error logging logout event:', error);
    } finally {
      clearSession();
      setIsAuthenticated(false);
      setCurrentUserEmail(null);
      setCurrentUserId(null);
      setShowLogoutConfirm(false);
    }
  };

  const handleLogoutShortcut = () => {
    if (showLogoutConfirm) {
      void handleLogoutConfirm();
    } else {
      setShowLogoutConfirm(true);
    }
  };

  const handleLogoutCancel = () => {
    setShowLogoutConfirm(false);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.key === 'Escape' && showLogoutConfirm) {
        setShowLogoutConfirm(false);
      }

      if (event.key === 'Enter' && showLogoutConfirm) {
        event.preventDefault();
        void handleLogoutConfirm();
      }

      if (event.altKey && event.key === 'l') {
        event.preventDefault();
        handleLogoutShortcut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLogoutConfirm]);

  useEffect(() => {
    const handleSwitchToProjectsTab = () => {
      setActiveTab('projects');
    };

    window.addEventListener('switchToProjectsTab', handleSwitchToProjectsTab);
    return () => window.removeEventListener('switchToProjectsTab', handleSwitchToProjectsTab);
  }, []);

  const handleLoginSuccess = async (email: string) => {
    await createSession(email);
    setIsAuthenticated(true);
    setCurrentUserEmail(email);
  };

  const renderPage = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <Dashboard
            key="dashboard"
            projects={projects}
            employees={employees}
            onRefresh={() => {
              refetchProjects();
              refetchEmployees();
            }}
          />
        );
      case "analytics":
        return (
          <Analytics
            projects={projects}
            employees={employees}
            onRefresh={() => {
              refetchProjects();
              refetchEmployees();
            }}
          />
        );
      case "projects":
        return <ProjectManagement employees={employees} />;
      case "employees":
        return <EmployeeManagement projects={projects} />;
      case "calendar":
        return <Calendar projects={projects} onRefresh={refetchProjects} />;
      case "settings":
        return <Settings />;
      default:
        return (
          <Dashboard
            projects={projects}
            employees={employees}
            onRefresh={() => {
              refetchProjects();
              refetchEmployees();
            }}
          />
        );
    }
  };

  if (isLoading || !minLoadingDone) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <LastRefreshProvider>
      <div className="min-h-screen bg-gradient-to-br from-[#363333] via-[#272121] to-[#363333]">
        <Header
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          syncProps={{
            isOnline,
            pendingChanges: totalPendingChanges,
            isSyncing,
            onSync: syncAll,
            lastSyncTime: projectsLastSync,
          }}
        />
        <Navigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
          onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onLogout={handleLogoutClick}
        />
        <main
          className={`p-3 sm:p-6 mt-[4.5rem] sm:mt-[5rem] transition-all duration-300 min-w-0 overflow-x-hidden ${
            sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
          } ${activeTab === 'calendar' ? 'overflow-hidden' : ''} ${
            activeTab === 'projects' ? 'lg:overflow-hidden' : ''
          }`}
        >
          <div
            className={`mx-auto w-full min-w-0 ${
              activeTab === 'calendar' || activeTab === 'projects'
                ? 'max-w-none'
                : 'max-w-7xl'
            }`}
          >
            {renderPage()}
          </div>
        </main>

        {showLogoutConfirm && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
            onClick={handleLogoutCancel}
          >
            <div
              className="w-full max-w-[280px] p-6 animate-scaleIn text-center"
              onClick={e => e.stopPropagation()}
            >
              {/* Icon orbit */}
              <div className="relative mx-auto mb-5 h-[4.5rem] w-[4.5rem]">
                <span
                  className="absolute inset-0 rounded-full border border-red-400/25 opacity-60"
                  style={{ animation: 'logout-ring 2.4s ease-out infinite' }}
                />
                <span
                  className="absolute inset-2 rounded-full border border-[#E16428]/20 opacity-50"
                  style={{ animation: 'logout-ring 2.4s ease-out 0.6s infinite' }}
                />
                <div className="relative flex h-full w-full items-center justify-center rounded-full border border-red-400/40 bg-gradient-to-br from-red-500/15 to-transparent">
                  <LogOut
                    className="h-6 w-6 text-red-400 transition-transform duration-300 group-hover:translate-x-0.5"
                    style={{ animation: 'logout-icon 2.8s ease-in-out infinite' }}
                  />
                </div>
              </div>

              <h3 className="text-2xl font-semibold tracking-tight text-[#F6E9E9] font-['Playfair_Display']">
                Head out?
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#F6E9E9]/55 font-['Inter']">
                Your session ends here. Sign in again to pick up where you left off.
              </p>

              {/* Dual path actions */}
              <div className="mt-6 space-y-2.5">
                <button
                  type="button"
                  onClick={() => void handleLogoutConfirm()}
                  className="group w-full flex items-center justify-center gap-2 py-3 border-0 border-b-2 border-red-500/70 rounded-none bg-transparent text-sm font-semibold text-red-400 hover:text-red-300 hover:border-red-400 transition-all duration-200 font-['Inter'] focus:outline-none"
                >
                  <LogOut className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-0.5" />
                  <span>Yes, log out</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogoutCancel}
                  className="w-full py-2.5 border-0 border-b border-transparent rounded-none bg-transparent text-sm text-[#F6E9E9]/50 hover:text-[#F6E9E9] hover:border-[#F6E9E9]/25 transition-all duration-200 font-['Inter'] focus:outline-none"
                >
                  Stay signed in
                </button>
              </div>

              <p className="mt-5 hidden sm:block text-[10px] tracking-[0.18em] uppercase text-[#F6E9E9]/25 font-['Inter']">
                Esc to stay · Enter to leave
              </p>

              <style>{`
                @keyframes logout-ring {
                  0% { transform: scale(0.85); opacity: 0.55; }
                  70% { transform: scale(1.25); opacity: 0; }
                  100% { transform: scale(1.25); opacity: 0; }
                }
                @keyframes logout-icon {
                  0%, 100% { transform: translateX(0) rotate(-8deg); }
                  50% { transform: translateX(3px) rotate(-4deg); }
                }
              `}</style>
            </div>
          </div>
        )}
      </div>
    </LastRefreshProvider>
  );
}
