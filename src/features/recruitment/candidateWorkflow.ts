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
    description: string;
    tone: "accent" | "neutral" | "success" | "warning";
  }
> = {
  new: {
    label: "Новый",
    description: "Кандидат зарегистрирован и ожидает первичной обработки.",
    tone: "accent",
  },
  screening: {
    label: "Первичный отбор",
    description: "Резюме и базовые требования проверены, кандидат проходит первичный отбор.",
    tone: "accent",
  },
  interview: {
    label: "Собеседование",
    description: "Кандидат допущен к интервью и профессиональной оценке.",
    tone: "accent",
  },
  offer: {
    label: "Оффер",
    description: "Кандидату одобрено предложение о работе. Следующее действие — приём или отказ.",
    tone: "warning",
  },
  hired: {
    label: "Принят на работу",
    description: "Подбор завершён: кандидат зарегистрирован как сотрудник.",
    tone: "success",
  },
  rejected: {
    label: "Отклонён",
    description: "Подбор для этого кандидата завершён отказом.",
    tone: "neutral",
  },
};

export function candidateStatus(value: unknown): CandidateStatus {
  const normalized = String(value ?? "new") as CandidateStatus;
  return normalized in candidateStatusMeta ? normalized : "new";
}

export function candidateStatusLabel(value: unknown): string {
  return candidateStatusMeta[candidateStatus(value)].label;
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
