import { useCallback, useEffect, useMemo, useState } from "react";
import { FiExternalLink, FiFileText, FiPlus, FiTrash2 } from "react-icons/fi";
import { toast } from "react-toastify";

import { useAuth } from "../features/auth/AuthContext";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type { EmployeeDocumentSummary, HrRecord } from "../shared/types/hr";
import {
  Button,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
  SearchableSelect,
  Select,
  type SelectOption,
} from "../shared/ui";

const documentTypeOptions: SelectOption[] = [
  { value: "contract", label: "Трудовой договор" },
  { value: "order", label: "Приказ" },
  { value: "identity", label: "Удостоверение личности / паспорт" },
  { value: "diploma", label: "Диплом / образование" },
  { value: "certificate", label: "Справка / сертификат" },
  { value: "other", label: "Другой документ" },
];

export function DocumentsPage(): JSX.Element {
  const { hasPermission } = useAuth();
  const [employees, setEmployees] = useState<HrRecord[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocumentSummary[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [documentType, setDocumentType] = useState("contract");
  const [title, setTitle] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [employeeRecords, documentRecords] = await Promise.all([
        loadEmployees(),
        hrApiClient.listEmployeeDocuments(employeeId ? Number(employeeId) : undefined),
      ]);
      setEmployees(employeeRecords);
      setDocuments(documentRecords);
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось загрузить документы"));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const employeeOptions = useMemo<SelectOption[]>(
    () =>
      employees.map((employee) => ({
        value: String(employee.id),
        label: `${employeeName(employee)}${employee.department_name ? ` — ${employee.department_name}` : ""}`,
      })),
    [employees],
  );

  async function addDocument(): Promise<void> {
    if (!employeeId) {
      toast.error("Сначала выберите сотрудника");
      return;
    }
    if (!title.trim()) {
      toast.error("Укажите название документа");
      return;
    }
    setSaving(true);
    try {
      const added = await hrApiClient.addEmployeeDocument({
        employeeId: Number(employeeId),
        documentType,
        title: title.trim(),
        issuedAt: issuedAt || null,
        expiresAt: expiresAt || null,
      });
      if (added) {
        toast.success("Документ добавлен и проверочная сумма сохранена");
        setTitle("");
        setIssuedAt("");
        setExpiresAt("");
        await load();
      }
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось добавить документ"));
    } finally {
      setSaving(false);
    }
  }

  async function openDocument(id: number): Promise<void> {
    try {
      await hrApiClient.openEmployeeDocument(id);
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось открыть документ"));
    }
  }

  async function deleteDocument(document: EmployeeDocumentSummary): Promise<void> {
    const reason = window.prompt(`Укажите основание удаления документа «${document.title}»:`)?.trim();
    if (!reason) return;
    try {
      await hrApiClient.deleteEmployeeDocument({ id: document.id, reason });
      toast.success("Документ удалён, запись об операции сохранена");
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось удалить документ"));
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        description="Документы сотрудников хранятся отдельно от SQLite, а в базе фиксируются метаданные, привязка и SHA‑256 для проверки целостности."
        eyebrow="Employee Records"
        icon={<FiFileText />}
        title="Документы сотрудников"
      />

      <section className="app-surface app-border grid gap-5 rounded-[24px] border p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Сотрудник">
            <SearchableSelect
              allowEmpty
              ariaLabel="Сотрудник"
              emptyOptionLabel="Все сотрудники"
              onValueChange={setEmployeeId}
              options={employeeOptions}
              placeholder="Все сотрудники"
              searchPlaceholder="Поиск сотрудника"
              value={employeeId}
            />
          </Field>
          {hasPermission("documents.add") && employeeId && (
            <Field label="Вид документа">
              <Select onValueChange={setDocumentType} options={documentTypeOptions} value={documentType} />
            </Field>
          )}
        </div>

        {hasPermission("documents.add") && employeeId && (
          <div className="app-surface-muted app-border grid gap-4 rounded-2xl border p-4 lg:grid-cols-4">
            <Field label="Название">
              <Input onChange={(event) => setTitle(event.target.value)} placeholder="Например: Трудовой договор №15" value={title} />
            </Field>
            <Field label="Дата выдачи">
              <Input onChange={(event) => setIssuedAt(event.target.value)} type="date" value={issuedAt} />
            </Field>
            <Field label="Действует до">
              <Input onChange={(event) => setExpiresAt(event.target.value)} type="date" value={expiresAt} />
            </Field>
            <div className="flex items-end">
              <Button disabled={saving} leftIcon={<FiPlus />} onClick={() => void addDocument()} type="button">
                Выбрать файл
              </Button>
            </div>
          </div>
        )}
      </section>

      {loading ? (
        <LoadingState label="Загрузка документов..." />
      ) : documents.length === 0 ? (
        <EmptyState
          description={employeeId ? "У выбранного сотрудника пока нет активных документов." : "В доступной области пока нет документов сотрудников."}
          title="Документы не найдены"
        />
      ) : (
        <div className="app-surface app-border overflow-hidden rounded-[24px] border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="app-surface-muted app-muted text-xs font-black uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-4">Сотрудник</th>
                  <th className="px-5 py-4">Документ</th>
                  <th className="px-5 py-4">Файл</th>
                  <th className="px-5 py-4">Срок</th>
                  <th className="px-5 py-4">Размер</th>
                  <th className="px-5 py-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-soft)]">
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td className="app-text px-5 py-4 font-bold">{document.employeeName}</td>
                    <td className="px-5 py-4">
                      <p className="app-text font-bold">{document.title}</p>
                      <p className="app-muted mt-1 text-xs">{document.documentType}</p>
                    </td>
                    <td className="app-muted px-5 py-4">{document.originalName}</td>
                    <td className="app-muted px-5 py-4">{document.expiresAt ? formatDate(document.expiresAt) : "Бессрочно"}</td>
                    <td className="app-muted px-5 py-4">{formatBytes(document.sizeBytes)}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button leftIcon={<FiExternalLink />} onClick={() => void openDocument(document.id)} size="sm" variant="secondary">
                          Открыть
                        </Button>
                        {hasPermission("documents.delete") && (
                          <Button leftIcon={<FiTrash2 />} onClick={() => void deleteDocument(document)} size="sm" variant="ghost">
                            Удалить
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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

async function loadEmployees(): Promise<HrRecord[]> {
  const records: HrRecord[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await hrApiClient.list({ entity: "employees", page, pageSize: 100, orderBy: "last_name" });
    records.push(...result.items);
    totalPages = Math.max(result.totalPages, 1);
    page += 1;
  } while (page <= totalPages);
  return records;
}

function employeeName(record: HrRecord): string {
  return [record.last_name, record.first_name, record.middle_name]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU").format(new Date(`${value}T00:00:00`));
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} КБ`;
  return `${(value / (1024 * 1024)).toFixed(1)} МБ`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message.split("Error: ").pop() || fallback : fallback;
}
