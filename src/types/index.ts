export interface Project {
  id: string;
  projectId: string;
  clientName: string;
  clientUniOrg: string;
  projectDescription: string;
  deadlineDate: string;
  price: number;
  advance: number;
  assignedTo: string;
  paymentOfEmp: number;
  status: 'Running' | 'Pending' | 'Delivered' | 'Correction' | 'Rejected';
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