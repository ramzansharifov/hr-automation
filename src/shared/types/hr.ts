export type HrEntityKey =
  | "enterprises"
  | "departments"
  | "positions"
  | "employees"
  | "employee_education"
  | "employee_experience"
  | "employment_history"
  | "vacations"
  | "payroll";

export type HrOrderDirection = "asc" | "desc";

export type HrRecord = Record<string, unknown>;

export type HrFilterValue =
  string | number | boolean | null | Array<string | number | boolean | null>;

export type HrFilterOperator = "equals" | "contains" | "gte" | "lte" | "in";

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

export interface HrEmploymentChangeParams {
  employeeId: number;
  departmentId: number;
  positionId: number;
  salaryMode: "keep" | "position" | "custom";
  salary?: number;
  effectiveAt: string;
  reason: string;
  note?: string;
}

export interface HrDashboardStats {
  employeesTotal: number;
  departmentsTotal: number;
  positionsTotal: number;
  activeVacations: number;
  payrollMonthTotal: number;
}

export interface RecruitmentListParams {
  search?: string;
}

export interface VacancySkillInput {
  id?: number;
  name: string;
  requiredLevel: number;
  weight: number;
  note?: string;
}

export interface SaveVacancyParams {
  id?: number;
  positionId: number;
  title: string;
  status: "draft" | "open" | "paused" | "closed";
  employmentType: "full_time" | "part_time" | "temporary" | "internship";
  openingsCount: number;
  description?: string;
  requirements?: string;
  note?: string;
  skills: VacancySkillInput[];
}

export interface VacancyProfile {
  vacancy: HrRecord;
  skills: HrRecord[];
}

export interface CandidateSkillScoreInput {
  vacancySkillId: number;
  score: number;
  note?: string;
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
  note?: string;
  skillScores: CandidateSkillScoreInput[];
}

export interface CandidateProfile {
  candidate: HrRecord;
  vacancySkills: HrRecord[];
  skillScores: HrRecord[];
}

export interface HrApi {
  list(params: HrListParams): Promise<HrListResult>;
  getById(params: HrGetByIdParams): Promise<HrRecord | null>;
  create(params: HrCreateParams): Promise<HrRecord>;
  update(params: HrUpdateParams): Promise<HrRecord>;
  changeEmployment(params: HrEmploymentChangeParams): Promise<HrRecord>;
  delete(params: HrDeleteParams): Promise<{ success: true }>;
  dashboard(): Promise<HrDashboardStats>;
  listVacancies(params: RecruitmentListParams): Promise<HrRecord[]>;
  getVacancy(id: number): Promise<VacancyProfile | null>;
  saveVacancy(params: SaveVacancyParams): Promise<VacancyProfile>;
  deleteVacancy(id: number): Promise<{ success: true }>;
  listCandidates(params: RecruitmentListParams): Promise<HrRecord[]>;
  getCandidate(id: number): Promise<CandidateProfile | null>;
  saveCandidate(params: SaveCandidateParams): Promise<CandidateProfile>;
  deleteCandidate(id: number): Promise<{ success: true }>;
}
