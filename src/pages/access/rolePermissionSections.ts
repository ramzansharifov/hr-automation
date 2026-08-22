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
    description: "Сводная панель HR-показателей и событий.",
    group: "Основное",
    permissionCodes: ["dashboard.view"],
  },
  {
    key: "employees",
    title: "Сотрудники",
    description: "Реестр сотрудников, карточки и кадровые действия.",
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
    key: "organization",
    title: "Предприятия",
    description: "Предприятия, отделы, должности и руководители.",
    group: "Основное",
    permissionCodes: [
      "organization.view",
      "organization.create",
      "organization.edit",
      "organization.delete",
      "organization.assign_leader",
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
    description: "Кандидаты, оценки, статусы и приём на работу.",
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
    key: "filters",
    title: "Фильтры",
    description: "Расширенные фильтры реестров.",
    group: "Основное",
    permissionCodes: ["filters.use"],
  },
  {
    key: "vacation-types",
    title: "Виды отпусков",
    description: "Справочник видов отпусков. Изменение справочника доступно только в глобальной области.",
    group: "Администрирование",
    permissionCodes: [
      "vacation_types.view",
      "vacation_types.create",
      "vacation_types.edit",
      "vacation_types.delete",
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
    description: "Просмотр аудита действий пользователей.",
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
    description: "Личные настройки интерфейса, резервные копии и экспорт.",
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

/**
 * Dependencies describe permissions that are technically required for an action
 * to work in the actual UI. The role editor applies them recursively.
 */
export const permissionDependencies: Record<string, string[]> = {
  "employees.create": ["employees.view", "organization.view"],
  "employees.edit": ["employees.view", "organization.view"],
  "employees.change_employment": ["employees.view", "organization.view"],
  "employees.terminate": ["employees.view"],
  "employees.export": ["employees.view", "settings.view"],

  "organization.create": ["organization.view"],
  "organization.edit": ["organization.view"],
  "organization.delete": ["organization.view"],
  "organization.assign_leader": ["organization.view", "employees.view"],

  "vacations.create": ["vacations.view", "employees.view", "vacation_types.view"],
  "vacations.edit": ["vacations.view", "employees.view", "vacation_types.view"],
  "vacations.delete": ["vacations.view"],
  "vacations.approve": ["vacations.view", "employees.view", "vacation_types.view"],

  "vacancies.create": ["vacancies.view", "organization.view"],
  "vacancies.edit": ["vacancies.view", "organization.view"],
  "vacancies.delete": ["vacancies.view"],

  "candidates.create": ["candidates.view", "vacancies.view"],
  "candidates.edit": ["candidates.view", "vacancies.view"],
  "candidates.delete": ["candidates.view"],
  "candidates.hire": ["candidates.view"],

  "vacation_types.create": ["vacation_types.view"],
  "vacation_types.edit": ["vacation_types.view"],
  "vacation_types.delete": ["vacation_types.view"],

  "users.create": ["users.view", "employees.view"],
  "users.edit": ["users.view", "employees.view"],
  "users.delete": ["users.view"],
  "users.reset_password": ["users.view"],

  "roles.create": ["roles.view"],
  "roles.edit": ["roles.view"],
  "roles.delete": ["roles.view"],

  "settings.backups_view": ["settings.view"],
  "settings.backups_create": ["settings.view"],
  "settings.backups_restore": ["settings.view"],
  "settings.backups_open_folder": ["settings.view"],
};

/** Permissions whose backend operation is intentionally restricted to global scope. */
export const globalOnlyPermissionCodes = new Set([
  "vacation_types.create",
  "vacation_types.edit",
  "vacation_types.delete",
  "users.view",
  "users.create",
  "users.edit",
  "users.delete",
  "users.reset_password",
  "roles.view",
  "roles.create",
  "roles.edit",
  "roles.delete",
  "audit.view",
  "settings.backups_view",
  "settings.backups_create",
  "settings.backups_restore",
  "settings.backups_open_folder",
  "employees.export",
]);

export const legacyPermissionCodes = new Set([
  "employees.manage",
  "organization.manage",
  "vacations.manage",
  "recruitment.view",
  "recruitment.manage",
  "access.manage",
  "settings.manage",
  "payroll.view",
  "payroll.manage",
]);