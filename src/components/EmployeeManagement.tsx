import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Pencil, Trash2, Mail, Phone, MapPin, ChevronRight } from 'lucide-react';
import { Employee, Project } from '../types';
import { EmployeeModal } from './EmployeeModal';
import { EmployeeDetail } from './EmployeeDetail';
import { useMobileNotifications } from '../hooks/useMobileNotifications';
import { useEmployeesOffline } from '../hooks/useEmployeesOffline';

interface EmployeeManagementProps {
  projects?: Project[];
}

function getAge(birthday: string) {
  if (!birthday) return '';
  const birthDate = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function getInitials(firstName: string, lastName: string) {
  const a = (firstName || '').trim().charAt(0);
  const b = (lastName || '').trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
}

export const EmployeeManagement: React.FC<EmployeeManagementProps> = ({
  projects = [],
}) => {
  const { showNotification } = useMobileNotifications();
  const {
    employees,
    loading,
    addEmployee: addEmployeeOffline,
    updateEmployee: updateEmployeeOffline,
    deleteEmployee: deleteEmployeeOffline,
  } = useEmployeesOffline();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const selectedEmployee = useMemo(
    () => employees.find(e => e.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId]
  );

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const active = e.isActive !== false;
      if (statusFilter === 'active') return active;
      if (statusFilter === 'inactive') return !active;
      return true;
    });
  }, [employees, statusFilter]);

  const counts = useMemo(() => {
    const active = employees.filter(e => e.isActive !== false).length;
    return {
      all: employees.length,
      active,
      inactive: employees.length - active,
    };
  }, [employees]);

  const addEmployee = async (employee: any) => {
    await addEmployeeOffline({ ...employee, isActive: employee.isActive !== false });
    showNotification(`Employee ${employee.firstName} ${employee.lastName} added successfully`, 'success', {
      title: 'Manager Pro',
      icon: '/app.png',
    });
  };

  const updateEmployee = async (id: any, updates: any) => {
    await updateEmployeeOffline(id, updates);
    const name = [updates.firstName, updates.lastName].filter(Boolean).join(' ');
    showNotification(
      name ? `Employee ${name} updated successfully` : 'Employee updated successfully',
      'success',
      { title: 'Manager Pro', icon: '/app.png' }
    );
  };

  const deleteEmployee = async (id: any) => {
    const employee = employees.find(emp => emp.id === id);
    await deleteEmployeeOffline(id);
    if (selectedEmployeeId === id) setSelectedEmployeeId(null);
    if (employee) {
      showNotification(`Employee ${employee.firstName} ${employee.lastName} deleted successfully`, 'info', {
        title: 'Manager Pro',
        icon: '/app.png',
      });
    }
  };

  const handleToggleActive = async (employee: Employee) => {
    const next = employee.isActive === false;
    await updateEmployeeOffline(employee.id, { isActive: next });
    showNotification(
      `${employee.firstName} ${employee.lastName} marked ${next ? 'active' : 'inactive'}`,
      'info',
      { title: 'Manager Pro', icon: '/app.png' }
    );
  };

  const handleTogglePerformance = async (employee: Employee) => {
    const next = employee.showInPerformance === false;
    await updateEmployeeOffline(employee.id, { showInPerformance: next });
    showNotification(
      `${employee.firstName} ${employee.lastName} performance view ${next ? 'on' : 'off'}`,
      'info',
      { title: 'Manager Pro', icon: '/app.png' }
    );
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingEmployee(null);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
  };

  const handleDelete = (employee: Employee) => {
    setConfirmDeleteId(employee.id);
    setDeletingEmployee(employee);
  };

  const handleConfirmDelete = () => {
    if (confirmDeleteId) {
      deleteEmployee(confirmDeleteId);
      setConfirmDeleteId(null);
      setDeletingEmployee(null);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDeleteId(null);
    setDeletingEmployee(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.altKey && e.key === 'a' && !selectedEmployeeId) {
        e.preventDefault();
        handleAdd();
      }
      if (e.altKey && e.key === 's' && isModalOpen) {
        e.preventDefault();
        const saveButton = document.querySelector('[data-shortcut="save"]') as HTMLButtonElement;
        if (saveButton) saveButton.click();
      }
      if (e.key === 'Escape') {
        if (isModalOpen) handleModalClose();
        else if (confirmDeleteId) {
          setConfirmDeleteId(null);
          setDeletingEmployee(null);
        } else if (selectedEmployeeId) {
          setSelectedEmployeeId(null);
        }
      }

      if (e.key === 'Enter' && confirmDeleteId && !isModalOpen) {
        e.preventDefault();
        deleteEmployee(confirmDeleteId);
        setConfirmDeleteId(null);
        setDeletingEmployee(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, confirmDeleteId, selectedEmployeeId]);

  if (selectedEmployee) {
    return (
      <>
        <EmployeeDetail
          employee={selectedEmployee}
          projects={projects}
          onBack={() => setSelectedEmployeeId(null)}
          onToggleActive={handleToggleActive}
          onEdit={handleEdit}
        />
        {isModalOpen && (
          <EmployeeModal
            employee={editingEmployee}
            onClose={handleModalClose}
            onSave={async employeeData => {
              if (editingEmployee) {
                await updateEmployee(editingEmployee.id, employeeData);
              } else {
                await addEmployee(employeeData);
              }
              handleModalClose();
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 animate-fadeIn pb-24">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F6E9E9] font-['Playfair_Display']">
            Employees
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#F6E9E9]/45 font-['Inter']">
            {loading ? 'Loading…' : `${counts.active} active · ${counts.inactive} inactive`}
          </p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-1 border-b border-[#E16428]/15">
        {([
          { key: 'active' as const, label: 'Active', count: counts.active },
          { key: 'inactive' as const, label: 'Inactive', count: counts.inactive },
          { key: 'all' as const, label: 'All', count: counts.all },
        ]).map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-2 text-xs font-['Inter'] border-b-2 -mb-px transition-colors ${
              statusFilter === tab.key
                ? 'border-[#E16428] text-[#E16428]'
                : 'border-transparent text-[#F6E9E9]/45 hover:text-[#F6E9E9]/70'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-[10px] opacity-70">{tab.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-[#F6E9E9]/45 text-sm font-['Inter']">Loading employees…</div>
      ) : filteredEmployees.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-[#E16428]/20 rounded-2xl">
          <p className="text-[#F6E9E9]/70 font-['Inter'] text-sm">
            {statusFilter === 'inactive' ? 'No inactive employees' : 'No employees yet'}
          </p>
          {statusFilter !== 'inactive' && (
            <button
              onClick={handleAdd}
              className="mt-3 text-[#E16428] text-sm font-['Poppins'] hover:underline"
            >
              Add the first employee
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {filteredEmployees.map(employee => {
            const age = getAge(employee.birthday);
            const isActive = employee.isActive !== false;
            const showPerf = employee.showInPerformance !== false;
            return (
              <article
                key={employee.id}
                className={`group relative flex flex-col rounded-xl border transition-colors duration-200 ${
                  isActive
                    ? 'border-[#E16428]/15 bg-[#232021]/70 hover:border-[#E16428]/35'
                    : 'border-[#F6E9E9]/10 bg-[#232021]/40 opacity-75 hover:opacity-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedEmployeeId(employee.id)}
                  className="flex items-start gap-3 p-4 pb-3 text-left w-full"
                >
                  <div className="w-11 h-11 rounded-full bg-[#E16428]/15 border border-[#E16428]/25 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-[#E16428] font-['Poppins'] tracking-wide">
                      {getInitials(employee.firstName, employee.lastName)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[15px] font-semibold text-[#F6E9E9] font-['Poppins'] leading-snug truncate">
                        {employee.firstName} {employee.lastName}
                      </h3>
                      <ChevronRight className="w-4 h-4 text-[#F6E9E9]/25 group-hover:text-[#E16428] flex-shrink-0 mt-0.5 transition-colors" />
                    </div>
                    <p className="text-xs text-[#F6E9E9]/50 font-['Inter'] truncate mt-0.5">
                      {employee.position || 'No position'}
                      {age !== '' && <span className="text-[#F6E9E9]/30"> · {age}y</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-mono text-[#E16428]/90">{employee.employeeId}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-['Inter'] ${
                          isActive
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-[#F6E9E9]/08 text-[#F6E9E9]/40'
                        }`}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </button>

                <div className="px-4 pb-3 space-y-1.5 text-xs font-['Inter'] text-[#F6E9E9]/55">
                  {employee.emailAddress && (
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="w-3.5 h-3.5 text-[#E16428]/60 flex-shrink-0" />
                      <span className="truncate">{employee.emailAddress}</span>
                    </div>
                  )}
                  {employee.whatsappNumber && (
                    <div className="flex items-center gap-2 min-w-0">
                      <Phone className="w-3.5 h-3.5 text-[#E16428]/60 flex-shrink-0" />
                      <span className="truncate">{employee.whatsappNumber}</span>
                    </div>
                  )}
                  {employee.address && (
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-[#E16428]/60 flex-shrink-0" />
                      <span className="truncate">{employee.address}</span>
                    </div>
                  )}
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 px-3 sm:px-4 py-2 border-t border-[#E16428]/10">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleEdit(employee)}
                      className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-md text-[#F6E9E9]/45 hover:text-[#E16428] hover:bg-[#E16428]/10 transition-colors"
                      title="Edit"
                      aria-label="Edit employee"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(employee)}
                      className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-md text-[#F6E9E9]/45 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete"
                      aria-label="Delete employee"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showPerf}
                      onClick={() => handleTogglePerformance(employee)}
                      title={showPerf ? 'Hide from performance' : 'Show in performance'}
                      aria-label={showPerf ? 'Hide from performance' : 'Show in performance'}
                      className="flex items-center gap-2 shrink-0 min-h-[40px] pl-2 touch-manipulation"
                    >
                      <span className="text-[10px] font-['Inter'] text-[#F6E9E9]/45">Perf</span>
                      <span
                        className={`relative block w-10 h-5 rounded-full shrink-0 transition-colors ${
                          showPerf ? 'bg-sky-500/50' : 'bg-[#F6E9E9]/15'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 block w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
                            showPerf ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </span>
                    </button>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={isActive}
                      onClick={() => handleToggleActive(employee)}
                      title={isActive ? 'Mark inactive' : 'Mark active'}
                      aria-label={isActive ? 'Mark inactive' : 'Mark active'}
                      className="flex items-center gap-2 shrink-0 min-h-[40px] pl-2 touch-manipulation"
                    >
                      <span className="text-[10px] font-['Inter'] text-[#F6E9E9]/45">
                        {isActive ? 'On' : 'Off'}
                      </span>
                      <span
                        className={`relative block w-10 h-5 rounded-full shrink-0 transition-colors ${
                          isActive ? 'bg-emerald-500/50' : 'bg-[#F6E9E9]/15'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 block w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
                            isActive ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <EmployeeModal
          employee={editingEmployee}
          onClose={handleModalClose}
          onSave={async employeeData => {
            if (editingEmployee) {
              await updateEmployee(editingEmployee.id, employeeData);
            } else {
              await addEmployee(employeeData);
            }
            handleModalClose();
          }}
        />
      )}

      {confirmDeleteId && deletingEmployee && (
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
              Delete employee?
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#F6E9E9]/55 font-['Inter']">
              Remove{' '}
              <span className="text-[#E16428] font-medium">
                {deletingEmployee.firstName} {deletingEmployee.lastName}
              </span>
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
                Keep employee
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

      {!isModalOpen &&
        createPortal(
          <div className="fixed bottom-5 sm:bottom-7 inset-x-0 z-40 flex justify-center pointer-events-none px-3">
            <div className="pointer-events-auto flex items-center rounded-full bg-[#272121]/95 backdrop-blur-md border border-[#E16428]/25 shadow-xl shadow-black/40 pl-3.5 pr-1.5 py-1 gap-0.5 animate-fadeIn">
              <button
                type="button"
                onClick={handleAdd}
                className="px-2.5 sm:px-3 py-1.5 text-[#F6E9E9] text-sm font-['Poppins'] font-semibold hover:text-[#E16428] active:scale-95 transition-all"
                aria-label="Add Employee (Alt+A)"
                title="Add New Employee (Alt+A)"
              >
                Add Employee
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
