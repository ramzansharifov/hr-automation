export interface EmployeeWorkspacePerson {
  id: number;
  fullName: string;
  email: string | null;
  positionName: string | null;
  departmentId: number | null;
  departmentName: string | null;
}

export interface EmployeeWorkspaceSelf extends EmployeeWorkspacePerson {
  enterpriseId: number | null;
  enterpriseName: string | null;
  hireDate: string | null;
  employmentType: string | null;
  workplace: string | null;
}

export interface EmployeeWorkspaceEnterprise {
  id: number;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface EmployeeWorkspaceDepartment {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
}

export interface EmployeeWorkspaceData {
  self: EmployeeWorkspaceSelf;
  enterprise: EmployeeWorkspaceEnterprise | null;
  department: EmployeeWorkspaceDepartment | null;
  enterpriseLeader: EmployeeWorkspacePerson | null;
  departmentLeader: EmployeeWorkspacePerson | null;
  colleagues: EmployeeWorkspacePerson[];
}
