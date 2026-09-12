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
  icon: IconType;
  iconPosition?: "left" | "right";
  loadingLabel?: string;
  variant: ButtonVariant;
}

export const actionDefinitions: Record<AppAction, ActionDefinition> = {
  backup: {
    defaultLabel: "Создать резервную копию",
    icon: FiArchive,
    loadingLabel: "Создание...",
    variant: "primary",
  },
  back: {
    defaultLabel: "Назад",
    icon: FiArrowLeft,
    variant: "secondary",
  },
  cancel: {
    defaultLabel: "Отмена",
    icon: FiX,
    variant: "secondary",
  },
  clear: {
    defaultLabel: "Очистить",
    icon: FiX,
    variant: "secondary",
  },
  close: {
    defaultLabel: "Закрыть",
    icon: FiX,
    variant: "secondary",
  },
  confirm: {
    defaultLabel: "Подтвердить",
    icon: FiCheck,
    loadingLabel: "Сохранение...",
    variant: "primary",
  },
  create: {
    defaultLabel: "Добавить",
    icon: FiPlus,
    loadingLabel: "Добавление...",
    variant: "primary",
  },
  delete: {
    defaultLabel: "Удалить",
    icon: FiTrash2,
    loadingLabel: "Удаление...",
    variant: "danger",
  },
  edit: {
    defaultLabel: "Редактировать",
    icon: FiEdit2,
    variant: "secondary",
  },
  export: {
    defaultLabel: "Экспорт",
    icon: FiDownload,
    loadingLabel: "Экспорт...",
    variant: "secondary",
  },
  folderOpen: {
    defaultLabel: "Открыть папку",
    icon: FiFolder,
    variant: "secondary",
  },
  hire: {
    defaultLabel: "Принять на работу",
    icon: FiUserCheck,
    loadingLabel: "Оформление...",
    variant: "primary",
  },
  import: {
    defaultLabel: "Импорт",
    icon: FiUpload,
    loadingLabel: "Импорт...",
    variant: "secondary",
  },
  login: {
    defaultLabel: "Войти",
    icon: FiLogIn,
    loadingLabel: "Вход...",
    variant: "primary",
  },
  logout: {
    defaultLabel: "Выйти",
    icon: FiLogOut,
    variant: "secondary",
  },
  manage: {
    defaultLabel: "Управлять",
    icon: FiSettings,
    variant: "secondary",
  },
  next: {
    defaultLabel: "Далее",
    icon: FiArrowRight,
    iconPosition: "right",
    variant: "primary",
  },
  open: {
    defaultLabel: "Открыть",
    icon: FiExternalLink,
    variant: "secondary",
  },
  passwordReset: {
    defaultLabel: "Сбросить пароль",
    icon: FiKey,
    loadingLabel: "Сохранение...",
    variant: "secondary",
  },
  previous: {
    defaultLabel: "Назад",
    icon: FiArrowLeft,
    variant: "secondary",
  },
  refresh: {
    defaultLabel: "Обновить",
    icon: FiRefreshCw,
    loadingLabel: "Обновление...",
    variant: "secondary",
  },
  reset: {
    defaultLabel: "Сбросить",
    icon: FiRotateCcw,
    variant: "secondary",
  },
  restore: {
    defaultLabel: "Восстановить",
    icon: FiRotateCcw,
    loadingLabel: "Восстановление...",
    variant: "danger",
  },
  save: {
    defaultLabel: "Сохранить",
    icon: FiSave,
    loadingLabel: "Сохранение...",
    variant: "primary",
  },
  search: {
    defaultLabel: "Найти",
    icon: FiSearch,
    loadingLabel: "Поиск...",
    variant: "primary",
  },
  terminate: {
    defaultLabel: "Уволить",
    icon: FiUserX,
    loadingLabel: "Оформление...",
    variant: "danger",
  },
  view: {
    defaultLabel: "Просмотреть",
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
