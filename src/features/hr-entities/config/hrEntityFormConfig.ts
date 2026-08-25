import type { HrEntityKey } from "../../../shared/types/hr";

export type HrEntityFormFieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "date"
  | "textarea"
  | "select"
  | "relation";

export type HrEntityRelationLabel = "name" | "employeeName";

export interface HrEntityFormOption {
  labelKey: string;
  value: string;
}

export interface HrEntityFormField {
  name: string;
  labelKey: string;
  placeholderKey?: string;
  required?: boolean;
  type: HrEntityFormFieldType;
  options?: HrEntityFormOption[];
  relation?: {
    entity: HrEntityKey;
    label: HrEntityRelationLabel;
    orderBy: string;
    placeholderKey: string;
  };
}

export interface HrEntityFormConfig {
  createTitleKey: string;
  editTitleKey: string;
  fields: HrEntityFormField[];
}

const vacationStatusOptions: HrEntityFormOption[] = [
  { value: "planned", labelKey: "common.status.planned" },
  { value: "approved", labelKey: "common.status.approved" },
  { value: "rejected", labelKey: "common.status.rejected" },
  { value: "completed", labelKey: "common.status.completed" },
];

const legalFormOptions: HrEntityFormOption[] = [
  "ООО",
  "ЗАО",
  "ОАО",
  "АО",
  "ИП",
  "ГУП",
  "НКО",
  "Другое",
].map((value) => ({ value, labelKey: value }));

const employmentTypeOptions: HrEntityFormOption[] = [
  { value: "full_time", labelKey: "Полная занятость" },
  { value: "part_time", labelKey: "Частичная занятость" },
  { value: "temporary", labelKey: "Временная работа" },
  { value: "internship", labelKey: "Стажировка" },
];

