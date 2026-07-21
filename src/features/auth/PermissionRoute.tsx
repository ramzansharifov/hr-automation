import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function RequirePermission({
  anyOf,
  children,
}: {
  anyOf: string[];
  children: ReactNode;
}): JSX.Element {
  const { session } = useAuth();
  const allowed = anyOf.some((permission) =>
    session.permissionCodes.includes(permission),
  );
  return allowed ? <>{children}</> : <Navigate replace to={getDefaultPath(session.permissionCodes, session.employeeId)} />;
}

export function AuthorizedHome(): JSX.Element {
  const { session } = useAuth();
  return (
    <Navigate
      replace
      to={getDefaultPath(session.permissionCodes, session.employeeId)}
    />
  );
}

export function OwnProfileRedirect(): JSX.Element {
  const { session } = useAuth();
  return <Navigate replace to={`/employees/${session.employeeId}`} />;
}

function getDefaultPath(permissionCodes: string[], employeeId: number): string {
  if (permissionCodes.includes("dashboard.view")) return "/dashboard";
  if (permissionCodes.includes("profile.view")) return `/employees/${employeeId}`;
  if (permissionCodes.includes("employees.view")) return "/employees";
  if (permissionCodes.includes("organization.view")) return "/enterprises";
  if (permissionCodes.includes("recruitment.view")) return "/vacancies";
  if (permissionCodes.includes("filters.use")) return "/filters";
  if (permissionCodes.includes("access.manage")) return "/access";
  if (permissionCodes.includes("settings.manage")) return "/settings";
  return "/no-access";
}
