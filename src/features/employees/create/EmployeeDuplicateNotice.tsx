import { FiAlertTriangle, FiShield } from "react-icons/fi";

import type {
  EmployeeDuplicateCheckResult,
  EmployeeDuplicateMatch,
} from "../../../shared/types/hr";
import { ActionButton } from "../../../shared/ui";

interface EmployeeDuplicateNoticeProps {
  onContinue?: () => void;
  result: EmployeeDuplicateCheckResult;
}

export function EmployeeDuplicateNotice({
  onContinue,
  result,
}: EmployeeDuplicateNoticeProps): JSX.Element | null {
  if (result.matches.length === 0) return null;

  const blocking = result.hasBlockingMatches;

  return (
    <section
      className={[
        "mb-5 rounded-lg border p-4",
        blocking
          ? "border-rose-500/30 bg-rose-500/8"
          : "border-amber-500/30 bg-amber-500/8",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <span
          className={[
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
            blocking
              ? "border-rose-500/25 bg-rose-500/10 text-rose-500"
              : "border-amber-500/25 bg-amber-500/10 text-amber-600",
          ].join(" ")}
        >
          {blocking ? <FiShield /> : <FiAlertTriangle />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="app-text font-extrabold">
            {blocking
              ? "Найден дубликат сотрудника"
              : "Найдены возможные совпадения"}
          </p>
          <p className="app-text-soft mt-1 text-sm">
            {blocking
              ? "Переход дальше заблокирован. Исправьте отмеченные данные — ниже указано, с какой существующей карточкой они совпадают."
              : "Это не обязательно дубликат, но перед продолжением проверьте совпадающие данные."}
          </p>

          <div className="mt-4 space-y-3">
            {result.matches.map((match) => (
              <DuplicateMatchCard key={match.employeeId} match={match} />
            ))}
          </div>

          {!blocking && onContinue && (
            <div className="mt-4 flex justify-end">
              <ActionButton action="next" onClick={onContinue} size="sm">
                Продолжить несмотря на совпадения
              </ActionButton>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function DuplicateMatchCard({
  match,
}: {
  match: EmployeeDuplicateMatch;
}): JSX.Element {
  const location = [match.enterpriseName, match.departmentName]
    .filter(Boolean)
    .join(" → ");

  return (
    <article className="app-surface app-border rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="app-text font-bold">{match.employeeName}</p>
          <p className="app-muted mt-1 text-xs">
            Карточка #{match.employeeId}
            {match.employeeNumber
              ? ` · табельный № ${match.employeeNumber}`
              : ""}
            {location ? ` · ${location}` : ""}
          </p>
        </div>
        <span
          className={[
            "rounded-full border px-2.5 py-1 text-[11px] font-bold",
            match.blocking
              ? "border-rose-500/25 bg-rose-500/10 text-rose-600"
              : "border-amber-500/25 bg-amber-500/10 text-amber-600",
          ].join(" ")}
        >
          {match.blocking
            ? match.lifecycleStatus === "terminated"
              ? "Ранее уволен"
              : "Дубликат"
            : "Проверить"}
        </span>
      </div>

      {match.blocking && match.lifecycleStatus === "terminated" && (
        <p className="mt-3 text-sm font-semibold text-amber-700 dark:text-amber-300">
          Не создавайте новую карточку: откройте существующего сотрудника и используйте действие «Принять повторно».
        </p>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {match.fields.map((field) => (
          <div
            className={[
              "rounded-md border px-3 py-2",
              field.blocking
                ? "border-rose-500/20 bg-rose-500/6"
                : "app-border app-surface-muted",
            ].join(" ")}
            key={`${field.field}:${field.value}`}
          >
            <p className="app-muted text-[11px] font-bold uppercase tracking-wide">
              Совпадает: {field.label}
            </p>
            <p className="app-text mt-1 break-words text-sm font-semibold">
              {field.value || "—"}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}
