import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Edit, Trash2, Calendar, FileText, Hourglass, CheckCircle2, CircleDot } from 'lucide-react';
import { Project, Employee, EmployeePayment } from '../types';
import { supabase } from '../supabaseClient';
import { ProjectReceiptModal } from './ProjectReceiptModal';
import { PaymentConfirmationModal } from './PaymentConfirmationModal';
import { EmployeePaymentModal } from './EmployeePaymentModal';
import {
  buildEmployeePayment,
  getEmployeePaidAmount,
  normalizeEmployeePayment,
  totalEmployeePaymentAmount,
} from '../utils/employeePayments';

interface ProjectTableProps {
  projects: Project[];
  employees: Employee[];
  onEdit: (project: Project) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, updates: Partial<Project>) => void;
  viewFilter?: string;
  disablePagination?: boolean;
  recordsPerPage?: number;
}

interface ProjectType {
  id: string;
  name: string;
}

export const ProjectTable: React.FC<ProjectTableProps> = ({
  projects,
  employees,
  onEdit,
  onDelete,
  onUpdateStatus,
  viewFilter,
  disablePagination = false,
  recordsPerPage: recordsPerPageProp,
}) => {
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [receiptProject, setReceiptProject] = useState<Project | null>(null);
  const [paymentConfirmationProject, setPaymentConfirmationProject] = useState<Project | null>(null);
  const [employeePaymentEdit, setEmployeePaymentEdit] = useState<{
    project: Project;
    employeeId: string;
    employeeName: string;
    payment: EmployeePayment;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = recordsPerPageProp ?? 7;
  const paginatedProjects = disablePagination
    ? projects
    : projects.slice(
        (currentPage - 1) * recordsPerPage,
        currentPage * recordsPerPage
      );

  // State for employee slideshow - tracks which employee index to show for each project
  const [employeeSlideIndex, setEmployeeSlideIndex] = useState<Record<string, number>>({});
  // State for project type slideshow - tracks which type index to show for each project
  const [typeSlideIndex, setTypeSlideIndex] = useState<Record<string, number>>({});
  // State for deadline slideshow - toggles between date and days remaining
  const [deadlineSlideIndex, setDeadlineSlideIndex] = useState<Record<string, number>>({});
  const projectsRef = useRef(projects);
  
  // Keep projects ref updated
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  // Auto-cycle through employees and project types for projects with multiple items
  useEffect(() => {
    const interval = setInterval(() => {
      const currentProjects = projectsRef.current;
      // Update employee slide index
      setEmployeeSlideIndex(prev => {
        const newState: Record<string, number> = {};
        currentProjects.forEach(project => {
          if (project.assignedTo) {
            const employeeIds = project.assignedTo.split(',').map(id => id.trim()).filter(Boolean);
            if (employeeIds.length > 1) {
              const currentIndex = prev[project.id] || 0;
              newState[project.id] = (currentIndex + 1) % employeeIds.length;
            }
          }
        });
        return newState;
      });
      // Update project type slide index
      setTypeSlideIndex(prev => {
        const newState: Record<string, number> = {};
        currentProjects.forEach(project => {
          if (project.projectDescription) {
            const typeIds = project.projectDescription.split(',').map(id => id.trim()).filter(Boolean);
            if (typeIds.length > 1) {
              const currentIndex = prev[project.id] || 0;
              newState[project.id] = (currentIndex + 1) % typeIds.length;
            }
          }
        });
        return newState;
      });
      // Update deadline slide index (toggles between 0 and 1)
      setDeadlineSlideIndex(prev => {
        const newState: Record<string, number> = {};
        currentProjects.forEach(project => {
          const currentIndex = prev[project.id] || 0;
          newState[project.id] = (currentIndex + 1) % 2;
        });
        return newState;
      });
    }, 2000); // Switch every 2 seconds

    return () => clearInterval(interval);
  }, []);

  // Detect if current view is strictly for Pending Payment items
  const isPendingPaymentView = viewFilter === 'Pending Payment' || (paginatedProjects.length > 0 && paginatedProjects.every(p => p.status === 'Pending Payment'));

  // Fetch project types from database
  useEffect(() => {
    async function fetchProjectTypes() {
      const { data, error } = await supabase.from('project_types').select('*');
      if (!error && data) {
        setProjectTypes(data);
      }
    }
    fetchProjectTypes();
  }, []);

  // Debug employees array changes
  useEffect(() => {
    console.log('ProjectTable: Employees array updated:', employees);
    console.log('ProjectTable: Number of employees:', employees.length);
    if (employees.length > 0) {
      console.log('ProjectTable: First employee sample:', employees[0]);
    }
  }, [employees]);

  // ESC / Enter keys for delete confirm
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.key === 'Escape') {
        if (confirmDeleteId) {
          setConfirmDeleteId(null);
          setDeletingProject(null);
        }
        if (receiptProject) {
          setReceiptProject(null);
        }
        if (paymentConfirmationProject) {
          setPaymentConfirmationProject(null);
        }
      }

      if (event.key === 'Enter' && confirmDeleteId) {
        event.preventDefault();
        onDelete(confirmDeleteId);
        setConfirmDeleteId(null);
        setDeletingProject(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDeleteId, receiptProject, paymentConfirmationProject, onDelete]);

  // Get single employee name by ID
  const getEmployeeNameById = (employeeId: string): string => {
    if (!employeeId) return 'Unassigned';
    
    const employee = employees.find(emp => emp.id === employeeId);
    
    if (employee) {
      return `${employee.firstName} ${employee.lastName}`;
    } else {
      // Try to find by employeeId field as well
      const employeeByEmployeeId = employees.find(emp => emp.employeeId === employeeId);
      if (employeeByEmployeeId) {
        return `${employeeByEmployeeId.firstName} ${employeeByEmployeeId.lastName}`;
      }
      return `Unknown`;
    }
  };

  // Get employee names - handles comma-separated IDs for multiple employees
  const getEmployeeName = (assignedTo: string) => {
    if (!assignedTo) return 'Unassigned';
    
    // Split by comma for multiple employees
    const employeeIds = assignedTo.split(',').map(id => id.trim()).filter(Boolean);
    
    if (employeeIds.length === 0) return 'Unassigned';
    
    // Get names for all employee IDs
    const names = employeeIds.map(id => getEmployeeNameById(id));
    
    // Join names with comma for display
    return names.join(', ');
  };

  // Get employee slideshow data for a project (includes payment info)
  const resolvePaymentForEmployee = (project: Project, employeeId: string): EmployeePayment => {
    const employeeIds = project.assignedTo
      ? project.assignedTo.split(',').map(id => id.trim()).filter(Boolean)
      : [];
    const existing = project.employeePayments || [];
    const found = existing.find(ep => ep.employeeId === employeeId);
    if (found) {
      return normalizeEmployeePayment(found) || buildEmployeePayment(employeeId, 0, 0);
    }
    const amount =
      employeeIds.length === 1 && employeeIds[0] === employeeId
        ? Math.abs(project.paymentOfEmp || 0)
        : 0;
    return buildEmployeePayment(employeeId, amount, 0);
  };

  const getEmployeeSlideshow = (project: Project) => {
    if (!project.assignedTo) {
      return {
        names: ['Unassigned'],
        employeeIds: [] as string[],
        payments: [0],
        paidAmounts: [0],
        statuses: ['paid' as const],
        count: 1,
        currentIndex: 0,
      };
    }
    
    const employeeIds = project.assignedTo.split(',').map(id => id.trim()).filter(Boolean);
    if (employeeIds.length === 0) {
      return {
        names: ['Unassigned'],
        employeeIds: [] as string[],
        payments: [0],
        paidAmounts: [0],
        statuses: ['paid' as const],
        count: 1,
        currentIndex: 0,
      };
    }
    
    const names = employeeIds.map(id => getEmployeeNameById(id));
    const currentIndex = employeeSlideIndex[project.id] || 0;
    
    const resolved = employeeIds.map(id => resolvePaymentForEmployee(project, id));
    const payments = resolved.map(p => Math.abs(p.amount ?? p.payment ?? 0));
    const paidAmounts = resolved.map(p => getEmployeePaidAmount(p));
    const statuses = resolved.map(p => p.status);
    
    return { names, employeeIds, payments, paidAmounts, statuses, count: names.length, currentIndex };
  };

  const openEmployeePaymentModal = (project: Project, employeeId: string) => {
    if (!employeeId) return;
    const payment = resolvePaymentForEmployee(project, employeeId);
    setEmployeePaymentEdit({
      project,
      employeeId,
      employeeName: getEmployeeNameById(employeeId),
      payment,
    });
  };

  const handleEmployeePaymentConfirm = (nextPayment: EmployeePayment) => {
    if (!employeePaymentEdit) return;
    const { project, employeeId } = employeePaymentEdit;
    const employeeIds = project.assignedTo
      ? project.assignedTo.split(',').map(id => id.trim()).filter(Boolean)
      : [];
    if (!employeeIds.includes(employeeId)) return;

    const nextPayments = employeeIds.map(id =>
      id === employeeId ? nextPayment : resolvePaymentForEmployee(project, id)
    );

    onUpdateStatus(project.id, {
      assignedTo: employeeIds.join(','),
      employeePayments: nextPayments,
      paymentOfEmp: totalEmployeePaymentAmount(nextPayments),
    });
    setEmployeePaymentEdit(null);
  };

  // Render employee slideshow component
  const renderEmployeeSlideshow = (project: Project, className?: string) => {
    const { names, count, currentIndex } = getEmployeeSlideshow(project);
    
    if (count === 1) {
      return <span className={className}>{names[0]}</span>;
    }
    
    return (
      <div className="relative overflow-hidden">
        <span 
          key={`${project.id}-${currentIndex}`}
          className={`block animate-slideSwap ${className}`}
        >
          {names[currentIndex]}
        </span>
      </div>
    );
  };

  // Render payment slideshow component (synced with employee slideshow + payment/balance carousel)
  const renderPaymentSlideshow = (project: Project) => {
    const { payments, paidAmounts, statuses, employeeIds, count, currentIndex } = getEmployeeSlideshow(project);
    const currentPayment = payments[currentIndex] || 0;
    const currentPaid = paidAmounts[currentIndex] || 0;
    const status = statuses[currentIndex] || 'pending';
    const currentEmpId = employeeIds[currentIndex] || '';
    const remaining = Math.max(0, currentPayment - currentPaid);
    const balanceSlide = (deadlineSlideIndex[project.id] || 0) === 1;
    const showValue = balanceSlide ? remaining : currentPayment;

    const colorClass = balanceSlide
      ? remaining > 0
        ? 'text-yellow-400 hover:bg-yellow-500/15'
        : 'text-green-400/80 hover:bg-green-500/15'
      : status === 'paid'
      ? 'text-green-400/80 hover:bg-green-500/15'
      : status === 'partial'
      ? 'text-blue-400 hover:bg-blue-500/15'
      : 'text-yellow-400 hover:bg-yellow-500/15';

    const title =
      status === 'paid'
        ? 'Paid — tap to manage / return'
        : status === 'partial'
        ? `Partial — paid LKR ${currentPaid.toLocaleString()}, left LKR ${remaining.toLocaleString()}`
        : 'Pending — tap to pay full / partial';
    
    const amountEl = (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (currentEmpId) openEmployeePaymentModal(project, currentEmpId);
        }}
        disabled={!currentEmpId || currentPayment <= 0}
        title={title}
        aria-label="Manage employee payment"
        className={`inline-flex items-center gap-1.5 font-medium rounded-md px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${colorClass}`}
      >
        {status === 'paid' ? (
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
        ) : status === 'partial' ? (
          <CircleDot className="w-3.5 h-3.5 flex-shrink-0" />
        ) : (
          <Hourglass className="w-3.5 h-3.5 animate-pulse flex-shrink-0" />
        )}
        <span key={`${project.id}-emppay-${currentIndex}-${balanceSlide ? 1 : 0}`} className="animate-slideSwap">
          {balanceSlide ? 'Bal ' : ''}LKR {showValue.toLocaleString()}
        </span>
      </button>
    );
    
    if (count === 1) return amountEl;
    
    return (
      <div className="relative overflow-hidden">
        <span 
          key={`${project.id}-payment-${currentIndex}`}
          className="block animate-slideSwap"
        >
          {amountEl}
        </span>
      </div>
    );
  };

  const getProjectTypeNames = (projectDescription: string) => {
    if (!projectDescription) return 'No types specified';
    
    // Split comma-separated IDs and map to names
    const typeIds = projectDescription.split(',').map(id => id.trim());
    const typeNames = typeIds.map(id => {
      const type = projectTypes.find(t => t.id === id);
      return type ? type.name : `Unknown Type (${id})`;
    });
    
    return typeNames.join(', ');
  };

  // Get project type slideshow data
  const getTypeSlideshow = (project: Project) => {
    if (!project.projectDescription) return { names: ['No types'], count: 1, currentIndex: 0 };
    
    const typeIds = project.projectDescription.split(',').map(id => id.trim()).filter(Boolean);
    if (typeIds.length === 0) return { names: ['No types'], count: 1, currentIndex: 0 };
    
    const names = typeIds.map(id => {
      const type = projectTypes.find(t => t.id === id);
      return type ? type.name : id;
    });
    const currentIndex = typeSlideIndex[project.id] || 0;
    
    return { names, count: names.length, currentIndex };
  };

  // Render project type slideshow component
  const renderTypeSlideshow = (project: Project, className?: string) => {
    const { names, count, currentIndex } = getTypeSlideshow(project);
    
    if (count === 1) {
      return <span className={className}>{names[0]}</span>;
    }
    
    return (
      <div className="relative overflow-hidden">
        <span 
          key={`${project.id}-type-${currentIndex}`}
          className={`block animate-slideSwap ${className}`}
        >
          {names[currentIndex]}
        </span>
      </div>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Running':
        return 'text-blue-400 border-b-blue-400/60 focus:border-b-blue-400';
      case 'Delivered':
        return 'text-emerald-400 border-b-emerald-400/60 focus:border-b-emerald-400';
      case 'Pending':
        return 'text-yellow-400 border-b-yellow-400/60 focus:border-b-yellow-400';
      case 'Pending Payment':
        return 'text-violet-400 border-b-violet-400/60 focus:border-b-violet-400';
      case 'Correction':
        return 'text-orange-400 border-b-orange-400/60 focus:border-b-orange-400';
      case 'Rejected':
        return 'text-red-400 border-b-red-400/60 focus:border-b-red-400';
      default:
        return 'text-[#F6E9E9]/60 border-b-[#E16428]/30 focus:border-b-[#E16428]';
    }
  };

  // Calculate days remaining until deadline
  const getDaysRemaining = (deadlineDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(deadlineDate);
    deadline.setHours(0, 0, 0, 0);
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Format deadline display with days remaining
  const formatDeadline = (deadlineDate: string) => {
    const days = getDaysRemaining(deadlineDate);
    const dateStr = new Date(deadlineDate).toLocaleDateString();
    
    if (days < 0) {
      return { date: dateStr, daysText: `${days} overdue`, color: 'text-red-400' };
    } else if (days === 0) {
      return { date: dateStr, daysText: '0 days left', color: 'text-yellow-400' };
    } else if (days === 1) {
      return { date: dateStr, daysText: '1 day left', color: 'text-yellow-400' };
    } else if (days <= 3) {
      return { date: dateStr, daysText: `${days} days left`, color: 'text-orange-400' };
    } else if (days <= 7) {
      return { date: dateStr, daysText: `${days} days left`, color: 'text-blue-400' };
    } else {
      return { date: dateStr, daysText: `${days} days left`, color: 'text-green-400' };
    }
  };

  // Render deadline slideshow (cycles between date and days remaining)
  const renderDeadlineSlideshow = (project: Project, className?: string) => {
    const { date, daysText, color } = formatDeadline(project.deadlineDate);
    const currentIndex = deadlineSlideIndex[project.id] || 0;
    
    // If status is Delivered, only show the date (no days count)
    if (project.status === 'Delivered') {
      return (
        <span className={`text-[#F6E9E9]/70 ${className}`}>
          {date}
        </span>
      );
    }
    
    return (
      <div className="relative overflow-hidden">
        <span 
          key={`${project.id}-deadline-${currentIndex}`}
          className={`block animate-slideSwap ${currentIndex === 0 ? 'text-[#F6E9E9]/70' : color} ${className}`}
        >
          {currentIndex === 0 ? date : daysText}
        </span>
      </div>
    );
  };

  const statuses: Project['status'][] = [
    'Running',
    'Pending',
    'Pending Payment',
    'Delivered',
    'Correction',
    'Rejected',
  ];

  const handleStatusChange = (projectId: string, newStatus: Project['status']) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    // Check if changing to "Delivered" and there's a remaining balance
    if (newStatus === 'Delivered') {
      const discount = project.giveDiscount ? (project.discountAmount || 0) : 0;
      const remainingBalance = project.price - project.advance - discount;
      if (remainingBalance > 0) {
        setPaymentConfirmationProject(project);
        return;
      }
    }

    onUpdateStatus(projectId, { status: newStatus });
  };

  const handlePaymentConfirmation = (customAmount?: number) => {
    if (!paymentConfirmationProject) return;

    if (customAmount !== undefined) {
      // Partial payment
      const discount = paymentConfirmationProject.giveDiscount
        ? (paymentConfirmationProject.discountAmount || 0)
        : 0;
      const newAdvance = paymentConfirmationProject.advance + customAmount;
      const newBalance = paymentConfirmationProject.price - discount - newAdvance;
      const finalStatus = newBalance > 0 ? 'Pending Payment' : 'Delivered';
      
      onUpdateStatus(paymentConfirmationProject.id, {
        status: finalStatus,
        advance: newAdvance,
        balance: Math.max(0, newBalance)
      });
    } else {
      // Full payment
      const discount = paymentConfirmationProject.giveDiscount
        ? (paymentConfirmationProject.discountAmount || 0)
        : 0;
      const effectivePrice = paymentConfirmationProject.price - discount;
      onUpdateStatus(paymentConfirmationProject.id, {
        status: 'Delivered',
        advance: effectivePrice,
        balance: 0
      });
    }

    setPaymentConfirmationProject(null);
  };

  const handleDeleteClick = (project: Project) => {
    setDeletingProject(project);
    setConfirmDeleteId(project.id);
  };

  const handleConfirmDelete = () => {
    if (confirmDeleteId) {
      onDelete(confirmDeleteId);
      setConfirmDeleteId(null);
      setDeletingProject(null);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDeleteId(null);
    setDeletingProject(null);
  };

  return (
    <>
    <div className="overflow-hidden w-full min-w-0">
      {/* Mobile / tablet Card View */}
      <div className="block lg:hidden">
        <div className="p-1 space-y-0">
          {projects.map((project) => {
            return (
              <div key={project.id} className="relative border-0 border-b border-[#E16428]/12 py-3.5 pl-3 bg-transparent">
                <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full ${
                  project.status === 'Running' ? 'bg-blue-400' :
                  project.status === 'Delivered' ? 'bg-emerald-400' :
                  project.status === 'Pending' ? 'bg-yellow-400' :
                  project.status === 'Pending Payment' ? 'bg-violet-400' :
                  project.status === 'Correction' ? 'bg-orange-400' :
                  project.status === 'Rejected' ? 'bg-red-400' : 'bg-[#F6E9E9]/20'
                }`} />
                
                {/* Header with client info and actions */}
              <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[#E16428] text-[10px] font-mono border-b border-[#E16428]/40">{project.projectId}</span>
                      <h3 className="text-[#F6E9E9] font-medium text-sm truncate">{project.clientName}</h3>
                    </div>
                    <p className="text-[#F6E9E9]/40 text-xs truncate">{project.clientUniOrg}</p>
                </div>
                  
                  {/* Action buttons */}
                  <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => onEdit(project)}
                      className="p-1.5 text-[#E16428] border-0 border-b border-[#E16428]/30 hover:border-[#E16428] transition-colors"
                      title="Edit Project"
                    >
                      <Edit className="w-4 h-4" />
                  </button>
                    <button
                      onClick={() => setReceiptProject(project)}
                      className="p-1.5 text-blue-400 border-0 border-b border-blue-400/30 hover:border-blue-400 transition-colors"
                      title="View Receipt"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(project)}
                      className="p-1.5 text-red-400 border-0 border-b border-red-400/30 hover:border-red-400 transition-colors"
                      title="Delete Project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                </div>
              </div>
              
                {/* Project types with icons */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {project.projectDescription.split(',').map((typeId, idx) => {
                    const type = projectTypes.find(t => t.id === typeId.trim());
                    return (
                      <span key={idx} className="inline-flex items-center gap-1 bg-[#E16428]/15 text-[#E16428] rounded-full px-2.5 py-1 text-xs font-medium border border-[#E16428]/20">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        {type ? type.name : typeId.trim()}
                      </span>
                    );
                  })}
                  {project.fastDeliver && (
                    <span className="inline-flex items-center gap-1 bg-yellow-500/20 text-yellow-400 rounded-full px-2.5 py-1 text-xs font-medium border border-yellow-500/30">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Fast
                      </span>
                  )}
                </div>

                {/* Project details grid */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {/* Assigned To */}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-[#E16428]/20 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#E16428]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[#F6E9E9]/60 text-xs">Assigned</p>
                      <div className="text-[#F6E9E9] text-sm font-medium truncate">
                        {renderEmployeeSlideshow(project, "text-[#F6E9E9] text-sm font-medium")}
                      </div>
                    </div>
                  </div>

                  {/* Deadline */}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[#F6E9E9]/60 text-xs">Deadline</p>
                      {renderDeadlineSlideshow(project, "text-sm font-medium")}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[#F6E9E9]/60 text-xs">Price</p>
                      <p className="text-[#E16428] text-sm font-bold">
                        LKR {project.price.toLocaleString()}
                      </p>
                </div>
                  </div>

                  {/* Employee Payment or Balance (Pending Payment view) */}
                  <div className="flex items-center gap-2">
                    {isPendingPaymentView ? (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-yellow-500/20">
                        <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                    ) : (
                      (() => {
                        const { employeeIds, statuses, currentIndex } = getEmployeeSlideshow(project);
                        const status = statuses[currentIndex] || 'pending';
                        const empId = employeeIds[currentIndex] || '';
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (empId) openEmployeePaymentModal(project, empId);
                            }}
                            disabled={!empId}
                            title="Manage employee payment"
                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-40 ${
                              status === 'paid'
                                ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                : status === 'partial'
                                ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                            }`}
                          >
                            {status === 'paid' ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : status === 'partial' ? (
                              <CircleDot className="w-4 h-4" />
                            ) : (
                              <Hourglass className="w-4 h-4" />
                            )}
                          </button>
                        );
                      })()
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[#F6E9E9]/60 text-xs">{isPendingPaymentView ? 'Balance' : 'Emp.Payment'}</p>
                      <div className="text-sm font-medium">
                        {isPendingPaymentView ? (
                          <span className="text-yellow-400">LKR {(project.balance ?? 0).toLocaleString()}</span>
                        ) : (
                          renderPaymentSlideshow(project)
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status selector */}
                <div className="flex items-center justify-between">
                  <span className="text-[#F6E9E9]/45 text-xs font-['Inter']">Status</span>
                  <select
                    value={project.status}
                    onChange={(e) => handleStatusChange(project.id, e.target.value as Project['status'])}
                    className="px-0 py-1 rounded-none text-xs font-medium border-0 border-b border-[#E16428]/35 bg-transparent text-[#F6E9E9] cursor-pointer focus:outline-none focus:border-[#E16428]"
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status} className="bg-[#272121] text-[#F6E9E9]">
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block w-full min-w-0 overflow-x-hidden">
          <div className="relative w-full overflow-x-hidden">
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[7%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[11%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[14%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-[#272121]/90 backdrop-blur-sm">
            <tr className="border-b border-[#E16428]/25">
                  <th className="text-left align-middle text-[10px] tracking-[0.12em] uppercase text-[#F6E9E9]/40 font-normal px-2 py-3 font-['Inter']">no.</th>
                  <th className="text-left align-middle text-[10px] tracking-[0.12em] uppercase text-[#F6E9E9]/40 font-normal px-2 py-3 font-['Inter']">client</th>
                  <th className="text-left align-middle text-[10px] tracking-[0.12em] uppercase text-[#F6E9E9]/40 font-normal px-2 py-3 font-['Inter']">types</th>
                  <th className="text-left align-middle text-[10px] tracking-[0.12em] uppercase text-[#F6E9E9]/40 font-normal px-2 py-3 font-['Inter']">assigned</th>
                  <th className="text-left align-middle text-[10px] tracking-[0.12em] uppercase text-[#F6E9E9]/40 font-normal px-2 py-3 font-['Inter']">{isPendingPaymentView ? 'Balance' : 'Emp.Pay'}</th>
                  <th className="text-left align-middle text-[10px] tracking-[0.12em] uppercase text-[#F6E9E9]/40 font-normal px-2 py-3 font-['Inter']">price</th>
                  <th className="text-left align-middle text-[10px] tracking-[0.12em] uppercase text-[#F6E9E9]/40 font-normal px-2 py-3 font-['Inter']">deadline</th>
                  <th className="text-left align-middle text-[10px] tracking-[0.12em] uppercase text-[#F6E9E9]/40 font-normal px-2 py-3 font-['Inter']">status</th>
                  <th className="text-left align-middle text-[10px] tracking-[0.12em] uppercase text-[#F6E9E9]/40 font-normal px-2 py-3 font-['Inter']">actions</th>
            </tr>
          </thead>
          <tbody>
                {paginatedProjects.map((project) => (
                  <tr key={project.id} className="border-b border-[#E16428]/08 hover:bg-[#E16428]/5 transition-colors duration-200 text-xs">
                    <td className="px-2 py-3 align-middle font-mono font-semibold text-[#E16428] truncate">{project.projectId}</td>
                    <td className="px-2 py-2.5 align-middle min-w-0">
                  <div className="min-w-0">
                        <p className="text-[#F6E9E9] font-medium font-['Inter'] text-xs truncate">{project.clientName}</p>
                        <p className="text-[#F6E9E9]/70 text-[10px] truncate">{project.clientUniOrg}</p>
                  </div>
                </td>
                    <td className="px-2 py-2.5 align-middle min-w-0">
                      <div className="min-w-0 truncate">
                        {renderTypeSlideshow(project, "text-[#F6E9E9] font-['Inter'] text-xs truncate")}
                        {project.fastDeliver && (
                          <span className="inline-block mt-0.5 text-[10px] text-[#E16428]">⚡ fast</span>
                        )}
                      </div>
                </td>
                    <td className="px-2 py-2.5 align-middle min-w-0 truncate">
                      {renderEmployeeSlideshow(project, "text-[#F6E9E9] font-['Inter'] text-xs truncate")}
                </td>
                    <td className="px-2 py-2.5 align-middle min-w-0">
                      {isPendingPaymentView ? (
                        <span className="flex items-center gap-1 font-medium text-yellow-400 truncate text-xs">
                          LKR {(project.balance ?? 0).toLocaleString()}
                        </span>
                      ) : (
                        renderPaymentSlideshow(project)
                      )}
                </td>
                    <td className="px-2 py-2.5 align-middle min-w-0">
                      <span className="text-[#E16428] font-bold font-['Inter'] text-xs truncate block">
                        LKR {project.price.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 align-middle min-w-0">
                      <div className="flex items-center gap-1 text-xs min-w-0">
                        <Calendar className="w-3.5 h-3.5 text-[#F6E9E9]/70 shrink-0" />
                        <span className="truncate">{renderDeadlineSlideshow(project, "font-['Inter'] truncate")}</span>
                      </div>
                </td>
                    <td className="px-2 py-2.5 align-middle min-w-0">
                  <select
                    value={project.status}
                    onChange={(e) => handleStatusChange(project.id, e.target.value as Project['status'])}
                    className={`max-w-full px-0 py-1 rounded-none text-[10px] font-medium bg-transparent border-0 border-t-0 border-l-0 border-r-0 border-b border-solid cursor-pointer focus:outline-none focus:ring-0 focus:shadow-none appearance-none ${getStatusColor(project.status)}`}
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status} className="bg-[#272121] text-[#F6E9E9]">
                            {status.toLowerCase()}
                      </option>
                    ))}
                  </select>
                </td>
                    <td className="px-2 py-3 align-middle">
                      <div className="flex gap-2 items-center">
                    <button
                      onClick={() => onEdit(project)}
                      className="p-1 text-[#E16428]/70 border-0 border-b border-transparent hover:border-[#E16428] hover:text-[#E16428] transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                          onClick={() => handleDeleteClick(project)}
                      className="p-1 text-red-400/70 border-0 border-b border-transparent hover:border-red-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                        <button
                          onClick={() => setReceiptProject(project)}
                          className="p-1 text-blue-400/70 border-0 border-b border-transparent hover:border-blue-400 hover:text-blue-400 transition-colors"
                          title="Download or share receipt"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
          </div>
      </div>
    </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && deletingProject && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
          onClick={handleCancelDelete}
        >
          <div
            className="w-full max-w-[280px] p-6 animate-scaleIn text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative mx-auto mb-5 h-[4.5rem] w-[4.5rem]">
              <span
                className="absolute inset-0 rounded-full border border-red-400/25 opacity-60"
                style={{ animation: 'delete-ring 2.4s ease-out infinite' }}
              />
              <span
                className="absolute inset-2 rounded-full border border-[#E16428]/20 opacity-50"
                style={{ animation: 'delete-ring 2.4s ease-out 0.6s infinite' }}
              />
              <div className="relative flex h-full w-full items-center justify-center rounded-full border border-red-400/40 bg-gradient-to-br from-red-500/15 to-transparent">
                <Trash2
                  className="h-6 w-6 text-red-400"
                  style={{ animation: 'delete-icon 2.8s ease-in-out infinite' }}
                />
              </div>
            </div>

            <h3 className="text-2xl font-semibold tracking-tight text-[#F6E9E9] font-['Playfair_Display']">
              Delete project?
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#F6E9E9]/55 font-['Inter']">
              Remove work for{' '}
              <span className="text-[#E16428] font-medium">{deletingProject.clientName}</span>
              {deletingProject.projectId ? (
                <>
                  {' '}
                  <span className="text-[#F6E9E9]/35">· {deletingProject.projectId}</span>
                </>
              ) : null}
              . This can’t be undone.
            </p>

            <div className="mt-6 space-y-2.5">
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="group w-full flex items-center justify-center gap-2 py-3 border-0 border-b-2 border-red-500/70 rounded-none bg-transparent text-sm font-semibold text-red-400 hover:text-red-300 hover:border-red-400 transition-all duration-200 font-['Inter'] focus:outline-none"
              >
                <Trash2 className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
                <span>Yes, delete</span>
              </button>
              <button
                type="button"
                onClick={handleCancelDelete}
                className="w-full py-2.5 border-0 border-b border-transparent rounded-none bg-transparent text-sm text-[#F6E9E9]/50 hover:text-[#F6E9E9] hover:border-[#F6E9E9]/25 transition-all duration-200 font-['Inter'] focus:outline-none"
              >
                Keep project
              </button>
            </div>

            <p className="mt-5 text-[10px] tracking-[0.18em] uppercase text-[#F6E9E9]/25 font-['Inter']">
              Esc to keep · Enter to delete
            </p>

            <style>{`
              @keyframes delete-ring {
                0% { transform: scale(0.85); opacity: 0.55; }
                70% { transform: scale(1.25); opacity: 0; }
                100% { transform: scale(1.25); opacity: 0; }
              }
              @keyframes delete-icon {
                0%, 100% { transform: scale(1) rotate(0deg); }
                50% { transform: scale(1.08) rotate(-6deg); }
              }
            `}</style>
          </div>
        </div>
      )}

      {receiptProject && (
        <ProjectReceiptModal
          project={receiptProject}
          projectTypes={projectTypes}
          onClose={() => setReceiptProject(null)}
        />
      )}

      {paymentConfirmationProject && (
        <PaymentConfirmationModal
          project={paymentConfirmationProject}
          remainingBalance={
            paymentConfirmationProject.price -
            paymentConfirmationProject.advance -
            (paymentConfirmationProject.giveDiscount
              ? paymentConfirmationProject.discountAmount || 0
              : 0)
          }
          onConfirm={handlePaymentConfirmation}
          onCancel={() => setPaymentConfirmationProject(null)}
        />
      )}

      {employeePaymentEdit && (
        <EmployeePaymentModal
          projectId={employeePaymentEdit.project.projectId}
          clientName={employeePaymentEdit.project.clientName}
          employeeName={employeePaymentEdit.employeeName}
          payment={employeePaymentEdit.payment}
          onConfirm={handleEmployeePaymentConfirm}
          onCancel={() => setEmployeePaymentEdit(null)}
        />
      )}
    </>
  );
};