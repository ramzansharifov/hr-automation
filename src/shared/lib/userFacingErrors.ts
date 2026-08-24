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
    return "Сотрудник с таким табельным номером уже существует";
  }
  if (/UNIQUE constraint failed: departments\.enterprise_id, departments\.name/i.test(message)) {
    return "Отдел с таким названием уже существует в выбранном предприятии";
  }
  if (/UNIQUE constraint failed: positions\.department_id, positions\.name/i.test(message)) {
    return "Должность с таким названием уже существует в выбранном отделе";
  }
  if (/UNIQUE constraint failed: vacation_types\.name/i.test(message)) {
    return "Вид отпуска с таким названием уже существует";
  }
  if (/UNIQUE constraint failed: enterprises\.name/i.test(message)) {
    return "Предприятие с таким названием уже существует";
  }
  if (/Электронная почта уже используется в системе/i.test(message)) {
    return "Электронная почта уже используется в системе";
  }
  if (/FOREIGN KEY constraint failed/i.test(message)) {
    return "Не удалось выполнить действие: одна из связанных записей не существует или уже используется";
  }
  if (/NOT NULL constraint failed/i.test(message)) {
    return "Заполните все обязательные поля формы";
  }
  if (/CHECK constraint failed/i.test(message)) {
    return "Проверьте корректность заполненных данных";
  }
  if (/UNIQUE constraint failed/i.test(message)) {
    return "Такая запись уже существует. Проверьте уникальные поля и попробуйте снова";
  }
  if (/SQLITE_CONSTRAINT|SqliteError/i.test(message)) {
    return "Не удалось сохранить данные. Проверьте заполнение формы и попробуйте снова";
  }

  return message;
}
