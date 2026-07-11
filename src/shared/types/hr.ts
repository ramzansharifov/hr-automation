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

export interface HrDashboardStats {
  employeesTotal: number;
  departmentsTotal: number;
  positionsTotal: number;
  activeVacations: number;
  payrollMonthTotal: number;
}

export interface HrApi {
  list(params: HrListParams): Promise<HrListResult>;
  getById(params: HrGetByIdParams): Promise<HrRecord | null>;
  create(params: HrCreateParams): Promise<HrRecord>;
  update(params: HrUpdateParams): Promise<HrRecord>;
  delete(params: HrDeleteParams): Promise<{ success: true }>;
  dashboard(): Promise<HrDashboardStats>;
}
