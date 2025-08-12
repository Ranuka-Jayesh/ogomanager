import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Mail, Phone, MapPin, Cake, User, Briefcase, GraduationCap, AtSign, MessageCircle, Clock, AlertTriangle } from 'lucide-react';
import { Employee } from '../types';
import { GlassCard } from './GlassCard';
import { EmployeeModal } from './EmployeeModal';
import { supabase } from '../supabaseClient';

interface EmployeeManagementProps {
  // No longer need employees, add, update, delete as props
}

// Helper: camelCase <-> snake_case mapping
function toSupabaseEmployee(employee: any) {
  return {
    employee_id: employee.employeeId,
    birthday: employee.birthday,
    first_name: employee.firstName,
    last_name: employee.lastName,
    position: employee.position,
    address: employee.address,
    whatsapp: employee.whatsappNumber,
    email: employee.emailAddress,
    qualifications: employee.qualifications,
  };
}
function fromSupabaseEmployee(row: any) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    birthday: row.birthday,
    firstName: row.first_name,
    lastName: row.last_name,
    position: row.position,
    address: row.address,
    whatsappNumber: row.whatsapp,
    emailAddress: row.email,
    qualifications: row.qualifications,
    createdAt: row.created_at,
  };
}

// Helper to calculate age from birthday
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

