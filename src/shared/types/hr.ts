import type {
  AccessPermission,
  AccessRoleSummary,
  AccessUserSummary,
  AuthEmployeeOption,
  AuthSession,
  AuthState,
  BootstrapSuperadminParams,
  ChangeOwnPasswordParams,
  LoginParams,
  ResetAccessPasswordParams,
  SaveAccessRoleParams,
  SaveAccessUserParams,
  SystemAdminSummary,
} from "./access";

export type HrEntityKey =
  | "enterprises"
  | "departments"
  | "positions"
  | "employees"
  | "employee_education"
  | "employee_experience"
  | "employment_history"
  | "vacation_types"
  | "vacations";

export type HrOrderDirection = "asc" | "desc";
export type HrScalarValue = string | number | boolean | null | undefined;
export type HrRecord = Record<string, HrScalarValue>;
export type HrFilterValue =
  string | number | boolean | null | Array<string | number | boolean | null>;
export type HrFilterOperator =
  | "equals"
  | "contains"
  | "gte"
  | "lte"
  | "in"
  | "is_null";

export interface HrFilterCondition {
  operator: HrFilterOperator;
  value: HrFilterValue;
}

export interface HrListParams {
  entity: HrEntityKey;
  page?: number;
  pageSize?: number;
  search?: string;
  filters?: Record<string, HrFilterValue | HrFilterCondition>;
  orderBy?: string;
  orderDirection?: HrOrderDirection;
}

