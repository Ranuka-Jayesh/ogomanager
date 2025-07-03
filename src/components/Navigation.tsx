import React from 'react';
import { Home, FolderOpen, Users, BarChart3, X, ChevronLeft, ChevronRight, Settings as SettingsIcon, LogOut } from 'lucide-react';

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
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'projects', label: 'Projects', icon: FolderOpen },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

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
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="font-medium">{item.label}</span>}
                {/* Tooltip for collapsed state */}
                {collapsed && (
                  <div className="absolute left-16 bg-[#272121] text-[#F6E9E9] px-2 py-1 rounded text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    {item.label}
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
            {/* Logout Button */}
            <button
              onClick={onLogout}
              className={`w-full flex items-center ${collapsed ? 'justify-center' : 'space-x-3'} px-4 py-3 mb-3 rounded-lg transition-all duration-300 font-['Poppins'] text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:scale-102`}
              title={collapsed ? 'Logout' : undefined}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium">Logout</span>}
              {/* Tooltip for collapsed state */}
              {collapsed && (
                <div className="absolute left-16 bg-[#272121] text-red-400 px-2 py-1 rounded text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  Logout
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
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-300 font-['Poppins'] ${
                    isActive
                      ? 'bg-gradient-to-r from-[#E16428] to-[#E16428]/80 text-white shadow-lg'
                      : 'text-[#F6E9E9]/80 hover:bg-[#E16428]/10 hover:text-[#F6E9E9]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Mobile Sidebar Footer */}
        <div className="p-4 border-t border-[#E16428]/10 flex-shrink-0">
          {/* Mobile Logout Button */}
          <button
            onClick={() => {
              onLogout();
              onMobileClose();
            }}
            className="w-full flex items-center space-x-3 px-4 py-3 mb-3 rounded-lg transition-all duration-300 font-['Poppins'] text-red-400 hover:bg-red-500/10 hover:text-red-300"
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
    </>
  );
};