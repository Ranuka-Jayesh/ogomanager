import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef, useMemo } from 'react';
import { X, Trash2, UserPlus } from 'lucide-react';
import { Project, Employee } from '../types';
import { GlassCard } from './GlassCard';
import { supabase } from '../supabaseClient';
import { Listbox } from '@headlessui/react';
import { Check, ChevronDown } from 'lucide-react';
import { useMobileDetection } from '../hooks/useMobileDetection';

// Type for employee assignment with individual payment
interface EmployeeAssignment {
  employeeId: string;
  payment: number;
}

interface ProjectModalProps {
  project: Project | null;
  employees: Employee[];
  onClose: () => void;
  onSave: (project: Omit<Project, 'id'>) => void;
  nextProjectId?: string;
}

export interface ProjectModalRef {
  submit: () => void;
}

// Helper function to format number with thousand separators
const formatNumberWithSeparators = (value: number): string => {
  if (value === 0) return '';
  return value.toLocaleString('en-US');
};

// Helper function to parse formatted number string to number
const parseFormattedNumber = (value: string): number => {
  // Remove all non-digit characters except minus sign
  const cleaned = value.replace(/[^\d-]/g, '');
  return cleaned === '' || cleaned === '-' ? 0 : parseInt(cleaned, 10);
};

