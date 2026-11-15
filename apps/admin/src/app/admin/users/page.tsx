import { Badge, DataTable, PageHeading } from "@skolopals/ui/ui";
import { assignableRolesFor, requireAdmin } from "@skolopals/shared/auth";
import { shortDate } from "@skolopals/shared/format";
import { getUsers } from "@/lib/admin";
import { InviteUserForm } from "./invite-user-form";
import { ROLE_LABEL } from "./role-label";

export const metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const { roles } = await requireAdmin();
  const users = await getUsers();

  return (
    <>
      <PageHeading title="Users" description="Invite new users and see everyone with a Skolopals account." />
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
          { header: "Added", cell: (u) => shortDate(u.createdAt) },
        ]}
      />
    </>
  );
}
