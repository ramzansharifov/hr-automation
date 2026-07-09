export interface EmployeeFormValues {
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
  note: string
}

export const employeeDefaultValues: EmployeeFormValues = {
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
  note: '',
}
