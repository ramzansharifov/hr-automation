import { useCallback, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { FiBookOpen } from "react-icons/fi";
import { toast } from "react-toastify";

import { useAuth } from "../features/auth/AuthContext";
import { useBusinessContext } from "../features/business-context/useBusinessContext";
import { useAppText } from "../shared/i18n";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type { DocumentTypeRecord } from "../shared/types/documentTypes";
import {
  ActionButton,
  ActionIconButton,
  DeleteConfirmDialog,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
  RecordActions,
  Toggle,
} from "../shared/ui";

export function DocumentTypesPage(): JSX.Element {
  const text = useAppText();
  const { hasPermission, session } = useAuth();
  const { state: businessContext } = useBusinessContext();
  const canCreate = hasPermission("document_types.create");
  const canEdit = hasPermission("document_types.edit");
  const canDelete = hasPermission("document_types.delete");
  const [types, setTypes] = useState<DocumentTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentTypeRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentTypeRecord | null>(null);
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setTypes(await hrApiClient.listDocumentTypes());
    } catch (error) {
      toast.error(errorMessage(error, text("Не удалось загрузить типы документов", "Failed to load document types")));
    } finally {
      setLoading(false);
    }
  }, [text]);

  useEffect(() => {
    void load();
  }, [load, businessContext?.enterpriseId]);

  function openCreate(): void {
    if (!canCreate) return;
    setEditing(null);
    setName("");
    setIsActive(true);
    setDialogOpen(true);
  }

  function openEdit(type: DocumentTypeRecord): void {
    if (!canEdit) return;
    setEditing(type);
    setName(type.name);
    setIsActive(type.isActive);
    setDialogOpen(true);
  }

  async function save(): Promise<void> {
    if (!name.trim()) {
      toast.error(text("Укажите название типа документа", "Enter a document type name"));
      return;
    }
    setSaving(true);
    try {
      await hrApiClient.saveDocumentType({
        id: editing?.id,
        enterpriseId:
          editing?.enterpriseId ??
          businessContext?.enterpriseId ??
          session.enterpriseId ??
          undefined,
        name: name.trim(),
        isActive,
      });
      toast.success(editing ? text("Тип документа обновлён", "Document type updated") : text("Тип документа добавлен", "Document type added"));
      setDialogOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, text("Не удалось сохранить тип документа", "Failed to save document type")));
    } finally {
      setSaving(false);
    }
  }

  async function remove(): Promise<void> {
    if (!deleteTarget || !canDelete) return;
    try {
      await hrApiClient.deleteDocumentType(deleteTarget.id);
      toast.success(text("Тип документа удалён", "Document type deleted"));
      setDeleteTarget(null);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, text("Не удалось удалить тип документа", "Failed to delete document type")));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          canCreate ? (
            <ActionButton action="create" onClick={openCreate}>
              {text("Добавить тип документа", "Add document type")}
            </ActionButton>
          ) : undefined
        }
        icon={<FiBookOpen />}
        title={text("Типы документов", "Document types")}
      />

      {loading ? (
        <LoadingState label={text("Загрузка типов документов...", "Loading document types...")} />
      ) : types.length === 0 ? (
        <EmptyState
          description={text("Добавьте типы документов, которые сотрудники кадровой службы смогут прикреплять к карточкам сотрудников.", "Add document types that HR staff can attach to employee profiles.")}
          title={text("Типов документов пока нет", "No document types yet")}
        />
      ) : (
        <section className="app-surface app-border overflow-hidden rounded-[24px] border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="app-surface-muted app-muted text-xs font-black uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-4">{text("Название", "Name")}</th>
                  <th className="px-5 py-4">{text("Статус", "Status")}</th>
                  {(canEdit || canDelete) && (
                    <th className="px-5 py-4 text-right">{text("Действия", "Actions")}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-soft)]">
                {types.map((type) => (
                  <tr key={type.id}>
                    <td className="app-text px-5 py-4 font-bold">{type.name}</td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          type.isActive
                            ? "inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-600"
                            : "app-surface-muted app-border app-muted inline-flex rounded-full border px-3 py-1 text-xs font-black"
                        }
                      >
                        {type.isActive ? text("Активен", "Active") : text("Отключён", "Disabled")}
                      </span>
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="px-5 py-4">
                        <RecordActions
                          deleteLabel={text("Удалить тип документа", "Delete document type")}
                          editLabel={text("Редактировать тип документа", "Edit document type")}
                          onDelete={canDelete ? () => setDeleteTarget(type) : undefined}
                          onEdit={canEdit ? () => openEdit(type) : undefined}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {canDelete && (
        <DeleteConfirmDialog
          description={
            deleteTarget
              ? text(
                  `Тип «${deleteTarget.name}» будет удалён. Если он уже используется, система не позволит выполнить удаление.`,
                  `Type “${deleteTarget.name}” will be deleted. If it is already in use, the system will prevent deletion.`,
                )
              : ""
          }
          onConfirm={remove}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          open={Boolean(deleteTarget)}
          title={text("Удалить тип документа?", "Delete document type?")}
        />
      )}

      <Dialog.Root
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        open={dialogOpen}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm" />
          <Dialog.Content className="app-surface app-border fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[24px] border p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <Dialog.Title className="app-text text-xl font-black">
                {editing ? text("Редактировать тип документа", "Edit document type") : text("Новый тип документа", "New document type")}
              </Dialog.Title>
              <Dialog.Close asChild>
                <ActionIconButton action="close" label={text("Закрыть", "Close")} />
              </Dialog.Close>
            </div>

            <div className="mt-6 grid gap-5">
              <label className="grid gap-2">
                <span className="app-text text-sm font-black">{text("Название", "Name")}</span>
                <Input
                  autoFocus
                  onChange={(event) => setName(event.target.value)}
                  placeholder={text("Например: Медицинская книжка", "For example: Medical certificate")}
                  value={name}
                />
              </label>

              <div className="app-surface-muted app-border flex items-center justify-between gap-4 rounded-2xl border p-4">
                <div>
                  <p className="app-text text-sm font-black">{text("Активен", "Active")}</p>
                  <p className="app-muted mt-1 text-xs leading-5">
                    {text("Отключённые типы сохраняются в истории, но их нельзя выбрать для нового документа.", "Disabled types remain in history but cannot be selected for new documents.")}
                  </p>
                </div>
                <Toggle
                  ariaLabel={text("Тип документа активен", "Document type is active")}
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Dialog.Close asChild>
                <ActionButton action="cancel" type="button" />
              </Dialog.Close>
              <ActionButton
                action="save"
                loading={saving}
                onClick={() => void save()}
                type="button"
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message.split("Error: ").pop() || fallback : fallback;
}
