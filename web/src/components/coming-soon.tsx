import { EmptyState } from "@/components/ui";

/**
 * A feature whose schema is built but whose screens land in a later phase.
 * Deliberately explicit rather than a blank page, so nobody mistakes an
 * unbuilt screen for a broken one.
 */
export function ComingSoon({ title, phase, description }: { title: string; phase: string; description: string }) {
  return (
    <EmptyState
      title={title}
      description={
        <>
          {description}
          <br />
          <span className="text-[11px]">Scheduled for {phase}.</span>
        </>
      }
    />
  );
}
