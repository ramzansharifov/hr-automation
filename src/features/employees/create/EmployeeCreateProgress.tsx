import { AnimatePresence, motion } from "framer-motion";
import type { TFunction } from "i18next";
import { FiCheck } from "react-icons/fi";

import { employeeCreateSteps } from "./employeeCreateSteps";

export function EmployeeCreateProgress({
  activeStep,
  t,
}: {
  activeStep: number;
  t: TFunction;
}): JSX.Element {
  return (
    <ol className="grid gap-5 md:grid-cols-4">
      {employeeCreateSteps.map((step, index) => {
        const isCompleted = index < activeStep;
        const isActive = index === activeStep;

        return (
          <li key={step.key} className="relative min-w-0">
            {index < employeeCreateSteps.length - 1 && (
              <span
                className={[
                  "absolute left-1/2 top-5 hidden h-0.5 w-full -translate-y-1/2 transition-colors duration-300 md:block",
                  isCompleted
                    ? "bg-[var(--accent)]"
                    : "bg-[var(--color-border)]",
                ].join(" ")}
              />
            )}

            <div className="relative z-10 flex flex-col items-center text-center">
              <span
                aria-current={isActive ? "step" : undefined}
                className={[
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-black transition-all duration-300",
                  isCompleted
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : isActive
                      ? "border-[var(--accent)] bg-[var(--color-surface)] text-[var(--accent)] ring-4 ring-[var(--accent-ring)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]",
                ].join(" ")}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isCompleted ? (
                    <motion.span
                      key="check"
                      className="flex items-center justify-center"
                      initial={{ opacity: 0, rotate: -45, scale: 0.35 }}
                      animate={{ opacity: 1, rotate: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.35 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                    >
                      <FiCheck className="h-5 w-5" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="number"
                      initial={{ opacity: 0, scale: 0.75 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.75 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      {index + 1}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>

              <span
                className={[
                  "mt-3 max-w-32 text-xs font-black leading-tight transition-colors duration-300",
                  isCompleted || isActive ? "app-accent-text" : "app-muted",
                ].join(" ")}
              >
                {t(step.titleKey)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
