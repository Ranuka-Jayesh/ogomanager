import React, { useState, useEffect } from 'react';
import { Edit, Trash2, Calendar, AlertTriangle, FileText } from 'lucide-react';
import { Project, Employee } from '../types';
import { GlassCard } from './GlassCard';
import { supabase } from '../supabaseClient';
import { ProjectReceiptModal } from './ProjectReceiptModal';

interface ProjectTableProps {
  projects: Project[];
  employees: Employee[];
  onEdit: (project: Project) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, updates: Partial<Project>) => void;
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
}) => {
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [receiptProject, setReceiptProject] = useState<Project | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 7;
  // Filter projects to only those created in the current month
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthProjects = projects.filter(project => {
    if (!project.createdAt) return false;
    const created = new Date(project.createdAt);
    return created.getMonth() === currentMonth && created.getFullYear() === currentYear;
  });
  const totalPages = Math.ceil(monthProjects.length / recordsPerPage);
  const paginatedProjects = monthProjects.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

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

  const getEmployeeName = (employeeId: string) => {
    if (!employeeId) return 'Unassigned';
    
    console.log('Looking for employee with ID:', employeeId);
    console.log('Available employees:', employees);
    
    const employee = employees.find(emp => emp.id === employeeId);
    
    if (employee) {
      console.log('Found employee:', employee);
      return `${employee.firstName} ${employee.lastName}`;
    } else {
      console.log('Employee not found for ID:', employeeId);
      // Try to find by employeeId field as well
      const employeeByEmployeeId = employees.find(emp => emp.employeeId === employeeId);
      if (employeeByEmployeeId) {
        console.log('Found employee by employeeId:', employeeByEmployeeId);
        return `${employeeByEmployeeId.firstName} ${employeeByEmployeeId.lastName}`;
      }
      return `Unassigned (ID: ${employeeId})`;
    }
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Running':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Delivered':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'Pending':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'Correction':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'Rejected':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const statuses: Project['status'][] = [
    'Running',
    'Pending',
    'Delivered',
    'Correction',
    'Rejected',
  ];

  const handleStatusChange = (projectId: string, newStatus: Project['status']) => {
    onUpdateStatus(projectId, { status: newStatus });
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
    <GlassCard className="overflow-hidden">
      {/* Mobile Card View */}
      <div className="block lg:hidden">
        <div className="p-4 space-y-4">
          {projects.map((project) => (
            <div key={project.id} className="bg-[#272121]/30 rounded-lg p-4 border border-[#E16428]/10">
              <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                  <h3 className="text-[#F6E9E9] font-semibold font-['Poppins']">
                    {project.clientName}
                  </h3>
                  <p className="text-[#F6E9E9]/70 text-sm">{project.clientUniOrg}</p>
                </div>
                  <div className="flex space-x-2 ml-2">
                  <button
                    onClick={() => onEdit(project)}
                      className="p-1.5 bg-[#E16428]/20 text-[#E16428] rounded-lg hover:bg-[#E16428]/30 transition-all duration-300"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                      onClick={() => handleDeleteClick(project)}
                      className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all duration-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                    <button
                      onClick={() => setReceiptProject(project)}
                      className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all duration-300"
                      title="Download or share receipt"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-[#F6E9E9]/70">Project Types:</span>
                    <span className="text-[#F6E9E9] text-right max-w-[60%]">{getProjectTypeNames(project.projectDescription)}</span>
                  </div>
                  {project.fastDeliver && (
                    <div className="flex justify-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#E16428]/20 text-[#E16428] border border-[#E16428]/30">
                        ⚡ fast delivery
                      </span>
                </div>
                  )}
                <div className="flex justify-between">
                    <span className="text-[#F6E9E9]/70">Assigned To:</span>
                  <span className="text-[#F6E9E9]">{getEmployeeName(project.assignedTo)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#F6E9E9]/70">Deadline:</span>
                  <span className="text-[#F6E9E9]">{new Date(project.deadlineDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#F6E9E9]/70">Price:</span>
                    <span className="text-[#E16428] font-bold text-xs sm:text-sm">LKR {project.price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#F6E9E9]/70">Emp. Payment:</span>
                    <span className={`flex items-center gap-1 font-medium ${project.paymentOfEmp < 0 ? 'text-yellow-400' : 'text-green-400/80'}`}>
                      {project.paymentOfEmp < 0 && (
                        <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                      )}
                      LKR {project.paymentOfEmp.toLocaleString()}
                    </span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-[#F6E9E9]/70">Status:</span>
                  <select
                    value={project.status}
                    onChange={(e) => handleStatusChange(project.id, e.target.value as Project['status'])}
                    className={`px-3 py-1 rounded-full text-xs font-medium border bg-transparent ${getStatusColor(project.status)}`}
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status} className="bg-[#272121] text-[#F6E9E9]">
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
          <div className="relative min-h-[434px] max-h-[434px] overflow-x-auto custom-scrollbar flex flex-col justify-start">
            <table className="w-full min-w-[900px]">
              <thead className="sticky top-0 z-10 bg-[#272121]">
            <tr className="border-b border-[#E16428]/20">
                  <th className="text-left align-middle text-xs sm:text-sm text-[#F6E9E9]/70 font-normal p-2 sm:p-4 font-['Inter'] whitespace-nowrap min-w-[40px]">no.</th>
                  <th className="text-left align-middle text-xs sm:text-sm text-[#F6E9E9]/70 font-normal p-2 sm:p-4 font-['Inter'] whitespace-nowrap min-w-[120px]">client</th>
                  <th className="text-left align-middle text-xs sm:text-sm text-[#F6E9E9]/70 font-normal p-2 sm:p-4 font-['Inter'] whitespace-nowrap min-w-[140px]">project types</th>
                  <th className="text-left align-middle text-xs sm:text-sm text-[#F6E9E9]/70 font-normal p-2 sm:p-4 font-['Inter'] whitespace-nowrap min-w-[120px]">assigned to</th>
                  <th className="text-left align-middle text-xs sm:text-sm text-[#F6E9E9]/70 font-normal p-2 sm:p-4 font-['Inter'] whitespace-nowrap min-w-[100px]">deadline</th>
                  <th className="text-left align-middle text-xs sm:text-sm text-[#F6E9E9]/70 font-normal p-2 sm:p-4 font-['Inter'] whitespace-nowrap min-w-[100px]">price</th>
                  <th className="text-left align-middle text-xs sm:text-sm text-[#F6E9E9]/70 font-normal p-2 sm:p-4 font-['Inter'] whitespace-nowrap min-w-[100px]">emp. payment</th>
                  <th className="text-left align-middle text-xs sm:text-sm text-[#F6E9E9]/70 font-normal p-2 sm:p-4 font-['Inter'] whitespace-nowrap min-w-[100px]">status</th>
                  <th className="text-left align-middle text-xs sm:text-sm text-[#F6E9E9]/70 font-normal p-2 sm:p-4 font-['Inter'] whitespace-nowrap min-w-[100px]">actions</th>
            </tr>
          </thead>
          <tbody>
                {paginatedProjects.map((project) => (
                  <tr key={project.id} className="border-b border-[#E16428]/10 hover:bg-[#272121]/20 transition-all duration-300 text-xs sm:text-sm">
                    <td className="p-2 sm:p-4 align-middle min-w-[40px] font-bold text-[#E16428]">{project.projectId}</td>
                    <td className="p-2 sm:p-4 align-middle min-w-[120px]">
                  <div>
                        <p className="text-[#F6E9E9] font-medium font-['Inter'] text-xs sm:text-sm">{project.clientName}</p>
                        <p className="text-[#F6E9E9]/70 text-xs sm:text-xs">{project.clientUniOrg}</p>
                  </div>
                </td>
                    <td className="p-2 sm:p-4 align-middle min-w-[140px]">
                      <div>
                        <span className="text-[#F6E9E9] font-['Inter'] text-xs sm:text-sm break-words">{getProjectTypeNames(project.projectDescription)}</span>
                        {project.fastDeliver && (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#E16428]/20 text-[#E16428] border border-[#E16428]/30">
                              ⚡ fast delivery
                            </span>
                          </div>
                        )}
                      </div>
                </td>
                    <td className="p-2 sm:p-4 align-middle min-w-[120px]">
                      <span className="text-[#F6E9E9] font-['Inter'] text-xs sm:text-sm">{getEmployeeName(project.assignedTo)}</span>
                </td>
                    <td className="p-2 sm:p-4 align-middle min-w-[100px]">
                      <div className="flex items-center space-x-1 text-[#F6E9E9]/70 text-xs sm:text-sm">
                    <Calendar className="w-4 h-4" />
                    <span className="font-['Inter']">{new Date(project.deadlineDate).toLocaleDateString()}</span>
                  </div>
                </td>
                    <td className="p-2 sm:p-4 align-middle min-w-[100px]">
                      <span className="text-[#E16428] font-bold font-['Inter'] text-xs sm:text-sm">LKR {project.price.toLocaleString()}</span>
                    </td>
                    <td className="p-2 sm:p-4 align-middle min-w-[100px]">
                      <span className={`flex items-center gap-1 font-medium ${project.paymentOfEmp < 0 ? 'text-yellow-400' : 'text-green-400/80'}`}>
                        {project.paymentOfEmp < 0 && (
                          <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                        )}
                        LKR {project.paymentOfEmp.toLocaleString()}
                      </span>
                </td>
                    <td className="p-2 sm:p-4 align-middle min-w-[100px]">
                  <select
                    value={project.status}
                    onChange={(e) => handleStatusChange(project.id, e.target.value as Project['status'])}
                    className={`px-3 py-1 rounded-full text-xs font-medium border bg-transparent cursor-pointer transition-all duration-300 hover:scale-105 ${getStatusColor(project.status)}`}
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status} className="bg-[#272121] text-[#F6E9E9]">
                            {status.toLowerCase()}
                      </option>
                    ))}
                  </select>
                </td>
                    <td className="p-2 sm:p-4 align-middle min-w-[100px]">
                      <div className="flex space-x-2 items-center">
                    <button
                      onClick={() => onEdit(project)}
                      className="p-2 bg-[#E16428]/20 text-[#E16428] rounded-lg hover:bg-[#E16428]/30 transition-all duration-300"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                          onClick={() => handleDeleteClick(project)}
                      className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all duration-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                        <button
                          onClick={() => setReceiptProject(project)}
                          className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all duration-300"
                          title="Download or share receipt"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                  </div>
                </td>
              </tr>
            ))}
                {/* Add empty rows if less than 7 projects on this page */}
                {Array.from({ length: recordsPerPage - paginatedProjects.length }).map((_, i) => (
                  <tr key={`empty-row-${i}`} className="h-[62px]">
                    <td colSpan={8}></td>
                  </tr>
                ))}
          </tbody>
        </table>
          </div>
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-end items-center mt-4 space-x-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1 rounded bg-[#272121]/60 text-[#F6E9E9]/80 border border-[#E16428]/20 transition-all duration-300 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#E16428]/20'}`}
              >
                Previous
              </button>
              <span className="text-[#F6E9E9]/60 text-xs">Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={`px-3 py-1 rounded bg-[#272121]/60 text-[#F6E9E9]/80 border border-[#E16428]/20 transition-all duration-300 ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#E16428]/20'}`}
              >
                Next
              </button>
            </div>
          )}
      </div>
    </GlassCard>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && deletingProject && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#272121] rounded-2xl p-6 max-w-md w-full mx-4 border border-[#E16428]/20 shadow-2xl animate-scaleIn">
            <div className="text-center">
              {/* Warning Icon */}
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              
              {/* Title */}
              <h3 className="text-xl font-bold text-[#F6E9E9] mb-2 font-['Poppins']">
                delete project?
              </h3>
              
              {/* Message */}
              <p className="text-[#F6E9E9]/70 mb-6 font-['Inter']">
                are you sure you want to delete the project for{' '}
                <span className="text-[#E16428] font-semibold">{deletingProject.clientName}</span>?
                <br />
                <span className="text-xs text-[#F6E9E9]/50">
                  this action cannot be undone.
                </span>
              </p>
              
              {/* Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={handleCancelDelete}
                  className="flex-1 px-4 py-3 bg-[#363333] text-[#F6E9E9] rounded-lg hover:bg-[#363333]/80 transition-all duration-300 font-['Poppins']"
                >
                  cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:scale-105 transition-all duration-300 shadow-lg font-['Poppins']"
                >
                  delete
                </button>
              </div>
            </div>
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
    </>
  );
};