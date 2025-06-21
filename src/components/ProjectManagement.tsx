import React, { useState, useEffect, useRef } from 'react';
import { Plus, Calendar, Loader2, Clock, ArrowUp } from 'lucide-react';
import { Project, Employee } from '../types';
import { ProjectModal } from './ProjectModal';
import { ProjectTable } from './ProjectTable';
import { useProjects } from '../hooks/useProjects';
import { ProjectReceiptModal } from './ProjectReceiptModal';
import { supabase } from '../supabaseClient';
import { useEffect as useReactEffect } from 'react';

interface ProjectManagementProps {
  employees: Employee[];
}

export const ProjectManagement: React.FC<ProjectManagementProps> = ({
  employees,
}) => {
  const { projects, loading, error, addProject, updateProject, deleteProject } = useProjects();
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
  const [projectTypes, setProjectTypes] = useState<{ id: string; name: string }[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  useReactEffect(() => {
    async function fetchTypes() {
      const { data } = await supabase.from('project_types').select('*');
      if (data) setProjectTypes(data);
    }
    if (receiptProject) fetchTypes();
  }, [receiptProject]);

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
    if (editingProject && editingProject.id) {
      await updateProject(editingProject.id, projectData);
    } else {
      await addProject(projectData);
    }
    handleModalClose();
  };

  const handleDelete = async (id: string) => {
    await deleteProject(id);
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
      className="space-y-3 sm:space-y-6 animate-fadeIn overflow-y-auto sm:overflow-hidden max-h-screen px-2 sm:px-0"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-3xl font-bold text-[#F6E9E9] font-['Playfair_Display']">
          Project Management
        </h1>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          {/* Month/Year Filter */}
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#E16428] pointer-events-none">
                <Calendar className="w-4 h-4" />
              </span>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="w-full sm:w-auto pl-9 pr-3 py-2 bg-[#272121]/70 border border-[#E16428]/30 rounded-lg text-[#F6E9E9] focus:outline-none focus:border-[#E16428] font-['Inter'] transition-all duration-200 hover:border-[#E16428] focus:ring-2 focus:ring-[#E16428]/30 sm:text-sm text-xs"
              >
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
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="w-full sm:w-auto pl-9 pr-3 py-2 bg-[#272121]/70 border border-[#E16428]/30 rounded-lg text-[#F6E9E9] focus:outline-none focus:border-[#E16428] font-['Inter'] transition-all duration-200 hover:border-[#E16428] focus:ring-2 focus:ring-[#E16428]/30 sm:text-sm text-xs"
              >
                {years.map(year => (
                  <option key={year} value={year} className="bg-[#272121] text-[#F6E9E9]">{year}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Search Bar */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by employee, client, or university..."
            className="w-full sm:w-64 px-4 py-2 bg-[#272121]/70 border border-[#E16428]/30 rounded-lg text-[#F6E9E9] focus:outline-none focus:border-[#E16428] font-['Inter'] transition-all duration-200 mb-2 sm:mb-0 text-xs sm:text-sm"
          />
          {/* Sorting Buttons */}
        <div className="flex items-center gap-2">
            <button
              onClick={() => setSortBy(sortBy === 'deadline-asc' ? 'deadline-desc' : 'deadline-asc')}
              className={`px-3 py-2 rounded-lg font-['Inter'] text-xs sm:text-sm transition-all duration-200 border border-[#E16428]/30 ${sortBy.startsWith('deadline') ? 'bg-[#E16428] text-white' : 'bg-[#272121]/50 text-[#F6E9E9]/70 hover:bg-[#E16428]/20'}`}
              title="Sort by Deadline"
            >
              <span className="sm:hidden">Dead {sortBy === 'deadline-asc' ? '↑' : '↓'}</span>
              <span className="hidden sm:inline">Deadline {sortBy === 'deadline-asc' ? 'A-Z' : 'Z-A'}</span>
            </button>
            <button
              onClick={() => setSortBy(sortBy === 'projectId-asc' ? 'projectId-desc' : 'projectId-asc')}
              className={`px-3 py-2 rounded-lg font-['Inter'] text-xs sm:text-sm transition-all duration-200 border border-[#E16428]/30 ${sortBy.startsWith('projectId') ? 'bg-[#E16428] text-white' : 'bg-[#272121]/50 text-[#F6E9E9]/70 hover:bg-[#E16428]/20'}`}
              title="Sort by Project No."
            >
              <span className="sm:hidden">ID {sortBy === 'projectId-asc' ? '↑' : '↓'}</span>
              <span className="hidden sm:inline">Project No. {sortBy === 'projectId-asc' ? 'A-Z' : 'Z-A'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2 sm:gap-4">
        {['all', 'Running', 'Pending', 'Delivered', 'Correction', 'Rejected'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 sm:px-4 py-2 rounded-lg transition-all duration-300 font-['Inter'] text-xs sm:text-sm ${
              filter === status
                ? 'bg-[#E16428] text-white'
                : 'bg-[#272121]/50 text-[#F6E9E9]/70 hover:bg-[#E16428]/20'
            }`}
          >
            <span className="sm:hidden">{status === 'all' ? 'All' : status}</span>
            <span className="hidden sm:inline">{status === 'all' ? 'All Projects' : status}</span>
          </button>
        ))}
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
          <div className="block sm:hidden space-y-3">
            {filteredProjects.map((project) => {
              const employee = employees.find(emp => emp.id === project.assignedTo);
              return (
                <div key={project.id} className="bg-[#232021]/80 rounded-xl border border-[#E16428]/10 p-3 flex flex-col gap-1 shadow-sm relative">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#F6E9E9] text-sm truncate max-w-[100px]">{project.clientName}</span>
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
                    {project.projectDescription.split(',').map((type, idx) => (
                      <span key={idx} className="bg-[#E16428]/20 text-[#E16428] rounded-full px-2 py-0.5 text-[10px] font-medium lowercase max-w-[60px] truncate">{type}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[#F6E9E9]/60 text-xs truncate max-w-[80px]">{project.clientUniOrg}</span>
                    <span className="flex items-center gap-1 text-[#F6E9E9]/40 text-[11px] ml-auto">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      {new Date(project.deadlineDate).toLocaleDateString()}
                  </span>
                </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[#F6E9E9]/70 text-xs truncate max-w-[80px]">{employee ? `${employee.firstName} ${employee.lastName}` : 'Unassigned'}</span>
                    <span className="text-[#E16428] font-bold text-xs ml-auto">LKR {project.price.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-bold ${project.paymentOfEmp < 0 ? 'text-yellow-400' : 'text-green-400'}`}>Pay: {project.paymentOfEmp}</span>
                    {project.paymentOfEmp < 0 && (
                      <span title="Negative employee payment" className="ml-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-yellow-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" /></svg>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 mt-2">
                    <button
                      onClick={() => handleEdit(project)}
                      className="p-1.5 sm:p-2 bg-[#E16428]/20 text-[#E16428] rounded-lg hover:bg-[#E16428]/30 transition-all duration-300"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 11l6 6M3 21h6v-6H3v6z" /></svg>
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(project.id)}
                      className="p-1.5 sm:p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all duration-300"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <button
                      onClick={() => setReceiptProject(project)}
                      className="p-1.5 sm:p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all duration-300"
                      title="Download or share receipt"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>
                  {/* Delete confirmation modal */}
                  {confirmDeleteId === project.id && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
                      <div className="bg-[#272121] border border-[#E16428]/30 rounded-2xl shadow-2xl p-8 max-w-xs w-full flex flex-col items-center scale-100 animate-popIn">
                        <div className="mb-4">
                          <svg width="48" height="48" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#E16428" opacity="0.15"/><path d="M15.535 8.465l-7.07 7.07M8.465 8.465l7.07 7.07" stroke="#E16428" strokeWidth="2" strokeLinecap="round"/></svg>
                        </div>
                        <h3 className="text-lg font-bold text-[#F6E9E9] mb-2 font-['Poppins']">Delete Project?</h3>
                        <p className="text-[#F6E9E9]/70 text-center mb-6 font-['Inter']">
                          Are you sure you want to delete <span className="text-[#E16428] font-bold">{project.clientName}</span>? This action cannot be undone.
                        </p>
                        <div className="flex gap-4 mt-2">
                          <button
                            onClick={() => handleDelete(project.id)}
                            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition font-bold"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-4 py-2 bg-[#272121] text-[#F6E9E9] border border-[#E16428]/30 rounded hover:bg-[#363333] transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                  </div>
                  )}
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

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 left-6 bg-gradient-to-r from-[#E16428]/70 to-[#E16428]/50 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#E16428] focus:ring-offset-[#272121] transition-all duration-300 z-40 sm:hidden"
          aria-label="Scroll to top"
          title="Scroll to Top"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      <button
        onClick={handleAdd}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-[#E16428] to-[#E16428]/80 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#E16428] focus:ring-offset-[#272121] transition-all duration-300 z-40 animate-pulse"
        aria-label="Add Project"
        title="Add New Project"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
};