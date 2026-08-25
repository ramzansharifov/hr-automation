import { useAuth } from "../../features/auth/AuthContext";
import { AccessRoleDetailsPage } from "./AccessRoleDetailsPage";
import { AccessRoleFormPage } from "./AccessRoleFormPage";
import { AccessUsersPage } from "./AccessUsersPage";
import { ScopedAccessRoleDetailsPage } from "./ScopedAccessRoleDetailsPage";
import { ScopedAccessUsersPage } from "./ScopedAccessUsersPage";

export function AccessUsersRoutePage(): JSX.Element {
  const { session } = useAuth();
  return session.permissionScopes["users.view"] === "global" ? (
    <AccessUsersPage />
  ) : (
    <ScopedAccessUsersPage />
  );
}

export function AccessRoleDetailsRoutePage(): JSX.Element {
  const { session } = useAuth();
  return session.permissionScopes["roles.view"] === "global" ? (
    <AccessRoleDetailsPage />
  ) : (
    <ScopedAccessRoleDetailsPage />
  );
}

export function AccessRoleFormRoutePage(): JSX.Element {
  return <AccessRoleFormPage />;
}
