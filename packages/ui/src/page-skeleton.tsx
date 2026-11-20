import { Card } from "./ui";

function Bar({ className }: { className: string }) {
  return <span aria-hidden className={`block animate-pulse rounded-[6px] bg-subtle ${className}`} />;
}

/**
 * Placeholder for a workspace page while its data loads. Used as each workspace's `loading.tsx`,
 * so a nav click swaps the content area at once and the sidebar stays put; it mirrors the usual
 * page shape (heading, stat row, a card) so the real page lands without a jump.
 */
export function PageSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-5">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-[10px]">
        <Bar className="h-[30px] w-[min(320px,70%)]" />
        <Bar className="h-[16px] w-[min(480px,90%)]" />
      </div>
      <div className="flex flex-col gap-4 md:flex-row">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="min-w-0 flex-1">
            <Bar className="h-[14px] w-[90px]" />
            <Bar className="h-[30px] w-[60px]" />
          </Card>
        ))}
      </div>
      <Card>
        <Bar className="h-[20px] w-[160px]" />
        {[0, 1, 2, 3].map((i) => (
          <Bar key={i} className="h-[14px] w-full" />
        ))}
      </Card>
    </div>
  );
}
