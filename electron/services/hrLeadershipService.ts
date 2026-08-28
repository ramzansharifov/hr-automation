import type Database from "better-sqlite3";
import type { AuthSession } from "../../src/shared/types/access";
import type {
  HrLeadershipChangeParams,
  HrRecord,
} from "../../src/shared/types/hr";
import { HrCrudRepository } from "../repositories/hrCrudRepository";

interface EmployeeContextRow extends HrRecord {
  id: number;
  enterprise_id: number | null;
  department_id: number | null;
  position_id: number | null;
  salary: number;
}

export class HrLeadershipService {
  constructor(private readonly database: Database.Database) {}

  change(
    params: HrLeadershipChangeParams,
    session: AuthSession,
  ): { success: true } {
    assertDate(params.effectiveAt, "Укажите корректную дату кадрового действия");
    if (!params.reason.trim()) {
      throw new Error("Укажите основание кадрового действия");
    }

    const execute = this.database.transaction(() => {
      const target = this.getLeadershipTarget(params.targetType, params.targetId);
      this.assertLeadershipTargetInScope(params.targetType, target, session);
      const previousLeaderId = positiveNumber(target.leader_id);
      const nextLeaderId = positiveNumber(params.newLeaderEmployeeId);

      if (previousLeaderId === nextLeaderId) {
        throw new Error("Выбранный руководитель уже назначен на эту роль");
      }

      if (previousLeaderId) {
        this.clearLeadershipTarget(params.targetType, params.targetId);
        this.applyPreviousLeaderOutcome(previousLeaderId, params, session);
      }

      if (nextLeaderId) {
        const nextLeader = this.getEmployee(nextLeaderId);
        this.assertEmployeeInScope(nextLeader, session);
        const employment = this.resolveNewLeaderEmployment(
          nextLeader,
          params,
          target,
        );
        const repository = new HrCrudRepository(this.database);
        repository.changeEmployment({
          employeeId: nextLeaderId,
          enterpriseId: employment.enterpriseId,
          departmentId: employment.departmentId,
          positionId: null,
          salaryMode: "custom",
          salary: employment.salary,
          effectiveAt: params.effectiveAt,
          reason: params.reason.trim(),
          leadershipAssignment: {
            type:
              params.targetType === "enterprise"
                ? "enterprise_director"
                : "department_head",
            targetId: params.targetId,
          },
        });
      }

      const action = previousLeaderId
        ? nextLeaderId
          ? "replace"
          : "remove"
        : "assign";
      this.database
        .prepare(
          `INSERT INTO leadership_history (
             target_type, target_id, action,
             previous_leader_employee_id, new_leader_employee_id,
             previous_leader_outcome, effective_at, reason
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          params.targetType,
          params.targetId,
          action,
          previousLeaderId,
          nextLeaderId,
          mapPreviousLeaderOutcome(params.previousLeaderOutcome),
          params.effectiveAt,
          params.reason.trim(),
        );
    });

    execute();
    return { success: true };
  }

  private getLeadershipTarget(
    targetType: "enterprise" | "department",
    targetId: number,
  ): Record<string, unknown> {
    const row =
      targetType === "enterprise"
        ? this.database
            .prepare(
              `SELECT id, id AS enterprise_id, NULL AS department_id,
                      general_director_employee_id AS leader_id, is_archived
               FROM enterprises WHERE id = ? LIMIT 1`,
            )
            .get(targetId)
        : this.database
            .prepare(
              `SELECT id, enterprise_id, id AS department_id,
                      director_employee_id AS leader_id, is_archived
               FROM departments WHERE id = ? LIMIT 1`,
            )
            .get(targetId);
    if (!row) {
      throw new Error(
        targetType === "enterprise" ? "Предприятие не найдено" : "Отдел не найден",
      );
    }
    const typed = row as Record<string, unknown>;
    if (Number(typed.is_archived) === 1) {
      throw new Error("Нельзя менять руководителя архивного объекта");
    }
    return typed;
  }

  private assertLeadershipTargetInScope(
    targetType: "enterprise" | "department",
    target: Record<string, unknown>,
    session: AuthSession,
  ): void {
    if (targetType === "enterprise" && session.scopeType === "department") {
      throw new Error("Руководителя предприятия нельзя менять из области отдела");
    }
    this.assertEnterpriseIdInScope(
      Number(target.enterprise_id),
      session,
      targetType === "department",
    );
    if (
      targetType === "department" &&
      session.scopeType === "department" &&
      Number(target.department_id) !== session.departmentId
    ) {
      throw new Error("Отдел находится вне доступной области данных");
    }
  }

  private clearLeadershipTarget(
    targetType: "enterprise" | "department",
    targetId: number,
  ): void {
    if (targetType === "enterprise") {
      this.database
        .prepare(
          "UPDATE enterprises SET general_director_employee_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .run(targetId);
      return;
    }
    this.database
      .prepare(
        "UPDATE departments SET director_employee_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      )
      .run(targetId);
  }

  private applyPreviousLeaderOutcome(
    employeeId: number,
    params: HrLeadershipChangeParams,
    session: AuthSession,
  ): void {
    const employee = this.getEmployee(employeeId);
    this.assertEmployeeInScope(employee, session);

    if (params.previousLeaderOutcome === "unassigned") {
      this.database
        .prepare(
          `INSERT INTO employment_history (
             employee_id, change_type, previous_department_id, new_department_id,
             previous_position_id, new_position_id, previous_salary, new_salary,
             effective_at, reason
           ) VALUES (?, 'leadership_removed', ?, ?, NULL, NULL, ?, ?, ?, ?)`,
        )
        .run(
          employeeId,
          employee.department_id ?? null,
          employee.department_id ?? null,
          Number(employee.salary ?? 0),
          Number(employee.salary ?? 0),
          params.effectiveAt,
          params.reason.trim(),
        );
      return;
    }

    const assignment = params.previousLeaderAssignment;
    if (!assignment) {
      throw new Error("Укажите должность или перевод для снятого руководителя");
    }
    this.assertAssignment(
      assignment.enterpriseId,
      assignment.departmentId,
      assignment.positionId,
    );
    this.assertEnterpriseIdInScope(assignment.enterpriseId, session, true);
    if (
      session.scopeType === "department" &&
      assignment.departmentId !== session.departmentId
    ) {
      throw new Error("Нельзя перевести снятого руководителя за пределы своего отдела");
    }
    if (!Number.isFinite(assignment.salary) || assignment.salary < 0) {
      throw new Error("Укажите корректный оклад снятого руководителя");
    }

    this.database
      .prepare(
        `UPDATE employees
         SET enterprise_id = ?, department_id = ?, position_id = ?, salary = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .run(
        assignment.enterpriseId,
        assignment.departmentId,
        assignment.positionId,
        assignment.salary,
        employeeId,
      );
    this.database
      .prepare(
        `UPDATE employment_history
         SET change_type = 'leadership_removed', effective_at = ?, reason = ?
         WHERE id = (
           SELECT id FROM employment_history
           WHERE employee_id = ? ORDER BY id DESC LIMIT 1
         )`,
      )
      .run(params.effectiveAt, params.reason.trim(), employeeId);
  }

  private resolveNewLeaderEmployment(
    employee: EmployeeContextRow,
    params: HrLeadershipChangeParams,
    target: Record<string, unknown>,
  ): { enterpriseId: number; departmentId: number; salary: number } {
    const supplied = params.newLeaderEmployment;
    const enterpriseId =
      supplied?.enterpriseId ?? positiveNumber(employee.enterprise_id);
    const departmentId =
      supplied?.departmentId ?? positiveNumber(employee.department_id);
    const salary = supplied?.salary ?? Number(employee.salary ?? 0);

    if (!enterpriseId || !departmentId) {
      throw new Error(
        "Для назначения руководителя определите предприятие и отдел сотрудника",
      );
    }
    if (
      params.targetType === "enterprise" &&
      enterpriseId !== Number(target.enterprise_id)
    ) {
      throw new Error("Руководитель предприятия должен быть оформлен в этом предприятии");
    }
    if (
      params.targetType === "department" &&
      departmentId !== params.targetId
    ) {
      throw new Error("Руководитель отдела должен быть оформлен в этом отделе");
    }

    const department = this.database
      .prepare(
        "SELECT enterprise_id, is_archived FROM departments WHERE id = ? LIMIT 1",
      )
      .get(departmentId) as
      | { enterprise_id: number; is_archived: number }
      | undefined;
    if (
      !department ||
      department.is_archived ||
      department.enterprise_id !== enterpriseId
    ) {
      throw new Error("Выбран некорректный отдел для руководителя");
    }
    if (!Number.isFinite(salary) || salary < 0) {
      throw new Error("Укажите корректный оклад руководителя");
    }
    return { enterpriseId, departmentId, salary };
  }

  private assertAssignment(
    enterpriseId: number,
    departmentId: number,
    positionId: number,
  ): void {
    const row = this.database
      .prepare(
        `SELECT position.id
         FROM positions AS position
         JOIN departments AS department ON department.id = position.department_id
         JOIN enterprises AS enterprise ON enterprise.id = department.enterprise_id
         WHERE position.id = ? AND department.id = ? AND enterprise.id = ?
           AND position.is_archived = 0
           AND department.is_archived = 0
           AND enterprise.is_archived = 0
         LIMIT 1`,
      )
      .get(positionId, departmentId, enterpriseId);
    if (!row) {
      throw new Error("Должность не принадлежит выбранному отделу и предприятию");
    }
  }

  private getEmployee(employeeId: number): EmployeeContextRow {
    const row = this.database
      .prepare("SELECT * FROM employees WHERE id = ? LIMIT 1")
      .get(employeeId) as EmployeeContextRow | undefined;
    if (!row) throw new Error("Сотрудник не найден");
    return row;
  }

  private assertEmployeeInScope(
    employee: HrRecord,
    session: AuthSession,
  ): void {
    const id = Number(employee.id);
    if (session.scopeType === "global") return;
    if (
      session.scopeType === "enterprise" &&
      Number(employee.enterprise_id) === session.enterpriseId
    ) {
      return;
    }
    if (
      session.scopeType === "department" &&
      Number(employee.department_id) === session.departmentId
    ) {
      return;
    }
    if (session.scopeType === "self" && id === session.employeeId) return;
    throw new Error("Сотрудник находится вне доступной области данных");
  }

  private assertEnterpriseIdInScope(
    enterpriseId: number,
    session: AuthSession,
    allowDepartment: boolean,
  ): void {
    if (session.scopeType === "global") return;
    if (
      session.enterpriseId === enterpriseId &&
      (allowDepartment || session.scopeType !== "department")
    ) {
      return;
    }
    throw new Error("Предприятие находится вне доступной области данных");
  }
}

function positiveNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function mapPreviousLeaderOutcome(
  value: HrLeadershipChangeParams["previousLeaderOutcome"],
): "unassigned" | "keep_assignment" | "transfer" {
  if (value === "assign_position") return "keep_assignment";
  if (value === "transfer") return "transfer";
  return "unassigned";
}

function assertDate(value: string, message: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(message);
}
