import React, { useMemo } from 'react';
import { ArrowLeft, Mail, Phone, MapPin, Briefcase } from 'lucide-react';
import { Employee, Project } from '../types';
import { getEmployeeRemainingAmount, normalizeEmployeePayment } from '../utils/employeePayments';

interface EmployeeDetailProps {
  employee: Employee;
  projects: Project[];
  onBack: () => void;
  onToggleActive: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
}

function getInitials(firstName: string, lastName: string) {
  return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase() || '?';
}

function getAge(birthday: string) {
  if (!birthday) return null;
  const birthDate = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

export const EmployeeDetail: React.FC<EmployeeDetailProps> = ({
  employee,
  projects,
  onBack,
  onToggleActive,
  onEdit,
}) => {
  const isActive = employee.isActive !== false;
  const age = getAge(employee.birthday);

  const stats = useMemo(() => {
    const employeeProjects = projects.filter(p => {
      if (!p.assignedTo) return false;
      return p.assignedTo.split(',').map(id => id.trim()).includes(employee.id);
    });

    let totalPay = 0;
    let pendingPay = 0;

    employeeProjects.forEach(p => {
      if (p.employeePayments?.length) {
        const ep = p.employeePayments.find(x => x.employeeId === employee.id);
        if (!ep) return;
        const normalized = normalizeEmployeePayment(ep);
        if (!normalized) return;
        const amount = Math.abs(normalized.amount ?? normalized.payment ?? 0);
        totalPay += amount;
        pendingPay += getEmployeeRemainingAmount(normalized);
        return;
      }
      const ids = p.assignedTo ? p.assignedTo.split(',').map(id => id.trim()) : [];
      if (ids.length === 1 && ids[0] === employee.id) {
        const amount = Math.abs(p.paymentOfEmp || 0);
        totalPay += amount;
        if (p.paymentOfEmp < 0) pendingPay += amount;
      }
    });

    const completed = employeeProjects.filter(p => p.status === 'Delivered').length;
    const running = employeeProjects.filter(p => p.status === 'Running').length;

    return {
      employeeProjects: employeeProjects.sort(
        (a, b) => new Date(b.deadlineDate).getTime() - new Date(a.deadlineDate).getTime()
      ),
      total: employeeProjects.length,
      completed,
      running,
      totalPay,
      pendingPay,
      completionRate:
        employeeProjects.length > 0
          ? (completed / employeeProjects.length) * 100
          : 0,
    };
  }, [employee, projects]);

  const statusColor = (status: Project['status']) => {
    switch (status) {
      case 'Running':
        return 'text-blue-300 bg-blue-500/15';
      case 'Delivered':
        return 'text-green-300 bg-green-500/15';
      case 'Pending':
        return 'text-yellow-300 bg-yellow-500/15';
      case 'Pending Payment':
        return 'text-purple-300 bg-purple-500/15';
      case 'Correction':
        return 'text-orange-300 bg-orange-500/15';
      case 'Rejected':
        return 'text-red-300 bg-red-500/15';
      default:
        return 'text-[#F6E9E9]/60 bg-[#F6E9E9]/10';
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 animate-fadeIn">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-[#F6E9E9]/55 hover:text-[#E16428] transition-colors font-['Inter']"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to employees
      </button>

      {/* Profile */}
      <div className="rounded-xl border border-[#E16428]/15 bg-[#232021]/70 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-[#E16428]/15 border border-[#E16428]/25 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-semibold text-[#E16428] font-['Poppins']">
              {getInitials(employee.firstName, employee.lastName)}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-[#F6E9E9] font-['Playfair_Display'] truncate">
                {employee.firstName} {employee.lastName}
              </h1>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-['Inter'] ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-[#F6E9E9]/10 text-[#F6E9E9]/45'
                }`}
              >
                {isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-sm text-[#F6E9E9]/50 font-['Inter'] mt-0.5">
              {employee.position || 'No position'}
              {age != null && <span className="text-[#F6E9E9]/30"> · {age}y</span>}
              <span className="text-[#E16428]/80 font-mono text-xs ml-2">{employee.employeeId}</span>
            </p>

            <div className="mt-3 space-y-1.5 text-xs text-[#F6E9E9]/55 font-['Inter']">
              {employee.emailAddress && (
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="w-3.5 h-3.5 text-[#E16428]/60 flex-shrink-0" />
                  <span className="truncate">{employee.emailAddress}</span>
                </div>
              )}
              {employee.whatsappNumber && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-[#E16428]/60 flex-shrink-0" />
                  <span>{employee.whatsappNumber}</span>
                </div>
              )}
              {employee.address && (
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-[#E16428]/60 flex-shrink-0" />
                  <span className="truncate">{employee.address}</span>
                </div>
              )}
              {employee.qualifications && (
                <div className="flex items-center gap-2 min-w-0">
                  <Briefcase className="w-3.5 h-3.5 text-[#E16428]/60 flex-shrink-0" />
                  <span className="truncate">{employee.qualifications}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex sm:flex-col gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => onToggleActive(employee)}
              className={`px-3 py-2 rounded-lg text-xs font-['Poppins'] border transition-colors ${
                isActive
                  ? 'border-[#E16428]/25 text-[#F6E9E9]/70 hover:border-yellow-500/40 hover:text-yellow-400'
                  : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              {isActive ? 'Set inactive' : 'Set active'}
            </button>
            <button
              type="button"
              onClick={() => onEdit(employee)}
              className="px-3 py-2 rounded-lg text-xs font-['Poppins'] bg-[#E16428] text-white hover:bg-[#E16428]/90 transition-colors"
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Performance KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Projects', value: String(stats.total) },
          { label: 'Completed', value: String(stats.completed) },
          {
            label: 'Pay',
            value: (
              <span className="inline-flex items-baseline gap-1 flex-wrap">
                <span className="text-yellow-400">LKR {stats.pendingPay.toLocaleString()}</span>
                <span className="text-[#F6E9E9]/35 font-normal text-sm">/</span>
                <span>LKR {stats.totalPay.toLocaleString()}</span>
              </span>
            ),
          },
          { label: 'Success', value: `${stats.completionRate.toFixed(0)}%` },
        ].map(kpi => (
          <div
            key={kpi.label}
            className="rounded-xl border border-[#E16428]/15 bg-[#232021]/50 px-3 py-3"
          >
            <p className="text-[10px] uppercase tracking-wide text-[#F6E9E9]/40 font-['Inter']">
              {kpi.label}
            </p>
            <p className="mt-1 text-lg font-semibold text-[#F6E9E9] font-['Poppins'] leading-tight">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Project list */}
      <div className="rounded-xl border border-[#E16428]/15 bg-[#232021]/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E16428]/10">
          <h2 className="text-sm font-semibold text-[#F6E9E9] font-['Poppins']">
            Assigned projects
          </h2>
          <p className="text-[11px] text-[#F6E9E9]/40 font-['Inter'] mt-0.5">
            {stats.running} running · {stats.completed} delivered
          </p>
        </div>

        {stats.employeeProjects.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[#F6E9E9]/40 font-['Inter']">
            No projects assigned
          </div>
        ) : (
          <div className="divide-y divide-[#E16428]/10 max-h-[420px] overflow-y-auto">
            {stats.employeeProjects.map(project => {
              const ep = project.employeePayments?.find(x => x.employeeId === employee.id);
              const normalized = ep ? normalizeEmployeePayment(ep) : null;
              const pay = normalized
                ? Math.abs(normalized.amount ?? normalized.payment ?? 0)
                : project.assignedTo.split(',').map(id => id.trim()).length === 1
                ? Math.abs(project.paymentOfEmp)
                : 0;
              const remaining = normalized
                ? getEmployeeRemainingAmount(normalized)
                : project.paymentOfEmp < 0
                ? Math.abs(project.paymentOfEmp)
                : 0;
              const payPending = remaining > 0;

              return (
                <div
                  key={project.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#E16428]/5 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-[#F6E9E9] font-['Inter'] truncate">
                        {project.clientName}
                      </span>
                      <span className="text-[10px] font-mono text-[#E16428]/80 flex-shrink-0">
                        {project.projectId}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#F6E9E9]/40 mt-0.5 font-['Inter']">
                      Due {new Date(project.deadlineDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-xs font-medium font-['Inter'] ${
                        payPending ? 'text-yellow-400' : 'text-green-400/80'
                      }`}
                    >
                      LKR {pay.toLocaleString()}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-['Inter'] ${statusColor(
                        project.status
                      )}`}
                    >
                      {project.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
