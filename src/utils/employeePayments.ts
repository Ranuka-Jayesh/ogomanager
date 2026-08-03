import { EmployeePayment, EmployeePaymentStatus } from '../types';
import { supabase } from '../supabaseClient';

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

/** projects.id is integer in live DB; offline temp IDs are UUIDs */
export const toProjectPk = (id: string | number): number | null => {
  if (typeof id === 'number' && Number.isInteger(id)) return id;
  const n = Number(id);
  return Number.isInteger(n) ? n : null;
};

export const deriveEmployeePaymentStatus = (
  amount: number,
  paidAmount: number,
  explicitStatus?: EmployeePaymentStatus | null
): EmployeePaymentStatus => {
  const due = Math.abs(amount);
  // Zero-due rows can still be marked paid (e.g. free / no emp pay)
  if (due === 0) {
    return explicitStatus === 'paid' ? 'paid' : 'pending';
  }
  const paid = Math.max(0, Math.min(Math.abs(paidAmount), due));
  if (paid <= 0) return 'pending';
  if (paid >= due) return 'paid';
  if (paid > 0) return 'partial';
  return 'pending';
};

export const getEmployeePaidAmount = (p: EmployeePayment | undefined | null): number => {
  if (!p) return 0;
  const due = Math.abs(p.amount ?? p.payment ?? 0);
  if (due === 0) return p.status === 'paid' ? 0 : 0;
  if (p.paidAmount != null && Number.isFinite(p.paidAmount)) {
    return Math.max(0, Math.min(Math.abs(p.paidAmount), due));
  }
  if (p.status === 'paid') return due;
  if (p.status === 'partial') return 0;
  return 0;
};

export const getEmployeeRemainingAmount = (p: EmployeePayment | undefined | null): number => {
  if (!p) return 0;
  const due = Math.abs(p.amount ?? p.payment ?? 0);
  if (due === 0) return p.status === 'paid' ? 0 : 0;
  return Math.max(0, due - getEmployeePaidAmount(p));
};

export const buildEmployeePayment = (
  employeeId: string,
  amount: number,
  paidAmount: number,
  explicitStatus?: EmployeePaymentStatus | null
): EmployeePayment => {
  const due = Math.abs(amount);
  if (due === 0) {
    const status: EmployeePaymentStatus = explicitStatus === 'paid' ? 'paid' : 'pending';
    return {
      employeeId,
      amount: 0,
      payment: 0,
      paidAmount: 0,
      status,
    };
  }
  const paid = Math.max(0, Math.min(Math.abs(paidAmount), due));
  return {
    employeeId,
    amount: due,
    payment: due,
    paidAmount: paid,
    status: deriveEmployeePaymentStatus(due, paid),
  };
};

export type EmployeePaymentAction = 'full' | 'partial' | 'return';

export const applyEmployeePaymentAction = (
  payment: EmployeePayment,
  action: EmployeePaymentAction,
  value = 0
): EmployeePayment => {
  const due = Math.abs(payment.amount ?? payment.payment ?? 0);
  let paid = getEmployeePaidAmount(payment);

  if (action === 'full') {
    paid = due;
    return buildEmployeePayment(payment.employeeId, due, paid, due === 0 ? 'paid' : undefined);
  } else if (action === 'partial') {
    paid = Math.min(due, paid + Math.max(0, value));
  } else if (action === 'return') {
    if (due === 0) {
      return buildEmployeePayment(payment.employeeId, 0, 0, 'pending');
    }
    paid = Math.max(0, paid - Math.max(0, value));
  }

  return buildEmployeePayment(payment.employeeId, due, paid);
};

export const normalizeEmployeePayment = (raw: any): EmployeePayment | null => {
  if (!raw) return null;

  const employeeId = raw.employeeId || raw.employee_id || '';
  if (!employeeId) return null;

  // New table / new JSONB shape with amount + status (+ optional paidAmount)
  if (raw.amount !== undefined || raw.status !== undefined || raw.paidAmount !== undefined || raw.paid_amount !== undefined) {
    const amount = Math.abs(toNumber(raw.amount ?? raw.payment));
    let paidAmount: number;
    if (raw.paidAmount !== undefined || raw.paid_amount !== undefined) {
      paidAmount = Math.abs(toNumber(raw.paidAmount ?? raw.paid_amount));
    } else if (raw.status === 'paid') {
      paidAmount = amount;
    } else if (raw.status === 'partial') {
      // Legacy partial without paidAmount — treat as half only if explicitly partial with no paid field
      paidAmount = 0;
    } else {
      paidAmount = 0;
    }
    return buildEmployeePayment(
      String(employeeId),
      amount,
      paidAmount,
      amount === 0 && raw.status === 'paid' ? 'paid' : undefined
    );
  }

  // Legacy signed payment: negative = pending, positive = paid
  const signed = toNumber(raw.payment);
  const amount = Math.abs(signed);
  const paidAmount = signed < 0 ? 0 : amount;
  return buildEmployeePayment(String(employeeId), amount, paidAmount);
};