export interface HrListResult {
  items: HrRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface HrGetByIdParams {
  entity: HrEntityKey;
  id: number;
}

export interface HrCreateParams {
  entity: HrEntityKey;
  data: HrRecord;
}

export interface HrUpdateParams {
  entity: HrEntityKey;
  id: number;
  data: HrRecord;
}

export interface HrDeleteParams {
  entity: HrEntityKey;
  id: number;
}

export type HrLeadershipAssignmentType =
  | "enterprise_director"
  | "department_head";

export interface HrLeadershipAssignment {
  type: HrLeadershipAssignmentType;
  targetId: number;
}

export interface HrEmploymentChangeParams {
  employeeId: number;
  enterpriseId: number;
  departmentId: number;
  positionId: number | null;
  salaryMode: "keep" | "custom";
  salary?: number;
  effectiveAt: string;
  reason: string;
  leadershipAssignment?: HrLeadershipAssignment;
}

export interface HrTerminationParams {
  employeeId: number;
  effectiveAt: string;
  reason: string;
}

export interface HrHireDateCorrectionParams {
  employeeId: number;
  hireDate: string;
  reason: string;
}

export interface HrDashboardStats {
  employeesTotal: number;
  departmentsTotal: number;
  positionsTotal: number;
  activeVacations: number;
  upcomingVacations: number;
  openVacancies: number;
  candidatesOnOffer: number;
  blockedUsers: number;
  employeesMissingAssignment: number;
  emailConflicts: number;
}

export interface RecruitmentListParams {
  search?: string;
}

export type VacancySkillType = "hard" | "soft";

export interface VacancySkillInput {
  id?: number;
  type: VacancySkillType;
  name: string;
  requiredLevel: number;
}

export interface SaveVacancyParams {
  id?: number;
  positionId: number;
  status: "draft" | "open" | "paused" | "closed";
  employmentType: "full_time" | "part_time" | "temporary" | "internship";
  openingsCount: number;
  skills: VacancySkillInput[];
}

export interface VacancyProfile {
  vacancy: HrRecord;
  skills: HrRecord[];
}

export interface CandidateSkillScoreInput {
  vacancySkillId: number;
  score: number;
}

export interface SaveCandidateParams {
  id?: number;
  vacancyId: number;
  lastName: string;
  firstName: string;
  middleName?: string;
  phone?: string;
  email?: string;
  status: "new" | "screening" | "interview" | "offer" | "hired" | "rejected";
  source?: string;
  skillScores: CandidateSkillScoreInput[];
}

export interface CandidateProfile {
  candidate: HrRecord;
  vacancySkills: HrRecord[];
  skillScores: HrRecord[];
  statusHistory: HrRecord[];
}

export interface HireCandidateParams {
  candidateId: number;
  hireDate: string;
  salary: number;
  employeeNumber?: string;
  contractNumber?: string;
  contractDate?: string;
  contractEndDate?: string;
  probationEndDate?: string;
  workplace?: string;
}

export interface AuditEvent {
  id: number;
  occurredAt: string;
  actorAccountType: "system_admin" | "employee_user" | "system";
  actorAccountId: number | null;
  actorUsername: string;
  action: string;
  entityType: string;
  entityId: number | null;
  before: HrRecord | null;
  after: HrRecord | null;
  metadata: Record<string, unknown> | null;
}

export interface AuditListParams {
  search?: string;
  limit?: number;
}

export interface BackupInfo {
  name: string;
  createdAt: string;
  sizeBytes: number;
}

export interface HrApi {
  getAuthState(): Promise<AuthState>;
  listBootstrapEmployees(): Promise<AuthEmployeeOption[]>;
  bootstrapSuperadmin(params: BootstrapSuperadminParams): Promise<AuthSession>;
  login(params: LoginParams): Promise<AuthSession>;
  logout(): Promise<{ success: true }>;
  changeOwnPassword(params: ChangeOwnPasswordParams): Promise<AuthSession>;
  list(params: HrListParams): Promise<HrListResult>;
  getById(params: HrGetByIdParams): Promise<HrRecord | null>;
  create(params: HrCreateParams): Promise<HrRecord>;
  update(params: HrUpdateParams): Promise<HrRecord>;
  changeEmployment(params: HrEmploymentChangeParams): Promise<HrRecord>;
  terminateEmployee(params: HrTerminationParams): Promise<HrRecord>;
  correctHireDate(params: HrHireDateCorrectionParams): Promise<HrRecord>;
  delete(params: HrDeleteParams): Promise<{ success: true }>;
  dashboard(): Promise<HrDashboardStats>;
  listVacancies(params: RecruitmentListParams): Promise<HrRecord[]>;
  getVacancy(id: number): Promise<VacancyProfile | null>;
  saveVacancy(params: SaveVacancyParams): Promise<VacancyProfile>;
  deleteVacancy(id: number): Promise<{ success: true }>;
  listCandidates(params: RecruitmentListParams): Promise<HrRecord[]>;
  getCandidate(id: number): Promise<CandidateProfile | null>;
  saveCandidate(params: SaveCandidateParams): Promise<CandidateProfile>;
  hireCandidate(params: HireCandidateParams): Promise<HrRecord>;
  deleteCandidate(id: number): Promise<{ success: true }>;
  listAccessPermissions(): Promise<AccessPermission[]>;
  listAccessRoles(): Promise<AccessRoleSummary[]>;
  listAccessUsers(): Promise<AccessUserSummary[]>;
  getAccessSystemAdmin(): Promise<SystemAdminSummary>;
  saveAccessRole(params: SaveAccessRoleParams): Promise<AccessRoleSummary>;
  deleteAccessRole(id: number): Promise<{ success: true }>;
  saveAccessUser(params: SaveAccessUserParams): Promise<AccessUserSummary>;
  resetAccessPassword(params: ResetAccessPasswordParams): Promise<{ success: true }>;
  deleteAccessUser(id: number): Promise<{ success: true }>;
  listAuditEvents(params?: AuditListParams): Promise<AuditEvent[]>;
  listBackups(): Promise<BackupInfo[]>;
  createBackup(): Promise<BackupInfo>;
  restoreBackup(name: string): Promise<{ success: true }>;
  openBackupsFolder(): Promise<{ success: true }>;
  exportEmployeesCsv(): Promise<{ success: true; canceled?: boolean }>;
}
