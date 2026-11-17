import { Badge, DataTable, PageHeading } from "@skolopals/ui/ui";
import { assignableRolesFor, isSuperAdminRole, requireAdmin } from "@skolopals/shared/auth";
import { shortDate } from "@skolopals/shared/format";
import { getUsers } from "@/lib/admin";
import { InviteUserForm } from "./invite-user-form";
import { ROLE_LABEL } from "./role-label";
import { UserRowActions } from "./user-row-actions";

export const metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const { roles, profile } = await requireAdmin();
  const iAmSuper = isSuperAdminRole(roles);
  const users = await getUsers();

  return (
    <>
      <PageHeading title="Users" description="Invite, edit and deactivate users, and see everyone with a Skolopals account." />
      <InviteUserForm roles={assignableRolesFor(roles)} />
      <DataTable
        rows={users}
        rowKey={(u) => u.id}
        empty="No users yet. Add the first one above."
        columns={[
          { header: "Name", primary: true, cell: (u) => u.fullName },
          { header: "Email", cell: (u) => u.email },
          {
            header: "Roles",
            cell: (u) => (
              <span className="flex flex-wrap gap-1.5">
                {u.roles.map((role) => (
                  <Badge key={role} tone={role === "admin" || role === "superadmin" ? "warning" : "neutral"}>
                    {ROLE_LABEL[role] ?? role}
                  </Badge>
                ))}
              </span>
            ),
          },
          {
            header: "Status",
            cell: (u) => <Badge tone={u.isActive ? "success" : "neutral"}>{u.isActive ? "Active" : "Deactivated"}</Badge>,
          },
          { header: "Added", cell: (u) => shortDate(u.createdAt) },
          {
            header: "",
            cell: (u) => (
              <UserRowActions
                user={u}
                assignable={assignableRolesFor(roles)}
                isSelf={u.id === profile.id}
                canManage={iAmSuper || !u.roles.some((r) => r === "admin" || r === "superadmin")}
              />
            ),
          },
        ]}
      />
    </>
  );
}
