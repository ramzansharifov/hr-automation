import type { ReactNode } from "react";
import type { TFunction } from "i18next";
import {
  FiAward,
  FiBookOpen,
  FiBriefcase,
  FiCalendar,
  FiEdit2,
  FiFileText,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";

import type { HrRecord } from "../../../shared/types/hr";
import { Button, EmptyState, LoadingState } from "../../../shared/ui";
import {
  formatRelatedDate,
  getEducationDegreeLabel,
  getEducationTypeLabel,
  getString,
  valueOrEmpty,
} from "./model";

interface RelatedRecordsHeaderProps {
  actionLabel: string;
  description: string;
  icon: ReactNode;
  onAction: () => void;
  recordCount: number;
  title: string;
}

export function RelatedRecordsHeader({
  actionLabel,
  description,
  icon,
  onAction,
  recordCount,
  title,
}: RelatedRecordsHeaderProps): JSX.Element {
  return (
    <header className="app-surface-muted app-border relative overflow-hidden rounded-[24px] border p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-[var(--accent-soft)] opacity-70" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="app-accent-soft flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--accent-border)]">
            {icon}
          </span>
          <div className="min-w-0 pt-0.5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="app-text text-2xl font-black tracking-tight">
                {title}
              </h2>
              <span className="app-surface app-muted inline-flex h-7 min-w-7 items-center justify-center rounded-full border px-2.5 text-xs font-black">
                {recordCount}
              </span>
            </div>
            <p className="app-muted mt-1.5 max-w-2xl text-sm leading-6">
              {description}
            </p>
          </div>
        </div>
        <Button
          className="w-full shrink-0 sm:w-auto"
          leftIcon={<FiPlus className="h-4 w-4" />}
          onClick={onAction}
          type="button"
          variant="primary"
        >
          {actionLabel}
        </Button>
      </div>
    </header>
  );
}

interface RecordsListProps {
  emptyTitle: string;
  isLoading: boolean;
  loadingLabel: string;
  records: HrRecord[];
  renderRecord: (record: HrRecord) => JSX.Element;
}

export function RelatedRecordsList({
  emptyTitle,
  isLoading,
  loadingLabel,
  records,
  renderRecord,
}: RecordsListProps): JSX.Element {
  if (isLoading) {
    return (
      <div className="app-surface-muted app-border min-h-[280px] rounded-[24px] border border-dashed">
        <LoadingState label={loadingLabel} />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="app-surface-muted app-border min-h-[280px] rounded-[24px] border border-dashed">
        <EmptyState title={emptyTitle} />
      </div>
    );
  }

  return (
    <div className="relative space-y-4 before:absolute before:bottom-8 before:left-[27px] before:top-8 before:w-px before:bg-[var(--color-border)] sm:before:left-[31px]">
      {records.map((record, index) => (
        <div
          className="relative pl-[68px] sm:pl-[78px]"
          key={String(record.id ?? index)}
        >
          <span className="app-surface app-accent-text absolute left-3 top-7 z-10 flex h-8 w-8 items-center justify-center rounded-full border-4 border-[var(--color-page)] text-[10px] font-black sm:left-[15px]">
            {index + 1}
          </span>
          {renderRecord(record)}
        </div>
      ))}
    </div>
  );
}

interface RecordCardProps {
  locale: string;
  onDelete: () => void;
  onEdit: () => void;
  record: HrRecord;
  t: TFunction;
}

export function EducationRecordCard({
  locale,
  onDelete,
  onEdit,
  record,
  t,
}: RecordCardProps): JSX.Element {
  const educationType = getString(record.education_type);
  const speciality = getString(record.speciality);

  return (
    <RecordShell>
      <RecordCardHeader
        badges={
          <>
            <SoftBadge>{getEducationTypeLabel(educationType, t)}</SoftBadge>
            {educationType === "university" && (
              <SoftBadge>
                {getEducationDegreeLabel(getString(record.education_degree), t)}
              </SoftBadge>
            )}
          </>
        }
        deleteLabel={t("common.actions.delete")}
        editLabel={t("common.actions.edit")}
        icon={<FiBookOpen className="h-5 w-5" />}
        onDelete={onDelete}
        onEdit={onEdit}
        title={valueOrEmpty(getString(record.institution_name), t)}
      />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {speciality && (
          <MetaItem
            icon={<FiAward />}
            label={t("forms.fields.speciality")}
            value={speciality}
          />
        )}
        <MetaItem
          icon={<FiCalendar />}
          label={t("forms.fields.startedAt")}
          value={formatRelatedDate(record.started_at, locale, t)}
        />
        <MetaItem
          icon={<FiCalendar />}
          label={t("forms.fields.endedAt")}
          value={formatRelatedDate(record.ended_at, locale, t)}
        />
        <MetaItem
          icon={<FiFileText />}
          label={t("forms.fields.documentNumber")}
          value={valueOrEmpty(getString(record.document_number), t)}
        />
      </div>
      <RecordNote>{getString(record.note)}</RecordNote>
    </RecordShell>
  );
}

export function ExperienceRecordCard({
  locale,
  onDelete,
  onEdit,
  record,
  t,
}: RecordCardProps): JSX.Element {
  const isCurrent = Number(record.is_current ?? 0) === 1;
  const responsibilities = getString(record.responsibilities);

  return (
    <RecordShell>
      <RecordCardHeader
        badges={
          isCurrent ? (
            <SoftBadge tone="accent">
              {t("employeesDetails.experience.current")}
            </SoftBadge>
          ) : null
        }
        deleteLabel={t("common.actions.delete")}
        editLabel={t("common.actions.edit")}
        icon={<FiBriefcase className="h-5 w-5" />}
        onDelete={onDelete}
        onEdit={onEdit}
        title={valueOrEmpty(getString(record.company_name), t)}
      />
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MetaItem
          icon={<FiBriefcase />}
          label={t("forms.fields.experiencePositionName")}
          value={valueOrEmpty(getString(record.position_name), t)}
        />
        <MetaItem
          icon={<FiCalendar />}
          label={t("forms.fields.startedAt")}
          value={formatRelatedDate(record.started_at, locale, t)}
        />
        <MetaItem
          icon={<FiCalendar />}
          label={t("forms.fields.endedAt")}
          value={
            isCurrent
              ? t("employeesDetails.experience.current")
              : formatRelatedDate(record.ended_at, locale, t)
          }
        />
      </div>
      {responsibilities && (
        <div className="app-surface-muted app-border mt-4 rounded-2xl border p-4">
          <p className="app-muted text-xs font-black uppercase tracking-[0.12em]">
            {t("forms.fields.responsibilities")}
          </p>
          <p className="app-text mt-2 whitespace-pre-line text-sm font-medium leading-6">
            {responsibilities}
          </p>
        </div>
      )}
      <RecordNote>{getString(record.note)}</RecordNote>
    </RecordShell>
  );
}

function RecordShell({ children }: { children: ReactNode }): JSX.Element {
  return (
    <article className="app-surface app-border group relative overflow-hidden rounded-[24px] border p-5 transition-colors hover:border-[var(--accent-border)] sm:p-6">
      <div className="absolute inset-y-0 left-0 w-1 bg-[var(--accent)]" />
      {children}
    </article>
  );
}

interface RecordCardHeaderProps {
  badges: ReactNode;
  deleteLabel: string;
  editLabel: string;
  icon: ReactNode;
  onDelete: () => void;
  onEdit: () => void;
  title: string;
}

function RecordCardHeader({
  badges,
  deleteLabel,
  editLabel,
  icon,
  onDelete,
  onEdit,
  title,
}: RecordCardHeaderProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3.5">
        <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
          {icon}
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="app-text break-words text-lg font-black leading-snug">
            {title}
          </h3>
          {badges && <div className="mt-2 flex flex-wrap gap-2">{badges}</div>}
        </div>
      </div>
      <div className="flex shrink-0 gap-2 self-end sm:self-auto">
        <Button
          aria-label={editLabel}
          className="app-table-action-button app-table-action-button--edit h-10 w-10 rounded-xl border p-0"
          onClick={onEdit}
          type="button"
          variant="ghost"
        >
          <FiEdit2 className="h-4 w-4" />
        </Button>
        <Button
          aria-label={deleteLabel}
          className="app-table-action-button app-table-action-button--delete h-10 w-10 rounded-xl border p-0"
          onClick={onDelete}
          type="button"
          variant="ghost"
        >
          <FiTrash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function SoftBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "accent" | "neutral";
}): JSX.Element {
  return (
    <span
      className={[
        "inline-flex min-h-7 items-center rounded-full border px-3 text-xs font-black",
        tone === "accent"
          ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-soft-text)]"
          : "app-surface-muted app-muted app-border",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="app-surface-muted app-border min-w-0 rounded-2xl border p-4">
      <div className="app-muted flex items-center gap-2">
        <span className="app-accent-text [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        <p className="truncate text-[11px] font-black uppercase tracking-[0.1em]">
          {label}
        </p>
      </div>
      <p className="app-text mt-2 break-words text-sm font-black leading-5">
        {value}
      </p>
    </div>
  );
}

function RecordNote({ children }: { children: string }): JSX.Element | null {
  if (!children) return null;

  return (
    <div className="app-border-soft app-muted mt-4 whitespace-pre-line border-t pt-4 text-sm leading-6">
      {children}
    </div>
  );
}
