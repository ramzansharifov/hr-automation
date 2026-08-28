import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiExternalLink,
  FiFileText,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
} from "react-icons/fi";
import { toast } from "react-toastify";

import { useAuth } from "../../auth/AuthContext";
import { hrApiClient } from "../../../shared/lib/hrApiClient";
import type { DocumentTypeRecord } from "../../../shared/types/documentTypes";
import type { EmployeeDocumentSummary } from "../../../shared/types/hr";
import {
  Button,
  EmptyState,
  Input,
  LoadingState,
  Select,
  type SelectOption,
} from "../../../shared/ui";

interface EmployeeDocumentsPanelProps {
  employeeId: number;
}

export function EmployeeDocumentsPanel({
  employeeId,
}: EmployeeDocumentsPanelProps): JSX.Element {
  const { hasPermission } = useAuth();
  const canAdd = hasPermission("documents.add");
  const canDelete = hasPermission("documents.delete");
  const [documents, setDocuments] = useState<EmployeeDocumentSummary[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeRecord[]>([]);
  const [documentType, setDocumentType] = useState("");
  const [title, setTitle] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [loadedDocuments, loadedTypes] = await Promise.all([
        hrApiClient.listEmployeeDocuments(employeeId),
        canAdd
          ? hrApiClient.listEmployeeDocumentTypes(employeeId)
          : Promise.resolve([] as DocumentTypeRecord[]),
      ]);
      setDocuments(loadedDocuments);
      setDocumentTypes(loadedTypes);
      setDocumentType((current) => {
        if (current && loadedTypes.some((type) => type.name === current)) return current;
        return loadedTypes[0]?.name ?? "";
      });
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось загрузить документы сотрудника"));
    } finally {
      setLoading(false);
    }
  }, [canAdd, employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const typeOptions = useMemo<SelectOption[]>(
    () =>
      documentTypes.map((type) => ({
        value: type.name,
        label: type.name,
      })),
    [documentTypes],
  );

  async function addDocument(): Promise<void> {
    if (!documentType) {
      toast.error("Для предприятия сотрудника нет активных типов документов");
      return;
    }
    if (!title.trim()) {
      toast.error("Укажите название документа");
      return;
    }
    setSaving(true);
    try {
      const added = await hrApiClient.addEmployeeDocument({
        employeeId,
        documentType,
        title: title.trim(),
        issuedAt: issuedAt || null,
        expiresAt: expiresAt || null,
      });
      if (!added) return;
      toast.success("Документ добавлен");
      setTitle("");
      setIssuedAt("");
      setExpiresAt("");
      await load();
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
    const reason = window.prompt(
      `Укажите основание удаления документа «${document.title}»:`,
    )?.trim();
    if (!reason) return;
    try {
      await hrApiClient.deleteEmployeeDocument({ id: document.id, reason });
      toast.success("Документ удалён, операция сохранена в журнале");
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось удалить документ"));
    }
  }

  if (loading) {
    return <LoadingState label="Загрузка документов сотрудника..." />;
  }

  return (
    <div className="grid gap-5">
      {canAdd && (
        <section className="app-surface app-border rounded-[24px] border p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="app-accent-soft flex h-10 w-10 items-center justify-center rounded-xl border">
                  <FiFileText className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="app-text text-lg font-black">Добавить документ</h2>
                  <p className="app-muted mt-1 text-sm">
                    Тип выбирается из справочника предприятия сотрудника.
                  </p>
                </div>
              </div>
            </div>
            <Button
              leftIcon={<FiRefreshCw className="h-4 w-4" />}
              onClick={() => void load()}
              size="sm"
              variant="secondary"
            >
              Обновить
            </Button>
          </div>

          {typeOptions.length === 0 ? (
            <div className="app-surface-muted app-border mt-5 rounded-2xl border p-4">
              <p className="app-text text-sm font-bold">Нет активных типов документов</p>
              <p className="app-muted mt-1 text-sm leading-6">
                Сначала добавьте или активируйте тип в разделе «Администрирование → Типы документов».
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <Field label="Тип документа">
                <Select
                  onValueChange={setDocumentType}
                  options={typeOptions}
                  value={documentType}
                />
              </Field>
              <Field label="Название">
                <Input
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Например: Трудовой договор №15"
                  value={title}
                />
              </Field>
              <Field label="Дата выдачи">
                <Input
                  onChange={(event) => setIssuedAt(event.target.value)}
                  type="date"
                  value={issuedAt}
                />
              </Field>
              <Field label="Действует до">
                <Input
                  onChange={(event) => setExpiresAt(event.target.value)}
                  type="date"
                  value={expiresAt}
                />
              </Field>
              <div className="lg:col-span-2 flex justify-end">
                <Button
                  disabled={saving}
                  leftIcon={<FiPlus className="h-4 w-4" />}
                  onClick={() => void addDocument()}
                  type="button"
                >
                  Выбрать файл и добавить
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="app-surface app-border overflow-hidden rounded-[24px] border">
        <div className="app-surface-muted app-border-soft flex items-center justify-between gap-4 border-b px-5 py-4 sm:px-6">
          <div>
            <h2 className="app-text font-black">Документы сотрудника</h2>
            <p className="app-muted mt-1 text-sm">
              Предприятие фиксируется в момент добавления документа и не меняется при последующих переводах сотрудника.
            </p>
          </div>
          <span className="app-text-soft shrink-0 text-sm font-bold">
            {documents.length}
          </span>
        </div>

        {documents.length === 0 ? (
          <EmptyState
            description="В карточке сотрудника пока нет активных документов."
            title="Документов пока нет"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="app-muted text-xs font-black uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-4">Тип</th>
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
                    <td className="app-accent-text px-5 py-4 font-bold">
                      {document.documentType || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <p className="app-text font-bold">{document.title}</p>
                      <p className="app-muted mt-1 text-xs">
                        Предприятие: {document.enterpriseNameSnapshot || "Не зафиксировано"}
                      </p>
                      {document.issuedAt && (
                        <p className="app-muted mt-1 text-xs">
                          Выдан: {formatDate(document.issuedAt)}
                        </p>
                      )}
                    </td>
                    <td className="app-muted px-5 py-4">{document.originalName}</td>
                    <td className="app-muted px-5 py-4">
                      {document.expiresAt ? formatDate(document.expiresAt) : "Бессрочно"}
                    </td>
                    <td className="app-muted px-5 py-4">
                      {formatBytes(document.sizeBytes)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          leftIcon={<FiExternalLink className="h-4 w-4" />}
                          onClick={() => void openDocument(document.id)}
                          size="sm"
                          variant="secondary"
                        >
                          Открыть
                        </Button>
                        {canDelete && (
                          <Button
                            leftIcon={<FiTrash2 className="h-4 w-4" />}
                            onClick={() => void deleteDocument(document)}
                            size="sm"
                            variant="ghost"
                          >
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
        )}
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
