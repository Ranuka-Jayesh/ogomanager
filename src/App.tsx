import { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { Navigation } from "./components/Navigation";
import { Dashboard } from "./components/Dashboard";
import { Analytics } from "./components/Analytics";
import { ProjectManagement } from "./components/ProjectManagement";
import { EmployeeManagement } from "./components/EmployeeManagement";
import { Settings } from "./components/Settings";
import { LoginPage } from "./components/LoginPage";
import { useProjects } from "./hooks/useProjects";
import { useEmployees } from "./hooks/useEmployees";
import { supabase } from "./supabaseClient";
import { LogOut } from "lucide-react";
import LoadingScreen from "./components/LoadingScreen";

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

  const { projects } = useProjects();
  const { employees } = useEmployees();

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
            setIsAuthenticated(true);
            setCurrentUserEmail(session.email);
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

    checkExistingSession();
    // Minimum 5 seconds loading
    const timer = setTimeout(() => setMinLoadingDone(true), 5000);
    return () => clearTimeout(timer);
  }, []);

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

  const handleLoginSuccess = (email: string) => {
    createSession(email);
    setIsAuthenticated(true);
    setCurrentUserEmail(email);
  };

  const renderPage = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard projects={projects} employees={employees} />;
      case "analytics":
        return <Analytics projects={projects} employees={employees} />;
      case "projects":
        return <ProjectManagement employees={employees} />;
      case "employees":
        return <EmployeeManagement />;
      case "settings":
        return <Settings />;
      default:
        return <Dashboard projects={projects} employees={employees} />;
    }
  };

  if (isLoading || !minLoadingDone) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#363333] via-[#272121] to-[#363333]">
        <Header 
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
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
  );
}