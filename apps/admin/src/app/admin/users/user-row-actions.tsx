"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Field, FormMessage, Input } from "@skolopals/ui/ui";
import type { InvitableUserRole } from "@skolopals/shared/auth";
import type { AdminUserSummary } from "@/lib/admin";
import { setUserActive, updateUser, type UserActionState } from "./actions";
import { ROLE_LABEL } from "./role-label";

type Props = {
  user: AdminUserSummary;
  /** Roles the signed-in admin may assign. */
  assignable: InvitableUserRole[];
  isSelf: boolean;
  /** Admin / super admin accounts can only be managed by a super admin. */
  canManage: boolean;
};

export function UserRowActions({ user, assignable, isSelf, canManage }: Props) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<UserActionState, FormData>(updateUser, {});
  const [toggleError, setToggleError] = useState<string>();
  const [toggling, startToggle] = useTransition();

  if (!canManage) return <span className="text-[12px] text-muted">—</span>;

  const isSuper = user.roles.includes("superadmin");
  const keptRoles = user.roles.filter((r) => r !== "superadmin") as InvitableUserRole[];

  function toggleActive() {
    setToggleError(undefined);
    startToggle(async () => {
      const result = await setUserActive(user.id, !user.isActive);
      if (result.error) setToggleError(result.error);
    });
  }

  if (!editing) {
    return (
      <span className="flex flex-col gap-1">
        <span className="flex gap-2">
          <Button variant="secondary" className="px-3 py-[6px] text-[12px]" onClick={() => setEditing(true)}>
            Edit
          </Button>
          {!isSelf && !isSuper ? (
            <Button
              variant={user.isActive ? "danger" : "secondary"}
              className="px-3 py-[6px] text-[12px]"
              disabled={toggling}
              onClick={toggleActive}
            >
              {user.isActive ? "Deactivate" : "Reactivate"}
            </Button>
          ) : null}
        </span>
        {toggleError ? <FormMessage>{toggleError}</FormMessage> : null}
      </span>
    );
  }

  return (
    <form action={action} className="flex min-w-[260px] flex-col gap-2">
      <input type="hidden" name="id" value={user.id} />
      <Field label="First name" htmlFor={`fn-${user.id}`}>
        <Input id={`fn-${user.id}`} name="first_name" defaultValue={user.firstName} maxLength={100} required />
      </Field>
      <Field label="Last name" htmlFor={`ln-${user.id}`}>
        <Input id={`ln-${user.id}`} name="last_name" defaultValue={user.lastName} maxLength={100} required />
      </Field>
      {isSuper ? (
        // Super admin roles are fixed; the API needs a role list, so carry the current one.
        (keptRoles.length ? keptRoles : (["admin"] as InvitableUserRole[])).map((r) => (
          <input key={r} type="hidden" name="roles" value={r} />
        ))
      ) : (
        <fieldset className="flex flex-wrap gap-x-3 gap-y-1">
          <legend className="text-[11px] text-muted">Roles</legend>
          {assignable.map((role) => (
            <label key={role} className="flex items-center gap-1 text-[13px]">
              <input type="checkbox" name="roles" value={role} defaultChecked={user.roles.includes(role)} />
              {ROLE_LABEL[role]}
            </label>
          ))}
        </fieldset>
      )}
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
      <span className="flex gap-2">
        <Button type="submit" className="px-3 py-[6px] text-[12px]" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="secondary" className="px-3 py-[6px] text-[12px]" onClick={() => setEditing(false)}>
          Close
        </Button>
      </span>
    </form>
  );
}