export const hrEntityFormConfigs: Record<HrEntityKey, HrEntityFormConfig> = {
  enterprises: {
    createTitleKey: "forms.enterprises.createTitle",
    editTitleKey: "forms.enterprises.editTitle",
    fields: [
      {
        name: "legal_form",
        labelKey: "Категория предприятия",
        required: true,
        type: "select",
        options: legalFormOptions,
      },
      {
        name: "name",
        labelKey: "forms.fields.enterpriseName",
        required: true,
        type: "text",
      },
      { name: "legal_name", labelKey: "forms.fields.legalName", type: "text" },
      {
        name: "registration_number",
        labelKey: "forms.fields.registrationNumber",
        type: "text",
      },
      { name: "phone", labelKey: "forms.fields.phone", type: "tel" },
      { name: "email", labelKey: "forms.fields.email", type: "email" },
      { name: "address", labelKey: "forms.fields.address", type: "textarea" },
    ],
  },

  departments: {
    createTitleKey: "forms.departments.createTitle",
    editTitleKey: "forms.departments.editTitle",
    fields: [
      {
        name: "enterprise_id",
        labelKey: "forms.fields.enterpriseId",
        required: true,
        type: "relation",
        relation: {
          entity: "enterprises",
          label: "name",
          orderBy: "name",
          placeholderKey: "forms.placeholders.selectEnterprise",
        },
      },
      {
        name: "name",
        labelKey: "forms.fields.name",
        required: true,
        type: "text",
      },
      { name: "phone", labelKey: "forms.fields.phone", type: "tel" },
      { name: "email", labelKey: "forms.fields.email", type: "email" },
      { name: "location", labelKey: "forms.fields.location", type: "text" },
      { name: "created_on", labelKey: "forms.fields.createdOn", type: "date" },
    ],
  },

  positions: {
    createTitleKey: "forms.positions.createTitle",
    editTitleKey: "forms.positions.editTitle",
    fields: [
      {
        name: "department_id",
        labelKey: "forms.fields.departmentId",
        required: true,
        type: "relation",
        relation: {
          entity: "departments",
          label: "name",
          orderBy: "name",
          placeholderKey: "forms.placeholders.selectDepartment",
        },
      },
      {
        name: "name",
        labelKey: "forms.fields.name",
        required: true,
        type: "text",
      },
      {
        name: "responsibilities",
        labelKey: "forms.fields.responsibilities",
        type: "textarea",
      },
    ],
  },

  employees: {
    createTitleKey: "forms.employees.createTitle",
    editTitleKey: "forms.employees.editTitle",
    fields: [
      { name: "employee_number", labelKey: "Табельный номер", type: "text" },
      { name: "last_name", labelKey: "forms.fields.lastName", required: true, type: "text" },
      { name: "first_name", labelKey: "forms.fields.firstName", required: true, type: "text" },
      { name: "middle_name", labelKey: "forms.fields.middleName", type: "text" },
      { name: "birth_date", labelKey: "forms.fields.birthDate", type: "date" },
      {
        name: "gender",
        labelKey: "forms.fields.gender",
        type: "select",
        options: [
          { value: "male", labelKey: "common.status.male" },
          { value: "female", labelKey: "common.status.female" },
        ],
      },
      { name: "phone", labelKey: "forms.fields.phone", type: "tel" },
      { name: "email", labelKey: "forms.fields.email", type: "email" },
      { name: "address_country", labelKey: "forms.fields.addressCountry", type: "text" },
      { name: "address_city", labelKey: "forms.fields.addressCity", type: "text" },
      { name: "address_street", labelKey: "forms.fields.addressStreet", type: "text" },
      { name: "address_house", labelKey: "forms.fields.addressHouse", type: "text" },
      { name: "address_apartment", labelKey: "forms.fields.addressApartment", type: "text" },
      { name: "address", labelKey: "forms.fields.address", type: "textarea" },
      {
        name: "employment_type",
        labelKey: "Тип занятости",
        type: "select",
        options: employmentTypeOptions,
      },
      { name: "contract_number", labelKey: "Номер трудового договора", type: "text" },
      { name: "contract_date", labelKey: "Дата договора", type: "date" },
      { name: "contract_end_date", labelKey: "Срок договора до", type: "date" },
      { name: "probation_end_date", labelKey: "Испытательный срок до", type: "date" },
      { name: "workplace", labelKey: "Место работы", type: "text" },
    ],
  },

  employee_education: {
    createTitleKey: "forms.employeeEducation.createTitle",
    editTitleKey: "forms.employeeEducation.editTitle",
    fields: [
      { name: "employee_id", labelKey: "forms.fields.employeeId", required: true, type: "number" },
      { name: "education_degree", labelKey: "forms.fields.educationDegree", required: true, type: "text" },
      { name: "institution_name", labelKey: "forms.fields.institutionName", required: true, type: "text" },
      { name: "speciality", labelKey: "forms.fields.speciality", type: "text" },
      { name: "started_at", labelKey: "forms.fields.startedAt", type: "date" },
      { name: "ended_at", labelKey: "forms.fields.endedAt", type: "date" },
      { name: "document_number", labelKey: "forms.fields.documentNumber", type: "text" },
    ],
  },

  employee_experience: {
    createTitleKey: "forms.employeeExperience.createTitle",
    editTitleKey: "forms.employeeExperience.editTitle",
    fields: [
      { name: "employee_id", labelKey: "forms.fields.employeeId", required: true, type: "number" },
      { name: "company_name", labelKey: "forms.fields.companyName", required: true, type: "text" },
      { name: "position_name", labelKey: "forms.fields.experiencePositionName", required: true, type: "text" },
      { name: "started_at", labelKey: "forms.fields.startedAt", type: "date" },
      { name: "ended_at", labelKey: "forms.fields.endedAt", type: "date" },
      { name: "is_current", labelKey: "forms.fields.isCurrent", type: "number" },
      { name: "responsibilities", labelKey: "forms.fields.responsibilities", type: "textarea" },
    ],
  },

  employment_history: {
    createTitleKey: "forms.employmentHistory.createTitle",
    editTitleKey: "forms.employmentHistory.editTitle",
    fields: [
      { name: "employee_id", labelKey: "forms.fields.employeeId", required: true, type: "number" },
      { name: "change_type", labelKey: "forms.fields.changeType", required: true, type: "text" },
      { name: "effective_at", labelKey: "forms.fields.effectiveAt", required: true, type: "date" },
      { name: "reason", labelKey: "forms.fields.reason", type: "textarea" },
    ],
  },

  vacation_types: {
    createTitleKey: "Добавить вид отпуска",
    editTitleKey: "Редактировать вид отпуска",
    fields: [
      {
        name: "enterprise_id",
        labelKey: "Предприятие",
        required: true,
        type: "relation",
        relation: {
          entity: "enterprises",
          label: "name",
          orderBy: "name",
          placeholderKey: "Выберите предприятие",
        },
      },
      { name: "name", labelKey: "Название", required: true, type: "text" },
      {
        name: "is_paid_default",
        labelKey: "Оплачиваемый по умолчанию",
        required: true,
        type: "select",
        options: [
          { value: "1", labelKey: "common.answers.yes" },
          { value: "0", labelKey: "common.answers.no" },
        ],
      },
      {
        name: "is_active",
        labelKey: "Активен",
        required: true,
        type: "select",
        options: [
          { value: "1", labelKey: "common.answers.yes" },
          { value: "0", labelKey: "common.answers.no" },
        ],
      },
    ],
  },

  vacations: {
    createTitleKey: "forms.vacations.createTitle",
    editTitleKey: "forms.vacations.editTitle",
    fields: [
      {
        name: "employee_id",
        labelKey: "forms.fields.employeeId",
        required: true,
        type: "relation",
        relation: {
          entity: "employees",
          label: "employeeName",
          orderBy: "last_name",
          placeholderKey: "forms.placeholders.selectEmployee",
        },
      },
      {
        name: "vacation_type_id",
        labelKey: "forms.fields.vacationType",
        required: true,
        type: "relation",
        relation: {
          entity: "vacation_types",
          label: "name",
          orderBy: "name",
          placeholderKey: "forms.placeholders.select",
        },
      },
      { name: "starts_at", labelKey: "forms.fields.startsAt", required: true, type: "date" },
      { name: "ends_at", labelKey: "forms.fields.endsAt", required: true, type: "date" },
      {
        name: "is_paid",
        labelKey: "forms.fields.isPaid",
        required: true,
        type: "select",
        options: [
          { value: "1", labelKey: "common.answers.yes" },
          { value: "0", labelKey: "common.answers.no" },
        ],
      },
      { name: "reason", labelKey: "forms.fields.reason", type: "textarea" },
      {
        name: "status",
        labelKey: "forms.fields.status",
        required: true,
        type: "select",
        options: vacationStatusOptions,
      },
    ],
  },
};

export function getHrEntityFormConfig(entity: HrEntityKey): HrEntityFormConfig {
  return hrEntityFormConfigs[entity];
}
