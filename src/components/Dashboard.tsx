import React, { useEffect, useState, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { DollarSign, Clock, CheckCircle, AlertCircle, FolderOpen, Eye, EyeOff, X, Lock, Fingerprint, KeyRound } from 'lucide-react';
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

interface DashboardProps {
  projects: Project[];
  employees: Employee[];
  onRefresh?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ projects, employees, onRefresh }) => {
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

  useEffect(() => {
    // Remove overflow:hidden to allow scrolling
    document.body.style.overflow = '';
    return () => {};
  }, []);


  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn">
      <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-3 sm:gap-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F6E9E9] font-['Playfair_Display']">
              Dashboard Overview
            </h1>
            {/* Visibility Toggle Button */}
            <button
              onClick={handleToggleVisibility}
              className={`p-2 rounded-lg transition-all duration-300 ${
                valuesHidden 
                  ? 'bg-[#E16428]/20 text-[#E16428] hover:bg-[#E16428]/30' 
                  : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              }`}
              title={valuesHidden ? 'Show values' : 'Hide values'}
            >
              {valuesHidden ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <div className="flex flex-row gap-2 w-full sm:w-auto sm:ml-auto">
            <MonthYearNavigator
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              availableYears={availableYears}
              onChange={(month, year) => {
                setSelectedMonth(month);
                setSelectedYear(year);
              }}
            />
          </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        <GlassCard className="p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-[#F6E9E9] mb-4 font-['Poppins']">
            Recent Projects
          </h2>
          <div className="space-y-3">
            {allRecentProjects.map((project) => (
              <div
                key={project.id}
                className="flex flex-col gap-1 p-3 bg-[#232021]/80 rounded-xl border border-[#E16428]/10 hover:border-[#E16428]/30 transition-all duration-300 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#F6E9E9] text-sm truncate max-w-[120px]">{project.clientName}</span>
                  <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    project.status === 'Running'
                      ? 'bg-blue-500/20 text-blue-300'
                      : project.status === 'Delivered'
                      ? 'bg-green-500/20 text-green-300'
                      : project.status === 'Pending'
                      ? 'bg-yellow-500/20 text-yellow-300'
                      : 'bg-red-500/20 text-red-300'
                  }`}>{project.status}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {getProjectTypeNames(project.projectDescription).split(', ').map((type, idx) => (
                    <span key={idx} className="bg-[#E16428]/20 text-[#E16428] rounded-full px-2 py-0.5 text-[10px] font-medium lowercase max-w-[80px] truncate">{type}</span>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[#F6E9E9]/60 text-xs truncate max-w-[100px]">{project.clientUniOrg}</span>
                  <span className="flex items-center gap-1 text-[#F6E9E9]/40 text-[11px] ml-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    {new Date(project.deadlineDate).toLocaleDateString()}
                </span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Upcoming Project Deliverables */}
        <GlassCard className="p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-[#F6E9E9] mb-4 font-['Poppins']">
            Upcoming Project Deliverables
          </h2>
          <div className="space-y-3">
            {allUpcomingProjects.length === 0 ? (
              <div className="text-[#F6E9E9]/60 text-sm">No upcoming running projects</div>
            ) : (
              allUpcomingProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex flex-col gap-1 p-3 bg-[#232021]/80 rounded-xl border border-[#E16428]/10 hover:border-[#E16428]/30 transition-all duration-300 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#F6E9E9] text-sm truncate max-w-[120px]">{project.clientName}</span>
                    <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300`}>Running</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {getProjectTypeNames(project.projectDescription).split(', ').map((type, idx) => (
                      <span key={idx} className="bg-[#E16428]/20 text-[#E16428] rounded-full px-2 py-0.5 text-[10px] font-medium lowercase max-w-[80px] truncate">{type}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[#F6E9E9]/60 text-xs truncate max-w-[100px]">{project.clientUniOrg}</span>
                    <span className="flex items-center gap-1 text-[#F6E9E9]/40 text-[11px] ml-auto">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      {new Date(project.deadlineDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>

      </div>

      {/* Employee Performance */}
      <GlassCard className="p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-semibold text-[#F6E9E9] mb-4 font-['Poppins']">
          Employee Performance
        </h2>
        <div className="space-y-3">
          {employees.slice(0, 5).map((employee) => {
            const filteredEmployeeProjects = filteredProjects.filter(p => p.assignedTo === employee.id);
            const completedCount = filteredEmployeeProjects.filter(p => p.status === 'Delivered' || p.status === 'Pending Payment').length;
            
            return (
              <div
                key={employee.id}
                className="flex items-center justify-between p-3 bg-[#272121]/30 rounded-lg border border-[#E16428]/10"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[#F6E9E9] font-medium font-['Inter'] truncate">
                    {employee.firstName} {employee.lastName}
                  </p>
                  <p className="text-[#F6E9E9]/70 text-sm truncate">
                    {employee.position}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-[#E16428] font-bold text-sm">
                    {completedCount} completed
                  </p>
                  <p className="text-[#F6E9E9]/70 text-xs">
                    {filteredEmployeeProjects.length} total
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

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