import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, DollarSign, Users, Calendar, Clock, Download, Lock, X, Info, CalendarDays, CalendarRange, BarChart, Table as TableIcon, ChevronDown } from 'lucide-react';
import { Project, Employee } from '../types';
import { GlassCard } from './GlassCard';
import ReportModal from './ReportModal';
import { supabase } from '../supabaseClient';
import { Chart, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, LineController, Filler } from 'chart.js';
import { useLastRefresh } from '../contexts/LastRefreshContext';

Chart.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, LineController, Filler);

interface AnalyticsProps {
  projects: Project[];
  employees: Employee[];
  onRefresh?: () => void;
}

interface MonthlyData {
  month: string;
  revenue: number;
  projects: number;
  completed: number;
  employeePayments: number;
}

export const Analytics: React.FC<AnalyticsProps> = ({ projects, employees, onRefresh }) => {
  const { setLastRefresh } = useLastRefresh();
  // Month/year filter state
  const [selectedMonth, setSelectedMonth] = useState<'all' | number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<'all' | number>(new Date().getFullYear());
  const [showReport, setShowReport] = useState(false);
  const [projectTypes, setProjectTypes] = useState<{ id: string; name: string }[]>([]);
  
  // Login modal state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  // Auto-refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Dropdown open states for mobile
  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false);
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const [metricsDropdownOpen, setMetricsDropdownOpen] = useState(false);
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [mobileActionsDropdownOpen, setMobileActionsDropdownOpen] = useState(false);
  
  // Analytics comparison data state
  const [analyticsComparison, setAnalyticsComparison] = useState<Array<{
    year: number;
    month: number;
    revenue_change_percentage: number | null;
    profit_change_percentage: number | null;
    profit_margin_change_percentage: number | null;
    employee_payments_change_percentage: number | null;
    unique_clients_change_percentage: number | null;
    created_at: string;
  }>>([]);

  // Chart state
  const [activeTab, setActiveTab] = useState<'revenue' | 'profit' | 'employeePayments' | 'projectTrends' | 'uniqueClients'>('revenue');
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [chartPeriod, setChartPeriod] = useState<'yearly' | 'monthly' | 'daily'>('daily');
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  
  // Notification modal state
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  // Auto-refresh functionality
  const handleRefresh = useCallback(async () => {
    if (onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
        const refreshTime = new Date();
        setLastRefresh(refreshTime);
      } catch (error) {
        console.error('Error refreshing analytics data:', error);
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [onRefresh, isRefreshing, setLastRefresh]);

  // Auto-refresh when component mounts or when navigating to analytics
  useEffect(() => {
    handleRefresh();
  }, []); // Only run on mount

  // Refresh when window gains focus (user returns to the tab)
  useEffect(() => {
    const handleFocus = () => {
      handleRefresh();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [handleRefresh]);

  // Periodic refresh every 30 seconds when analytics is active
  useEffect(() => {
    const interval = setInterval(() => {
      handleRefresh();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [handleRefresh]);

  // ESC key handler to close login modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showLoginModal) {
        setShowLoginModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLoginModal]);

  // Fetch project types on mount
  useEffect(() => {
    async function fetchProjectTypes() {
      const { data, error } = await supabase.from('project_types').select('*');
      if (!error && data) {
        setProjectTypes(data);
      }
    }
    fetchProjectTypes();
  }, []);

  // Fetch analytics comparison data
  useEffect(() => {
    async function fetchAnalyticsComparison() {
      const { data, error } = await supabase
        .from('analytics_comparison')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(12); // Show last 12 months
      
      if (!error && data) {
        setAnalyticsComparison(data);
      }
    }
    fetchAnalyticsComparison();
  }, []);

  // Calculate year range dynamically for the year dropdown
  const projectYears = projects
    .map(p => {
      if (p.createdAt) {
        const year = new Date(p.createdAt).getFullYear();
        return typeof year === 'number' && !isNaN(year) ? year : undefined;
      }
      return undefined;
    })
    .filter((y): y is number => typeof y === 'number');
  const minYear = projectYears.length ? Math.min(...projectYears) : new Date().getFullYear() - 3;
  const maxYear = projectYears.length ? Math.max(...projectYears) : new Date().getFullYear() + 2;
  const years = [];
  for (let y = maxYear; y >= minYear; y--) {
    years.push(y);
  }

  // Filtered projects by month/year
  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      if (selectedMonth === 'all' && selectedYear === 'all') return true;
      if (!project.createdAt) return false;
      const created = new Date(project.createdAt);
      if (selectedMonth !== 'all' && selectedYear !== 'all') {
        return created.getMonth() === selectedMonth && created.getFullYear() === selectedYear;
      } else if (selectedMonth !== 'all') {
        return created.getMonth() === selectedMonth;
      } else if (selectedYear !== 'all') {
        return created.getFullYear() === selectedYear;
      }
      return true;
    });
  }, [projects, selectedMonth, selectedYear]);

  const monthlyData = useMemo(() => {
    const months: Record<string, MonthlyData> = {};
    
    filteredProjects.forEach(project => {
      if (!project.createdAt) return;
      
      const date = new Date(project.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!months[monthKey]) {
        months[monthKey] = {
          month: monthKey,
          revenue: 0,
          projects: 0,
          completed: 0,
          employeePayments: 0,
        };
      }
      
      months[monthKey].revenue += project.price;
      months[monthKey].projects += 1;
      months[monthKey].employeePayments += project.paymentOfEmp;
      
      if (project.status === 'Delivered') {
        months[monthKey].completed += 1;
      }
    });
    
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredProjects]);

  // KPI data for all months (used for month-over-month comparison)
  const monthlyKpiMap = useMemo(() => {
    type Kpi = {
      revenue: number;
      profit: number;
      employeePayments: number;
      uniqueClients: Set<string>; // Stores clientName|clientUniOrg
    };

    const map: Record<string, Kpi> = {};

    // First pass: collect all clients per month
    projects.forEach(project => {
      if (!project.createdAt) return;
      const date = new Date(project.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!map[key]) {
        map[key] = {
          revenue: 0,
          profit: 0,
          employeePayments: 0,
          uniqueClients: new Set<string>(),
        };
      }

      map[key].revenue += project.price;
      map[key].employeePayments += project.paymentOfEmp;
      map[key].profit += (project.price - project.paymentOfEmp);
      // Use clientName + clientUniOrg as unique identifier
      const clientKey = `${project.clientName}|${project.clientUniOrg}`;
      map[key].uniqueClients.add(clientKey);
    });

    // Second pass: calculate new clients (excluding those from previous months)
    const sortedKeys = Object.keys(map).sort();
    const previousMonthsClients = new Set<string>();
    
    const result: Record<string, { revenue: number; profit: number; employeePayments: number; uniqueClients: number }> = {};
    
    sortedKeys.forEach(key => {
      const currentMonthClients = map[key].uniqueClients;
      
      // Count only clients that haven't appeared in previous months
      let newClientsCount = 0;
      currentMonthClients.forEach(clientKey => {
        if (!previousMonthsClients.has(clientKey)) {
          newClientsCount++;
        }
      });
      
      // Add ALL clients from current month to previous months set (for next iteration)
      currentMonthClients.forEach(clientKey => {
        previousMonthsClients.add(clientKey);
      });

      result[key] = {
        revenue: map[key].revenue,
        profit: map[key].profit,
        employeePayments: map[key].employeePayments,
        uniqueClients: newClientsCount, // Only new clients, excluding previous months
      };
    });

    return result;
  }, [projects]);

  // Helper: get month-over-month percentage change for a KPI
  const getKpiChange = (metric: 'revenue' | 'profit' | 'employeePayments' | 'uniqueClients') => {
    // Only show change when a specific month and year are selected
    if (selectedMonth === 'all' || selectedYear === 'all') {
      return null;
    }

    const year = selectedYear as number;
    const monthIndex = selectedMonth as number; // 0-based

    const currentKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    const prevDate = new Date(year, monthIndex - 1, 1); // JS handles year rollover
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const currentValue = monthlyKpiMap[currentKey]?.[metric] ?? 0;
    const prevValue = monthlyKpiMap[prevKey]?.[metric] ?? 0;

    if (!prevValue || prevValue === 0) {
      return null;
    }

    const change = ((currentValue - prevValue) / prevValue) * 100;
    return change;
  };

  // Calculate unique clients excluding those from previous months
  const uniqueClients = useMemo(() => {
    // If "all" is selected, just count unique clients in filtered projects
    if (selectedMonth === 'all' || selectedYear === 'all') {
      const clientSet = new Set(
        filteredProjects.map(project => `${project.clientName}|${project.clientUniOrg}`)
      );
      return clientSet.size;
    }

    // For specific month/year, exclude clients from previous months
    const selectedDate = new Date(selectedYear as number, selectedMonth as number, 1);
    
    // Get all clients from the selected month (using clientName + clientUniOrg as unique identifier)
    // Set automatically deduplicates - same client appearing multiple times in the month counts as 1
    const currentMonthClients = new Set<string>();
    filteredProjects.forEach(project => {
      if (!project.createdAt) return;
      const created = new Date(project.createdAt);
      if (created.getMonth() === selectedMonth && created.getFullYear() === selectedYear) {
        const clientKey = `${project.clientName}|${project.clientUniOrg}`;
        currentMonthClients.add(clientKey); // Set ensures each client is only added once
      }
    });

    // Get all clients from previous months (before the selected month)
    const previousMonthsClients = new Set<string>();
    projects.forEach(project => {
      if (!project.createdAt) return;
      const created = new Date(project.createdAt);
      const projectDate = new Date(created.getFullYear(), created.getMonth(), 1);
      
      // Only include projects from months before the selected month
      if (projectDate < selectedDate) {
        const clientKey = `${project.clientName}|${project.clientUniOrg}`;
        previousMonthsClients.add(clientKey);
      }
    });

    // Count only clients that are in current month but NOT in previous months
    let newClientsCount = 0;
    currentMonthClients.forEach(clientKey => {
      if (!previousMonthsClients.has(clientKey)) {
        newClientsCount++;
      }
    });

    return newClientsCount;
  }, [filteredProjects, projects, selectedMonth, selectedYear]);

  // All analytics below use filteredProjects
  const totalRevenue = filteredProjects.reduce((sum, project) => sum + project.price, 0);
  const totalEmployeePayments = filteredProjects.reduce((sum, project) => sum + project.paymentOfEmp, 0);
  const profit = totalRevenue - totalEmployeePayments;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  // Total Upcoming: sum of balance from running projects
  const totalUpcoming = filteredProjects
    .filter(p => p.status === 'Running')
    .reduce((sum, project) => {
      const balance = project.balance !== undefined && project.balance !== null 
        ? project.balance 
        : project.price - project.advance;
      return sum + balance;
    }, 0);

  // Total Pending: sum of balance from pending projects
  const totalPending = filteredProjects
    .filter(p => p.status === 'Pending Payment' || p.status === 'Pending')
    .reduce((sum, project) => {
      const balance = project.balance !== undefined && project.balance !== null 
        ? project.balance 
        : project.price - project.advance;
      return sum + balance;
    }, 0);

  const revenueChange = getKpiChange('revenue');
  const profitChange = getKpiChange('profit');
  const employeePaymentsChange = getKpiChange('employeePayments');
  const uniqueClientsChange = getKpiChange('uniqueClients');

  const employeePerformance = useMemo(() => {
    return employees.map(employee => {
      // Filter projects where this employee is assigned (handles comma-separated IDs)
      const employeeProjects = filteredProjects.filter(p => {
        if (!p.assignedTo) return false;
        const assignedIds = p.assignedTo.split(',').map(id => id.trim());
        return assignedIds.includes(employee.id);
      });
      
      const completed = employeeProjects.filter(p => p.status === 'Delivered').length;
      
      // Calculate earnings using individual employee payments from employeePayments array
      const totalEarnings = employeeProjects.reduce((sum, p) => {
        // Check if project has employeePayments array with individual payments
        if (p.employeePayments && p.employeePayments.length > 0) {
          const empPayment = p.employeePayments.find(ep => ep.employeeId === employee.id);
          return sum + (empPayment ? empPayment.payment : 0);
        }
        // Fallback: if single employee, use paymentOfEmp
        const assignedIds = p.assignedTo ? p.assignedTo.split(',').map(id => id.trim()) : [];
        if (assignedIds.length === 1 && assignedIds[0] === employee.id) {
          return sum + p.paymentOfEmp;
        }
        return sum;
      }, 0);
      
      const revenue = employeeProjects.reduce((sum, p) => sum + p.price, 0);
      const isRanukaJayesh = `${employee.firstName} ${employee.lastName}`.toLowerCase() === 'ranuka jayesh';
      
      return {
        ...employee,
        projectCount: employeeProjects.length,
        completedProjects: completed,
        totalEarnings,
        revenue,
        displayValue: isRanukaJayesh ? revenue : totalEarnings,
        completionRate: employeeProjects.length > 0 ? (completed / employeeProjects.length) * 100 : 0,
        isRanukaJayesh,
      };
    }).sort((a, b) => b.displayValue - a.displayValue);
  }, [employees, filteredProjects]);

  const statusDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    filteredProjects.forEach(project => {
      distribution[project.status] = (distribution[project.status] || 0) + 1;
    });
    return distribution;
  }, [filteredProjects]);

  // Filter projects for annual chart data (entire year)
  const annualProjects = useMemo(() => {
    if (selectedYear === 'all') return projects;
    return projects.filter(project => {
      if (!project.createdAt) return false;
      const created = new Date(project.createdAt);
      return created.getFullYear() === selectedYear;
    });
  }, [projects, selectedYear]);

  // Calculate monthly data for the selected year
  const monthlyChartData = useMemo(() => {
    const months: Record<number, {
      revenue: number;
      profit: number;
      employeePayments: number;
      projectCount: number;
      completedCount: number;
      uniqueClients: Set<string>;
    }> = {};

    // Initialize all 12 months
    for (let i = 0; i < 12; i++) {
      months[i] = {
        revenue: 0,
        profit: 0,
        employeePayments: 0,
        projectCount: 0,
        completedCount: 0,
        uniqueClients: new Set<string>(),
      };
    }

    // Aggregate data by month
    annualProjects.forEach(project => {
      if (!project.createdAt) return;
      const created = new Date(project.createdAt);
      const month = created.getMonth();

      months[month].revenue += project.price;
      months[month].employeePayments += project.paymentOfEmp;
      months[month].profit += (project.price - project.paymentOfEmp);
      months[month].projectCount += 1;
      // Add client to Set - Set automatically deduplicates, so same client appears only once per month
      const clientKey = `${project.clientName}|${project.clientUniOrg}`;
      months[month].uniqueClients.add(clientKey);
      
      if (project.status === 'Delivered' || project.status === 'Pending Payment') {
        months[month].completedCount += 1;
      }
    });

    // Calculate new unique clients per month (excluding previous months)
    const previousMonthsClients = new Set<string>();
    const result: Record<number, {
      revenue: number;
      profit: number;
      employeePayments: number;
      projectCount: number;
      completedCount: number;
      uniqueClients: number;
    }> = {};

    for (let i = 0; i < 12; i++) {
      const currentMonthClients = months[i].uniqueClients;
      let newClientsCount = 0;
      
      currentMonthClients.forEach(clientKey => {
        if (!previousMonthsClients.has(clientKey)) {
          newClientsCount++;
        }
      });
      
      // Add all clients from current month to previous months set
      currentMonthClients.forEach(clientKey => {
        previousMonthsClients.add(clientKey);
      });

      result[i] = {
        revenue: months[i].revenue,
        profit: months[i].profit,
        employeePayments: months[i].employeePayments,
        projectCount: months[i].projectCount,
        completedCount: months[i].completedCount,
        uniqueClients: newClientsCount,
      };
    }

    return result;
  }, [annualProjects]);

  // Calculate yearly data (all years)
  const yearlyChartData = useMemo(() => {
    const years: Record<number, {
      revenue: number;
      profit: number;
      employeePayments: number;
      projectCount: number;
      uniqueClients: Set<string>;
    }> = {};

    // Aggregate data by year
    projects.forEach(project => {
      if (!project.createdAt) return;
      const created = new Date(project.createdAt);
      const year = created.getFullYear();

      if (!years[year]) {
        years[year] = {
          revenue: 0,
          profit: 0,
          employeePayments: 0,
          projectCount: 0,
          uniqueClients: new Set<string>(),
        };
      }

      years[year].revenue += project.price;
      years[year].employeePayments += project.paymentOfEmp;
      years[year].profit += (project.price - project.paymentOfEmp);
      years[year].projectCount += 1;
      const clientKey = `${project.clientName}|${project.clientUniOrg}`;
      years[year].uniqueClients.add(clientKey);
    });

    // Calculate new unique clients per year (excluding previous years)
    const sortedYears = Object.keys(years).map(Number).sort((a, b) => a - b);
    const previousYearsClients = new Set<string>();
    const result: Record<number, {
      revenue: number;
      profit: number;
      employeePayments: number;
      projectCount: number;
      uniqueClients: number;
    }> = {};

    sortedYears.forEach(year => {
      const currentYearClients = years[year].uniqueClients;
      let newClientsCount = 0;
      
      currentYearClients.forEach(clientKey => {
        if (!previousYearsClients.has(clientKey)) {
          newClientsCount++;
        }
      });
      
      // Add all clients from current year to previous years set
      currentYearClients.forEach(clientKey => {
        previousYearsClients.add(clientKey);
      });

      result[year] = {
        revenue: years[year].revenue,
        profit: years[year].profit,
        employeePayments: years[year].employeePayments,
        projectCount: years[year].projectCount,
        uniqueClients: newClientsCount,
      };
    });

    return result;
  }, [projects]);

  // Calculate daily data for selected month
  const dailyChartData = useMemo(() => {
    if (selectedMonth === 'all' || selectedYear === 'all') {
      return null;
    }

    const year = selectedYear as number;
    const monthIndex = selectedMonth as number;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const selectedDate = new Date(year, monthIndex, 1);
    
    const dailyData: Record<number, {
      revenue: number;
      profit: number;
      employeePayments: number;
      projectCount: number;
      uniqueClients: Set<string>;
    }> = {};

    // Initialize all days
    for (let day = 1; day <= daysInMonth; day++) {
      dailyData[day] = {
        revenue: 0,
        profit: 0,
        employeePayments: 0,
        projectCount: 0,
        uniqueClients: new Set<string>(),
      };
    }

    // Get all clients from previous months (before the selected month)
    const previousMonthsClients = new Set<string>();
    projects.forEach(project => {
      if (!project.createdAt) return;
      const created = new Date(project.createdAt);
      const projectDate = new Date(created.getFullYear(), created.getMonth(), 1);
      if (projectDate < selectedDate) {
        const clientKey = `${project.clientName}|${project.clientUniOrg}`;
        previousMonthsClients.add(clientKey);
      }
    });

    // Aggregate data by day
    filteredProjects.forEach(project => {
      if (!project.createdAt) return;
      const created = new Date(project.createdAt);
      if (created.getFullYear() === year && created.getMonth() === monthIndex) {
        const day = created.getDate();
        dailyData[day].revenue += project.price;
        dailyData[day].employeePayments += project.paymentOfEmp;
        dailyData[day].profit += (project.price - project.paymentOfEmp);
        dailyData[day].projectCount += 1;
        const clientKey = `${project.clientName}|${project.clientUniOrg}`;
        dailyData[day].uniqueClients.add(clientKey);
      }
    });

    // Calculate new unique clients per day (excluding previous months and previous days)
    const previousDaysClients = new Set<string>(previousMonthsClients);
    const result: Record<number, {
      revenue: number;
      profit: number;
      employeePayments: number;
      projectCount: number;
      uniqueClients: number;
    }> = {};

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDayClients = dailyData[day].uniqueClients;
      let newClientsCount = 0;
      
      currentDayClients.forEach(clientKey => {
        if (!previousDaysClients.has(clientKey)) {
          newClientsCount++;
        }
      });
      
      // Add all clients from current day to previous days set
      currentDayClients.forEach(clientKey => {
        previousDaysClients.add(clientKey);
      });

      result[day] = {
        revenue: dailyData[day].revenue,
        profit: dailyData[day].profit,
        employeePayments: dailyData[day].employeePayments,
        projectCount: dailyData[day].projectCount,
        uniqueClients: newClientsCount,
      };
    }

    return result;
  }, [selectedMonth, selectedYear, filteredProjects, projects]);

  // Chart configuration based on active tab
  const getChartData = () => {
    let labels: string[] = [];
    const data: number[] = [];
    let label = '';
    let color = '#E16428';
    let backgroundColor = 'rgba(225, 100, 40, 0.1)';

    if (chartPeriod === 'daily' && dailyChartData && selectedMonth !== 'all' && selectedYear !== 'all') {
      // Daily view - show day-wise data for selected month
      const year = selectedYear as number;
      const monthIndex = selectedMonth as number;
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      
      labels = Array.from({ length: daysInMonth }, (_, i) => {
        return (i + 1).toString();
      });

      switch (activeTab) {
        case 'revenue':
          label = 'Revenue';
          color = '#E16428';
          backgroundColor = 'rgba(225, 100, 40, 0.1)';
          data.push(...Array.from({ length: daysInMonth }, (_, i) => dailyChartData[i + 1]?.revenue ?? 0));
          break;
        case 'profit':
          label = 'Profit';
          color = '#10b981';
          backgroundColor = 'rgba(16, 185, 129, 0.1)';
          data.push(...Array.from({ length: daysInMonth }, (_, i) => dailyChartData[i + 1]?.profit ?? 0));
          break;
        case 'employeePayments':
          label = 'Employee Payments';
          color = '#3b82f6';
          backgroundColor = 'rgba(59, 130, 246, 0.1)';
          data.push(...Array.from({ length: daysInMonth }, (_, i) => dailyChartData[i + 1]?.employeePayments ?? 0));
          break;
        case 'projectTrends':
          label = 'Project Count';
          color = '#8b5cf6';
          backgroundColor = 'rgba(139, 92, 246, 0.1)';
          data.push(...Array.from({ length: daysInMonth }, (_, i) => dailyChartData[i + 1]?.projectCount ?? 0));
          break;
        case 'uniqueClients':
          label = 'Unique Clients';
          color = '#06b6d4';
          backgroundColor = 'rgba(6, 182, 212, 0.1)';
          data.push(...Array.from({ length: daysInMonth }, (_, i) => dailyChartData[i + 1]?.uniqueClients ?? 0));
          break;
      }
    } else if (chartPeriod === 'monthly' && selectedYear !== 'all') {
      // Monthly view - show month-wise data for selected year
      labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      switch (activeTab) {
        case 'revenue':
          label = 'Revenue';
          color = '#E16428';
          backgroundColor = 'rgba(225, 100, 40, 0.1)';
          data.push(...Array.from({ length: 12 }, (_, i) => monthlyChartData[i]?.revenue ?? 0));
          break;
        case 'profit':
          label = 'Profit';
          color = '#10b981';
          backgroundColor = 'rgba(16, 185, 129, 0.1)';
          data.push(...Array.from({ length: 12 }, (_, i) => monthlyChartData[i]?.profit ?? 0));
          break;
        case 'employeePayments':
          label = 'Employee Payments';
          color = '#3b82f6';
          backgroundColor = 'rgba(59, 130, 246, 0.1)';
          data.push(...Array.from({ length: 12 }, (_, i) => monthlyChartData[i]?.employeePayments ?? 0));
          break;
        case 'projectTrends':
          label = 'Project Count';
          color = '#8b5cf6';
          backgroundColor = 'rgba(139, 92, 246, 0.1)';
          data.push(...Array.from({ length: 12 }, (_, i) => monthlyChartData[i]?.projectCount ?? 0));
          break;
        case 'uniqueClients':
          label = 'Unique Clients';
          color = '#06b6d4';
          backgroundColor = 'rgba(6, 182, 212, 0.1)';
          data.push(...Array.from({ length: 12 }, (_, i) => monthlyChartData[i]?.uniqueClients ?? 0));
          break;
      }
    } else {
      // Yearly view - show year-wise data (all years)
      const sortedYears = Object.keys(yearlyChartData).map(Number).sort((a, b) => a - b);
      labels = sortedYears.map(year => year.toString());
      
      switch (activeTab) {
        case 'revenue':
          label = 'Revenue';
          color = '#E16428';
          backgroundColor = 'rgba(225, 100, 40, 0.1)';
          data.push(...sortedYears.map(year => yearlyChartData[year]?.revenue ?? 0));
          break;
        case 'profit':
          label = 'Profit';
          color = '#10b981';
          backgroundColor = 'rgba(16, 185, 129, 0.1)';
          data.push(...sortedYears.map(year => yearlyChartData[year]?.profit ?? 0));
          break;
        case 'employeePayments':
          label = 'Employee Payments';
          color = '#3b82f6';
          backgroundColor = 'rgba(59, 130, 246, 0.1)';
          data.push(...sortedYears.map(year => yearlyChartData[year]?.employeePayments ?? 0));
          break;
        case 'projectTrends':
          label = 'Project Count';
          color = '#8b5cf6';
          backgroundColor = 'rgba(139, 92, 246, 0.1)';
          data.push(...sortedYears.map(year => yearlyChartData[year]?.projectCount ?? 0));
          break;
        case 'uniqueClients':
          label = 'Unique Clients';
          color = '#06b6d4';
          backgroundColor = 'rgba(6, 182, 212, 0.1)';
          data.push(...sortedYears.map(year => yearlyChartData[year]?.uniqueClients ?? 0));
          break;
      }
    }

    return { labels, data, label, color, backgroundColor };
  };

  // Create/update chart when tab, year, month, or period changes
  useEffect(() => {
    if (!chartRef.current) return;
    
    // If daily view is selected but no month/year selected, don't render chart
    if (chartPeriod === 'daily' && (selectedMonth === 'all' || selectedYear === 'all')) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
      return;
    }
    
    // If monthly view is selected but no year selected, don't render chart
    if (chartPeriod === 'monthly' && selectedYear === 'all') {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
      return;
    }

    const { labels, data, label, color, backgroundColor } = getChartData();

    // If chart exists, update it instead of recreating
    if (chartInstanceRef.current) {
      chartInstanceRef.current.data.labels = labels;
      chartInstanceRef.current.data.datasets[0].label = label;
      chartInstanceRef.current.data.datasets[0].data = data;
      chartInstanceRef.current.data.datasets[0].borderColor = color;
      chartInstanceRef.current.data.datasets[0].backgroundColor = backgroundColor;
      chartInstanceRef.current.update('none'); // 'none' mode prevents animation
      return;
    }

    // Create new chart only if it doesn't exist
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: label,
            data: data,
            borderColor: color,
            backgroundColor: backgroundColor,
            borderWidth: 3,
            tension: 0.4, // Curved line
            fill: true, // Area fill
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: color,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#F6E9E9',
              font: {
                family: 'Inter',
                size: 12,
                weight: 'bold'
              },
              padding: 15,
              usePointStyle: true,
            }
          },
          tooltip: {
            backgroundColor: 'rgba(39, 33, 33, 0.95)',
            titleColor: '#F6E9E9',
            bodyColor: '#F6E9E9',
            borderColor: '#E16428',
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            callbacks: {
              label: function(context) {
                if (activeTab === 'projectTrends') {
                  return `${context.dataset.label}: ${context.parsed.y} projects`;
                }
                if (activeTab === 'uniqueClients') {
                  return `${context.dataset.label}: ${context.parsed.y} clients`;
                }
                return `${context.dataset.label}: LKR ${context.parsed.y.toLocaleString()}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#F6E9E9',
              font: {
                family: 'Inter',
                size: 10
              }
            },
            grid: {
              color: 'rgba(246, 233, 233, 0.1)'
            }
          },
          y: {
            ticks: {
              color: '#F6E9E9',
              font: {
                family: 'Inter',
                size: 10
              },
              callback: function(value) {
                if (activeTab === 'projectTrends' || activeTab === 'uniqueClients') {
                  return Number(value).toString();
                }
                return 'LKR ' + Number(value).toLocaleString();
              }
            },
            grid: {
              color: 'rgba(246, 233, 233, 0.1)'
            },
            beginAtZero: true
          }
        }
      }
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [activeTab, selectedYear, selectedMonth, monthlyChartData, chartPeriod, dailyChartData, yearlyChartData]);

  // Admin authentication function
  const authenticateAdmin = async (password: string) => {
    try {
      setIsAuthenticating(true);
      setLoginError('');
      
      const { data, error } = await supabase
        .from('admin')
        .select('id, email, password')
        .eq('password', password)
        .single();
      
      if (error || !data) {
        // Log failed authentication attempt
        await logAction(null, 'Unknown', 'export_fail');
        setLoginError('Invalid password. Please try again.');
        return false;
      }
      
      // Log successful authentication and export
      await logAction(data.id, data.email, 'export_success');
      
      return true;
    } catch (error) {
      console.error('Authentication error:', error);
      // Log authentication error
      await logAction(null, 'Unknown', 'export_fail');
      setLoginError('Authentication failed. Please try again.');
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Log action to database
  const logAction = async (adminId: string | null, adminEmail: string, action: string) => {
    try {
      const { error } = await supabase
        .from('log')
        .insert({
          admin_id: adminId,
          admin_email: adminEmail,
          action: action
        });
      
      if (error) {
        console.error('Error logging action:', error);
      }
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  };

  // Handle login submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adminPassword.trim()) {
      setLoginError('Please enter a password.');
      return;
    }
    
    const isAuthenticated = await authenticateAdmin(adminPassword);
    
    if (isAuthenticated) {
      setShowLoginModal(false);
      setAdminPassword('');
      setLoginError('');
      // Proceed with export
      exportToExcel();
    }
  };

  // Excel export function (now called after authentication)
  const exportToExcel = () => {
    // Create CSV content
    const headers = [
      'ID',
      'Project ID',
      'Client Name',
      'Client Uni/Org',
      'Project Description',
      'Deadline Date',
      'Price',
      'Advance',
      'Assigned To',
      'Payment of Employee',
      'Status',
      'Fast Deliver',
      'Created At',
      'Updated At'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredProjects.map(project => {
        const assignedEmployee = employees.find(emp => emp.id === project.assignedTo);
        const assignedToName = assignedEmployee ? `${assignedEmployee.firstName} ${assignedEmployee.lastName}` : 'Unassigned';
        
        // Convert project type IDs to names
        const getProjectTypeNames = (projectDescription: string) => {
          if (!projectDescription) return 'No types specified';
          const typeIds = projectDescription.split(',').map(id => id.trim());
          const typeNames = typeIds.map(id => {
            const type = projectTypes.find(t => t.id === id);
            return type ? type.name : `Unknown Type (${id})`;
          });
          return typeNames.join(', ');
        };
        
        return [
          project.id,
          project.projectId,
          `"${project.clientName}"`,
          `"${project.clientUniOrg}"`,
          `"${getProjectTypeNames(project.projectDescription)}"`,
          project.deadlineDate,
          project.price,
          project.advance,
          `"${assignedToName}"`,
          project.paymentOfEmp,
          project.status,
          project.fastDeliver ? 'Yes' : 'No',
          project.createdAt,
          project.updatedAt
        ].join(',');
      })
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // Generate filename based on selected filters
    let filename = 'projects_export';
    if (selectedMonth !== 'all' && selectedYear !== 'all') {
      const monthName = new Date(0, selectedMonth).toLocaleString('default', { month: 'long' });
      filename = `projects_${monthName}_${selectedYear}`;
    } else if (selectedMonth !== 'all') {
      const monthName = new Date(0, selectedMonth).toLocaleString('default', { month: 'long' });
      filename = `projects_${monthName}_all_years`;
    } else if (selectedYear !== 'all') {
      filename = `projects_${selectedYear}`;
    } else {
      filename = 'projects_all_time';
    }
    
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle export button click (triggers login)
  const handleExportClick = () => {
    setShowLoginModal(true);
    setAdminPassword('');
    setLoginError('');
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Month/Year Filter */}
      <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto mb-4">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {/* Month Dropdown */}
          <div className="relative w-full sm:w-auto">
            <button
              onClick={() => setMonthDropdownOpen(!monthDropdownOpen)}
              className="w-full sm:w-auto pl-9 pr-9 py-2 bg-[#272121]/70 border border-[#E16428]/30 rounded-lg text-[#F6E9E9] focus:outline-none focus:border-[#E16428] font-['Inter'] transition-all duration-200 hover:border-[#E16428] focus:ring-2 focus:ring-[#E16428]/30 text-xs sm:text-sm flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#E16428]" />
                <span>
                  {selectedMonth === 'all' 
                    ? 'All Months' 
                    : new Date(0, selectedMonth as number).toLocaleString('default', { month: 'long' })
                  }
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${monthDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {monthDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMonthDropdownOpen(false)} />
                <div className="absolute z-20 mt-1 w-full bg-[#272121] border border-[#E16428]/30 rounded-lg shadow-lg overflow-hidden">
                  <button
                    onClick={() => {
                      setSelectedMonth('all');
                      setMonthDropdownOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left flex items-center gap-2 text-[#F6E9E9] hover:bg-[#E16428]/20 transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>All Months</span>
                  </button>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedMonth(i);
                        setMonthDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left flex items-center gap-2 text-[#F6E9E9] hover:bg-[#E16428]/20 transition-colors"
                    >
                      <CalendarDays className="w-4 h-4" />
                      <span>{new Date(0, i).toLocaleString('default', { month: 'long' })}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          
          {/* Year Dropdown */}
          <div className="relative w-full sm:w-auto">
            <button
              onClick={() => setYearDropdownOpen(!yearDropdownOpen)}
              className="w-full sm:w-auto pl-9 pr-9 py-2 bg-[#272121]/70 border border-[#E16428]/30 rounded-lg text-[#F6E9E9] focus:outline-none focus:border-[#E16428] font-['Inter'] transition-all duration-200 hover:border-[#E16428] focus:ring-2 focus:ring-[#E16428]/30 text-xs sm:text-sm flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#E16428]" />
                <span>
                  {selectedYear === 'all' ? 'All Years' : selectedYear}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${yearDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {yearDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setYearDropdownOpen(false)} />
                <div className="absolute z-20 mt-1 w-full bg-[#272121] border border-[#E16428]/30 rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedYear('all');
                      setYearDropdownOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left flex items-center gap-2 text-[#F6E9E9] hover:bg-[#E16428]/20 transition-colors"
                  >
                    <Clock className="w-4 h-4" />
                    <span>All Years</span>
                  </button>
                  {years.map(year => (
                    <button
                      key={year}
                      onClick={() => {
                        setSelectedYear(year);
                        setYearDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left flex items-center gap-2 text-[#F6E9E9] hover:bg-[#E16428]/20 transition-colors"
                    >
                      <Clock className="w-4 h-4" />
                      <span>{year}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#F6E9E9] font-['Playfair_Display']">
          Analytics & Reports
        </h1>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#F6E9E9]/70 text-sm font-['Inter']">Total Revenue</p>
              <p className="text-xl sm:text-2xl font-bold text-[#F6E9E9] mt-1 font-['Poppins']">
                LKR {totalRevenue.toLocaleString()}
              </p>
              {revenueChange !== null && (
                <p
                  className={`text-xs mt-1 font-['Inter'] ${
                    revenueChange >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {revenueChange >= 0 ? '+' : ''}
                  {revenueChange.toFixed(1)}%
                </p>
              )}
            </div>
            <div className="p-2 sm:p-3 rounded-full bg-green-500/20">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-300" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#F6E9E9]/70 text-sm font-['Inter']">Total Profit</p>
              <p className="text-xl sm:text-2xl font-bold text-[#F6E9E9] mt-1 font-['Poppins']">
                LKR {profit.toLocaleString()}
              </p>
              {profitChange !== null && (
                <p
                  className={`text-xs mt-1 font-['Inter'] ${
                    profitChange >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {profitChange >= 0 ? '+' : ''}
                  {profitChange.toFixed(1)}%
                </p>
              )}
            </div>
            <div className="p-2 sm:p-3 rounded-full bg-blue-500/20">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-blue-300" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#F6E9E9]/70 text-sm font-['Inter']">Profit Margin</p>
              <p className="text-xl sm:text-2xl font-bold text-[#F6E9E9] mt-1 font-['Poppins']">
                {profitMargin.toFixed(1)}%
              </p>
              {/* Profit margin change uses profitChange for consistency */}
              {profitChange !== null && (
                <p
                  className={`text-xs mt-1 font-['Inter'] ${
                    profitChange >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {profitChange >= 0 ? '+' : ''}
                  {profitChange.toFixed(1)}%
                </p>
              )}
            </div>
            <div className="p-2 sm:p-3 rounded-full bg-purple-500/20">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-purple-300" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#F6E9E9]/70 text-sm font-['Inter']">Total Employee Payments</p>
              <p className="text-xl sm:text-2xl font-bold text-[#F6E9E9] mt-1 font-['Poppins']">
                LKR {totalEmployeePayments.toLocaleString()}
              </p>
              {employeePaymentsChange !== null && (
                <p
                  className={`text-xs mt-1 font-['Inter'] ${
                    employeePaymentsChange <= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {/* For payments: lower is better, so invert color meaning */}
                  {employeePaymentsChange >= 0 ? '+' : ''}
                  {employeePaymentsChange.toFixed(1)}%
                </p>
              )}
            </div>
            <div className="p-2 sm:p-3 rounded-full bg-yellow-500/20">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#F6E9E9]/70 text-sm font-['Inter']">Active Employees</p>
              <p className="text-xl sm:text-2xl font-bold text-[#F6E9E9] mt-1 font-['Poppins']">
                {employees.length}
              </p>
            </div>
            <div className="p-2 sm:p-3 rounded-full bg-orange-500/20">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-orange-300" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#F6E9E9]/70 text-sm font-['Inter']">Unique Clients</p>
              <p className="text-xl sm:text-2xl font-bold text-[#F6E9E9] mt-1 font-['Poppins']">
                {uniqueClients}
              </p>
              {uniqueClientsChange !== null && (
                <p
                  className={`text-xs mt-1 font-['Inter'] ${
                    uniqueClientsChange >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {uniqueClientsChange >= 0 ? '+' : ''}
                  {uniqueClientsChange.toFixed(1)}%
                </p>
              )}
            </div>
            <div className="p-2 sm:p-3 rounded-full bg-cyan-500/20">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-300" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#F6E9E9]/70 text-sm font-['Inter']">Total Upcoming</p>
              <p className="text-xl sm:text-2xl font-bold text-[#F6E9E9] mt-1 font-['Poppins']">
                LKR {totalUpcoming.toLocaleString()}
              </p>
              <p className="text-xs mt-1 font-['Inter'] text-[#F6E9E9]/50">
                Running projects balance
              </p>
            </div>
            <div className="p-2 sm:p-3 rounded-full bg-amber-500/20">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#F6E9E9]/70 text-sm font-['Inter']">Total Pending</p>
              <p className="text-xl sm:text-2xl font-bold text-[#F6E9E9] mt-1 font-['Poppins']">
                LKR {totalPending.toLocaleString()}
              </p>
              <p className="text-xs mt-1 font-['Inter'] text-[#F6E9E9]/50">
                Pending projects balance
              </p>
            </div>
            <div className="p-2 sm:p-3 rounded-full bg-rose-500/20">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-rose-300" />
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Monthly Performance */}
      <GlassCard className="p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-semibold text-[#F6E9E9] mb-4 sm:mb-6 font-['Poppins']">
          Monthly Performance
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E16428]/20">
                <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-1 text-xs sm:text-sm font-['Inter']">Month</th>
                <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-1 text-xs sm:text-sm font-['Inter']">Projects</th>
                <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-1 text-xs sm:text-sm font-['Inter']">Completed</th>
                <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-1 text-xs sm:text-sm font-['Inter']">Revenue</th>
                <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-1 text-xs sm:text-sm font-['Inter']">Profit</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.length > 0 ? (
                monthlyData.map((month: any) => (
                <tr key={month.month} className="border-b border-[#E16428]/10 text-xs sm:text-sm">
                  <td className="py-2 sm:py-3 px-1 text-[#F6E9E9] font-['Inter'] whitespace-nowrap">
                    {new Date(month.month + '-01').toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long' 
                    })}
                  </td>
                  <td className="py-2 sm:py-3 px-1 text-[#F6E9E9] font-['Inter']">{month.projects}</td>
                  <td className="py-2 sm:py-3 px-1 text-[#F6E9E9] font-['Inter']">{month.completed}</td>
                  <td className="py-2 sm:py-3 px-1 text-[#E16428] font-bold font-['Inter']">
                    LKR {month.revenue.toLocaleString()}
                  </td>
                  <td className="py-2 sm:py-3 px-1 text-green-300 font-bold font-['Inter']">
                    LKR {(month.revenue - month.employeePayments).toLocaleString()}
                  </td>
                </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#F6E9E9]/70 font-['Inter']">
                    {selectedMonth === 'all' && selectedYear === 'all' 
                      ? 'No projects found in the database'
                      : `No projects found for the selected ${selectedMonth !== 'all' ? 'month' : ''}${selectedMonth !== 'all' && selectedYear !== 'all' ? ' and ' : ''}${selectedYear !== 'all' ? 'year' : ''}`
                    }
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* Employee Performance */}
        <GlassCard className="p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-[#F6E9E9] mb-4 sm:mb-6 font-['Poppins']">
            Employee Performance
          </h2>
          <div className="space-y-3 sm:space-y-4">
            {employeePerformance.slice(0, 5).map((employee) => (
              <div key={employee.id} className="flex items-center justify-between p-3 sm:p-4 bg-[#272121]/30 rounded-lg">
                <div>
                  <p className="text-[#F6E9E9] font-medium font-['Inter'] text-sm sm:text-base">
                    {employee.firstName} {employee.lastName}
                  </p>
                  <p className="text-[#F6E9E9]/70 text-xs sm:text-sm">
                    {employee.completedProjects}/{employee.projectCount} completed
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[#E16428] font-bold text-sm sm:text-base">
                    LKR {employee.displayValue.toLocaleString()}
                  </p>
                  <p className="text-[#F6E9E9]/70 text-xs sm:text-sm">
                    {employee.completionRate.toFixed(1)}% success
                  </p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Project Status Distribution */}
        <GlassCard className="p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-[#F6E9E9] mb-4 sm:mb-6 font-['Poppins']">
            Project Status Distribution
          </h2>
          <div className="space-y-3 sm:space-y-4">
            {(Object.entries(statusDistribution) as [string, number][]).map(([status, count]) => {
              const percentage = (count / filteredProjects.length) * 100;
              const getStatusColor = (status: string) => {
                switch (status) {
                  case 'Running': return 'bg-blue-500';
                  case 'Delivered': return 'bg-green-500';
                  case 'Pending': return 'bg-yellow-500';
                  case 'Correction': return 'bg-orange-500';
                  case 'Rejected': return 'bg-red-500';
                  default: return 'bg-gray-500';
                }
              };
              return (
                <div key={status} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[#F6E9E9] font-['Inter'] text-sm sm:text-base">{status}</span>
                    <span className="text-[#F6E9E9]/70 text-xs sm:text-sm">
                      {count} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#272121]/50 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getStatusColor(status)}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      {/* Annual Trends Chart/Table */}
      <GlassCard className="p-4 sm:p-6">
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-[#F6E9E9] font-['Poppins']">
              {chartPeriod === 'yearly'
                ? 'Annual Trends'
                : chartPeriod === 'monthly'
                  ? selectedYear !== 'all'
                    ? `Monthly Trends - ${selectedYear}`
                    : 'Monthly Trends - Please select a year'
                  : selectedMonth !== 'all' && selectedYear !== 'all'
                    ? `Month Trends - ${new Date(0, selectedMonth as number).toLocaleString('default', { month: 'long' })} ${selectedYear}`
                    : 'Month Trends - Please select a month and year'
              }
            </h2>
            
            {/* Mobile Dropdowns (only on mobile) */}
            <div className="flex flex-col gap-3 sm:hidden w-full">
              {/* Period and View in 2 columns on same line */}
              <div className="flex gap-3 w-full">
                {/* Period Dropdown - Only show in Chart view */}
                {viewMode === 'chart' && (
                  <div className="flex flex-col gap-2 w-1/2 relative">
                    <label className="text-xs text-[#F6E9E9]/70 font-['Inter'] font-medium">Period</label>
                    <div className="relative">
                      <button
                        onClick={() => setPeriodDropdownOpen(!periodDropdownOpen)}
                        className="w-full px-4 py-2 rounded-lg font-['Inter'] text-sm bg-[#272121]/50 border border-[#E16428]/30 text-[#F6E9E9] focus:outline-none focus:border-[#E16428] transition-all duration-200 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          {chartPeriod === 'yearly' && <CalendarRange className="w-4 h-4" />}
                          {chartPeriod === 'monthly' && <CalendarDays className="w-4 h-4" />}
                          {chartPeriod === 'daily' && <Calendar className="w-4 h-4" />}
                          <span>
                            {chartPeriod === 'yearly' ? 'Annual' : chartPeriod === 'monthly' ? 'Monthly' : 'Month'}
                          </span>
                        </div>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${periodDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {periodDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setPeriodDropdownOpen(false)} />
                          <div className="absolute z-20 mt-1 w-full bg-[#272121] border border-[#E16428]/30 rounded-lg shadow-lg overflow-hidden">
                            <button
                              onClick={() => {
                                setChartPeriod('yearly');
                                setPeriodDropdownOpen(false);
                              }}
                              className="w-full px-4 py-2 text-left flex items-center gap-2 text-[#F6E9E9] hover:bg-[#E16428]/20 transition-colors"
                            >
                              <CalendarRange className="w-4 h-4" />
                              <span>Annual</span>
                            </button>
                            <button
                              onClick={() => {
                                if (selectedYear !== 'all') {
                                  setChartPeriod('monthly');
                                  setPeriodDropdownOpen(false);
                                } else {
                                  setNotificationMessage('Please select a specific year to view monthly trends');
                                  setShowNotification(true);
                                  setPeriodDropdownOpen(false);
                                }
                              }}
                              disabled={selectedYear === 'all'}
                              className={`w-full px-4 py-2 text-left flex items-center gap-2 text-[#F6E9E9] hover:bg-[#E16428]/20 transition-colors ${selectedYear === 'all' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <CalendarDays className="w-4 h-4" />
                              <span>Monthly</span>
                            </button>
                            <button
                              onClick={() => {
                                if (selectedMonth !== 'all' && selectedYear !== 'all') {
                                  setChartPeriod('daily');
                                  setPeriodDropdownOpen(false);
                                } else {
                                  setNotificationMessage('Please select a specific month and year to view day-wise trends');
                                  setShowNotification(true);
                                  setPeriodDropdownOpen(false);
                                }
                              }}
                              disabled={selectedMonth === 'all' || selectedYear === 'all'}
                              className={`w-full px-4 py-2 text-left flex items-center gap-2 text-[#F6E9E9] hover:bg-[#E16428]/20 transition-colors ${selectedMonth === 'all' || selectedYear === 'all' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <Calendar className="w-4 h-4" />
                              <span>Month</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
                
                {/* View Dropdown */}
                <div className={`flex flex-col gap-2 ${viewMode === 'chart' ? 'w-1/2' : 'w-full'} relative`}>
                  <label className="text-xs text-[#F6E9E9]/70 font-['Inter'] font-medium">View</label>
                  <div className="relative">
                    <button
                      onClick={() => setViewDropdownOpen(!viewDropdownOpen)}
                      className="w-full px-4 py-2 rounded-lg font-['Inter'] text-sm bg-[#272121]/50 border border-[#E16428]/30 text-[#F6E9E9] focus:outline-none focus:border-[#E16428] transition-all duration-200 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        {viewMode === 'chart' ? <BarChart className="w-4 h-4" /> : <TableIcon className="w-4 h-4" />}
                        <span>{viewMode === 'chart' ? 'Chart' : 'Table'}</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${viewDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {viewDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setViewDropdownOpen(false)} />
                        <div className="absolute z-20 mt-1 w-full bg-[#272121] border border-[#E16428]/30 rounded-lg shadow-lg overflow-hidden">
                          <button
                            onClick={() => {
                              setViewMode('chart');
                              setViewDropdownOpen(false);
                            }}
                            className="w-full px-4 py-2 text-left flex items-center gap-2 text-[#F6E9E9] hover:bg-[#E16428]/20 transition-colors"
                          >
                            <BarChart className="w-4 h-4" />
                            <span>Chart</span>
                          </button>
                          <button
                            onClick={() => {
                              setViewMode('table');
                              setViewDropdownOpen(false);
                            }}
                            className="w-full px-4 py-2 text-left flex items-center gap-2 text-[#F6E9E9] hover:bg-[#E16428]/20 transition-colors"
                          >
                            <TableIcon className="w-4 h-4" />
                            <span>Table</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Metrics Dropdown - Only show in Chart view */}
              {viewMode === 'chart' && (
                <div className="flex flex-col gap-2 w-full relative">
                  <label className="text-xs text-[#F6E9E9]/70 font-['Inter'] font-medium">Metrics</label>
                  <div className="relative">
                    <button
                      onClick={() => setMetricsDropdownOpen(!metricsDropdownOpen)}
                      className="w-full px-4 py-2 rounded-lg font-['Inter'] text-sm bg-[#272121]/50 border border-[#E16428]/30 text-[#F6E9E9] focus:outline-none focus:border-[#E16428] transition-all duration-200 flex items-center justify-between"
                      style={{ width: '100%', maxWidth: '100%' }}
                    >
                      <div className="flex items-center gap-2">
                        {activeTab === 'revenue' && <DollarSign className="w-4 h-4" />}
                        {activeTab === 'profit' && <TrendingUp className="w-4 h-4" />}
                        {activeTab === 'employeePayments' && <Users className="w-4 h-4" />}
                        {activeTab === 'projectTrends' && <BarChart className="w-4 h-4" />}
                        {activeTab === 'uniqueClients' && <Users className="w-4 h-4" />}
                        <span>
                          {activeTab === 'revenue' ? 'Revenue' : activeTab === 'profit' ? 'Profit' : activeTab === 'employeePayments' ? 'Employee Payments' : activeTab === 'projectTrends' ? 'Project Trends' : 'Unique Clients'}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${metricsDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {metricsDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMetricsDropdownOpen(false)} />
                        <div className="absolute z-20 mt-1 w-full bg-[#272121] border border-[#E16428]/30 rounded-lg shadow-lg overflow-hidden">
                          <button
                            onClick={() => {
                              setActiveTab('revenue');
                              setMetricsDropdownOpen(false);
                            }}
                            className="w-full px-4 py-2 text-left flex items-center gap-2 text-[#F6E9E9] hover:bg-[#E16428]/20 transition-colors"
                          >
                            <DollarSign className="w-4 h-4" />
                            <span>Revenue</span>
                          </button>
                          <button
                            onClick={() => {
                              setActiveTab('profit');
                              setMetricsDropdownOpen(false);
                            }}
                            className="w-full px-4 py-2 text-left flex items-center gap-2 text-[#F6E9E9] hover:bg-[#E16428]/20 transition-colors"
                          >
                            <TrendingUp className="w-4 h-4" />
                            <span>Profit</span>
                          </button>
                          <button
                            onClick={() => {
                              setActiveTab('employeePayments');
                              setMetricsDropdownOpen(false);
                            }}
                            className="w-full px-4 py-2 text-left flex items-center gap-2 text-[#F6E9E9] hover:bg-[#E16428]/20 transition-colors"
                          >
                            <Users className="w-4 h-4" />
                            <span>Employee Payments</span>
                          </button>
                          <button
                            onClick={() => {
                              setActiveTab('projectTrends');
                              setMetricsDropdownOpen(false);
                            }}
                            className="w-full px-4 py-2 text-left flex items-center gap-2 text-[#F6E9E9] hover:bg-[#E16428]/20 transition-colors"
                          >
                            <BarChart className="w-4 h-4" />
                            <span>Project Trends</span>
                          </button>
                          <button
                            onClick={() => {
                              setActiveTab('uniqueClients');
                              setMetricsDropdownOpen(false);
                            }}
                            className="w-full px-4 py-2 text-left flex items-center gap-2 text-[#F6E9E9] hover:bg-[#E16428]/20 transition-colors"
                          >
                            <Users className="w-4 h-4" />
                            <span>Unique Clients</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Buttons (hidden on mobile) */}
            <div className="hidden sm:flex sm:flex-row gap-4">
              {/* Period Toggle (Annual/Monthly/Month) - Only show in Chart view */}
              {viewMode === 'chart' && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-[#F6E9E9]/70 font-['Inter'] font-medium">Period</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setChartPeriod('yearly')}
                      className={`px-4 py-2 rounded-lg font-['Inter'] text-sm transition-all duration-200 flex items-center gap-2 ${
                        chartPeriod === 'yearly'
                          ? 'bg-green-500 text-white shadow-lg hover:bg-green-600'
                          : 'bg-[#272121]/50 text-[#F6E9E9]/70 hover:bg-green-500/20'
                      }`}
                    >
                      <CalendarRange className="w-4 h-4" />
                      <span>Annual</span>
                    </button>
                    <button
                      onClick={() => {
                        if (selectedYear !== 'all') {
                          setChartPeriod('monthly');
                        } else {
                          setNotificationMessage('Please select a specific year to view monthly trends');
                          setShowNotification(true);
                        }
                      }}
                      className={`px-4 py-2 rounded-lg font-['Inter'] text-sm transition-all duration-200 flex items-center gap-2 ${
                        chartPeriod === 'monthly'
                          ? 'bg-blue-500 text-white shadow-lg hover:bg-blue-600'
                          : 'bg-[#272121]/50 text-[#F6E9E9]/70 hover:bg-blue-500/20'
                      } ${selectedYear === 'all' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <CalendarDays className="w-4 h-4" />
                      <span>Monthly</span>
                    </button>
                    <button
                      onClick={() => {
                        if (selectedMonth !== 'all' && selectedYear !== 'all') {
                          setChartPeriod('daily');
                        } else {
                          setNotificationMessage('Please select a specific month and year to view day-wise trends');
                          setShowNotification(true);
                        }
                      }}
                      className={`px-4 py-2 rounded-lg font-['Inter'] text-sm transition-all duration-200 flex items-center gap-2 ${
                        chartPeriod === 'daily'
                          ? 'bg-purple-500 text-white shadow-lg hover:bg-purple-600'
                          : 'bg-[#272121]/50 text-[#F6E9E9]/70 hover:bg-purple-500/20'
                      } ${selectedMonth === 'all' || selectedYear === 'all' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Month</span>
                    </button>
                  </div>
                </div>
              )}
              
              {/* View Mode Toggle */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-[#F6E9E9]/70 font-['Inter'] font-medium">View</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode('chart')}
                    className={`px-4 py-2 rounded-lg font-['Inter'] text-sm transition-all duration-200 flex items-center gap-2 ${
                      viewMode === 'chart'
                        ? 'bg-[#E16428] text-white shadow-lg'
                        : 'bg-[#272121]/50 text-[#F6E9E9]/70 hover:bg-[#E16428]/20'
                    }`}
                  >
                    <BarChart className="w-4 h-4" />
                    <span>Chart</span>
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-4 py-2 rounded-lg font-['Inter'] text-sm transition-all duration-200 flex items-center gap-2 ${
                      viewMode === 'table'
                        ? 'bg-[#E16428] text-white shadow-lg'
                        : 'bg-[#272121]/50 text-[#F6E9E9]/70 hover:bg-[#E16428]/20'
                    }`}
                  >
                    <TableIcon className="w-4 h-4" />
                    <span>Table</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Metrics Buttons (only show for chart mode on desktop) */}
          {viewMode === 'chart' && (
            <div className="hidden sm:flex sm:flex-col gap-2 mb-4">
              <label className="text-xs text-[#F6E9E9]/70 font-['Inter'] font-medium">Metrics</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveTab('revenue')}
                  className={`px-4 py-2 rounded-lg font-['Inter'] text-sm transition-all duration-200 flex items-center gap-2 ${
                    activeTab === 'revenue'
                      ? 'bg-[#E16428] text-white shadow-lg'
                      : 'bg-[#272121]/50 text-[#F6E9E9]/70 hover:bg-[#E16428]/20'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Revenue</span>
                </button>
                <button
                  onClick={() => setActiveTab('profit')}
                  className={`px-4 py-2 rounded-lg font-['Inter'] text-sm transition-all duration-200 flex items-center gap-2 ${
                    activeTab === 'profit'
                      ? 'bg-[#10b981] text-white shadow-lg'
                      : 'bg-[#272121]/50 text-[#F6E9E9]/70 hover:bg-[#10b981]/20'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>Profit</span>
                </button>
                <button
                  onClick={() => setActiveTab('employeePayments')}
                  className={`px-4 py-2 rounded-lg font-['Inter'] text-sm transition-all duration-200 flex items-center gap-2 ${
                    activeTab === 'employeePayments'
                      ? 'bg-[#3b82f6] text-white shadow-lg'
                      : 'bg-[#272121]/50 text-[#F6E9E9]/70 hover:bg-[#3b82f6]/20'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Employee Payments</span>
                </button>
                <button
                  onClick={() => setActiveTab('projectTrends')}
                  className={`px-4 py-2 rounded-lg font-['Inter'] text-sm transition-all duration-200 flex items-center gap-2 ${
                    activeTab === 'projectTrends'
                      ? 'bg-[#8b5cf6] text-white shadow-lg'
                      : 'bg-[#272121]/50 text-[#F6E9E9]/70 hover:bg-[#8b5cf6]/20'
                  }`}
                >
                  <BarChart className="w-4 h-4" />
                  <span>Project Trends</span>
                </button>
                <button
                  onClick={() => setActiveTab('uniqueClients')}
                  className={`px-4 py-2 rounded-lg font-['Inter'] text-sm transition-all duration-200 flex items-center gap-2 ${
                    activeTab === 'uniqueClients'
                      ? 'bg-[#06b6d4] text-white shadow-lg'
                      : 'bg-[#272121]/50 text-[#F6E9E9]/70 hover:bg-[#06b6d4]/20'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Unique Clients</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Chart View */}
        <div
          className={`transition-all duration-300 ${
            viewMode === 'chart'
              ? 'opacity-100 translate-y-0 pointer-events-auto max-h-[480px]'
              : 'opacity-0 -translate-y-2 pointer-events-none max-h-0 overflow-hidden'
          }`}
        >
          <div className="relative h-64 sm:h-80 w-full">
            <canvas ref={chartRef} className="w-full h-full"></canvas>
          </div>
        </div>

        {/* Table View */}
        <div
          className={`transition-all duration-300 ${
            viewMode === 'table'
              ? 'opacity-100 translate-y-0 pointer-events-auto max-h-[600px]'
              : 'opacity-0 translate-y-2 pointer-events-none max-h-0 overflow-hidden'
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E16428]/20">
                  <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-2 text-xs sm:text-sm font-['Inter']">Month</th>
                  <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-2 text-xs sm:text-sm font-['Inter']">Revenue</th>
                  <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-2 text-xs sm:text-sm font-['Inter']">Profit</th>
                  <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-2 text-xs sm:text-sm font-['Inter']">Employee Payments</th>
                  <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-2 text-xs sm:text-sm font-['Inter']">Unique Clients</th>
                  <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-2 text-xs sm:text-sm font-['Inter']">Completed</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 12 }, (_, i) => {
                  const monthData = monthlyChartData[i];
                  const monthName = new Date(0, i).toLocaleString('default', { month: 'long' });
                  
                  return (
                    <tr key={i} className="border-b border-[#E16428]/10 text-xs sm:text-sm">
                      <td className="py-2 sm:py-3 px-2 text-[#F6E9E9] font-['Inter'] whitespace-nowrap">
                        {monthName}
                      </td>
                      <td className="py-2 sm:py-3 px-2 text-[#E16428] font-bold font-['Inter']">
                        LKR {monthData.revenue.toLocaleString()}
                      </td>
                      <td className="py-2 sm:py-3 px-2 text-emerald-400 font-bold font-['Inter']">
                        LKR {monthData.profit.toLocaleString()}
                      </td>
                      <td className="py-2 sm:py-3 px-2 text-[#F6E9E9] font-['Inter']">
                        LKR {monthData.employeePayments.toLocaleString()}
                      </td>
                      <td className="py-2 sm:py-3 px-2 text-[#F6E9E9] font-['Inter']">
                        {monthData.uniqueClients}
                      </td>
                      <td className="py-2 sm:py-3 px-2 text-green-300 font-['Inter']">
                        {monthData.completedCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </GlassCard>

      {/* Analytics Comparison Table */}
      {analyticsComparison.length > 0 && (
        <GlassCard className="p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-[#F6E9E9] mb-4 sm:mb-6 font-['Poppins']">
            Monthly Comparison Trends
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E16428]/20">
                  <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-2 text-xs sm:text-sm font-['Inter']">Month/Year</th>
                  <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-2 text-xs sm:text-sm font-['Inter']">Revenue</th>
                  <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-2 text-xs sm:text-sm font-['Inter']">Profit</th>
                  <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-2 text-xs sm:text-sm font-['Inter']">Profit Margin</th>
                  <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-2 text-xs sm:text-sm font-['Inter']">Emp. Payments</th>
                  <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-2 text-xs sm:text-sm font-['Inter']">Unique Clients</th>
                </tr>
              </thead>
              <tbody>
                {analyticsComparison.map((record) => {
                  const monthName = new Date(record.year, record.month - 1).toLocaleDateString('en-US', { 
                    month: 'short', 
                    year: 'numeric' 
                  });
                  
                  const formatPercentage = (value: number | null) => {
                    if (value === null) return 'N/A';
                    const sign = value >= 0 ? '+' : '';
                    return `${sign}${value.toFixed(1)}%`;
                  };

                  const getPercentageColor = (value: number | null, isInverted: boolean = false) => {
                    if (value === null) return 'text-[#F6E9E9]/50';
                    const isPositive = value >= 0;
                    const shouldBeGreen = isInverted ? !isPositive : isPositive;
                    return shouldBeGreen ? 'text-emerald-400' : 'text-red-400';
                  };

                  return (
                    <tr key={`${record.year}-${record.month}`} className="border-b border-[#E16428]/10 text-xs sm:text-sm">
                      <td className="py-2 sm:py-3 px-2 text-[#F6E9E9] font-['Inter'] whitespace-nowrap">
                        {monthName}
                      </td>
                      <td className={`py-2 sm:py-3 px-2 font-bold font-['Inter'] ${getPercentageColor(record.revenue_change_percentage)}`}>
                        {formatPercentage(record.revenue_change_percentage)}
                      </td>
                      <td className={`py-2 sm:py-3 px-2 font-bold font-['Inter'] ${getPercentageColor(record.profit_change_percentage)}`}>
                        {formatPercentage(record.profit_change_percentage)}
                      </td>
                      <td className={`py-2 sm:py-3 px-2 font-bold font-['Inter'] ${getPercentageColor(record.profit_margin_change_percentage)}`}>
                        {formatPercentage(record.profit_margin_change_percentage)}
                      </td>
                      <td className={`py-2 sm:py-3 px-2 font-bold font-['Inter'] ${getPercentageColor(record.employee_payments_change_percentage, true)}`}>
                        {formatPercentage(record.employee_payments_change_percentage)}
                      </td>
                      <td className={`py-2 sm:py-3 px-2 font-bold font-['Inter'] ${getPercentageColor(record.unique_clients_change_percentage)}`}>
                        {formatPercentage(record.unique_clients_change_percentage)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      <div className="flex justify-center sm:justify-between items-center mb-6">
        {/* Mobile: Curved bottom-right menu */}
        <div className="sm:hidden">
          {/* Floating Action Button */}
          <button
            onClick={() => setMobileActionsDropdownOpen(!mobileActionsDropdownOpen)}
            className={`fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-r from-[#E16428] to-[#E16428]/80 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-500 ease-out hover:scale-110 active:scale-95 ${
              mobileActionsDropdownOpen ? 'rotate-45 scale-110' : 'rotate-0 scale-100'
            }`}
          >
            <div className={`transition-all duration-300 ease-in-out ${
              mobileActionsDropdownOpen ? 'rotate-0 opacity-100' : 'rotate-90 opacity-100'
            }`}>
              {mobileActionsDropdownOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
            </div>
          </button>

          {/* Curved Menu Overlay */}
          {mobileActionsDropdownOpen && (
            <>
              <div 
                className="fixed inset-0 bg-black/30 z-30 animate-fadeIn backdrop-blur-sm"
                onClick={() => setMobileActionsDropdownOpen(false)}
                style={{
                  animation: 'fadeIn 0.3s ease-out'
                }}
              />
              <div 
                className="fixed bottom-0 right-0 z-40 w-72 h-auto bg-transparent rounded-tl-[3rem] rounded-tr-none rounded-br-none shadow-2xl overflow-hidden"
                style={{
                  animation: 'slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                {/* Orange Section - Generate Report */}
                <div 
                  className="bg-gradient-to-br from-[#E16428]/70 to-[#E16428]/60 backdrop-blur-md p-3 border border-white/10"
                  style={{
                    animation: 'slideInLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both'
                  }}
                >
                  <button
                    onClick={() => {
                      setShowReport(true);
                      setMobileActionsDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-1.5 text-white hover:bg-white/10 rounded-xl transition-all duration-300 ease-out active:scale-95 transform hover:translate-x-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="font-['Poppins'] font-semibold text-sm">Generate Report</span>
                  </button>
                </div>
                
                {/* Green Section - Export Excel */}
                <div 
                  className="bg-gradient-to-br from-green-500/70 to-green-600/60 backdrop-blur-md p-3 border border-white/10"
                  style={{
                    animation: 'slideInLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both'
                  }}
                >
                  <button
                    onClick={() => {
                      handleExportClick();
                      setMobileActionsDropdownOpen(false);
                    }}
                    disabled={filteredProjects.length === 0}
                    className="w-full flex items-center gap-3 px-3 py-1.5 text-white hover:bg-white/10 rounded-xl transition-all duration-300 ease-out active:scale-95 transform hover:translate-x-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0"
                  >
                    <Download className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                    <span className="font-['Poppins'] font-semibold text-sm">
                      {filteredProjects.length === 0 ? 'No Data to Export' : 'Export Excel'}
                    </span>
                  </button>
                </div>
                
                {/* Close button */}
                <div 
                  className="absolute top-4 right-4"
                  style={{
                    animation: 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both'
                  }}
                >
                  <button
                    onClick={() => setMobileActionsDropdownOpen(false)}
                    className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all duration-300 ease-out active:scale-95"
                  >
                    <X className="w-5 h-5 text-[#E16428] transition-transform duration-300 hover:rotate-90" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        
        <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
          
          @keyframes slideUpFade {
            from {
              opacity: 0;
              transform: translateY(20px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          
          @keyframes slideInLeft {
            from {
              opacity: 0;
              transform: translateX(30px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          
          @keyframes scaleIn {
            from {
              opacity: 0;
              transform: scale(0);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>

        {/* Desktop: Separate buttons */}
        <div className="hidden sm:flex flex-row gap-3 sm:gap-4">
          <button
            onClick={() => setShowReport(true)}
            className="flex items-center gap-2 px-6 sm:px-7 py-2 sm:py-3 bg-gradient-to-r from-[#E16428] to-[#E16428]/80 text-white rounded-full shadow-xl font-['Poppins'] font-bold text-sm sm:text-lg transition-all duration-200 hover:scale-105 hover:shadow-2xl active:scale-95 border-2 border-[#E16428]/40 focus:outline-none focus:ring-2 focus:ring-[#E16428]/40"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            <span className="tracking-wide">Generate Report</span>
          </button>
          
          <button
            onClick={handleExportClick}
            disabled={filteredProjects.length === 0}
            className="flex items-center gap-2 px-6 sm:px-7 py-2 sm:py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-full shadow-xl font-['Poppins'] font-bold text-sm sm:text-lg transition-all duration-200 hover:scale-105 hover:shadow-2xl active:scale-95 border-2 border-green-500/40 focus:outline-none focus:ring-2 focus:ring-green-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <Download className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="tracking-wide">
              {filteredProjects.length === 0 ? 'No Data to Export' : 'Export Excel'}
            </span>
          </button>
        </div>
        <div className="hidden sm:block" />
      </div>

      {showReport && (
        <ReportModal
          open={showReport}
          onClose={() => setShowReport(false)}
          projects={filteredProjects}
          employees={employees}
          month={selectedMonth}
          year={selectedYear}
          monthlyChartData={monthlyChartData}
          chartYear={selectedYear}
          chartPeriod={chartPeriod}
          dailyChartData={dailyChartData}
        />
      )}

      {/* Admin Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-4">
          <div className="bg-[#272121] border border-[#E16428]/30 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full scale-100 animate-popIn">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#E16428]/20 rounded-full">
                  <Lock className="w-6 h-6 text-[#E16428]" />
                </div>
                <h3 className="text-xl font-bold text-[#F6E9E9] font-['Poppins']">
                  Admin Authentication
                </h3>
              </div>
              <button
                onClick={() => setShowLoginModal(false)}
                className="p-2 hover:bg-[#363333]/60 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-[#F6E9E9]/70" />
              </button>
            </div>
            
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                  Admin Password
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[#363333]/60 border border-[#E16428]/30 rounded-lg text-[#F6E9E9] focus:outline-none focus:border-[#E16428] font-['Inter'] transition-all duration-200"
                  placeholder="Enter admin password"
                  autoFocus
                />
              </div>
              
              {loginError && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm font-['Inter']">{loginError}</p>
                </div>
              )}
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  className="flex-1 px-4 py-3 bg-[#363333]/60 text-[#F6E9E9] rounded-lg hover:bg-[#E16428]/10 transition-all duration-200 font-['Poppins'] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-[#E16428] to-[#E16428]/80 text-white rounded-lg shadow-lg hover:scale-105 transition-all duration-200 font-['Poppins'] font-bold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isAuthenticating ? 'Authenticating...' : 'Export Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Notification Modal */}
      {showNotification && (
        <div 
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-4"
          onClick={() => setShowNotification(false)}
        >
          <div 
            className="bg-[#272121] border border-[#E16428]/30 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full scale-100 animate-popIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#E16428]/20 rounded-full">
                  <Info className="w-6 h-6 text-[#E16428]" />
                </div>
                <h3 className="text-xl font-bold text-[#F6E9E9] font-['Poppins']">
                  Information
                </h3>
              </div>
              <button
                onClick={() => setShowNotification(false)}
                className="p-2 hover:bg-[#363333]/60 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-[#F6E9E9]/70" />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-[#F6E9E9] text-base font-['Inter'] leading-relaxed">
                {notificationMessage}
              </p>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={() => setShowNotification(false)}
                className="px-6 py-3 bg-gradient-to-r from-[#E16428] to-[#E16428]/80 text-white rounded-lg shadow-lg hover:scale-105 transition-all duration-200 font-['Poppins'] font-bold"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};