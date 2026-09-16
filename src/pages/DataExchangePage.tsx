import { useMemo, useState } from "react";
import { FiDownload, FiFile, FiUpload } from "react-icons/fi";
import { toast } from "react-toastify";

import { useAuth } from "../features/auth/AuthContext";
import { useAppText } from "../shared/i18n";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type {
  DataExportDomain,
  DataExportFormat,
  EmployeeImportColumnMap,
  EmployeeImportPreview,
  EmployeeImportSelection,
} from "../shared/types/hr";
import {
  ActionButton,
  EmptyState,
  PageHeader,
  Select,
  type SelectOption,
} from "../shared/ui";

const importFields = [
  { key: "last_name", label: "Фамилия", required: true, aliases: ["фамилия", "last name", "lastname", "last_name"] },
  { key: "first_name", label: "Имя", required: true, aliases: ["имя", "first name", "firstname", "first_name"] },
  { key: "middle_name", label: "Отчество", required: false, aliases: ["отчество", "middle name", "middle_name"] },
  { key: "birth_date", label: "Дата рождения", required: false, aliases: ["дата рождения", "birth date", "birth_date"] },
  { key: "email", label: "Email", required: false, aliases: ["email", "e-mail", "почта"] },
  { key: "phone", label: "Телефон", required: false, aliases: ["телефон", "phone", "mobile"] },
  { key: "employee_number", label: "Табельный номер", required: false, aliases: ["табельный номер", "employee number", "employee_number"] },
  { key: "contract_number", label: "Номер трудового договора", required: false, aliases: ["номер договора", "трудовой договор", "contract number", "contract_number"] },
  { key: "enterprise", label: "Предприятие", required: false, aliases: ["предприятие", "enterprise", "company"] },
  { key: "department", label: "Отдел", required: false, aliases: ["отдел", "department"] },
  { key: "position", label: "Должность", required: false, aliases: ["должность", "position", "job title"] },
  { key: "hire_date", label: "Дата приёма", required: false, aliases: ["дата приема", "дата приёма", "hire date", "hire_date"] },
  { key: "salary", label: "Оклад", required: false, aliases: ["оклад", "salary"] },
] as const;

type ImportFieldKey = (typeof importFields)[number]["key"];
type ImportMapState = Partial<Record<ImportFieldKey, string>>;

