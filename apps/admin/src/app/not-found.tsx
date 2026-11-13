import { ButtonLink, StatusState } from "@skolopals/ui/ui";

export default function NotFound() {
  return (
    <div className="p-4 md:p-7">
      <StatusState
        icon="/icons/help-circle.svg"
        title="We can’t find that page"
        description="The link may be broken, or the page may have moved."
      >
        <ButtonLink href="/admin">Back to dashboard</ButtonLink>
      </StatusState>
    </div>
  );
}
