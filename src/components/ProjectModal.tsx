import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, UserPlus, ChevronLeft, ChevronRight, CalendarDays, PlayCircle, Hourglass, CreditCard, CheckCircle2, Plus, Minus, Zap, BadgePercent, Layers, CircleDot, Loader2 } from 'lucide-react';
import { Project, Employee, EmployeePaymentStatus } from '../types';
import { supabase } from '../supabaseClient';
import { Listbox } from '@headlessui/react';
import { Check, ChevronDown } from 'lucide-react';
import { buildEmployeePayment, normalizeEmployeePayment } from '../utils/employeePayments';

const LayersPlusIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
    <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
    <path d="M13 17.5V22" />
    <path d="M15.5 19.5h-5" />
  </svg>
);
// Type for employee assignment with individual payment
interface EmployeeAssignment {
  employeeId: string;
  amount: number;
  paidAmount: number;
  status: EmployeePaymentStatus;
}

interface ProjectModalProps {
  project: Project | null;
  employees: Employee[];
  onClose: () => void;
  onSave: (
    project: Omit<Project, 'id'>,
    qty?: number,
    advanceForIds?: string[]
  ) => void | Promise<void>;
  nextProjectId?: string;
}

export interface ProjectModalRef {
  submit: () => void;
}

// Helper function to format number with thousand separators
const formatNumberWithSeparators = (value: number): string => {
  if (value === 0) return '0';
  return value.toLocaleString('en-US');
};

// Helper function to parse formatted number string to number (always >= 0)
const parseFormattedNumber = (value: string): number => {
  const digits = value.replace(/[^\d]/g, '');
  if (digits === '') return 0;
  return parseInt(digits, 10) || 0;
};

