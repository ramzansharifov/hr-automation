import {
  FiArchive,
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiDownload,
  FiEdit2,
  FiExternalLink,
  FiEye,
  FiFolder,
  FiKey,
  FiLogIn,
  FiLogOut,
  FiPlus,
  FiRefreshCw,
  FiRotateCcw,
  FiSave,
  FiSearch,
  FiSettings,
  FiTrash2,
  FiUpload,
  FiUserX,
  FiUserCheck,
  FiX,
} from "react-icons/fi";
import type { IconType } from "react-icons";

import type { ButtonVariant } from "./buttonVariants";

export type ActionContext = "default" | "inverse";

export type AppAction =
  | "backup"
  | "back"
  | "cancel"
  | "clear"
  | "close"
  | "confirm"
  | "create"
  | "delete"
  | "edit"
  | "export"
  | "folderOpen"
  | "hire"
  | "import"
  | "login"
  | "logout"
  | "manage"
  | "next"
  | "open"
  | "passwordReset"
  | "previous"
  | "refresh"
  | "reset"
  | "restore"
  | "save"
  | "search"
  | "terminate"
  | "view";

interface ActionDefinition {
  defaultLabel: string;
  labelKey: string;
  icon: IconType;
  iconPosition?: "left" | "right";
  loadingLabel?: string;
  loadingLabelKey?: string;
  variant: ButtonVariant;
}

export const actionDefinitions: Record<AppAction, ActionDefinition> = {
  backup: {
    defaultLabel: "Создать резервную копию",
    labelKey: "common.actions.backup",
    icon: FiArchive,
    loadingLabel: "Создание...",
    loadingLabelKey: "common.loading.creating",
    variant: "primary",
  },
  back: {
    defaultLabel: "Назад",
    labelKey: "common.actions.back",
    icon: FiArrowLeft,
    variant: "secondary",
  },
  cancel: {
    defaultLabel: "Отмена",
    labelKey: "common.actions.cancel",
    icon: FiX,
    variant: "secondary",
  },
  clear: {
    defaultLabel: "Очистить",
    labelKey: "common.actions.clear",
    icon: FiX,
    variant: "secondary",
  },
  close: {
    defaultLabel: "Закрыть",
    labelKey: "common.actions.close",
    icon: FiX,
    variant: "secondary",
  },
  confirm: {
    defaultLabel: "Подтвердить",
    labelKey: "common.actions.confirm",
    icon: FiCheck,
    loadingLabel: "Сохранение...",
    loadingLabelKey: "common.loading.saving",
    variant: "primary",
  },
  create: {
    defaultLabel: "Добавить",
    labelKey: "common.actions.add",
    icon: FiPlus,
    loadingLabel: "Добавление...",
    loadingLabelKey: "common.loading.adding",
    variant: "primary",
  },
  delete: {
    defaultLabel: "Удалить",
    labelKey: "common.actions.delete",
    icon: FiTrash2,
    loadingLabel: "Удаление...",
    loadingLabelKey: "common.loading.deleting",
    variant: "danger",
  },
  edit: {
    defaultLabel: "Редактировать",
    labelKey: "common.actions.edit",
    icon: FiEdit2,
    variant: "secondary",
  },
  export: {
    defaultLabel: "Экспорт",
    labelKey: "common.actions.export",
    icon: FiDownload,
    loadingLabel: "Экспорт...",
    loadingLabelKey: "common.loading.exporting",
    variant: "secondary",
  },
  folderOpen: {
    defaultLabel: "Открыть папку",
    labelKey: "common.actions.folderOpen",
    icon: FiFolder,
    variant: "secondary",
  },
  hire: {
    defaultLabel: "Принять на работу",
    labelKey: "common.actions.hire",
    icon: FiUserCheck,
    loadingLabel: "Оформление...",
    loadingLabelKey: "common.loading.processing",
    variant: "primary",
  },
  import: {
    defaultLabel: "Импорт",
    labelKey: "common.actions.import",
    icon: FiUpload,
    loadingLabel: "Импорт...",
    loadingLabelKey: "common.loading.importing",
    variant: "secondary",
  },
  login: {
    defaultLabel: "Войти",
    labelKey: "common.actions.login",
    icon: FiLogIn,
    loadingLabel: "Вход...",
    loadingLabelKey: "common.loading.signingIn",
    variant: "primary",
  },
  logout: {
    defaultLabel: "Выйти",
    labelKey: "common.actions.logout",
    icon: FiLogOut,
    variant: "secondary",
  },
  manage: {
    defaultLabel: "Управлять",
    labelKey: "common.actions.manage",
    icon: FiSettings,
    variant: "secondary",
  },
  next: {
    defaultLabel: "Далее",
    labelKey: "common.actions.next",
    icon: FiArrowRight,
    iconPosition: "right",
    variant: "primary",
  },
  open: {
    defaultLabel: "Открыть",
    labelKey: "common.actions.open",
    icon: FiExternalLink,
    variant: "secondary",
  },
  passwordReset: {
    defaultLabel: "Сбросить пароль",
    labelKey: "common.actions.passwordReset",
    icon: FiKey,
    loadingLabel: "Сохранение...",
    loadingLabelKey: "common.loading.saving",
    variant: "secondary",
  },
  previous: {
    defaultLabel: "Назад",
    labelKey: "common.actions.previous",
    icon: FiArrowLeft,
    variant: "secondary",
  },
  refresh: {
    defaultLabel: "Обновить",
    labelKey: "common.actions.refresh",
    icon: FiRefreshCw,
    loadingLabel: "Обновление...",
    loadingLabelKey: "common.loading.refreshing",
    variant: "secondary",
  },
  reset: {
    defaultLabel: "Сбросить",
    labelKey: "common.actions.reset",
    icon: FiRotateCcw,
    variant: "secondary",
  },
  restore: {
    defaultLabel: "Восстановить",
    labelKey: "common.actions.restore",
    icon: FiRotateCcw,
    loadingLabel: "Восстановление...",
    loadingLabelKey: "common.loading.restoring",
    variant: "danger",
  },
  save: {
    defaultLabel: "Сохранить",
    labelKey: "common.actions.save",
    icon: FiSave,
    loadingLabel: "Сохранение...",
    loadingLabelKey: "common.loading.saving",
    variant: "primary",
  },
  search: {
    defaultLabel: "Найти",
    labelKey: "common.actions.search",
    icon: FiSearch,
    loadingLabel: "Поиск...",
    loadingLabelKey: "common.loading.searching",
    variant: "primary",
  },
  terminate: {
    defaultLabel: "Уволить",
    labelKey: "common.actions.terminate",
    icon: FiUserX,
    loadingLabel: "Оформление...",
    loadingLabelKey: "common.loading.processing",
    variant: "danger",
  },
  view: {
    defaultLabel: "Просмотреть",
    labelKey: "common.actions.view",
    icon: FiEye,
    variant: "secondary",
  },
};


export function getActionVariant(
  action: AppAction,
  context: ActionContext = "default",
): ButtonVariant {
  const variant = actionDefinitions[action].variant;
  if (context === "default" || variant === "danger") return variant;
  return variant === "primary" ? "inverse" : "inverseGhost";
}
