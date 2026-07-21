import { useEffect, useState } from "react";

export type CollectionViewMode = "table" | "cards";

const GLOBAL_STORAGE_KEY = "hr-collection-view-mode";
const GLOBAL_VIEW_MODE_EVENT = "hr-collection-view-mode-change";
const LEGACY_STORAGE_PREFIX = "hr-collection-view-mode:";
const LEGACY_EMPLOYEES_STORAGE_KEY = "hr-employees-view-mode";

export function useStoredViewMode(
  storageKey: string,
  defaultMode: CollectionViewMode = "table",
): readonly [CollectionViewMode, (mode: CollectionViewMode) => void] {
  const [mode, setMode] = useState<CollectionViewMode>(() =>
    readStoredMode(storageKey, defaultMode),
  );

  useEffect(() => {
    setMode(readStoredMode(storageKey, defaultMode));

    function handleGlobalViewModeChange(event: Event): void {
      if (!(event instanceof CustomEvent)) return;
      if (isCollectionViewMode(event.detail)) setMode(event.detail);
    }

    function handleStorageChange(event: StorageEvent): void {
      if (event.key && event.key !== GLOBAL_STORAGE_KEY) return;
      setMode(readStoredMode(storageKey, defaultMode));
    }

    window.addEventListener(GLOBAL_VIEW_MODE_EVENT, handleGlobalViewModeChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(
        GLOBAL_VIEW_MODE_EVENT,
        handleGlobalViewModeChange,
      );
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [defaultMode, storageKey]);

  function updateMode(nextMode: CollectionViewMode): void {
    setMode(nextMode);
    if (typeof window === "undefined") return;

    window.localStorage.setItem(GLOBAL_STORAGE_KEY, nextMode);
    window.dispatchEvent(
      new CustomEvent(GLOBAL_VIEW_MODE_EVENT, { detail: nextMode }),
    );
  }

  return [mode, updateMode] as const;
}

function readStoredMode(
  storageKey: string,
  fallback: CollectionViewMode,
): CollectionViewMode {
  if (typeof window === "undefined") return fallback;

  const globalMode = window.localStorage.getItem(GLOBAL_STORAGE_KEY);
  if (isCollectionViewMode(globalMode)) return globalMode;

  const legacyKeys = [
    `${LEGACY_STORAGE_PREFIX}${storageKey}`,
    LEGACY_EMPLOYEES_STORAGE_KEY,
  ];

  for (const legacyKey of legacyKeys) {
    const legacyMode = window.localStorage.getItem(legacyKey);
    if (!isCollectionViewMode(legacyMode)) continue;

    window.localStorage.setItem(GLOBAL_STORAGE_KEY, legacyMode);
    return legacyMode;
  }

  window.localStorage.setItem(GLOBAL_STORAGE_KEY, fallback);
  return fallback;
}

function isCollectionViewMode(value: unknown): value is CollectionViewMode {
  return value === "table" || value === "cards";
}
