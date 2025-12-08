import React, { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import jsPDF from 'jspdf';
import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, PieController, LineElement, PointElement, LineController, Filler } from 'chart.js';
import { Project, Employee } from '../types';
import { supabase } from '../supabaseClient';

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
  const reportRef = useRef<HTMLDivElement>(null);
  const [, setProjectTypes] = React.useState<{ id: string; name: string }[]>([]);
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

  // Authentication state
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const [adminPassword, setAdminPassword] = React.useState('');
  const [authError, setAuthError] = React.useState('');
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);

  // ESC key handler to close modals
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showAuthModal) {
          setShowAuthModal(false);
        } else if (open) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAuthModal, open, onClose]);

  // Enhanced analytics calculations
  const totalRevenue = projects.reduce((sum, p) => sum + p.price, 0);
  const totalEmployeePayments = projects.reduce((sum, p) => sum + p.paymentOfEmp, 0);
  const profit = totalRevenue - totalEmployeePayments;
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
      
      months[monthKey].revenue += project.price;
      months[monthKey].projects += 1;
      months[monthKey].employeePayments += project.paymentOfEmp;
      months[monthKey].profit += (project.price - project.paymentOfEmp);
      
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
    const empProjects = projects.filter(p => p.assignedTo === emp.id);
    const totalEarnings = empProjects.reduce((sum, p) => sum + p.paymentOfEmp, 0);
    const revenue = empProjects.reduce((sum, p) => sum + p.price, 0);
    const completed = empProjects.filter(p => p.status === 'Delivered').length;
    const isRanukaJayesh = `${emp.firstName} ${emp.lastName}`.toLowerCase() === 'ranuka jayesh';
    return {
      ...emp,
      totalEarnings,
      revenue,
      displayValue: isRanukaJayesh ? revenue : totalEarnings,
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
        employeePayments += isNaN(pay) ? 0 : pay;
        if (p.client_name) {
          clients.add(p.client_name);
        }
      });

      const profitValue = revenue - employeePayments;

      return {
        revenue,
        profit: profitValue,
        employeePayments,
        uniqueClients: clients.size,
      };
    } catch (err) {
      console.error('Unexpected error while computing monthly KPIs:', err);
      return {
        revenue: 0,
        profit: 0,
        employeePayments: 0,
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
      setAuthError('');
      // Proceed with export
      handleExport();
    }
  };

  // Enhanced PDF export with comprehensive data and charts
  const handleExport = async () => {
    if (!reportRef.current) return;
    
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;
    
    // Header Section with Logo and Company Details
    const headerY = yPosition;
    
    // Add OGO logo (left side - smaller size)
    const logoImg = new Image();
    logoImg.src = '/Logo.jpg';
    await new Promise(resolve => { logoImg.onload = resolve; });
    pdf.addImage(logoImg, 'JPEG', margin, headerY, 15, 15);
    
    // Company info (right side - small font)
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(30, 30, 30);
    const infoX = pageWidth - margin;
    let infoY = headerY + 2;
    pdf.text('OGO TECHNOLOGY', infoX, infoY, { align: 'right' });
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    infoY += 4;
    pdf.text('Department of Academic Services', infoX, infoY, { align: 'right' });
    infoY += 3;
    pdf.text('Galle, Sri Lanka', infoX, infoY, { align: 'right' });
    infoY += 3;
    pdf.text('+94 75 930 7059', infoX, infoY, { align: 'right' });
    infoY += 3;
    pdf.text('info@ogotechnology.com', infoX, infoY, { align: 'right' });
    
    // Add line separator
    yPosition = headerY + 20;
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    
    // Add spacing after line
    yPosition += 8;
    
    // Report title (centered with proper spacing)
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(30, 30, 30);
    let reportTitle = '';
    if (month !== 'all' && year !== 'all') {
      reportTitle = `Analytics Report - ${monthName} ${yearName}`;
    } else if (month === 'all' && year !== 'all') {
      reportTitle = `Annual Analytics Report - ${yearName}`;
    } else if (month === 'all' && year === 'all') {
      reportTitle = 'Comprehensive Analytics Report - All Time';
    } else {
      reportTitle = 'Analytics Report';
    }
    
    // Center the title manually
    const titleWidth = pdf.getTextWidth(reportTitle);
    const titleX = (pageWidth - titleWidth) / 2;
    pdf.text(reportTitle, titleX, yPosition);
    yPosition += 10;
    
    // Report metadata
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(80, 80, 80);
    const generatedDate = now.toLocaleDateString('en-GB');
    const generatedTime = now.toLocaleTimeString('en-GB', { hour12: false });
    pdf.text(`Report Period: ${monthName} ${yearName} ~ Generated: ${generatedDate} at ${generatedTime}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;
    
    // Executive Summary Table
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(30, 30, 30);
    pdf.text('EXECUTIVE SUMMARY', margin, yPosition);
    yPosition += 8;
    
    // Table header
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(60, 60, 60);
    const summaryHeaders = ['Metric', 'Value'];
    const summaryColWidths = [60, 40];
    let xPos = margin;
    
    summaryHeaders.forEach((header, index) => {
      pdf.text(header, xPos, yPosition);
      xPos += summaryColWidths[index];
    });
    
    yPosition += 6;
    
    // Table data
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    const summaryData = [
      { label: 'Total Revenue', value: `LKR ${totalRevenue.toLocaleString()}` },
      { label: 'Total Profit', value: `LKR ${profit.toLocaleString()}` },
      { label: 'Profit Margin', value: `${profitMargin.toFixed(1)}%` },
      { label: 'Total Projects', value: totalProjects.toString() },
      { label: 'Completed Projects', value: completedProjects.toString() },
      { label: 'Completion Rate', value: `${completionRate.toFixed(1)}%` },
      { label: 'Average Project Value', value: `LKR ${averageProjectValue.toLocaleString()}` },
      { label: 'Best Employee', value: bestEmployee ? `${bestEmployee.firstName} ${bestEmployee.lastName}` : 'N/A' }
    ];
    
    summaryData.forEach(item => {
      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        yPosition = margin;
      }
      
      const rowData = [item.label, item.value];
      xPos = margin;
      rowData.forEach((cell, index) => {
        pdf.setTextColor(30, 30, 30);
        pdf.text(cell, xPos, yPosition);
        xPos += summaryColWidths[index];
      });
      
      yPosition += 5;
    });
    
    yPosition += 10;
    
    // Revenue Trend Analysis
    if (revenueTrend.length > 0) {
      if (yPosition > pageHeight - 60) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(30, 30, 30);
      pdf.text('REVENUE TREND ANALYSIS', margin, yPosition);
      yPosition += 8;
      
              // Revenue trend table with proper formatting
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(60, 60, 60);
        const trendHeaders = ['Month', 'Revenue', 'Profit', 'Projects', 'Completed'];
        const trendColWidths = [30, 30, 30, 25, 25];
        let xPos = margin;
        
        // Draw table header background
        pdf.setFillColor(240, 240, 240);
        pdf.rect(margin, yPosition - 3, pageWidth - (margin * 2), 8, 'F');
        
        trendHeaders.forEach((header, index) => {
          pdf.text(header, xPos, yPosition);
          xPos += trendColWidths[index];
        });
        
        yPosition += 8;
        
        // Trend data
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        revenueTrend.slice(-6).forEach((point, index) => {
          if (yPosition > pageHeight - 40) {
            pdf.addPage();
            yPosition = margin;
          }
          
          // Alternate row background
          if (index % 2 === 0) {
            pdf.setFillColor(248, 248, 248);
            pdf.rect(margin, yPosition - 2, pageWidth - (margin * 2), 6, 'F');
          }
          
          const rowData = [
            point.month,
            `LKR ${point.revenue.toLocaleString()}`,
            `LKR ${point.profit.toLocaleString()}`,
            point.projects.toString(),
            point.completed.toString()
          ];
          
          xPos = margin;
          rowData.forEach((cell, cellIndex) => {
            pdf.setTextColor(30, 30, 30);
            pdf.text(cell, xPos, yPosition);
            xPos += trendColWidths[cellIndex];
          });
          
          yPosition += 6;
        });
        
        yPosition += 10;
    }
    
    // Monthly Performance Analysis
    if (monthlyData.length > 0) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(30, 30, 30);
      pdf.text('MONTHLY PERFORMANCE ANALYSIS', margin, yPosition);
      yPosition += 8;
      
      // Table header with background
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(60, 60, 60);
      const tableHeaders = ['Month', 'Projects', 'Completed', 'Revenue', 'Profit', 'Avg Value'];
      const colWidths = [30, 20, 20, 30, 30, 25];
      let xPos = margin;
      
      // Draw table header background
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, yPosition - 3, pageWidth - (margin * 2), 8, 'F');
      
      tableHeaders.forEach((header, index) => {
        pdf.text(header, xPos, yPosition);
        xPos += colWidths[index];
      });
      
      yPosition += 8;
      
      // Table data
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      monthlyData.slice(-6).forEach((month, index) => {
        if (yPosition > pageHeight - 40) {
          pdf.addPage();
          yPosition = margin;
        }
        
        // Alternate row background
        if (index % 2 === 0) {
          pdf.setFillColor(248, 248, 248);
          pdf.rect(margin, yPosition - 2, pageWidth - (margin * 2), 6, 'F');
        }
        
        const monthName = new Date(month.month + '-01').toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short' 
        });
        
        const rowData = [
          monthName,
          month.projects.toString(),
          month.completed.toString(),
          `LKR ${month.revenue.toLocaleString()}`,
          `LKR ${month.profit.toLocaleString()}`,
          `LKR ${(month.revenue / month.projects).toLocaleString()}`
        ];
        
        xPos = margin;
        rowData.forEach((cell, cellIndex) => {
          pdf.setTextColor(30, 30, 30);
          pdf.text(cell, xPos, yPosition);
          xPos += colWidths[cellIndex];
        });
        
        yPosition += 6;
      });
      
      yPosition += 10;
    }
    
    // Employee Performance Analysis
    if (employeeStats.length > 0) {
      if (yPosition > pageHeight - 60) {
        pdf.addPage();
        yPosition = margin;
      }
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(30, 30, 30);
      pdf.text('EMPLOYEE PERFORMANCE ANALYSIS', margin, yPosition);
      yPosition += 8;
      
      // Top performers table with background
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(60, 60, 60);
      const empHeaders = ['Employee', 'Projects', 'Completed', 'Revenue', 'Completion %'];
      const empColWidths = [40, 20, 20, 30, 25];
      let xPos = margin;
      
      // Draw table header background
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, yPosition - 3, pageWidth - (margin * 2), 8, 'F');
      
      empHeaders.forEach((header, index) => {
        pdf.text(header, xPos, yPosition);
        xPos += empColWidths[index];
      });
      
      yPosition += 8;
      
      // Employee data
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      employeeStats.slice(0, 5).forEach((emp, index) => {
        if (yPosition > pageHeight - 40) {
          pdf.addPage();
          yPosition = margin;
        }
        
        // Alternate row background
        if (index % 2 === 0) {
          pdf.setFillColor(248, 248, 248);
          pdf.rect(margin, yPosition - 2, pageWidth - (margin * 2), 6, 'F');
        }
        
        const rowData = [
          `${emp.firstName} ${emp.lastName}`,
          emp.projectCount.toString(),
          emp.completedProjects.toString(),
          `LKR ${emp.revenue.toLocaleString()}`,
          `${emp.completionRate.toFixed(1)}%`
        ];
        
        xPos = margin;
        rowData.forEach((cell, cellIndex) => {
          pdf.setTextColor(30, 30, 30);
          pdf.text(cell, xPos, yPosition);
          xPos += empColWidths[cellIndex];
        });
        
        yPosition += 6;
      });
      
      yPosition += 10;
    }
    
    // Client Analysis
    if (Object.keys(orgStats).length > 0) {
      if (yPosition > pageHeight - 60) {
        pdf.addPage();
        yPosition = margin;
      }
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(30, 30, 30);
      pdf.text('CLIENT PERFORMANCE ANALYSIS', margin, yPosition);
      yPosition += 8;
      
      // Top clients table with background
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(60, 60, 60);
      const clientHeaders = ['Client/Org', 'Projects', 'Revenue', 'Avg Value'];
      const clientColWidths = [50, 20, 35, 30];
      let xPos = margin;
      
      // Draw table header background
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, yPosition - 3, pageWidth - (margin * 2), 8, 'F');
      
      clientHeaders.forEach((header, index) => {
        pdf.text(header, xPos, yPosition);
        xPos += clientColWidths[index];
      });
      
      yPosition += 8;
      
      // Client data
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      Object.entries(orgStats)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 5)
        .forEach(([org, stats], index) => {
          if (yPosition > pageHeight - 40) {
            pdf.addPage();
            yPosition = margin;
          }
          
          // Alternate row background
          if (index % 2 === 0) {
            pdf.setFillColor(248, 248, 248);
            pdf.rect(margin, yPosition - 2, pageWidth - (margin * 2), 6, 'F');
          }
          
          const rowData = [
            org.length > 25 ? org.substring(0, 22) + '...' : org,
            stats.count.toString(),
            `LKR ${stats.revenue.toLocaleString()}`,
            `LKR ${stats.avgValue.toLocaleString()}`
          ];
          
          xPos = margin;
          rowData.forEach((cell, cellIndex) => {
            pdf.setTextColor(30, 30, 30);
            pdf.text(cell, xPos, yPosition);
            xPos += clientColWidths[cellIndex];
          });
          
          yPosition += 6;
        });
      
      yPosition += 10;
    }
    
    // Annual Trends Charts Section - After Client Performance Analysis
    if (monthlyChartData && Object.keys(monthlyChartData).length > 0 && chartInstancesRef.current.revenue) {
      // Wait for charts to be fully rendered
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (yPosition > pageHeight - 80) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(30, 30, 30);
      
      let chartTitle = '';
      if (chartPeriod === 'daily' && month !== 'all' && year !== 'all') {
        // Daily view - show month and year
        const monthName = new Date(0, month as number).toLocaleString('default', { month: 'long' });
        chartTitle = `Month Trends - ${monthName} ${year}`;
      } else if (chartPeriod === 'monthly' && year !== 'all') {
        // Monthly view - show year
        chartTitle = `Monthly Trends - ${year}`;
      } else {
        // Yearly view - show all years
        chartTitle = 'Annual Trends';
      }
      
      pdf.text(chartTitle, margin, yPosition);
      yPosition += 10;

      // Helper function to add chart to PDF with high resolution
      const addChartToPDF = (chartInstance: Chart | undefined, chartTitle: string): void => {
        if (!chartInstance || !chartInstance.canvas) {
          console.warn(`Chart ${chartTitle} not available`);
          return;
        }

        try {
          // Export at maximum quality (PNG format with full quality)
          const chartDataUrl = chartInstance.toBase64Image('image/png', 1.0);
          
          if (yPosition > pageHeight - 70) {
            pdf.addPage();
            yPosition = margin;
          }

          // Chart title
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(12);
          pdf.setTextColor(30, 30, 30);
          pdf.text(chartTitle, margin, yPosition);
          yPosition += 6;

          // Add chart image with larger size for better clarity
          const chartWidth = pageWidth - (margin * 2);
          const chartHeight = 65; // Increased height for better visibility and clarity
          pdf.addImage(chartDataUrl, 'PNG', margin, yPosition, chartWidth, chartHeight, undefined, 'NONE');
          yPosition += chartHeight + 10;
        } catch (error) {
          console.error(`Error adding ${chartTitle} chart to PDF:`, error);
        }
      };

      // Add all 5 charts
      addChartToPDF(chartInstancesRef.current.revenue, 'Revenue Trend');
      addChartToPDF(chartInstancesRef.current.profit, 'Profit Trend');
      addChartToPDF(chartInstancesRef.current.employeePayments, 'Employee Payments Trend');
      addChartToPDF(chartInstancesRef.current.projectTrends, 'Project Trends');
      addChartToPDF(chartInstancesRef.current.uniqueClients, 'Unique Clients Trend');
    }
    
    // Key Insights and Recommendations
    if (yPosition > pageHeight - 80) {
      pdf.addPage();
      yPosition = margin;
    }
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(30, 30, 30);
    pdf.text('KEY INSIGHTS & RECOMMENDATIONS', margin, yPosition);
    yPosition += 8;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(60, 60, 60);
    
    // Enhanced insights with trend analysis
    const insights = [
      `• Total Revenue: LKR ${totalRevenue.toLocaleString()} with ${profitMargin.toFixed(1)}% profit margin`,
      `• Project Completion Rate: ${completionRate.toFixed(1)}% (${completedProjects}/${totalProjects} projects)`,
      `• Best Performing Employee: ${bestEmployee ? `${bestEmployee.firstName} ${bestEmployee.lastName}` : 'N/A'} with LKR ${bestEmployee ? bestEmployee.displayValue.toLocaleString() : '0'} revenue`,
      `• Top Client: ${bestOrg ? bestOrg[0] : 'N/A'} with ${bestOrg ? bestOrg[1].count : 0} projects`,
      `• Average Project Value: LKR ${averageProjectValue.toLocaleString()}`,
      `• Employee Payment Ratio: ${totalRevenue > 0 ? ((totalEmployeePayments / totalRevenue) * 100).toFixed(1) : '0'}% of revenue`,
      `• Revenue Trend: ${revenueTrend.length > 1 ? (revenueTrend[revenueTrend.length - 1].revenue > revenueTrend[revenueTrend.length - 2].revenue ? 'Increasing' : 'Decreasing') : 'Stable'} over the last ${revenueTrend.length} months`,
      `• Monthly Average Revenue: LKR ${revenueTrend.length > 0 ? (revenueTrend.reduce((sum, r) => sum + r.revenue, 0) / revenueTrend.length).toLocaleString() : '0'}`
    ];
    
    insights.forEach(insight => {
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text(insight, margin, yPosition);
      yPosition += 6;
    });
    
    // Add page numbers
    const pageCount = (typeof pdf.getNumberOfPages === 'function') ? pdf.getNumberOfPages() : (pdf.internal.pages ? pdf.internal.pages.length : 1);
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(Number(i));
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 15, { align: 'center' });
    }
    
    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text('OGO Technology - Professional Project Management System', pageWidth / 2, pageHeight - 8, { align: 'center' });
    pdf.text('Confidential Business Report - For Internal Use Only', pageWidth / 2, pageHeight - 5, { align: 'center' });
    
    // Generate filename
    let filename = 'OGO-Analytics-Report';
    if (month !== 'all' && year !== 'all') {
      filename = `OGO-Analytics-${monthName}-${yearName}`;
    } else if (month === 'all' && year !== 'all') {
      filename = `OGO-Analytics-${yearName}`;
    } else {
      filename = `OGO-Analytics-Comprehensive-${now.getFullYear()}`;
    }
    
    pdf.save(`${filename}.pdf`);
    
    // Log successful export
    await logAction(null, 'Admin', 'export_success');

    // Persist export summary in database
    await saveExportSummary();

    // Persist KPI percentage comparison data
    await saveAnalyticsComparison();
  };

  // Handle export button click (triggers authentication)
  const handleExportClick = () => {
    setShowAuthModal(true);
    setAdminPassword('');
    setAuthError('');
  };

  useEffect(() => {
    async function fetchProjectTypes() {
      const { data, error } = await supabase.from('project_types').select('*');
      if (!error && data) setProjectTypes(data);
    }
    fetchProjectTypes();
  }, []);

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
        yearlyData[projectYear].employeePayments += project.paymentOfEmp;
        yearlyData[projectYear].profit += (project.price - project.paymentOfEmp);
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

    // Helper function to create a chart with high resolution settings
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
            borderWidth: 6, // Increased for high res
            tension: 0.4,
            fill: true,
            pointRadius: 10, // Increased for high res
            pointHoverRadius: 14,
            pointBackgroundColor: color,
            pointBorderColor: '#fff',
            pointBorderWidth: 4,
          }]
        },
        options: {
          responsive: false, // Fixed size for high res
          maintainAspectRatio: false,
          devicePixelRatio: 2, // Higher DPI for clarity
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: '#000000', // Black text
                font: {
                  family: 'Inter',
                  size: 24, // Scaled up for high res
                  weight: 'bold'
                },
                padding: 30,
                usePointStyle: true,
              }
            },
            tooltip: {
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              titleColor: '#000000', // Black text
              bodyColor: '#000000', // Black text
              borderColor: '#E16428',
              borderWidth: 2,
              padding: 24,
              displayColors: true,
              titleFont: {
                size: 20
              },
              bodyFont: {
                size: 18
              },
              callbacks: {
                label: function(context) {
                  if (label === 'Project Count') {
                    return `${context.dataset.label}: ${context.parsed.y} projects`;
                  }
                  if (label === 'Unique Clients') {
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
                color: '#000000', // Black text
                font: {
                  family: 'Inter',
                  size: 20 // Scaled up for high res
                }
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.1)',
                lineWidth: 2
              }
            },
            y: {
              ticks: {
                color: '#000000', // Black text
                font: {
                  family: 'Inter',
                  size: 20 // Scaled up for high res
                },
                callback: function(value) {
                  if (label === 'Project Count' || label === 'Unique Clients') {
                    return Number(value).toString();
                  }
                  return 'LKR ' + Number(value).toLocaleString();
                }
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.1)',
                lineWidth: 2
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      {/* Hidden chart canvases for PDF export - positioned off-screen but visible to browser - Higher resolution for clarity */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '1600px', height: '800px', pointerEvents: 'none' }}>
        <canvas ref={revenueChartRef} width={1600} height={800} style={{ display: 'block' }}></canvas>
        <canvas ref={profitChartRef} width={1600} height={800} style={{ display: 'block' }}></canvas>
        <canvas ref={employeePaymentsChartRef} width={1600} height={800} style={{ display: 'block' }}></canvas>
        <canvas ref={projectTrendsChartRef} width={1600} height={800} style={{ display: 'block' }}></canvas>
        <canvas ref={uniqueClientsChartRef} width={1600} height={800} style={{ display: 'block' }}></canvas>
      </div>

      <div className="bg-[#1a1818] rounded-2xl shadow-2xl max-w-4xl w-full mx-4 p-8 overflow-y-auto max-h-[90vh] relative" ref={reportRef}>
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-[#272121]/60 text-[#F6E9E9] rounded-lg hover:bg-[#E16428]/20 transition-all duration-300">
          <X className="w-5 h-5" />
        </button>
        
        {/* Company Details */}
        <div className="flex items-center gap-4 mb-8">
          <img src="/Logo.jpg" alt="OGO Logo" className="w-14 h-14 rounded-xl object-cover border-2 border-[#E16428]/40 shadow" />
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#F6E9E9] font-['Playfair_Display'] tracking-tight lowercase">ogo technology</h2>
            <p className="text-[#F6E9E9]/70 text-xs sm:text-sm lowercase">comprehensive analytics report</p>
            <p className="text-[#F6E9E9]/50 text-xs mt-1">generated: {now.toLocaleDateString()} {now.toLocaleTimeString()}</p>
            <p className="text-[#F6E9E9]/50 text-xs">period: {monthName} {yearName}</p>
          </div>
        </div>
        
        {/* Enhanced Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-r from-[#E16428]/80 to-[#E16428]/40 rounded-xl p-4 flex flex-col gap-2 shadow">
            <span className="text-[#fff]/80 text-sm font-['Inter']">Total Revenue</span>
            <span className="text-xl font-bold text-white font-['Poppins']">LKR {totalRevenue.toLocaleString()}</span>
            <span className="text-[#fff]/60 text-xs">Profit Margin: {profitMargin.toFixed(1)}%</span>
          </div>
          <div className="bg-gradient-to-r from-green-500/80 to-green-500/40 rounded-xl p-4 flex flex-col gap-2 shadow">
            <span className="text-[#fff]/80 text-sm font-['Inter']">Total Profit</span>
            <span className="text-xl font-bold text-white font-['Poppins']">LKR {profit.toLocaleString()}</span>
            <span className="text-[#fff]/60 text-xs">Avg Project: LKR {averageProjectValue.toLocaleString()}</span>
          </div>
          <div className="bg-gradient-to-r from-purple-500/80 to-purple-500/40 rounded-xl p-4 flex flex-col gap-2 shadow">
            <span className="text-[#fff]/80 text-sm font-['Inter']">Completion Rate</span>
            <span className="text-xl font-bold text-white font-['Poppins']">{completionRate.toFixed(1)}%</span>
            <span className="text-[#fff]/60 text-xs">{completedProjects}/{totalProjects} Projects</span>
          </div>
          <div className="bg-gradient-to-r from-yellow-500/80 to-yellow-500/40 rounded-xl p-4 flex flex-col gap-2 shadow">
            <span className="text-[#fff]/80 text-sm font-['Inter']">Employee Payments</span>
            <span className="text-xl font-bold text-white font-['Poppins']">LKR {totalEmployeePayments.toLocaleString()}</span>
            <span className="text-[#fff]/60 text-xs">Best: {bestEmployee ? `${bestEmployee.firstName} ${bestEmployee.lastName}` : 'N/A'}</span>
          </div>
        </div>
        
        {/* Revenue Trend Chart Preview */}
        {revenueTrend.length > 0 && (
          <div className="bg-[#272121]/80 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-bold text-[#E16428] mb-4 font-['Poppins']">Revenue Trend Analysis</h3>
            <div className="space-y-3">
              {revenueTrend.slice(-6).map((trend, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-[#1a1818]/50 rounded-lg">
                  <div>
                    <p className="text-[#F6E9E9] font-medium text-sm">{trend.month}</p>
                    <p className="text-[#F6E9E9]/70 text-xs">{trend.projects} projects</p>
          </div>
                  <div className="text-right">
                    <p className="text-[#E16428] font-bold text-sm">LKR {trend.revenue.toLocaleString()}</p>
                    <p className="text-[#F6E9E9]/70 text-xs">Profit: LKR {trend.profit.toLocaleString()}</p>
          </div>
        </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Enhanced Performance Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#272121]/80 rounded-xl p-6">
            <h3 className="text-lg font-bold text-[#E16428] mb-4 font-['Poppins']">Top Employees</h3>
            <div className="space-y-3">
              {employeeStats.slice(0, 3).map(emp => (
                <div key={emp.id} className="flex justify-between items-center p-3 bg-[#1a1818]/50 rounded-lg">
                  <div>
                    <p className="text-[#F6E9E9] font-medium text-sm">{emp.firstName} {emp.lastName}</p>
                    <p className="text-[#F6E9E9]/70 text-xs">{emp.completedProjects}/{emp.projectCount} completed</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#E16428] font-bold text-sm">LKR {emp.displayValue.toLocaleString()}</p>
                    <p className="text-[#F6E9E9]/70 text-xs">{emp.completionRate.toFixed(1)}% success</p>
                  </div>
        </div>
              ))}
            </div>
          </div>
          
          <div className="bg-[#272121]/80 rounded-xl p-6">
            <h3 className="text-lg font-bold text-[#E16428] mb-4 font-['Poppins']">Top Clients</h3>
            <div className="space-y-3">
              {Object.entries(orgStats)
                .sort((a, b) => b[1].revenue - a[1].revenue)
                .slice(0, 3)
                .map(([org, stats]) => (
                  <div key={org} className="flex justify-between items-center p-3 bg-[#1a1818]/50 rounded-lg">
                    <div>
                      <p className="text-[#F6E9E9] font-medium text-sm">{org.length > 25 ? org.substring(0, 22) + '...' : org}</p>
                      <p className="text-[#F6E9E9]/70 text-xs">{stats.count} projects</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#E16428] font-bold text-sm">LKR {stats.revenue.toLocaleString()}</p>
                      <p className="text-[#F6E9E9]/70 text-xs">Avg: LKR {stats.avgValue.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
        
        {/* Export Button */}
        <div className="flex justify-end mt-6">
          <button
            onClick={handleExportClick}
            className="px-6 py-3 bg-gradient-to-r from-[#E16428] to-[#E16428]/80 text-white rounded-lg hover:scale-105 transition-all duration-300 shadow-lg font-['Poppins'] font-bold flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Export Comprehensive PDF
          </button>
        </div>
      </div>

      {/* Authentication Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-4">
          <div className="bg-[#272121] border border-[#E16428]/30 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full scale-100 animate-popIn">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#E16428]/20 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#E16428]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-[#F6E9E9] font-['Poppins']">
                  Admin Authentication
                </h3>
              </div>
              <button
                onClick={() => setShowAuthModal(false)}
                className="p-2 hover:bg-[#363333]/60 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-[#F6E9E9]/70" />
              </button>
            </div>
            
            <form onSubmit={handleAuthSubmit} className="space-y-4">
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
              
              {authError && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm font-['Inter']">{authError}</p>
                </div>
              )}
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  className="flex-1 px-4 py-3 bg-[#363333]/60 text-[#F6E9E9] rounded-lg hover:bg-[#E16428]/10 transition-all duration-200 font-['Poppins'] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-[#E16428] to-[#E16428]/80 text-white rounded-lg shadow-lg hover:scale-105 transition-all duration-200 font-['Poppins'] font-bold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isAuthenticating ? 'Authenticating...' : 'Export Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportModal; 