import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { TrendingUp, DollarSign, Users, Calendar, Clock, Download, Lock, X, Info, CalendarDays, CalendarRange, BarChart, Table as TableIcon, ChevronDown, KeyRound, Wallet, Receipt, Repeat, Percent } from 'lucide-react';
import { Project, Employee } from '../types';
import { GlassCard } from './GlassCard';
import { MonthYearNavigator } from './MonthYearNavigator';
import ReportModal from './ReportModal';
import { supabase } from '../supabaseClient';
import { Chart, LineElement, PointElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, LineController, BarController, Filler } from 'chart.js';
import { useLastRefresh } from '../contexts/LastRefreshContext';
import {
  getEmployeeProjectPaymentBreakdown,
  getProjectEmployeePaymentsDue,
  getProjectEmployeePaymentsPaid,
  getProjectEmployeePaymentsPending,
} from '../utils/employeePayments';
import {
  authenticateWithPin,
  getLastLoginEmail,
  getStoredPinLength,
  loadAdminSecurity,
} from '../utils/adminSecurity';
import {
  type ExpenseSpendRow,
  type ToolSpendCard,
  expensePurchaseDate,
  buildToolSpendForPeriod,
  expenseInPeriod,
  expenseBoughtOrSubscribedInPeriod,
  mapExpenseRowFromDB,
} from '../utils/expenseToolSpend';

Chart.register(LineElement, PointElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, LineController, BarController, Filler);

type ComparisonMetric =
  | 'revenue'
  | 'profit'
  | 'profitMargin'
  | 'employeePayments'
  | 'expenses'
  | 'uniqueClients';

const COMPARISON_METRICS: Array<{
  id: ComparisonMetric;
  label: string;
  shortLabel: string;
  field:
    | 'revenue_change_percentage'
    | 'profit_change_percentage'
    | 'profit_margin_change_percentage'
    | 'employee_payments_change_percentage'
    | 'expenses_change_percentage'
    | 'unique_clients_change_percentage';
  color: string;
  fill: string;
  inverted: boolean;
}> = [
  { id: 'revenue', label: 'Revenue', shortLabel: 'Revenue', field: 'revenue_change_percentage', color: '#E16428', fill: 'rgba(225, 100, 40, 0.55)', inverted: false },
  { id: 'profit', label: 'Profit', shortLabel: 'Profit', field: 'profit_change_percentage', color: '#34d399', fill: 'rgba(52, 211, 153, 0.55)', inverted: false },
  { id: 'profitMargin', label: 'Profit Margin', shortLabel: 'Margin', field: 'profit_margin_change_percentage', color: '#a78bfa', fill: 'rgba(167, 139, 250, 0.55)', inverted: false },
  { id: 'employeePayments', label: 'Emp. Payments', shortLabel: 'Emp. Pay', field: 'employee_payments_change_percentage', color: '#60a5fa', fill: 'rgba(96, 165, 250, 0.55)', inverted: true },
  { id: 'expenses', label: 'Expenses', shortLabel: 'Expenses', field: 'expenses_change_percentage', color: '#f472b6', fill: 'rgba(244, 114, 182, 0.55)', inverted: true },
  { id: 'uniqueClients', label: 'Unique Clients', shortLabel: 'Clients', field: 'unique_clients_change_percentage', color: '#fbbf24', fill: 'rgba(251, 191, 36, 0.55)', inverted: false },
];

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
  expenses: number;
}