export const EmployeeManagement: React.FC<EmployeeManagementProps> = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);

  // Fetch employees from Supabase
  useEffect(() => {
    async function fetchEmployees() {
      setLoading(true);
      const { data, error } = await supabase.from('employees').select('*');
      if (!error && data) setEmployees(data.map(fromSupabaseEmployee));
      setLoading(false);
    }
    fetchEmployees();
  }, []);

  const addEmployee = async (employee: any) => {
    const { data, error } = await supabase.from('employees').insert([toSupabaseEmployee(employee)]).select();
    if (!error && data && data[0]) {
      setEmployees(prev => [...prev, fromSupabaseEmployee(data[0])]);
    }
  };

  const updateEmployee = async (id: any, updates: any) => {
    const { data, error } = await supabase
      .from('employees')
      .update(toSupabaseEmployee(updates))
      .eq('id', id)
      .select();
    if (!error && data && data[0]) {
      setEmployees(prev =>
        prev.map(emp => (emp.id === id ? fromSupabaseEmployee(data[0]) : emp))
      );
    }
  };

  const deleteEmployee = async (id: any) => {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (!error) {
      setEmployees(prev => prev.filter(emp => emp.id !== id));
    }
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

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      // Alt + A: Open add employee form
      if (e.altKey && e.key === 'a') {
        e.preventDefault();
        handleAdd();
      }
      // Alt + S: Save/Update form (only when modal is open)
      if (e.altKey && e.key === 's' && isModalOpen) {
        e.preventDefault();
        const saveButton = document.querySelector('[data-shortcut="save"]') as HTMLButtonElement;
        if (saveButton) {
          saveButton.click();
        }
      }
      // Escape: Close modals
      if (e.key === 'Escape') {
        if (isModalOpen) {
          handleModalClose();
        }
        if (confirmDeleteId) {
          setConfirmDeleteId(null);
          setDeletingEmployee(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, confirmDeleteId]);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#F6E9E9] font-['Playfair_Display']">
          Employee Management
        </h1>
        <button
          onClick={handleAdd}
          className="flex items-center space-x-2 bg-gradient-to-r from-[#E16428] to-[#E16428]/80 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:scale-105 transition-all duration-300 shadow-lg font-['Poppins'] group relative"
          aria-label="Add Employee (Alt+A)"
          title="Add New Employee (Alt+A)"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Add Employee</span>
          <span className="sm:hidden">Add</span>
          <div className="absolute -top-1 -right-1 bg-[#E16428] text-white text-xs px-1.5 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-mono">
            A
          </div>
        </button>
      </div>

      {loading ? (
        <div className="text-center text-[#F6E9E9]/70">Loading employees...</div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {employees.map((employee) => (
            <GlassCard key={employee.id} className="p-3 sm:p-4 rounded-2xl shadow-lg hover:scale-105 hover:shadow-2xl transition-all duration-300 bg-[#272121]/60 border border-[#E16428]/10">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-[#E16428] to-[#F6E9E9] rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-semibold text-[#F6E9E9] font-['Poppins'] truncate">
                    {employee.firstName} {employee.lastName}
                  </h3>
                  <div className="flex items-center text-xs text-[#E16428] font-medium space-x-1">
                    <Cake className="w-4 h-4" />
                    <span>Age: {getAge(employee.birthday)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-[#F6E9E9]/60">ID</span>
                  <span className="text-xs text-[#E16428] font-bold">{employee.employeeId}</span>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex items-center space-x-2 text-[#F6E9E9]/80">
                  <Briefcase className="w-4 h-4" />
                  <span>{employee.position}</span>
                </div>
                <div className="flex items-center space-x-2 text-[#F6E9E9]/80">
                  <MapPin className="w-4 h-4" />
                  <span className="truncate">{employee.address}</span>
                </div>
                <div className="flex items-center space-x-2 text-[#F6E9E9]/80">
                  <Cake className="w-4 h-4" />
                  <span>{employee.birthday}</span>
                </div>
                <div className="flex items-center space-x-2 text-[#F6E9E9]/80">
                  <AtSign className="w-4 h-4" />
                  <span className="truncate">{employee.emailAddress}</span>
                </div>
                <div className="flex items-center space-x-2 text-[#F6E9E9]/80">
                  <MessageCircle className="w-4 h-4" />
                  <span>{employee.whatsappNumber}</span>
                </div>
                <div className="flex items-center space-x-2 text-[#F6E9E9]/80">
                  <GraduationCap className="w-4 h-4" />
                  <span className="truncate">{employee.qualifications}</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-3 mt-2 border-t border-[#E16428]/10">
                <div className="flex space-x-2 mb-2 sm:mb-0">
                  <button
                    onClick={() => handleEdit(employee)}
                    className="p-1.5 sm:p-2 bg-[#E16428]/20 text-[#E16428] rounded-lg hover:bg-[#E16428]/30 transition-all duration-300"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(employee)}
                    className="p-1.5 sm:p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all duration-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => window.open(`mailto:${employee.emailAddress}`)}
                    className="p-1.5 sm:p-2 rounded-lg bg-[#E16428]/20 hover:bg-[#E16428]/40 transition"
                    title="Send Email"
                  >
                    <Mail className="w-4 h-4 text-[#E16428]" />
                  </button>
                  <button
                    onClick={() => window.open(`https://wa.me/${employee.whatsappNumber.replace(/\D/g, '')}`)}
                    className="p-1.5 sm:p-2 rounded-lg bg-[#25D366]/20 hover:bg-[#25D366]/40 transition"
                    title="Send WhatsApp Message"
                  >
                    <Phone className="w-4 h-4 text-[#25D366]" />
                  </button>
                </div>
                <span className="text-xs text-[#F6E9E9]/50 flex items-center self-start sm:self-center">
                  <Clock className="w-4 h-4 mr-1" />
                  Registered: {employee.createdAt ? new Date(employee.createdAt).toLocaleDateString() : 'N/A'}
                </span>
            </div>
          </GlassCard>
        ))}
      </div>
      )}

      {isModalOpen && (
        <EmployeeModal
          employee={editingEmployee}
          onClose={handleModalClose}
          onSave={async (employeeData) => {
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#272121] rounded-2xl p-6 max-w-md w-full mx-4 border border-[#E16428]/20 shadow-2xl animate-scaleIn">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              
              <h3 className="text-xl font-bold text-[#F6E9E9] mb-2 font-['Poppins']">
                delete employee?
              </h3>
              
              <p className="text-[#F6E9E9]/70 mb-6 font-['Inter']">
                are you sure you want to delete{' '}
                <span className="text-[#E16428] font-semibold">{deletingEmployee.firstName} {deletingEmployee.lastName}</span>?
                <br />
                <span className="text-xs text-[#F6E9E9]/50">
                  this action cannot be undone.
                </span>
              </p>
              
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
    </div>
  );
};