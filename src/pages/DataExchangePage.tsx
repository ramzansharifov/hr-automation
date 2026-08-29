import { useMemo, useState } from "react";
import { FiDownload, FiFile, FiPlay, FiUpload } from "react-icons/fi";
import { toast } from "react-toastify";

import { useAuth } from "../features/auth/AuthContext";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type {
  DataExportDomain,
  DataExportFormat,
  EmployeeImportColumnMap,
  EmployeeImportPreview,
  EmployeeImportSelection,
} from "../shared/types/hr";
import { Button, EmptyState, PageHeader, Select, type SelectOption } from "../shared/ui";

const importFields = [
  { key: "last_name", label: "Фамилия", required: true, aliases: ["фамилия", "last name", "lastname", "last_name"] },
  { key: "first_name", label: "Имя", required: true, aliases: ["имя", "first name", "firstname", "first_name"] },
  { key: "middle_name", label: "Отчество", required: false, aliases: ["отчество", "middle name", "middle_name"] },
  { key: "email", label: "Email", required: false, aliases: ["email", "e-mail", "почта"] },
  { key: "phone", label: "Телефон", required: false, aliases: ["телефон", "phone", "mobile"] },
  { key: "employee_number", label: "Табельный номер", required: false, aliases: ["табельный номер", "employee number", "employee_number"] },
  { key: "enterprise", label: "Предприятие", required: false, aliases: ["предприятие", "enterprise", "company"] },
  { key: "department", label: "Отдел", required: false, aliases: ["отдел", "department"] },
  { key: "position", label: "Должность", required: false, aliases: ["должность", "position", "job title"] },
  { key: "hire_date", label: "Дата приёма", required: false, aliases: ["дата приема", "дата приёма", "hire date", "hire_date"] },
  { key: "salary", label: "Оклад", required: false, aliases: ["оклад", "salary"] },
] as const;

type ImportFieldKey = (typeof importFields)[number]["key"];
type ImportMapState = Partial<Record<ImportFieldKey, string>>;

const exportDomains: SelectOption[] = [
  { value: "employees", label: "Сотрудники" },
  { value: "organization", label: "Организационная структура" },
  { value: "vacations", label: "Отпуска" },
  { value: "employment_history", label: "Кадровый журнал" },
  { value: "vacancies", label: "Вакансии" },
  { value: "audit", label: "Журнал действий" },
];

export function DataExchangePage(): JSX.Element {
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
      toast.error(errorMessage(error, "Не удалось прочитать файл"));
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
        toast.success(`Проверка завершена: ${result.validRows} строк готовы к импорту`);
      }
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось проверить импорт"));
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
      toast.success(`Импортировано сотрудников: ${result.importedRows}. Пропущено: ${result.skippedRows}.`);
      setSelection(null);
      setPreview(null);
      setColumnMap({});
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось выполнить импорт"));
    } finally {
      setBusy(false);
    }
  }

  async function exportData(): Promise<void> {
    setBusy(true);
    try {
      const result = await hrApiClient.exportData({ domain: exportDomain, format: exportFormat });
      if (!result.canceled) toast.success("Файл экспорта сохранён");
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось выполнить экспорт"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Data Exchange" icon={<FiFile />} title="Импорт и экспорт" />

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="app-surface app-border rounded-[24px] border p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="app-text text-lg font-black">Импорт сотрудников</h2>
            <FiUpload className="app-muted h-5 w-5 shrink-0" />
          </div>

          {hasPermission("data_exchange.import") ? (
            <div className="mt-5 grid gap-5">
              <Button disabled={busy} leftIcon={<FiUpload />} onClick={() => void selectImportFile()}>
                Выбрать CSV / XLSX
              </Button>

              {selection && (
                <>
                  <div className="app-surface-muted app-border rounded-2xl border p-4 text-sm">
                    <p className="app-text font-black">{selection.fileName}</p>
                    <p className="app-muted mt-1">Строк: {selection.totalRows} · Колонок: {selection.headers.length}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {importFields.map((field) => (
                      <label className="grid gap-2" key={field.key}>
                        <span className="app-text text-sm font-black">
                          {field.label}{field.required ? " *" : ""}
                        </span>
                        <Select
                          allowEmpty={!field.required}
                          emptyOptionLabel="Не импортировать"
                          onValueChange={(value) => {
                            setPreview(null);
                            setColumnMap((current) => ({ ...current, [field.key]: value || undefined }));
                          }}
                          options={headerOptions}
                          placeholder="Выберите колонку"
                          value={columnMap[field.key] ?? ""}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="flex flex-wrap justify-end gap-3">
                    <Button disabled={busy} leftIcon={<FiPlay />} onClick={() => void previewImport()} variant="secondary">
                      Проверить / Dry run
                    </Button>
                    <Button disabled={busy || !preview || preview.validRows === 0} leftIcon={<FiUpload />} onClick={() => void applyImport()}>
                      Импортировать {preview?.validRows ?? ""}
                    </Button>
                  </div>
                </>
              )}

              {preview && (
                <div className="grid gap-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MiniMetric label="Всего" value={preview.totalRows} />
                    <MiniMetric label="Готово" value={preview.validRows} />
                    <MiniMetric label="Дубликаты" value={preview.duplicateRows} />
                  </div>
                  {preview.errors.length > 0 && (
                    <div className="max-h-64 overflow-auto rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
                      <p className="font-black text-rose-600 dark:text-rose-300">Ошибки проверки</p>
                      <div className="mt-3 grid gap-2 text-sm">
                        {preview.errors.slice(0, 100).map((item, index) => (
                          <p className="app-muted" key={`${item.row}-${index}`}>
                            <strong className="app-text">Строка {item.row}:</strong> {item.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selection && selection.sampleRows.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
                  <div className="app-surface-muted px-4 py-3 text-sm font-black">Предпросмотр исходного файла</div>
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
            <EmptyState description="У текущей роли нет разрешения на импорт кадровых данных." title="Импорт недоступен" />
          )}
        </article>

        <article className="app-surface app-border rounded-[24px] border p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="app-text text-lg font-black">Расширенный экспорт</h2>
            <FiDownload className="app-muted h-5 w-5 shrink-0" />
          </div>

          {hasPermission("data_exchange.export") ? (
            <div className="mt-5 grid gap-4">
              <Field label="Раздел">
                <Select
                  onValueChange={(value) => setExportDomain(value as DataExportDomain)}
                  options={exportDomains}
                  value={exportDomain}
                />
              </Field>
              <Field label="Формат">
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
                <p className="app-text font-black">Область данных применяется автоматически</p>
                <p className="app-muted mt-1">
                  Администратор предприятия выгружает только своё предприятие, администратор отдела — только свой отдел. Глобальная роль получает полный набор данных.
                </p>
              </div>
              <Button disabled={busy} leftIcon={<FiDownload />} onClick={() => void exportData()}>
                Экспортировать
              </Button>
            </div>
          ) : (
            <EmptyState description="У текущей роли нет разрешения на расширенный экспорт." title="Экспорт недоступен" />
          )}
        </article>
      </section>
    </div>
  );
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
