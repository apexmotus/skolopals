import { PublicNav } from "@/components/public-nav";
import { ButtonLink, StatusState } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <PublicNav />
      <div className="p-4 md:p-7">
        <StatusState
          icon="/icons/help-circle.svg"
          title="We can’t find that page"
          description="The link may be broken, or the page may have moved. Check the address or head back to find a tutor."
        >
          <ButtonLink href="/" variant="secondary">
            Go home
          </ButtonLink>
          <ButtonLink href="/tutors">Find a tutor</ButtonLink>
        </StatusState>
      </div>
    </>
  );
}
