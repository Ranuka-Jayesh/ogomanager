import React, { useEffect, useState } from 'react';
import { Home, FolderOpen, Users, BarChart3, X, ChevronLeft, ChevronRight, Settings as SettingsIcon, LogOut, Keyboard } from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onSidebarToggle: () => void;
  onLogout: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ 
  activeTab, 
  setActiveTab, 
  collapsed, 
  mobileOpen, 
  onMobileClose, 
  onSidebarToggle,
  onLogout
}) => {
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, shortcut: 'Alt + 1' },
    { id: 'projects', label: 'Projects', icon: FolderOpen, shortcut: 'Alt + 2' },
    { id: 'employees', label: 'Employees', icon: Users, shortcut: 'Alt + 3' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, shortcut: 'Alt + 4' },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, shortcut: 'Alt + 5' },
  ];

  // Keyboard shortcuts for navigation and help
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent shortcuts when typing in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) {
        return;
      }

      // Alt + 1-5: Navigate to different tabs
      if (event.altKey && /^[1-5]$/.test(event.key)) {
        event.preventDefault();
        const tabIndex = parseInt(event.key) - 1;
        if (navItems[tabIndex]) {
          setActiveTab(navItems[tabIndex].id);
          // Close mobile menu if open
          if (mobileOpen) {
            onMobileClose();
          }
        }
      }

      // Ctrl + /: Show shortcuts help
      if (event.ctrlKey && event.key === '/') {
        event.preventDefault();
        setShowShortcutsHelp(true);
      }

      // Escape: Close shortcuts help
      if (event.key === 'Escape' && showShortcutsHelp) {
        setShowShortcutsHelp(false);
      }

      // Alt + L: Logout (handled in App component)
      // Removed from here to avoid conflicts
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab, mobileOpen, onMobileClose, showShortcutsHelp]);

  const handleItemClick = (itemId: string) => {
    setActiveTab(itemId);
    onMobileClose();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Desktop Sidebar */}
      <nav className={`fixed left-0 top-16 sm:top-20 bottom-0 z-30 backdrop-blur-md bg-[#272121]/30 border-r border-[#E16428]/20 transition-all duration-300 ease-in-out hidden lg:block ${
        collapsed ? 'w-20' : 'w-64'
      }`}>
        <div className="flex flex-col h-full">
          <div className="p-4 space-y-2 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center ${collapsed ? 'justify-center' : 'space-x-3'} px-4 py-3 rounded-lg transition-all duration-300 font-['Poppins'] group ${
                  isActive
                    ? 'bg-gradient-to-r from-[#E16428] to-[#E16428]/80 text-white shadow-lg scale-105'
                    : 'text-[#F6E9E9]/80 hover:bg-[#E16428]/10 hover:text-[#F6E9E9] hover:scale-102'
                }`}
                title={collapsed ? `${item.label} (${item.shortcut})` : `${item.label} (${item.shortcut})`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && (
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium">{item.label}</span>
                    <kbd className="px-2 py-1 bg-[#E16428]/20 text-[#E16428] rounded text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {item.shortcut.split(' ')[1]}
                    </kbd>
                  </div>
                )}
                {/* Tooltip for collapsed state */}
                {collapsed && (
                  <div className="absolute left-16 bg-[#272121] text-[#F6E9E9] px-2 py-1 rounded text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    {item.label} ({item.shortcut})
                  </div>
                )}
              </button>
            );
          })}
          </div>
          {/* Sidebar Collapse/Expand Button */}
          <div className={`p-4 border-t border-[#E16428]/10 transition-all duration-300 ${collapsed ? 'flex justify-center' : 'flex justify-end'}`}>
            <button
              onClick={onSidebarToggle}
              className="p-2 bg-transparent rounded-full hover:bg-[#E16428]/10 text-[#F6E9E9]/70 hover:text-[#F6E9E9] transition-all duration-300"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <ChevronLeft className="w-5 h-5" />
              )}
            </button>
          </div>
          
          {/* Sidebar Footer */}
          <div className="p-4 border-t border-[#E16428]/10">
            {/* Shortcuts Help Button */}
            <button
              onClick={() => setShowShortcutsHelp(true)}
              className={`w-full flex items-center ${collapsed ? 'justify-center' : 'space-x-3'} px-4 py-3 mb-3 rounded-lg transition-all duration-300 font-['Poppins'] text-[#E16428] hover:bg-[#E16428]/10 hover:text-[#E16428]/80 hover:scale-102`}
              title={collapsed ? 'Shortcuts (Ctrl+/)' : 'Keyboard Shortcuts (Ctrl+/)'}
            >
              <Keyboard className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium">Shortcuts</span>}
              {/* Tooltip for collapsed state */}
              {collapsed && (
                <div className="absolute left-16 bg-[#272121] text-[#E16428] px-2 py-1 rounded text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  Shortcuts (Ctrl+/)
                </div>
              )}
            </button>
            
            {/* Logout Button */}
            <button
              onClick={onLogout}
              data-shortcut="logout"
              className={`w-full flex items-center ${collapsed ? 'justify-center' : 'space-x-3'} px-4 py-3 mb-3 rounded-lg transition-all duration-300 font-['Poppins'] text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:scale-102`}
              title={collapsed ? 'Logout (Alt+L)' : 'Logout (Alt+L)'}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium">Logout</span>}
              {/* Tooltip for collapsed state */}
              {collapsed && (
                <div className="absolute left-16 bg-[#272121] text-red-400 px-2 py-1 rounded text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  Logout (Alt+L)
                </div>
              )}
            </button>
            <div className={`transition-all duration-300 ${collapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
              <p className="text-xs text-center text-[#F6E9E9]/50 font-['Poppins']">
                ogo manager V.04
              </p>
              <p className="text-xs text-center text-[#F6E9E9]/30 font-['Poppins'] mt-1">
                2025
              </p>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Sidebar */}
      <nav className={`fixed left-0 top-0 bottom-0 z-50 w-64 backdrop-blur-md bg-[#272121]/95 border-r border-[#E16428]/20 transform transition-transform duration-300 ease-in-out lg:hidden flex flex-col ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 flex items-center justify-center">
                <img
                  src="/2OGOlogo.png"
                  alt="OGO Logo"
                  className="w-10 h-10 object-contain rounded-xl shadow-lg p-1 border-0 sm:border-2 sm:border-white"
                />
              </div>
              <h2 className="text-lg font-bold text-[#F6E9E9] font-['Playfair_Display']">
                Manager Pro
              </h2>
            </div>
            <button
              onClick={onMobileClose}
              className="p-2 bg-[#272121]/50 text-[#F6E9E9] rounded-lg hover:bg-[#E16428]/20 transition-all duration-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-300 font-['Poppins'] ${
                    isActive
                      ? 'bg-gradient-to-r from-[#E16428] to-[#E16428]/80 text-white shadow-lg'
                      : 'text-[#F6E9E9]/80 hover:bg-[#E16428]/10 hover:text-[#F6E9E9]'
                  }`}
                  title={`${item.label} (${item.shortcut})`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <kbd className="px-2 py-1 bg-[#E16428]/20 text-[#E16428] rounded text-xs font-mono">
                    {item.shortcut.split(' ')[1]}
                  </kbd>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Mobile Sidebar Footer */}
        <div className="p-4 border-t border-[#E16428]/10 flex-shrink-0">
          {/* Mobile Shortcuts Help Button */}
          <button
            onClick={() => setShowShortcutsHelp(true)}
            className="w-full flex items-center space-x-3 px-4 py-3 mb-3 rounded-lg transition-all duration-300 font-['Poppins'] text-[#E16428] hover:bg-[#E16428]/10 hover:text-[#E16428]/80"
            title="Keyboard Shortcuts (Ctrl+/)"
          >
            <Keyboard className="w-5 h-5" />
            <span className="font-medium">Shortcuts</span>
          </button>
          
          {/* Mobile Logout Button */}
          <button
            onClick={() => {
              onLogout();
              onMobileClose();
            }}
            data-shortcut="logout"
            className="w-full flex items-center space-x-3 px-4 py-3 mb-3 rounded-lg transition-all duration-300 font-['Poppins'] text-red-400 hover:bg-red-500/10 hover:text-red-300"
            title="Logout (Alt+L)"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
          <p className="text-xs text-center text-[#F6E9E9]/50 font-['Poppins']">
            ogo manager V.04
          </p>
          <p className="text-xs text-center text-[#F6E9E9]/30 font-['Poppins'] mt-1">
            2025
          </p>
        </div>
      </nav>

      {/* Keyboard Shortcuts Help Popup */}
      {showShortcutsHelp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[999] animate-fadeIn">
          <div className="bg-[#272121] rounded-xl p-4 max-w-md w-full mx-4 border border-[#E16428]/20 shadow-2xl animate-scaleIn">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-[#E16428]" />
                <h3 className="text-lg font-bold text-[#F6E9E9] font-['Inter']">
                  Quick Shortcuts
                </h3>
              </div>
              <button
                onClick={() => setShowShortcutsHelp(false)}
                className="p-1.5 hover:bg-[#363333] rounded-lg transition-all duration-200"
                title="Close (Esc)"
              >
                <X className="w-4 h-4 text-[#F6E9E9]" />
              </button>
            </div>

            {/* Compact Shortcuts List */}
            <div className="space-y-2 mb-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center justify-between p-2 bg-[#363333]/50 rounded-lg">
                  <span className="text-[#F6E9E9]">Dashboard</span>
                  <kbd className="px-1.5 py-0.5 bg-[#E16428]/20 text-[#E16428] rounded text-xs font-mono">Alt+1</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-[#363333]/50 rounded-lg">
                  <span className="text-[#F6E9E9]">Projects</span>
                  <kbd className="px-1.5 py-0.5 bg-[#E16428]/20 text-[#E16428] rounded text-xs font-mono">Alt+2</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-[#363333]/50 rounded-lg">
                  <span className="text-[#F6E9E9]">Employees</span>
                  <kbd className="px-1.5 py-0.5 bg-[#E16428]/20 text-[#E16428] rounded text-xs font-mono">Alt+3</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-[#363333]/50 rounded-lg">
                  <span className="text-[#F6E9E9]">Analytics</span>
                  <kbd className="px-1.5 py-0.5 bg-[#E16428]/20 text-[#E16428] rounded text-xs font-mono">Alt+4</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-[#363333]/50 rounded-lg">
                  <span className="text-[#F6E9E9]">Settings</span>
                  <kbd className="px-1.5 py-0.5 bg-[#E16428]/20 text-[#E16428] rounded text-xs font-mono">Alt+5</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-[#363333]/50 rounded-lg">
                  <span className="text-[#F6E9E9]">Add Project</span>
                  <kbd className="px-1.5 py-0.5 bg-[#E16428]/20 text-[#E16428] rounded text-xs font-mono">Alt+A</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-[#363333]/50 rounded-lg">
                  <span className="text-[#F6E9E9]">Search</span>
                  <kbd className="px-1.5 py-0.5 bg-[#E16428]/20 text-[#E16428] rounded text-xs font-mono">Alt+K</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-[#363333]/50 rounded-lg">
                  <span className="text-[#F6E9E9]">Global Search</span>
                  <kbd className="px-1.5 py-0.5 bg-[#E16428]/20 text-[#E16428] rounded text-xs font-mono">Ctrl+K</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-[#363333]/50 rounded-lg">
                  <span className="text-[#F6E9E9]">Logout</span>
                  <kbd className="px-1.5 py-0.5 bg-[#E16428]/20 text-[#E16428] rounded text-xs font-mono">Alt+L</kbd>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-2 border-t border-[#E16428]/20">
              <button
                onClick={() => setShowShortcutsHelp(false)}
                className="px-4 py-2 bg-[#E16428] text-white rounded-lg hover:bg-[#E16428]/80 transition-all duration-300 text-sm font-medium"
              >
                Got it! (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};