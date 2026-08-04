export type EmployeePaymentStatus = 'pending' | 'partial' | 'paid';

// Type for individual employee payment assignment
export interface EmployeePayment {
  employeeId: string;
  /** Total amount owed to the employee (always >= 0). Prefer this over payment. */
  amount: number;
  /** Amount already paid toward amount (0..amount). */
  paidAmount: number;
  status: EmployeePaymentStatus;
  /**
   * Display amount (always >= 0). Same as amount.
   * Kept for older call sites; do not use sign for status.
   */
  payment: number;
}

export interface Project {
  id: string;
  projectId: string;
  clientName: string;
  clientUniOrg: string;
  projectDescription: string;
  deadlineDate: string;
  price: number;
  advance: number;
  balance: number;
  assignedTo: string; // Comma-separated employee IDs for multiple assignments
  paymentOfEmp: number; // Total payment for all employees
  employeePayments?: EmployeePayment[]; // Array of individual employee payments
  status: 'Running' | 'Pending' | 'Pending Payment' | 'Delivered' | 'Correction' | 'Rejected';
  fastDeliver?: boolean;
  giveDiscount?: boolean;
  discountAmount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Employee {
  id: string;
  employeeId: string;
  birthday: string;
  firstName: string;
  lastName: string;
  position: string;
  address: string;
  whatsappNumber: string;
  emailAddress: string;
  qualifications: string;
  /** Defaults to true when missing (legacy rows). */
  isActive?: boolean;
  /** When true, employee appears in Analytics → Employee Performance. Defaults to true. */
  showInPerformance?: boolean;
  createdAt?: string;
}

export type ExpenseType = 'subscription' | 'one_time';
export type ExpenseBillingCycle = 'monthly' | 'yearly';
export type ExpenseStatus = 'active' | 'paused' | 'cancelled' | 'paid';
export type ExpenseCategory =
  | 'AI Tools'
  | 'Marketing'
  | 'Print'
  | 'Software'
  | 'Office'
  | 'Other';

export interface Expense {
  id: string;
  name: string;
  /** Account username or email (e.g. Cursor / ChatGPT login). */
  account: string;
  amount: number;
  category: ExpenseCategory;
  type: ExpenseType;
  billingCycle: ExpenseBillingCycle | null;
  startDate: string | null;
  nextRenewalDate: string | null;
  expenseDate: string | null;
  reminderDaysBefore: number;
  status: ExpenseStatus;
  notes: string;
  paymentMethod: string;
  /** Public URL of product logo in Supabase storage. */
  imageUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
}
