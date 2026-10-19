"use client";

import { useEffect } from "react";
import { Button, ButtonLink, StatusState } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="p-4 md:p-7">
      <StatusState
        icon="/icons/help-circle.svg"
        title="Something went wrong on our side"
        description="We couldn’t load this page. Your bookings and payments are safe — please try again in a moment."
      >
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/contact" variant="secondary">
          Contact support
        </ButtonLink>
      </StatusState>
      {error.digest ? <p className="text-center text-[11px] text-muted">Reference: {error.digest}</p> : null}
    </div>
  );
}
