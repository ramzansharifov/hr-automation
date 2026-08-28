import type {
  AuthSession,
  BusinessContextSelection,
  BusinessContextState,
} from "../../src/shared/types/access";
import {
  businessContextPermissionCodes,
  enterpriseLevelPermissionCodes,
} from "../../src/shared/access/permissionRules";
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

export function canSelectBusinessContext(session: AuthSession): boolean {
  if (session.employeeId === 0) return true;
  if (session.scopeType !== "global") return false;
  return session.permissionCodes.some((code) =>
    businessContextPermissionCodes.has(code),
  );
}

export function getBusinessContextState(session: AuthSession): BusinessContextState {
  if (!canSelectBusinessContext(session)) {
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
  if (!canSelectBusinessContext(session)) {
    throw new Error(
      "Выбор предприятия доступен только роли с глобальной областью HR-данных",
    );
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
    if (!enterprise) {
      throw new Error("Предприятие не найдено или находится в архиве");
    }
  }

  if (departmentId) {
    const department = database
      .prepare(
        `SELECT id FROM departments
         WHERE id = ? AND enterprise_id = ? AND COALESCE(is_archived, 0) = 0
         LIMIT 1`,
      )
      .get(departmentId, enterpriseId);
    if (!department) {
      throw new Error("Отдел не принадлежит выбранному предприятию");
    }
  }

  selectedEnterpriseId = enterpriseId;
  selectedDepartmentId = departmentId;
  return getBusinessContextState(session);
}

export function applyBusinessContextToSession(session: AuthSession): AuthSession {
  if (!canSelectBusinessContext(session)) return session;

  const context = getBusinessContextState(session);
  const homeEnterpriseId = session.enterpriseId;
  const homeDepartmentId = session.departmentId;
  const permissionScopes = { ...session.permissionScopes };

  for (const [permissionCode, originalScope] of Object.entries(
    session.permissionScopes,
  )) {
    const isBusinessPermission = businessContextPermissionCodes.has(permissionCode);

    if (isBusinessPermission && originalScope === "global") {
      if (!context.enterpriseId) {
        delete permissionScopes[permissionCode];
        continue;
      }
      permissionScopes[permissionCode] =
        context.departmentId && !enterpriseLevelPermissionCodes.has(permissionCode)
          ? "department"
          : "enterprise";
      continue;
    }

    if (!context.enterpriseId) continue;

    // A local grant must remain attached to the employee's home organizational
    // unit. Selecting another enterprise for a company-wide role must never make
    // an enterprise/department-local role "travel" with the UI context.
    if (originalScope === "enterprise" && context.enterpriseId !== homeEnterpriseId) {
      delete permissionScopes[permissionCode];
      continue;
    }
    if (
      originalScope === "department" &&
      (context.enterpriseId !== homeEnterpriseId ||
        context.departmentId !== homeDepartmentId)
    ) {
      delete permissionScopes[permissionCode];
    }
  }

  if (!context.enterpriseId) {
    return {
      ...session,
      permissionScopes,
    };
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
