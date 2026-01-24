// Type for individual employee payment assignment
export interface EmployeePayment {
  employeeId: string;
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
  createdAt?: string;
}