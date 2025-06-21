import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Project, Employee } from '../types';
import { GlassCard } from './GlassCard';
import { supabase } from '../supabaseClient';
import { Listbox } from '@headlessui/react';
import { Check, ChevronDown } from 'lucide-react';

interface ProjectModalProps {
  project: Project | null;
  employees: Employee[];
  onClose: () => void;
  onSave: (project: Omit<Project, 'id'>) => void;
  nextProjectId?: string;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  project,
  employees: initialEmployees,
  onClose,
  onSave,
  nextProjectId,
}) => {
  const [projectTypes, setProjectTypes] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    projectId: project?.projectId || nextProjectId || '',
    clientName: '',
    clientUniOrg: '',
    projectTypes: [] as string[],
    deadlineDate: '',
    price: 0,
    advance: 0,
    assignedTo: '',
    paymentOfEmp: 0,
    status: 'Pending' as Project['status'],
    fastDeliver: false,
  });
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    employees.find(e => e.id === formData.assignedTo) || null
  );
  const [projectIdError, setProjectIdError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // Fetch project types
        const { data: types, error: typesError } = await supabase.from('project_types').select('*');
        if (typesError) {
          console.error('Error fetching project types:', typesError);
        } else {
          setProjectTypes(types || []);
        }
        
        // Fetch employees
        const { data: emps, error: empsError } = await supabase.from('employees').select('*');
        if (empsError) {
          console.error('Error fetching employees:', empsError);
        } else {
          console.log('Fetched employees from database:', emps);
          // Map snake_case to camelCase if needed
          const mappedEmployees = (emps || []).map(emp => ({
            id: emp.id,
            employeeId: emp.employee_id || emp.employeeId,
            birthday: emp.birthday,
            firstName: emp.first_name || emp.firstName,
            lastName: emp.last_name || emp.lastName,
            position: emp.position,
            address: emp.address,
            whatsappNumber: emp.whatsapp_number || emp.whatsappNumber,
            emailAddress: emp.email_address || emp.emailAddress,
            qualifications: emp.qualifications,
            createdAt: emp.created_at || emp.createdAt,
          }));
          setEmployees(mappedEmployees);
          console.log('Mapped employees:', mappedEmployees);
        }
      } catch (error) {
        console.error('Error in fetchData:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (project) {
      setFormData({
        projectId: project.projectId || '',
        clientName: project.clientName,
        clientUniOrg: project.clientUniOrg,
        projectTypes: Array.isArray(project.projectDescription)
          ? project.projectDescription
          : project.projectDescription
          ? project.projectDescription.split(',')
          : [],
        deadlineDate: project.deadlineDate,
        price: project.price,
        advance: project.advance,
        assignedTo: project.assignedTo,
        paymentOfEmp: project.paymentOfEmp,
        status: project.status,
        fastDeliver: (project as any).fastDeliver || false,
      });
    } else if (nextProjectId) {
      setFormData(prev => ({
        ...prev,
        projectId: nextProjectId,
      }));
    }
  }, [project, nextProjectId]);

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      assignedTo: selectedEmployee ? selectedEmployee.id : ''
    }));
    // eslint-disable-next-line
  }, [selectedEmployee]);

  const handleTypeChange = (id: string) => {
    setFormData(prev => ({
      ...prev,
      projectTypes: prev.projectTypes.includes(id)
        ? prev.projectTypes.filter(tid => tid !== id)
        : [...prev.projectTypes, id],
    }));
  };

  const handleFastDeliver = () => {
    setFormData(prev => ({ ...prev, fastDeliver: !prev.fastDeliver }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate projectId
    if (!formData.projectId || !/^PJ\d{4,}$/.test(formData.projectId)) {
      setProjectIdError('Project ID must start with PJ and be followed by at least 4 digits (e.g., PJ1000)');
      return;
    } else {
      setProjectIdError(null);
    }
    // Join projectTypes as a comma-separated string for DB compatibility
    onSave({
      ...formData,
      projectDescription: formData.projectTypes.join(','),
    });
  };

  const statuses: Project['status'][] = [
    'Running',
    'Pending',
    'Delivered',
    'Correction',
    'Rejected',
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <GlassCard className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-[#F6E9E9] font-['Playfair_Display']">
              {project ? 'Edit Project' : 'Add New Project'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 bg-[#272121]/50 text-[#F6E9E9] rounded-lg hover:bg-[#E16428]/20 transition-all duration-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                Project ID <span className="text-[#E16428]">*</span>
              </label>
              <input
                type="text"
                value={formData.projectId}
                onChange={e => setFormData({ ...formData, projectId: e.target.value.toUpperCase() })}
                className="w-full px-4 py-3 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] transition-all duration-300 font-['Inter']"
                placeholder="PJ1000"
                required
                maxLength={16}
              />
              {projectIdError && (
                <div className="text-red-400 text-xs mt-1">{projectIdError}</div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                  Client Name
                </label>
                <input
                  type="text"
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  className="w-full px-4 py-3 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] transition-all duration-300 font-['Inter']"
                  required
                />
              </div>

              <div>
                <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                  Client University/Organization
                </label>
                <input
                  type="text"
                  value={formData.clientUniOrg}
                  onChange={(e) => setFormData({ ...formData, clientUniOrg: e.target.value })}
                  className="w-full px-4 py-3 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] transition-all duration-300 font-['Inter']"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                Project Description (Types)
              </label>
              <div className="flex flex-wrap gap-3">
                {projectTypes.map(type => (
                  <label key={type.id} className="flex items-center space-x-2 cursor-pointer px-3 py-2 rounded-lg bg-[#272121]/40 border border-[#E16428]/20 hover:bg-[#E16428]/10 transition">
                    <input
                      type="checkbox"
                      checked={formData.projectTypes.includes(type.id)}
                      onChange={() => handleTypeChange(type.id)}
                      className="accent-[#E16428] w-5 h-5 rounded border-2 border-[#E16428] focus:ring-2 focus:ring-[#E16428] transition"
                    />
                    <span className="text-[#F6E9E9]">{type.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                  Deadline Date
                </label>
                <input
                  type="date"
                  value={formData.deadlineDate}
                  onChange={(e) => setFormData({ ...formData, deadlineDate: e.target.value })}
                  className="w-full px-4 py-3 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg text-[#F6E9E9] focus:outline-none focus:border-[#E16428] transition-all duration-300 font-['Inter']"
                  required
                />
              </div>

              <div>
                <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                  Assigned To
                </label>
                <Listbox value={selectedEmployee} onChange={setSelectedEmployee}>
                  <div className="relative">
                    <Listbox.Button className="w-full px-4 py-3 bg-[#363333] border border-[#E16428]/60 rounded-lg text-[#F6E9E9] flex justify-between items-center">
                      {selectedEmployee
                        ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`
                        : loading
                        ? 'Loading employees...'
                        : 'Select employee'}
                      <ChevronDown className="w-5 h-5 ml-2 text-[#E16428]" />
                    </Listbox.Button>
                    <Listbox.Options className="absolute z-10 mt-1 w-full bg-[#272121] border border-[#E16428]/40 rounded-lg shadow-lg max-h-60 overflow-auto">
                      {loading ? (
                        <div className="px-4 py-2 text-[#F6E9E9]/70 text-center">
                          Loading employees...
                        </div>
                      ) : employees.length === 0 ? (
                        <div className="px-4 py-2 text-[#F6E9E9]/70 text-center">
                          No employees found
                        </div>
                      ) : (
                        employees.map(emp => (
                          <Listbox.Option
                            key={emp.id}
                            value={emp}
                            className={({ active, selected }: { active: boolean; selected: boolean }) =>
                              `cursor-pointer select-none px-4 py-2 ${
                                active
                                  ? 'bg-[#E16428]/20 text-[#E16428]'
                                  : selected
                                  ? 'bg-[#E16428]/10 text-[#F6E9E9]'
                                  : 'text-[#F6E9E9]'
                              }`
                            }
                          >
                            {({ selected }: { selected: boolean }) => (
                              <span className="flex items-center">
                                {emp.firstName} {emp.lastName}
                                {selected && <Check className="w-4 h-4 ml-2 text-[#E16428]" />}
                              </span>
                            )}
                          </Listbox.Option>
                        ))
                      )}
                    </Listbox.Options>
                  </div>
                </Listbox>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                  Price (LKR)
                </label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="w-full px-4 py-3 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] transition-all duration-300 font-['Inter']"
                  required
                  min="0"
                />
              </div>

              <div>
                <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                  Advance (LKR)
                </label>
                <input
                  type="number"
                  value={formData.advance}
                  onChange={(e) => setFormData({ ...formData, advance: Number(e.target.value) })}
                  className="w-full px-4 py-3 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] transition-all duration-300 font-['Inter']"
                  required
                  min="0"
                />
              </div>

              <div>
                <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                  Employee Payment (LKR)
                </label>
                <input
                  type="text"
                  value={formData.paymentOfEmp}
                  onChange={e => {
                    const val = e.target.value;
                    // Allow empty, minus, and numbers only
                    if (/^-?\d*$/.test(val)) {
                      setFormData({ ...formData, paymentOfEmp: val === '' ? 0 : Number(val) });
                    }
                  }}
                  className="w-full px-4 py-3 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] transition-all duration-300 font-['Inter']"
                  required
                  placeholder="0 or -1000"
                />
                {formData.paymentOfEmp < 0 && (
                  <div className="text-yellow-400 text-xs mt-1 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="inline w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" /></svg>
                    Negative value: Employee owes company
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Project['status'] })}
                className="w-full px-4 py-3 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg text-[#F6E9E9] focus:outline-none focus:border-[#E16428] transition-all duration-300 font-['Inter']"
                required
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2 mt-2">
              <input
                type="checkbox"
                checked={formData.fastDeliver}
                onChange={handleFastDeliver}
                className="accent-[#E16428] w-5 h-5 rounded border-2 border-[#E16428] focus:ring-2 focus:ring-[#E16428] transition"
                id="fastDeliver"
              />
              <label htmlFor="fastDeliver" className="text-[#E16428] font-medium cursor-pointer">
                Fast Deliver Project
              </label>
            </div>

            <div className="flex justify-end space-x-4 pt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-[#272121]/50 text-[#F6E9E9] rounded-lg hover:bg-[#272121]/70 transition-all duration-300 font-['Poppins']"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-[#E16428] to-[#E16428]/80 text-white rounded-lg hover:scale-105 transition-all duration-300 shadow-lg font-['Poppins']"
              >
                {project ? 'Update' : 'Create'} Project
              </button>
            </div>
          </form>
        </div>
      </GlassCard>
    </div>
  );
};