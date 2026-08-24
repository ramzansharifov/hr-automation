import { useAuth } from "../features/auth/AuthContext";
import { getLeadershipRole } from "../shared/access/leadership";
import { DashboardPage } from "./DashboardPage";
import { LeadershipDashboardPage } from "./LeadershipDashboardPage";

export function RoleAwareDashboardPage(): JSX.Element {
  const { session } = useAuth();
  const leadershipRole = getLeadershipRole(session.roles);

  if (leadershipRole) {
    return <LeadershipDashboardPage role={leadershipRole} />;
  }

  return <DashboardPage />;
}
