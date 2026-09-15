import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import { EmployeeDuplicateNotice } from "../employees/create/EmployeeDuplicateNotice";
import { FormField } from "./RecruitmentUi";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  EmployeeDuplicateCheckResult,
  HireCandidateParams,
  HrRecord,
} from "../../shared/types/hr";
import {
  ActionButton,
  Dialog,
  Input,
  Select,
  type SelectOption,
} from "../../shared/ui";

interface CandidateHireDialogProps {
  candidate: HrRecord;
  onHired: (employee: HrRecord) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

interface HireFormState {
  hireDate: string;
  salary: string;
  employeeNumber: string;
  birthDate: string;
  gender: string;
  phone: string;
  email: string;
  addressCountry: string;
  addressCity: string;
  addressStreet: string;
  addressHouse: string;
  addressApartment: string;
  contractNumber: string;
  contractDate: string;
  contractEndDate: string;
  probationEndDate: string;
  workplace: string;
}

const genderOptions: SelectOption[] = [
  { value: "male", label: "Мужской" },
  { value: "female", label: "Женский" },
];

function emptyHireForm(): HireFormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    hireDate: today,
    salary: "0",
    employeeNumber: "",
    birthDate: "",
    gender: "",
    phone: "",
    email: "",
    addressCountry: "",
    addressCity: "",
    addressStreet: "",
    addressHouse: "",
    addressApartment: "",
    contractNumber: "",
    contractDate: today,
    contractEndDate: "",
    probationEndDate: "",
    workplace: "",
  };
}

