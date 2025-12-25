import React, { useState, useEffect, useRef } from 'react';
import { Plus, Calendar, Loader2, Clock, ArrowUp, CalendarDays, ChevronDown, List, PlayCircle, Hourglass, CreditCard, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Project, Employee } from '../types';
import { ProjectModal } from './ProjectModal';
import { ProjectTable } from './ProjectTable';
import { useProjects } from '../hooks/useProjects';
import { ProjectReceiptModal } from './ProjectReceiptModal';
import { PaymentConfirmationModal } from './PaymentConfirmationModal';
import { supabase } from '../supabaseClient';
import { useMobileNotifications } from '../hooks/useMobileNotifications';

interface ProjectManagementProps {
  employees: Employee[];
}

export const ProjectManagement: React.FC<ProjectManagementProps> = ({
  employees,
}) => {
  const { projects, loading, error, addProject, updateProject, deleteProject } = useProjects();
  const { showNotification } = useMobileNotifications();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [nextProjectId, setNextProjectId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'deadline-asc' | 'deadline-desc' | 'projectId-asc' | 'projectId-desc'>('deadline-asc');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [receiptProject, setReceiptProject] = useState<Project | null>(null);
  const [paymentConfirmationProject, setPaymentConfirmationProject] = useState<Project | null>(null);
  const [projectTypes, setProjectTypes] = useState<{ id: string; name: string }[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);

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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, receiptProject, confirmDeleteId, paymentConfirmationProject]);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      if (scrollContainerRef.current.scrollTop > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    }
  };

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

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
  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y--) {
    years.push(y);
  }

  useEffect(() => {
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
    return created.getMonth() === selectedMonth && created.getFullYear() === selectedYear;
  });
  if (search.trim()) {
    const searchLower = search.trim().toLowerCase();
    filteredProjects = filteredProjects.filter(project => {
      const employee = employees.find(emp => emp.id === project.assignedTo);
      const employeeName = employee ? `${employee.firstName} ${employee.lastName}`.toLowerCase() : '';
      return (
        (project.clientName && project.clientName.toLowerCase().includes(searchLower)) ||
        (project.clientUniOrg && project.clientUniOrg.toLowerCase().includes(searchLower)) ||
        (project.projectId && project.projectId.toLowerCase().includes(searchLower)) ||
        employeeName.includes(searchLower)
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

  const handleSave = async (projectData: Omit<Project, 'id'>) => {
    const previousError = error;
    if (editingProject && editingProject.id) {
      await updateProject(editingProject.id, projectData);
      // Check if operation succeeded (no new error)
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
      await addProject(projectData);
      // Check if operation succeeded
      setTimeout(() => {
        if (!error || error === previousError) {
          showNotification(`Project ${projectData.projectId} added successfully`, 'success', {
            title: 'Manager Pro',
            icon: '/app.png'
          });
        } else {
          showNotification(`Failed to add project ${projectData.projectId}`, 'error', {
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
        const remainingBalance = project.price - project.advance;
        
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

  const handlePaymentConfirmation = async (customAmount?: number) => {
    if (paymentConfirmationProject) {
      const previousError = error;
      if (customAmount !== undefined) {
        // Partial payment - add custom amount to existing advance
        const newAdvance = paymentConfirmationProject.advance + customAmount;
        const newBalance = paymentConfirmationProject.price - newAdvance;
        // If there's still a balance remaining, set status to "Pending Payment"
        const finalStatus = newBalance > 0 ? 'Pending Payment' : 'Delivered';
        await updateProject(paymentConfirmationProject.id, { 
          status: finalStatus,
          advance: newAdvance,
          balance: newBalance
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
        // Full payment - advance becomes equal to price, balance becomes 0
        await updateProject(paymentConfirmationProject.id, { 
          status: 'Delivered',
          advance: paymentConfirmationProject.price,
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
      className="space-y-3 sm:space-y-6 animate-fadeIn overflow-y-auto sm:overflow-hidden max-h-[calc(100vh-5rem)] sm:max-h-screen px-2 sm:px-0"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-3xl font-bold text-[#F6E9E9] font-['Playfair_Display']">
          Project Management
        </h1>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          {/* Month/Year Filter */}
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {/* Month Dropdown */}
            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => setMonthDropdownOpen(!monthDropdownOpen)}
                className="w-full sm:w-auto pl-9 pr-9 py-2 bg-[#272121]/70 border border-[#E16428]/30 rounded-lg text-[#F6E9E9] focus:outline-none focus:border-[#E16428] font-['Inter'] transition-all duration-200 hover:border-[#E16428] focus:ring-2 focus:ring-[#E16428]/30 sm:text-sm text-xs flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#E16428]" />
                  <span>{new Date(0, selectedMonth).toLocaleString('default', { month: 'long' })}</span>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${monthDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {monthDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMonthDropdownOpen(false)} />
                  <div className="absolute z-20 mt-1 w-full bg-[#272121] border border-[#E16428]/30 rounded-lg shadow-lg overflow-hidden">
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
                className="w-full sm:w-auto pl-9 pr-9 py-2 bg-[#272121]/70 border border-[#E16428]/30 rounded-lg text-[#F6E9E9] focus:outline-none focus:border-[#E16428] font-['Inter'] transition-all duration-200 hover:border-[#E16428] focus:ring-2 focus:ring-[#E16428]/30 sm:text-sm text-xs flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#E16428]" />
                  <span>{selectedYear}</span>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${yearDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {yearDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setYearDropdownOpen(false)} />
                  <div className="absolute z-20 mt-1 w-full bg-[#272121] border border-[#E16428]/30 rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
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
                    {/* Search Bar */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Looking for something?"
            className="w-full sm:w-64 px-4 py-2 bg-[#272121]/70 border border-[#E16428]/30 rounded-lg text-[#F6E9E9] focus:outline-none focus:border-[#E16428] font-['Inter'] transition-all duration-200 mb-2 sm:mb-0 text-xs sm:text-sm"
            ref={searchInputRef}
          />
          {/* Sorting Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setSortBy(sortBy === 'deadline-asc' ? 'deadline-desc' : 'deadline-asc')}
              className={`w-1/2 sm:w-auto px-3 py-2 rounded-lg font-['Inter'] text-xs sm:text-sm transition-all duration-200 border border-[#E16428]/30 ${sortBy.startsWith('deadline') ? 'bg-[#E16428] text-white' : 'bg-[#272121]/50 text-[#F6E9E9]/70 hover:bg-[#E16428]/20'}`}
              title="Sort by Deadline"
            >
              <span className="sm:hidden">Dead {sortBy === 'deadline-asc' ? '↑' : '↓'}</span>
              <span className="hidden sm:inline">Deadline {sortBy === 'deadline-asc' ? 'A-Z' : 'Z-A'}</span>
            </button>
            <button
              onClick={() => setSortBy(sortBy === 'projectId-asc' ? 'projectId-desc' : 'projectId-asc')}
              className={`w-1/2 sm:w-auto px-3 py-2 rounded-lg font-['Inter'] text-xs sm:text-sm transition-all duration-200 border border-[#E16428]/30 ${sortBy.startsWith('projectId') ? 'bg-[#E16428] text-white' : 'bg-[#272121]/50 text-[#F6E9E9]/70 hover:bg-[#E16428]/20'}`}
              title="Sort by Project No."
            >
              <span className="sm:hidden">ID {sortBy === 'projectId-asc' ? '↑' : '↓'}</span>
              <span className="hidden sm:inline">Project No. {sortBy === 'projectId-asc' ? 'A-Z' : 'Z-A'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Buttons - Mobile Dropdown */}
      <div className="relative sm:hidden w-full">
        <button
          onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
          className="w-full px-4 py-2 rounded-lg bg-[#272121]/50 border border-[#E16428]/30 text-[#F6E9E9] focus:outline-none focus:border-[#E16428] font-['Inter'] transition-all duration-200 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            {filter === 'all' && <List className="w-4 h-4" />}
            {filter === 'Running' && <PlayCircle className="w-4 h-4" />}
            {filter === 'Pending' && <Hourglass className="w-4 h-4" />}
            {filter === 'Pending Payment' && <CreditCard className="w-4 h-4" />}
            {filter === 'Delivered' && <CheckCircle2 className="w-4 h-4" />}
            {filter === 'Correction' && <AlertTriangle className="w-4 h-4" />}
            {filter === 'Rejected' && <XCircle className="w-4 h-4" />}
            <span>{filter === 'all' ? 'All Projects' : filter}</span>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${filterDropdownOpen ? 'rotate-180' : ''}`} />
        </button>
        {filterDropdownOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setFilterDropdownOpen(false)} />
            <div className="absolute z-20 mt-1 w-full bg-[#272121] border border-[#E16428]/30 rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
              {['all', 'Running', 'Pending', 'Pending Payment', 'Delivered', 'Correction', 'Rejected'].map((status) => {
                const getIcon = () => {
                  switch (status) {
                    case 'all':
                      return <List className="w-4 h-4" />;
                    case 'Running':
                      return <PlayCircle className="w-4 h-4" />;
                    case 'Pending':
                      return <Hourglass className="w-4 h-4" />;
                    case 'Pending Payment':
                      return <CreditCard className="w-4 h-4" />;
                    case 'Delivered':
                      return <CheckCircle2 className="w-4 h-4" />;
                    case 'Correction':
                      return <AlertTriangle className="w-4 h-4" />;
                    case 'Rejected':
                      return <XCircle className="w-4 h-4" />;
                    default:
                      return null;
                  }
                };

                return (
                  <button
                    key={status}
                    onClick={() => {
                      setFilter(status);
                      setFilterDropdownOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left flex items-center gap-2 text-[#F6E9E9] hover:bg-[#E16428]/20 transition-colors"
                  >
                    {getIcon()}
                    <span>{status === 'all' ? 'All Projects' : status}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Filter Buttons - Desktop */}
      <div className="hidden sm:flex flex-wrap gap-2 sm:gap-4">
        {['all', 'Running', 'Pending', 'Pending Payment', 'Delivered', 'Correction', 'Rejected'].map((status) => {
          const getIcon = () => {
            switch (status) {
              case 'all':
                return <List className="w-4 h-4" />;
              case 'Running':
                return <PlayCircle className="w-4 h-4" />;
              case 'Pending':
                return <Hourglass className="w-4 h-4" />;
              case 'Pending Payment':
                return <CreditCard className="w-4 h-4" />;
              case 'Delivered':
                return <CheckCircle2 className="w-4 h-4" />;
              case 'Correction':
                return <AlertTriangle className="w-4 h-4" />;
              case 'Rejected':
                return <XCircle className="w-4 h-4" />;
              default:
                return null;
            }
          };

          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 sm:px-4 py-2 rounded-lg transition-all duration-300 font-['Inter'] text-xs sm:text-sm flex items-center gap-2 ${
                filter === status
                  ? 'bg-[#E16428] text-white'
                  : 'bg-[#272121]/50 text-[#F6E9E9]/70 hover:bg-[#E16428]/20'
              }`}
            >
              {getIcon()}
              <span>{status === 'all' ? 'All Projects' : status}</span>
            </button>
          );
        })}
      </div>

      {/* Content: Only show the table view, no cards or view mode toggle */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-[#F6E9E9]/70 text-lg font-['Inter'] mb-2">
            {filter === 'all' ? 'No projects found' : `No ${filter.toLowerCase()} projects`}
          </div>
          <div className="text-[#F6E9E9]/50 text-sm">
            {filter === 'all' ? 'Create your first project to get started' : 'Try changing the filter or add a new project'}
          </div>
        </div>
      ) : (
        <>
          {/* Mobile: Cute row cards */}
          <div className="block sm:hidden space-y-3 pb-16 mb-4">
            {filteredProjects.map((project) => {
              const employee = employees.find(emp => emp.id === project.assignedTo);
              const statusColors = {
                'Running': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                'Delivered': 'bg-green-500/20 text-green-300 border-green-500/30',
                'Pending': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
                'Pending Payment': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                'Correction': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
                'Rejected': 'bg-red-500/20 text-red-300 border-red-500/30'
              };
              
              return (
                <div key={project.id} className="bg-gradient-to-br from-[#232021]/90 to-[#272121]/80 rounded-2xl border border-[#E16428]/20 p-4 shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden group">
                  {/* Status indicator line */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${statusColors[project.status as keyof typeof statusColors] || 'bg-gray-500/20'}`}></div>
                  
                  {/* Header with client info and actions */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 bg-[#E16428] rounded-full"></div>
                        <h3 className="text-[#F6E9E9] font-bold text-sm truncate">{project.clientName}</h3>
                  </div>
                      <p className="text-[#F6E9E9]/60 text-xs truncate">{project.clientUniOrg}</p>
                  </div>
                    
                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 ml-2">
                      <button
                        onClick={() => handleEdit(project)}
                        className="p-2 bg-[#E16428]/20 text-[#E16428] rounded-xl hover:bg-[#E16428]/30 transition-all duration-200 hover:scale-110"
                        title="Edit Project"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setReceiptProject(project)}
                        className="p-2 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 transition-all duration-200 hover:scale-110"
                        title="View Receipt"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(project.id)}
                        className="p-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-all duration-200 hover:scale-110"
                        title="Delete Project"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
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
                          {type ? `${type.name} (${project.projectId})` : `${typeId.trim()} (${project.projectId})`}
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
                        <p className="text-[#F6E9E9] text-sm font-medium truncate">
                          {employee ? `${employee.firstName} ${employee.lastName}` : 'Unassigned'}
                        </p>
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
                        <p className="text-[#F6E9E9] text-sm font-medium">
                          {new Date(project.deadlineDate).toLocaleDateString()}
                        </p>
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
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${(filter === 'Pending Payment') ? 'bg-yellow-500/20' : (project.paymentOfEmp < 0 ? 'bg-yellow-500/20' : 'bg-green-500/20')}`}>
                        <svg className={`w-4 h-4 ${(filter === 'Pending Payment') ? 'text-yellow-400' : (project.paymentOfEmp < 0 ? 'text-yellow-400' : 'text-green-400')}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[#F6E9E9]/60 text-xs">{filter === 'Pending Payment' ? 'Balance' : 'Emp.Payment'}</p>
                        <p className={`text-sm font-medium ${(filter === 'Pending Payment') ? 'text-yellow-400' : (project.paymentOfEmp < 0 ? 'text-yellow-400' : 'text-green-400')}`}>
                          {filter === 'Pending Payment' ? (
                            <>LKR {(project.balance ?? 0).toLocaleString()}</>
                          ) : (
                            <>LKR {project.paymentOfEmp.toLocaleString()}</>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Status selector */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[#E16428] rounded-full"></div>
                      <span className="text-[#F6E9E9]/60 text-xs">Status</span>
                    </div>
                    <select
                      value={project.status}
                      onChange={(e) => handleStatusChange(project.id, e.target.value as Project['status'])}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border bg-transparent cursor-pointer transition-all duration-200 hover:scale-105 ${statusColors[project.status as keyof typeof statusColors] || 'bg-gray-500/20 text-gray-300 border-gray-500/30'}`}
                    >
                      {['Running', 'Pending', 'Pending Payment', 'Delivered', 'Correction', 'Rejected'].map((status) => (
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
          {/* Desktop/tablet: Table view */}
          <div className="hidden sm:block">
            <ProjectTable
              projects={filteredProjects}
              employees={employees}
              onEdit={handleEdit}
              onDelete={handleDelete}
            onUpdateStatus={(id, updates) => updateProject(id, updates)}
            viewFilter={filter}
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
          {/* Delete Confirmation Modal (mobile and desktop) */}
          {confirmDeleteId && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
              <div className="bg-[#272121] rounded-2xl p-6 max-w-md w-full mx-4 border border-[#E16428]/20 shadow-2xl animate-scaleIn">
                <div className="text-center">
                  {/* Warning Icon */}
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                    <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
                    </svg>
                  </div>
                  {/* Title */}
                  <h3 className="text-xl font-bold text-[#F6E9E9] mb-2 font-['Poppins']">
                    delete project?
                  </h3>
                  {/* Message */}
                  <p className="text-[#F6E9E9]/70 mb-6 font-['Inter']">
                    are you sure you want to delete this project?
                    <br />
                    <span className="text-xs text-[#F6E9E9]/50">
                      this action cannot be undone.
                    </span>
                  </p>
                  {/* Buttons */}
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="flex-1 px-4 py-3 bg-[#363333] text-[#F6E9E9] rounded-lg hover:bg-[#363333]/80 transition-all duration-300 font-['Poppins']"
                    >
                      cancel
                    </button>
                    <button
                      onClick={() => { handleDelete(confirmDeleteId); setConfirmDeleteId(null); }}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:scale-105 transition-all duration-300 shadow-lg font-['Poppins']"
                    >
                      delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
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
          remainingBalance={paymentConfirmationProject.price - paymentConfirmationProject.advance}
          onConfirm={handlePaymentConfirmation}
          onCancel={handlePaymentCancel}
        />
      )}

      <button
        onClick={scrollToTop}
        className={`fixed bottom-6 left-6 bg-gradient-to-r from-[#E16428] to-[#E16428]/80 text-white w-12 h-12 min-w-[3rem] min-h-[3rem] aspect-square rounded-full flex items-center justify-center shadow-lg hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#E16428] focus:ring-offset-[#272121] transition-all duration-300 z-40 sm:hidden p-0 ${
          showScrollTop 
            ? 'opacity-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-label="Scroll to top"
        title="Scroll to Top"
      >
        <ArrowUp className="w-6 h-6" />
      </button>



      <button
        onClick={handleAdd}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-[#E16428] to-[#E16428]/80 text-white w-12 h-12 min-w-[3rem] min-h-[3rem] aspect-square rounded-full flex items-center justify-center shadow-lg hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#E16428] focus:ring-offset-[#272121] transition-all duration-300 z-40 animate-pulse group p-0"
        aria-label="Add Project (Alt+A)"
        title="Add New Project (Alt+A)"
      >
        <Plus className="w-6 h-6" />
        {/* Shortcut indicator */}
        <div className="absolute -top-1 -right-1 bg-[#E16428] text-white text-xs px-1.5 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-mono">
          A
        </div>
      </button>
    </div>
  );
};