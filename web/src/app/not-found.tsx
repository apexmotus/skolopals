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
          description="The link may be broken, or the page may have moved. Try the home page, or get in touch and we will point you the right way."
        >
          <ButtonLink href="/" variant="secondary">
            Go home
          </ButtonLink>
          <ButtonLink href="/">Back to the home page</ButtonLink>
        </StatusState>
      </div>
    </>
  );
}
