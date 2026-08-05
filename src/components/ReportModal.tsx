import React, { useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { KeyRound, Lock, X } from 'lucide-react';
import jsPDF from 'jspdf';
import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, PieController, LineElement, PointElement, LineController, Filler } from 'chart.js';
import { Project, Employee } from '../types';
import { supabase } from '../supabaseClient';
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
  buildToolSpendForPeriod,
  expenseBoughtOrSubscribedInMonth,
  mapExpenseRowFromDB,
  periodExpenseTotal,
} from '../utils/expenseToolSpend';

Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, PieController, LineElement, PointElement, LineController, Filler);

import type {} from 'chart.js';

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  employees: Employee[];
  month: number | 'all';
  year: number | 'all';
  monthlyChartData?: Record<number, {
    revenue: number;
    profit: number;
    employeePayments: number;
    projectCount: number;
    completedCount: number;
    uniqueClients: number;
  }>;
  chartYear?: number | 'all';
  chartPeriod?: 'yearly' | 'monthly' | 'daily';
  dailyChartData?: Record<number, {
    revenue: number;
    profit: number;
    employeePayments: number;
    projectCount: number;
    uniqueClients: number;
  }> | null;
}

interface MonthlyData {
  month: string;
  revenue: number;
  projects: number;
  completed: number;
  employeePayments: number;
  profit: number;
}

