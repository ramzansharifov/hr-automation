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
    key: "directory",
    title: "Моя команда",
    description: "Безопасный справочник своего предприятия: структура, руководители и рабочие контакты коллег.",
    group: "Основное",
    permissionCodes: ["directory.view"],
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
    key: "documents",
    title: "Документы сотрудников",
    description: "Просмотр и работа с файлами во вкладке «Документы» карточки сотрудника.",
    group: "Основное",
    permissionCodes: ["documents.view", "documents.add", "documents.delete"],
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

export {
  legacyPermissionCodes,
  permissionDependencies,
} from "../../shared/access/permissionRules";
