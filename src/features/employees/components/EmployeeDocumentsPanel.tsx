import { useCallback, useEffect, useMemo, useState } from "react";
import { FiFileText } from "react-icons/fi";
import { toast } from "react-toastify";

import { useAuth } from "../../auth/AuthContext";
import { useAppLocale, useAppText } from "../../../shared/i18n";
import { hrApiClient } from "../../../shared/lib/hrApiClient";
import type { DocumentTypeRecord } from "../../../shared/types/documentTypes";
import type { EmployeeDocumentSummary } from "../../../shared/types/hr";
import {
  ActionButton,
  ActionIconButton,
  DeleteReasonDialog,
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
  const text = useAppText();
  const locale = useAppLocale();
  const { hasPermission } = useAuth();
  const canAdd = hasPermission("documents.add");
  const canDelete = hasPermission("documents.delete");
  const [documents, setDocuments] = useState<EmployeeDocumentSummary[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeDocumentSummary | null>(null);
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
      toast.error(errorMessage(error, text("Не удалось загрузить документы сотрудника", "Failed to load employee documents")));
    } finally {
      setLoading(false);
    }
  }, [canAdd, employeeId, text]);

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
      toast.error(text("Для предприятия сотрудника нет активных типов документов", "There are no active document types for the employee enterprise"));
      return;
    }
    if (!title.trim()) {
      toast.error(text("Укажите название документа", "Enter a document name"));
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
      toast.success(text("Документ добавлен", "Document added"));
      setTitle("");
      setIssuedAt("");
      setExpiresAt("");
      await load();
    } catch (error) {
      toast.error(errorMessage(error, text("Не удалось добавить документ", "Failed to add document")));
    } finally {
      setSaving(false);
    }
  }

  async function openDocument(id: number): Promise<void> {
    try {
      await hrApiClient.openEmployeeDocument(id);
    } catch (error) {
      toast.error(errorMessage(error, text("Не удалось открыть документ", "Failed to open document")));
    }
  }

  async function deleteDocument(reason: string): Promise<void> {
    if (!deleteTarget) return;
    try {
      await hrApiClient.deleteEmployeeDocument({
        id: deleteTarget.id,
        reason,
      });
      toast.success(text("Документ удалён, операция сохранена в журнале", "Document deleted and the operation was saved to the audit log"));
      setDeleteTarget(null);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, text("Не удалось удалить документ", "Failed to delete document")));
    }
  }

  if (loading) {
    return <LoadingState label={text("Загрузка документов сотрудника...", "Loading employee documents...")} />;
  }

  return (
    <div className="grid gap-5">
      {canAdd && (
        <section className="app-surface app-border rounded-[24px] border p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="app-accent-soft flex h-10 w-10 items-center justify-center rounded-xl border">
                <FiFileText className="h-5 w-5" />
              </span>
              <h2 className="app-text text-lg font-black">{text("Добавить документ", "Add document")}</h2>
            </div>
            <ActionButton
              action="refresh"
              loading={loading}
              onClick={() => void load()}
              size="sm"
            />
          </div>

          {typeOptions.length === 0 ? (
            <div className="app-surface-muted app-border mt-5 rounded-2xl border p-4">
              <p className="app-text text-sm font-bold">{text("Нет активных типов документов", "No active document types")}</p>
              <p className="app-muted mt-1 text-sm leading-6">
                {text("Сначала добавьте или активируйте тип в разделе «Администрирование → Типы документов».", "First add or activate a type under Administration → Document types.")}
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <Field label={text("Тип документа", "Document type")}>
                <Select
                  onValueChange={setDocumentType}
                  options={typeOptions}
                  value={documentType}
                />
              </Field>
              <Field label={text("Название", "Name")}>
                <Input
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={text("Например: Трудовой договор №15", "For example: Employment contract #15")}
                  value={title}
                />
              </Field>
              <Field label={text("Дата выдачи", "Issue date")}>
                <Input
                  onChange={(event) => setIssuedAt(event.target.value)}
                  type="date"
                  value={issuedAt}
                />
              </Field>
              <Field label={text("Действует до", "Valid until")}>
                <Input
                  onChange={(event) => setExpiresAt(event.target.value)}
                  type="date"
                  value={expiresAt}
                />
              </Field>
              <div className="lg:col-span-2 flex justify-end">
                <ActionButton
                  action="create"
                  loading={saving}
                  onClick={() => void addDocument()}
                  type="button"
                >
                  {text("Выбрать файл и добавить", "Choose file and add")}
                </ActionButton>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="app-surface app-border overflow-hidden rounded-[24px] border">
        <div className="app-surface-muted app-border-soft flex items-center justify-between gap-4 border-b px-5 py-4 sm:px-6">
          <h2 className="app-text font-black">{text("Документы сотрудника", "Employee documents")}</h2>
          <span className="app-text-soft shrink-0 text-sm font-bold">
            {documents.length}
          </span>
        </div>

        {documents.length === 0 ? (
          <EmptyState
            description={text("В карточке сотрудника пока нет активных документов.", "There are no active documents in the employee profile yet.")}
            title={text("Документов пока нет", "No documents yet")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="app-muted text-xs font-black uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-4">{text("Тип", "Type")}</th>
                  <th className="px-5 py-4">{text("Документ", "Document")}</th>
                  <th className="px-5 py-4">{text("Файл", "File")}</th>
                  <th className="px-5 py-4">{text("Срок", "Expiry")}</th>
                  <th className="px-5 py-4">{text("Размер", "Size")}</th>
                  <th className="px-5 py-4 text-right">{text("Действия", "Actions")}</th>
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
                        {text("Предприятие:", "Enterprise:")} {document.enterpriseNameSnapshot || text("Не зафиксировано", "Not recorded")}
                      </p>
                      {document.issuedAt && (
                        <p className="app-muted mt-1 text-xs">
                          {text("Выдан:", "Issued:")} {formatDate(document.issuedAt, locale)}
                        </p>
                      )}
                    </td>
                    <td className="app-muted px-5 py-4">{document.originalName}</td>
                    <td className="app-muted px-5 py-4">
                      {document.expiresAt ? formatDate(document.expiresAt, locale) : text("Бессрочно", "No expiry")}
                    </td>
                    <td className="app-muted px-5 py-4">
                      {formatBytes(document.sizeBytes, locale)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <ActionButton
                          action="open"
                          onClick={() => void openDocument(document.id)}
                          size="sm"
                        >
                          {text("Открыть", "Open")}
                        </ActionButton>
                        {canDelete && (
                          <ActionIconButton
                            action="delete"
                            label={text(`Удалить документ «${document.title}»`, `Delete document “${document.title}”`)}
                            onClick={() => setDeleteTarget(document)}
                            size="sm"
                          />
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

      {canDelete && (
        <DeleteReasonDialog
          description={
            deleteTarget
              ? text(
                  `Документ «${deleteTarget.title}» будет удалён из активной карточки сотрудника. Операция и указанное основание сохранятся в журнале действий.`,
                  `Document “${deleteTarget.title}” will be removed from the active employee profile. The operation and supplied reason will remain in the audit log.`,
                )
              : ""
          }
          onConfirm={deleteDocument}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          open={Boolean(deleteTarget)}
          reasonLabel={text("Основание удаления", "Deletion reason")}
          reasonPlaceholder={text("Например: документ добавлен ошибочно или заменён актуальной версией", "For example: document added by mistake or replaced with an updated version")}
          title={text("Удалить документ?", "Delete document?")}
        />
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

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale).format(new Date(`${value}T00:00:00`));
}

function formatBytes(value: number, locale: string): string {
  const format = (amount: number): string =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(amount);
  if (value < 1024) return `${format(value)} B`;
  if (value < 1024 * 1024) return `${format(value / 1024)} KB`;
  return `${format(value / (1024 * 1024))} MB`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message.split("Error: ").pop() || fallback : fallback;
}