export function CandidateHireDialog({
  candidate,
  onHired,
  onOpenChange,
  open,
}: CandidateHireDialogProps): JSX.Element {
  const [form, setForm] = useState<HireFormState>(emptyHireForm);
  const [isSaving, setIsSaving] = useState(false);
  const [duplicateState, setDuplicateState] = useState<{
    signature: string;
    result: EmployeeDuplicateCheckResult;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(emptyHireForm());
    setDuplicateState(null);
  }, [candidate.id, open]);

  const missing = useMemo(
    () => ({
      birthDate: !hasText(candidate.birth_date),
      gender: !hasText(candidate.gender),
      phone: !hasText(candidate.phone),
      email: !hasText(candidate.email),
      addressCountry: !hasText(candidate.address_country) && !hasText(candidate.address),
      addressCity: !hasText(candidate.address_city) && !hasText(candidate.address),
      addressStreet: !hasText(candidate.address_street) && !hasText(candidate.address),
      addressHouse: !hasText(candidate.address_house) && !hasText(candidate.address),
      addressApartment:
        !hasText(candidate.address_apartment) && !hasText(candidate.address),
    }),
    [candidate],
  );

  const combined = {
    birthDate: text(candidate.birth_date) || form.birthDate,
    gender: text(candidate.gender) || form.gender,
    phone: text(candidate.phone) || form.phone,
    email: text(candidate.email) || form.email,
    addressCountry: text(candidate.address_country) || form.addressCountry,
    addressCity: text(candidate.address_city) || form.addressCity,
    addressStreet: text(candidate.address_street) || form.addressStreet,
    addressHouse: text(candidate.address_house) || form.addressHouse,
    addressApartment:
      text(candidate.address_apartment) || form.addressApartment,
  };

  const duplicateParams = {
    enterpriseId: positiveNumber(candidate.enterprise_id),
    employeeNumber: form.employeeNumber,
    lastName: text(candidate.last_name),
    firstName: text(candidate.first_name),
    middleName: text(candidate.middle_name),
    birthDate: combined.birthDate,
    phone: combined.phone,
    email: combined.email,
    contractNumber: form.contractNumber,
  };
  const duplicateSignature = JSON.stringify(duplicateParams);
  const visibleDuplicateResult =
    duplicateState?.signature === duplicateSignature
      ? duplicateState.result
      : null;

  async function submit(allowWarnings: boolean): Promise<void> {
    if (!form.hireDate) {
      toast.error("Укажите дату выхода на работу");
      return;
    }
    const salary = Number(form.salary);
    if (!Number.isFinite(salary) || salary < 0) {
      toast.error("Укажите корректный оклад");
      return;
    }

    setIsSaving(true);
    try {
      const duplicateResult =
        await hrApiClient.checkEmployeeDuplicates(duplicateParams);
      setDuplicateState({
        signature: duplicateSignature,
        result: duplicateResult,
      });

      if (duplicateResult.hasBlockingMatches) {
        toast.error(
          "Такой сотрудник уже есть в системе. Используйте существующую карточку.",
        );
        return;
      }
      if (duplicateResult.matches.length > 0 && !allowWarnings) {
        toast.warning(
          "Найдены возможные совпадения. Проверьте их перед приёмом.",
        );
        return;
      }

      const params: HireCandidateParams = {
        candidateId: Number(candidate.id),
        hireDate: form.hireDate,
        salary,
        employeeNumber: optional(form.employeeNumber),
        birthDate: missing.birthDate ? optional(form.birthDate) : undefined,
        gender: missing.gender ? optional(form.gender) : undefined,
        phone: missing.phone ? optional(form.phone) : undefined,
        email: missing.email ? optional(form.email) : undefined,
        addressCountry: missing.addressCountry
          ? optional(form.addressCountry)
          : undefined,
        addressCity: missing.addressCity ? optional(form.addressCity) : undefined,
        addressStreet: missing.addressStreet
          ? optional(form.addressStreet)
          : undefined,
        addressHouse: missing.addressHouse
          ? optional(form.addressHouse)
          : undefined,
        addressApartment: missing.addressApartment
          ? optional(form.addressApartment)
          : undefined,
        contractNumber: optional(form.contractNumber),
        contractDate: optional(form.contractDate),
        contractEndDate: optional(form.contractEndDate),
        probationEndDate: optional(form.probationEndDate),
        workplace: optional(form.workplace),
      };
      const employee = await hrApiClient.hireCandidate(params);
      toast.success("Кандидат принят на работу и зарегистрирован как сотрудник");
      onOpenChange(false);
      onHired(employee);
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось принять кандидата на работу"));
    } finally {
      setIsSaving(false);
    }
  }

  const missingPersonalCount = Object.values(missing).filter(Boolean).length;

  return (
    <Dialog
      description="Из карточки кандидата уже перенесены все известные данные. Ниже показаны только недостающие личные данные и кадровые реквизиты нового сотрудника."
      onOpenChange={onOpenChange}
      open={open}
      size="lg"
      title="Принять кандидата на работу"
    >
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(false);
        }}
      >
        {visibleDuplicateResult && (
          <EmployeeDuplicateNotice
            onContinue={
              visibleDuplicateResult.hasBlockingMatches
                ? undefined
                : () => void submit(true)
            }
            result={visibleDuplicateResult}
          />
        )}

        <section className="app-surface-muted app-border rounded-2xl border p-4">
          <p className="app-text text-sm font-black">Уже известно</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <KnownValue label="ФИО" value={fullName(candidate)} />
            <KnownValue
              label="Назначение"
              value={[
                candidate.enterprise_name,
                candidate.department_name,
                candidate.position_name,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
            {candidate.phone && (
              <KnownValue label="Телефон" value={text(candidate.phone)} />
            )}
            {candidate.email && (
              <KnownValue label="Email" value={text(candidate.email)} />
            )}
            {candidate.birth_date && (
              <KnownValue
                label="Дата рождения"
                value={text(candidate.birth_date)}
              />
            )}
            {candidate.gender && (
              <KnownValue label="Пол" value={genderLabel(candidate.gender)} />
            )}
          </div>
        </section>

        {missingPersonalCount > 0 && (
          <section className="app-surface-muted app-border rounded-2xl border p-4">
            <div>
              <h3 className="app-text font-black">
                Недостающие личные данные
              </h3>
              <p className="app-muted mt-1 text-xs font-semibold">
                Эти поля не заполнены в карточке кандидата. Заполняйте только те,
                которые нужны для кадровой карточки.
              </p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {missing.birthDate && (
                <HireField
                  label="Дата рождения"
                  onChange={(birthDate) =>
                    setForm((current) => ({ ...current, birthDate }))
                  }
                  type="date"
                  value={form.birthDate}
                />
              )}
              {missing.gender && (
                <FormField label="Пол">
                  <Select
                    onValueChange={(gender) =>
                      setForm((current) => ({ ...current, gender }))
                    }
                    options={genderOptions}
                    placeholder="Не указано"
                    value={form.gender}
                  />
                </FormField>
              )}
              {missing.phone && (
                <HireField
                  label="Телефон"
                  onChange={(phone) =>
                    setForm((current) => ({ ...current, phone }))
                  }
                  type="tel"
                  value={form.phone}
                />
              )}
              {missing.email && (
                <HireField
                  label="Email"
                  onChange={(email) =>
                    setForm((current) => ({ ...current, email }))
                  }
                  type="email"
                  value={form.email}
                />
              )}
              {missing.addressCountry && (
                <HireField
                  label="Страна"
                  onChange={(addressCountry) =>
                    setForm((current) => ({ ...current, addressCountry }))
                  }
                  value={form.addressCountry}
                />
              )}
              {missing.addressCity && (
                <HireField
                  label="Город"
                  onChange={(addressCity) =>
                    setForm((current) => ({ ...current, addressCity }))
                  }
                  value={form.addressCity}
                />
              )}
              {missing.addressStreet && (
                <HireField
                  label="Улица"
                  onChange={(addressStreet) =>
                    setForm((current) => ({ ...current, addressStreet }))
                  }
                  value={form.addressStreet}
                />
              )}
              {missing.addressHouse && (
                <HireField
                  label="Дом"
                  onChange={(addressHouse) =>
                    setForm((current) => ({ ...current, addressHouse }))
                  }
                  value={form.addressHouse}
                />
              )}
              {missing.addressApartment && (
                <HireField
                  label="Квартира"
                  onChange={(addressApartment) =>
                    setForm((current) => ({ ...current, addressApartment }))
                  }
                  value={form.addressApartment}
                />
              )}
            </div>
          </section>
        )}

        <section className="app-surface-muted app-border rounded-2xl border p-4">
          <h3 className="app-text font-black">Данные приёма на работу</h3>
          <p className="app-muted mt-1 text-xs font-semibold">
            Предприятие, отдел, должность и тип занятости берутся из вакансии.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <HireField
              label="Дата выхода"
              onChange={(hireDate) =>
                setForm((current) => ({ ...current, hireDate }))
              }
              required
              type="date"
              value={form.hireDate}
            />
            <HireField
              label="Согласованный оклад"
              min="0"
              onChange={(salary) =>
                setForm((current) => ({ ...current, salary }))
              }
              required
              type="number"
              value={form.salary}
            />
            <HireField
              label="Табельный номер"
              onChange={(employeeNumber) =>
                setForm((current) => ({ ...current, employeeNumber }))
              }
              value={form.employeeNumber}
            />
            <HireField
              label="Номер трудового договора"
              onChange={(contractNumber) =>
                setForm((current) => ({ ...current, contractNumber }))
              }
              value={form.contractNumber}
            />
            <HireField
              label="Дата договора"
              onChange={(contractDate) =>
                setForm((current) => ({ ...current, contractDate }))
              }
              type="date"
              value={form.contractDate}
            />
            <HireField
              label="Окончание договора"
              onChange={(contractEndDate) =>
                setForm((current) => ({ ...current, contractEndDate }))
              }
              type="date"
              value={form.contractEndDate}
            />
            <HireField
              label="Окончание испытательного срока"
              onChange={(probationEndDate) =>
                setForm((current) => ({ ...current, probationEndDate }))
              }
              type="date"
              value={form.probationEndDate}
            />
            <HireField
              label="Место работы"
              onChange={(workplace) =>
                setForm((current) => ({ ...current, workplace }))
              }
              value={form.workplace}
            />
          </div>
        </section>

        <div className="flex flex-wrap justify-end gap-3">
          <ActionButton
            action="cancel"
            onClick={() => onOpenChange(false)}
            type="button"
          />
          <ActionButton action="hire" loading={isSaving} type="submit">
            Создать сотрудника
          </ActionButton>
        </div>
      </form>
    </Dialog>
  );
}

