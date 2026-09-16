import type { AccessPermission, AccessScopeType } from "../../shared/types/access";

type TextFn = (ru: string, en: string) => string;

const entityLabels: Record<string, [string, string]> = {
  dashboard: ["главную панель", "dashboard"],
  attention: ["очередь внимания", "attention queue"],
  directory: ["справочник команды", "team directory"],
  employees: ["сотрудников", "employees"],
  employee_education: ["образование сотрудников", "employee education"],
  employee_experience: ["опыт работы сотрудников", "employee experience"],
  employment_history: ["кадровую историю", "employment history"],
  documents: ["документы сотрудников", "employee documents"],
  enterprises: ["предприятия", "enterprises"],
  departments: ["отделы", "departments"],
  positions: ["должности", "positions"],
  vacations: ["отпуска", "vacations"],
  vacation_types: ["виды отпусков", "vacation types"],
  vacancies: ["вакансии", "vacancies"],
  candidates: ["кандидатов", "candidates"],
  analytics: ["аналитику", "analytics"],
  filters: ["фильтры", "filters"],
  data_exchange: ["обмен данными", "data exchange"],
  document_types: ["типы документов", "document types"],
  users: ["пользователей", "users"],
  roles: ["роли", "roles"],
  audit: ["журнал действий", "audit log"],
  profile: ["профиль", "profile"],
  settings: ["настройки", "settings"],
};

const actionLabels: Record<string, [string, string]> = {
  view: ["Просмотр", "View"],
  create: ["Создание", "Create"],
  add: ["Добавление", "Add"],
  edit: ["Редактирование", "Edit"],
  delete: ["Удаление", "Delete"],
  approve: ["Согласование", "Approve"],
  hire: ["Приём на работу", "Hire from"],
  use: ["Использование", "Use"],
  import: ["Импорт", "Import"],
  export: ["Экспорт", "Export"],
  assign_leader: ["Назначение руководителя", "Assign leader for"],
  change_employment: ["Кадровый перевод", "Change employment for"],
  terminate: ["Увольнение", "Terminate"],
  reset_password: ["Сброс пароля", "Reset password for"],
  backups_view: ["Просмотр резервных копий", "View backups in"],
  backups_create: ["Создание резервных копий", "Create backups in"],
  backups_restore: ["Восстановление резервных копий", "Restore backups in"],
  backups_open_folder: ["Открытие папки резервных копий", "Open backups folder in"],
};

export function accessPermissionName(
  permission: AccessPermission,
  text: TextFn,
): string {
  const [entityCode, actionCode = "view"] = permission.code.split(".");
  const entity = entityLabels[entityCode]?.[1] ?? entityCode.split("_").join(" ");
  const action = actionLabels[actionCode]?.[1] ?? titleCase(actionCode.split("_").join(" "));
  return text(permission.name, `${action} ${entity}`);
}

export function accessPermissionDescription(
  permission: AccessPermission,
  text: TextFn,
): string {
  const [entityCode, actionCode = "view"] = permission.code.split(".");
  const entity = entityLabels[entityCode]?.[1] ?? entityCode.split("_").join(" ");
  const action = actionLabels[actionCode]?.[1]?.toLocaleLowerCase("en-US") ?? actionCode.split("_").join(" ");
  return text(
    permission.description || permission.name,
    `Allows the user to ${action} ${entity} within the effective data scope.`,
  );
}

export function accessScopeLabel(scope: AccessScopeType, text: TextFn): string {
  if (scope === "global") return text("Вся система", "Entire system");
  if (scope === "enterprise") return text("Предприятие", "Enterprise");
  if (scope === "department") return text("Отдел", "Department");
  return text("Только свои данные", "Own data only");
}

export function accessUserStatusLabel(
  status: "active" | "blocked",
  text: TextFn,
): string {
  return status === "active"
    ? text("Активен", "Active")
    : text("Заблокирован", "Blocked");
}

export function accessRoleName(
  systemKey: string | null | undefined,
  fallbackName: string,
  text: TextFn,
): string {
  if (systemKey === "superadmin") return text("Superadmin", "Superadmin");
  if (systemKey === "employee") return text("Сотрудник", "Employee");
  if (systemKey === "enterprise_director") {
    return text("Руководитель предприятия", "Enterprise director");
  }
  if (systemKey === "department_head") {
    return text("Руководитель отдела", "Department head");
  }
  if (systemKey === "enterprise_admin") {
    return text("Администратор предприятия", "Enterprise administrator");
  }
  if (systemKey === "department_admin") {
    return text("Администратор отдела", "Department administrator");
  }
  return fallbackName;
}

function titleCase(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}
