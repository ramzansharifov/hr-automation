import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import type { SelectOption } from "../../../shared/ui";
import { loadEmployeeRelationOptions } from "../lib/employeeRelations";
import type {
  DepartmentOption,
  PositionOption,
} from "../lib/employeeRelations";

interface EmployeeFormOptions {
  departments: DepartmentOption[];
  enterprises: SelectOption[];
  genderOptions: SelectOption[];
  isRelationsLoading: boolean;
  positions: PositionOption[];
  statusOptions: SelectOption[];
}

export function useEmployeeFormOptions(loadRelations = true): EmployeeFormOptions {
  const { i18n, t } = useTranslation();
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [enterprises, setEnterprises] = useState<SelectOption[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [isRelationsLoading, setIsRelationsLoading] = useState(true);

  const genderOptions = useMemo<SelectOption[]>(
    () => [
      { value: "male", label: t("common.status.male") },
      { value: "female", label: t("common.status.female") },
    ],
    [t],
  );

  const statusOptions = useMemo<SelectOption[]>(
    () => [
      { value: "active", label: t("common.status.active") },
      { value: "terminated", label: t("common.status.terminated", { defaultValue: i18n.language.startsWith("en") ? "Terminated" : "Уволен" }) },
    ],
    [i18n.language, t],
  );

  useEffect(() => {
    if (!loadRelations) {
      setDepartments([]);
      setEnterprises([]);
      setPositions([]);
      setIsRelationsLoading(false);
      return;
    }

    let isActive = true;
    setIsRelationsLoading(true);
    loadEmployeeRelationOptions()
      .then((options) => {
        if (!isActive) return;
        setDepartments(options.departments);
        setEnterprises(options.enterprises);
        setPositions(options.positions);
      })
      .catch(() => {
        toast.error(t("forms.toasts.relationsLoadError"));
      })
      .finally(() => {
        if (isActive) setIsRelationsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [loadRelations, t]);

  return {
    departments,
    enterprises,
    genderOptions,
    isRelationsLoading,
    positions,
    statusOptions,
  };
}
