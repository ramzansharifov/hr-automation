import { appText } from "../../shared/i18n";
import type { CandidateStatus } from "../../shared/types/hr";

export const activeCandidateStages = [
  "new",
  "screening",
  "interview",
  "offer",
] as const satisfies readonly CandidateStatus[];

export const candidateStatusMeta: Record<
  CandidateStatus,
  {
    label: string;
    labelEn: string;
    description: string;
    descriptionEn: string;
    tone: "accent" | "neutral" | "success" | "warning";
  }
> = {
  new: {
    label: "Новый",
    labelEn: "New",
    description: "Кандидат зарегистрирован и ожидает первичной обработки.",
    descriptionEn: "The candidate is registered and awaiting initial review.",
    tone: "accent",
  },
  screening: {
    label: "Первичный отбор",
    labelEn: "Screening",
    description: "Резюме и базовые требования проверены, кандидат проходит первичный отбор.",
    descriptionEn: "The resume and basic requirements have been reviewed; the candidate is in screening.",
    tone: "accent",
  },
  interview: {
    label: "Собеседование",
    labelEn: "Interview",
    description: "Кандидат допущен к интервью и профессиональной оценке.",
    descriptionEn: "The candidate has advanced to interview and professional assessment.",
    tone: "accent",
  },
  offer: {
    label: "Оффер",
    labelEn: "Offer",
    description: "Кандидату одобрено предложение о работе. Следующее действие — приём или отказ.",
    descriptionEn: "A job offer has been approved. The next action is hire or reject.",
    tone: "warning",
  },
  hired: {
    label: "Принят на работу",
    labelEn: "Hired",
    description: "Подбор завершён: кандидат зарегистрирован как сотрудник.",
    descriptionEn: "Recruitment is complete: the candidate has been registered as an employee.",
    tone: "success",
  },
  rejected: {
    label: "Отклонён",
    labelEn: "Rejected",
    description: "Подбор для этого кандидата завершён отказом.",
    descriptionEn: "Recruitment for this candidate has ended with rejection.",
    tone: "neutral",
  },
};

export function candidateStatus(value: unknown): CandidateStatus {
  const normalized = String(value ?? "new") as CandidateStatus;
  return normalized in candidateStatusMeta ? normalized : "new";
}

export function candidateStatusLabel(value: unknown): string {
  const meta = candidateStatusMeta[candidateStatus(value)];
  return appText(meta.label, meta.labelEn);
}

export function candidateStatusDescription(value: unknown): string {
  const meta = candidateStatusMeta[candidateStatus(value)];
  return appText(meta.description, meta.descriptionEn);
}

export function candidateStatusTone(
  value: unknown,
): "accent" | "neutral" | "success" | "warning" {
  return candidateStatusMeta[candidateStatus(value)].tone;
}

export function nextCandidateStage(
  value: unknown,
): (typeof activeCandidateStages)[number] | null {
  const status = candidateStatus(value);
  const index = activeCandidateStages.indexOf(
    status as (typeof activeCandidateStages)[number],
  );
  if (index < 0 || index >= activeCandidateStages.length - 1) return null;
  return activeCandidateStages[index + 1];
}

export function isTerminalCandidateStatus(value: unknown): boolean {
  const status = candidateStatus(value);
  return status === "hired" || status === "rejected";
}

export function isActiveCandidateStatus(value: unknown): boolean {
  return activeCandidateStages.includes(
    candidateStatus(value) as (typeof activeCandidateStages)[number],
  );
}
