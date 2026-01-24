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
import { LogOut, Fingerprint } from "lucide-react";
import LoadingScreen from "./components/LoadingScreen";
import { LastRefreshProvider } from "./contexts/LastRefreshContext";
import { useMobileNotifications } from "./hooks/useMobileNotifications";
import { useBiometricAuth } from "./hooks/useBiometricAuth";
import { SyncStatus } from "./components/SyncStatus";

interface SessionData {
  email: string;
  loginTime: number;
  sessionId: string;
}

export function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
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
  
  // Combined online status and sync info
  const isOnline = projectsOnline && employeesOnline;
  const totalPendingChanges = projectsPending + employeesPending;
  const isSyncing = projectsSyncing || employeesSyncing;
  
  const syncAll = async () => {
    const projectsResult = await syncProjectsNow();
    const employeesResult = await syncEmployeesNow();
    return projectsResult && employeesResult;
  };
  const { isSupported, hasCredentials, authenticateBiometric } = useBiometricAuth();
  
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [pendingSession, setPendingSession] = useState<SessionData | null>(null);

  // Request notification permission on mobile devices when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Request permission after a short delay to ensure user interaction context
      const timer = setTimeout(() => {
        requestPermission();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, requestPermission]);

  // Handle biometric authentication on app reopen
  const handleBiometricAuth = async () => {
    if (!pendingSession) return;

    try {
      const authenticatedEmail = await authenticateBiometric();
      
      if (authenticatedEmail && authenticatedEmail === pendingSession.email) {
        // Biometric successful, allow access
        setIsAuthenticated(true);
        setCurrentUserEmail(authenticatedEmail);
        setShowBiometricPrompt(false);
        setPendingSession(null);
      } else {
        // Biometric failed or cancelled, redirect to login
        localStorage.removeItem('ogo_session');
        setShowBiometricPrompt(false);
        setPendingSession(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      // On error, redirect to login
      localStorage.removeItem('ogo_session');
      setShowBiometricPrompt(false);
      setPendingSession(null);
      setIsAuthenticated(false);
    }
  };

  // Auto-trigger biometric prompt when it shows
  useEffect(() => {
    if (showBiometricPrompt && isSupported && hasCredentials && pendingSession) {
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        handleBiometricAuth();
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBiometricPrompt, isSupported, hasCredentials, pendingSession]);

  // Check for existing session on app startup
  useEffect(() => {
    const checkExistingSession = () => {
      try {
        const sessionData = localStorage.getItem('ogo_session');
        if (sessionData) {
          const session: SessionData = JSON.parse(sessionData);
          const currentTime = Date.now();
          const sessionAge = currentTime - session.loginTime;
          const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours

          // Check if session is still valid (less than 24 hours old)
          if (sessionAge < maxSessionAge) {
            // Check if biometric is available and enabled (mobile only)
            if (isSupported && hasCredentials) {
              // Show biometric prompt instead of auto-login
              setPendingSession(session);
              setShowBiometricPrompt(true);
            } else {
              // No biometric, auto-login as before
              setIsAuthenticated(true);
              setCurrentUserEmail(session.email);
            }
          } else {
            // Session expired, clear it
            localStorage.removeItem('ogo_session');
            logSessionExpiry(session.email);
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
        localStorage.removeItem('ogo_session');
      } finally {
        setIsLoading(false);
      }
    };

    // Wait a bit for biometric hook to initialize
    const timer = setTimeout(() => {
      checkExistingSession();
    }, 100);
    
    // Minimum 5 seconds loading
    const minLoadingTimer = setTimeout(() => setMinLoadingDone(true), 5000);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(minLoadingTimer);
    };
  }, [isSupported, hasCredentials]);

  // Auto-trigger biometric prompt when it shows
  useEffect(() => {
    if (showBiometricPrompt && isSupported && hasCredentials && pendingSession) {
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        handleBiometricAuth();
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBiometricPrompt, isSupported, hasCredentials, pendingSession]);

  const createSession = (email: string) => {
    const sessionData: SessionData = {
      email,
      loginTime: Date.now(),
      sessionId: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    };
    localStorage.setItem('ogo_session', JSON.stringify(sessionData));
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

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutShortcut = () => {
    if (showLogoutConfirm) {
      // If logout popup is already open, confirm logout
      handleLogoutConfirm();
    } else {
      // If logout popup is not open, show it
      setShowLogoutConfirm(true);
    }
  };

  const handleLogoutConfirm = async () => {
    try {
      // Record logout event in the database
      if (currentUserEmail) {
        await supabase.from('log').insert({
          admin_email: currentUserEmail,
          action: 'logout',
        });
      }
    } catch (error) {
      console.error('Error logging logout event:', error);
    } finally {
      // Clear session and reset authentication state
      clearSession();
      setIsAuthenticated(false);
      setCurrentUserEmail(null);
      setShowLogoutConfirm(false);
    }
  };

  const handleLogoutCancel = () => {
    setShowLogoutConfirm(false);
  };

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent shortcuts when typing in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) {
        return;
      }
      
      // ESC: Close logout confirmation modal
      if (event.key === 'Escape' && showLogoutConfirm) {
        setShowLogoutConfirm(false);
      }
      
      // Alt + L: Logout (with smart behavior)
      if (event.altKey && event.key === 'l') {
        event.preventDefault();
        handleLogoutShortcut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLogoutConfirm]);

  // Listen for tab switch events from Header search
  useEffect(() => {
    const handleSwitchToProjectsTab = () => {
      setActiveTab('projects');
    };

    window.addEventListener('switchToProjectsTab', handleSwitchToProjectsTab);
    return () => window.removeEventListener('switchToProjectsTab', handleSwitchToProjectsTab);
  }, []);

  const handleLoginSuccess = (email: string) => {
    createSession(email);
    setIsAuthenticated(true);
    setCurrentUserEmail(email);
  };

  const renderPage = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard 
          key="dashboard" 
          projects={projects} 
          employees={employees} 
          onRefresh={() => {
            refetchProjects();
            refetchEmployees();
          }}
        />;
      case "analytics":
        return <Analytics 
          projects={projects} 
          employees={employees} 
          onRefresh={() => {
            refetchProjects();
            refetchEmployees();
          }}
        />;
      case "projects":
        return <ProjectManagement employees={employees} />;
      case "employees":
        return <EmployeeManagement />;
      case "calendar":
        return <Calendar 
          projects={projects} 
          onRefresh={refetchProjects}
        />;
      case "settings":
        return <Settings />;
      default:
        return <Dashboard 
          projects={projects} 
          employees={employees} 
          onRefresh={() => {
            refetchProjects();
            refetchEmployees();
          }}
        />;
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
        <main className={`p-4 sm:p-6 mt-16 sm:mt-20 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}>
          <div className="max-w-7xl mx-auto">
          {renderPage()}
        </div>
      </main>

      {/* Biometric Authentication Modal (Mobile Only) */}
      {showBiometricPrompt && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#272121]/95 border border-[#E16428]/30 rounded-2xl shadow-2xl p-8 max-w-md mx-4 animate-fadeIn">
            <div className="text-center">
              <div className="inline-block p-4 bg-[#E16428]/20 rounded-full mb-4 animate-pulse">
                <Fingerprint className="w-12 h-12 text-[#E16428]" />
              </div>
              <h3 className="text-2xl font-bold text-[#F6E9E9] mb-2 font-['Playfair_Display']">
                Unlock Manager Pro
              </h3>
              <p className="text-[#F6E9E9]/70 mb-6">
                Please authenticate with your fingerprint or face ID to continue
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    localStorage.removeItem('ogo_session');
                    setShowBiometricPrompt(false);
                    setPendingSession(null);
                    setIsAuthenticated(false);
                  }}
                  className="flex-1 px-4 py-3 bg-[#1a1818]/80 border border-[#E16428]/30 rounded-lg text-[#F6E9E9] hover:bg-[#E16428]/10 hover:border-[#E16428] transition-all duration-300 font-medium"
                >
                  Use Password Instead
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#272121]/95 border border-[#E16428]/20 rounded-2xl shadow-2xl p-8 max-w-md mx-4 animate-fadeIn">
            <div className="text-center">
              <div className="inline-block p-4 bg-red-500/20 rounded-full mb-4">
                <LogOut className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-[#F6E9E9] mb-2 font-['Playfair_Display']">
                Confirm Logout
              </h3>
              <p className="text-[#F6E9E9]/70 mb-6">
                Are you sure you want to log out? You'll need to sign in again to access the dashboard.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={handleLogoutCancel}
                  className="flex-1 px-4 py-3 bg-[#1a1818]/80 border border-[#E16428]/30 rounded-lg text-[#F6E9E9] hover:bg-[#E16428]/10 hover:border-[#E16428] transition-all duration-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogoutConfirm}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:scale-105 transition-all duration-300 font-medium flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          </div>
      </div>
      )}
      </div>
    </LastRefreshProvider>
  );
}