export const ProjectModal = forwardRef<ProjectModalRef, ProjectModalProps>(({
  project,
  employees: initialEmployees,
  onClose,
  onSave,
  nextProjectId,
}, ref) => {
  const isMobile = useMobileDetection();
  const [projectTypes, setProjectTypes] = useState<{ id: string; name: string }[]>([]);
  const [typeUsageCount, setTypeUsageCount] = useState<Record<string, number>>({});
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [loading, setLoading] = useState(true);
  
  // State for formatted display values
  const [priceDisplay, setPriceDisplay] = useState('');
  const [advanceDisplay, setAdvanceDisplay] = useState('');
  
  // State for organization auto-suggest
  const [orgSuggestions, setOrgSuggestions] = useState<string[]>([]);
  const [filteredOrgSuggestions, setFilteredOrgSuggestions] = useState<string[]>([]);
  const [showOrgSuggestions, setShowOrgSuggestions] = useState(false);
  const orgInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    projectId: project?.projectId || nextProjectId || '',
    clientName: '',
    clientUniOrg: '',
    projectTypes: [] as string[],
    deadlineDate: '',
    price: 0,
    advance: 0,
    balance: 0,
    assignedTo: '',
    paymentOfEmp: 0,
    status: 'Pending' as Project['status'],
    fastDeliver: false,
  });
  
  // State for multiple employee assignments
  const [employeeAssignments, setEmployeeAssignments] = useState<EmployeeAssignment[]>([
    { employeeId: '', payment: 0 }
  ]);
  
  const [projectIdError, setProjectIdError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Sort project types by usage count (most used first)
  const sortedProjectTypes = useMemo(() => {
    return [...projectTypes].sort((a, b) => {
      const countA = typeUsageCount[a.id] || 0;
      const countB = typeUsageCount[b.id] || 0;
      return countB - countA; // Descending order (most used first)
    });
  }, [projectTypes, typeUsageCount]);

  // Expose submit function to parent component
  useImperativeHandle(ref, () => ({
    submit: () => {
      if (formRef.current) {
        formRef.current.requestSubmit();
      }
    }
  }));

  // ESC key handler to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
        
        // Fetch all projects to calculate type usage statistics
        const { data: projects, error: projectsError } = await supabase
          .from('projects')
          .select('project_description');
        
        if (projectsError) {
          console.error('Error fetching projects for usage stats:', projectsError);
        } else if (projects) {
          // Count usage of each type
          const usageCount: Record<string, number> = {};
          projects.forEach(project => {
            if (project.project_description) {
              const typeIds = project.project_description.split(',').map((id: string) => id.trim());
              typeIds.forEach((typeId: string) => {
                usageCount[typeId] = (usageCount[typeId] || 0) + 1;
              });
            }
          });
          setTypeUsageCount(usageCount);
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
        
        // Fetch unique organizations for auto-suggest
        const { data: orgsData, error: orgsError } = await supabase
          .from('projects')
          .select('client_uni_org');
        
        if (orgsError) {
          console.error('Error fetching organizations:', orgsError);
        } else if (orgsData) {
          // Extract unique, non-empty organization names
          const uniqueOrgs = [...new Set(
            orgsData
              .map(p => p.client_uni_org)
              .filter((org): org is string => org !== null && org !== undefined && org.trim() !== '')
          )].sort();
          setOrgSuggestions(uniqueOrgs);
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
        balance: project.balance || (project.price - project.advance),
        assignedTo: project.assignedTo,
        paymentOfEmp: project.paymentOfEmp,
        status: project.status,
        fastDeliver: (project as any).fastDeliver || false,
      });
      // Initialize display values for editing
      setPriceDisplay(project.price > 0 ? formatNumberWithSeparators(project.price) : '');
      setAdvanceDisplay(project.advance > 0 ? formatNumberWithSeparators(project.advance) : '');
    } else if (nextProjectId) {
      setFormData(prev => ({
        ...prev,
        projectId: nextProjectId,
      }));
    }
  }, [project, nextProjectId]);

  // Initialize employee assignments when editing a project
  useEffect(() => {
    if (project && employees.length > 0) {
      // Check if there's employee_payments array from database
      const empPaymentsData = project.employeePayments;
      
      if (empPaymentsData && Array.isArray(empPaymentsData) && empPaymentsData.length > 0) {
        // Use the stored employee_payments array directly
        const assignments = empPaymentsData.map(ep => ({
          employeeId: ep.employeeId,
          payment: ep.payment || 0
        }));
        setEmployeeAssignments(assignments);
      } else {
        // Fallback: Parse from assignedTo (comma-separated) for backward compatibility
        const assignedIds = project.assignedTo ? project.assignedTo.split(',').map(id => id.trim()).filter(Boolean) : [];
        
        if (assignedIds.length > 0) {
          // Distribute total payment to first employee, 0 to others (legacy support)
          const totalPayment = project.paymentOfEmp || 0;
          const assignments = assignedIds.map((id, index) => ({
            employeeId: id,
            payment: index === 0 ? totalPayment : 0
          }));
          setEmployeeAssignments(assignments);
        } else {
          setEmployeeAssignments([{ employeeId: '', payment: 0 }]);
        }
      }
    }
  }, [project, employees]);

  // Automatically calculate balance when price or advance changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      balance: prev.price - prev.advance
    }));
  }, [formData.price, formData.advance]);

  // Auto-fill payment when only one employee is assigned
  useEffect(() => {
    if (employeeAssignments.length === 1 && formData.price > 0) {
      // Only auto-fill if user hasn't manually set a different payment
      // or if this is a new project (payment is 0)
      const currentPayment = employeeAssignments[0].payment;
      if (currentPayment === 0 || !project) {
        setEmployeeAssignments(prev => [
          { ...prev[0], payment: formData.price }
        ]);
      }
    }
  }, [formData.price, employeeAssignments.length]);

  // Handle organization input with auto-suggest
  const handleOrgInputChange = (value: string) => {
    setFormData({ ...formData, clientUniOrg: value });
    
    if (value.trim().length > 0) {
      // Filter suggestions that include the input (case-insensitive)
      const filtered = orgSuggestions.filter(org => 
        org.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredOrgSuggestions(filtered);
      setShowOrgSuggestions(filtered.length > 0);
    } else {
      setFilteredOrgSuggestions([]);
      setShowOrgSuggestions(false);
    }
  };
  
  // Handle selecting a suggestion
  const handleOrgSuggestionSelect = (org: string) => {
    setFormData({ ...formData, clientUniOrg: org });
    setShowOrgSuggestions(false);
    setFilteredOrgSuggestions([]);
  };

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

  // Add a new employee assignment row
  const addEmployeeAssignment = () => {
    setEmployeeAssignments(prev => [...prev, { employeeId: '', payment: 0 }]);
  };

  // Remove an employee assignment row
  const removeEmployeeAssignment = (index: number) => {
    if (employeeAssignments.length > 1) {
      setEmployeeAssignments(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Update employee selection for a specific row
  const updateEmployeeId = (index: number, employeeId: string) => {
    setEmployeeAssignments(prev => 
      prev.map((assignment, i) => 
        i === index ? { ...assignment, employeeId } : assignment
      )
    );
  };

  // Update payment for a specific employee row
  const updateEmployeePayment = (index: number, payment: number) => {
    setEmployeeAssignments(prev => 
      prev.map((assignment, i) => 
        i === index ? { ...assignment, payment } : assignment
      )
    );
  };

  // Get available employees (exclude already selected ones)
  const getAvailableEmployees = (currentIndex: number) => {
    const selectedIds = employeeAssignments
      .filter((_, i) => i !== currentIndex)
      .map(a => a.employeeId)
      .filter(Boolean);
    return employees.filter(emp => !selectedIds.includes(emp.id));
  };

  // Calculate total employee payments
  const totalEmployeePayments = useMemo(() => {
    return employeeAssignments.reduce((sum, a) => sum + (a.payment || 0), 0);
  }, [employeeAssignments]);

  // Check if total payments exceed price (only for multiple employees)
  const isPaymentExceedingPrice = useMemo(() => {
    return employeeAssignments.length > 1 && totalEmployeePayments > formData.price;
  }, [employeeAssignments.length, totalEmployeePayments, formData.price]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate projectId
    if (!formData.projectId || !/^PJ\d{4,}$/.test(formData.projectId)) {
      setProjectIdError('Project ID must start with PJ and be followed by at least 4 digits (e.g., PJ1000)');
      return;
    } else {
      setProjectIdError(null);
    }
    
    // Filter out empty assignments and prepare data
    const validAssignments = employeeAssignments.filter(a => a.employeeId);
    const totalPayment = validAssignments.reduce((sum, a) => sum + (a.payment || 0), 0);
    
    // Validate: Total payments cannot exceed price when multiple employees
    if (validAssignments.length > 1 && totalPayment > formData.price) {
      setPaymentError(`Total payments (LKR ${totalPayment.toLocaleString()}) cannot exceed project price (LKR ${formData.price.toLocaleString()})`);
      return;
    } else {
      setPaymentError(null);
    }
    
    const assignedToIds = validAssignments.map(a => a.employeeId).join(',');
    
    // Format employee payments as array for JSONB storage
    const employeePaymentsArray = validAssignments.map(a => ({
      employeeId: a.employeeId,
      payment: a.payment
    }));
    
    console.log('Submitting project with assignments:', validAssignments);
    console.log('Employee payments array:', employeePaymentsArray);
    
    // Join projectTypes as a comma-separated string for DB compatibility
    onSave({
      ...formData,
      assignedTo: assignedToIds,
      paymentOfEmp: totalPayment,
      employeePayments: employeePaymentsArray, // Save as array for JSONB
      projectDescription: formData.projectTypes.join(','),
    });
  };

  const statuses: Project['status'][] = [
    'Running',
    'Pending',
    'Pending Payment',
    'Delivered',
    'Correction',
    'Rejected',
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xl flex items-center justify-center p-4 z-50" style={{ top: '-10%' }}>
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

          <form onSubmit={handleSubmit} className="space-y-4" ref={formRef}>
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

              <div className="relative">
                <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                  Client University/Organization
                </label>
                <input
                  ref={orgInputRef}
                  type="text"
                  value={formData.clientUniOrg}
                  onChange={(e) => handleOrgInputChange(e.target.value)}
                  onFocus={() => {
                    if (formData.clientUniOrg.trim().length > 0) {
                      const filtered = orgSuggestions.filter(org => 
                        org.toLowerCase().includes(formData.clientUniOrg.toLowerCase())
                      );
                      setFilteredOrgSuggestions(filtered);
                      setShowOrgSuggestions(filtered.length > 0);
                    }
                  }}
                  onBlur={() => {
                    // Delay hiding to allow click on suggestion
                    setTimeout(() => setShowOrgSuggestions(false), 200);
                  }}
                  className="w-full px-4 py-3 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] transition-all duration-300 font-['Inter']"
                  placeholder="Start typing to see suggestions..."
                  required
                  autoComplete="off"
                />
                
                {/* Organization Suggestions Dropdown */}
                {showOrgSuggestions && filteredOrgSuggestions.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-[#272121] border border-[#E16428]/40 rounded-lg shadow-lg max-h-48 overflow-auto">
                    {filteredOrgSuggestions.map((org, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleOrgSuggestionSelect(org)}
                        className="w-full px-4 py-2.5 text-left text-[#F6E9E9] hover:bg-[#E16428]/20 hover:text-[#E16428] transition-colors duration-150 text-sm font-['Inter'] border-b border-[#E16428]/10 last:border-b-0"
                      >
                        {/* Highlight matching text */}
                        {org.split(new RegExp(`(${formData.clientUniOrg})`, 'gi')).map((part, i) => (
                          <span 
                            key={i}
                            className={part.toLowerCase() === formData.clientUniOrg.toLowerCase() ? 'text-[#E16428] font-semibold' : ''}
                          >
                            {part}
                          </span>
                        ))}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                Project Description (Types)
              </label>
              <div 
                className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory -mx-1 px-1" 
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {sortedProjectTypes.map(type => (
                  <label 
                    key={type.id} 
                    className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border transition whitespace-nowrap flex-shrink-0 snap-start ${
                      formData.projectTypes.includes(type.id)
                        ? 'bg-[#E16428]/20 border-[#E16428] text-[#E16428]'
                        : 'bg-[#272121]/40 border-[#E16428]/20 text-[#F6E9E9] hover:bg-[#E16428]/10'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.projectTypes.includes(type.id)}
                      onChange={() => handleTypeChange(type.id)}
                      className="accent-[#E16428] w-4 h-4 rounded border-2 border-[#E16428] focus:ring-2 focus:ring-[#E16428] transition"
                    />
                    <span className="text-sm">{type.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  Price (LKR)
                </label>
                <input
                  type="text"
                  value={priceDisplay}
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    // Allow only digits and commas
                    if (/^[\d,]*$/.test(rawValue)) {
                      const numValue = parseFormattedNumber(rawValue);
                      setFormData({ ...formData, price: numValue });
                      // Format with separators while typing
                      setPriceDisplay(numValue > 0 ? formatNumberWithSeparators(numValue) : rawValue);
                    }
                  }}
                  onBlur={() => {
                    // Reformat on blur to ensure proper formatting
                    setPriceDisplay(formData.price > 0 ? formatNumberWithSeparators(formData.price) : '');
                  }}
                  placeholder="0"
                  className="w-full px-4 py-3 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] transition-all duration-300 font-['Inter']"
                  required
                />
              </div>

              <div>
                <label className="block text-[#F6E9E9] text-sm font-medium mb-2 font-['Inter']">
                  Advance (LKR)
                </label>
                <input
                  type="text"
                  value={advanceDisplay}
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    // Allow only digits and commas
                    if (/^[\d,]*$/.test(rawValue)) {
                      const numValue = parseFormattedNumber(rawValue);
                      setFormData({ ...formData, advance: numValue });
                      // Format with separators while typing
                      setAdvanceDisplay(numValue > 0 ? formatNumberWithSeparators(numValue) : rawValue);
                    }
                  }}
                  onBlur={() => {
                    // Reformat on blur to ensure proper formatting
                    setAdvanceDisplay(formData.advance > 0 ? formatNumberWithSeparators(formData.advance) : '');
                  }}
                  placeholder="0"
                  className="w-full px-4 py-3 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] transition-all duration-300 font-['Inter']"
                  required
                />
              </div>
            </div>

            {/* Employee Assignments Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-[#F6E9E9] text-sm font-medium font-['Inter']">
                  Assigned Employees & Payments
                </label>
                <button
                  type="button"
                  onClick={addEmployeeAssignment}
                  className="p-2 bg-[#E16428]/20 text-[#E16428] rounded-lg hover:bg-[#E16428]/30 transition-all duration-200"
                  title="Add Employee"
                >
                  <UserPlus className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-2">
                {employeeAssignments.map((assignment, index) => {
                  const availableEmployees = getAvailableEmployees(index);
                  const selectedEmp = employees.find(e => e.id === assignment.employeeId);
                  
                  return (
                    <div 
                      key={index} 
                      className="flex items-center gap-2 p-3 bg-[#272121]/30 rounded-lg border border-[#E16428]/10"
                    >
                      {/* Employee Dropdown */}
                      <div className="flex-1 min-w-0">
                        <Listbox 
                          value={selectedEmp || null} 
                          onChange={(emp) => updateEmployeeId(index, emp?.id || '')}
                        >
                          <div className="relative">
                            <Listbox.Button className="w-full px-3 py-2 bg-[#363333] border border-[#E16428]/40 rounded-lg text-[#F6E9E9] flex justify-between items-center text-sm">
                              <span className="truncate">
                                {selectedEmp
                                  ? `${selectedEmp.firstName} ${selectedEmp.lastName}`
                                  : loading
                                  ? 'Loading...'
                                  : 'Select employee'}
                              </span>
                              <ChevronDown className="w-4 h-4 ml-1 text-[#E16428] flex-shrink-0" />
                            </Listbox.Button>
                            <Listbox.Options className="absolute z-20 mt-1 w-full bg-[#272121] border border-[#E16428]/40 rounded-lg shadow-lg max-h-48 overflow-auto">
                              {loading ? (
                                <div className="px-3 py-2 text-[#F6E9E9]/70 text-center text-sm">
                                  Loading...
                                </div>
                              ) : availableEmployees.length === 0 ? (
                                <div className="px-3 py-2 text-[#F6E9E9]/70 text-center text-sm">
                                  No employees available
                                </div>
                              ) : (
                                availableEmployees.map(emp => (
                                  <Listbox.Option
                                    key={emp.id}
                                    value={emp}
                                    className={({ active, selected }: { active: boolean; selected: boolean }) =>
                                      `cursor-pointer select-none px-3 py-2 text-sm ${
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
                                        {selected && <Check className="w-3 h-3 ml-2 text-[#E16428]" />}
                                      </span>
                                    )}
                                  </Listbox.Option>
                                ))
                              )}
                            </Listbox.Options>
                          </div>
                        </Listbox>
                      </div>
                      
                      {/* Payment Input */}
                      <div className="w-32 flex-shrink-0">
                        <input
                          type="text"
                          value={assignment.payment > 0 ? formatNumberWithSeparators(assignment.payment) : ''}
                          onChange={e => {
                            const rawValue = e.target.value;
                            // Allow only digits and commas
                            if (/^[\d,]*$/.test(rawValue)) {
                              const numValue = parseFormattedNumber(rawValue);
                              updateEmployeePayment(index, numValue);
                            }
                          }}
                          placeholder="Payment"
                          className="w-full px-3 py-2 bg-[#272121]/50 border border-[#E16428]/20 rounded-lg text-[#F6E9E9] placeholder-[#F6E9E9]/50 focus:outline-none focus:border-[#E16428] transition-all duration-300 font-['Inter'] text-sm"
                        />
                      </div>
                      
                      {/* Remove Button */}
                      {employeeAssignments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEmployeeAssignment(index)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-all duration-200 flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Total Payment Summary */}
              {employeeAssignments.length > 1 && (
                <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                  isPaymentExceedingPrice 
                    ? 'bg-red-500/10 border-red-500/30' 
                    : 'bg-[#E16428]/10 border-[#E16428]/20'
                }`}>
                  <div className="flex flex-col">
                    <span className="text-[#F6E9E9]/70 text-sm font-['Inter']">Total Employee Payments:</span>
                    <span className="text-[#F6E9E9]/50 text-xs font-['Inter']">
                      Max: LKR {formData.price.toLocaleString()}
                    </span>
                  </div>
                  <span className={`font-bold font-['Inter'] ${
                    isPaymentExceedingPrice 
                      ? 'text-red-400' 
                      : totalEmployeePayments < 0 
                        ? 'text-yellow-400' 
                        : 'text-[#E16428]'
                  }`}>
                    LKR {totalEmployeePayments.toLocaleString()}
                  </span>
                </div>
              )}
              
              {/* Error for exceeding price */}
              {isPaymentExceedingPrice && (
                <div className="text-red-400 text-xs flex items-center gap-1 px-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="inline w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
                  </svg>
                  Total payments cannot exceed project price
                </div>
              )}
              
              {/* Payment validation error from submit */}
              {paymentError && (
                <div className="text-red-400 text-xs mt-1 px-1">{paymentError}</div>
              )}
              
              {/* Warning for negative payment */}
              {totalEmployeePayments < 0 && !isPaymentExceedingPrice && (
                <div className="text-yellow-400 text-xs flex items-center gap-1 px-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="inline w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
                  </svg>
                  Negative value: Employee owes company
                </div>
              )}
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
                data-shortcut="save"
                className="px-6 py-3 bg-gradient-to-r from-[#E16428] to-[#E16428]/80 text-white rounded-lg hover:scale-105 transition-all duration-300 shadow-lg font-['Poppins'] flex items-center gap-2"
              >
                {project ? 'Update' : 'Create'} Project
                {!isMobile && (
                  <kbd className="px-2 py-1 bg-white/20 rounded text-xs font-mono">Alt + S</kbd>
                )}
              </button>
            </div>
          </form>
        </div>
      </GlassCard>
    </div>
  );
});