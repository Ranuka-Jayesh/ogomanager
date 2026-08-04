import React, { useEffect, useState, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { DollarSign, Clock, CheckCircle, AlertCircle, FolderOpen, Eye, EyeOff, X, Lock, Fingerprint, KeyRound, Bell } from 'lucide-react';
import { Project, Employee } from '../types';
import { GlassCard } from './GlassCard';
import { MonthYearNavigator } from './MonthYearNavigator';
import { useSupabaseConnection } from '../hooks/useSupabaseConnection';
import { supabase } from '../supabaseClient';
import { useLastRefresh } from '../contexts/LastRefreshContext';
import { useBiometricAuth } from '../hooks/useBiometricAuth';
import { useMobileDetection } from '../hooks/useMobileDetection';
import {
  authenticateWithPin,
  getLastLoginEmail,
  getStoredPinLength,
  loadAdminSecurity,
} from '../utils/adminSecurity';

interface DueSoonSub {
  id: string;
  name: string;
  next_renewal_date: string;
  reminder_days_before: number;
  amount: number;
  image_url: string | null;
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = parseLocalDate(iso);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

interface DashboardProps {
  projects: Project[];
  employees: Employee[];
  onRefresh?: () => void;
  onOpenExpenses?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ projects, employees, onRefresh, onOpenExpenses }) => {
  useSupabaseConnection();
  const { setLastRefresh } = useLastRefresh();
  const isMobile = useMobileDetection();
  const { isSupported: biometricSupported, hasCredentials: hasBiometric, authenticateBiometric } = useBiometricAuth();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(now.getFullYear());
  const [projectTypes, setProjectTypes] = React.useState<{ id: string; name: string }[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [completedCardSlide, setCompletedCardSlide] = useState(0); // 0 = Completed Projects, 1 = Running Projects
  const [dueSoonSubs, setDueSoonSubs] = useState<DueSoonSub[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  
  // Privacy/Hide values state
  const [valuesHidden, setValuesHidden] = useState(true); // Start with values hidden
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const getSessionEmail = (): string | null => {
    try {
      const raw = localStorage.getItem('ogo_session');
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s?.email === 'string') return s.email;
      }
    } catch {
      /* ignore */
    }
    return getLastLoginEmail();
  };

  const revealValues = () => {
    setValuesHidden(false);
    setShowPasswordModal(false);
    setPasswordInput('');
    setPinInput('');
    setPasswordError('');
  };

  // Filter projects by selected month and year (for stats cards)
  const filteredProjects = projects.filter(project => {
    if (!project.createdAt) return false;
    const created = new Date(project.createdAt);
    const monthOk = selectedMonth === 'all' || created.getMonth() === selectedMonth;
    const yearOk = selectedYear === 'all' || created.getFullYear() === selectedYear;
    return monthOk && yearOk;
  });

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    projects.forEach(p => {
      if (!p.createdAt) return;
      const y = new Date(p.createdAt).getFullYear();
      if (Number.isFinite(y)) years.add(y);
    });
    if (years.size === 0) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [projects]);

  const totalRevenue = filteredProjects.reduce((sum, project) => sum + project.price, 0);
  const completedProjects = filteredProjects.filter(p => p.status === 'Delivered' || p.status === 'Pending Payment').length;
  const runningProjects = filteredProjects.filter(p => p.status === 'Running').length;
  const totalPendingPayments = filteredProjects
    .filter(p => p.status === 'Pending Payment' || p.status === 'Pending')
    .reduce((sum, project) => {
      // Calculate balance if not set or if it's a Pending project
      const balance = project.balance !== undefined && project.balance !== null 
        ? project.balance 
        : project.price - project.advance;
      return sum + balance;
    }, 0);

  // Total Upcoming: sum of balance from running projects
  const totalUpcoming = filteredProjects
    .filter(p => p.status === 'Running')
    .reduce((sum, project) => {
      const balance = project.balance !== undefined && project.balance !== null 
        ? project.balance 
        : project.price - project.advance;
      return sum + balance;
    }, 0);

  // Pending / total outstanding (pending + upcoming), no text labels on the amounts
  const totalOutstanding = totalPendingPayments + totalUpcoming;

  // Auto-slide effect for the completed/running projects card
  useEffect(() => {
    const slideInterval = setInterval(() => {
      setCompletedCardSlide(prev => (prev === 0 ? 1 : 0));
    }, 4000); // Switch every 4 seconds

    return () => clearInterval(slideInterval);
  }, []);

  // Active subscriptions that are overdue or within reminder window
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('id, name, next_renewal_date, reminder_days_before, amount, image_url')
          .eq('type', 'subscription')
          .eq('status', 'active')
          .not('next_renewal_date', 'is', null);

        if (cancelled || error || !data) {
          if (!cancelled && error) console.error('Failed to load subscription reminders', error);
          return;
        }

        const due = (data as DueSoonSub[])
          .filter(e => {
            const days = daysUntil(e.next_renewal_date);
            if (days === null) return false;
            const window = e.reminder_days_before ?? 5;
            return days <= window;
          })
          .sort(
            (a, b) =>
              (daysUntil(a.next_renewal_date) ?? 99) - (daysUntil(b.next_renewal_date) ?? 99)
          );

        setDueSoonSubs(due);
      } catch (err) {
        if (!cancelled) console.error('Failed to load subscription reminders', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const overdueCount = useMemo(
    () => dueSoonSubs.filter(e => (daysUntil(e.next_renewal_date) ?? 0) < 0).length,
    [dueSoonSubs]
  );
  const upcomingCount = dueSoonSubs.length - overdueCount;
  const bannerLogoSub = dueSoonSubs.find(e => e.image_url) || null;
  const dueSoonSignature = useMemo(
    () =>
      dueSoonSubs
        .map(e => e.id)
        .sort()
        .join(','),
    [dueSoonSubs]
  );

  useEffect(() => {
    if (!dueSoonSignature) {
      setBannerDismissed(false);
      return;
    }
    try {
      setBannerDismissed(
        sessionStorage.getItem('ogo_dash_sub_banner_dismissed') === dueSoonSignature
      );
    } catch {
      setBannerDismissed(false);
    }
  }, [dueSoonSignature]);

  const dismissSubBanner = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (dueSoonSignature) {
        sessionStorage.setItem('ogo_dash_sub_banner_dismissed', dueSoonSignature);
      }
    } catch {
      /* ignore */
    }
    setBannerDismissed(true);
  };

  // Manual refresh functionality
  const handleRefresh = useCallback(async () => {
    if (onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
        const refreshTime = new Date();
        setLastRefresh(refreshTime);
      } catch (error) {
        console.error('Error refreshing dashboard data:', error);
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [onRefresh, isRefreshing, setLastRefresh]);

  // Auto-refresh when component mounts (when navigating to dashboard)
  useEffect(() => {
    // Small delay to ensure component is fully mounted
    const timer = setTimeout(() => {
      handleRefresh();
    }, 100);
    return () => clearTimeout(timer);
  }, []); // Only run on mount

  // Refresh when window gains focus (user returns to the tab/app)
  useEffect(() => {
    const handleFocus = () => {
      handleRefresh();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        handleRefresh();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleRefresh]);

  // Periodic refresh every 30 seconds when dashboard is active
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        handleRefresh();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [handleRefresh]);

  // Handle visibility toggle
  const handleToggleVisibility = async () => {
    if (valuesHidden) {
      setShowPasswordModal(true);
      setPasswordInput('');
      setPinInput('');
      setPasswordError('');
      const email = getSessionEmail();
      if (email) {
        const prefs = await loadAdminSecurity(email);
        setPinEnabled(prefs.pinEnabled);
      } else {
        setPinEnabled(false);
      }
    } else {
      setValuesHidden(true);
    }
  };

  // Handle password verification (admin table)
  const handlePasswordSubmit = async () => {
    setIsVerifying(true);
    setPasswordError('');
    try {
      const email = getSessionEmail();
      if (!email) {
        setPasswordError('Unable to verify user');
        return;
      }

      const { data: admin, error } = await supabase
        .from('admin')
        .select('id, email, password')
        .ilike('email', email)
        .maybeSingle();

      if (error || !admin || admin.password !== passwordInput) {
        setPasswordError('Incorrect password');
        return;
      }

      revealValues();
    } catch {
      setPasswordError('Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePinSubmit = async (pinValue?: string) => {
    const value = (pinValue ?? pinInput).replace(/\D/g, '');
    const email = getSessionEmail();
    if (!email) {
      setPasswordError('Unable to verify user');
      return;
    }
    const len = getStoredPinLength(email);
    if (value.length < len) return;

    setIsVerifying(true);
    setPasswordError('');
    try {
      const res = await authenticateWithPin(email, value);
      if (!res.ok) {
        setPasswordError('PIN incorrect');
        setPinInput('');
        return;
      }
      revealValues();
    } catch {
      setPasswordError('Verification failed');
      setPinInput('');
    } finally {
      setIsVerifying(false);
    }
  };

  const onPinModalChange = (raw: string) => {
    const email = getSessionEmail();
    const len = email ? getStoredPinLength(email) : 4;
    const digits = raw.replace(/\D/g, '').slice(0, len);
    setPinInput(digits);
    setPasswordError('');
    if (digits.length === len) {
      void handlePinSubmit(digits);
    }
  };

  // Handle biometric authentication (fingerprint)
  const handleBiometricAuth = async () => {
    if (!biometricSupported || !hasBiometric) return;
    
    setIsBiometricLoading(true);
    setPasswordError('');
    
    try {
      const email = await authenticateBiometric();
      const sessionEmail = getSessionEmail();
      
      if (email && (!sessionEmail || email.toLowerCase() === sessionEmail.toLowerCase())) {
        revealValues();
      } else {
        setPasswordError('Fingerprint verification failed');
      }
    } catch {
      setPasswordError('Fingerprint verification failed');
    } finally {
      setIsBiometricLoading(false);
    }
  };

  React.useEffect(() => {
    async function fetchTypes() {
      const { data } = await supabase.from('project_types').select('*');
      if (data) setProjectTypes(data);
    }
    fetchTypes();
  }, []);

  const getProjectTypeNames = (projectDescription: string) => {
    if (!projectDescription) return 'No types specified';
    const typeIds = projectDescription.split(',').map(id => id.trim());
    const typeNames = typeIds.map(id => {
      const type = projectTypes.find(t => t.id === id);
      return type ? type.name : `Unknown Type (${id})`;
    });
    return typeNames.join(', ');
  };

  const stats = [
    {
      title: 'Total Revenue',
      value: `LKR ${totalRevenue.toLocaleString()}`,
      hiddenValue: 'LKR •••••••',
      icon: DollarSign,
      color: 'from-emerald-400 to-emerald-600',
      bgColor: 'bg-emerald-500/10',
      isSensitive: true,
    },
    {
      title: 'Total Projects',
      value: filteredProjects.length,
      hiddenValue: '•••',
      icon: FolderOpen,
      color: 'from-amber-400 to-amber-600',
      bgColor: 'bg-amber-500/10',
      isSensitive: true,
    },
  ];

  // Slideshow data for Completed/Running Projects card
  const completedCardSlides = [
    {
      title: 'Completed Projects',
      value: completedProjects,
      hiddenValue: '•••',
      icon: CheckCircle,
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Running Projects',
      value: runningProjects,
      hiddenValue: '•••',
      icon: Clock,
      bgColor: 'bg-blue-500/10',
    },
  ];

  // Pending payments card — always show pending / total (no text labels)
  const pendingPaymentsValue = (
    <span className="inline-flex items-baseline gap-1 flex-wrap">
      <span className="text-yellow-400">LKR {totalPendingPayments.toLocaleString()}</span>
      <span className="text-[#F6E9E9]/40 font-normal">/</span>
      <span>LKR {totalOutstanding.toLocaleString()}</span>
    </span>
  );

  const allRecentProjects = projects.slice(0, 3);

  // Upcoming deliverables: 3 nearest running projects by deadline (ascending)
  const allUpcomingProjects = projects
    .filter(p => p.status === 'Running')
    .sort((a, b) => new Date(a.deadlineDate).getTime() - new Date(b.deadlineDate).getTime())
    .slice(0, 3);

  const isAssignedTo = (assignedTo: string | undefined, employeeId: string) => {
    if (!assignedTo) return false;
    return assignedTo
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .includes(employeeId);
  };

  const employeePerformanceRows = useMemo(() => {
    return employees
      .map(employee => {
        const empProjects = filteredProjects.filter(p => isAssignedTo(p.assignedTo, employee.id));
        const totalCount = empProjects.length;
        const completedCount = empProjects.filter(
          p => p.status === 'Delivered' || p.status === 'Pending Payment'
        ).length;
        return {
          employee,
          totalCount,
          completedCount,
          isActive: employee.isActive !== false,
        };
      })
      .sort((a, b) => {
        // Higher project count first, then completed
        if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
        if (b.completedCount !== a.completedCount) return b.completedCount - a.completedCount;
        // Active before inactive
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        const nameA = `${a.employee.firstName} ${a.employee.lastName}`.toLowerCase();
        const nameB = `${b.employee.firstName} ${b.employee.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      })
      .slice(0, 5);
  }, [employees, filteredProjects]);

  useEffect(() => {
    // Remove overflow:hidden to allow scrolling
    document.body.style.overflow = '';
    return () => {};
  }, []);


  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn">
      <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#F6E9E9] font-['Playfair_Display'] shrink-0">
          Dashboard Overview
        </h1>
        <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto justify-between sm:justify-end">
          <MonthYearNavigator
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            availableYears={availableYears}
            onChange={(month, year) => {
              setSelectedMonth(month);
              setSelectedYear(year);
            }}
          />
          <button
            type="button"
            onClick={handleToggleVisibility}
            className={`shrink-0 w-9 h-9 aspect-square rounded-lg inline-flex items-center justify-center transition-all duration-300 ${
              valuesHidden
                ? 'bg-[#E16428]/20 text-[#E16428] hover:bg-[#E16428]/30'
                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
            }`}
            title={valuesHidden ? 'Show values' : 'Hide values'}
            aria-label={valuesHidden ? 'Show values' : 'Hide values'}
          >
            {valuesHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <GlassCard key={index} className="p-4 sm:p-6 hover:scale-105 transition-transform duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#F6E9E9]/70 text-sm font-['Inter']">{stat.title}</p>
                  <p className={`text-xl sm:text-2xl font-bold text-[#F6E9E9] mt-1 font-['Poppins'] transition-all duration-300 ${
                    valuesHidden && stat.isSensitive ? 'blur-sm select-none' : ''
                  }`}>
                    {valuesHidden && stat.isSensitive ? stat.hiddenValue : stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </GlassCard>
          );
        })}

        {/* Slideshow Card for Completed / Running Projects */}
        <GlassCard 
          className="p-4 sm:p-6 hover:scale-105 transition-transform duration-300 cursor-pointer relative overflow-hidden"
          onClick={() => setCompletedCardSlide(prev => (prev === 0 ? 1 : 0))}
        >
          <div className="relative h-full">
            {completedCardSlides.map((slide, idx) => {
              const SlideIcon = slide.icon;
              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between transition-all duration-500 ease-in-out ${
                    completedCardSlide === idx 
                      ? 'opacity-100 translate-y-0' 
                      : 'opacity-0 absolute inset-0 translate-y-4'
                  }`}
                >
                  <div>
                    <p className="text-[#F6E9E9]/70 text-sm font-['Inter']">{slide.title}</p>
                    <p className={`text-xl sm:text-2xl font-bold text-[#F6E9E9] mt-1 font-['Poppins'] transition-all duration-300 ${
                      valuesHidden ? 'blur-sm select-none' : ''
                    }`}>
                      {valuesHidden ? slide.hiddenValue : slide.value}
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${slide.bgColor} flex items-center justify-center`}>
                    <SlideIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
        
        {/* Pending / Total outstanding — always visible, no slideshow */}
        <GlassCard className="p-4 sm:p-6 hover:scale-105 transition-transform duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#F6E9E9]/70 text-sm font-['Inter']">Total Pending Payments</p>
              <p className={`text-xl sm:text-2xl font-bold text-[#F6E9E9] mt-1 font-['Poppins'] transition-all duration-300 ${
                valuesHidden ? 'blur-sm select-none' : ''
              }`}>
                {valuesHidden ? 'LKR ••••• / •••••' : pendingPaymentsValue}
              </p>
            </div>
            <div className="p-3 rounded-full bg-purple-500/10 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Upcoming / overdue subscription renewals */}
      {dueSoonSubs.length > 0 && !bannerDismissed && (
        <button
          type="button"
          onClick={onOpenExpenses}
          className={`w-full text-left rounded-xl border px-3.5 py-2.5 flex items-start sm:items-center gap-3 transition-colors ${
            overdueCount > 0
              ? 'border-red-500/30 bg-red-500/10 hover:bg-red-500/15'
              : 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15'
          } ${onOpenExpenses ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <div className="mt-0.5 sm:mt-0 shrink-0 w-8 h-8 rounded-full overflow-hidden border border-white/10 bg-white flex items-center justify-center shadow-sm">
            {bannerLogoSub?.image_url ? (
              <img
                src={bannerLogoSub.image_url}
                alt={bannerLogoSub.name}
                className="w-full h-full object-contain p-0.5"
              />
            ) : (
              <div
                className={`w-full h-full flex items-center justify-center ${
                  overdueCount > 0 ? 'bg-red-500/20' : 'bg-amber-500/20'
                }`}
              >
                <Bell
                  className={`w-4 h-4 ${overdueCount > 0 ? 'text-red-400' : 'text-amber-300'}`}
                />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`text-sm font-medium font-['Inter'] ${
                overdueCount > 0 ? 'text-red-300' : 'text-amber-300'
              }`}
            >
              {overdueCount > 0 && upcomingCount > 0
                ? `${overdueCount} overdue · ${upcomingCount} renewing soon`
                : overdueCount > 0
                  ? `${overdueCount} subscription${overdueCount > 1 ? 's' : ''} overdue`
                  : `${upcomingCount} subscription${upcomingCount > 1 ? 's' : ''} renewing soon`}
            </p>
            <p className="mt-0.5 text-xs text-[#F6E9E9]/60 font-['Inter'] truncate">
              {dueSoonSubs
                .slice(0, 3)
                .map(e => {
                  const days = daysUntil(e.next_renewal_date);
                  const label =
                    days !== null && days < 0
                      ? `${Math.abs(days)}d overdue`
                      : days === 0
                        ? 'today'
                        : days === 1
                          ? 'tomorrow'
                          : `${days}d`;
                  return `${e.name} (${label})`;
                })
                .join(' · ')}
              {dueSoonSubs.length > 3 ? ` · +${dueSoonSubs.length - 3} more` : ''}
            </p>
          </div>
          <div className="shrink-0 self-center flex items-center gap-1.5">
            {onOpenExpenses && (
              <span
                className={`text-xs font-['Inter'] ${
                  overdueCount > 0 ? 'text-red-400/80' : 'text-amber-300/80'
                }`}
              >
                View
              </span>
            )}
            <span
              role="button"
              tabIndex={0}
              aria-label="Dismiss reminder"
              title="Dismiss for now"
              onClick={dismissSubBanner}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  dismissSubBanner(e as unknown as React.MouseEvent);
                }
              }}
              className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
                overdueCount > 0
                  ? 'text-red-300/70 hover:text-red-200 hover:bg-red-500/20'
                  : 'text-amber-300/70 hover:text-amber-200 hover:bg-amber-500/20'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <div className="p-3.5 sm:p-4 rounded-xl bg-[#272121]/40 backdrop-blur-md">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <h2 className="text-sm sm:text-base font-semibold text-[#F6E9E9] font-['Poppins'] tracking-tight">
              Recent Projects
            </h2>
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#F6E9E9]/30 font-['Inter']">
              {allRecentProjects.length}
            </span>
          </div>
          <div className="space-y-0.5">
            {allRecentProjects.length === 0 ? (
              <p className="py-4 text-xs text-[#F6E9E9]/35 font-['Inter'] text-center">
                No recent projects
              </p>
            ) : (
              allRecentProjects.map(project => {
                const typeLabel = getProjectTypeNames(project.projectDescription)
                  .split(', ')
                  .filter(Boolean)[0];
                const d = new Date(project.deadlineDate);
                const statusTone =
                  project.status === 'Running'
                    ? 'text-sky-300'
                    : project.status === 'Delivered'
                      ? 'text-emerald-300'
                      : project.status === 'Pending' || project.status === 'Pending Payment'
                        ? 'text-amber-300'
                        : 'text-red-300';
                return (
                  <div
                    key={project.id}
                    className="grid grid-cols-[2.65rem_minmax(0,1fr)_auto] gap-3 items-center py-2.5 px-1.5 -mx-1.5 rounded-lg hover:bg-white/[0.03] transition-colors duration-200"
                  >
                    <div className="flex flex-col items-center justify-center pb-1 border-b border-[#E16428]/45">
                      <span className="text-[13px] font-bold leading-none text-[#F6E9E9] font-['Poppins'] tabular-nums">
                        {d.getDate()}
                      </span>
                      <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-[#E16428] font-['Inter']">
                        {d.toLocaleDateString(undefined, { month: 'short' })}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#F6E9E9] font-['Inter'] truncate leading-snug">
                        {project.clientName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#F6E9E9]/40 font-['Inter'] truncate leading-snug">
                        {typeLabel && (
                          <span className="text-[#E16428]/85 lowercase">{typeLabel}</span>
                        )}
                        {typeLabel && project.clientUniOrg ? (
                          <span className="mx-1.5 text-[#F6E9E9]/20">·</span>
                        ) : null}
                        {project.clientUniOrg || (!typeLabel ? '—' : '')}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-medium tracking-wide font-['Inter'] ${statusTone}`}
                    >
                      {project.status}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="p-3.5 sm:p-4 rounded-xl bg-[#272121]/40 backdrop-blur-md">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <h2 className="text-sm sm:text-base font-semibold text-[#F6E9E9] font-['Poppins'] tracking-tight">
              Upcoming Deliverables
            </h2>
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#F6E9E9]/30 font-['Inter']">
              {allUpcomingProjects.length}
            </span>
          </div>
          <div className="space-y-0.5">
            {allUpcomingProjects.length === 0 ? (
              <p className="py-4 text-xs text-[#F6E9E9]/35 font-['Inter'] text-center">
                No upcoming running projects
              </p>
            ) : (
              allUpcomingProjects.map(project => {
                const typeLabel = getProjectTypeNames(project.projectDescription)
                  .split(', ')
                  .filter(Boolean)[0];
                const d = new Date(project.deadlineDate);
                const today = new Date();
                today.setHours(12, 0, 0, 0);
                d.setHours(12, 0, 0, 0);
                const daysLeft = Math.round(
                  (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                );
                const dueLabel =
                  daysLeft < 0
                    ? `${Math.abs(daysLeft)}d late`
                    : daysLeft === 0
                      ? 'Today'
                      : daysLeft === 1
                        ? 'Tomorrow'
                        : `${daysLeft}d left`;
                const dueTone =
                  daysLeft < 0
                    ? 'text-red-300'
                    : daysLeft <= 3
                      ? 'text-amber-300'
                      : 'text-[#F6E9E9]/45';
                const monthTone =
                  daysLeft < 0
                    ? 'text-red-300'
                    : daysLeft <= 3
                      ? 'text-amber-300'
                      : 'text-[#E16428]';
                const lineTone =
                  daysLeft < 0
                    ? 'border-red-400/50'
                    : daysLeft <= 3
                      ? 'border-amber-400/50'
                      : 'border-[#E16428]/45';
                return (
                  <div
                    key={project.id}
                    className="grid grid-cols-[2.65rem_minmax(0,1fr)_auto] gap-3 items-center py-2.5 px-1.5 -mx-1.5 rounded-lg hover:bg-white/[0.03] transition-colors duration-200"
                  >
                    <div className={`flex flex-col items-center justify-center pb-1 border-b ${lineTone}`}>
                      <span className="text-[13px] font-bold leading-none text-[#F6E9E9] font-['Poppins'] tabular-nums">
                        {d.getDate()}
                      </span>
                      <span
                        className={`mt-0.5 text-[9px] font-medium uppercase tracking-[0.12em] font-['Inter'] ${monthTone}`}
                      >
                        {d.toLocaleDateString(undefined, { month: 'short' })}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#F6E9E9] font-['Inter'] truncate leading-snug">
                        {project.clientName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#F6E9E9]/40 font-['Inter'] truncate leading-snug">
                        {typeLabel && (
                          <span className="text-[#E16428]/85 lowercase">{typeLabel}</span>
                        )}
                        {typeLabel && project.clientUniOrg ? (
                          <span className="mx-1.5 text-[#F6E9E9]/20">·</span>
                        ) : null}
                        {project.clientUniOrg || (!typeLabel ? '—' : '')}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-[10px] font-semibold font-['Inter'] tabular-nums ${dueTone}`}>
                        {dueLabel}
                      </p>
                      <p className="mt-0.5 text-[9px] text-sky-300/70 font-['Inter']">Running</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Employee Performance */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-[#272121]/40 backdrop-blur-md">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <h2 className="text-sm sm:text-base font-semibold text-[#F6E9E9] font-['Poppins'] tracking-tight">
            Employee Performance
          </h2>
          <span className="text-[10px] uppercase tracking-[0.14em] text-[#F6E9E9]/30 font-['Inter']">
            {employeePerformanceRows.length}
          </span>
        </div>
        <div className="space-y-0.5">
          {employeePerformanceRows.length === 0 ? (
            <p className="py-4 text-xs text-[#F6E9E9]/35 font-['Inter'] text-center">No employees</p>
          ) : (
            employeePerformanceRows.map(row => (
              <div
                key={row.employee.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center py-2 px-1.5 -mx-1.5 rounded-lg hover:bg-white/[0.03] transition-colors duration-200"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[#F6E9E9] font-['Inter'] truncate leading-snug">
                    {row.employee.firstName} {row.employee.lastName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#F6E9E9]/40 font-['Inter'] truncate leading-snug">
                    <span
                      className={
                        row.isActive ? 'text-emerald-300/85' : 'text-[#F6E9E9]/30'
                      }
                    >
                      {row.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {row.employee.position ? (
                      <>
                        <span className="mx-1.5 text-[#F6E9E9]/20">·</span>
                        {row.employee.position}
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <p className="text-[13px] font-semibold text-[#E16428] font-['Poppins'] leading-none">
                    {row.completedCount}
                    <span className="text-[10px] font-normal text-[#F6E9E9]/30">/{row.totalCount}</span>
                  </p>
                  <p className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-[#F6E9E9]/30 font-['Inter']">
                    done
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Password / PIN Verification Modal */}
      {showPasswordModal && ReactDOM.createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
          onClick={() => {
            setShowPasswordModal(false);
            setPasswordInput('');
            setPinInput('');
            setPasswordError('');
          }}
        >
          <div
            className="w-full max-w-sm p-6 animate-scaleIn"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E16428]/30 bg-[#E16428]/12">
                  {pinEnabled ? (
                    <KeyRound className="w-4 h-4 text-[#E16428]" />
                  ) : (
                    <Lock className="w-4 h-4 text-[#E16428]" />
                  )}
                </div>
                <h3 className="text-lg font-semibold text-[#F6E9E9] font-['Poppins']">
                  {pinEnabled
                    ? 'Verify PIN'
                    : isMobile && biometricSupported && hasBiometric
                      ? 'Verify Identity'
                      : 'Verify Password'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordInput('');
                  setPinInput('');
                  setPasswordError('');
                }}
                className="p-1 text-[#F6E9E9]/60 hover:text-[#F6E9E9] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[#F6E9E9]/70 text-sm mb-4 font-['Inter']">
              {pinEnabled
                ? 'Enter your OGO PIN to view sensitive information.'
                : 'Enter your password to view sensitive information.'}
            </p>

            <div className="space-y-4">
              {pinEnabled ? (
                <div>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={getSessionEmail() ? getStoredPinLength(getSessionEmail()!) : 4}
                    value={pinInput}
                    onChange={(e) => onPinModalChange(e.target.value)}
                    placeholder="OGO PIN"
                    disabled={isVerifying}
                    className="underline-field w-full px-1 py-3 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] placeholder-[#F6E9E9]/40 focus:outline-none focus:border-[#E16428] focus:ring-0 focus:shadow-none transition-all duration-300 font-['Inter'] tracking-[0.35em] text-center text-lg"
                    autoFocus
                  />
                  {passwordError && (
                    <p className="mt-2 text-red-400 text-sm font-['Inter'] text-center">{passwordError}</p>
                  )}
                  {isMobile && biometricSupported && hasBiometric && (
                    <div className="flex justify-center mt-4">
                      <button
                        type="button"
                        onClick={() => void handleBiometricAuth()}
                        disabled={isBiometricLoading || isVerifying}
                        className={`relative h-12 w-12 flex items-center justify-center rounded-none border-0 bg-transparent text-[#E16428] hover:text-[#f07a42] disabled:opacity-50 focus:outline-none ${isBiometricLoading ? 'fingerprint-scanning' : ''}`}
                        aria-label="Use fingerprint"
                      >
                        <Fingerprint className={`w-8 h-8 ${isBiometricLoading ? 'fingerprint-icon' : ''}`} strokeWidth={1.75} />
                        {isBiometricLoading && <div className="fingerprint-scan-line" />}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        setPasswordError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          void handlePasswordSubmit();
                        }
                      }}
                      placeholder="Enter your password"
                      className="underline-field w-full px-1 py-3 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] placeholder-[#F6E9E9]/40 focus:outline-none focus:border-[#E16428] focus:ring-0 focus:shadow-none transition-all duration-300 font-['Inter']"
                      autoFocus
                    />
                    {passwordError && (
                      <p className="mt-2 text-red-400 text-sm font-['Inter']">{passwordError}</p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordModal(false);
                        setPasswordInput('');
                        setPasswordError('');
                      }}
                      className="flex-1 px-4 py-2.5 bg-transparent border border-[#E16428]/25 text-[#F6E9E9]/80 rounded-lg hover:border-[#E16428]/45 hover:bg-[#E16428]/8 transition-all duration-200 font-['Inter'] text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePasswordSubmit()}
                      disabled={isVerifying}
                      className="flex-1 px-4 py-2.5 bg-[#E16428] text-white rounded-lg hover:bg-[#d4551f] transition-colors font-['Inter'] text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Eye className="w-4 h-4" />
                      {isVerifying ? '…' : 'Reveal'}
                    </button>
                    {isMobile && biometricSupported && hasBiometric && (
                      <button
                        type="button"
                        onClick={() => void handleBiometricAuth()}
                        disabled={isBiometricLoading}
                        className={`relative h-12 w-12 shrink-0 flex items-center justify-center rounded-none border-0 bg-transparent text-[#E16428] hover:text-[#f07a42] disabled:opacity-50 focus:outline-none ${isBiometricLoading ? 'fingerprint-scanning' : ''}`}
                        aria-label="Use fingerprint"
                      >
                        <Fingerprint className={`w-8 h-8 ${isBiometricLoading ? 'fingerprint-icon' : ''}`} strokeWidth={1.75} />
                        {isBiometricLoading && <div className="fingerprint-scan-line" />}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};