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

export {
  legacyPermissionCodes,
  permissionDependencies,
} from "../../shared/access/permissionRules";
