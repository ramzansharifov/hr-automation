import type { EmployeeFormValues } from "../types";

export const employeeCreateSteps = [
  {
    key: "personal",
    titleKey: "employeesCreate.steps.personal",
    fields: [
      "last_name",
      "first_name",
      "middle_name",
      "birth_date",
      "gender",
      "phone",
      "email",
    ],
  },
  {
    key: "address",
    titleKey: "employeesCreate.steps.address",
    fields: [
      "address_country",
      "address_city",
      "address_street",
      "address_house",
      "address_apartment",
      "address",
    ],
  },
  {
    key: "company",
    titleKey: "employeesCreate.steps.company",
    fields: [
      "department_id",
      "position_id",
      "hire_date",
      "status",
      "salary",
      "note",
    ],
  },
  {
    key: "review",
    titleKey: "employeesCreate.steps.review",
    fields: [],
  },
] satisfies Array<{
  key: string;
  titleKey: string;
  fields: Array<keyof EmployeeFormValues>;
}>;
