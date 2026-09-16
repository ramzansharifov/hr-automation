export interface RolePermissionSectionDefinition {
  key: string;
  title: string;
  description: string;
  group: "Основное" | "Администрирование" | "Профиль и настройки";
  permissionCodes: string[];
}

export const rolePermissionSections: RolePermissionSectionDefinition[] = [
  {
    key: "dashboard",
    title: "Главная",
    description: "Сводная панель HR-показателей и встроенная очередь «Требует внимания».",
    group: "Основное",
    permissionCodes: ["dashboard.view", "attention.view"],
  },
  {
    key: "directory",
    title: "Моя команда",
    description: "Безопасный справочник своего предприятия: структура, руководители и рабочие контакты коллег.",
    group: "Основное",
    permissionCodes: ["directory.view"],
  },
  {
    key: "employees",
    title: "Сотрудники",
    description: "Основная карточка сотрудника и отдельные кадровые действия. Удаление сотрудника заменено контролируемым увольнением.",
    group: "Основное",
    permissionCodes: [
      "employees.view",
      "employees.create",
      "employees.edit",
      "employees.change_employment",
      "employees.terminate",
    ],
  },
  {
    key: "employee-education",
    title: "Образование сотрудников",
    description: "Независимый CRUD для записей об образовании в карточке сотрудника.",
    group: "Основное",
    permissionCodes: [
      "employee_education.view",
      "employee_education.create",
      "employee_education.edit",
      "employee_education.delete",
    ],
  },
  {
    key: "employee-experience",
    title: "Опыт работы сотрудников",
    description: "Независимый CRUD для предыдущих мест работы и профессионального опыта.",
    group: "Основное",
    permissionCodes: [
      "employee_experience.view",
      "employee_experience.create",
      "employee_experience.edit",
      "employee_experience.delete",
    ],
  },
  {
    key: "employment-history",
    title: "Кадровая история",
    description: "Просмотр системного журнала кадровых событий. Создание, изменение и удаление записей вручную запрещены.",
    group: "Основное",
    permissionCodes: ["employment_history.view"],
  },
  {
    key: "documents",
    title: "Документы сотрудников",
    description: "Просмотр, добавление и контролируемое удаление файлов во вкладке «Документы» карточки сотрудника.",
    group: "Основное",
    permissionCodes: ["documents.view", "documents.add", "documents.delete"],
  },
  {
    key: "enterprises",
    title: "Предприятия",
    description: "Отдельные права на просмотр, создание, изменение, удаление и управление директором предприятия.",
    group: "Основное",
    permissionCodes: [
      "enterprises.view",
      "enterprises.create",
      "enterprises.edit",
      "enterprises.delete",
      "enterprises.assign_leader",
    ],
  },
  {
    key: "departments",
    title: "Отделы",
    description: "Отдельный CRUD отделов и самостоятельное право на управление руководителем отдела.",
    group: "Основное",
    permissionCodes: [
      "departments.view",
      "departments.create",
      "departments.edit",
      "departments.delete",
      "departments.assign_leader",
    ],
  },
  {
    key: "positions",
    title: "Должности",
    description: "Независимый CRUD должностей внутри доступных отделов.",
    group: "Основное",
    permissionCodes: [
      "positions.view",
      "positions.create",
      "positions.edit",
      "positions.delete",
    ],
  },
  {
    key: "vacations",
    title: "Отпуска",
    description: "Планирование и согласование отпусков сотрудников.",
    group: "Основное",
    permissionCodes: [
      "vacations.view",
      "vacations.create",
      "vacations.edit",
      "vacations.delete",
      "vacations.approve",
    ],
  },
  {
    key: "vacancies",
    title: "Вакансии",
    description: "Вакансии и требования к подбору персонала.",
    group: "Основное",
    permissionCodes: [
      "vacancies.view",
      "vacancies.create",
      "vacancies.edit",
      "vacancies.delete",
    ],
  },
  {
    key: "candidates",
    title: "Кандидаты",
    description: "Кандидаты, оценки, статусы и отдельное право на приём кандидата на работу.",
    group: "Основное",
    permissionCodes: [
      "candidates.view",
      "candidates.create",
      "candidates.edit",
      "candidates.delete",
      "candidates.hire",
    ],
  },
  {
    key: "analytics",
    title: "Аналитика",
    description: "Просмотр HR-аналитики в пределах доступной области данных.",
    group: "Основное",
    permissionCodes: ["analytics.view"],
  },
  {
    key: "filters",
    title: "Фильтры",
    description: "Расширенные фильтры реестров.",
    group: "Основное",
    permissionCodes: ["filters.use"],
  },
  {
    key: "data-exchange",
    title: "Импорт и экспорт",
    description: "Независимые разрешения на импорт кадровых данных и экспорт доступных данных.",
    group: "Администрирование",
    permissionCodes: ["data_exchange.import", "data_exchange.export"],
  },
  {
    key: "vacation-types",
    title: "Виды отпусков",
    description: "Администрирование справочника видов отпусков.",
    group: "Администрирование",
    permissionCodes: [
      "vacation_types.view",
      "vacation_types.create",
      "vacation_types.edit",
      "vacation_types.delete",
    ],
  },
  {
    key: "document-types",
    title: "Типы документов",
    description: "Администрирование справочника типов кадровых документов предприятия.",
    group: "Администрирование",
    permissionCodes: [
      "document_types.view",
      "document_types.create",
      "document_types.edit",
      "document_types.delete",
    ],
  },
  {
    key: "users",
    title: "Пользователи",
    description: "Учётные записи сотрудников и их роли.",
    group: "Администрирование",
    permissionCodes: [
      "users.view",
      "users.create",
      "users.edit",
      "users.delete",
      "users.reset_password",
    ],
  },
  {
    key: "roles",
    title: "Роли",
    description: "Роли доступа и их разрешения.",
    group: "Администрирование",
    permissionCodes: ["roles.view", "roles.create", "roles.edit", "roles.delete"],
  },
  {
    key: "audit",
    title: "Журнал действий",
    description: "Глобальный просмотр аудита действий пользователей.",
    group: "Администрирование",
    permissionCodes: ["audit.view"],
  },
  {
    key: "profile",
    title: "Профиль",
    description: "Собственная карточка сотрудника.",
    group: "Профиль и настройки",
    permissionCodes: ["profile.view"],
  },
  {
    key: "settings",
    title: "Настройки",
    description: "Личные настройки интерфейса и отдельные глобальные системные инструменты.",
    group: "Профиль и настройки",
    permissionCodes: [
      "settings.view",
      "settings.backups_view",
      "settings.backups_create",
      "settings.backups_restore",
      "settings.backups_open_folder",
      "employees.export",
    ],
  },
];

