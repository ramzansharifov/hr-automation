import type { KeyboardEvent, MouseEvent } from "react";
import {
  FiArrowUpRight,
  FiAward,
  FiBriefcase,
  FiEdit2,
  FiMail,
  FiPhone,
  FiTrash2,
} from "react-icons/fi";

import type { HrRecord } from "../../shared/types/hr";
import { Button, IconButton } from "../../shared/ui";
import { RecruitmentBadge } from "./RecruitmentUi";

interface CandidateSummaryCardProps {
  canManage?: boolean;
  candidate: HrRecord;
  isBest?: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
  onOpen: () => void;
  rank?: number;
  showStructure?: boolean;
}

interface SkillSummary {
  name: string;
  required: number | null;
  score: number | null;
  raw: string;
}

export function CandidateSummaryCard({
  canManage = false,
  candidate,
  isBest = false,
  onDelete,
  onEdit,
  onOpen,
  rank,
  showStructure = true,
}: CandidateSummaryCardProps): JSX.Element {
  const name = candidateFullName(candidate);
  const match = clampPercentage(Number(candidate.match_percentage ?? 0));
  const skills = parseSkills(candidate.skills_summary);
  const structure = [
    candidate.enterprise_name,
    candidate.department_name,
    candidate.position_name,
  ]
    .filter(Boolean)
    .join(" · ");

  const status = String(candidate.status ?? "new");
  const statusTone = candidateStatusTone(status);
  const source = String(candidate.source ?? "").trim();
  const initials = candidateInitials(candidate);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  }

  function stop(event: MouseEvent<HTMLElement>): void {
    event.stopPropagation();
  }

  return (
    <article
      className="app-surface app-border group relative cursor-pointer overflow-hidden rounded-[28px] border p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--accent-border)] hover:shadow-lg sm:p-6"
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-[var(--accent)] opacity-80" />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-start">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            <div className="app-accent-soft app-accent-text flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-black shadow-sm">
              {initials}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {rank !== undefined && (
                  <span className="app-surface-muted app-border app-text-soft inline-flex min-h-7 items-center rounded-full border px-3 text-xs font-black">
                    #{rank}
                  </span>
                )}
                <RecruitmentBadge tone={statusTone}>
                  {candidateStatusLabel(status)}
                </RecruitmentBadge>
                {source && <RecruitmentBadge>{source}</RecruitmentBadge>}
                {isBest && (
                  <RecruitmentBadge tone="success">
                    <span className="inline-flex items-center gap-1.5">
                      <FiAward className="h-3.5 w-3.5" />
                      Лучший кандидат
                    </span>
                  </RecruitmentBadge>
                )}
              </div>

              <h2 className="app-text mt-3 truncate text-xl font-black tracking-tight sm:text-2xl">
                {name}
              </h2>

              {showStructure && structure && (
                <p className="app-muted mt-2 flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <FiBriefcase className="h-4 w-4 shrink-0" />
                  <span className="truncate">{structure}</span>
                </p>
              )}
            </div>
          </div>

          {(candidate.phone || candidate.email) && (
            <div className="mt-5 flex flex-wrap gap-2.5">
              {candidate.phone && (
                <span className="app-surface-muted app-border app-text-soft inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-sm font-semibold">
                  <FiPhone className="h-4 w-4 shrink-0" />
                  {String(candidate.phone)}
                </span>
              )}
              {candidate.email && (
                <span className="app-surface-muted app-border app-text-soft inline-flex min-h-9 min-w-0 items-center gap-2 rounded-xl border px-3 text-sm font-semibold">
                  <FiMail className="h-4 w-4 shrink-0" />
                  <span className="truncate">{String(candidate.email)}</span>
                </span>
              )}
            </div>
          )}
        </div>

        <div className="app-surface-muted app-border rounded-2xl border p-4 xl:min-h-[132px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="app-muted text-xs font-black uppercase tracking-[0.12em]">
                Соответствие
              </p>
              <p className="app-text mt-1 text-3xl font-black tracking-tight">
                {match}%
              </p>
            </div>
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${matchTone(match)}`}>
              <FiAward className="h-5 w-5" />
            </span>
          </div>
          <div className="app-surface mt-4 h-2.5 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--accent-border)] to-[var(--accent-hover)] transition-[width]"
              style={{ width: `${match}%` }}
            />
          </div>
          <p className="app-muted mt-2 text-xs font-semibold">
            {matchLabel(match)}
          </p>
        </div>
      </div>

      {skills.length > 0 && (
        <div className="app-border-soft mt-5 border-t pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="app-text text-sm font-black">Навыки</p>
              <p className="app-muted mt-0.5 text-xs font-semibold">
                Оценка кандидата относительно требуемого уровня
              </p>
            </div>
            <span className="app-muted text-xs font-bold">
              Оценено: {skills.length}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {skills.slice(0, 6).map((skill) => (
              <SkillChip key={skill.raw} skill={skill} />
            ))}
            {skills.length > 6 && (
              <span className="app-surface-muted app-border app-text-soft inline-flex min-h-8 items-center rounded-xl border px-3 text-xs font-black">
                +{skills.length - 6} ещё
              </span>
            )}
          </div>
        </div>
      )}

      <div
        className="app-border-soft mt-5 flex flex-wrap items-center justify-end gap-2 border-t pt-4"
        onClick={stop}
      >
        <Button
          leftIcon={<FiArrowUpRight className="h-4 w-4" />}
          onClick={onOpen}
          type="button"
          variant="secondary"
        >
          Открыть
        </Button>
        {canManage && onEdit && (
          <IconButton
            icon={<FiEdit2 />}
            label="Редактировать кандидата"
            onClick={onEdit}
          />
        )}
        {canManage && onDelete && !candidate.employee_id && (
          <IconButton
            icon={<FiTrash2 />}
            label="Удалить кандидата"
            onClick={onDelete}
            tone="danger"
          />
        )}
      </div>
    </article>
  );
}

function SkillChip({ skill }: { skill: SkillSummary }): JSX.Element {
  const tone = skillTone(skill);
  return (
    <span className={`inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-xs font-black ${tone}`}>
      <span>{skill.name}</span>
      {skill.score !== null && skill.required !== null ? (
        <span className="opacity-80">
          {skill.score}/10 · треб. {skill.required}
        </span>
      ) : (
        <span className="opacity-80">{skill.raw}</span>
      )}
    </span>
  );
}

function parseSkills(value: unknown): SkillSummary[] {
  return String(value ?? "")
    .split(String.fromCharCode(31))
    .map((item) => item.trim())
    .filter(Boolean)
    .map((raw) => {
      const match = raw.match(/^(.+?):\s*(\d+)\/10\s*\(треб\.\s*(\d+)\)$/i);
      if (!match) {
        return { name: raw, required: null, score: null, raw };
      }
      return {
        name: match[1].trim(),
        score: Number(match[2]),
        required: Number(match[3]),
        raw,
      };
    });
}

function skillTone(skill: SkillSummary): string {
  if (skill.score === null || skill.required === null) {
    return "app-surface-muted app-border app-text-soft";
  }
  if (skill.score >= skill.required) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
  if (skill.score >= Math.max(skill.required - 2, 0)) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }
  return "border-rose-500/20 bg-rose-500/8 text-rose-600 dark:text-rose-400";
}

function candidateFullName(candidate: HrRecord): string {
  return [candidate.last_name, candidate.first_name, candidate.middle_name]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ") || "Без имени";
}

function candidateInitials(candidate: HrRecord): string {
  const parts = [candidate.first_name, candidate.last_name]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  return parts.length > 0
    ? parts.map((part) => part[0]?.toUpperCase()).join("").slice(0, 2)
    : "К";
}

function candidateStatusLabel(value: string): string {
  const labels: Record<string, string> = {
    new: "Новый",
    screening: "Первичный отбор",
    interview: "Собеседование",
    offer: "Оффер",
    hired: "Принят",
    rejected: "Отклонён",
  };
  return labels[value] ?? value;
}

function candidateStatusTone(value: string): "accent" | "neutral" | "success" | "warning" {
  if (value === "hired") return "success";
  if (value === "offer") return "warning";
  if (value === "new" || value === "interview") return "accent";
  return "neutral";
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function matchTone(value: number): string {
  if (value >= 80) return "bg-emerald-500/10 text-emerald-500";
  if (value >= 60) return "app-accent-soft app-accent-text";
  if (value >= 40) return "bg-amber-500/10 text-amber-500";
  return "bg-rose-500/10 text-rose-500";
}

function matchLabel(value: number): string {
  if (value >= 90) return "Отличное соответствие требованиям";
  if (value >= 75) return "Высокое соответствие";
  if (value >= 55) return "Есть небольшие пробелы";
  if (value >= 35) return "Требуется дополнительная оценка";
  return "Есть существенные пробелы";
}
