import { useEffect, useMemo, useRef, useState } from "react";
import type { IconType } from "react-icons";
import {
  FiBriefcase,
  FiClipboard,
  FiLayers,
  FiSearch,
  FiUser,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import { hrApiClient } from "../shared/lib/hrApiClient";
import type { HrRecord } from "../shared/types/hr";

type SearchResultKind =
  | "employee"
  | "enterprise"
  | "department"
  | "position"
  | "vacancy"
  | "candidate";

interface GlobalSearchResult {
  id: number;
  kind: SearchResultKind;
  title: string;
  subtitle: string;
  record: HrRecord;
}

const resultMeta: Record<
  SearchResultKind,
  { label: string; icon: IconType }
> = {
  employee: { label: "Сотрудник", icon: FiUsers },
  enterprise: { label: "Предприятие", icon: FiLayers },
  department: { label: "Отдел", icon: FiLayers },
  position: { label: "Должность", icon: FiBriefcase },
  vacancy: { label: "Вакансия", icon: FiBriefcase },
  candidate: { label: "Кандидат", icon: FiClipboard },
};

export function GlobalSearch(): JSX.Element {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length >= 2;
  const visibleResults = useMemo(() => results.slice(0, 18), [results]);

  useEffect(() => {
    function handleOutsidePointer(event: MouseEvent): void {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handleOutsidePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsidePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!hasQuery) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    let isActive = true;
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);

      const settled = await Promise.allSettled([
        hrApiClient.list({
          entity: "employees",
          page: 1,
          pageSize: 5,
          search: trimmedQuery,
          orderBy: "last_name",
        }),
        hrApiClient.list({
          entity: "enterprises",
          page: 1,
          pageSize: 4,
          search: trimmedQuery,
          orderBy: "name",
        }),
        hrApiClient.list({
          entity: "departments",
          page: 1,
          pageSize: 4,
          search: trimmedQuery,
          orderBy: "name",
        }),
        hrApiClient.list({
          entity: "positions",
          page: 1,
          pageSize: 4,
          search: trimmedQuery,
          orderBy: "name",
        }),
        hrApiClient.listVacancies({ search: trimmedQuery }),
        hrApiClient.listCandidates({ search: trimmedQuery }),
      ]);

      if (!isActive) return;

      const nextResults: GlobalSearchResult[] = [];
      const [employees, enterprises, departments, positions, vacancies, candidates] =
        settled;

      if (employees.status === "fulfilled") {
        employees.value.items.forEach((record) => {
          nextResults.push({
            id: Number(record.id),
            kind: "employee",
            title: fullName(record),
            subtitle: joinText(record.phone, record.email),
            record,
          });
        });
      }

      if (enterprises.status === "fulfilled") {
        enterprises.value.items.forEach((record) => {
          nextResults.push({
            id: Number(record.id),
            kind: "enterprise",
            title: String(record.name ?? "Предприятие"),
            subtitle: joinText(record.legal_name, record.phone),
            record,
          });
        });
      }

      if (departments.status === "fulfilled") {
        departments.value.items.forEach((record) => {
          nextResults.push({
            id: Number(record.id),
            kind: "department",
            title: String(record.name ?? "Отдел"),
            subtitle: String(record.enterprise_name ?? "Организационная структура"),
            record,
          });
        });
      }

      if (positions.status === "fulfilled") {
        positions.value.items.forEach((record) => {
          nextResults.push({
            id: Number(record.id),
            kind: "position",
            title: String(record.name ?? "Должность"),
            subtitle: String(record.department_name ?? "Организационная структура"),
            record,
          });
        });
      }

      if (vacancies.status === "fulfilled") {
        vacancies.value.slice(0, 5).forEach((record) => {
          nextResults.push({
            id: Number(record.id),
            kind: "vacancy",
            title: String(record.position_name ?? "Вакансия"),
            subtitle: joinText(record.enterprise_name, record.department_name),
            record,
          });
        });
      }

      if (candidates.status === "fulfilled") {
        candidates.value.slice(0, 5).forEach((record) => {
          nextResults.push({
            id: Number(record.id),
            kind: "candidate",
            title: fullName(record),
            subtitle: joinText(record.position_name, record.email),
            record,
          });
        });
      }

      setResults(nextResults.filter((result) => Number.isFinite(result.id)));
      setIsLoading(false);
      setIsOpen(true);
    }, 240);

    return () => {
      isActive = false;
      window.clearTimeout(timeout);
    };
  }, [hasQuery, trimmedQuery]);

  async function openResult(result: GlobalSearchResult): Promise<void> {
    setIsOpen(false);

    if (result.kind === "employee") {
      navigate(`/employees/${result.id}`);
      return;
    }

    if (result.kind === "enterprise") {
      navigate(`/enterprises/${result.id}/departments`);
      return;
    }

    if (result.kind === "department") {
      const enterpriseId = Number(result.record.enterprise_id);
      navigate(
        Number.isFinite(enterpriseId)
          ? `/enterprises/${enterpriseId}/departments/${result.id}/positions`
          : "/enterprises",
      );
      return;
    }

    if (result.kind === "position") {
      const departmentId = Number(result.record.department_id);
      if (Number.isFinite(departmentId)) {
        const department = await hrApiClient.getById({
          entity: "departments",
          id: departmentId,
        });
        const enterpriseId = Number(department?.enterprise_id);
        if (Number.isFinite(enterpriseId)) {
          navigate(
            `/enterprises/${enterpriseId}/departments/${departmentId}/positions`,
          );
          return;
        }
      }
      navigate("/enterprises");
      return;
    }

    if (result.kind === "vacancy") {
      navigate(`/vacancies/${result.id}/edit`);
      return;
    }

    navigate(`/candidates?candidate=${result.id}`);
  }

  function clearSearch(): void {
    setQuery("");
    setResults([]);
    setIsOpen(false);
  }

  return (
    <div className="relative min-w-0 flex-1" ref={containerRef}>
      <div className="relative max-w-2xl">
        <FiSearch className="app-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
        <input
          aria-label="Глобальный поиск"
          className="app-input app-placeholder h-11 w-full rounded-2xl border pl-11 pr-11 text-sm font-semibold outline-none transition"
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => hasQuery && setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && visibleResults[0]) {
              event.preventDefault();
              void openResult(visibleResults[0]);
            }
          }}
          placeholder="Поиск сотрудников, структуры, вакансий и кандидатов"
          value={query}
        />
        {query && (
          <button
            aria-label="Очистить поиск"
            className="app-muted absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
            onClick={clearSearch}
            type="button"
          >
            <FiX className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && hasQuery && (
        <div className="app-surface app-border absolute left-0 top-[calc(100%+10px)] z-50 max-h-[min(560px,70vh)] w-full max-w-2xl overflow-y-auto rounded-[24px] border p-2 shadow-2xl">
          {isLoading ? (
            <div className="app-muted px-4 py-8 text-center text-sm font-semibold">
              Поиск...
            </div>
          ) : visibleResults.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <FiSearch className="app-muted mx-auto h-5 w-5" />
              <p className="app-text mt-3 text-sm font-black">Ничего не найдено</p>
              <p className="app-muted mt-1 text-xs">Попробуйте изменить запрос</p>
            </div>
          ) : (
            <div className="grid gap-1">
              {visibleResults.map((result) => {
                const meta = resultMeta[result.kind];
                const Icon = meta.icon;
                return (
                  <button
                    className="app-hover-muted flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition"
                    key={`${result.kind}-${result.id}`}
                    onClick={() => void openResult(result)}
                    type="button"
                  >
                    <span className="app-accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="app-text block truncate text-sm font-black">
                        {result.title}
                      </span>
                      <span className="app-muted mt-0.5 block truncate text-xs font-semibold">
                        {meta.label}{result.subtitle ? ` · ${result.subtitle}` : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fullName(record: HrRecord): string {
  return [record.last_name, record.first_name, record.middle_name]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ") || "Без имени";
}

function joinText(...values: unknown[]): string {
  return values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}
