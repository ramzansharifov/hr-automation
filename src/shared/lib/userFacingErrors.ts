import { appText } from "../i18n";

export function getUserFacingErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (!(error instanceof Error)) return fallback;

  const raw = error.message.trim();
  const parts = raw.split("Error: ");
  const message = (parts[parts.length - 1] || raw).trim();

  if (!message) return fallback;

  if (
    /UNIQUE constraint failed: employees\.employee_number|uq_employees_employee_number/i.test(
      message,
    )
  ) {
    return appText("Сотрудник с таким табельным номером уже существует", "An employee with this employee number already exists");
  }
  if (/UNIQUE constraint failed: departments\.enterprise_id, departments\.name/i.test(message)) {
    return appText("Отдел с таким названием уже существует в выбранном предприятии", "A department with this name already exists in the selected enterprise");
  }
  if (/UNIQUE constraint failed: positions\.department_id, positions\.name/i.test(message)) {
    return appText("Должность с таким названием уже существует в выбранном отделе", "A position with this name already exists in the selected department");
  }
  if (/UNIQUE constraint failed: vacation_types\.name/i.test(message)) {
    return appText("Вид отпуска с таким названием уже существует", "A vacation type with this name already exists");
  }
  if (/UNIQUE constraint failed: enterprises\.name/i.test(message)) {
    return appText("Предприятие с таким названием уже существует", "An enterprise with this name already exists");
  }
  if (/Электронная почта уже используется в системе/i.test(message)) {
    return appText("Электронная почта уже используется в системе", "This email address is already in use");
  }
  if (/FOREIGN KEY constraint failed/i.test(message)) {
    return appText("Не удалось выполнить действие: одна из связанных записей не существует или уже используется", "The action could not be completed because a related record does not exist or is already in use");
  }
  if (/NOT NULL constraint failed/i.test(message)) {
    return appText("Заполните все обязательные поля формы", "Fill in all required fields");
  }
  if (/CHECK constraint failed/i.test(message)) {
    return appText("Проверьте корректность заполненных данных", "Check the entered data");
  }
  if (/UNIQUE constraint failed/i.test(message)) {
    return appText("Такая запись уже существует. Проверьте уникальные поля и попробуйте снова", "This record already exists. Check unique fields and try again");
  }
  if (/SQLITE_CONSTRAINT|SqliteError/i.test(message)) {
    return appText("Не удалось сохранить данные. Проверьте заполнение формы и попробуйте снова", "Failed to save data. Check the form and try again");
  }

  return message;
}
