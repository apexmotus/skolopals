"use client";

import { useActionState } from "react";
import { Button, Card, CardTitle, Field, FormMessage, Input, Select } from "@skolopals/ui/ui";
import type { InvitableUserRole } from "@skolopals/shared/auth";
import { inviteUser, type InviteUserState } from "./actions";
import { ROLE_LABEL } from "./role-label";

/** `roles` is what the signed-in admin may assign — "Admin" is only in it for super admins. */
export function InviteUserForm({ roles }: { roles: InvitableUserRole[] }) {
  const [state, action, pending] = useActionState<InviteUserState, FormData>(inviteUser, {});
  return (
    <Card>
      <CardTitle>Add a user</CardTitle>
      <p className="text-[11px] text-muted">
        The person gets an email with a link to create their password and complete their registration.
      </p>
      <form action={action} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <Field label="First name" htmlFor="first_name">
            <Input id="first_name" name="first_name" placeholder="Thabo" maxLength={100} required />
          </Field>
          <Field label="Last name" htmlFor="last_name">
            <Input id="last_name" name="last_name" placeholder="Mokoena" maxLength={100} required />
          </Field>
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <Field label="Email address" htmlFor="email">
            <Input id="email" name="email" type="email" placeholder="thabo@example.com" maxLength={255} required />
          </Field>
          <Field label="Role" htmlFor="role">
            <Select id="role" name="role" defaultValue={roles[0]}>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {state.error ? <FormMessage>{state.error}</FormMessage> : null}
        {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
        <Button type="submit" className="w-fit" disabled={pending}>
          {pending ? "Sending invitation…" : "Add user"}
        </Button>
      </form>
    </Card>
  );
}
