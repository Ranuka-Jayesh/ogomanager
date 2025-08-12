import React, { useMemo, useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Users, Calendar, Clock, Download, Lock, X } from 'lucide-react';
import { Project, Employee } from '../types';
import { GlassCard } from './GlassCard';
import ReportModal from './ReportModal';
import { supabase } from '../supabaseClient';

interface AnalyticsProps {
  projects: Project[];
  employees: Employee[];
}

interface MonthlyData {
  month: string;
  revenue: number;
  projects: number;
  completed: number;
  employeePayments: number;
}

export const Analytics: React.FC<AnalyticsProps> = ({ projects, employees }) => {
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

  // All analytics below use filteredProjects
  const totalRevenue = filteredProjects.reduce((sum, project) => sum + project.price, 0);
  const totalEmployeePayments = filteredProjects.reduce((sum, project) => sum + project.paymentOfEmp, 0);
  const profit = totalRevenue - totalEmployeePayments;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  const employeePerformance = useMemo(() => {
    return employees.map(employee => {
      const employeeProjects = filteredProjects.filter(p => p.assignedTo === employee.id);
      const completed = employeeProjects.filter(p => p.status === 'Delivered').length;
      const totalEarnings = employeeProjects.reduce((sum, p) => sum + p.paymentOfEmp, 0);
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
          <div className="relative w-full sm:w-auto">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#E16428] pointer-events-none">
              <Calendar className="w-4 h-4" />
            </span>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full sm:w-auto pl-9 pr-3 py-2 bg-[#272121]/70 border border-[#E16428]/30 rounded-lg text-[#F6E9E9] focus:outline-none focus:border-[#E16428] font-['Inter'] transition-all duration-200 hover:border-[#E16428] focus:ring-2 focus:ring-[#E16428]/30 text-xs sm:text-sm"
            >
              <option value="all" className="bg-[#272121] text-[#F6E9E9]">All Months</option>
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i} value={i} className="bg-[#272121] text-[#F6E9E9]">
                  {new Date(0, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div className="relative w-full sm:w-auto">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#E16428] pointer-events-none">
              <Clock className="w-4 h-4" />
            </span>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full sm:w-auto pl-9 pr-3 py-2 bg-[#272121]/70 border border-[#E16428]/30 rounded-lg text-[#F6E9E9] focus:outline-none focus:border-[#E16428] font-['Inter'] transition-all duration-200 hover:border-[#E16428] focus:ring-2 focus:ring-[#E16428]/30 text-xs sm:text-sm"
            >
              <option value="all" className="bg-[#272121] text-[#F6E9E9]">All Years</option>
              {years.map(year => (
                <option key={year} value={year} className="bg-[#272121] text-[#F6E9E9]">{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#F6E9E9] font-['Playfair_Display']">
          Analytics & Reports
        </h1>
        <div className="text-xs sm:text-sm text-[#F6E9E9]/70 font-['Inter']">
          Data as of {new Date().toLocaleDateString()}
        </div>
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

      <div className="flex justify-center sm:justify-between items-center mb-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
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
    </div>
  );
};