import { useCallback, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import {
  FiBookOpen,
  FiEdit2,
  FiPlus,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { toast } from "react-toastify";

import { useAuth } from "../features/auth/AuthContext";
import { useBusinessContext } from "../features/business-context/useBusinessContext";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type { DocumentTypeRecord } from "../shared/types/documentTypes";
import {
  Button,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
} from "../shared/ui";

export function DocumentTypesPage(): JSX.Element {
  const { hasPermission, session } = useAuth();
  const { state: businessContext } = useBusinessContext();
  const canCreate = hasPermission("document_types.create");
  const canEdit = hasPermission("document_types.edit");
  const canDelete = hasPermission("document_types.delete");
  const [types, setTypes] = useState<DocumentTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentTypeRecord | null>(null);
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setTypes(await hrApiClient.listDocumentTypes());
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось загрузить типы документов"));
    } finally {
      setLoading(false);
    }
  }, []);

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
      toast.error("Укажите название типа документа");
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
      toast.success(editing ? "Тип документа обновлён" : "Тип документа добавлен");
      setDialogOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось сохранить тип документа"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(type: DocumentTypeRecord): Promise<void> {
    if (!canDelete) return;
    const confirmed = window.confirm(
      `Удалить тип документа «${type.name}»? Если он уже используется, система не позволит его удалить.`,
    );
    if (!confirmed) return;
    try {
      await hrApiClient.deleteDocumentType(type.id);
      toast.success("Тип документа удалён");
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось удалить тип документа"));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          canCreate ? (
            <Button
              className="border-white/20 shadow-xl hover:opacity-90"
              leftIcon={<FiPlus className="h-4 w-4" />}
              onClick={openCreate}
              style={{ background: "#ffffff", color: "#0f172a" }}
              variant="ghost"
            >
              Добавить тип документа
            </Button>
          ) : undefined
        }
        icon={<FiBookOpen />}
        title="Типы документов"
      />

      {loading ? (
        <LoadingState label="Загрузка типов документов..." />
      ) : types.length === 0 ? (
        <EmptyState
          description="Добавьте типы документов, которые сотрудники кадровой службы смогут прикреплять к карточкам сотрудников."
          title="Типов документов пока нет"
        />
      ) : (
        <section className="app-surface app-border overflow-hidden rounded-[24px] border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="app-surface-muted app-muted text-xs font-black uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-4">Название</th>
                  <th className="px-5 py-4">Статус</th>
                  {(canEdit || canDelete) && (
                    <th className="px-5 py-4 text-right">Действия</th>
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
                        {type.isActive ? "Активен" : "Отключён"}
                      </span>
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {canEdit && (
                            <Button
                              leftIcon={<FiEdit2 className="h-4 w-4" />}
                              onClick={() => openEdit(type)}
                              size="sm"
                              variant="secondary"
                            >
                              Изменить
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              leftIcon={<FiTrash2 className="h-4 w-4" />}
                              onClick={() => void remove(type)}
                              size="sm"
                              variant="ghost"
                            >
                              Удалить
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
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
                {editing ? "Редактировать тип документа" : "Новый тип документа"}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  aria-label="Закрыть"
                  className="app-surface-muted app-border app-text-soft flex h-9 w-9 items-center justify-center rounded-xl border"
                  type="button"
                >
                  <FiX />
                </button>
              </Dialog.Close>
            </div>

            <div className="mt-6 grid gap-5">
              <label className="grid gap-2">
                <span className="app-text text-sm font-black">Название</span>
                <Input
                  autoFocus
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Например: Медицинская книжка"
                  value={name}
                />
              </label>

              <div className="app-surface-muted app-border flex items-center justify-between gap-4 rounded-2xl border p-4">
                <div>
                  <p className="app-text text-sm font-black">Активен</p>
                  <p className="app-muted mt-1 text-xs leading-5">
                    Отключённые типы сохраняются в истории, но их нельзя выбрать для нового документа.
                  </p>
                </div>
                <Switch.Root
                  checked={isActive}
                  className="app-border relative h-7 w-12 shrink-0 rounded-full border bg-slate-400/20 data-[state=checked]:bg-[var(--accent)]"
                  onCheckedChange={setIsActive}
                >
                  <Switch.Thumb className="block h-5 w-5 translate-x-1 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-6" />
                </Switch.Root>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Dialog.Close asChild>
                <Button type="button" variant="secondary">
                  Отмена
                </Button>
              </Dialog.Close>
              <Button disabled={saving} onClick={() => void save()} type="button">
                Сохранить
              </Button>
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