export const Analytics: React.FC<AnalyticsProps> = ({ projects, employees, onRefresh }) => {
  const { setLastRefresh } = useLastRefresh();
  // Month/year filter state
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(new Date().getFullYear());
  const [showReport, setShowReport] = useState(false);
  const [projectTypes, setProjectTypes] = useState<{ id: string; name: string }[]>([]);
  
  // Login modal state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinInput, setPinInput] = useState('');

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

  const closeLoginModal = () => {
    setShowLoginModal(false);
    setAdminPassword('');
    setPinInput('');
    setLoginError('');
  };
  
  // Auto-refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Dropdown open states for mobile
  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false);
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const [metricsDropdownOpen, setMetricsDropdownOpen] = useState(false);
  const [empPaymentsCardSlide, setEmpPaymentsCardSlide] = useState(0); // 0 = total due, 1 = paid, 2 = pending
  const [expensesCardSlide, setExpensesCardSlide] = useState(0); // 0 = total, 1 = one-time, 2 = subscription
  const [expenses, setExpenses] = useState<ExpenseSpendRow[]>([]);
  
  // Analytics comparison data state
  const [analyticsComparison, setAnalyticsComparison] = useState<Array<{
    year: number;
    month: number;
    revenue_change_percentage: number | null;
    profit_change_percentage: number | null;
    profit_margin_change_percentage: number | null;
    employee_payments_change_percentage: number | null;
    expenses_change_percentage: number | null;
    unique_clients_change_percentage: number | null;
    created_at: string;
  }>>([]);

  // Chart state
  const [activeTab, setActiveTab] = useState<'revenue' | 'profit' | 'employeePayments' | 'projectTrends' | 'uniqueClients'>('revenue');
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [chartPeriod, setChartPeriod] = useState<'yearly' | 'monthly' | 'daily'>('daily');
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const [comparisonViewMode, setComparisonViewMode] = useState<'chart' | 'table'>('table');
  const [comparisonMetric, setComparisonMetric] = useState<ComparisonMetric>('revenue');
  const [comparisonViewDropdownOpen, setComparisonViewDropdownOpen] = useState(false);
  const [comparisonMetricDropdownOpen, setComparisonMetricDropdownOpen] = useState(false);
  const comparisonChartRef = useRef<HTMLCanvasElement>(null);
  const comparisonChartInstanceRef = useRef<Chart | null>(null);
  
  // Notification modal state
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  // Fetch expenses for profit + KPI cards + tool spend
  const fetchExpenses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(
          'id, name, account, amount, type, status, category, expense_date, next_renewal_date, start_date, created_at, product_id, image_url'
        );
      if (error) throw error;
      setExpenses((data || []).map(mapExpenseRowFromDB));
    } catch (err) {
      console.error('Error loading expenses for analytics:', err);
      setExpenses([]);
    }
  }, []);

  // Auto-refresh functionality
  const handleRefresh = useCallback(async () => {
    if (onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
        await fetchExpenses();
        const refreshTime = new Date();
        setLastRefresh(refreshTime);
      } catch (error) {
        console.error('Error refreshing analytics data:', error);
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [onRefresh, isRefreshing, setLastRefresh, fetchExpenses]);

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

  // Auto-slide Total / Paid / Pending employee payments KPI
  useEffect(() => {
    const interval = setInterval(() => {
      setEmpPaymentsCardSlide(prev => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Auto-slide Total / One-time / Subscription expenses KPI
  useEffect(() => {
    const interval = setInterval(() => {
      setExpensesCardSlide(prev => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    void fetchExpenses();
  }, [fetchExpenses]);

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

  // Fetch analytics comparison data for selected year
  useEffect(() => {
    async function fetchAnalyticsComparison() {
      let query = supabase
        .from('analytics_comparison')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (selectedYear !== 'all') {
        query = query.eq('year', selectedYear);
      } else {
        query = query.limit(24);
      }

      const { data, error } = await query;

      if (!error && data) {
        setAnalyticsComparison(data);
      } else if (error) {
        console.error('Failed to fetch analytics comparison:', error);
        setAnalyticsComparison([]);
      }
    }
    void fetchAnalyticsComparison();
  }, [selectedYear]);

  // Calculate year range dynamically for the year dropdown
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

  // Filtered projects by month/year
  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      if (!project.createdAt) return false;
      const created = new Date(project.createdAt);
      const monthOk = selectedMonth === 'all' || created.getMonth() === selectedMonth;
      const yearOk = selectedYear === 'all' || created.getFullYear() === selectedYear;
      return monthOk && yearOk;
    });
  }, [projects, selectedMonth, selectedYear]);

  // Filtered expenses: bought or subscribed in selected month/year only
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => expenseInPeriod(expense, selectedMonth, selectedYear));
  }, [expenses, selectedMonth, selectedYear]);

  const totalPeriodExpenses = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]
  );
  const oneTimeExpenses = useMemo(
    () => filteredExpenses.filter(e => e.type === 'one_time').reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]
  );
  const subscriptionExpenses = useMemo(
    () =>
      filteredExpenses.filter(e => e.type === 'subscription').reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]
  );

  // Expenses by buy/subscribe month (YYYY-MM) for KPI MoM / chart profit
  const expensesByMonthKey = useMemo(() => {
    const map: Record<string, { total: number; one_time: number; subscription: number }> = {};
    expenses.forEach(expense => {
      const iso = expensePurchaseDate(expense);
      if (!iso) return;
      const date = new Date(iso + 'T12:00:00');
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!map[key]) map[key] = { total: 0, one_time: 0, subscription: 0 };
      map[key].total += expense.amount;
      map[key][expense.type] += expense.amount;
    });
    return map;
  }, [expenses]);

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
          expenses: 0,
        };
      }
      
      months[monthKey].revenue += project.price;
      months[monthKey].projects += 1;
      months[monthKey].employeePayments += getProjectEmployeePaymentsDue(project);
      
      if (project.status === 'Delivered') {
        months[monthKey].completed += 1;
      }
    });

    // Attach / create months for expenses in the selected period
    Object.entries(expensesByMonthKey).forEach(([monthKey, totals]) => {
      const [y, m] = monthKey.split('-').map(Number);
      const monthOk = selectedMonth === 'all' || m - 1 === selectedMonth;
      const yearOk = selectedYear === 'all' || y === selectedYear;
      if (!monthOk || !yearOk) return;

      if (!months[monthKey]) {
        months[monthKey] = {
          month: monthKey,
          revenue: 0,
          projects: 0,
          completed: 0,
          employeePayments: 0,
          expenses: 0,
        };
      }
      months[monthKey].expenses = totals.total;
    });
    
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredProjects, expensesByMonthKey, selectedMonth, selectedYear]);

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
      map[key].employeePayments += getProjectEmployeePaymentsDue(project);
      map[key].profit += (project.price - getProjectEmployeePaymentsDue(project));
      // Use clientName + clientUniOrg as unique identifier
      const clientKey = `${project.clientName}|${project.clientUniOrg}`;
      map[key].uniqueClients.add(clientKey);
    });

    // Deduct business expenses from monthly profit
    Object.keys(expensesByMonthKey).forEach(key => {
      if (!map[key]) {
        map[key] = {
          revenue: 0,
          profit: 0,
          employeePayments: 0,
          uniqueClients: new Set<string>(),
        };
      }
      map[key].profit -= expensesByMonthKey[key].total;
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
  }, [projects, expensesByMonthKey]);

  // Helper: get month-over-month percentage change for a KPI
  const getKpiChange = (metric: 'revenue' | 'profit' | 'employeePayments' | 'uniqueClients') => {
    if (selectedMonth === 'all' || selectedYear === 'all') return null;

    const year = selectedYear;
    const monthIndex = selectedMonth; // 0-based

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

  const getExpenseKpiChange = (metric: 'total' | 'one_time' | 'subscription') => {
    if (selectedMonth === 'all' || selectedYear === 'all') return null;

    const year = selectedYear;
    const monthIndex = selectedMonth;
    const currentKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    const prevDate = new Date(year, monthIndex - 1, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const currentValue = expensesByMonthKey[currentKey]?.[metric] ?? 0;
    const prevValue = expensesByMonthKey[prevKey]?.[metric] ?? 0;

    if (!prevValue || prevValue === 0) return null;
    return ((currentValue - prevValue) / prevValue) * 100;
  };

  const expensesChange = getExpenseKpiChange('total');

  /** Per-tool spend for selection (single month MoM, or period totals for All) */
  const toolSpendCards = useMemo((): ToolSpendCard[] => {
    return buildToolSpendForPeriod(expenses, selectedMonth, selectedYear);
  }, [expenses, selectedMonth, selectedYear]);

  const toolSpendHasMom = selectedMonth !== 'all' && selectedYear !== 'all';

  const toolSpendPeriodLabel = useMemo(() => {
    if (selectedMonth !== 'all' && selectedYear !== 'all') {
      return new Date(selectedYear as number, selectedMonth as number, 1).toLocaleDateString(
        undefined,
        { month: 'long', year: 'numeric' }
      );
    }
    if (selectedMonth === 'all' && selectedYear !== 'all') {
      return `All months · ${selectedYear}`;
    }
    if (selectedMonth !== 'all' && selectedYear === 'all') {
      return `All years · ${new Date(2000, selectedMonth as number, 1).toLocaleDateString(undefined, { month: 'long' })}`;
    }
    return 'All time';
  }, [selectedMonth, selectedYear]);

  const toolSpendTotals = useMemo(() => {
    return toolSpendCards.reduce(
      (acc, c) => {
        acc.spend += c.spend;
        acc.accounts += c.accountCount;
        acc.buys += c.buyCount;
        return acc;
      },
      { spend: 0, accounts: 0, buys: 0 }
    );
  }, [toolSpendCards]);

  const oneTimeExpensesChange = getExpenseKpiChange('one_time');
  const subscriptionExpensesChange = getExpenseKpiChange('subscription');

  // Calculate unique clients excluding those from previous months
  const uniqueClients = useMemo(() => {
    // When filtering all months / all years, count unique clients in the filtered set
    if (selectedMonth === 'all' || selectedYear === 'all') {
      const clients = new Set<string>();
      filteredProjects.forEach(project => {
        const clientKey = `${project.clientName}|${project.clientUniOrg}`;
        clients.add(clientKey);
      });
      return clients.size;
    }

    // Exclude clients from previous months for the selected period
    const selectedDate = new Date(selectedYear, selectedMonth, 1);
    
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
  const totalEmployeePayments = filteredProjects.reduce(
    (sum, project) => sum + getProjectEmployeePaymentsDue(project),
    0
  );
  const totalPaidEmployeePayments = filteredProjects.reduce(
    (sum, project) => sum + getProjectEmployeePaymentsPaid(project),
    0
  );
  const totalPendingEmployeePayments = filteredProjects.reduce(
    (sum, project) => sum + getProjectEmployeePaymentsPending(project),
    0
  );
  const profit = totalRevenue - totalEmployeePayments - totalPeriodExpenses;
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
    return employees
      .filter(employee => employee.showInPerformance !== false)
      .map(employee => {
      // Filter projects where this employee is assigned (handles comma-separated IDs)
      const employeeProjects = filteredProjects.filter(p => {
        if (!p.assignedTo) return false;
        const assignedIds = p.assignedTo.split(',').map(id => id.trim());
        return assignedIds.includes(employee.id);
      });
      
      const completed = employeeProjects.filter(
        p => p.status === 'Delivered' || p.status === 'Pending Payment'
      ).length;
      
      // Calculate earnings using individual employee payments (due / paid / remaining)
      let totalEarnings = 0;
      let pendingEarnings = 0;
      let paidEarnings = 0;
      /** Pending employee pay only on completed projects (Delivered / Pending Payment). */
      let pendingCompletedEarnings = 0;

      employeeProjects.forEach(p => {
        const breakdown = getEmployeeProjectPaymentBreakdown(p, employee.id);
        totalEarnings += breakdown.due;
        pendingEarnings += breakdown.remaining;
        paidEarnings += breakdown.paid;
        if (p.status === 'Delivered' || p.status === 'Pending Payment') {
          pendingCompletedEarnings += breakdown.remaining;
        }
      });
      
      const revenue = employeeProjects.reduce((sum, p) => sum + p.price, 0);
      const profit = employeeProjects.reduce((sum, p) => {
        return sum + (p.price - getProjectEmployeePaymentsDue(p));
      }, 0);
      
      return {
        ...employee,
        projectCount: employeeProjects.length,
        completedProjects: completed,
        totalEarnings,
        pendingEarnings,
        pendingCompletedEarnings,
        paidEarnings,
        revenue,
        profit,
        displayValue: totalEarnings,
        completionRate: employeeProjects.length > 0 ? (completed / employeeProjects.length) * 100 : 0,
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
      months[month].employeePayments += getProjectEmployeePaymentsDue(project);
      months[month].profit += (project.price - getProjectEmployeePaymentsDue(project));
      months[month].projectCount += 1;
      // Add client to Set - Set automatically deduplicates, so same client appears only once per month
      const clientKey = `${project.clientName}|${project.clientUniOrg}`;
      months[month].uniqueClients.add(clientKey);
      
      if (project.status === 'Delivered' || project.status === 'Pending Payment') {
        months[month].completedCount += 1;
      }
    });

    // Deduct expenses by buy/subscribe month in the selected year
    if (typeof selectedYear === 'number') {
      expenses.forEach(expense => {
        const iso = expensePurchaseDate(expense);
        if (!iso) return;
        const date = new Date(iso + 'T12:00:00');
        if (date.getFullYear() !== selectedYear) return;
        months[date.getMonth()].profit -= expense.amount;
      });
    }

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
  }, [annualProjects, expenses, selectedYear]);

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
      years[year].employeePayments += getProjectEmployeePaymentsDue(project);
      years[year].profit += (project.price - getProjectEmployeePaymentsDue(project));
      years[year].projectCount += 1;
      const clientKey = `${project.clientName}|${project.clientUniOrg}`;
      years[year].uniqueClients.add(clientKey);
    });

    expenses.forEach(expense => {
      const iso = expensePurchaseDate(expense);
      if (!iso) return;
      const year = new Date(iso + 'T12:00:00').getFullYear();
      if (!years[year]) {
        years[year] = {
          revenue: 0,
          profit: 0,
          employeePayments: 0,
          projectCount: 0,
          uniqueClients: new Set<string>(),
        };
      }
      years[year].profit -= expense.amount;
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
  }, [projects, expenses]);

  // Calculate daily data for selected month
  const dailyChartData = useMemo(() => {
    if (selectedMonth === 'all' || selectedYear === 'all') {
      return null;
    }

    const year = selectedYear;
    const monthIndex = selectedMonth;
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
        dailyData[day].employeePayments += getProjectEmployeePaymentsDue(project);
        dailyData[day].profit += (project.price - getProjectEmployeePaymentsDue(project));
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
      const year = selectedYear;
      const monthIndex = selectedMonth;
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

    // Daily requires a specific month+year; monthly requires a specific year
    if (chartPeriod === 'daily' && (selectedMonth === 'all' || selectedYear === 'all')) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
      return;
    }
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

  // Monthly Comparison Trends chart (single metric MoM %)
  useEffect(() => {
    if (comparisonViewMode !== 'chart') {
      if (comparisonChartInstanceRef.current) {
        comparisonChartInstanceRef.current.destroy();
        comparisonChartInstanceRef.current = null;
      }
      return;
    }

    if (!comparisonChartRef.current || analyticsComparison.length === 0) {
      if (comparisonChartInstanceRef.current) {
        comparisonChartInstanceRef.current.destroy();
        comparisonChartInstanceRef.current = null;
      }
      return;
    }

    const metric = COMPARISON_METRICS.find((m) => m.id === comparisonMetric) ?? COMPARISON_METRICS[0];
    const sorted = [...analyticsComparison].sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month
    );

    const labels = sorted.map((record) =>
      new Date(record.year, record.month - 1).toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      })
    );

    const values = sorted.map((r) => r[metric.field] as number | null);
    const barColors = values.map((v) => {
      if (v === null || v === undefined) return 'rgba(246, 233, 233, 0.2)';
      const isGood = metric.inverted ? v <= 0 : v >= 0;
      return isGood ? 'rgba(52, 211, 153, 0.85)' : 'rgba(248, 113, 113, 0.85)';
    });
    const borderColors = values.map((v) => {
      if (v === null || v === undefined) return 'rgba(246, 233, 233, 0.35)';
      const isGood = metric.inverted ? v <= 0 : v >= 0;
      return isGood ? '#34d399' : '#f87171';
    });

    const dataset = {
      label: `${metric.label} MoM %`,
      data: values,
      backgroundColor: barColors,
      borderColor: borderColors,
      borderWidth: 1.5,
      borderRadius: 6,
      borderSkipped: false as const,
      maxBarThickness: 48,
    };

    const zeroLinePlugin = {
      id: 'comparisonZeroLine',
      afterDraw(chart: Chart) {
        const yScale = chart.scales.y;
        if (!yScale) return;
        const y = yScale.getPixelForValue(0);
        const { ctx, chartArea } = chart;
        if (y < chartArea.top || y > chartArea.bottom) return;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(chartArea.left, y);
        ctx.lineTo(chartArea.right, y);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(246, 233, 233, 0.45)';
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.restore();
      },
    };

    if (comparisonChartInstanceRef.current) {
      comparisonChartInstanceRef.current.destroy();
      comparisonChartInstanceRef.current = null;
    }

    const ctx = comparisonChartRef.current.getContext('2d');
    if (!ctx) return;

    comparisonChartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [dataset] },
      plugins: [zeroLinePlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 450,
          easing: 'easeOutQuart',
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        onHover: (event, elements) => {
          const target = event.native?.target as HTMLElement | null | undefined;
          if (target) target.style.cursor = elements.length ? 'pointer' : 'default';
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(39, 33, 33, 0.96)',
            titleColor: '#F6E9E9',
            bodyColor: '#F6E9E9',
            borderColor: '#E16428',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              title: (items) => {
                const idx = items[0]?.dataIndex ?? 0;
                const record = sorted[idx];
                if (!record) return '';
                return new Date(record.year, record.month - 1).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                });
              },
              label: (context) => {
                const value = context.parsed.y;
                if (value === null || value === undefined) return `${metric.label}: N/A`;
                const sign = value >= 0 ? '+' : '';
                const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
                return `${metric.label}: ${sign}${value.toFixed(1)}% (${direction} vs prior month)`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: '#F6E9E9',
              font: { family: 'Inter', size: 11, weight: 'bold' as const },
              maxRotation: 0,
              autoSkip: true,
            },
            grid: { display: false },
          },
          y: {
            grace: '8%',
            ticks: {
              color: '#F6E9E9',
              font: { family: 'Inter', size: 11 },
              callback: function (value) {
                const n = Number(value);
                const sign = n > 0 ? '+' : '';
                return `${sign}${n}%`;
              },
            },
            grid: {
              color: (ctx) =>
                ctx.tick.value === 0 ? 'rgba(246, 233, 233, 0.35)' : 'rgba(246, 233, 233, 0.08)',
            },
          },
        },
      },
    });

    return () => {
      if (comparisonChartInstanceRef.current) {
        comparisonChartInstanceRef.current.destroy();
        comparisonChartInstanceRef.current = null;
      }
    };
  }, [comparisonViewMode, comparisonMetric, analyticsComparison]);

  const comparisonChartSummary = useMemo(() => {
    if (analyticsComparison.length === 0) return null;
    const metric = COMPARISON_METRICS.find((m) => m.id === comparisonMetric) ?? COMPARISON_METRICS[0];
    const sorted = [...analyticsComparison].sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month
    );
    const withValues = sorted
      .map((r) => ({
        record: r,
        value: r[metric.field] as number | null,
        label: new Date(r.year, r.month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      }))
      .filter((x): x is { record: typeof sorted[0]; value: number; label: string } => x.value !== null && x.value !== undefined);

    if (withValues.length === 0) return null;

    const latest = withValues[withValues.length - 1];
    const best = withValues.reduce((a, b) => (metric.inverted ? (b.value < a.value ? b : a) : b.value > a.value ? b : a));
    const worst = withValues.reduce((a, b) => (metric.inverted ? (b.value > a.value ? b : a) : b.value < a.value ? b : a));
    const avg = withValues.reduce((sum, x) => sum + x.value, 0) / withValues.length;

    return { metric, latest, best, worst, avg };
  }, [analyticsComparison, comparisonMetric]);

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
      closeLoginModal();
      // Proceed with export
      exportToExcel();
    }
  };

  const handlePinAuth = async (pinValue?: string) => {
    const value = (pinValue ?? pinInput).replace(/\D/g, '');
    const email = getSessionEmail();
    if (!email) {
      setLoginError('Unable to verify user');
      return;
    }
    const len = getStoredPinLength(email);
    if (value.length < len) return;

    setIsAuthenticating(true);
    setLoginError('');
    try {
      const res = await authenticateWithPin(email, value);
      if (!res.ok) {
        await logAction(null, email, 'export_fail');
        setLoginError('PIN incorrect');
        setPinInput('');
        return;
      }
      const { data: admin } = await supabase
        .from('admin')
        .select('id, email')
        .ilike('email', email)
        .maybeSingle();
      if (admin) {
        await logAction(admin.id, admin.email, 'export_success');
      }
      closeLoginModal();
      exportToExcel();
    } catch {
      await logAction(null, 'Unknown', 'export_fail');
      setLoginError('Authentication failed. Please try again.');
      setPinInput('');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const onPinChange = (raw: string) => {
    const email = getSessionEmail();
    const len = email ? getStoredPinLength(email) : 4;
    const digits = raw.replace(/\D/g, '').slice(0, len);
    setPinInput(digits);
    setLoginError('');
    if (digits.length === len) {
      void handlePinAuth(digits);
    }
  };

  // CSV export (projects + tool spend) — after authentication
  const exportToExcel = () => {
    const escapeCsv = (val: string | number | null | undefined) => {
      const s = val == null ? '' : String(val);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const projectHeaders = [
      'ID',
      'Project ID',
      'Client Name',
      'Client Uni/Org',
      'Project Description',
      'Deadline Date',
      'Price',
      'Advance',
      'Assigned To',
      'Emp Pay Due',
      'Emp Pay Paid',
      'Emp Pay Pending',
      'Status',
      'Fast Deliver',
      'Created At',
      'Updated At',
    ];

    const getProjectTypeNames = (projectDescription: string) => {
      if (!projectDescription) return 'No types specified';
      const typeIds = projectDescription.split(',').map(id => id.trim());
      return typeIds
        .map(id => {
          const type = projectTypes.find(t => t.id === id);
          return type ? type.name : `Unknown Type (${id})`;
        })
        .join(', ');
    };

    const projectRows = filteredProjects.map(project => {
      const assignedIds = project.assignedTo
        ? project.assignedTo.split(',').map(id => id.trim()).filter(Boolean)
        : [];
      const assignedToName = assignedIds.length
        ? assignedIds
            .map(id => {
              const emp = employees.find(e => e.id === id);
              return emp ? `${emp.firstName} ${emp.lastName}` : id;
            })
            .join('; ')
        : 'Unassigned';

      return [
        project.id,
        project.projectId,
        escapeCsv(project.clientName),
        escapeCsv(project.clientUniOrg),
        escapeCsv(getProjectTypeNames(project.projectDescription)),
        project.deadlineDate,
        project.price,
        project.advance,
        escapeCsv(assignedToName),
        getProjectEmployeePaymentsDue(project),
        getProjectEmployeePaymentsPaid(project),
        getProjectEmployeePaymentsPending(project),
        project.status,
        project.fastDeliver ? 'Yes' : 'No',
        project.createdAt,
        project.updatedAt,
      ].join(',');
    });

    const sections: string[] = [
      'PROJECTS',
      projectHeaders.join(','),
      ...projectRows,
    ];

    const toolCards = buildToolSpendForPeriod(expenses, selectedMonth, selectedYear);
    const periodLines = expenses.filter(e =>
      expenseBoughtOrSubscribedInPeriod(e, selectedMonth, selectedYear)
    );
    const hasMom =
      selectedMonth !== 'all' && selectedYear !== 'all';

    sections.push(
      '',
      'TOOL SPEND',
      [
        'Product',
        'Category',
        'Spend (LKR)',
        'Accounts',
        'Buys',
        'Prev Month Spend (LKR)',
        'MoM Change %',
      ].join(',')
    );

    if (toolCards.length === 0) {
      sections.push('(no tool expenses for this period)');
    } else {
      toolCards.forEach(card => {
        let mom = '';
        if (hasMom) {
          if (card.spendChangePct != null) {
            mom = card.spendChangePct.toFixed(1);
          } else if (card.spend > 0 && card.prevSpend === 0) {
            mom = 'New';
          } else if (card.spend === 0 && card.prevSpend > 0) {
            mom = '-100.0';
          }
        }
        sections.push(
          [
            escapeCsv(card.name),
            escapeCsv(card.category),
            card.spend,
            card.accountCount,
            card.buyCount,
            hasMom ? card.prevSpend : '',
            mom,
          ].join(',')
        );
      });
      const toolTotal = toolCards.reduce((s, c) => s + c.spend, 0);
      sections.push(
        [
          'TOTAL',
          '',
          toolTotal,
          '',
          '',
          hasMom ? toolCards.reduce((s, c) => s + c.prevSpend, 0) : '',
          '',
        ].join(',')
      );
    }

    sections.push(
      '',
      'EXPENSE LINE ITEMS',
      [
        'Name',
        'Account',
        'Type',
        'Status',
        'Category',
        'Amount (LKR)',
        'Start Date',
        'Expense / Due Date',
        'Product ID',
      ].join(',')
    );

    if (periodLines.length === 0) {
      sections.push('(no expense lines for this period)');
    } else {
      periodLines.forEach(row => {
        const dueOrExpense =
          row.type === 'subscription'
            ? row.nextRenewalDate || ''
            : row.expenseDate || expensePurchaseDate(row) || '';
        sections.push(
          [
            escapeCsv(row.name),
            escapeCsv(row.account),
            row.type,
            row.status,
            escapeCsv(row.category),
            row.amount,
            row.startDate || '',
            dueOrExpense,
            row.productId || '',
          ].join(',')
        );
      });
    }

    const csvContent = sections.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);

    const monthName =
      selectedMonth === 'all'
        ? 'all_months'
        : new Date(0, selectedMonth).toLocaleString('default', { month: 'long' });
    const yearPart = selectedYear === 'all' ? 'all_years' : selectedYear;
    const filename = `analytics_${monthName}_${yearPart}`;

    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle export button click (triggers login)
  const handleExportClick = async () => {
    setShowLoginModal(true);
    setAdminPassword('');
    setPinInput('');
    setLoginError('');
    const email = getSessionEmail();
    if (email) {
      const prefs = await loadAdminSecurity(email);
      setPinEnabled(prefs.pinEnabled);
    } else {
      setPinEnabled(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
        <h1 className="text-xl sm:text-3xl font-bold text-[#F6E9E9] font-['Playfair_Display'] shrink-0">
          Analytics & Reports
        </h1>
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
              <p className="text-[10px] mt-1 font-['Inter'] text-[#F6E9E9]/40">
                After emp. pay & expenses
              </p>
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

        <GlassCard
          className="p-4 sm:p-6 cursor-pointer relative overflow-hidden hover:scale-[1.01] transition-transform duration-300"
          onClick={() => setEmpPaymentsCardSlide(prev => (prev + 1) % 3)}
        >
          <div className="relative min-h-[88px]">
            {[
              {
                title: 'Total Employee Payments',
                value: totalEmployeePayments,
                change: employeePaymentsChange,
                iconBg: 'bg-yellow-500/20',
                iconClass: 'text-yellow-400',
                valueClass: 'text-[#F6E9E9]',
              },
              {
                title: 'Paid Employee Payments',
                value: totalPaidEmployeePayments,
                change: null as number | null,
                iconBg: 'bg-green-500/20',
                iconClass: 'text-green-400',
                valueClass: 'text-green-400',
              },
              {
                title: 'Pending Employee Payments',
                value: totalPendingEmployeePayments,
                change: null as number | null,
                iconBg: 'bg-amber-500/20',
                iconClass: 'text-amber-300',
                valueClass: 'text-yellow-400',
              },
            ].map((slide, idx) => (
              <div
                key={slide.title}
                className={`flex items-center justify-between transition-all duration-500 ease-in-out ${
                  empPaymentsCardSlide === idx
                    ? 'opacity-100 translate-y-0 relative'
                    : 'opacity-0 absolute inset-0 translate-y-3 pointer-events-none'
                }`}
              >
                <div>
                  <p className="text-[#F6E9E9]/70 text-sm font-['Inter']">{slide.title}</p>
                  <p className={`text-xl sm:text-2xl font-bold mt-1 font-['Poppins'] ${slide.valueClass}`}>
                    LKR {slide.value.toLocaleString()}
                  </p>
                  {slide.change !== null && (
                    <p
                      className={`text-xs mt-1 font-['Inter'] ${
                        slide.change <= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {slide.change >= 0 ? '+' : ''}
                      {slide.change.toFixed(1)}%
                    </p>
                  )}
                </div>
                <div className={`p-2 sm:p-3 rounded-full ${slide.iconBg}`}>
                  <Users className={`w-5 h-5 sm:w-6 sm:h-6 ${slide.iconClass}`} />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard
          className="p-4 sm:p-6 cursor-pointer relative overflow-hidden hover:scale-[1.01] transition-transform duration-300"
          onClick={() => setExpensesCardSlide(prev => (prev + 1) % 3)}
        >
          <div className="relative min-h-[88px]">
            {[
              {
                title: 'Total Expenses',
                value: totalPeriodExpenses,
                change: expensesChange,
                icon: Wallet,
                iconBg: 'bg-orange-500/20',
                iconClass: 'text-orange-300',
                valueClass: 'text-[#F6E9E9]',
              },
              {
                title: 'One-time Expenses',
                value: oneTimeExpenses,
                change: oneTimeExpensesChange,
                icon: Receipt,
                iconBg: 'bg-purple-500/20',
                iconClass: 'text-purple-300',
                valueClass: 'text-purple-300',
              },
              {
                title: 'Subscription Expenses',
                value: subscriptionExpenses,
                change: subscriptionExpensesChange,
                icon: Repeat,
                iconBg: 'bg-sky-500/20',
                iconClass: 'text-sky-300',
                valueClass: 'text-sky-300',
              },
            ].map((slide, idx) => {
              const Icon = slide.icon;
              return (
                <div
                  key={slide.title}
                  className={`flex items-center justify-between transition-all duration-500 ease-in-out ${
                    expensesCardSlide === idx
                      ? 'opacity-100 translate-y-0 relative'
                      : 'opacity-0 absolute inset-0 translate-y-3 pointer-events-none'
                  }`}
                >
                  <div>
                    <p className="text-[#F6E9E9]/70 text-sm font-['Inter']">{slide.title}</p>
                    <p
                      className={`text-xl sm:text-2xl font-bold mt-1 font-['Poppins'] ${slide.valueClass}`}
                    >
                      LKR {slide.value.toLocaleString()}
                    </p>
                    {slide.change !== null && (
                      <p
                        className={`text-xs mt-1 font-['Inter'] ${
                          slide.change <= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {slide.change >= 0 ? '+' : ''}
                        {slide.change.toFixed(1)}%
                      </p>
                    )}
                  </div>
                  <div className={`p-2 sm:p-3 rounded-full ${slide.iconBg}`}>
                    <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${slide.iconClass}`} />
                  </div>
                </div>
              );
            })}
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
                <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-1 text-xs sm:text-sm font-['Inter']">Emp. Salary</th>
                <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-1 text-xs sm:text-sm font-['Inter']">Expenses</th>
                <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-1 text-xs sm:text-sm font-['Inter']">Profit</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.length > 0 ? (
                monthlyData.map((month: MonthlyData) => (
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
                  <td className="py-2 sm:py-3 px-1 text-yellow-300 font-bold font-['Inter']">
                    LKR {(month.employeePayments || 0).toLocaleString()}
                  </td>
                  <td className="py-2 sm:py-3 px-1 text-orange-300 font-bold font-['Inter']">
                    LKR {(month.expenses || 0).toLocaleString()}
                  </td>
                  <td className="py-2 sm:py-3 px-1 text-green-300 font-bold font-['Inter']">
                    LKR {(
                      month.revenue - month.employeePayments - (month.expenses || 0)
                    ).toLocaleString()}
                  </td>
                </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#F6E9E9]/70 font-['Inter']">
                    No projects found for the selected month and year
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
            {employeePerformance
              .filter(employee => employee.projectCount > 0)
              .slice(0, 5)
              .map((employee) => (
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
                    <span className="inline-flex items-baseline gap-1 flex-wrap justify-end">
                      <span className="text-yellow-400">
                        LKR {(employee.pendingCompletedEarnings || 0).toLocaleString()}
                      </span>
                      <span className="text-[#F6E9E9]/40 font-normal">/</span>
                      <span>LKR {employee.totalEarnings.toLocaleString()}</span>
                    </span>
                  </p>
                  <p className="text-[#F6E9E9]/70 text-xs sm:text-sm">
                    {employee.completionRate.toFixed(1)}% · completed pending / total
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
                  ? `Monthly Trends - ${selectedYear === 'all' ? 'All years' : selectedYear}`
                  : `Month Trends - ${
                      selectedMonth === 'all'
                        ? 'All months'
                        : new Date(0, selectedMonth).toLocaleString('default', { month: 'long' })
                    } ${selectedYear === 'all' ? 'All years' : selectedYear}`
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
                                setChartPeriod('monthly');
                                setPeriodDropdownOpen(false);
                              }}
                              className="w-full px-4 py-2 text-left flex items-center gap-2 text-[#F6E9E9] hover:bg-[#E16428]/20 transition-colors"
                            >
                              <CalendarDays className="w-4 h-4" />
                              <span>Monthly</span>
                            </button>
                            <button
                              onClick={() => {
                                setChartPeriod('daily');
                                setPeriodDropdownOpen(false);
                              }}
                              className="w-full px-4 py-2 text-left flex items-center gap-2 text-[#F6E9E9] hover:bg-[#E16428]/20 transition-colors"
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
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setChartPeriod('yearly')}
                      className={`px-1 pb-2 border-0 border-b-2 rounded-none bg-transparent font-['Inter'] text-sm transition-colors duration-200 flex items-center gap-2 ${
                        chartPeriod === 'yearly'
                          ? 'border-green-500 text-green-400'
                          : 'border-transparent text-[#F6E9E9]/55 hover:text-green-400/80 hover:border-green-500/40'
                      }`}
                    >
                      <CalendarRange className="w-4 h-4" />
                      <span>Annual</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartPeriod('monthly')}
                      className={`px-1 pb-2 border-0 border-b-2 rounded-none bg-transparent font-['Inter'] text-sm transition-colors duration-200 flex items-center gap-2 ${
                        chartPeriod === 'monthly'
                          ? 'border-blue-500 text-blue-400'
                          : 'border-transparent text-[#F6E9E9]/55 hover:text-blue-400/80 hover:border-blue-500/40'
                      }`}
                    >
                      <CalendarDays className="w-4 h-4" />
                      <span>Monthly</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartPeriod('daily')}
                      className={`px-1 pb-2 border-0 border-b-2 rounded-none bg-transparent font-['Inter'] text-sm transition-colors duration-200 flex items-center gap-2 ${
                        chartPeriod === 'daily'
                          ? 'border-purple-500 text-purple-400'
                          : 'border-transparent text-[#F6E9E9]/55 hover:text-purple-400/80 hover:border-purple-500/40'
                      }`}
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
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setViewMode('chart')}
                    className={`px-1 pb-2 border-0 border-b-2 rounded-none bg-transparent font-['Inter'] text-sm transition-colors duration-200 flex items-center gap-2 ${
                      viewMode === 'chart'
                        ? 'border-[#E16428] text-[#E16428]'
                        : 'border-transparent text-[#F6E9E9]/55 hover:text-[#E16428]/80 hover:border-[#E16428]/40'
                    }`}
                  >
                    <BarChart className="w-4 h-4" />
                    <span>Chart</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`px-1 pb-2 border-0 border-b-2 rounded-none bg-transparent font-['Inter'] text-sm transition-colors duration-200 flex items-center gap-2 ${
                      viewMode === 'table'
                        ? 'border-[#E16428] text-[#E16428]'
                        : 'border-transparent text-[#F6E9E9]/55 hover:text-[#E16428]/80 hover:border-[#E16428]/40'
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
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('revenue')}
                  className={`px-1 pb-2 border-0 border-b-2 rounded-none bg-transparent font-['Inter'] text-sm transition-colors duration-200 flex items-center gap-2 ${
                    activeTab === 'revenue'
                      ? 'border-[#E16428] text-[#E16428]'
                      : 'border-transparent text-[#F6E9E9]/55 hover:text-[#E16428]/80 hover:border-[#E16428]/40'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Revenue</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('profit')}
                  className={`px-1 pb-2 border-0 border-b-2 rounded-none bg-transparent font-['Inter'] text-sm transition-colors duration-200 flex items-center gap-2 ${
                    activeTab === 'profit'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-[#F6E9E9]/55 hover:text-emerald-400/80 hover:border-emerald-500/40'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>Profit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('employeePayments')}
                  className={`px-1 pb-2 border-0 border-b-2 rounded-none bg-transparent font-['Inter'] text-sm transition-colors duration-200 flex items-center gap-2 ${
                    activeTab === 'employeePayments'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-[#F6E9E9]/55 hover:text-blue-400/80 hover:border-blue-500/40'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Employee Payments</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('projectTrends')}
                  className={`px-1 pb-2 border-0 border-b-2 rounded-none bg-transparent font-['Inter'] text-sm transition-colors duration-200 flex items-center gap-2 ${
                    activeTab === 'projectTrends'
                      ? 'border-violet-500 text-violet-400'
                      : 'border-transparent text-[#F6E9E9]/55 hover:text-violet-400/80 hover:border-violet-500/40'
                  }`}
                >
                  <BarChart className="w-4 h-4" />
                  <span>Project Trends</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('uniqueClients')}
                  className={`px-1 pb-2 border-0 border-b-2 rounded-none bg-transparent font-['Inter'] text-sm transition-colors duration-200 flex items-center gap-2 ${
                    activeTab === 'uniqueClients'
                      ? 'border-cyan-500 text-cyan-400'
                      : 'border-transparent text-[#F6E9E9]/55 hover:text-cyan-400/80 hover:border-cyan-500/40'
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

      {/* Analytics Comparison Chart/Table */}
      <GlassCard className="p-4 sm:p-6">
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-[#F6E9E9] font-['Poppins']">
              Monthly Comparison Trends
              {selectedYear !== 'all' && (
                <span className="ml-2 text-sm font-normal text-[#F6E9E9]/45 font-['Inter']">
                  · {selectedYear}
                </span>
              )}
            </h2>

            {/* Mobile dropdowns */}
            <div className="flex flex-col gap-3 sm:hidden w-full">
              <div className="flex gap-3 w-full">
                {comparisonViewMode === 'chart' && (
                  <div className="flex flex-col gap-2 w-1/2 relative">
                    <label className="text-xs text-[#F6E9E9]/70 font-['Inter'] font-medium">Metric</label>
                    <div className="relative">
                      <button
                        onClick={() => setComparisonMetricDropdownOpen(!comparisonMetricDropdownOpen)}
                        className="w-full px-3 py-2 rounded-lg font-['Inter'] text-sm bg-[#272121]/50 border border-[#E16428]/30 text-[#F6E9E9] focus:outline-none focus:border-[#E16428] transition-all duration-200 flex items-center justify-between"
                      >
                        <span className="truncate">
                          {COMPARISON_METRICS.find((m) => m.id === comparisonMetric)?.shortLabel ?? 'Revenue'}
                        </span>
                        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${comparisonMetricDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {comparisonMetricDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setComparisonMetricDropdownOpen(false)} />
                          <div className="absolute z-20 mt-1 w-full bg-[#272121] border border-[#E16428]/30 rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                            {COMPARISON_METRICS.map((m) => (
                              <button
                                key={m.id}
                                onClick={() => {
                                  setComparisonMetric(m.id);
                                  setComparisonMetricDropdownOpen(false);
                                }}
                                className={`w-full px-3 py-2 text-left text-sm font-['Inter'] transition-colors ${
                                  comparisonMetric === m.id
                                    ? 'bg-[#E16428]/20 text-[#E16428]'
                                    : 'text-[#F6E9E9] hover:bg-[#E16428]/15'
                                }`}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
                <div className={`flex flex-col gap-2 relative ${comparisonViewMode === 'chart' ? 'w-1/2' : 'w-full'}`}>
                  <label className="text-xs text-[#F6E9E9]/70 font-['Inter'] font-medium">View</label>
                  <div className="relative">
                    <button
                      onClick={() => setComparisonViewDropdownOpen(!comparisonViewDropdownOpen)}
                      className="w-full px-3 py-2 rounded-lg font-['Inter'] text-sm bg-[#272121]/50 border border-[#E16428]/30 text-[#F6E9E9] focus:outline-none focus:border-[#E16428] transition-all duration-200 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        {comparisonViewMode === 'chart' ? <BarChart className="w-4 h-4" /> : <TableIcon className="w-4 h-4" />}
                        <span>{comparisonViewMode === 'chart' ? 'Chart' : 'Table'}</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${comparisonViewDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {comparisonViewDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setComparisonViewDropdownOpen(false)} />
                        <div className="absolute z-20 mt-1 w-full bg-[#272121] border border-[#E16428]/30 rounded-lg shadow-lg overflow-hidden">
                          <button
                            onClick={() => {
                              setComparisonViewMode('chart');
                              setComparisonViewDropdownOpen(false);
                            }}
                            className="w-full px-4 py-2 text-left flex items-center gap-2 text-[#F6E9E9] hover:bg-[#E16428]/20 transition-colors"
                          >
                            <BarChart className="w-4 h-4" />
                            <span>Chart</span>
                          </button>
                          <button
                            onClick={() => {
                              setComparisonViewMode('table');
                              setComparisonViewDropdownOpen(false);
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
            </div>

            {/* Desktop Chart / Table toggle */}
            <div className="hidden sm:flex sm:flex-row gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-[#F6E9E9]/70 font-['Inter'] font-medium">View</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setComparisonViewMode('chart')}
                    className={`px-1 pb-2 border-0 border-b-2 rounded-none bg-transparent font-['Inter'] text-sm transition-colors duration-200 flex items-center gap-2 ${
                      comparisonViewMode === 'chart'
                        ? 'border-[#E16428] text-[#E16428]'
                        : 'border-transparent text-[#F6E9E9]/55 hover:text-[#E16428]/80 hover:border-[#E16428]/40'
                    }`}
                  >
                    <BarChart className="w-4 h-4" />
                    <span>Chart</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setComparisonViewMode('table')}
                    className={`px-1 pb-2 border-0 border-b-2 rounded-none bg-transparent font-['Inter'] text-sm transition-colors duration-200 flex items-center gap-2 ${
                      comparisonViewMode === 'table'
                        ? 'border-[#E16428] text-[#E16428]'
                        : 'border-transparent text-[#F6E9E9]/55 hover:text-[#E16428]/80 hover:border-[#E16428]/40'
                    }`}
                  >
                    <TableIcon className="w-4 h-4" />
                    <span>Table</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop metric toggles (chart only) */}
          {comparisonViewMode === 'chart' && (
            <div className="hidden sm:flex sm:flex-col gap-2 mb-4">
              <label className="text-xs text-[#F6E9E9]/70 font-['Inter'] font-medium">Metric</label>
              <div className="flex flex-wrap gap-3">
                {COMPARISON_METRICS.map((m) => {
                  const active = comparisonMetric === m.id;
                  const Icon =
                    m.id === 'revenue' ? DollarSign
                    : m.id === 'profit' ? TrendingUp
                    : m.id === 'profitMargin' ? Percent
                    : m.id === 'employeePayments' ? Users
                    : m.id === 'expenses' ? Receipt
                    : Users;
                  const activeClass =
                    m.id === 'revenue' ? 'border-[#E16428] text-[#E16428]'
                    : m.id === 'profit' ? 'border-emerald-500 text-emerald-400'
                    : m.id === 'profitMargin' ? 'border-violet-500 text-violet-400'
                    : m.id === 'employeePayments' ? 'border-blue-500 text-blue-400'
                    : m.id === 'expenses' ? 'border-pink-500 text-pink-400'
                    : 'border-amber-500 text-amber-400';
                  const idleHover =
                    m.id === 'revenue' ? 'hover:text-[#E16428]/80 hover:border-[#E16428]/40'
                    : m.id === 'profit' ? 'hover:text-emerald-400/80 hover:border-emerald-500/40'
                    : m.id === 'profitMargin' ? 'hover:text-violet-400/80 hover:border-violet-500/40'
                    : m.id === 'employeePayments' ? 'hover:text-blue-400/80 hover:border-blue-500/40'
                    : m.id === 'expenses' ? 'hover:text-pink-400/80 hover:border-pink-500/40'
                    : 'hover:text-amber-400/80 hover:border-amber-500/40';
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setComparisonMetric(m.id)}
                      className={`px-1 pb-2 border-0 border-b-2 rounded-none bg-transparent font-['Inter'] text-sm transition-colors duration-200 flex items-center gap-2 ${
                        active
                          ? activeClass
                          : `border-transparent text-[#F6E9E9]/55 ${idleHover}`
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {comparisonViewMode === 'chart' ? (
          analyticsComparison.length > 0 ? (
            <div className="space-y-4">
              {comparisonChartSummary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      label: 'Latest',
                      value: comparisonChartSummary.latest.value,
                      sub: comparisonChartSummary.latest.label,
                    },
                    {
                      label: 'Average',
                      value: comparisonChartSummary.avg,
                      sub: 'All months',
                    },
                    {
                      label: comparisonChartSummary.metric.inverted ? 'Best (lowest)' : 'Best',
                      value: comparisonChartSummary.best.value,
                      sub: comparisonChartSummary.best.label,
                    },
                    {
                      label: comparisonChartSummary.metric.inverted ? 'Worst (highest)' : 'Worst',
                      value: comparisonChartSummary.worst.value,
                      sub: comparisonChartSummary.worst.label,
                    },
                  ].map((stat) => {
                    const inverted = comparisonChartSummary.metric.inverted;
                    const isGood = inverted ? stat.value <= 0 : stat.value >= 0;
                    const sign = stat.value >= 0 ? '+' : '';
                    return (
                      <div
                        key={stat.label}
                        className="rounded-lg border border-[#E16428]/15 bg-[#272121]/35 px-3 py-2.5"
                      >
                        <p className="text-[10px] uppercase tracking-wide text-[#F6E9E9]/45 font-['Inter'] mb-1">
                          {stat.label}
                        </p>
                        <p className={`text-base sm:text-lg font-semibold font-['Inter'] ${isGood ? 'text-emerald-400' : 'text-red-400'}`}>
                          {sign}{stat.value.toFixed(1)}%
                        </p>
                        <p className="text-xs text-[#F6E9E9]/45 font-['Inter'] mt-0.5">{stat.sub}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center gap-4 text-xs font-['Inter'] text-[#F6E9E9]/50">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-400" />
                  {COMPARISON_METRICS.find((m) => m.id === comparisonMetric)?.inverted
                    ? 'Decrease (good)'
                    : 'Increase (good)'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-400" />
                  {COMPARISON_METRICS.find((m) => m.id === comparisonMetric)?.inverted
                    ? 'Increase (bad)'
                    : 'Decrease (bad)'}
                </span>
                <span className="hidden sm:inline text-[#F6E9E9]/35">· Hover bars for details</span>
              </div>

              <div className="h-64 sm:h-80 w-full">
                <canvas ref={comparisonChartRef} className="w-full h-full"></canvas>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-[#F6E9E9]/50 text-sm font-['Inter']">
              {selectedYear !== 'all'
                ? `No comparison data for ${selectedYear}. Export a report for that year to record trends.`
                : 'No comparison data yet. Export a monthly report to record trends.'}
            </p>
          )
        ) : (
          <div className="overflow-x-auto">
            {analyticsComparison.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E16428]/20">
                    <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-2 text-xs sm:text-sm font-['Inter']">Month/Year</th>
                    <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-2 text-xs sm:text-sm font-['Inter']">Revenue</th>
                    <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-2 text-xs sm:text-sm font-['Inter']">Profit</th>
                    <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-2 text-xs sm:text-sm font-['Inter']">Profit Margin</th>
                    <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-2 text-xs sm:text-sm font-['Inter']">Emp. Payments</th>
                    <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-2 text-xs sm:text-sm font-['Inter']">Expenses</th>
                    <th className="text-left text-[#F6E9E9]/70 font-medium pb-2 sm:pb-3 px-2 text-xs sm:text-sm font-['Inter']">Unique Clients</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsComparison.map((record) => {
                    const monthName = new Date(record.year, record.month - 1).toLocaleDateString('en-US', {
                      month: 'short',
                      year: 'numeric',
                    });

                    const formatPercentage = (value: number | null) => {
                      if (value === null || value === undefined) return 'N/A';
                      const sign = value >= 0 ? '+' : '';
                      return `${sign}${value.toFixed(1)}%`;
                    };

                    const getPercentageColor = (value: number | null | undefined, isInverted: boolean = false) => {
                      if (value === null || value === undefined) return 'text-[#F6E9E9]/50';
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
                        <td className={`py-2 sm:py-3 px-2 font-bold font-['Inter'] ${getPercentageColor(record.expenses_change_percentage, true)}`}>
                          {formatPercentage(record.expenses_change_percentage)}
                        </td>
                        <td className={`py-2 sm:py-3 px-2 font-bold font-['Inter'] ${getPercentageColor(record.unique_clients_change_percentage)}`}>
                          {formatPercentage(record.unique_clients_change_percentage)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="py-8 text-center text-[#F6E9E9]/50 text-sm font-['Inter']">
                {selectedYear !== 'all'
                  ? `No comparison data for ${selectedYear}. Export a report for that year to record trends.`
                  : 'No comparison data yet. Export a monthly report to record trends.'}
              </p>
            )}
          </div>
        )}
      </GlassCard>

      {/* Tool / product spend for selected period */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2 px-0.5">
          <h2 className="text-lg sm:text-xl font-semibold text-[#F6E9E9] font-['Poppins']">
            Tool spend
            <span className="ml-2 text-sm font-normal text-[#F6E9E9]/45 font-['Inter']">
              · bought / subscribed · {toolSpendPeriodLabel}
            </span>
          </h2>
          {toolSpendCards.length > 0 && (
            <span className="text-[10px] uppercase tracking-[0.12em] text-[#F6E9E9]/30 font-['Inter']">
              {toolSpendCards.length} tools
            </span>
          )}
        </div>

        {toolSpendCards.length > 0 && (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-0.5 text-sm font-['Inter'] text-[#F6E9E9]/55">
            <span>
              <span className="text-[#F6E9E9]/35">Total </span>
              <span className="font-semibold text-[#F6E9E9] tabular-nums font-['Poppins']">
                LKR {toolSpendTotals.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </span>
            <span className="text-[#F6E9E9]/25">·</span>
            <span className="tabular-nums">
              {toolSpendTotals.accounts} account{toolSpendTotals.accounts === 1 ? '' : 's'}
            </span>
            <span className="text-[#F6E9E9]/25">·</span>
            <span className="tabular-nums">
              {toolSpendTotals.buys} buy{toolSpendTotals.buys === 1 ? '' : 's'}
            </span>
          </div>
        )}

        {toolSpendCards.length === 0 ? (
          <p className="text-sm text-[#F6E9E9]/45 font-['Inter'] py-2">
            No buys or new subscriptions for this period.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {toolSpendCards.map(card => {
              const hasPrev = toolSpendHasMom && card.prevSpend > 0;
              const isNew = toolSpendHasMom && card.spend > 0 && card.prevSpend === 0;
              const isUp = (card.spendChangePct ?? 0) > 0;
              const isDown = (card.spendChangePct ?? 0) < 0;
              const trendColor = !toolSpendHasMom
                ? 'text-transparent'
                : isNew
                  ? 'text-[#F6E9E9]/50'
                  : !hasPrev
                    ? 'text-[#F6E9E9]/40'
                    : isDown
                      ? 'text-emerald-400'
                      : isUp
                        ? 'text-red-400'
                        : 'text-[#F6E9E9]/45';
              const trendLabel = !toolSpendHasMom
                ? ''
                : isNew
                  ? 'New'
                  : card.spendChangePct === null
                    ? '—'
                    : `${card.spendChangePct >= 0 ? '+' : ''}${card.spendChangePct.toFixed(1)}%`;
              const accountDelta = card.accountCount - card.prevAccountCount;

              return (
                <div
                  key={card.key}
                  className="rounded-xl bg-[#272121]/40 backdrop-blur-md px-3.5 py-3 flex gap-3 min-w-0"
                >
                  <div className="w-11 h-11 rounded-lg bg-white border border-[#E16428]/15 overflow-hidden flex items-center justify-center shrink-0">
                    {card.imageUrl ? (
                      <img
                        src={card.imageUrl}
                        alt=""
                        className="w-full h-full object-contain p-0.5"
                      />
                    ) : (
                      <Wallet className="w-5 h-5 text-[#E16428]/70" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#F6E9E9] font-['Inter'] truncate">
                          {card.name}
                        </p>
                        <p className="text-[11px] text-[#E16428]/80 font-['Inter'] truncate">
                          {card.category}
                        </p>
                      </div>
                      {toolSpendHasMom && (
                        <span
                          className={`shrink-0 text-[11px] font-semibold font-['Inter'] tabular-nums ${trendColor}`}
                          title="vs previous month"
                        >
                          {trendLabel}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-2">
                      <div>
                        <p className="text-base font-semibold text-[#F6E9E9] font-['Poppins'] tabular-nums leading-none">
                          LKR {card.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                        <p className="mt-1 text-[11px] text-[#F6E9E9]/45 font-['Inter']">
                          {card.accountCount} account{card.accountCount === 1 ? '' : 's'}
                          {card.buyCount > 0 ? (
                            <span className="text-[#F6E9E9]/30">
                              {' '}
                              · {card.buyCount} buy{card.buyCount === 1 ? '' : 's'}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      {toolSpendHasMom && (
                        <div className="text-right shrink-0">
                          <p className="text-[10px] uppercase tracking-wide text-[#F6E9E9]/30 font-['Inter']">
                            vs prev
                          </p>
                          <p className="text-[11px] text-[#F6E9E9]/45 font-['Inter'] tabular-nums">
                            {hasPrev
                              ? `LKR ${card.prevSpend.toLocaleString(undefined, {
                                  maximumFractionDigits: 0,
                                })}`
                              : '—'}
                          </p>
                          {hasPrev && (
                            <p
                              className={`text-[10px] font-['Inter'] tabular-nums ${
                                accountDelta > 0
                                  ? 'text-amber-300'
                                  : accountDelta < 0
                                    ? 'text-emerald-400'
                                    : 'text-[#F6E9E9]/35'
                              }`}
                            >
                              {accountDelta > 0 ? '+' : ''}
                              {accountDelta} acct
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Centered floating actions — pill bar like reference */}
      {ReactDOM.createPortal(
        <div className="fixed bottom-5 sm:bottom-7 inset-x-0 z-40 flex justify-center pointer-events-none px-3">
          <div className="pointer-events-auto flex items-center rounded-full bg-[#272121]/95 backdrop-blur-md border border-[#E16428]/25 shadow-xl shadow-black/40 pl-3.5 pr-1.5 py-1 gap-0.5 animate-fadeIn">
            <button
              type="button"
              onClick={() => setShowReport(true)}
              className="px-2.5 sm:px-3 py-1.5 text-[#F6E9E9] text-sm font-['Poppins'] font-semibold hover:text-[#E16428] active:scale-95 transition-all"
              title="Generate Report"
            >
              Report
            </button>
            <span className="w-px h-4 bg-[#F6E9E9]/15 shrink-0" aria-hidden />
            <button
              type="button"
              onClick={handleExportClick}
              disabled={filteredProjects.length === 0 && toolSpendCards.length === 0}
              className="px-2.5 sm:px-3 py-1.5 text-[#F6E9E9] text-sm font-['Poppins'] font-semibold hover:text-[#E16428] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[#F6E9E9]"
              title={
                filteredProjects.length === 0 && toolSpendCards.length === 0
                  ? 'No data to export'
                  : 'Export Excel'
              }
            >
              Excel
            </button>
            <div className="ml-1.5 shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E16428] border-2 border-[#E16428]/80 flex items-center justify-center shadow-md">
              <Download className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
          </div>
        </div>,
        document.body
      )}

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
      {showLoginModal && ReactDOM.createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
          onClick={closeLoginModal}
        >
          <div
            className="w-full max-w-sm p-6 animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
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
                  {pinEnabled ? 'Verify PIN' : 'Admin Authentication'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeLoginModal}
                className="p-1 text-[#F6E9E9]/60 hover:text-[#F6E9E9] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[#F6E9E9]/70 text-sm mb-4 font-['Inter']">
              {pinEnabled
                ? 'Enter your OGO PIN to export data.'
                : 'Enter admin password to export data.'}
            </p>

            {pinEnabled ? (
              <div className="space-y-4">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={getSessionEmail() ? getStoredPinLength(getSessionEmail()!) : 4}
                  value={pinInput}
                  onChange={(e) => onPinChange(e.target.value)}
                  disabled={isAuthenticating}
                  placeholder="OGO PIN"
                  autoFocus
                  className="underline-field w-full px-1 py-3 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] placeholder-[#F6E9E9]/40 focus:outline-none focus:border-[#E16428] focus:ring-0 focus:shadow-none transition-all duration-300 font-['Inter'] tracking-[0.35em] text-center text-lg"
                />
                {loginError && (
                  <p className="text-red-400 text-sm text-center font-['Inter']">{loginError}</p>
                )}
              </div>
            ) : (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => {
                      setAdminPassword(e.target.value);
                      setLoginError('');
                    }}
                    className="underline-field w-full px-1 py-3 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] placeholder-[#F6E9E9]/40 focus:outline-none focus:border-[#E16428] focus:ring-0 focus:shadow-none transition-all duration-300 font-['Inter']"
                    placeholder="Enter admin password"
                    autoFocus
                  />
                  {loginError && (
                    <p className="mt-2 text-red-400 text-sm font-['Inter']">{loginError}</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeLoginModal}
                    className="flex-1 px-4 py-2.5 bg-transparent border border-[#E16428]/25 text-[#F6E9E9]/80 rounded-lg hover:border-[#E16428]/45 hover:bg-[#E16428]/8 transition-all duration-200 font-['Inter'] text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAuthenticating}
                    className="flex-1 px-4 py-2.5 bg-[#E16428] text-white rounded-lg hover:bg-[#d4551f] transition-colors font-['Inter'] text-sm font-semibold disabled:opacity-50"
                  >
                    {isAuthenticating ? '…' : 'Export Data'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
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
