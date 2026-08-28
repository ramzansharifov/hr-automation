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

export type EmployeeLifecycleStatus =
  | "draft"
  | "pending_assignment"
  | "active"
  | "terminated";

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

export type LeadershipTargetType = "enterprise" | "department";
export type PreviousLeaderOutcome =
  | "unassigned"
  | "assign_position"
  | "transfer";

export interface LeadershipEmploymentAssignment {
  enterpriseId: number;
  departmentId: number;
  positionId: number;
  salary: number;
}

export interface LeadershipNewLeaderEmployment {
  enterpriseId: number;
  departmentId: number;
  salary: number;
}

export interface HrLeadershipChangeParams {
  targetType: LeadershipTargetType;
  targetId: number;
  newLeaderEmployeeId: number | null;
  effectiveAt: string;
  reason: string;
  previousLeaderOutcome: PreviousLeaderOutcome;
  previousLeaderAssignment?: LeadershipEmploymentAssignment;
  newLeaderEmployment?: LeadershipNewLeaderEmployment;
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

export interface EmployeeDocumentSummary {
  id: number;
  employeeId: number;
  employmentHistoryId: number | null;
  employeeName: string;
  enterpriseIdSnapshot?: number | null;
  enterpriseNameSnapshot?: string | null;
  documentType: string;
  title: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number;
  sha256: string;
  issuedAt: string | null;
  expiresAt: string | null;
  status: "active" | "deleted";
  createdAt: string;
}

export interface AddEmployeeDocumentParams {
  employeeId: number;
  employmentHistoryId?: number | null;
  documentType: string;
  title: string;
  issuedAt?: string | null;
  expiresAt?: string | null;
}

export interface DeleteEmployeeDocumentParams {
  id: number;
  reason: string;
}

// Internal compatibility types for the pre-existing service implementation.
// There is no public HrApi/preload/IPC surface for leave balances or production
// calendars anymore; the corresponding permissions and tables are removed by
// migration 032.
export interface LeaveBalanceSummary {
  employeeId: number;
  year: number;
  entitlementDays: number;
  carryoverDays: number;
  adjustmentDays: number;
  usedDays: number;
  plannedDays: number;
  remainingDays: number;
}

export interface LeaveOverview {
  balance: LeaveBalanceSummary;
  vacations: HrRecord[];
  calendarDays: HrRecord[];
  warnings: string[];
}

export interface LeaveOverviewParams {
  employeeId: number;
  year: number;
}

export interface SaveLeaveBalanceParams {
  employeeId: number;
  year: number;
  entitlementDays: number;
  carryoverDays: number;
  adjustmentDays: number;
}

export interface SaveWorkCalendarDayParams {
  enterpriseId: number;
  date: string;
  isWorkday: boolean;
  name?: string;
}

export type AttentionSeverity = "info" | "warning" | "critical";
export interface AttentionItem {
  id: string;
  type: string;
  severity: AttentionSeverity;
  title: string;
  description: string;
  path: string;
  dueDate: string | null;
}

export interface AnalyticsSeriesPoint {
  label: string;
  value: number;
}

export interface HrAnalyticsReport {
  activeEmployees: number;
  pendingEmployees: number;
  terminatedEmployees: number;
  averageAge: number | null;
  averageTenureYears: number | null;
  openVacancies: number;
  averageTimeToHireDays: number | null;
  employeesOnLeaveToday: number;
  headcountByEnterprise: AnalyticsSeriesPoint[];
  headcountByDepartment: AnalyticsSeriesPoint[];
  hiresByMonth: AnalyticsSeriesPoint[];
  terminationsByMonth: AnalyticsSeriesPoint[];
  vacanciesByStatus: AnalyticsSeriesPoint[];
  leaveByType: AnalyticsSeriesPoint[];
}

export type DataExportDomain =
  | "employees"
  | "organization"
  | "vacations"
  | "employment_history"
  | "vacancies"
  | "audit";
export type DataExportFormat = "csv" | "xlsx";

export interface EmployeeImportSelection {
  previewId: string;
  fileName: string;
  headers: string[];
  sampleRows: Array<Record<string, string>>;
  totalRows: number;
}

export type EmployeeImportField =
  | "last_name"
  | "first_name"
  | "middle_name"
  | "email"
  | "phone"
  | "employee_number"
  | "enterprise"
  | "department"
  | "position";

export type EmployeeImportColumnMap = Partial<Record<EmployeeImportField, string>>;

export interface EmployeeImportError {
  row: number;
  message: string;
}

export interface EmployeeImportPreview {
  previewId: string;
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  errors: EmployeeImportError[];
}

export interface PreviewEmployeeImportParams {
  previewId: string;
  columnMap: EmployeeImportColumnMap;
}

export interface ApplyEmployeeImportParams extends PreviewEmployeeImportParams {
  dryRun?: boolean;
}

export interface EmployeeImportResult {
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errors: EmployeeImportError[];
}

export interface ExportDataParams {
  domain: DataExportDomain;
  format: DataExportFormat;
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
  changeLeadership(params: HrLeadershipChangeParams): Promise<{ success: true }>;
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
  listEmployeeDocuments(employeeId?: number): Promise<EmployeeDocumentSummary[]>;
  addEmployeeDocument(params: AddEmployeeDocumentParams): Promise<EmployeeDocumentSummary | null>;
  openEmployeeDocument(id: number): Promise<{ success: true }>;
  deleteEmployeeDocument(params: DeleteEmployeeDocumentParams): Promise<{ success: true }>;
  listAttentionItems(): Promise<AttentionItem[]>;
  getAnalytics(): Promise<HrAnalyticsReport>;
  selectEmployeeImportFile(): Promise<EmployeeImportSelection | null>;
  previewEmployeeImport(params: PreviewEmployeeImportParams): Promise<EmployeeImportPreview>;
  applyEmployeeImport(params: ApplyEmployeeImportParams): Promise<EmployeeImportResult>;
  exportData(params: ExportDataParams): Promise<{ success: true; canceled?: boolean }>;
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