export const ProjectModal = forwardRef<ProjectModalRef, ProjectModalProps>(({
  project,
  employees: initialEmployees,
  onClose,
  onSave,
  nextProjectId,
}, ref) => {
  const [projectTypes, setProjectTypes] = useState<{ id: string; name: string }[]>([]);
  const [typeUsageCount, setTypeUsageCount] = useState<Record<string, number>>({});
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // State for formatted display values
  const [priceDisplay, setPriceDisplay] = useState('');
  const [advanceDisplay, setAdvanceDisplay] = useState('');
  const [discountDisplay, setDiscountDisplay] = useState('');
  
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
    status: 'Running' as Project['status'],
    fastDeliver: false,
    giveDiscount: false,
    discountAmount: 0,
  });
  
  // State for multiple employee assignments
  const [employeeAssignments, setEmployeeAssignments] = useState<EmployeeAssignment[]>([
    { employeeId: '', amount: 0, paidAmount: 0, status: 'pending' }
  ]);
  
  const [projectIdError, setProjectIdError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [advanceApplyToAll, setAdvanceApplyToAll] = useState(true);
  const [advanceForIds, setAdvanceForIds] = useState<Set<string>>(new Set());
  const formRef = useRef<HTMLFormElement>(null);
  const typesScrollRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const calendarPanelRef = useRef<HTMLDivElement>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarPos, setCalendarPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [calView, setCalView] = useState(() => {
    const base = project?.deadlineDate ? new Date(project.deadlineDate + 'T00:00:00') : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  const fieldClass =
    "underline-field w-full px-0 py-2 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] text-sm placeholder-[#F6E9E9]/35 focus:border-[#E16428] font-['Inter'] transition-[border-color]";
  const labelClass = "block text-[10px] uppercase tracking-wide text-[#F6E9E9]/45 mb-0.5 font-['Inter']";

  const updateCalendarPosition = () => {
    const trigger = calendarRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panelW = Math.min(288, Math.max(260, window.innerWidth - 24));
    const panelH = 340;
    const gap = 8;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openDown = spaceBelow >= panelH || spaceBelow >= spaceAbove;

    let top = openDown ? rect.bottom + gap : Math.max(12, rect.top - panelH - gap);
    // Keep fully on screen
    top = Math.max(12, Math.min(top, window.innerHeight - panelH - 12));
    let left = rect.left;
    left = Math.max(12, Math.min(left, window.innerWidth - panelW - 12));

    setCalendarPos({ top, left, width: panelW });
  };

  // Close calendar on outside click
  useEffect(() => {
    if (!showCalendar) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (calendarRef.current?.contains(target)) return;
      if (calendarPanelRef.current?.contains(target)) return;
      setShowCalendar(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showCalendar]);

  // Keep calendar in view on resize / scroll
  useEffect(() => {
    if (!showCalendar) return;
    updateCalendarPosition();
    const onMove = () => updateCalendarPosition();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [showCalendar]);

  const openCalendar = () => {
    const base = formData.deadlineDate
      ? new Date(formData.deadlineDate + 'T00:00:00')
      : new Date();
    setCalView({ year: base.getFullYear(), month: base.getMonth() });
    updateCalendarPosition();
    setShowCalendar(true);
    requestAnimationFrame(() => updateCalendarPosition());
  };

  const selectCalendarDate = (day: number) => {
    const y = calView.year;
    const m = String(calView.month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    setFormData({ ...formData, deadlineDate: `${y}-${m}-${d}` });
    setShowCalendar(false);
  };

  const formatDeadlineLabel = (value: string) => {
    if (!value) return '';
    const date = new Date(value + 'T00:00:00');
    if (isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getCalendarDays = () => {
    const first = new Date(calView.year, calView.month, 1);
    const startWeekday = first.getDay(); // 0 Sun
    const daysInMonth = new Date(calView.year, calView.month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  const shiftCalMonth = (delta: number) => {
    setCalView(prev => {
      const date = new Date(prev.year, prev.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  };

  // Sort project types by usage count (most used first)
  const sortedProjectTypes = useMemo(() => {
    return [...projectTypes].sort((a, b) => {
      const countA = typeUsageCount[a.id] || 0;
      const countB = typeUsageCount[b.id] || 0;
      return countB - countA; // Descending order (most used first)
    });
  }, [projectTypes, typeUsageCount]);

  // Keep types row scrolled to the start (nested overflow can leave it mid-list)
  useEffect(() => {
    const el = typesScrollRef.current;
    if (!el) return;
    el.scrollLeft = 0;
    // After layout / fonts settle
    const id = requestAnimationFrame(() => {
      if (typesScrollRef.current) typesScrollRef.current.scrollLeft = 0;
    });
    return () => cancelAnimationFrame(id);
  }, [sortedProjectTypes, project?.id]);

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
      if (event.key === 'Escape' && !isSaving) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isSaving]);

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
            whatsappNumber: emp.whatsapp || emp.whatsapp_number || emp.whatsappNumber,
            emailAddress: emp.email || emp.email_address || emp.emailAddress,
            qualifications: emp.qualifications,
            isActive: emp.is_active ?? emp.isActive ?? true,
            createdAt: emp.created_at || emp.createdAt,
          })).sort((a, b) =>
            `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
          );
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
        balance: project.balance || (project.price - project.advance - (project.giveDiscount ? (project.discountAmount || 0) : 0)),
        assignedTo: project.assignedTo,
        paymentOfEmp: project.paymentOfEmp,
        status: project.status,
        fastDeliver: project.fastDeliver || false,
        giveDiscount: project.giveDiscount || false,
        discountAmount: project.discountAmount || 0,
      });
      // Initialize display values for editing (including 0)
      setPriceDisplay(formatNumberWithSeparators(project.price));
      setAdvanceDisplay(formatNumberWithSeparators(project.advance));
      setDiscountDisplay(
        project.giveDiscount && project.discountAmount
          ? formatNumberWithSeparators(project.discountAmount)
          : ''
      );
    } else if (nextProjectId) {
      setFormData(prev => ({
        ...prev,
        projectId: nextProjectId,
      }));
      setQty(1);
      setAdvanceApplyToAll(true);
      setAdvanceForIds(new Set());
    }
  }, [project, nextProjectId]);

  // Initialize employee assignments when editing a project
  useEffect(() => {
    if (project && employees.length > 0) {
      // Check if there's employee_payments array from database
      const empPaymentsData = project.employeePayments;
      
      if (empPaymentsData && Array.isArray(empPaymentsData) && empPaymentsData.length > 0) {
        // Use the stored employee_payments array directly
        const assignments = empPaymentsData.map(ep => {
          const normalized = normalizeEmployeePayment(ep) || buildEmployeePayment(ep.employeeId, 0, 0);
          return {
            employeeId: normalized.employeeId,
            amount: normalized.amount,
            paidAmount: normalized.paidAmount,
            status: normalized.status,
          };
        });
        setEmployeeAssignments(assignments);
      } else {
        // Fallback: Parse from assignedTo (comma-separated) for backward compatibility
        const assignedIds = project.assignedTo ? project.assignedTo.split(',').map(id => id.trim()).filter(Boolean) : [];
        
        if (assignedIds.length > 0) {
          // Distribute total payment to first employee, 0 to others (legacy support)
          const totalPayment = Math.abs(project.paymentOfEmp || 0);
          const assignments = assignedIds.map((id, index) => ({
            employeeId: id,
            amount: index === 0 ? totalPayment : 0,
            paidAmount: 0,
            status: 'pending' as EmployeePaymentStatus,
          }));
          setEmployeeAssignments(assignments);
        } else {
          setEmployeeAssignments([{ employeeId: '', amount: 0, paidAmount: 0, status: 'pending' }]);
        }
      }
    }
  }, [project, employees]);

  // Automatically calculate balance when price, advance, or discount changes
  useEffect(() => {
    const discount = formData.giveDiscount ? formData.discountAmount : 0;
    setFormData(prev => ({
      ...prev,
      balance: prev.price - prev.advance - discount
    }));
  }, [formData.price, formData.advance, formData.giveDiscount, formData.discountAmount]);

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

  const handleGiveDiscount = () => {
    setFormData(prev => {
      const next = !prev.giveDiscount;
      if (!next) {
        setDiscountDisplay('');
        return { ...prev, giveDiscount: false, discountAmount: 0 };
      }
      return { ...prev, giveDiscount: true };
    });
  };

  // Add a new employee assignment row
  const addEmployeeAssignment = () => {
    setEmployeeAssignments(prev => [...prev, { employeeId: '', amount: 0, paidAmount: 0, status: 'pending' }]);
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

  // Update payment amount for a specific employee row (always >= 0)
  const updateEmployeePayment = (index: number, amount: number) => {
    setEmployeeAssignments(prev =>
      prev.map((assignment, i) => {
        if (i !== index) return assignment;
        const due = Math.abs(amount);
        if (due === 0) {
          const next = buildEmployeePayment(
            assignment.employeeId || 'tmp',
            0,
            0,
            assignment.status === 'paid' ? 'paid' : 'pending'
          );
          return {
            employeeId: assignment.employeeId,
            amount: next.amount,
            paidAmount: next.paidAmount,
            status: next.status,
          };
        }
        const paid =
          assignment.status === 'paid'
            ? due
            : Math.min(assignment.paidAmount || 0, due);
        const next = buildEmployeePayment(assignment.employeeId || 'tmp', due, paid);
        return {
          employeeId: assignment.employeeId,
          amount: next.amount,
          paidAmount: next.paidAmount,
          status: next.status,
        };
      })
    );
  };

  const toggleEmployeePaymentStatus = (index: number) => {
    setEmployeeAssignments(prev =>
      prev.map((assignment, i) => {
        if (i !== index) return assignment;
        const due = Math.abs(assignment.amount || 0);
        if (assignment.status === 'paid') {
          const next = buildEmployeePayment(assignment.employeeId || 'tmp', due, 0, 'pending');
          return {
            employeeId: assignment.employeeId,
            amount: next.amount,
            paidAmount: next.paidAmount,
            status: next.status,
          };
        }
        // Mark paid — works even when amount is 0
        const next = buildEmployeePayment(assignment.employeeId || 'tmp', due, due, 'paid');
        return {
          employeeId: assignment.employeeId,
          amount: next.amount,
          paidAmount: next.paidAmount,
          status: next.status,
        };
      })
    );
  };

  // Get available employees (exclude already selected ones; prefer active)
  const getAvailableEmployees = (currentIndex: number) => {
    const selectedIds = employeeAssignments
      .filter((_, i) => i !== currentIndex)
      .map(a => a.employeeId)
      .filter(Boolean);
    const currentId = employeeAssignments[currentIndex]?.employeeId;
    return employees.filter(emp => {
      if (selectedIds.includes(emp.id)) return false;
      // Always keep the currently selected employee visible (even if inactive)
      if (currentId && emp.id === currentId) return true;
      return emp.isActive !== false;
    });
  };

  // Calculate total employee payments
  const totalEmployeePayments = useMemo(() => {
    return employeeAssignments.reduce((sum, a) => sum + (a.amount || 0), 0);
  }, [employeeAssignments]);

  const hasPendingEmployeePayments = useMemo(
    () =>
      employeeAssignments.some(
        a => a.employeeId && a.amount > 0 && (a.status === 'pending' || a.status === 'partial')
      ),
    [employeeAssignments]
  );

  // Check if total payments exceed price (only for multiple employees)
  const isPaymentExceedingPrice = useMemo(() => {
    return employeeAssignments.length > 1 && totalEmployeePayments > formData.price;
  }, [employeeAssignments.length, totalEmployeePayments, formData.price]);

  const getSequentialPreview = (startId: string, count: number): string[] => {
    const match = startId.match(/^PJ(\d+)$/i);
    if (!match || count < 1) return startId ? [startId] : [];
    const startNum = parseInt(match[1], 10);
    return Array.from({ length: count }, (_, i) => `PJ${startNum + i}`);
  };

  const qtyPreviewIds = useMemo(() => {
    if (project || qty <= 1) return [];
    return getSequentialPreview(formData.projectId, qty);
  }, [project, qty, formData.projectId]);

  // Keep selective ID list in sync when QTY / start ID changes (only used when not apply-to-all)
  useEffect(() => {
    if (project || qty <= 1 || qtyPreviewIds.length === 0) {
      setAdvanceForIds(new Set());
      return;
    }
    if (!advanceApplyToAll) {
      setAdvanceForIds(new Set(qtyPreviewIds));
    }
  }, [project, qty, qtyPreviewIds.join('|'), advanceApplyToAll]);

  const toggleAdvanceForId = (id: string) => {
    setAdvanceForIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdvanceApplyToAll = () => {
    setAdvanceApplyToAll(prev => {
      const next = !prev;
      if (!next && qtyPreviewIds.length > 0) {
        setAdvanceForIds(new Set(qtyPreviewIds));
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    // Validate projectId
    if (!formData.projectId || !/^PJ\d{4,}$/.test(formData.projectId)) {
      setProjectIdError('Project ID must start with PJ and be followed by at least 4 digits (e.g., PJ1000)');
      return;
    } else {
      setProjectIdError(null);
    }

    if (!formData.deadlineDate) {
      setPaymentError('Please select a deadline date');
      return;
    }

    const safeQty = project ? 1 : Math.max(1, Math.min(50, Math.floor(qty) || 1));
    
    // Filter out empty assignments and prepare data
    const validAssignments = employeeAssignments.filter(a => a.employeeId);
    const totalPayment = validAssignments.reduce((sum, a) => sum + (a.amount || 0), 0);
    
    // Validate: Total payments cannot exceed price when multiple employees
    if (validAssignments.length > 1 && totalPayment > formData.price) {
      setPaymentError(`Total payments (LKR ${totalPayment.toLocaleString()}) cannot exceed project price (LKR ${formData.price.toLocaleString()})`);
      return;
    } else {
      setPaymentError(null);
    }
    
    const assignedToIds = validAssignments.map(a => a.employeeId).join(',');
    
    const employeePaymentsArray = validAssignments.map(a =>
      buildEmployeePayment(
        a.employeeId,
        a.amount || 0,
        a.paidAmount ?? 0,
        a.amount === 0 ? a.status : undefined
      )
    );

    const advanceIds =
      !project && safeQty > 1
        ? advanceApplyToAll
          ? undefined
          : Array.from(advanceForIds)
        : undefined;
    
    setIsSaving(true);
    try {
      await onSave(
        {
          ...formData,
          assignedTo: assignedToIds,
          paymentOfEmp: totalPayment,
          employeePayments: employeePaymentsArray,
          projectDescription: formData.projectTypes.join(','),
        },
        safeQty,
        advanceIds
      );
    } catch (err) {
      console.error('Error saving project:', err);
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 z-[9999] animate-fadeIn">
      <form
        onSubmit={handleSubmit}
        ref={formRef}
        className="relative bg-[#272121] border border-[#E16428]/25 rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto animate-scaleIn"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-[#E16428]/15 bg-[#272121]/95 backdrop-blur-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/logo_ogo.png" alt="OGO" className="w-7 h-7 object-contain flex-shrink-0" />
            <h2 className="text-sm font-semibold text-[#F6E9E9] font-['Poppins'] truncate">
              {project ? 'Edit Project' : 'Add New Project'}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              title="Close"
              aria-label="Close"
              className="size-7 min-w-7 min-h-7 max-w-7 max-h-7 flex-none box-border p-0 inline-flex items-center justify-center rounded-md text-[#F6E9E9]/60 hover:text-[#F6E9E9] hover:bg-[#E16428]/15 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* Project ID + QTY (add mode) */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <label className={labelClass}>
                Project ID <span className="text-[#E16428]">*</span>
              </label>
              <input
                type="text"
                value={formData.projectId}
                onChange={e => setFormData({ ...formData, projectId: e.target.value.toUpperCase() })}
                className="underline-field w-full h-[37px] px-0 py-0 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] text-sm placeholder-[#F6E9E9]/35 focus:border-[#E16428] font-['Inter'] transition-[border-color] box-border"
                placeholder="PJ1000"
                required
                maxLength={16}
              />
              {projectIdError && (
                <div className="text-red-400 text-[10px] mt-1">{projectIdError}</div>
              )}
            </div>

            {!project && (
              <div className="w-[6.75rem] shrink-0">
                <label className={labelClass}>QTY</label>
                <div className="underline-field flex items-center gap-0.5 w-full h-[37px] box-border px-0 border-0 border-b border-[#E16428]/30 focus-within:border-[#E16428] transition-[border-color]">
                  <button
                    type="button"
                    onClick={() => setQty(prev => Math.max(1, prev - 1))}
                    disabled={qty <= 1}
                    className="w-6 h-6 shrink-0 p-0 flex items-center justify-center rounded text-[#F6E9E9]/70 hover:text-[#E16428] hover:bg-[#E16428]/15 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#F6E9E9]/70 transition-colors"
                    title="Decrease"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    enterKeyHint="done"
                    autoComplete="off"
                    value={qty}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d]/g, '');
                      if (raw === '') {
                        setQty(1);
                        return;
                      }
                      const n = parseInt(raw, 10);
                      if (!isNaN(n)) setQty(Math.max(1, Math.min(50, n)));
                    }}
                    className="w-full min-w-0 flex-1 px-0 py-0 h-6 bg-transparent border-0 text-[#F6E9E9] text-sm text-center outline-none focus:outline-none focus:shadow-none font-['Inter'] leading-none"
                    title="Number of projects to create"
                  />
                  <button
                    type="button"
                    onClick={() => setQty(prev => Math.min(50, prev + 1))}
                    disabled={qty >= 50}
                    className="w-6 h-6 shrink-0 p-0 flex items-center justify-center rounded text-[#F6E9E9]/70 hover:text-[#E16428] hover:bg-[#E16428]/15 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#F6E9E9]/70 transition-colors"
                    title="Increase"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {!project && qty > 1 && qtyPreviewIds.length > 0 && (
            <p className="text-[10px] text-[#F6E9E9]/45 font-['Inter'] -mt-1">
              Will create:{' '}
              <span className="text-[#E16428]/90">
                {qtyPreviewIds.length <= 5
                  ? qtyPreviewIds.join(', ')
                  : `${qtyPreviewIds.slice(0, 3).join(', ')} … ${qtyPreviewIds[qtyPreviewIds.length - 1]}`}
              </span>
              {' '}({qty} projects)
            </p>
          )}

          {/* Client + Org */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Client Name</label>
              <input
                type="text"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                className={fieldClass}
                required
              />
            </div>

            <div className="relative">
              <label className={labelClass}>University / Organization</label>
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
                  setTimeout(() => setShowOrgSuggestions(false), 200);
                }}
                className={fieldClass}
                placeholder="Start typing..."
                required
                autoComplete="off"
              />
              {showOrgSuggestions && filteredOrgSuggestions.length > 0 && (
                <div className="absolute z-30 w-full mt-1 bg-[#232021] border border-[#E16428]/30 rounded-lg shadow-xl max-h-40 overflow-auto">
                  {filteredOrgSuggestions.map((org, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleOrgSuggestionSelect(org)}
                      className="w-full px-3 py-2 text-left text-[#F6E9E9] hover:bg-[#E16428]/15 text-xs font-['Inter'] border-b border-[#E16428]/10 last:border-b-0"
                    >
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

          {/* Project Types */}
          <div>
            <label className={labelClass}>Project Types</label>
            <div
              ref={typesScrollRef}
              className="flex gap-1.5 overflow-x-auto py-1"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {sortedProjectTypes.map(type => {
                const active = formData.projectTypes.includes(type.id);
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => handleTypeChange(type.id)}
                    className={`px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap flex-shrink-0 border transition-colors font-['Inter'] ${
                      active
                        ? 'bg-[#E16428]/20 border-[#E16428] text-[#E16428]'
                        : 'bg-transparent border-[#E16428]/25 text-[#F6E9E9]/60 hover:border-[#E16428]/50'
                    }`}
                  >
                    {type.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Deadline + Price + Advance */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Custom Calendar */}
            <div className="relative" ref={calendarRef}>
              <label className={labelClass}>Deadline</label>
              <button
                type="button"
                onClick={() => (showCalendar ? setShowCalendar(false) : openCalendar())}
                className={`${fieldClass} flex items-center justify-between text-left`}
              >
                <span className={formData.deadlineDate ? 'text-[#F6E9E9]' : 'text-[#F6E9E9]/35'}>
                  {formData.deadlineDate ? formatDeadlineLabel(formData.deadlineDate) : 'Select date'}
                </span>
                <CalendarDays className="w-3.5 h-3.5 text-[#E16428] flex-shrink-0" />
              </button>

              {showCalendar &&
                calendarPos &&
                createPortal(
                  <div
                    ref={calendarPanelRef}
                    className="fixed z-[10000] p-3 bg-[#232021] border border-[#E16428]/30 rounded-xl shadow-2xl"
                    style={{
                      top: calendarPos.top,
                      left: calendarPos.left,
                      width: calendarPos.width,
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <button
                        type="button"
                        onClick={() => shiftCalMonth(-1)}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-[#F6E9E9]/70 hover:bg-[#E16428]/15 hover:text-[#E16428]"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-semibold text-[#F6E9E9] font-['Poppins']">
                        {new Date(calView.year, calView.month).toLocaleString('default', {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={() => shiftCalMonth(1)}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-[#F6E9E9]/70 hover:bg-[#E16428]/15 hover:text-[#E16428]"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-0.5 mb-1">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                        <div
                          key={d}
                          className="text-center text-[9px] text-[#F6E9E9]/40 py-1 font-['Inter']"
                        >
                          {d}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-0.5">
                      {getCalendarDays().map((day, idx) => {
                        if (day === null) {
                          return <div key={`e-${idx}`} className="aspect-square" />;
                        }
                        const y = calView.year;
                        const m = String(calView.month + 1).padStart(2, '0');
                        const d = String(day).padStart(2, '0');
                        const iso = `${y}-${m}-${d}`;
                        const selected = formData.deadlineDate === iso;
                        const today = new Date();
                        const isToday =
                          today.getFullYear() === y &&
                          today.getMonth() === calView.month &&
                          today.getDate() === day;

                        return (
                          <button
                            key={iso}
                            type="button"
                            onClick={() => selectCalendarDate(day)}
                            className={`aspect-square rounded-md text-[11px] font-['Inter'] transition-colors ${
                              selected
                                ? 'bg-[#E16428] text-white'
                                : isToday
                                ? 'border border-[#E16428]/50 text-[#E16428]'
                                : 'text-[#F6E9E9]/80 hover:bg-[#E16428]/20'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>,
                  document.body
                )}
            </div>

            <div>
              <label className={labelClass}>Price (LKR)</label>
              <input
                type="text"
                inputMode="numeric"
                enterKeyHint="done"
                autoComplete="off"
                value={priceDisplay}
                onChange={(e) => {
                  const rawValue = e.target.value;
                  if (/^[\d,]*$/.test(rawValue)) {
                    const numValue = parseFormattedNumber(rawValue);
                    setFormData({ ...formData, price: numValue });
                    setPriceDisplay(numValue > 0 ? formatNumberWithSeparators(numValue) : rawValue);
                  }
                }}
                onBlur={() => {
                  setPriceDisplay(formData.price > 0 ? formatNumberWithSeparators(formData.price) : '');
                }}
                placeholder="0"
                className={fieldClass}
                required
              />
            </div>

            <div>
              <label className={labelClass}>Advance (LKR)</label>
              <input
                type="text"
                inputMode="numeric"
                enterKeyHint="done"
                autoComplete="off"
                value={advanceDisplay}
                onChange={(e) => {
                  const rawValue = e.target.value;
                  if (/^[\d,]*$/.test(rawValue)) {
                    const numValue = parseFormattedNumber(rawValue);
                    setFormData({ ...formData, advance: numValue });
                    setAdvanceDisplay(formatNumberWithSeparators(numValue));
                  }
                }}
                onBlur={() => {
                  setAdvanceDisplay(formatNumberWithSeparators(formData.advance));
                }}
                placeholder="0"
                className={fieldClass}
                required
              />
            </div>

            {/* Give Discount (left) + Apply advance to all (right, when QTY > 1) */}
            <div className="sm:col-span-3 space-y-1.5 min-w-0">
              <div className="flex items-end gap-2 min-w-0">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={formData.giveDiscount}
                  onClick={handleGiveDiscount}
                  title="Give Discount"
                  aria-label="Give Discount"
                  className={`w-9 h-9 aspect-square shrink-0 p-0 flex items-center justify-center bg-transparent border-0 border-b rounded-none transition-colors ${
                    formData.giveDiscount
                      ? 'border-[#E16428] text-[#E16428]'
                      : 'border-[#E16428]/30 text-[#F6E9E9]/45 hover:border-[#E16428]/55 hover:text-[#F6E9E9]/70'
                  }`}
                >
                  <BadgePercent className="w-4 h-4" strokeWidth={2.25} />
                </button>

                {formData.giveDiscount && (
                  <div className="flex-1 min-w-0">
                    <label className={labelClass}>Discount (LKR)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      enterKeyHint="done"
                      autoComplete="off"
                      value={discountDisplay}
                      onChange={(e) => {
                        const rawValue = e.target.value;
                        if (rawValue === '') {
                          setFormData({ ...formData, discountAmount: 0 });
                          setDiscountDisplay('');
                          return;
                        }
                        if (!/^[\d,]*$/.test(rawValue)) return;
                        const numValue = parseFormattedNumber(rawValue);
                        const clamped =
                          formData.price > 0 ? Math.min(numValue, formData.price) : numValue;
                        setFormData({ ...formData, discountAmount: clamped });
                        setDiscountDisplay(formatNumberWithSeparators(clamped));
                      }}
                      onBlur={() => {
                        setDiscountDisplay(
                          formData.discountAmount > 0
                            ? formatNumberWithSeparators(formData.discountAmount)
                            : ''
                        );
                      }}
                      placeholder="0"
                      className={fieldClass}
                    />
                  </div>
                )}

                {!formData.giveDiscount && <div className="flex-1 min-w-0" />}

                {!project && qty > 1 && qtyPreviewIds.length > 0 && (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={advanceApplyToAll}
                    onClick={handleAdvanceApplyToAll}
                    title="Apply to all"
                    aria-label="Apply to all"
                    className={`w-9 h-9 aspect-square shrink-0 p-0 flex items-center justify-center bg-transparent border-0 border-b rounded-none transition-colors ml-auto ${
                      advanceApplyToAll
                        ? 'border-[#E16428] text-[#E16428]'
                        : 'border-[#E16428]/30 text-[#F6E9E9]/45 hover:border-[#E16428]/55 hover:text-[#F6E9E9]/70'
                    }`}
                  >
                    <Layers className="w-4 h-4" strokeWidth={2.25} />
                  </button>
                )}
              </div>

              {!project && qty > 1 && !advanceApplyToAll && qtyPreviewIds.length > 0 && (
                <div
                  className="flex flex-nowrap items-center gap-1 overflow-x-auto min-w-0 py-0.5"
                  style={{ scrollbarWidth: 'none' }}
                >
                  {qtyPreviewIds.map(id => {
                    const checked = advanceForIds.has(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => toggleAdvanceForId(id)}
                        title={id}
                        className={`inline-flex items-center gap-1 px-0 py-1 bg-transparent border-0 border-b rounded-none text-[10px] font-['Inter'] whitespace-nowrap flex-shrink-0 transition-colors ${
                          checked
                            ? 'border-[#E16428] text-[#E16428]'
                            : 'border-[#E16428]/30 text-[#F6E9E9]/45 hover:border-[#E16428]/55 hover:text-[#F6E9E9]/70'
                        }`}
                      >
                        <span
                          className={`w-2.5 h-2.5 rounded-sm border flex items-center justify-center flex-shrink-0 ${
                            checked
                              ? 'bg-[#E16428] border-[#E16428]'
                              : 'border-[#E16428]/35 bg-transparent'
                          }`}
                        >
                          {checked && <Check className="w-1.5 h-1.5 text-white" strokeWidth={3} />}
                        </span>
                        {id}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Employee Assignments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={`${labelClass} mb-0`}>Assigned Employees</label>
              <button
                type="button"
                onClick={addEmployeeAssignment}
                className="w-7 h-7 flex items-center justify-center rounded-md text-[#E16428] hover:bg-[#E16428]/15 transition-colors"
                title="Add Employee"
              >
                <UserPlus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {employeeAssignments.map((assignment, index) => {
                const availableEmployees = getAvailableEmployees(index);
                const selectedEmp = employees.find(e => e.id === assignment.employeeId);

                return (
                  <div key={index} className="flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                      <Listbox
                        value={selectedEmp || null}
                        by="id"
                        onChange={(emp) => updateEmployeeId(index, emp?.id || '')}
                      >
                        <div className="relative">
                          <Listbox.Button className={`${fieldClass} flex justify-between items-center text-left`}>
                            <span className={`truncate ${selectedEmp ? '' : 'text-[#F6E9E9]/35'}`}>
                              {selectedEmp
                                ? `${selectedEmp.firstName} ${selectedEmp.lastName}`
                                : loading
                                ? 'Loading...'
                                : 'Select employee'}
                            </span>
                            <ChevronDown className="w-3.5 h-3.5 ml-1 text-[#E16428] flex-shrink-0" />
                          </Listbox.Button>
                          <Listbox.Options className="absolute z-30 mt-1 w-full bg-[#232021] border border-[#E16428]/30 rounded-lg shadow-xl max-h-40 overflow-auto">
                            {loading ? (
                              <div className="px-3 py-2 text-[#F6E9E9]/50 text-center text-xs">Loading...</div>
                            ) : availableEmployees.length === 0 ? (
                              <div className="px-3 py-2 text-[#F6E9E9]/50 text-center text-xs">No employees</div>
                            ) : (
                              availableEmployees.map(emp => (
                                <Listbox.Option
                                  key={emp.id}
                                  value={emp}
                                  className={({ active, selected }: { active: boolean; selected: boolean }) =>
                                    `cursor-pointer select-none px-3 py-2 text-xs ${
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

                    <div className="w-24 flex-shrink-0">
                      <input
                        type="text"
                        inputMode="numeric"
                        enterKeyHint="done"
                        autoComplete="off"
                        value={formatNumberWithSeparators(assignment.amount || 0)}
                        onChange={e => {
                          const rawValue = e.target.value;
                          if (/^[\d,]*$/.test(rawValue)) {
                            const numValue = rawValue === '' ? 0 : parseFormattedNumber(rawValue);
                            updateEmployeePayment(index, numValue);
                          }
                        }}
                        placeholder="0"
                        className={fieldClass}
                      />
                    </div>

                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={assignment.status === 'paid'}
                      onClick={() => toggleEmployeePaymentStatus(index)}
                      title={
                        assignment.status === 'paid'
                          ? 'Paid — click for pending'
                          : assignment.status === 'partial'
                          ? `Partial (paid ${assignment.paidAmount}) — click to mark paid`
                          : 'Pending — click for paid'
                      }
                      aria-label={assignment.status === 'paid' ? 'Mark pending' : 'Mark paid'}
                      className={`w-8 h-9 flex-shrink-0 flex items-center justify-center bg-transparent border-0 border-b rounded-none transition-colors ${
                        assignment.status === 'paid'
                          ? 'border-green-500/50 text-green-400'
                          : assignment.status === 'partial'
                          ? 'border-blue-500/50 text-blue-400'
                          : 'border-yellow-500/40 text-yellow-400'
                      }`}
                    >
                      {assignment.status === 'paid' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : assignment.status === 'partial' ? (
                        <CircleDot className="w-3.5 h-3.5" />
                      ) : (
                        <Hourglass className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {employeeAssignments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEmployeeAssignment(index)}
                        className="w-7 h-7 mb-1 flex items-center justify-center rounded-md text-red-400 hover:bg-red-500/15 flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {employeeAssignments.length > 1 && (
              <div className={`flex items-center justify-between px-0 py-1.5 border-b ${
                isPaymentExceedingPrice ? 'border-red-500/40' : 'border-[#E16428]/20'
              }`}>
                <span className="text-[10px] text-[#F6E9E9]/50 font-['Inter']">
                  Total / Max {formData.price.toLocaleString()}
                </span>
                <span className={`text-xs font-semibold font-['Inter'] ${
                  isPaymentExceedingPrice
                    ? 'text-red-400'
                    : hasPendingEmployeePayments
                    ? 'text-yellow-400'
                    : 'text-[#E16428]'
                }`}>
                  LKR {totalEmployeePayments.toLocaleString()}
                </span>
              </div>
            )}

            {isPaymentExceedingPrice && (
              <div className="text-red-400 text-[10px]">Total payments cannot exceed project price</div>
            )}
            {paymentError && (
              <div className="text-red-400 text-[10px]">{paymentError}</div>
            )}
            {hasPendingEmployeePayments && !isPaymentExceedingPrice && (
              <div className="text-yellow-400 text-[10px]">Pending employee payment(s)</div>
            )}
          </div>

          {/* Status — icon only (+ Fast Deliver & Save) */}
          <div>
            <label className={labelClass}>Status</label>
            <div className="grid grid-cols-6 gap-1">
              {([
                { status: 'Running' as const, icon: PlayCircle, activeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
                { status: 'Pending' as const, icon: Hourglass, activeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
                { status: 'Pending Payment' as const, icon: CreditCard, activeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
                { status: 'Delivered' as const, icon: CheckCircle2, activeClass: 'bg-green-500/20 text-green-300 border-green-500/40' },
              ]).map(({ status, icon: Icon, activeClass }) => {
                const active = formData.status === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setFormData({ ...formData, status })}
                    title={status}
                    aria-label={status}
                    aria-pressed={active}
                    className={`aspect-square w-full flex items-center justify-center rounded-md border transition-colors ${
                      active
                        ? activeClass
                        : 'bg-transparent text-[#F6E9E9]/50 border-[#E16428]/20 hover:border-[#E16428]/40 hover:text-[#F6E9E9]/80'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                );
              })}

              <button
                type="button"
                role="checkbox"
                aria-checked={formData.fastDeliver}
                onClick={handleFastDeliver}
                title="Fast Deliver"
                aria-label="Fast Deliver"
                className={`aspect-square w-full flex items-center justify-center rounded-md border transition-colors ${
                  formData.fastDeliver
                    ? 'bg-[#E16428]/15 text-[#E16428] border-[#E16428]/50'
                    : 'bg-transparent text-[#F6E9E9]/50 border-[#E16428]/20 hover:border-[#E16428]/40 hover:text-[#F6E9E9]/80'
                }`}
              >
                <Zap className="w-3.5 h-3.5" strokeWidth={2.25} fill={formData.fastDeliver ? 'currentColor' : 'none'} />
              </button>

              <button
                type="submit"
                data-shortcut="save"
                disabled={isSaving}
                title={project ? 'Update project (Alt+S)' : 'Create project (Alt+S)'}
                aria-label={project ? 'Update project' : 'Create project'}
                className="aspect-square w-full flex items-center justify-center rounded-md border border-[#E16428]/50 bg-[#E16428] text-white hover:bg-[#E16428]/90 transition-colors disabled:opacity-60"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LayersPlusIcon className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {isSaving && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-2xl bg-[#272121]/85 backdrop-blur-[2px]">
            <Loader2 className="w-8 h-8 text-[#E16428] animate-spin" />
            <p className="mt-3 text-xs font-semibold text-[#F6E9E9] font-['Poppins']">
              {project ? 'Updating project…' : 'Creating project…'}
            </p>
            <p className="mt-1 text-[10px] text-[#F6E9E9]/45 font-['Inter']">Please wait…</p>
          </div>
        )}
      </form>
    </div>,
    document.body
  );
});