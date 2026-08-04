import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  FolderOpen,
  CalendarDays,
  Users,
  Wallet,
  BarChart3,
  Settings,
  X,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Keyboard,
} from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onSidebarToggle: () => void;
  onLogout: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'Alt+1', key: '1' },
  { id: 'projects', label: 'Projects', icon: FolderOpen, shortcut: 'Alt+2', key: '2' },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, shortcut: 'Alt+3', key: '3' },
  { id: 'employees', label: 'Employees', icon: Users, shortcut: 'Alt+4', key: '4' },
  { id: 'expenses', label: 'Expenses', icon: Wallet, shortcut: 'Alt+5', key: '5' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, shortcut: 'Alt+6', key: '6' },
  { id: 'settings', label: 'Settings', icon: Settings, shortcut: 'Alt+7', key: '7' },
] as const;

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  collapsed,
  mobileOpen,
  onMobileClose,
  onSidebarToggle,
  onLogout,
}) => {
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.altKey && /^[1-7]$/.test(event.key)) {
        event.preventDefault();
        const tabIndex = parseInt(event.key, 10) - 1;
        if (navItems[tabIndex]) {
          setActiveTab(navItems[tabIndex].id);
          if (mobileOpen) onMobileClose();
        }
      }

      if (event.ctrlKey && event.key === '/') {
        event.preventDefault();
        setShowShortcutsHelp(true);
      }

      if (event.key === 'Escape' && showShortcutsHelp) {
        setShowShortcutsHelp(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab, mobileOpen, onMobileClose, showShortcutsHelp]);

  const handleItemClick = (itemId: string) => {
    setActiveTab(itemId);
    onMobileClose();
  };

  const renderNavButton = (
    item: (typeof navItems)[number],
    opts: { compact?: boolean; mobile?: boolean } = {}
  ) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    const isHovered = hoveredId === item.id;
    const compact = !!opts.compact;
    const mobile = !!opts.mobile;

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => (mobile ? handleItemClick(item.id) : setActiveTab(item.id))}
        onMouseEnter={() => setHoveredId(item.id)}
        onMouseLeave={() => setHoveredId(null)}
        title={`${item.label} (${item.shortcut})`}
        className={`group relative w-full flex items-center gap-3 overflow-hidden bg-transparent border-0 rounded-none transition-all duration-300 focus:outline-none ${
          compact ? 'justify-center px-0 py-3.5' : 'px-3 py-3'
        } ${isActive ? 'text-[#E16428]' : 'text-[#F6E9E9]/55 hover:text-[#F6E9E9]'}`}
      >
        {/* Active / hover rail */}
        <span
          className={`absolute left-0 top-1/2 -translate-y-1/2 w-[2px] rounded-full bg-[#E16428] transition-all duration-300 ease-out ${
            isActive
              ? 'h-7 opacity-100 shadow-[0_0_12px_rgba(225,100,40,0.55)]'
              : isHovered
                ? 'h-4 opacity-50'
                : 'h-0 opacity-0'
          }`}
        />

        <Icon
          className={`w-[1.15rem] h-[1.15rem] shrink-0 transition-transform duration-300 ${
            isActive || isHovered ? 'scale-110' : 'scale-100'
          } ${isActive ? 'text-[#E16428]' : ''}`}
          strokeWidth={isActive ? 2.25 : 1.75}
        />

        {!compact && (
          <>
            <span
              className={`flex-1 text-left text-[13px] font-['Inter'] tracking-wide transition-all duration-300 ${
                isActive ? 'font-medium' : 'font-normal'
              }`}
            >
              {item.label}
            </span>
            <span
              className={`text-[10px] font-mono tracking-wider transition-all duration-300 ${
                isActive
                  ? 'text-[#E16428]/70 opacity-100'
                  : 'text-[#F6E9E9]/25 opacity-0 group-hover:opacity-100'
              }`}
            >
              {item.key}
            </span>
            {/* Underline grow */}
            <span
              className={`absolute bottom-1.5 left-3 right-3 h-px origin-left bg-gradient-to-r from-[#E16428]/80 to-transparent transition-transform duration-300 ease-out ${
                isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-50'
              }`}
            />
          </>
        )}

        {/* Collapsed flyout tip */}
        {compact && (
          <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 z-50 flex items-center gap-2 opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
            <span className="h-px w-2 bg-[#E16428]/50" />
            <span className="whitespace-nowrap px-0 py-0.5 text-[12px] font-['Inter'] text-[#F6E9E9] border-b border-[#E16428]/40">
              {item.label}
              <span className="ml-2 font-mono text-[10px] text-[#E16428]/80">{item.shortcut}</span>
            </span>
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-fadeIn"
          onClick={onMobileClose}
        />
      )}

      {/* Desktop sidebar */}
      <nav
        className={`fixed left-0 top-16 sm:top-20 bottom-0 z-30 hidden lg:flex flex-col transition-all duration-300 ease-out ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Soft vertical atmosphere */}
        <div
          className="pointer-events-none absolute inset-0 border-r border-[#E16428]/15"
          style={{
            background:
              'linear-gradient(180deg, rgba(39,33,33,0.55) 0%, rgba(26,24,24,0.35) 45%, rgba(39,33,33,0.5) 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute top-0 right-0 w-px h-full opacity-60"
          style={{
            background:
              'linear-gradient(180deg, transparent 0%, rgba(225,100,40,0.45) 30%, rgba(225,100,40,0.15) 70%, transparent 100%)',
          }}
        />

        <div className="relative flex flex-col h-full min-h-0">
          {/* Brand strip (expanded only) */}
          {!collapsed && (
            <div className="shrink-0 pt-5 pb-3 px-4 transition-all duration-300">
              <div className="pl-1">
                <p className="text-[10px] tracking-[0.22em] uppercase text-[#E16428]/80 font-['Inter']">
                  Navigate
                </p>
                <p className="mt-0.5 text-[11px] text-[#F6E9E9]/30 font-['Inter']">
                  Alt + 1–6
                </p>
              </div>
            </div>
          )}

          {/* Nav items */}
          <div
            className={`flex-1 min-h-0 overflow-y-auto overflow-x-visible py-1 space-y-0.5 ${
              collapsed ? 'px-2' : 'px-2'
            }`}
          >
            {navItems.map(item => renderNavButton(item, { compact: collapsed }))}
          </div>

          {/* Collapse control */}
          <div
            className={`shrink-0 py-2 flex ${collapsed ? 'justify-center px-2' : 'justify-end px-3'}`}
          >
            <button
              type="button"
              onClick={onSidebarToggle}
              className="group flex items-center gap-1.5 p-2 bg-transparent border-0 border-b border-transparent rounded-none text-[#F6E9E9]/35 hover:text-[#E16428] hover:border-[#E16428]/40 transition-all duration-200 focus:outline-none"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              ) : (
                <>
                  <span className="text-[10px] tracking-wider uppercase font-['Inter']">Hide</span>
                  <ChevronLeft className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Footer */}
          <div
            className={`shrink-0 pb-4 pt-2 border-t border-[#E16428]/10 ${
              collapsed ? 'px-2' : 'px-3'
            }`}
          >
            <button
              type="button"
              onClick={() => setShowShortcutsHelp(true)}
              title="Keyboard Shortcuts (Ctrl+/)"
              className={`group relative w-full flex items-center gap-3 bg-transparent border-0 rounded-none text-[#F6E9E9]/45 hover:text-[#E16428] transition-colors duration-200 focus:outline-none ${
                collapsed ? 'justify-center py-3' : 'px-3 py-2.5'
              }`}
            >
              <Keyboard className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              {!collapsed && (
                <span className="flex-1 text-left text-[12px] font-['Inter']">Shortcuts</span>
              )}
              {!collapsed && (
                <kbd className="text-[10px] font-mono text-[#E16428]/50 group-hover:text-[#E16428]/80">
                  /
                </kbd>
              )}
              {collapsed && (
                <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-[12px] text-[#E16428] border-b border-[#E16428]/40">
                  Shortcuts · Ctrl+/
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onLogout}
              data-shortcut="logout"
              title="Logout (Alt+L)"
              className={`group relative w-full flex items-center gap-3 bg-transparent border-0 rounded-none text-[#F6E9E9]/40 hover:text-red-400 transition-colors duration-200 focus:outline-none ${
                collapsed ? 'justify-center py-3' : 'px-3 py-2.5'
              }`}
            >
              <LogOut className="w-4 h-4 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={1.75} />
              {!collapsed && (
                <span className="flex-1 text-left text-[12px] font-['Inter']">Logout</span>
              )}
              {!collapsed && (
                <kbd className="text-[10px] font-mono text-red-400/40 group-hover:text-red-400/70">
                  L
                </kbd>
              )}
              {collapsed && (
                <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-[12px] text-red-400 border-b border-red-400/40">
                  Logout · Alt+L
                </span>
              )}
            </button>

            <div
              className={`mt-3 text-center transition-all duration-300 overflow-hidden ${
                collapsed ? 'max-h-0 opacity-0' : 'max-h-12 opacity-100'
              }`}
            >
              <p className="text-[10px] tracking-[0.14em] uppercase text-[#F6E9E9]/30 font-['Inter']">
                ogo manager
              </p>
              <p className="text-[10px] text-[#E16428]/50 font-mono mt-0.5">V.26 · 2026</p>
            </div>
            {collapsed && (
              <p className="mt-2 text-center text-[9px] font-mono text-[#E16428]/40">26</p>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile sidebar */}
      <nav
        className={`fixed left-0 top-0 bottom-0 z-50 w-[min(18rem,88vw)] flex flex-col lg:hidden transition-transform duration-300 ease-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background:
            'linear-gradient(165deg, rgba(39,33,33,0.98) 0%, rgba(26,24,24,0.97) 50%, rgba(39,33,33,0.98) 100%)',
          borderRight: '1px solid rgba(225,100,40,0.18)',
        }}
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-5 pb-4 border-b border-[#E16428]/12">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/logo_ogo.png"
              alt="OGO"
              className="w-11 h-11 object-contain shrink-0"
            />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[#F6E9E9] font-['Playfair_Display'] truncate leading-tight">
                Manager Pro
              </h2>
              <p className="text-[10px] tracking-[0.16em] uppercase text-[#E16428]/70 font-['Inter']">
                Menu
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onMobileClose}
            className="p-2 bg-transparent border-0 border-b border-transparent rounded-none text-[#F6E9E9]/50 hover:text-[#E16428] hover:border-[#E16428]/40 transition-colors focus:outline-none"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {navItems.map(item => renderNavButton(item, { mobile: true }))}
        </div>

        <div className="shrink-0 px-3 pb-5 pt-2 border-t border-[#E16428]/12">
          <button
            type="button"
            onClick={() => {
              setShowShortcutsHelp(true);
              onMobileClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 bg-transparent border-0 rounded-none text-[#F6E9E9]/45 hover:text-[#E16428] transition-colors font-['Inter'] text-[12px] focus:outline-none"
          >
            <Keyboard className="w-4 h-4" strokeWidth={1.75} />
            Shortcuts
          </button>
          <button
            type="button"
            onClick={() => {
              onLogout();
              onMobileClose();
            }}
            data-shortcut="logout"
            className="w-full flex items-center gap-3 px-3 py-2.5 bg-transparent border-0 rounded-none text-[#F6E9E9]/40 hover:text-red-400 transition-colors font-['Inter'] text-[12px] focus:outline-none"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.75} />
            Logout
          </button>
          <p className="mt-3 text-center text-[10px] tracking-[0.14em] uppercase text-[#F6E9E9]/28 font-['Inter']">
            ogo manager · V.26
          </p>
        </div>
      </nav>

      {/* Keyboard Shortcuts Help */}
      {showShortcutsHelp && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
          onClick={() => setShowShortcutsHelp(false)}
        >
          <div
            className="w-full max-w-[380px] p-6 animate-scaleIn"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="relative mx-auto mb-4 h-[3.75rem] w-[3.75rem]">
                <span
                  className="absolute inset-0 rounded-full border border-[#E16428]/25 opacity-60"
                  style={{ animation: 'shortcut-ring 2.4s ease-out infinite' }}
                />
                <span
                  className="absolute inset-1.5 rounded-full border border-[#E16428]/15 opacity-50"
                  style={{ animation: 'shortcut-ring 2.4s ease-out 0.55s infinite' }}
                />
                <div className="relative flex h-full w-full items-center justify-center rounded-full border border-[#E16428]/40 bg-gradient-to-br from-[#E16428]/15 to-transparent">
                  <Keyboard className="h-5 w-5 text-[#E16428]" />
                </div>
              </div>
              <h3 className="text-2xl font-semibold tracking-tight text-[#F6E9E9] font-['Playfair_Display']">
                Quick keys
              </h3>
              <p className="mt-1 text-[12px] text-[#F6E9E9]/45 font-['Inter']">
                Jump around without the mouse
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-5 gap-y-1">
              {[
                ...navItems.map(item => ({
                  label: item.label,
                  keys: item.shortcut,
                })),
                { label: 'Add Project', keys: 'Alt+A' },
                { label: 'Search', keys: 'Alt+K' },
                { label: 'Global Search', keys: 'Ctrl+K' },
                { label: 'Shortcuts', keys: 'Ctrl+/' },
                { label: 'Logout', keys: 'Alt+L' },
              ].map(row => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-2 py-2.5 border-b border-[#E16428]/15"
                >
                  <span className="text-[12px] sm:text-[13px] text-[#F6E9E9]/75 font-['Inter'] truncate">
                    {row.label}
                  </span>
                  <kbd className="shrink-0 px-0 py-0.5 border-0 border-b border-[#E16428]/55 rounded-none bg-transparent text-[10px] sm:text-[11px] font-mono tracking-wide text-[#E16428]">
                    {row.keys}
                  </kbd>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowShortcutsHelp(false)}
              className="mt-5 w-full py-2.5 border-0 border-b-2 border-[#E16428] rounded-none bg-transparent text-sm font-medium text-[#E16428] hover:text-[#f07a42] hover:border-[#f07a42] transition-colors font-['Inter'] focus:outline-none"
            >
              Got it
            </button>
            <p className="mt-3 text-center text-[10px] tracking-[0.18em] uppercase text-[#F6E9E9]/25 font-['Inter']">
              Esc to close
            </p>

            <style>{`
              @keyframes shortcut-ring {
                0% { transform: scale(0.85); opacity: 0.55; }
                70% { transform: scale(1.25); opacity: 0; }
                100% { transform: scale(1.25); opacity: 0; }
              }
            `}</style>
          </div>
        </div>
      )}
    </>
  );
};