export function DataExchangePage(): JSX.Element {
  const text = useAppText();
  const exportDomains: SelectOption[] = [
    { value: "employees", label: text("Сотрудники", "Employees") },
    { value: "organization", label: text("Организационная структура", "Organization structure") },
    { value: "vacations", label: text("Отпуска", "Vacations") },
    { value: "employment_history", label: text("Кадровый журнал", "Employment history") },
    { value: "vacancies", label: text("Вакансии", "Vacancies") },
    { value: "audit", label: text("Журнал действий", "Audit log") },
  ];
  const { hasPermission } = useAuth();
  const [selection, setSelection] = useState<EmployeeImportSelection | null>(null);
  const [columnMap, setColumnMap] = useState<ImportMapState>({});
  const [preview, setPreview] = useState<EmployeeImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportDomain, setExportDomain] = useState<DataExportDomain>("employees");
  const [exportFormat, setExportFormat] = useState<DataExportFormat>("xlsx");

  const headerOptions = useMemo<SelectOption[]>(
    () =>
      (selection?.headers ?? []).map((header) => ({
        value: header,
        label: header,
      })),
    [selection],
  );

  async function selectImportFile(): Promise<void> {
    setBusy(true);
    try {
      const selected = await hrApiClient.selectEmployeeImportFile();
      if (!selected) return;
      setSelection(selected);
      setColumnMap(autoMapHeaders(selected.headers));
      setPreview(null);
    } catch (error) {
      toast.error(errorMessage(error, text("Не удалось прочитать файл", "Failed to read file")));
    } finally {
      setBusy(false);
    }
  }

  async function previewImport(): Promise<void> {
    if (!selection) return;
    setBusy(true);
    try {
      const result = await hrApiClient.previewEmployeeImport({
        previewId: selection.previewId,
        columnMap: runtimeColumnMap(columnMap),
      });
      setPreview(result);
      if (result.errors.length === 0) {
        toast.success(text(`Проверка завершена: ${result.validRows} строк готовы к импорту`, `Validation complete: ${result.validRows} rows are ready to import`));
      }
    } catch (error) {
      toast.error(errorMessage(error, text("Не удалось проверить импорт", "Failed to validate import")));
    } finally {
      setBusy(false);
    }
  }

  async function applyImport(): Promise<void> {
    if (!selection || !preview) return;
    setBusy(true);
    try {
      const result = await hrApiClient.applyEmployeeImport({
        previewId: selection.previewId,
        columnMap: runtimeColumnMap(columnMap),
        dryRun: false,
      });
      toast.success(text(`Импортировано сотрудников: ${result.importedRows}. Пропущено: ${result.skippedRows}.`, `Employees imported: ${result.importedRows}. Skipped: ${result.skippedRows}.`));
      setSelection(null);
      setPreview(null);
      setColumnMap({});
    } catch (error) {
      toast.error(errorMessage(error, text("Не удалось выполнить импорт", "Failed to import data")));
    } finally {
      setBusy(false);
    }
  }

  async function exportData(): Promise<void> {
    setBusy(true);
    try {
      const result = await hrApiClient.exportData({ domain: exportDomain, format: exportFormat });
      if (!result.canceled) toast.success(text("Файл экспорта сохранён", "Export file saved"));
    } catch (error) {
      toast.error(errorMessage(error, text("Не удалось выполнить экспорт", "Failed to export data")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Data Exchange" icon={<FiFile />} title={text("Импорт и экспорт", "Import & export")} />

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="app-surface app-border rounded-[24px] border p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="app-text text-lg font-black">{text("Импорт сотрудников", "Employee import")}</h2>
            <FiUpload className="app-muted h-5 w-5 shrink-0" />
          </div>

          {hasPermission("data_exchange.import") ? (
            <div className="mt-5 grid gap-5">
              <ActionButton
                action="import"
                disabled={busy}
                onClick={() => void selectImportFile()}
              >
                {text("Выбрать CSV / XLSX", "Choose CSV / XLSX")}
              </ActionButton>

              {selection && (
                <>
                  <div className="app-surface-muted app-border rounded-2xl border p-4 text-sm">
                    <p className="app-text font-black">{selection.fileName}</p>
                    <p className="app-muted mt-1">{text("Строк:", "Rows:")} {selection.totalRows} · {text("Колонок:", "Columns:")} {selection.headers.length}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {importFields.map((field) => (
                      <label className="grid gap-2" key={field.key}>
                        <span className="app-text text-sm font-black">
                          {importFieldLabel(field.key, text)}{field.required ? " *" : ""}
                        </span>
                        <Select
                          allowEmpty={!field.required}
                          emptyOptionLabel={text("Не импортировать", "Do not import")}
                          onValueChange={(value) => {
                            setPreview(null);
                            setColumnMap((current) => ({ ...current, [field.key]: value || undefined }));
                          }}
                          options={headerOptions}
                          placeholder={text("Выберите колонку", "Select column")}
                          value={columnMap[field.key] ?? ""}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="flex flex-wrap justify-end gap-3">
                    <ActionButton
                      action="view"
                      disabled={busy}
                      onClick={() => void previewImport()}
                    >
                      {text("Проверить / Dry run", "Validate / Dry run")}
                    </ActionButton>
                    <ActionButton
                      action="confirm"
                      disabled={busy || !preview || preview.validRows === 0}
                      onClick={() => void applyImport()}
                    >
                      {text("Импортировать", "Import")} {preview?.validRows ?? ""}
                    </ActionButton>
                  </div>
                </>
              )}

              {preview && (
                <div className="grid gap-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MiniMetric label={text("Всего", "Total")} value={preview.totalRows} />
                    <MiniMetric label={text("Готово", "Ready")} value={preview.validRows} />
                    <MiniMetric label={text("Дубликаты", "Duplicates")} value={preview.duplicateRows} />
                    <MiniMetric label={text("Проверить", "Review")} value={preview.warningRows} />
                  </div>
                  {preview.errors.length > 0 && (
                    <div className="max-h-64 overflow-auto rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
                      <p className="font-black text-rose-600 dark:text-rose-300">{text("Ошибки проверки", "Validation errors")}</p>
                      <div className="mt-3 grid gap-2 text-sm">
                        {preview.errors.slice(0, 100).map((item, index) => (
                          <p className="app-muted" key={`${item.row}-${index}`}>
                            <strong className="app-text">{text("Строка", "Row")} {item.row}:</strong> {item.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {preview.warnings.length > 0 && (
                    <div className="max-h-64 overflow-auto rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
                      <p className="font-black text-amber-700 dark:text-amber-300">
                        {text("Возможные совпадения — проверьте перед импортом", "Possible matches — review before importing")}
                      </p>
                      <div className="mt-3 grid gap-2 text-sm">
                        {preview.warnings.slice(0, 100).map((item, index) => (
                          <p className="app-muted" key={`warning-${item.row}-${index}`}>
                            <strong className="app-text">{text("Строка", "Row")} {item.row}:</strong>{" "}
                            {item.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selection && selection.sampleRows.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
                  <div className="app-surface-muted px-4 py-3 text-sm font-black">{text("Предпросмотр исходного файла", "Source file preview")}</div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="app-muted">
                        <tr>
                          {selection.headers.slice(0, 8).map((header) => (
                            <th className="whitespace-nowrap px-3 py-2" key={header}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selection.sampleRows.slice(0, 5).map((row, index) => (
                          <tr className="border-t border-[var(--color-border-soft)]" key={index}>
                            {selection.headers.slice(0, 8).map((header) => (
                              <td className="app-muted max-w-44 truncate px-3 py-2" key={header}>{row[header]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyState description={text("У текущей роли нет разрешения на импорт кадровых данных.", "The current role does not have permission to import HR data.")} title={text("Импорт недоступен", "Import unavailable")} />
          )}
        </article>

        <article className="app-surface app-border rounded-[24px] border p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="app-text text-lg font-black">{text("Расширенный экспорт", "Advanced export")}</h2>
            <FiDownload className="app-muted h-5 w-5 shrink-0" />
          </div>

          {hasPermission("data_exchange.export") ? (
            <div className="mt-5 grid gap-4">
              <Field label={text("Раздел", "Section")}>
                <Select
                  onValueChange={(value) => setExportDomain(value as DataExportDomain)}
                  options={exportDomains}
                  value={exportDomain}
                />
              </Field>
              <Field label={text("Формат", "Format")}>
                <Select
                  onValueChange={(value) => setExportFormat(value as DataExportFormat)}
                  options={[
                    { value: "xlsx", label: "Excel (.xlsx)" },
                    { value: "csv", label: "CSV (.csv)" },
                  ]}
                  value={exportFormat}
                />
              </Field>
              <div className="app-surface-muted app-border rounded-2xl border p-4 text-sm leading-6">
                <p className="app-text font-black">{text("Область данных применяется автоматически", "Data scope is applied automatically")}</p>
                <p className="app-muted mt-1">
                  {text("Администратор предприятия выгружает только своё предприятие, администратор отдела — только свой отдел. Глобальная роль получает полный набор данных.", "An enterprise administrator exports only their enterprise, a department administrator only their department, and a global role receives the complete dataset.")}
                </p>
              </div>
              <ActionButton
                action="export"
                disabled={busy}
                onClick={() => void exportData()}
              >
                {text("Экспортировать", "Export")}
              </ActionButton>
            </div>
          ) : (
            <EmptyState description={text("У текущей роли нет разрешения на расширенный экспорт.", "The current role does not have permission for advanced export.")} title={text("Экспорт недоступен", "Export unavailable")} />
          )}
        </article>
      </section>
    </div>
  );
}

function importFieldLabel(
  key: ImportFieldKey,
  text: (ru: string, en: string) => string,
): string {
  const labels: Record<ImportFieldKey, [string, string]> = {
    last_name: ["Фамилия", "Last name"],
    first_name: ["Имя", "First name"],
    middle_name: ["Отчество", "Middle name"],
    birth_date: ["Дата рождения", "Date of birth"],
    email: ["Email", "Email"],
    phone: ["Телефон", "Phone"],
    employee_number: ["Табельный номер", "Employee number"],
    contract_number: ["Номер трудового договора", "Employment contract number"],
    enterprise: ["Предприятие", "Enterprise"],
    department: ["Отдел", "Department"],
    position: ["Должность", "Position"],
    hire_date: ["Дата приёма", "Hire date"],
    salary: ["Оклад", "Salary"],
  };
  const label = labels[key];
  return text(label[0], label[1]);
}

function Field({ children, label }: { children: React.ReactNode; label: string }): JSX.Element {
  return (
    <label className="grid gap-2">
      <span className="app-text text-sm font-black">{label}</span>
      {children}
    </label>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="app-surface-muted app-border rounded-2xl border p-4">
      <p className="app-muted text-xs font-bold uppercase tracking-wide">{label}</p>
      <p className="app-text mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function autoMapHeaders(headers: string[]): ImportMapState {
  const normalized = headers.map((header) => ({ header, normalized: normalize(header) }));
  const result: ImportMapState = {};
  for (const field of importFields) {
    const match = normalized.find((candidate) =>
      field.aliases.some((alias) => candidate.normalized === normalize(alias)),
    );
    if (match) result[field.key] = match.header;
  }
  return result;
}

function runtimeColumnMap(value: ImportMapState): EmployeeImportColumnMap {
  return { ...value } as EmployeeImportColumnMap;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/gi, " ").trim();
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message.split("Error: ").pop() || fallback : fallback;
}
