export interface EmployeeFormValues {
  employee_number: string
  last_name: string
  first_name: string
  middle_name: string
  birth_date: string
  gender: string
  phone: string
  email: string
  address_country: string
  address_city: string
  address_street: string
  address_house: string
  address_apartment: string
  address: string
  department_id: string
  position_id: string
  hire_date: string
  status: string
  salary: string
  employment_type: string
  contract_number: string
  contract_date: string
  contract_end_date: string
  probation_end_date: string
  workplace: string
}

export const employeeDefaultValues: EmployeeFormValues = {
  employee_number: '',
  last_name: '',
  first_name: '',
  middle_name: '',
  birth_date: '',
  gender: '',
  phone: '',
  email: '',
  address_country: '',
  address_city: '',
  address_street: '',
  address_house: '',
  address_apartment: '',
  address: '',
  department_id: '',
  position_id: '',
  hire_date: '',
  status: 'active',
  salary: '0',
  employment_type: 'full_time',
  contract_number: '',
  contract_date: '',
  contract_end_date: '',
  probation_end_date: '',
  workplace: '',
}