export const parseEmployeePayments = (data: unknown): EmployeePayment[] => {
  let list: any[] = [];
  if (!data) return [];
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      list = Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  } else if (Array.isArray(data)) {
    list = data;
  } else {
    return [];
  }

  return list
    .map(normalizeEmployeePayment)
    .filter((p): p is EmployeePayment => p !== null);
};

export const mapTableRowToEmployeePayment = (row: any): EmployeePayment | null => {
  return normalizeEmployeePayment({
    employeeId: row.employee_id,
    amount: row.amount,
    paidAmount: row.paid_amount,
    status: row.status,
  });
};

export const totalEmployeePaymentAmount = (payments: EmployeePayment[] | undefined): number => {
  if (!payments?.length) return 0;
  return payments.reduce((sum, p) => sum + Math.abs(p.amount ?? p.payment ?? 0), 0);
};

/** Sum of still-unpaid remainders (pending + partial). */
export const totalEmployeePaymentPending = (payments: EmployeePayment[] | undefined): number => {
  if (!payments?.length) return 0;
  return payments.reduce((sum, p) => sum + getEmployeeRemainingAmount(p), 0);
};

/** Sum of amounts already paid. */
export const totalEmployeePaymentPaid = (payments: EmployeePayment[] | undefined): number => {
  if (!payments?.length) return 0;
  return payments.reduce((sum, p) => sum + getEmployeePaidAmount(p), 0);
};

type ProjectPaymentSource = {
  employeePayments?: EmployeePayment[];
  paymentOfEmp?: number;
};

/** Total employee pay owed on a project (due). */
export const getProjectEmployeePaymentsDue = (project: ProjectPaymentSource): number => {
  if (project.employeePayments && project.employeePayments.length > 0) {
    return totalEmployeePaymentAmount(
      project.employeePayments
        .map(normalizeEmployeePayment)
        .filter((p): p is EmployeePayment => p !== null)
    );
  }
  return Math.abs(project.paymentOfEmp || 0);
};

/** Amount already paid to employees on a project. */
export const getProjectEmployeePaymentsPaid = (project: ProjectPaymentSource): number => {
  if (project.employeePayments && project.employeePayments.length > 0) {
    return totalEmployeePaymentPaid(
      project.employeePayments
        .map(normalizeEmployeePayment)
        .filter((p): p is EmployeePayment => p !== null)
    );
  }
  const v = project.paymentOfEmp || 0;
  return v > 0 ? Math.abs(v) : 0;
};

/** Unpaid remainder owed to employees on a project. */
export const getProjectEmployeePaymentsPending = (project: ProjectPaymentSource): number => {
  if (project.employeePayments && project.employeePayments.length > 0) {
    return totalEmployeePaymentPending(
      project.employeePayments
        .map(normalizeEmployeePayment)
        .filter((p): p is EmployeePayment => p !== null)
    );
  }
  const v = project.paymentOfEmp || 0;
  return v < 0 ? Math.abs(v) : 0;
};

/** One employee's due / paid / remaining on a project. */
export const getEmployeeProjectPaymentBreakdown = (
  project: ProjectPaymentSource & { assignedTo?: string },
  employeeId: string
): { due: number; paid: number; remaining: number } => {
  if (project.employeePayments && project.employeePayments.length > 0) {
    const found = project.employeePayments.find(ep => ep.employeeId === employeeId);
    const normalized = normalizeEmployeePayment(found);
    if (!normalized) return { due: 0, paid: 0, remaining: 0 };
    return {
      due: Math.abs(normalized.amount ?? normalized.payment ?? 0),
      paid: getEmployeePaidAmount(normalized),
      remaining: getEmployeeRemainingAmount(normalized),
    };
  }
  const ids = project.assignedTo
    ? project.assignedTo.split(',').map(id => id.trim()).filter(Boolean)
    : [];
  if (ids.length === 1 && ids[0] === employeeId) {
    const due = Math.abs(project.paymentOfEmp || 0);
    const pending = (project.paymentOfEmp || 0) < 0;
    return {
      due,
      paid: pending ? 0 : due,
      remaining: pending ? due : 0,
    };
  }
  return { due: 0, paid: 0, remaining: 0 };
};

