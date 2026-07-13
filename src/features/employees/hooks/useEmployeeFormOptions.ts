import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import type { SelectOption } from "../../../shared/ui";
import { loadEmployeeRelationOptions } from "../lib/employeeRelations";
import type { PositionOption } from "../lib/employeeRelations";

interface EmployeeFormOptions {
  departments: SelectOption[];
  genderOptions: SelectOption[];
  isRelationsLoading: boolean;
  positions: PositionOption[];
  statusOptions: SelectOption[];
}

export function useEmployeeFormOptions(): EmployeeFormOptions {
  const { t } = useTranslation();
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [isRelationsLoading, setIsRelationsLoading] = useState(true);

  const statusOptions = useMemo<SelectOption[]>(
    () => [
      { value: "active", label: t("common.status.active") },
      { value: "inactive", label: t("common.status.inactive") },
    ],
    [t],
  );

  const genderOptions = useMemo<SelectOption[]>(
    () => [
      { value: "male", label: t("common.status.male") },
      { value: "female", label: t("common.status.female") },
    ],
    [t],
  );

  useEffect(() => {
    let isActive = true;

    setIsRelationsLoading(true);
    loadEmployeeRelationOptions()
      .then((options) => {
        if (!isActive) return;

        setDepartments(options.departments);
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
  }, [t]);

  return {
    departments,
    genderOptions,
    isRelationsLoading,
    positions,
    statusOptions,
  };
}