type RolePermissionTextFn = (ru: string, en: string) => string;

const sectionEnglish: Record<string, { title: string; description: string }> = {
  dashboard: {
    title: "Dashboard",
    description: "HR summary dashboard and the built-in Needs attention queue.",
  },
  directory: {
    title: "My team",
    description: "Safe enterprise directory with structure, leaders, and colleagues' work contacts.",
  },
  employees: {
    title: "Employees",
    description: "Core employee profile and dedicated HR actions. Employee deletion is replaced by controlled termination.",
  },
  "employee-education": {
    title: "Employee education",
    description: "Independent CRUD permissions for education records in the employee profile.",
  },
  "employee-experience": {
    title: "Employee experience",
    description: "Independent CRUD permissions for previous employment and professional experience.",
  },
  "employment-history": {
    title: "Employment history",
    description: "View the system employment-event log. Manual creation, editing, and deletion are prohibited.",
  },
  documents: {
    title: "Employee documents",
    description: "View, add, and controlled deletion of files in the employee Documents tab.",
  },
  enterprises: {
    title: "Enterprises",
    description: "Separate permissions for viewing, creating, editing, deleting, and assigning an enterprise director.",
  },
  departments: {
    title: "Departments",
    description: "Independent department CRUD and a separate permission for assigning a department leader.",
  },
  positions: {
    title: "Positions",
    description: "Independent position CRUD within accessible departments.",
  },
  vacations: {
    title: "Vacations",
    description: "Employee vacation planning and approval.",
  },
  vacancies: {
    title: "Vacancies",
    description: "Vacancies and recruitment requirements.",
  },
  candidates: {
    title: "Candidates",
    description: "Candidates, evaluations, statuses, and a separate permission to hire a candidate.",
  },
  analytics: {
    title: "Analytics",
    description: "View HR analytics within the effective data scope.",
  },
  filters: {
    title: "Filters",
    description: "Advanced registry filters.",
  },
  "data-exchange": {
    title: "Import & export",
    description: "Independent permissions for importing HR data and exporting accessible data.",
  },
  "vacation-types": {
    title: "Vacation types",
    description: "Administration of the vacation type directory.",
  },
  "document-types": {
    title: "Document types",
    description: "Administration of enterprise HR document types.",
  },
  users: {
    title: "Users",
    description: "Employee accounts and their assigned roles.",
  },
  roles: {
    title: "Roles",
    description: "Access roles and their permissions.",
  },
  audit: {
    title: "Audit log",
    description: "Global view of user action audit events.",
  },
  profile: {
    title: "Profile",
    description: "The employee's own profile.",
  },
  settings: {
    title: "Settings",
    description: "Personal interface settings and separate global system tools.",
  },
};

export function rolePermissionSectionTitle(
  section: RolePermissionSectionDefinition,
  text: RolePermissionTextFn,
): string {
  return text(section.title, sectionEnglish[section.key]?.title ?? section.title);
}

export function rolePermissionSectionDescription(
  section: RolePermissionSectionDefinition,
  text: RolePermissionTextFn,
): string {
  return text(
    section.description,
    sectionEnglish[section.key]?.description ?? section.description,
  );
}

export function rolePermissionGroupLabel(
  group: RolePermissionSectionDefinition["group"],
  text: RolePermissionTextFn,
): string {
  if (group === "Основное") return text("Основное", "Main");
  if (group === "Администрирование") {
    return text("Администрирование", "Administration");
  }
  return text("Профиль и настройки", "Profile & settings");
}

export {
  legacyPermissionCodes,
  permissionDependencies,
} from "../../shared/access/permissionRules";
