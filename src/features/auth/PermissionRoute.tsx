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
  if (permissionCodes.includes("employees.view")) return "/employees";
  if (permissionCodes.includes("organization.view")) return "/enterprises";
  if (permissionCodes.includes("directory.view")) return "/team";
  if (permissionCodes.includes("vacations.view")) return "/vacations";
  if (permissionCodes.includes("vacancies.view")) return "/vacancies";
  if (permissionCodes.includes("candidates.view")) return "/candidates";
  if (permissionCodes.includes("filters.use")) return "/filters";
  if (permissionCodes.includes("vacation_types.view")) return "/vacation-types";
  if (permissionCodes.includes("users.view")) return "/users";
  if (permissionCodes.includes("roles.view")) return "/roles";
  if (permissionCodes.includes("audit.view")) return "/audit";
  if (permissionCodes.includes("profile.view")) return `/employees/${employeeId}`;
  if (permissionCodes.includes("settings.view")) return "/settings";
  return "/no-access";
}
