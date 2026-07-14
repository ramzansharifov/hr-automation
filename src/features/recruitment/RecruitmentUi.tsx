import type { ReactNode } from "react";
import { FiPlus, FiSearch } from "react-icons/fi";

import { Button, Input } from "../../shared/ui";

export function RecruitmentPageHeader({
  actionLabel,
  icon,
  onAction,
  title,
}: {
  actionLabel: string;
  description: string;
  icon: ReactNode;
  onAction: () => void;
  title: string;
}): JSX.Element {
  return (
    <section className="app-accent-gradient-panel flex flex-col gap-5 overflow-hidden rounded-[28px] border p-6 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-lg backdrop-blur">
          {icon}
        </span>
        <h1 className="truncate text-3xl font-black tracking-tight text-white sm:text-4xl">
          {title}
        </h1>
      </div>
      <Button
        className="w-full shrink-0 border-white/20 shadow-xl hover:opacity-90 lg:w-auto"
        leftIcon={<FiPlus className="h-4 w-4" />}
        onClick={onAction}
        style={{ background: "#ffffff", color: "#0f172a" }}
        variant="ghost"
      >
        {actionLabel}
      </Button>
    </section>
  );
}

export function RecruitmentSearch({
  onChange,
  placeholder,
  value,
}: {
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}): JSX.Element {
  return (
    <div className="app-surface app-border relative rounded-2xl border p-2 shadow-none">
      <FiSearch className="app-muted pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2" />
      <Input
        className="border-transparent bg-transparent pl-11 shadow-none"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </div>
  );
}

export function RecruitmentBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "accent" | "neutral" | "success" | "warning";
}): JSX.Element {
  const tones = {
    accent:
      "border-[color-mix(in_srgb,var(--accent-border)_36%,var(--color-border))] bg-[color-mix(in_srgb,var(--accent)_12%,var(--color-surface))] text-[var(--color-text)]",
    neutral: "app-surface-muted app-border app-text-soft",
    success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-500",
    warning: "border-amber-500/25 bg-amber-500/10 text-amber-500",
  };

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-3 text-xs font-black ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function FormField({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}): JSX.Element {
  return (
    <label className="grid gap-2">
      <span className="app-text text-sm font-bold">{label}</span>
      {children}
    </label>
  );
}

export function MatchBar({ value }: { value: number }): JSX.Element {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className="min-w-[150px]">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="app-text-soft text-xs font-bold">Соответствие</span>
        <span className="app-text text-sm font-black">{safeValue}%</span>
      </div>
      <div className="app-surface-muted h-2 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--accent-border)] to-[var(--accent-hover)] transition-[width]"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}
