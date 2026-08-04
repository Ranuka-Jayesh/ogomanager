import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Calendar, Loader2, ArrowUp, ArrowDown, Hash, ChevronDown, ChevronLeft, ChevronRight, List, PlayCircle, Hourglass, CreditCard, CheckCircle2, AlertTriangle, XCircle, CircleDot } from 'lucide-react';
import { Project, Employee, EmployeePayment } from '../types';
import { ProjectModal } from './ProjectModal';
import { ProjectTable } from './ProjectTable';
import { useProjectsOffline } from '../hooks/useProjectsOffline';
import { ProjectReceiptModal } from './ProjectReceiptModal';
import { PaymentConfirmationModal } from './PaymentConfirmationModal';
import { EmployeePaymentModal } from './EmployeePaymentModal';
import { MonthYearNavigator } from './MonthYearNavigator';
import { supabase } from '../supabaseClient';
import { useMobileNotifications } from '../hooks/useMobileNotifications';
import {
  buildEmployeePayment,
  getEmployeePaidAmount,
  getEmployeeRemainingAmount,
  normalizeEmployeePayment,
  totalEmployeePaymentAmount,
} from '../utils/employeePayments';

interface ProjectManagementProps {
  employees: Employee[];
}

export const ProjectManagement: React.FC<ProjectManagementProps> = ({
  employees,
}) => {
  const { 
    projects, 
    loading, 
    error, 
    addProject, 
    updateProject, 
    deleteProject,
    isOnline,
    pendingChanges,
    isSyncing,
    syncNow,
    lastSyncTime,
  } = useProjectsOffline();
  const { showNotification } = useMobileNotifications();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [nextProjectId, setNextProjectId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'deadline-asc' | 'deadline-desc' | 'projectId-asc' | 'projectId-desc'>('deadline-asc');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [receiptProject, setReceiptProject] = useState<Project | null>(null);
  const [paymentConfirmationProject, setPaymentConfirmationProject] = useState<Project | null>(null);
  const [employeePaymentEdit, setEmployeePaymentEdit] = useState<{
    project: Project;
    employeeId: string;
    employeeName: string;
    payment: EmployeePayment;
  } | null>(null);
  const [projectTypes, setProjectTypes] = useState<{ id: string; name: string }[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 7;
  
  // State for employee slideshow - tracks which employee index to show for each project
  const [employeeSlideIndex, setEmployeeSlideIndex] = useState<Record<string, number>>({});
  // State for project type slideshow - tracks which type index to show for each project
  const [typeSlideIndex, setTypeSlideIndex] = useState<Record<string, number>>({});
  // State for deadline slideshow - toggles between date and days remaining
  const [deadlineSlideIndex, setDeadlineSlideIndex] = useState<Record<string, number>>({});
  
  // State for accordion - tracks which project cards are expanded (mobile view)
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check for pending project search from sessionStorage on mount
  useEffect(() => {
    const pendingSearch = sessionStorage.getItem('pendingProjectSearch');
    const pendingMonth = sessionStorage.getItem('pendingProjectMonth');
    const pendingYear = sessionStorage.getItem('pendingProjectYear');
    
    if (pendingSearch) {
      // Clear them immediately to prevent re-triggering
      sessionStorage.removeItem('pendingProjectSearch');
      
      // Set month and year if available
      if (pendingMonth !== null) {
        const month = parseInt(pendingMonth, 10);
        if (!isNaN(month) && month >= 0 && month <= 11) {
          setSelectedMonth(month);
          sessionStorage.removeItem('pendingProjectMonth');
        }
      }
      
      if (pendingYear !== null) {
        const year = parseInt(pendingYear, 10);
        if (!isNaN(year) && year > 2000 && year < 2100) {
          setSelectedYear(year);
          sessionStorage.removeItem('pendingProjectYear');
        }
      }
      
      // Set search value after component is fully mounted
      setTimeout(() => {
        setSearch(pendingSearch);
        // Focus the search input and scroll to top
        setTimeout(() => {
          searchInputRef.current?.focus();
          scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }, 200);
      }, 100);
    }
  }, []);

  // Listen for search events from Header component (for immediate updates when already on projects page)
  useEffect(() => {
    const handleSearchProjectById = (event: Event) => {
      const customEvent = event as CustomEvent<{ projectId: string; month?: number; year?: number }>;
      if (customEvent.detail?.projectId) {
        // Set month and year if provided
        if (customEvent.detail.month !== undefined && customEvent.detail.month >= 0 && customEvent.detail.month <= 11) {
          setSelectedMonth(customEvent.detail.month);
        }
        if (customEvent.detail.year !== undefined && customEvent.detail.year > 2000 && customEvent.detail.year < 2100) {
          setSelectedYear(customEvent.detail.year);
        }
        
        // Wait a bit for the tab to switch and component to mount
        setTimeout(() => {
          setSearch(customEvent.detail.projectId);
          // Focus the search input after setting the value
          setTimeout(() => {
            searchInputRef.current?.focus();
            // Scroll to top to show the filtered results
            scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          }, 200);
        }, 300);
      }
    };

    window.addEventListener('searchProjectById', handleSearchProjectById);
    return () => window.removeEventListener('searchProjectById', handleSearchProjectById);
  }, []);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Alt + A: Open add project form
      if (e.altKey && e.key === 'a') {
        e.preventDefault();
        handleAdd();
      }

      // Alt + S: Save/Update form (only when modal is open)
      if (e.altKey && e.key === 's' && isModalOpen) {
        e.preventDefault();
        // This will be handled by the ProjectModal component
        const saveButton = document.querySelector('[data-shortcut="save"]') as HTMLButtonElement;
        if (saveButton) {
          saveButton.click();
        }
      }

      // Alt + K: Focus search bar
      if (e.altKey && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }



      // Escape: Close modals
      if (e.key === 'Escape') {
        if (isModalOpen) {
          handleModalClose();
        }
        if (receiptProject) {
          setReceiptProject(null);
        }
        if (confirmDeleteId) {
          setConfirmDeleteId(null);
        }
        if (paymentConfirmationProject) {
          setPaymentConfirmationProject(null);
        }
      }

      if (e.key === 'Enter' && confirmDeleteId && !isModalOpen) {
        e.preventDefault();
        handleDelete(confirmDeleteId);
        setConfirmDeleteId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, receiptProject, confirmDeleteId, paymentConfirmationProject]);

  // Keep projects ref updated for slideshow
  const projectsRef = useRef(projects);
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

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setShowScrollTop(el.scrollTop > 40);
  };

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

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

  useEffect(() => {
    // Only lock body scroll on desktop; mobile needs native/list scrolling
    if (typeof window === 'undefined' || window.innerWidth < 1024) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Fetch project types on mount
  useEffect(() => {
    async function fetchTypes() {
      const { data } = await supabase.from('project_types').select('*');
      if (data) setProjectTypes(data);
    }
    fetchTypes();
  }, []);

  let filteredProjects = projects.filter(project => 
    filter === 'all' || project.status === filter
  );
  filteredProjects = filteredProjects.filter(project => {
    if (!project.createdAt) return false;
    const created = new Date(project.createdAt);
    const monthOk = selectedMonth === 'all' || created.getMonth() === selectedMonth;
    const yearOk = selectedYear === 'all' || created.getFullYear() === selectedYear;
    return monthOk && yearOk;
  });
  if (search.trim()) {
    const searchLower = search.trim().toLowerCase();
    filteredProjects = filteredProjects.filter(project => {
      // Handle multiple employees - split comma-separated IDs and check all names
      let employeeNames = '';
      if (project.assignedTo) {
        const employeeIds = project.assignedTo.split(',').map(id => id.trim()).filter(Boolean);
        employeeNames = employeeIds.map(id => {
          const emp = employees.find(e => e.id === id);
          return emp ? `${emp.firstName} ${emp.lastName}`.toLowerCase() : '';
        }).join(' ');
      }
      
      // Handle project types - get type names for searching
      let projectTypeNames = '';
      if (project.projectDescription) {
        const typeIds = project.projectDescription.split(',').map(id => id.trim()).filter(Boolean);
        projectTypeNames = typeIds.map(id => {
          const type = projectTypes.find(t => t.id === id);
          return type ? type.name.toLowerCase() : '';
        }).join(' ');
      }
      
      return (
        (project.clientName && project.clientName.toLowerCase().includes(searchLower)) ||
        (project.clientUniOrg && project.clientUniOrg.toLowerCase().includes(searchLower)) ||
        (project.projectId && project.projectId.toLowerCase().includes(searchLower)) ||
        employeeNames.includes(searchLower) ||
        projectTypeNames.includes(searchLower)
      );
    });
  }

  // Sorting logic
  filteredProjects = [...filteredProjects].sort((a, b) => {
    if (sortBy === 'deadline-asc') {
      return new Date(a.deadlineDate).getTime() - new Date(b.deadlineDate).getTime();
    } else if (sortBy === 'deadline-desc') {
      return new Date(b.deadlineDate).getTime() - new Date(a.deadlineDate).getTime();
    } else if (sortBy === 'projectId-asc') {
      return a.projectId.localeCompare(b.projectId, undefined, { numeric: true });
    } else if (sortBy === 'projectId-desc') {
      return b.projectId.localeCompare(a.projectId, undefined, { numeric: true });
    }
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / recordsPerPage));
  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search, selectedMonth, selectedYear, sortBy]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

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

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    // Find the highest projectId in the current projects
    const projectIds = projects
      .map(p => p.projectId)
      .filter(pid => /^PJ\d{4,}$/.test(pid));
    let nextIdNum = 1000;
    if (projectIds.length > 0) {
      const maxNum = Math.max(
        ...projectIds.map(pid => parseInt(pid.replace('PJ', ''), 10))
      );
      nextIdNum = maxNum + 1;
    }
    const generatedProjectId = `PJ${nextIdNum}`;
    setNextProjectId(generatedProjectId);
    setEditingProject(null);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingProject(null);
  };

  const handleSave = async (
    projectData: Omit<Project, 'id'>,
    qty: number = 1,
    advanceForIds?: string[]
  ) => {
    const previousError = error;
    if (editingProject && editingProject.id) {
      await updateProject(editingProject.id, projectData);
      setTimeout(() => {
        if (!error || error === previousError) {
          showNotification(`Project ${projectData.projectId} updated successfully`, 'success', {
            title: 'Manager Pro',
            icon: '/app.png'
          });
        } else {
          showNotification(`Failed to update project ${projectData.projectId}`, 'error', {
            title: 'Manager Pro',
            icon: '/app.png'
          });
        }
      }, 100);
    } else {
      const count = Math.max(1, Math.min(50, Math.floor(qty) || 1));
      const match = projectData.projectId.match(/^PJ(\d+)$/i);
      const startNum = match ? parseInt(match[1], 10) : NaN;
      const existingIds = new Set(projects.map(p => p.projectId.toUpperCase()));

      const idsToCreate: string[] = [];
      if (!isNaN(startNum)) {
        let n = startNum;
        while (idsToCreate.length < count) {
          const candidate = `PJ${n}`;
          if (!existingIds.has(candidate.toUpperCase())) {
            idsToCreate.push(candidate);
            existingIds.add(candidate.toUpperCase());
          }
          n += 1;
          if (n > startNum + count + 1000) break;
        }
      } else {
        idsToCreate.push(projectData.projectId);
      }

      const advanceIdSet = new Set((advanceForIds || []).map(id => id.toUpperCase()));
      const discount = projectData.giveDiscount ? (projectData.discountAmount || 0) : 0;

      for (let i = 0; i < idsToCreate.length; i++) {
        const projectId = idsToCreate[i];
        const applyAdvance =
          count === 1 ||
          advanceForIds === undefined ||
          advanceIdSet.has(projectId.toUpperCase()) ||
          (advanceForIds.length > 0 &&
            idsToCreate.length === advanceForIds.length &&
            advanceIdSet.has(advanceForIds[i].toUpperCase()));

        const advance = applyAdvance ? projectData.advance : 0;
        const balance = Math.max(0, projectData.price - advance - discount);

        await addProject({
          ...projectData,
          projectId,
          advance,
          balance,
        });
      }

      const createdLabel =
        idsToCreate.length <= 3
          ? idsToCreate.join(', ')
          : `${idsToCreate[0]} … ${idsToCreate[idsToCreate.length - 1]}`;

      setTimeout(() => {
        if (!error || error === previousError) {
          showNotification(
            idsToCreate.length > 1
              ? `${idsToCreate.length} projects created (${createdLabel})`
              : `Project ${projectData.projectId} added successfully`,
            'success',
            {
              title: 'Manager Pro',
              icon: '/app.png'
            }
          );
        } else {
          showNotification(`Failed to add project(s)`, 'error', {
            title: 'Manager Pro',
            icon: '/app.png'
          });
        }
      }, 100);
    }
    handleModalClose();
  };

  const handleDelete = async (id: string) => {
    const project = projects.find(p => p.id === id);
    const previousError = error;
    await deleteProject(id);
    // Check if operation succeeded
      setTimeout(() => {
        if (project) {
          if (!error || error === previousError) {
            showNotification(`Project ${project.projectId} deleted successfully`, 'info', {
              title: 'Manager Pro',
              icon: '/app.png'
            });
          } else {
            showNotification(`Failed to delete project ${project.projectId}`, 'error', {
              title: 'Manager Pro',
              icon: '/app.png'
            });
          }
        }
      }, 100);
  };

  const handleStatusChange = (projectId: string, newStatus: Project['status']) => {
    // If changing to "Delivered", check for remaining balance
    if (newStatus === 'Delivered') {
      const project = projects.find(p => p.id === projectId);
      if (project) {
        const discount = project.giveDiscount ? (project.discountAmount || 0) : 0;
        const remainingBalance = project.price - project.advance - discount;
        
        // If there's a remaining balance, show payment confirmation
        if (remainingBalance > 0) {
          setPaymentConfirmationProject(project);
          return; // Don't update status yet, wait for confirmation
        }
      }
    }
    
    // For all other statuses or if no remaining balance, update directly
    const project = projects.find(p => p.id === projectId);
    const previousError = error;
    updateProject(projectId, { status: newStatus });
    if (project) {
      setTimeout(() => {
        if (!error || error === previousError) {
          showNotification(`Project ${project.projectId} status changed to ${newStatus}`, 'info', {
            title: 'Manager Pro',
            icon: '/app.png'
          });
        } else {
          showNotification(`Failed to update project ${project.projectId} status`, 'error', {
            title: 'Manager Pro',
            icon: '/app.png'
          });
        }
      }, 100);
    }
  };

  /** Open employee payment modal (full / partial / return) */
  const openEmployeePaymentModal = (project: Project, employeeId: string) => {
    if (!employeeId) return;
    const employeeIds = project.assignedTo
      ? project.assignedTo.split(',').map(id => id.trim()).filter(Boolean)
      : [];
    if (!employeeIds.includes(employeeId)) return;

    const existing = project.employeePayments?.find(ep => ep.employeeId === employeeId);
    const payment =
      normalizeEmployeePayment(existing) ||
      buildEmployeePayment(
        employeeId,
        employeeIds.length === 1 ? Math.abs(project.paymentOfEmp || 0) : 0,
        0
      );

    const emp = employees.find(e => e.id === employeeId);
    setEmployeePaymentEdit({
      project,
      employeeId,
      employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Employee',
      payment,
    });
  };

  const handleEmployeePaymentConfirm = (nextPayment: EmployeePayment) => {
    if (!employeePaymentEdit) return;
    const { project, employeeId } = employeePaymentEdit;
    const employeeIds = project.assignedTo
      ? project.assignedTo.split(',').map(id => id.trim()).filter(Boolean)
      : [];

    const nextPayments = employeeIds.map(id => {
      if (id === employeeId) return nextPayment;
      const found = project.employeePayments?.find(ep => ep.employeeId === id);
      return (
        normalizeEmployeePayment(found) ||
        buildEmployeePayment(
          id,
          employeeIds.length === 1 ? Math.abs(project.paymentOfEmp || 0) : 0,
          0
        )
      );
    });

    updateProject(project.id, {
      assignedTo: employeeIds.join(','),
      employeePayments: nextPayments,
      paymentOfEmp: totalEmployeePaymentAmount(nextPayments),
    });

    showNotification(
      `Employee payment updated for ${project.projectId}`,
      'info',
      { title: 'Manager Pro', icon: '/app.png' }
    );
    setEmployeePaymentEdit(null);
  };

  const handlePaymentConfirmation = async (customAmount?: number) => {
    if (paymentConfirmationProject) {
      const previousError = error;
      if (customAmount !== undefined) {
        // Partial payment - add custom amount to existing advance
        const discount = paymentConfirmationProject.giveDiscount
          ? (paymentConfirmationProject.discountAmount || 0)
          : 0;
        const newAdvance = paymentConfirmationProject.advance + customAmount;
        const newBalance = paymentConfirmationProject.price - discount - newAdvance;
        // If there's still a balance remaining, set status to "Pending Payment"
        const finalStatus = newBalance > 0 ? 'Pending Payment' : 'Delivered';
        await updateProject(paymentConfirmationProject.id, { 
          status: finalStatus,
          advance: newAdvance,
          balance: Math.max(0, newBalance)
        });
        setTimeout(() => {
          if (!error || error === previousError) {
            showNotification(`Payment of LKR ${customAmount.toFixed(2)} recorded for project ${paymentConfirmationProject.projectId}`, 'success', {
              title: 'Manager Pro',
              icon: '/app.png'
            });
          } else {
            showNotification(`Failed to record payment for project ${paymentConfirmationProject.projectId}`, 'error', {
              title: 'Manager Pro',
              icon: '/app.png'
            });
          }
        }, 100);
      } else {
        // Full payment - advance matches effective price (after discount), balance 0
        const discount = paymentConfirmationProject.giveDiscount
          ? (paymentConfirmationProject.discountAmount || 0)
          : 0;
        const effectivePrice = paymentConfirmationProject.price - discount;
        await updateProject(paymentConfirmationProject.id, { 
          status: 'Delivered',
          advance: effectivePrice,
          balance: 0
        });
        setTimeout(() => {
          if (!error || error === previousError) {
            showNotification(`Full payment received for project ${paymentConfirmationProject.projectId}`, 'success', {
              title: 'Manager Pro',
              icon: '/app.png'
            });
          } else {
            showNotification(`Failed to record payment for project ${paymentConfirmationProject.projectId}`, 'error', {
              title: 'Manager Pro',
              icon: '/app.png'
            });
          }
        }, 100);
      }
      setPaymentConfirmationProject(null);
    }
  };

  const handlePaymentCancel = () => {
    setPaymentConfirmationProject(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-3 text-[#F6E9E9]">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-lg font-['Inter']">Loading projects...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-red-400 text-lg font-['Inter'] mb-2">Error loading projects</div>
          <div className="text-[#F6E9E9]/70 text-sm">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-[#E16428] text-white rounded-lg hover:bg-[#E16428]/80 transition-all duration-300"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex flex-col gap-3 sm:gap-4 w-full min-w-0 h-[calc(100dvh-4.75rem)] sm:h-[calc(100dvh-5.75rem)] lg:h-auto lg:max-h-none overflow-y-auto lg:overflow-visible overscroll-contain animate-fadeIn pb-24"
    >
      <div className="flex flex-col gap-3 shrink-0 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold text-[#F6E9E9] font-['Playfair_Display'] shrink-0">
            Project Management
          </h1>
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 w-full sm:w-auto min-w-0">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Looking for something?"
              className="project-search-input order-2 sm:order-1 w-full sm:w-64 px-0 py-2.5 sm:py-2 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] font-['Inter'] text-sm placeholder-[#F6E9E9]/35"
              ref={searchInputRef}
            />

            <div className="order-1 sm:order-2 w-full sm:w-auto">
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

            <div className="order-3 flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setSortBy(sortBy === 'deadline-asc' ? 'deadline-desc' : 'deadline-asc')}
                className={`flex-1 sm:flex-none h-11 sm:h-9 sm:w-9 flex items-center justify-center gap-1.5 sm:gap-0.5 rounded-xl sm:rounded-lg transition-all duration-200 border border-[#E16428]/30 ${
                  sortBy.startsWith('deadline')
                    ? 'bg-[#E16428] text-white'
                    : 'bg-[#272121]/50 text-[#F6E9E9]/70 hover:bg-[#E16428]/20'
                }`}
                title={sortBy === 'deadline-asc' ? 'Deadline: earliest first' : sortBy === 'deadline-desc' ? 'Deadline: latest first' : 'Sort by Deadline'}
                aria-label="Sort by deadline"
              >
                <Calendar className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                {sortBy === 'deadline-desc' ? (
                  <ArrowDown className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                ) : (
                  <ArrowUp className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setSortBy(sortBy === 'projectId-asc' ? 'projectId-desc' : 'projectId-asc')}
                className={`flex-1 sm:flex-none h-11 sm:h-9 sm:w-9 flex items-center justify-center gap-1.5 sm:gap-0.5 rounded-xl sm:rounded-lg transition-all duration-200 border border-[#E16428]/30 ${
                  sortBy.startsWith('projectId')
                    ? 'bg-[#E16428] text-white'
                    : 'bg-[#272121]/50 text-[#F6E9E9]/70 hover:bg-[#E16428]/20'
                }`}
                title={sortBy === 'projectId-asc' ? 'Project No.: A–Z' : sortBy === 'projectId-desc' ? 'Project No.: Z–A' : 'Sort by Project No.'}
                aria-label="Sort by project number"
              >
                <Hash className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                {sortBy === 'projectId-desc' ? (
                  <ArrowDown className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                ) : (
                  <ArrowUp className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                )}
              </button>
            </div>
          </div>
        </div>

      {/* Filter Buttons - Mobile Icon Tabs (1:1) */}
      <div className="grid grid-cols-7 gap-1 sm:hidden w-full">
        {([
          { status: 'all' as const, activeClass: 'bg-[#E16428]/25 text-[#E16428] border-[#E16428]/50' },
          { status: 'Running' as const, activeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
          { status: 'Pending' as const, activeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
          { status: 'Pending Payment' as const, activeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
          { status: 'Delivered' as const, activeClass: 'bg-green-500/20 text-green-300 border-green-500/40' },
          { status: 'Correction' as const, activeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
          { status: 'Rejected' as const, activeClass: 'bg-red-500/20 text-red-300 border-red-500/40' },
        ]).map(({ status, activeClass }) => {
          const getIcon = () => {
            switch (status) {
              case 'all':
                return <List className="w-3.5 h-3.5" />;
              case 'Running':
                return <PlayCircle className="w-3.5 h-3.5" />;
              case 'Pending':
                return <Hourglass className="w-3.5 h-3.5" />;
              case 'Pending Payment':
                return <CreditCard className="w-3.5 h-3.5" />;
              case 'Delivered':
                return <CheckCircle2 className="w-3.5 h-3.5" />;
              case 'Correction':
                return <AlertTriangle className="w-3.5 h-3.5" />;
              case 'Rejected':
                return <XCircle className="w-3.5 h-3.5" />;
              default:
                return null;
            }
          };

          const label = status === 'all' ? 'All Projects' : status;
          const active = filter === status;

          return (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              title={label}
              aria-label={label}
              aria-pressed={active}
              className={`aspect-square w-full p-0 flex items-center justify-center rounded-md border box-border transition-all duration-200 ${
                active
                  ? activeClass
                  : 'bg-[#272121]/50 text-[#F6E9E9]/70 border-[#E16428]/30 hover:bg-[#E16428]/20'
              }`}
            >
              {getIcon()}
            </button>
          );
        })}
      </div>

      {/* Filter Buttons - Desktop + pagination */}
      <div className="hidden sm:flex items-center justify-between gap-3 min-w-0">
        <div className="flex flex-wrap gap-1.5 md:gap-2 min-w-0 flex-1">
        {['all', 'Running', 'Pending', 'Pending Payment', 'Delivered', 'Correction', 'Rejected'].map((status) => {
          const getIcon = () => {
            switch (status) {
              case 'all':
                return <List className="w-3.5 h-3.5 shrink-0" />;
              case 'Running':
                return <PlayCircle className="w-3.5 h-3.5 shrink-0" />;
              case 'Pending':
                return <Hourglass className="w-3.5 h-3.5 shrink-0" />;
              case 'Pending Payment':
                return <CreditCard className="w-3.5 h-3.5 shrink-0" />;
              case 'Delivered':
                return <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />;
              case 'Correction':
                return <AlertTriangle className="w-3.5 h-3.5 shrink-0" />;
              case 'Rejected':
                return <XCircle className="w-3.5 h-3.5 shrink-0" />;
              default:
                return null;
            }
          };

          const shortLabel =
            status === 'all' ? 'All' :
            status === 'Pending Payment' ? 'Payment' :
            status;

          const active = filter === status;
          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-2.5 md:px-3 py-1.5 md:py-2 rounded-none bg-transparent border-0 border-b-2 transition-colors font-['Inter'] text-xs flex items-center gap-1.5 shrink-0 ${
                active
                  ? 'border-[#E16428] text-[#E16428]'
                  : 'border-transparent text-[#F6E9E9]/70 hover:text-[#E16428]'
              }`}
            >
              {getIcon()}
              <span className="lg:hidden">{shortLabel}</span>
              <span className="hidden lg:inline">{status === 'all' ? 'All Projects' : status}</span>
            </button>
          );
        })}
        </div>

        {filteredProjects.length > 0 && totalPages > 1 && (
          <div className="hidden lg:flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label="Previous page"
              title="Previous page"
              className={`w-8 h-8 flex items-center justify-center rounded-lg bg-[#272121]/60 text-[#F6E9E9]/80 border border-[#E16428]/20 transition-all ${
                currentPage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#E16428]/20 hover:text-[#E16428]'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[#F6E9E9]/60 text-xs font-['Inter'] whitespace-nowrap tabular-nums px-1">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              aria-label="Next page"
              title="Next page"
              className={`w-8 h-8 flex items-center justify-center rounded-lg bg-[#272121]/60 text-[#F6E9E9]/80 border border-[#E16428]/20 transition-all ${
                currentPage === totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#E16428]/20 hover:text-[#E16428]'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      </div>

      {/* Content */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12 flex-1 min-h-0">
          <div className="text-[#F6E9E9]/70 text-lg font-['Inter'] mb-2">
            {filter === 'all' ? 'No projects found' : `No ${filter.toLowerCase()} projects`}
          </div>
          <div className="text-[#F6E9E9]/50 text-sm">
            {filter === 'all' ? 'Create your first project to get started' : 'Try changing the filter or add a new project'}
          </div>
        </div>
      ) : (
        <div className="min-w-0 flex flex-col lg:block pb-28 lg:pb-0">
          {/* Mobile: Cute row cards */}
          <div className="block lg:hidden space-y-3">
            {filteredProjects.map((project) => {
              // Handle multiple employees - split comma-separated IDs (includes payment info)
              const getEmployeeSlideshow = () => {
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
                const names = employeeIds.map(id => {
                  const emp = employees.find(e => e.id === id);
                  return emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown';
                });
                const currentIndex = employeeSlideIndex[project.id] || 0;
                const payments = employeeIds.map(id => {
                  if (project.employeePayments && project.employeePayments.length > 0) {
                    const empPayment = project.employeePayments.find(ep => ep.employeeId === id);
                    const normalized = normalizeEmployeePayment(empPayment);
                    if (!normalized) return 0;
                    return Math.abs(normalized.amount ?? normalized.payment ?? 0);
                  }
                  if (employeeIds.length === 1) {
                    return Math.abs(project.paymentOfEmp);
                  }
                  return 0;
                });
                const paidAmounts = employeeIds.map(id => {
                  if (project.employeePayments && project.employeePayments.length > 0) {
                    const empPayment = project.employeePayments.find(ep => ep.employeeId === id);
                    return getEmployeePaidAmount(normalizeEmployeePayment(empPayment));
                  }
                  return 0;
                });
                const statuses = employeeIds.map(id => {
                  if (project.employeePayments && project.employeePayments.length > 0) {
                    const empPayment = project.employeePayments.find(ep => ep.employeeId === id);
                    const normalized = normalizeEmployeePayment(empPayment);
                    return normalized?.status || ('pending' as const);
                  }
                  return project.paymentOfEmp < 0 ? 'pending' as const : 'paid' as const;
                });
                return { names, employeeIds, payments, paidAmounts, statuses, count: names.length, currentIndex };
              };
              const {
                names: empNames,
                employeeIds: empIds,
                payments: empPayments,
                paidAmounts: empPaidAmounts,
                statuses: empStatuses,
                count: empCount,
                currentIndex: empCurrentIndex,
              } = getEmployeeSlideshow();
              const currentEmpPayment = empPayments?.[empCurrentIndex] || 0;
              const currentEmpPaid = empPaidAmounts?.[empCurrentIndex] || 0;
              const currentEmpRemaining = Math.max(0, currentEmpPayment - currentEmpPaid);
              const currentEmpStatus = empStatuses?.[empCurrentIndex] || 'pending';
              const currentEmpId = empIds?.[empCurrentIndex] || '';
              const currentEmpColor =
                currentEmpStatus === 'paid'
                  ? 'text-green-400'
                  : currentEmpStatus === 'partial'
                  ? 'text-blue-400'
                  : 'text-yellow-400';
              const paymentBalanceSlide = deadlineSlideIndex[project.id] || 0;
              const showEmpBalance = paymentBalanceSlide === 1 && filter !== 'Pending Payment';
              const empPayLabel = showEmpBalance ? 'Balance' : 'Emp.Payment';
              const empPayValue = showEmpBalance ? currentEmpRemaining : currentEmpPayment;
              const empPayColor = showEmpBalance
                ? currentEmpRemaining > 0
                  ? 'text-yellow-400'
                  : 'text-green-400'
                : currentEmpColor;
              
              // Handle multiple project types slideshow
              const getTypeSlideshow = () => {
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
              const { names: typeNames, count: typeCount, currentIndex: typeCurrentIndex } = getTypeSlideshow();
              
              const statusColors = {
                'Running': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                'Delivered': 'bg-green-500/20 text-green-300 border-green-500/30',
                'Pending': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
                'Pending Payment': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                'Correction': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
                'Rejected': 'bg-red-500/20 text-red-300 border-red-500/30'
              };
              
              const isExpanded = expandedCards[project.id] || false;
              
              return (
                <div key={project.id} className="bg-gradient-to-br from-[#232021]/90 to-[#272121]/80 rounded-2xl border border-[#E16428]/20 shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                  {/* Status indicator line */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${statusColors[project.status as keyof typeof statusColors] || 'bg-gray-500/20'}`}></div>
                  
                  {/* Accordion Header - Always visible */}
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedCards(prev => ({ ...prev, [project.id]: !prev[project.id] }))}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Project ID */}
                        <span className="bg-[#E16428]/20 text-[#E16428] px-2.5 py-1 rounded-lg text-xs font-bold flex-shrink-0">
                          {project.projectId}
                        </span>
                        
                        {/* Client Name */}
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[#F6E9E9] font-bold text-sm truncate">{project.clientName}</h3>
                          <p className="text-[#F6E9E9]/50 text-xs truncate">{project.clientUniOrg}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-2">
                        {/* Status Badge */}
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium border ${statusColors[project.status as keyof typeof statusColors] || 'bg-gray-500/20 text-gray-300 border-gray-500/30'}`}>
                          {project.status}
                        </span>
                        
                        {/* Fast Delivery indicator */}
                        {project.fastDeliver && (
                          <span className="bg-yellow-500/20 text-yellow-400 p-1.5 rounded-lg">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          </span>
                        )}
                        {/* Discount indicator */}
                        {project.giveDiscount && (
                          <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-1 rounded-lg text-[10px] font-semibold">
                            -{((project.discountAmount || 0)).toLocaleString()}
                          </span>
                        )}
                        
                        {/* Expand/Collapse Icon */}
                        <ChevronDown 
                          className={`w-5 h-5 text-[#F6E9E9]/60 transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isExpanded ? 'rotate-180' : ''}`} 
                        />
                      </div>
                    </div>
                    
                    {/* Quick Info Row - visible when collapsed */}
                    {!isExpanded && (
                      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[#E16428]/10">
                        {/* Project Type Slideshow */}
                        {typeCount === 1 ? (
                          <span className="bg-[#E16428]/15 text-[#E16428] px-2 py-0.5 rounded-lg text-[10px] font-medium truncate max-w-[80px]">
                            {typeNames[0]}
                          </span>
                        ) : (
                          <div className="relative overflow-hidden">
                            <span 
                              key={`${project.id}-type-collapsed-${typeCurrentIndex}`}
                              className="bg-[#E16428]/15 text-[#E16428] px-2 py-0.5 rounded-lg text-[10px] font-medium animate-slideSwap block truncate max-w-[80px]"
                            >
                              {typeNames[typeCurrentIndex]}
                            </span>
                          </div>
                        )}
                        <span className="text-[#E16428] text-xs font-bold">
                          LKR {project.price.toLocaleString()}
                        </span>
                        {project.status === 'Delivered' ? (
                          <span className="text-[#F6E9E9]/50 text-xs font-medium">
                            {formatDeadline(project.deadlineDate).date}
                          </span>
                        ) : (
                          <div className="relative overflow-hidden">
                            <span 
                              key={`${project.id}-deadline-collapsed-${deadlineSlideIndex[project.id] || 0}`}
                              className={`block text-xs font-medium animate-slideSwap ${(deadlineSlideIndex[project.id] || 0) === 0 ? 'text-[#F6E9E9]/50' : formatDeadline(project.deadlineDate).color}`}
                            >
                              {(deadlineSlideIndex[project.id] || 0) === 0 
                                ? formatDeadline(project.deadlineDate).date 
                                : formatDeadline(project.deadlineDate).daysText}
                            </span>
                          </div>
                        )}
                        {empCount === 1 ? (
                          <span className="text-[#F6E9E9]/50 text-xs truncate flex-1">
                            {empNames[0]}
                          </span>
                        ) : (
                          <span className="text-[#F6E9E9]/50 text-xs">
                            {empCount} emp
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Accordion Content - Expandable */}
                  <div 
                    className={`overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}
                    style={{ transitionProperty: 'max-height, opacity' }}
                  >
                    <div className={`px-4 pb-4 space-y-3 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isExpanded ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`}>
                      {/* Project types with slideshow effect */}
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#E16428]/20 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-[#E16428]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[#F6E9E9]/60 text-xs">Project Type</p>
                          {typeCount === 1 ? (
                            <p className="text-[#E16428] text-sm font-medium truncate">
                              {typeNames[0]}
                            </p>
                          ) : (
                            <div className="relative overflow-hidden">
                              <p 
                                key={`${project.id}-type-expanded-${typeCurrentIndex}`}
                                className="text-[#E16428] text-sm font-medium truncate animate-slideSwap"
                              >
                                {typeNames[typeCurrentIndex]}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Project details grid */}
                      <div className="grid grid-cols-2 gap-3">
                        {/* Assigned To */}
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-[#E16428]/20 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-[#E16428]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[#F6E9E9]/60 text-xs">Assigned</p>
                            {empCount === 1 ? (
                              <p className="text-[#F6E9E9] text-sm font-medium truncate">
                                {empNames[0]}
                              </p>
                            ) : (
                              <div className="relative overflow-hidden">
                                <p 
                                  key={`${project.id}-${empCurrentIndex}`}
                                  className="text-[#F6E9E9] text-sm font-medium truncate animate-slideSwap"
                                >
                                  {empNames[empCurrentIndex]}
                                </p>
                              </div>
                            )}
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
                            {project.status === 'Delivered' ? (
                              <p className="text-[#F6E9E9] text-sm font-medium">
                                {formatDeadline(project.deadlineDate).date}
                              </p>
                            ) : (
                              <div className="relative overflow-hidden">
                                <span 
                                  key={`${project.id}-deadline-expanded-${deadlineSlideIndex[project.id] || 0}`}
                                  className={`block text-sm font-medium animate-slideSwap ${(deadlineSlideIndex[project.id] || 0) === 0 ? 'text-[#F6E9E9]' : formatDeadline(project.deadlineDate).color}`}
                                >
                                  {(deadlineSlideIndex[project.id] || 0) === 0 
                                    ? formatDeadline(project.deadlineDate).date 
                                    : formatDeadline(project.deadlineDate).daysText}
                                </span>
                              </div>
                            )}
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

                        {/* Employee Payment or Balance (if Pending Payment tab) */}
                        <div className="flex items-center gap-2">
                          {filter === 'Pending Payment' ? (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-yellow-500/20">
                              <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (currentEmpId) {
                                  openEmployeePaymentModal(project, currentEmpId);
                                }
                              }}
                              disabled={!currentEmpId}
                              title="Manage employee payment"
                              aria-label="Manage employee payment"
                              className={`size-8 min-w-8 min-h-8 max-w-8 max-h-8 flex-none box-border p-0 inline-flex items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
                                currentEmpStatus === 'paid'
                                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                  : currentEmpStatus === 'partial'
                                  ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                  : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                              }`}
                            >
                              {currentEmpStatus === 'paid' ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : currentEmpStatus === 'partial' ? (
                                <CircleDot className="w-4 h-4" />
                              ) : (
                                <Hourglass className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-[#F6E9E9]/60 text-xs">
                              {filter === 'Pending Payment' ? 'Balance' : empPayLabel}
                            </p>
                            <div className="text-sm font-medium relative overflow-hidden">
                              {filter === 'Pending Payment' ? (
                                <span className="text-yellow-400">LKR {(project.balance ?? 0).toLocaleString()}</span>
                              ) : (
                                <span
                                  key={`${project.id}-emppay-${empCurrentIndex}-${paymentBalanceSlide}`}
                                  className={`block animate-slideSwap ${empPayColor}`}
                                >
                                  LKR {empPayValue.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Status selector and Actions */}
                      <div className="grid grid-cols-9 gap-0.5 pt-2 border-t border-[#E16428]/10">
                        {([
                          { status: 'Running' as const, icon: PlayCircle },
                          { status: 'Pending' as const, icon: Hourglass },
                          { status: 'Pending Payment' as const, icon: CreditCard },
                          { status: 'Delivered' as const, icon: CheckCircle2 },
                          { status: 'Correction' as const, icon: AlertTriangle },
                          { status: 'Rejected' as const, icon: XCircle },
                        ]).map(({ status, icon: Icon }) => {
                          const isActive = project.status === status;
                          return (
                            <button
                              key={status}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(project.id, status);
                              }}
                              title={status}
                              aria-label={status}
                              aria-pressed={isActive}
                              className={`aspect-square w-full p-0 flex items-center justify-center rounded-md border box-border transition-all duration-200 ${
                                isActive
                                  ? statusColors[status]
                                  : 'bg-[#272121]/50 text-[#F6E9E9]/50 border-[#E16428]/15 hover:bg-[#E16428]/15 hover:text-[#F6E9E9]/80'
                              }`}
                            >
                              <Icon className="w-3 h-3 shrink-0" />
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleEdit(project); }}
                          className="aspect-square w-full p-0 flex items-center justify-center bg-[#E16428]/20 text-[#E16428] rounded-md border border-[#E16428]/30 box-border hover:bg-[#E16428]/30 transition-all duration-200"
                          title="Edit Project"
                        >
                          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setReceiptProject(project); }}
                          className="aspect-square w-full p-0 flex items-center justify-center bg-blue-500/20 text-blue-400 rounded-md border border-blue-500/30 box-border hover:bg-blue-500/30 transition-all duration-200"
                          title="View Receipt"
                        >
                          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(project.id); }}
                          className="aspect-square w-full p-0 flex items-center justify-center bg-red-500/20 text-red-400 rounded-md border border-red-500/30 box-border hover:bg-red-500/30 transition-all duration-200"
                          title="Delete Project"
                        >
                          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
              </div>
          {/* Desktop: Table view */}
          <div className="hidden lg:block min-w-0 w-full">
            <ProjectTable
              projects={paginatedProjects}
              employees={employees}
              onEdit={handleEdit}
              onDelete={handleDelete}
            onUpdateStatus={(id, updates) => updateProject(id, updates)}
            viewFilter={filter}
            disablePagination
            recordsPerPage={recordsPerPage}
            />
        </div>
          {/* Receipt Modal (mobile and desktop) */}
          {receiptProject && projectTypes.length > 0 && (
            <ProjectReceiptModal
              project={receiptProject}
              projectTypes={projectTypes}
              onClose={() => setReceiptProject(null)}
            />
          )}
          {/* Delete Confirmation Modal */}
          {confirmDeleteId && (
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
              onClick={() => setConfirmDeleteId(null)}
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
                    <svg
                      className="w-6 h-6 text-red-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ animation: 'delete-icon 2.8s ease-in-out infinite' }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                </div>

                <h3 className="text-2xl font-semibold tracking-tight text-[#F6E9E9] font-['Playfair_Display']">
                  Delete project?
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#F6E9E9]/55 font-['Inter']">
                  This removes the project for good. You can’t undo it.
                </p>

                <div className="mt-6 space-y-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      handleDelete(confirmDeleteId);
                      setConfirmDeleteId(null);
                    }}
                    className="group w-full flex items-center justify-center gap-2 py-3 border-0 border-b-2 border-red-500/70 rounded-none bg-transparent text-sm font-semibold text-red-400 hover:text-red-300 hover:border-red-400 transition-all duration-200 font-['Inter'] focus:outline-none"
                  >
                    Yes, delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
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
        </div>
      )}

      {isModalOpen && (
        <ProjectModal
          project={editingProject}
          employees={employees}
          onClose={handleModalClose}
          onSave={handleSave}
          nextProjectId={nextProjectId}
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
          onCancel={handlePaymentCancel}
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

      <button
        type="button"
        onClick={scrollToTop}
        className={`fixed bottom-6 left-6 bg-gradient-to-r from-[#E16428] to-[#E16428]/80 text-white w-12 h-12 min-w-[3rem] min-h-[3rem] aspect-square rounded-full flex items-center justify-center shadow-lg active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#E16428] focus:ring-offset-[#272121] transition-all duration-300 z-[60] lg:hidden p-0 ${
          showScrollTop 
            ? 'opacity-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-label="Scroll to top"
        title="Scroll to Top"
      >
        <ArrowUp className="w-6 h-6" />
      </button>

      {!isModalOpen &&
        createPortal(
          <div className="fixed bottom-5 sm:bottom-7 inset-x-0 z-40 flex justify-center pointer-events-none px-3">
            <div className="pointer-events-auto flex items-center rounded-full bg-[#272121]/95 backdrop-blur-md border border-[#E16428]/25 shadow-xl shadow-black/40 pl-3.5 pr-1.5 py-1 gap-0.5 animate-fadeIn">
              <button
                type="button"
                onClick={handleAdd}
                className="px-2.5 sm:px-3 py-1.5 text-[#F6E9E9] text-sm font-['Poppins'] font-semibold hover:text-[#E16428] active:scale-95 transition-all"
                aria-label="Add Project (Alt+A)"
                title="Add New Project (Alt+A)"
              >
                Add Project
              </button>
              <div className="ml-1.5 shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E16428] border-2 border-[#E16428]/80 flex items-center justify-center shadow-md">
                <Plus className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