export const isEmployeePaymentPending = (p: EmployeePayment | undefined | null): boolean => {
  if (!p) return false;
  return getEmployeeRemainingAmount(p) > 0;
};

/** Serialize for projects.employee_payments JSONB (offline cache / dual-write) */
export const toEmployeePaymentsJson = (payments: EmployeePayment[]) =>
  payments.map(p => {
    const due = Math.abs(p.amount ?? p.payment ?? 0);
    const normalized = buildEmployeePayment(
      p.employeeId,
      due,
      getEmployeePaidAmount(p),
      due === 0 ? p.status : undefined
    );
    return {
      employeeId: normalized.employeeId,
      amount: normalized.amount,
      paidAmount: normalized.paidAmount,
      status: normalized.status,
      payment: normalized.amount,
    };
  });

/**
 * Replace employee_payments rows for a project.
 * No-ops when project id is not an integer (offline temp UUID).
 */
export async function syncProjectEmployeePayments(
  projectId: string | number,
  payments: EmployeePayment[]
): Promise<void> {
  const pk = toProjectPk(projectId);
  if (pk === null) return;

  const { data: existing, error: fetchError } = await supabase
    .from('employee_payments')
    .select('id, employee_id')
    .eq('project_id', pk);

  if (fetchError) {
    console.error('Failed to load employee_payments for sync:', fetchError);
    throw fetchError;
  }

  const keep = new Set(payments.map(p => p.employeeId));
  const toDelete = (existing || []).filter(row => !keep.has(row.employee_id));

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('employee_payments')
      .delete()
      .in(
        'id',
        toDelete.map(row => row.id)
      );
    if (deleteError) throw deleteError;
  }

  if (payments.length === 0) return;

  const rows = payments.map(p => {
    const due = Math.abs(p.amount ?? p.payment ?? 0);
    const normalized = buildEmployeePayment(
      p.employeeId,
      due,
      getEmployeePaidAmount(p),
      due === 0 ? p.status : undefined
    );
    return {
      project_id: pk,
      employee_id: normalized.employeeId,
      amount: normalized.amount,
      paid_amount: normalized.paidAmount,
      status: normalized.status,
      paid_at: normalized.status === 'paid' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
  });

  const { error: upsertError } = await supabase
    .from('employee_payments')
    .upsert(rows, { onConflict: 'project_id,employee_id' });

  if (upsertError) throw upsertError;
}

/** Fetch all employee_payments and group by project_id (string key) */
export async function fetchEmployeePaymentsByProject(): Promise<
  Record<string, EmployeePayment[]>
> {
  const { data, error } = await supabase.from('employee_payments').select('*');
  if (error) {
    console.error('Error fetching employee_payments:', error);
    return {};
  }

  const byProject: Record<string, EmployeePayment[]> = {};
  for (const row of data || []) {
    const mapped = mapTableRowToEmployeePayment(row);
    if (!mapped) continue;
    const key = String(row.project_id);
    if (!byProject[key]) byProject[key] = [];
    byProject[key].push(mapped);
  }
  return byProject;
}

/** Attach table payments onto project DB rows (prefer table over JSONB) */
export function attachEmployeePaymentsToProjectRows(
  projects: any[],
  byProject: Record<string, EmployeePayment[]>
): any[] {
  return projects.map(project => {
    const fromTable = byProject[String(project.id)];
    if (fromTable && fromTable.length > 0) {
      return {
        ...project,
        employee_payments: toEmployeePaymentsJson(fromTable),
        payment_of_emp: totalEmployeePaymentAmount(fromTable),
      };
    }

    // Normalize legacy JSONB in place
    const normalized = parseEmployeePayments(project.employee_payments);
    if (normalized.length > 0) {
      return {
        ...project,
        employee_payments: toEmployeePaymentsJson(normalized),
        payment_of_emp:
          project.payment_of_emp != null
            ? Math.abs(toNumber(project.payment_of_emp))
            : totalEmployeePaymentAmount(normalized),
      };
    }

    return {
      ...project,
      payment_of_emp: Math.abs(toNumber(project.payment_of_emp)),
    };
  });
}