export const ReportModal: React.FC<ReportModalProps> = ({ open, onClose, projects, employees, month, year, monthlyChartData, chartPeriod = 'daily', dailyChartData }) => {
  const now = new Date();
  const monthName = month === 'all' ? 'All Months' : new Date(0, month as number).toLocaleString('default', { month: 'long' });
  const yearName = year === 'all' ? 'All Years' : year;
  
  // Chart refs for PDF export
  const revenueChartRef = useRef<HTMLCanvasElement>(null);
  const profitChartRef = useRef<HTMLCanvasElement>(null);
  const employeePaymentsChartRef = useRef<HTMLCanvasElement>(null);
  const projectTrendsChartRef = useRef<HTMLCanvasElement>(null);
  const uniqueClientsChartRef = useRef<HTMLCanvasElement>(null);
  const chartInstancesRef = useRef<{ revenue?: Chart; profit?: Chart; employeePayments?: Chart; projectTrends?: Chart; uniqueClients?: Chart }>({});

  // Authentication / generation state
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const [adminPassword, setAdminPassword] = React.useState('');
  const [authError, setAuthError] = React.useState('');
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);
  const [pinEnabled, setPinEnabled] = React.useState(false);
  const [pinInput, setPinInput] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [periodExpenses, setPeriodExpenses] = React.useState(0);
  const [toolSpendCards, setToolSpendCards] = React.useState<ToolSpendCard[]>([]);
  const authStartedRef = useRef(false);

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

  const closeAuthModal = (cancel = true) => {
    setShowAuthModal(false);
    setAdminPassword('');
    setPinInput('');
    setAuthError('');
    if (cancel && !isGenerating) {
      authStartedRef.current = false;
      onClose();
    }
  };

  // ESC key handler to close modals
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isGenerating) return;
        if (showAuthModal) {
          closeAuthModal(true);
        } else if (open) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAuthModal, open, onClose, isGenerating]);

  // Load expenses for selected period (cover logic matches Analytics)
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select(
            'id, name, account, amount, type, status, category, expense_date, next_renewal_date, start_date, created_at, product_id, image_url'
          );
        if (error || !data || cancelled) {
          if (!cancelled) {
            setPeriodExpenses(0);
            setToolSpendCards([]);
          }
          return;
        }
        const rows: ExpenseSpendRow[] = data.map(mapExpenseRowFromDB);
        if (!cancelled) {
          setPeriodExpenses(periodExpenseTotal(rows, month, year));
          setToolSpendCards(buildToolSpendForPeriod(rows, month, year));
        }
      } catch {
        if (!cancelled) {
          setPeriodExpenses(0);
          setToolSpendCards([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, month, year]);

  // Auto-start auth when report is requested (no preview)
  React.useEffect(() => {
    if (!open) {
      authStartedRef.current = false;
      setIsGenerating(false);
      return;
    }
    if (authStartedRef.current) return;
    authStartedRef.current = true;
    void (async () => {
      setShowAuthModal(true);
      setAdminPassword('');
      setPinInput('');
      setAuthError('');
      const email = getSessionEmail();
      if (email) {
        const prefs = await loadAdminSecurity(email);
        setPinEnabled(prefs.pinEnabled);
      } else {
        setPinEnabled(false);
      }
    })();
  }, [open]);

  // Enhanced analytics calculations (due = cost; paid/pending for payment status)
  const totalRevenue = projects.reduce((sum, p) => sum + p.price, 0);
  const totalEmployeePayments = projects.reduce((sum, p) => sum + getProjectEmployeePaymentsDue(p), 0);
  const totalPaidEmployeePayments = projects.reduce((sum, p) => sum + getProjectEmployeePaymentsPaid(p), 0);
  const totalPendingEmployeePayments = projects.reduce((sum, p) => sum + getProjectEmployeePaymentsPending(p), 0);
  const profit = totalRevenue - totalEmployeePayments - periodExpenses;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
  const totalProjects = projects.length;
  const completedProjects = projects.filter(p => p.status === 'Delivered').length;
  const completionRate = totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0;
  const averageProjectValue = totalProjects > 0 ? totalRevenue / totalProjects : 0;

  // Monthly performance data with enhanced calculations
  const monthlyData: MonthlyData[] = React.useMemo(() => {
    const months: Record<string, MonthlyData> = {};
    
    projects.forEach(project => {
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
          profit: 0,
        };
      }
      
      const empDue = getProjectEmployeePaymentsDue(project);
      months[monthKey].revenue += project.price;
      months[monthKey].projects += 1;
      months[monthKey].employeePayments += empDue;
      months[monthKey].profit += (project.price - empDue);
      
      if (project.status === 'Delivered') {
        months[monthKey].completed += 1;
      }
    });
    
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  }, [projects]);

  // Calculate trend data for charts
  const revenueTrend = monthlyData.map(m => ({
    month: new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    revenue: m.revenue,
    profit: m.profit,
    projects: m.projects,
    completed: m.completed
  }));

  // Enhanced employee performance analysis
  const employeeStats = employees.map(emp => {
    const empProjects = projects.filter(p => {
      if (!p.assignedTo) return false;
      return p.assignedTo.split(',').map(id => id.trim()).includes(emp.id);
    });
    let totalEarnings = 0;
    let paidEarnings = 0;
    let pendingEarnings = 0;
    empProjects.forEach(p => {
      const breakdown = getEmployeeProjectPaymentBreakdown(p, emp.id);
      totalEarnings += breakdown.due;
      paidEarnings += breakdown.paid;
      pendingEarnings += breakdown.remaining;
    });
    const revenue = empProjects.reduce((sum, p) => sum + p.price, 0);
    const profit = empProjects.reduce((sum, p) => sum + (p.price - getProjectEmployeePaymentsDue(p)), 0);
    const completed = empProjects.filter(p => p.status === 'Delivered').length;
    return {
      ...emp,
      totalEarnings,
      paidEarnings,
      pendingEarnings,
      revenue,
      profit,
      displayValue: totalEarnings,
      projectCount: empProjects.length,
      completedProjects: completed,
      completionRate: empProjects.length > 0 ? (completed / empProjects.length) * 100 : 0,
    };
  });
  const bestEmployee = employeeStats.sort((a, b) => b.displayValue - a.displayValue)[0];

  // Enhanced client/organization analysis
  const orgStats: Record<string, { count: number; revenue: number; avgValue: number }> = {};
  projects.forEach(p => {
    if (!orgStats[p.clientUniOrg]) {
      orgStats[p.clientUniOrg] = { count: 0, revenue: 0, avgValue: 0 };
    }
    orgStats[p.clientUniOrg].count++;
    orgStats[p.clientUniOrg].revenue += p.price;
    orgStats[p.clientUniOrg].avgValue = orgStats[p.clientUniOrg].revenue / orgStats[p.clientUniOrg].count;
  });
  const bestOrg = Object.entries(orgStats).sort((a, b) => b[1].revenue - a[1].revenue)[0];

  // Prepare top clients array (sorted by revenue desc, take top 5)
  const topClients = Object.entries(orgStats)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([name, stats]) => ({
      name,
      revenue: stats.revenue,
      projectCount: stats.count,
      averageValue: stats.avgValue,
    }));

  // Helper: persist export summary to database
  const saveExportSummary = async () => {
    try {
      // Determine numeric year/month for the export record
      let exportYear: number;
      let exportMonth: number;

      if (year !== 'all') {
        exportYear = year as number;
      } else {
        exportYear = now.getFullYear();
      }

      if (month !== 'all') {
        exportMonth = (month as number) + 1; // UI month is 0-based, DB is 1-12
      } else {
        // When 'all' months selected, use 0 as a special value meaning 'all months'
        exportMonth = 0;
      }

      const { error } = await supabase.from('export_reports').upsert(
        {
          year: exportYear,
          month: exportMonth,
          total_revenue: totalRevenue,
          total_profit: profit,
          completion_rate: completionRate,
          employee_payments: totalEmployeePayments,
          top_clients: topClients,
        },
        {
          onConflict: 'year,month',
        }
      );

      if (error) {
        console.error('Failed to save export summary:', error);
      }
    } catch (err) {
      console.error('Unexpected error while saving export summary:', err);
    }
  };

  // Helper: compute KPI values for a given month (1-12) and year from DB
  const computeMonthlyKpis = async (targetYear: number, targetMonth: number) => {
    try {
      const startDate = new Date(targetYear, targetMonth - 1, 1);
      const endDate = new Date(targetYear, targetMonth, 1);

      const { data, error } = await supabase
        .from('projects')
        .select('price, payment_of_emp, client_name, created_at')
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString());

      if (error || !data) {
        if (error) console.error('Failed to fetch monthly KPIs:', error);
        return {
          revenue: 0,
          profit: 0,
          employeePayments: 0,
          expenses: 0,
          uniqueClients: 0,
        };
      }

      let revenue = 0;
      let employeePayments = 0;
      const clients = new Set<string>();

      data.forEach((p: any) => {
        const price = typeof p.price === 'number' ? p.price : parseFloat(p.price || '0');
        const pay = typeof p.payment_of_emp === 'number' ? p.payment_of_emp : parseFloat(p.payment_of_emp || '0');
        revenue += isNaN(price) ? 0 : price;
        employeePayments += isNaN(pay) ? 0 : Math.abs(pay);
        if (p.client_name) {
          clients.add(p.client_name);
        }
      });

      // Business expenses bought/subscribed in this calendar month
      let expensesTotal = 0;
      const { data: expenseRows, error: expenseError } = await supabase
        .from('expenses')
        .select(
          'id, name, account, amount, type, status, category, expense_date, next_renewal_date, start_date, created_at, product_id, image_url'
        );

      if (!expenseError && expenseRows) {
        // targetMonth is 1-based from caller
        const m0 = targetMonth - 1;
        expenseRows.forEach((row: any) => {
          const mapped = mapExpenseRowFromDB(row);
          if (expenseBoughtOrSubscribedInMonth(mapped, m0, targetYear)) {
            expensesTotal += mapped.amount;
          }
        });
      }

      const profitValue = revenue - employeePayments - expensesTotal;

      return {
        revenue,
        profit: profitValue,
        employeePayments,
        expenses: expensesTotal,
        uniqueClients: clients.size,
      };
    } catch (err) {
      console.error('Unexpected error while computing monthly KPIs:', err);
      return {
        revenue: 0,
        profit: 0,
        employeePayments: 0,
        expenses: 0,
        uniqueClients: 0,
      };
    }
  };

  // Helper: persist KPI percentage changes to analytics_comparison table
  const saveAnalyticsComparison = async () => {
    try {
      // Only save when a specific month and year are selected
      if (month === 'all' || year === 'all') {
        return;
      }

      const exportYear = year as number;
      const exportMonth = (month as number) + 1; // UI month is 0-based

      // Determine previous month/year
      const prevDate = new Date(exportYear, exportMonth - 2, 1); // JS months are 0-based
      const prevYear = prevDate.getFullYear();
      const prevMonth = prevDate.getMonth() + 1;

      const currentKpis = await computeMonthlyKpis(exportYear, exportMonth);
      const prevKpis = await computeMonthlyKpis(prevYear, prevMonth);

      const calcChange = (current: number, prev: number) => {
        if (!prev || prev === 0) return null;
        return ((current - prev) / prev) * 100;
      };

      const revenueChange = calcChange(currentKpis.revenue, prevKpis.revenue);
      const profitChange = calcChange(currentKpis.profit, prevKpis.profit);
      const employeePaymentsChange = calcChange(currentKpis.employeePayments, prevKpis.employeePayments);
      const expensesChange = calcChange(currentKpis.expenses, prevKpis.expenses);
      const uniqueClientsChange = calcChange(currentKpis.uniqueClients, prevKpis.uniqueClients);

      const currentMargin = currentKpis.revenue > 0 ? (currentKpis.profit / currentKpis.revenue) * 100 : 0;
      const prevMargin = prevKpis.revenue > 0 ? (prevKpis.profit / prevKpis.revenue) * 100 : 0;
      const profitMarginChange =
        prevKpis.revenue > 0 ? ((currentMargin - prevMargin) / prevMargin) * 100 : null;

      const { error } = await supabase.from('analytics_comparison').upsert(
        {
          year: exportYear,
          month: exportMonth,
          revenue_change_percentage: revenueChange,
          profit_change_percentage: profitChange,
          profit_margin_change_percentage: profitMarginChange,
          employee_payments_change_percentage: employeePaymentsChange,
          expenses_change_percentage: expensesChange,
          unique_clients_change_percentage: uniqueClientsChange,
        },
        {
          onConflict: 'year,month',
        }
      );

      if (error) {
        console.error('Failed to save analytics comparison:', error);
      }
    } catch (err) {
      console.error('Unexpected error while saving analytics comparison:', err);
    }
  };

  // Authentication function
  const authenticateAdmin = async (password: string) => {
    try {
      setIsAuthenticating(true);
      setAuthError('');
      
      const { data, error } = await supabase
        .from('admin')
        .select('id, email, password')
        .eq('password', password)
        .single();
      
      if (error || !data) {
        // Log failed authentication attempt
        await logAction(null, 'Unknown', 'export_auth_fail');
        setAuthError('Invalid password. Please try again.');
        return false;
      }
      
      // Log successful authentication
      await logAction(data.id, data.email, 'export_auth_success');
      
      return true;
    } catch (error) {
      console.error('Authentication error:', error);
      // Log authentication error
      await logAction(null, 'Unknown', 'export_auth_error');
      setAuthError('Authentication failed. Please try again.');
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

  // Handle authentication submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adminPassword.trim()) {
      setAuthError('Please enter a password.');
      return;
    }
    
    const isAuthenticated = await authenticateAdmin(adminPassword);
    
    if (isAuthenticated) {
      setShowAuthModal(false);
      setAdminPassword('');
      setPinInput('');
      setAuthError('');
      void handleExport();
    }
  };

  const handlePinAuth = async (pinValue?: string) => {
    const value = (pinValue ?? pinInput).replace(/\D/g, '');
    const email = getSessionEmail();
    if (!email) {
      setAuthError('Unable to verify user');
      return;
    }
    const len = getStoredPinLength(email);
    if (value.length < len) return;

    setIsAuthenticating(true);
    setAuthError('');
    try {
      const res = await authenticateWithPin(email, value);
      if (!res.ok) {
        await logAction(null, email, 'export_auth_fail');
        setAuthError('PIN incorrect');
        setPinInput('');
        return;
      }
      const { data: admin } = await supabase
        .from('admin')
        .select('id, email')
        .ilike('email', email)
        .maybeSingle();
      if (admin) {
        await logAction(admin.id, admin.email, 'export_auth_success');
      }
      setShowAuthModal(false);
      setAdminPassword('');
      setPinInput('');
      setAuthError('');
      void handleExport();
    } catch {
      await logAction(null, 'Unknown', 'export_auth_error');
      setAuthError('Authentication failed. Please try again.');
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
    setAuthError('');
    if (digits.length === len) {
      void handlePinAuth(digits);
    }
  };

  // Direct well-formatted PDF export for selected period
  const handleExport = async () => {
    setIsGenerating(true);
    try {
      // Allow hidden chart canvases to finish rendering
      await new Promise((resolve) => setTimeout(resolve, 700));

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 16;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      const ORANGE: [number, number, number] = [225, 100, 40];
      const DARK: [number, number, number] = [39, 33, 33];
      const MUTED: [number, number, number] = [100, 100, 100];
      const LINE: [number, number, number] = [220, 220, 220];

      const fmtLkr = (n: number) =>
        `LKR ${Math.round(n).toLocaleString('en-US')}`;
      const fmtPct = (n: number) => `${n.toFixed(1)}%`;

      const ensureSpace = (needed: number) => {
        if (y + needed > pageHeight - 22) {
          pdf.addPage();
          y = margin;
        }
      };

      const drawFooterOnAllPages = () => {
        const pageCount =
          typeof pdf.getNumberOfPages === 'function'
            ? pdf.getNumberOfPages()
            : pdf.internal.pages
              ? pdf.internal.pages.length
              : 1;
        for (let i = 1; i <= pageCount; i++) {
          pdf.setPage(i);
          pdf.setDrawColor(...LINE);
          pdf.setLineWidth(0.3);
          pdf.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7.5);
          pdf.setTextColor(...MUTED);
          pdf.text('OGO Technology · Confidential Internal Report', margin, pageHeight - 8);
          pdf.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
        }
      };

      const sectionTitle = (title: string) => {
        ensureSpace(22);
        // Consistent gap above every section (skip on fresh page top)
        if (y > margin + 1) y += 6;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(...DARK);
        pdf.text(title.toUpperCase(), margin, y);
        y += 2.5;
        pdf.setDrawColor(...ORANGE);
        pdf.setLineWidth(0.9);
        pdf.line(margin, y, margin + 32, y);
        y += 8;
      };

      const drawTable = (
        headers: string[],
        rows: string[][],
        colWidths: number[],
        opts?: { emphasizeLast?: boolean }
      ) => {
        const rowH = 7.2;
        const headerH = 8;
        ensureSpace(headerH + rowH * Math.min(rows.length, 3) + 6);

        // Header
        pdf.setFillColor(...ORANGE);
        pdf.rect(margin, y, contentWidth, headerH, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(255, 255, 255);
        let x = margin + 2.5;
        headers.forEach((h, i) => {
          pdf.text(h, x, y + 5.3);
          x += colWidths[i];
        });
        y += headerH;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        rows.forEach((row, rowIndex) => {
          ensureSpace(rowH + 2);
          if (rowIndex % 2 === 0) {
            pdf.setFillColor(248, 246, 245);
            pdf.rect(margin, y, contentWidth, rowH, 'F');
          }
          x = margin + 2.5;
          row.forEach((cell, i) => {
            const isLast = opts?.emphasizeLast && i === row.length - 1;
            pdf.setFont('helvetica', isLast ? 'bold' : 'normal');
            pdf.setTextColor(...DARK);
            const maxW = colWidths[i] - 3;
            const text = pdf.splitTextToSize(String(cell), maxW)[0] || '';
            pdf.text(text, x, y + 5);
            x += colWidths[i];
          });
          y += rowH;
        });
        y += 3;
      };

      // ── Header ──────────────────────────────────────────────
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.src = '/logo_ogo.png';
        await new Promise<void>((resolve, reject) => {
          logoImg.onload = () => resolve();
          logoImg.onerror = () => reject(new Error('logo'));
          setTimeout(() => resolve(), 1500);
        });
        // White background + replace baked-in black bg with white
        const logoCanvas = document.createElement('canvas');
        logoCanvas.width = 128;
        logoCanvas.height = 128;
        const logoCtx = logoCanvas.getContext('2d');
        if (logoCtx && logoImg.complete && logoImg.naturalWidth > 0) {
          logoCtx.fillStyle = '#ffffff';
          logoCtx.fillRect(0, 0, 128, 128);
          logoCtx.drawImage(logoImg, 0, 0, 128, 128);
          const imageData = logoCtx.getImageData(0, 0, 128, 128);
          const pixels = imageData.data;
          for (let i = 0; i < pixels.length; i += 4) {
            // Near-black pixels → white (keeps orange OGO letters)
            if (pixels[i] < 45 && pixels[i + 1] < 45 && pixels[i + 2] < 45) {
              pixels[i] = 255;
              pixels[i + 1] = 255;
              pixels[i + 2] = 255;
              pixels[i + 3] = 255;
            }
          }
          logoCtx.putImageData(imageData, 0, 0);
          const logoJpeg = logoCanvas.toDataURL('image/jpeg', 0.9);
          pdf.addImage(logoJpeg, 'JPEG', margin, y, 14, 14, undefined, 'MEDIUM');
        }
      } catch {
        /* logo optional */
      }

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(...DARK);
      pdf.text('OGO TECHNOLOGY', margin + 18, y + 5);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...MUTED);
      pdf.text('Department of Academic Services · Galle, Sri Lanka', margin + 18, y + 10);
      pdf.text('+94 75 930 7059 · info@ogotechnology.com', margin + 18, y + 14);

      const periodLabel =
        month !== 'all' && year !== 'all'
          ? `${monthName} ${yearName}`
          : month === 'all' && year !== 'all'
            ? `Full Year ${yearName}`
            : 'All Time';

      pdf.setFillColor(...ORANGE);
      const badgeText = periodLabel;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      const badgeW = Math.max(28, pdf.getTextWidth(badgeText) + 8);
      pdf.roundedRect(pageWidth - margin - badgeW, y + 2, badgeW, 8, 2, 2, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.text(badgeText, pageWidth - margin - badgeW / 2, y + 7.2, { align: 'center' });

      y += 20;
      pdf.setDrawColor(...ORANGE);
      pdf.setLineWidth(1.2);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 8;

      // Title
      let reportTitle = 'Analytics Report';
      if (month !== 'all' && year !== 'all') {
        reportTitle = `Monthly Analytics Report`;
      } else if (month === 'all' && year !== 'all') {
        reportTitle = `Annual Analytics Report`;
      } else {
        reportTitle = 'Comprehensive Analytics Report';
      }

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(...DARK);
      pdf.text(reportTitle, pageWidth / 2, y, { align: 'center' });
      y += 6;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(...MUTED);
      const generatedDate = now.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const generatedTime = now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      pdf.text(
        `Period: ${periodLabel}   ·   Generated: ${generatedDate} at ${generatedTime}`,
        pageWidth / 2,
        y,
        { align: 'center' }
      );
      y += 8;

      // ── KPI cards ───────────────────────────────────────────
      sectionTitle('Executive Summary');

      const kpis: Array<{ label: string; value: string; sub: string; color: [number, number, number] }> = [
        { label: 'Total Revenue', value: fmtLkr(totalRevenue), sub: `Margin ${fmtPct(profitMargin)}`, color: ORANGE },
        { label: 'Total Profit', value: fmtLkr(profit), sub: `Avg project ${fmtLkr(averageProjectValue)}`, color: [16, 185, 129] },
        { label: 'Completion', value: fmtPct(completionRate), sub: `${completedProjects} / ${totalProjects} projects`, color: [139, 92, 246] },
        { label: 'Emp. Payments', value: fmtLkr(totalEmployeePayments), sub: `Paid ${fmtLkr(totalPaidEmployeePayments)}`, color: [59, 130, 246] },
        { label: 'Expenses', value: fmtLkr(periodExpenses), sub: 'Business spend', color: [244, 114, 182] },
        {
          label: 'Pending Pay',
          value: fmtLkr(totalPendingEmployeePayments),
          sub: 'Employee balance',
          color: [251, 191, 36],
        },
      ];

      const cardGap = 3.5;
      const cardW = (contentWidth - cardGap * 2) / 3;
      const cardH = 22;
      ensureSpace(cardH * 2 + cardGap + 8);

      kpis.forEach((kpi, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const cx = margin + col * (cardW + cardGap);
        const cy = y + row * (cardH + cardGap);

        pdf.setFillColor(250, 248, 247);
        pdf.setDrawColor(...LINE);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(cx, cy, cardW, cardH, 1.5, 1.5, 'FD');

        pdf.setFillColor(...kpi.color);
        pdf.rect(cx, cy, 1.5, cardH, 'F');

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(...MUTED);
        pdf.text(kpi.label.toUpperCase(), cx + 4, cy + 5.5);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(...DARK);
        pdf.text(kpi.value, cx + 4, cy + 12.5);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(...MUTED);
        pdf.text(kpi.sub, cx + 4, cy + 18);
      });

      y += cardH * 2 + cardGap + 6;

      // ── Summary table ───────────────────────────────────────
      sectionTitle('Key Metrics');
      drawTable(
        ['Metric', 'Value'],
        [
          ['Total Revenue', fmtLkr(totalRevenue)],
          ['Employee Payments (Due)', fmtLkr(totalEmployeePayments)],
          ['Business Expenses', fmtLkr(periodExpenses)],
          ['Net Profit', fmtLkr(profit)],
          ['Profit Margin', fmtPct(profitMargin)],
          ['Total Projects', String(totalProjects)],
          ['Completed Projects', String(completedProjects)],
          ['Completion Rate', fmtPct(completionRate)],
          ['Average Project Value', fmtLkr(averageProjectValue)],
          [
            'Best Employee',
            bestEmployee ? `${bestEmployee.firstName} ${bestEmployee.lastName}` : 'N/A',
          ],
          ['Top Client / Org', bestOrg ? bestOrg[0] : 'N/A'],
        ],
        [contentWidth * 0.55, contentWidth * 0.45],
        { emphasizeLast: true }
      );

      // ── Tool / product spend ────────────────────────────────
      if (toolSpendCards.length > 0) {
        const hasMom = month !== 'all' && year !== 'all';
        sectionTitle(hasMom ? 'Tool Spend (vs Previous Month)' : 'Tool Spend');
        const fmtMom = (card: ToolSpendCard) => {
          if (!hasMom) return '—';
          if (card.spendChangePct != null) {
            const sign = card.spendChangePct > 0 ? '+' : '';
            return `${sign}${card.spendChangePct.toFixed(1)}%`;
          }
          if (card.spend > 0 && card.prevSpend === 0) return 'New';
          if (card.spend === 0 && card.prevSpend > 0) return '-100%';
          return '—';
        };
        drawTable(
          hasMom
            ? ['Product', 'Category', 'Spend', 'Accts', 'Buys', 'Prev', 'MoM']
            : ['Product', 'Category', 'Spend', 'Accounts', 'Buys'],
          toolSpendCards.slice(0, 15).map((card) =>
            hasMom
              ? [
                  card.name,
                  card.category,
                  fmtLkr(card.spend),
                  String(card.accountCount),
                  String(card.buyCount),
                  fmtLkr(card.prevSpend),
                  fmtMom(card),
                ]
              : [
                  card.name,
                  card.category,
                  fmtLkr(card.spend),
                  String(card.accountCount),
                  String(card.buyCount),
                ]
          ),
          hasMom
            ? [
                contentWidth * 0.22,
                contentWidth * 0.14,
                contentWidth * 0.16,
                contentWidth * 0.1,
                contentWidth * 0.1,
                contentWidth * 0.14,
                contentWidth * 0.14,
              ]
            : [
                contentWidth * 0.3,
                contentWidth * 0.2,
                contentWidth * 0.22,
                contentWidth * 0.14,
                contentWidth * 0.14,
              ],
          { emphasizeLast: false }
        );
        const toolTotal = toolSpendCards.reduce((s, c) => s + c.spend, 0);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(...MUTED);
        ensureSpace(6);
        pdf.text(
          `Tool total: ${fmtLkr(toolTotal)} · ${toolSpendCards.length} product${toolSpendCards.length === 1 ? '' : 's'}${
            toolSpendCards.length > 15 ? ' (top 15 shown)' : ''
          }`,
          margin,
          y
        );
        y += 8;
      }
      if (revenueTrend.length > 0) {
        sectionTitle('Revenue Trend Analysis');
        drawTable(
          ['Month', 'Revenue', 'Profit', 'Projects', 'Completed'],
          revenueTrend.slice(-8).map((p) => [
            p.month,
            fmtLkr(p.revenue),
            fmtLkr(p.profit),
            String(p.projects),
            String(p.completed),
          ]),
          [
            contentWidth * 0.22,
            contentWidth * 0.24,
            contentWidth * 0.24,
            contentWidth * 0.15,
            contentWidth * 0.15,
          ]
        );
      }

      // ── Monthly performance (always starts on a new page) ───
      if (monthlyData.length > 0) {
        pdf.addPage();
        y = margin;
        sectionTitle('Monthly Performance');
        drawTable(
          ['Month', 'Projects', 'Done', 'Revenue', 'Profit', 'Avg Value'],
          monthlyData.map((m) => {
            const label = new Date(m.month + '-01').toLocaleDateString('en-US', {
              month: 'short',
              year: 'numeric',
            });
            return [
              label,
              String(m.projects),
              String(m.completed),
              fmtLkr(m.revenue),
              fmtLkr(m.profit),
              fmtLkr(m.projects > 0 ? m.revenue / m.projects : 0),
            ];
          }),
          [
            contentWidth * 0.16,
            contentWidth * 0.12,
            contentWidth * 0.1,
            contentWidth * 0.22,
            contentWidth * 0.22,
            contentWidth * 0.18,
          ]
        );
      }

      // ── Employee performance ────────────────────────────────
      if (employeeStats.length > 0) {
        sectionTitle('Employee Performance');
        const topEmps = [...employeeStats]
          .sort((a, b) => b.displayValue - a.displayValue)
          .slice(0, 10);
        drawTable(
          ['Employee', 'Projects', 'Done', 'Rate', 'Earnings'],
          topEmps.map((emp) => [
            `${emp.firstName} ${emp.lastName}`,
            String(emp.projectCount),
            String(emp.completedProjects),
            fmtPct(emp.completionRate),
            fmtLkr(emp.displayValue),
          ]),
          [
            contentWidth * 0.28,
            contentWidth * 0.14,
            contentWidth * 0.12,
            contentWidth * 0.14,
            contentWidth * 0.32,
          ],
          { emphasizeLast: true }
        );
      }

      // ── Client performance ──────────────────────────────────
      if (topClients.length > 0) {
        sectionTitle('Client Performance');
        drawTable(
          ['Client / Organization', 'Projects', 'Revenue', 'Avg Value'],
          topClients.map((c) => [
            c.name,
            String(c.projectCount),
            fmtLkr(c.revenue),
            fmtLkr(c.averageValue),
          ]),
          [
            contentWidth * 0.4,
            contentWidth * 0.15,
            contentWidth * 0.25,
            contentWidth * 0.2,
          ],
          { emphasizeLast: true }
        );
      }

      // ── Charts ──────────────────────────────────────────────
      if (monthlyChartData && Object.keys(monthlyChartData).length > 0 && chartInstancesRef.current.revenue) {
        await new Promise((resolve) => setTimeout(resolve, 400));

        let chartTitle = 'Trend Charts';
        if (chartPeriod === 'daily' && month !== 'all' && year !== 'all') {
          chartTitle = `Daily Trends — ${monthName} ${yearName}`;
        } else if (chartPeriod === 'monthly' && year !== 'all') {
          chartTitle = `Monthly Trends — ${yearName}`;
        } else {
          chartTitle = 'Annual Trends';
        }

        sectionTitle(chartTitle);

        // Sharp JPEG: same pixel size as canvas, high quality, no downscale
        const chartToJpeg = (chartInstance: Chart, quality = 0.84): string | null => {
          const src = chartInstance.canvas;
          if (!src) return null;
          const w = src.width;
          const h = src.height;
          const out = document.createElement('canvas');
          out.width = w;
          out.height = h;
          const ctx = out.getContext('2d');
          if (!ctx) return null;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(src, 0, 0, w, h);
          return out.toDataURL('image/jpeg', quality);
        };

        const addChart = (chartInstance: Chart | undefined, title: string) => {
          if (!chartInstance?.canvas) return;
          try {
            const chartDataUrl = chartToJpeg(chartInstance, 0.84);
            if (!chartDataUrl) return;
            const chartH = 54;
            ensureSpace(chartH + 16);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(9);
            pdf.setTextColor(...DARK);
            pdf.text(title, margin, y);
            y += 5;
            pdf.addImage(chartDataUrl, 'JPEG', margin, y, contentWidth, chartH, undefined, 'MEDIUM');
            y += chartH + 10;
          } catch (err) {
            console.error(`Error adding ${title} chart:`, err);
          }
        };

        addChart(chartInstancesRef.current.revenue, 'Revenue');
        addChart(chartInstancesRef.current.profit, 'Profit');
        addChart(chartInstancesRef.current.employeePayments, 'Employee Payments');
        addChart(chartInstancesRef.current.projectTrends, 'Project Count');
        addChart(chartInstancesRef.current.uniqueClients, 'Unique Clients');
      }

      // ── Insights ────────────────────────────────────────────
      sectionTitle('Key Insights');
      const insights = [
        `Revenue of ${fmtLkr(totalRevenue)} at ${fmtPct(profitMargin)} profit margin for ${periodLabel}.`,
        `Completion rate ${fmtPct(completionRate)} (${completedProjects} of ${totalProjects} projects delivered).`,
        `Net profit ${fmtLkr(profit)} after employee payments (${fmtLkr(totalEmployeePayments)}) and expenses (${fmtLkr(periodExpenses)}).`,
        toolSpendCards.length > 0
          ? `Tool spend: ${toolSpendCards.length} product${toolSpendCards.length === 1 ? '' : 's'} totaling ${fmtLkr(
              toolSpendCards.reduce((s, c) => s + c.spend, 0)
            )}; top is ${toolSpendCards[0].name} (${fmtLkr(toolSpendCards[0].spend)}).`
          : `No tool / product expenses recorded for ${periodLabel}.`,
        `Best employee: ${bestEmployee ? `${bestEmployee.firstName} ${bestEmployee.lastName}` : 'N/A'} (${fmtLkr(bestEmployee?.displayValue ?? 0)}).`,
        `Top client: ${bestOrg ? bestOrg[0] : 'N/A'} with ${bestOrg ? bestOrg[1].count : 0} projects (${fmtLkr(bestOrg ? bestOrg[1].revenue : 0)}).`,
        `Employee payment ratio: ${totalRevenue > 0 ? ((totalEmployeePayments / totalRevenue) * 100).toFixed(1) : '0'}% of revenue.`,
      ];

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      insights.forEach((line) => {
        ensureSpace(12);
        const wrapped = pdf.splitTextToSize(`•  ${line}`, contentWidth);
        pdf.setTextColor(...DARK);
        pdf.text(wrapped, margin, y);
        y += wrapped.length * 4.8 + 3.5;
      });

      drawFooterOnAllPages();

      let filename = 'OGO-Analytics-Report';
      if (month !== 'all' && year !== 'all') {
        filename = `OGO-Analytics-${monthName}-${yearName}`;
      } else if (month === 'all' && year !== 'all') {
        filename = `OGO-Analytics-${yearName}`;
      } else {
        filename = `OGO-Analytics-Comprehensive-${now.getFullYear()}`;
      }

      pdf.save(`${filename}.pdf`);

      await logAction(null, 'Admin', 'export_success');
      await saveExportSummary();
      await saveAnalyticsComparison();
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setIsGenerating(false);
      authStartedRef.current = false;
      onClose();
    }
  };

  // Render charts when modal opens and data is available
  useEffect(() => {
    if (!open || !monthlyChartData) return;

    // Determine which view to show based on chartPeriod
    const isDailyView = chartPeriod === 'daily' && dailyChartData && month !== 'all' && year !== 'all';
    const isMonthlyView = chartPeriod === 'monthly' && year !== 'all';
    
    let labels: string[] = [];
    let revenueData: number[] = [];
    let profitData: number[] = [];
    let employeePaymentsData: number[] = [];
    let projectTrendsData: number[] = [];
    let uniqueClientsData: number[] = [];

    if (isDailyView) {
      // Daily view - use day-wise data for selected month
      const yearNum = year as number;
      const monthIndex = month as number;
      const daysInMonth = new Date(yearNum, monthIndex + 1, 0).getDate();
      
      labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
      revenueData = Array.from({ length: daysInMonth }, (_, i) => dailyChartData![i + 1]?.revenue ?? 0);
      profitData = Array.from({ length: daysInMonth }, (_, i) => dailyChartData![i + 1]?.profit ?? 0);
      employeePaymentsData = Array.from({ length: daysInMonth }, (_, i) => dailyChartData![i + 1]?.employeePayments ?? 0);
      projectTrendsData = Array.from({ length: daysInMonth }, (_, i) => dailyChartData![i + 1]?.projectCount ?? 0);
      uniqueClientsData = Array.from({ length: daysInMonth }, (_, i) => dailyChartData![i + 1]?.uniqueClients ?? 0);
    } else if (isMonthlyView) {
      // Monthly view - use month-wise data for selected year
      labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      revenueData = Array.from({ length: 12 }, (_, i) => monthlyChartData[i]?.revenue ?? 0);
      profitData = Array.from({ length: 12 }, (_, i) => monthlyChartData[i]?.profit ?? 0);
      employeePaymentsData = Array.from({ length: 12 }, (_, i) => monthlyChartData[i]?.employeePayments ?? 0);
      projectTrendsData = Array.from({ length: 12 }, (_, i) => monthlyChartData[i]?.projectCount ?? 0);
      uniqueClientsData = Array.from({ length: 12 }, (_, i) => monthlyChartData[i]?.uniqueClients ?? 0);
    } else {
      // Yearly view - use year-wise data (all years)
      // Calculate yearly data from projects
      const yearlyData: Record<number, {
        revenue: number;
        profit: number;
        employeePayments: number;
        projectCount: number;
        uniqueClients: Set<string>;
      }> = {};

      projects.forEach(project => {
        if (!project.createdAt) return;
        const created = new Date(project.createdAt);
        const projectYear = created.getFullYear();

        if (!yearlyData[projectYear]) {
          yearlyData[projectYear] = {
            revenue: 0,
            profit: 0,
            employeePayments: 0,
            projectCount: 0,
            uniqueClients: new Set<string>(),
          };
        }

        yearlyData[projectYear].revenue += project.price;
        yearlyData[projectYear].employeePayments += getProjectEmployeePaymentsDue(project);
        yearlyData[projectYear].profit += (project.price - getProjectEmployeePaymentsDue(project));
        yearlyData[projectYear].projectCount += 1;
        const clientKey = `${project.clientName}|${project.clientUniOrg}`;
        yearlyData[projectYear].uniqueClients.add(clientKey);
      });

      // Calculate new unique clients per year (excluding previous years)
      const sortedYears = Object.keys(yearlyData).map(Number).sort((a, b) => a - b);
      const previousYearsClients = new Set<string>();
      const yearlyUniqueClients: Record<number, number> = {};
      
      sortedYears.forEach(year => {
        const currentYearClients = yearlyData[year].uniqueClients;
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
        
        yearlyUniqueClients[year] = newClientsCount;
      });

      labels = sortedYears.map(y => y.toString());
      revenueData = sortedYears.map(y => yearlyData[y]?.revenue ?? 0);
      profitData = sortedYears.map(y => yearlyData[y]?.profit ?? 0);
      employeePaymentsData = sortedYears.map(y => yearlyData[y]?.employeePayments ?? 0);
      projectTrendsData = sortedYears.map(y => yearlyData[y]?.projectCount ?? 0);
      uniqueClientsData = sortedYears.map(y => yearlyUniqueClients[y] ?? 0);
    }
    
    // Destroy existing charts
    Object.values(chartInstancesRef.current).forEach(chart => {
      if (chart) chart.destroy();
    });
    chartInstancesRef.current = {};

    // Helper: crisp charts for PDF (~150dpi on A4 width, still JPEG-compressed)
    const createChart = (
      canvasRef: React.RefObject<HTMLCanvasElement>,
      label: string,
      data: number[],
      color: string,
      backgroundColor: string,
      chartLabels: string[]
    ): Chart | null => {
      if (!canvasRef.current) return null;

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return null;

      return new Chart(ctx, {
        type: 'line',
        data: {
          labels: chartLabels,
          datasets: [{
            label: label,
            data: data,
            borderColor: color,
            backgroundColor: backgroundColor,
            borderWidth: 2.5,
            tension: 0.35,
            fill: true,
            pointRadius: 3.5,
            pointHoverRadius: 5,
            pointBackgroundColor: color,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
          }]
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          animation: false,
          devicePixelRatio: 1,
          layout: {
            padding: { top: 4, right: 10, bottom: 4, left: 4 },
          },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: '#1a1a1a',
                font: {
                  family: 'Helvetica',
                  size: 13,
                  weight: 'bold'
                },
                padding: 10,
                usePointStyle: true,
                boxWidth: 8,
              }
            },
            tooltip: {
              enabled: false,
            }
          },
          scales: {
            x: {
              ticks: {
                color: '#333333',
                font: {
                  family: 'Helvetica',
                  size: 11
                },
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 12,
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.08)',
                lineWidth: 1
              }
            },
            y: {
              ticks: {
                color: '#333333',
                font: {
                  family: 'Helvetica',
                  size: 11
                },
                maxTicksLimit: 6,
                callback: function(value) {
                  if (label === 'Project Count' || label === 'Unique Clients') {
                    return Number(value).toString();
                  }
                  const n = Number(value);
                  if (n >= 1000000) return 'LKR ' + (n / 1000000).toFixed(1) + 'M';
                  if (n >= 1000) return 'LKR ' + (n / 1000).toFixed(0) + 'K';
                  return 'LKR ' + n.toLocaleString();
                }
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.08)',
                lineWidth: 1
              },
              beginAtZero: true
            }
          }
        }
      });
    };

    // Create all 5 charts
    chartInstancesRef.current.revenue = createChart(
      revenueChartRef,
      'Revenue',
      revenueData,
      '#E16428',
      'rgba(225, 100, 40, 0.1)',
      labels
    ) || undefined;

    chartInstancesRef.current.profit = createChart(
      profitChartRef,
      'Profit',
      profitData,
      '#10b981',
      'rgba(16, 185, 129, 0.1)',
      labels
    ) || undefined;

    chartInstancesRef.current.employeePayments = createChart(
      employeePaymentsChartRef,
      'Employee Payments',
      employeePaymentsData,
      '#3b82f6',
      'rgba(59, 130, 246, 0.1)',
      labels
    ) || undefined;

    chartInstancesRef.current.projectTrends = createChart(
      projectTrendsChartRef,
      'Project Count',
      projectTrendsData,
      '#8b5cf6',
      'rgba(139, 92, 246, 0.1)',
      labels
    ) || undefined;

    chartInstancesRef.current.uniqueClients = createChart(
      uniqueClientsChartRef,
      'Unique Clients',
      uniqueClientsData,
      '#06b6d4',
      'rgba(6, 182, 212, 0.1)',
      labels
    ) || undefined;

    return () => {
      Object.values(chartInstancesRef.current).forEach(chart => {
        if (chart) chart.destroy();
      });
      chartInstancesRef.current = {};
    };
  }, [open, monthlyChartData, dailyChartData, chartPeriod, month, year, projects]);

  if (!open) return null;

  return (
    <>
      {/* Hidden chart canvases for PDF export */}
      <div
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          width: '1100px',
          height: '440px',
          pointerEvents: 'none',
          opacity: 0,
        }}
        aria-hidden
      >
        <canvas ref={revenueChartRef} width={1100} height={440} style={{ display: 'block' }} />
        <canvas ref={profitChartRef} width={1100} height={440} style={{ display: 'block' }} />
        <canvas ref={employeePaymentsChartRef} width={1100} height={440} style={{ display: 'block' }} />
        <canvas ref={projectTrendsChartRef} width={1100} height={440} style={{ display: 'block' }} />
        <canvas ref={uniqueClientsChartRef} width={1100} height={440} style={{ display: 'block' }} />
      </div>

      {/* Generating overlay */}
      {isGenerating &&
        ReactDOM.createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
            <div className="w-full max-w-sm p-6 text-center animate-scaleIn">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#E16428]/30 bg-[#E16428]/12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#E16428]/30 border-t-[#E16428]" />
              </div>
              <h3 className="text-lg font-semibold text-[#F6E9E9] font-['Poppins'] mb-1">
                Generating PDF
              </h3>
              <p className="text-[#F6E9E9]/65 text-sm font-['Inter']">
                Formatting report for {monthName} {yearName}…
              </p>
            </div>
          </div>,
          document.body
        )}

      {/* Authentication Modal */}
      {showAuthModal &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
            onClick={() => closeAuthModal(true)}
          >
            <div className="w-full max-w-sm p-6 animate-scaleIn" onClick={(e) => e.stopPropagation()}>
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
                  onClick={() => closeAuthModal(true)}
                  className="p-1 text-[#F6E9E9]/60 hover:text-[#F6E9E9] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-[#F6E9E9]/70 text-sm mb-1 font-['Inter']">
                {pinEnabled
                  ? 'Enter your OGO PIN to generate the PDF report.'
                  : 'Enter admin password to generate the PDF report.'}
              </p>
              <p className="text-[#F6E9E9]/45 text-xs mb-4 font-['Inter']">
                Period: {monthName} {yearName}
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
                  {authError && (
                    <p className="text-red-400 text-sm text-center font-['Inter']">{authError}</p>
                  )}
                </div>
              ) : (
                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  <div>
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => {
                        setAdminPassword(e.target.value);
                        setAuthError('');
                      }}
                      className="underline-field w-full px-1 py-3 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] placeholder-[#F6E9E9]/40 focus:outline-none focus:border-[#E16428] focus:ring-0 focus:shadow-none transition-all duration-300 font-['Inter']"
                      placeholder="Enter admin password"
                      autoFocus
                    />
                    {authError && (
                      <p className="mt-2 text-red-400 text-sm font-['Inter']">{authError}</p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => closeAuthModal(true)}
                      className="flex-1 px-4 py-2.5 bg-transparent border border-[#E16428]/25 text-[#F6E9E9]/80 rounded-lg hover:border-[#E16428]/45 hover:bg-[#E16428]/8 transition-all duration-200 font-['Inter'] text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isAuthenticating}
                      className="flex-1 px-4 py-2.5 bg-[#E16428] text-white rounded-lg hover:bg-[#d4551f] transition-colors font-['Inter'] text-sm font-semibold disabled:opacity-50"
                    >
                      {isAuthenticating ? '…' : 'Generate PDF'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default ReportModal;