function KnownValue({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="app-surface app-border rounded-xl border px-3 py-2.5">
      <p className="app-muted text-[11px] font-bold uppercase tracking-wide">
        {label}
      </p>
      <p className="app-text mt-1 text-sm font-semibold">{value || "—"}</p>
    </div>
  );
}

function HireField({
  label,
  min,
  onChange,
  required,
  type = "text",
  value,
}: {
  label: string;
  min?: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}): JSX.Element {
  return (
    <FormField label={label}>
      <Input
        min={min}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </FormField>
  );
}

function fullName(candidate: HrRecord): string {
  return [candidate.last_name, candidate.first_name, candidate.middle_name]
    .map(text)
    .filter(Boolean)
    .join(" ");
}

function genderLabel(value: unknown): string {
  if (value === "male") return "Мужской";
  if (value === "female") return "Женский";
  return text(value);
}

function hasText(value: unknown): boolean {
  return text(value).length > 0;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function optional(value: string): string | undefined {
  const normalized = value.trim();
  return normalized || undefined;
}

function positiveNumber(value: unknown): number | null {
  const result = Number(value);
  return Number.isInteger(result) && result > 0 ? result : null;
}

function errorMessage(error: unknown, fallback: string): string {
  const parts = error instanceof Error ? error.message.split("Error: ") : [];
  return parts.length > 0 ? parts[parts.length - 1] : fallback;
}
