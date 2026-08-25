import type { AuthSession, BusinessContextSelection, BusinessContextState } from "../../src/shared/types/access";
import { businessContextPermissionCodes } from "../../src/shared/access/permissionRules";
import { getDatabase } from "../database/connection";

let selectedEnterpriseId: number | null = null;
let selectedDepartmentId: number | null = null;

interface EnterpriseRow {
  id: number;
  name: string;
}

interface DepartmentRow {
  id: number;
  name: string;
  enterprise_id: number;
}

export function resetBusinessContext(): void {
  selectedEnterpriseId = null;
  selectedDepartmentId = null;
}

export function getBusinessContextState(session: AuthSession): BusinessContextState {
  if (session.employeeId !== 0) {
    return {
      enterpriseId: session.enterpriseId,
      enterpriseName: session.enterpriseName,
      departmentId: session.departmentId,
      departmentName: session.departmentName,
      canSelectEnterprise: false,
      canSelectDepartment: false,
      requiresEnterpriseSelection: false,
      enterprises: session.enterpriseId
        ? [{ id: session.enterpriseId, name: session.enterpriseName }]
        : [],
      departments: session.departmentId
        ? [
            {
              id: session.departmentId,
              name: session.departmentName,
              enterpriseId: session.enterpriseId,
            },
          ]
        : [],
    };
  }

  const database = getDatabase();
  const enterprises = database
    .prepare(
      `SELECT id, name
       FROM enterprises
       WHERE COALESCE(is_archived, 0) = 0
       ORDER BY name`,
    )
    .all() as EnterpriseRow[];

  if (
    selectedEnterpriseId !== null &&
    !enterprises.some((enterprise) => enterprise.id === selectedEnterpriseId)
  ) {
    selectedEnterpriseId = null;
    selectedDepartmentId = null;
  }

  const departments = selectedEnterpriseId
    ? (database
        .prepare(
          `SELECT id, name, enterprise_id
           FROM departments
           WHERE enterprise_id = ?
             AND COALESCE(is_archived, 0) = 0
           ORDER BY name`,
        )
        .all(selectedEnterpriseId) as DepartmentRow[])
    : [];

  if (
    selectedDepartmentId !== null &&
    !departments.some((department) => department.id === selectedDepartmentId)
  ) {
    selectedDepartmentId = null;
  }

  const enterprise = enterprises.find((item) => item.id === selectedEnterpriseId);
  const department = departments.find((item) => item.id === selectedDepartmentId);

  return {
    enterpriseId: enterprise?.id ?? null,
    enterpriseName: enterprise?.name ?? "",
    departmentId: department?.id ?? null,
    departmentName: department?.name ?? "",
    canSelectEnterprise: true,
    canSelectDepartment: Boolean(enterprise),
    requiresEnterpriseSelection: true,
    enterprises: enterprises.map((item) => ({ id: item.id, name: item.name })),
    departments: departments.map((item) => ({
      id: item.id,
      name: item.name,
      enterpriseId: item.enterprise_id,
    })),
  };
}

export function setBusinessContext(
  session: AuthSession,
  selection: BusinessContextSelection,
): BusinessContextState {
  if (session.employeeId !== 0) {
    throw new Error("Рабочий контекст предприятия выбирает только системный superadmin");
  }

  const enterpriseId = normalizeId(selection.enterpriseId);
  const departmentId = normalizeId(selection.departmentId);
  if (departmentId && !enterpriseId) {
    throw new Error("Сначала выберите предприятие");
  }

  const database = getDatabase();
  if (enterpriseId) {
    const enterprise = database
      .prepare(
        `SELECT id FROM enterprises
         WHERE id = ? AND COALESCE(is_archived, 0) = 0
         LIMIT 1`,
      )
      .get(enterpriseId);
    if (!enterprise) throw new Error("Предприятие не найдено или находится в архиве");
  }

  if (departmentId) {
    const department = database
      .prepare(
        `SELECT id FROM departments
         WHERE id = ? AND enterprise_id = ? AND COALESCE(is_archived, 0) = 0
         LIMIT 1`,
      )
      .get(departmentId, enterpriseId);
    if (!department) throw new Error("Отдел не принадлежит выбранному предприятию");
  }

  selectedEnterpriseId = enterpriseId;
  selectedDepartmentId = departmentId;
  return getBusinessContextState(session);
}

export function applyBusinessContextToSession(session: AuthSession): AuthSession {
  if (session.employeeId !== 0) return session;

  const context = getBusinessContextState(session);
  const permissionScopes = { ...session.permissionScopes };

  for (const permissionCode of businessContextPermissionCodes) {
    if (!permissionScopes[permissionCode]) continue;
    if (!context.enterpriseId) {
      delete permissionScopes[permissionCode];
      continue;
    }
    permissionScopes[permissionCode] = context.departmentId
      ? "department"
      : "enterprise";
  }

  return {
    ...session,
    enterpriseId: context.enterpriseId,
    enterpriseName: context.enterpriseName,
    departmentId: context.departmentId,
    departmentName: context.departmentName,
    permissionScopes,
  };
}

function normalizeId(value: number | null): number | null {
  if (value === null || value === undefined) return null;
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new Error("Некорректный идентификатор рабочего контекста");
  }
  return normalized;
}
