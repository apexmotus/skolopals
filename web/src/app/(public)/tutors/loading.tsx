import { Card } from "@/components/ui";

function Bar({ className }: { className: string }) {
  return <span className={`block animate-pulse rounded bg-canvas ${className}`} />;
}

export default function LoadingTutors() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-7" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-[5px]">
        <h1 className="text-[28px] text-ink">Find your tutor</h1>
        <p className="text-[13px] text-muted">Finding verified tutors…</p>
      </div>
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <Card className="w-full shrink-0 md:w-[260px]">
          <Bar className="h-6 w-24" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex flex-col gap-[6px]">
              <Bar className="h-3 w-20" />
              <Bar className="h-[42px] w-full" />
            </div>
          ))}
        </Card>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Bar className="h-9 w-48" />
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i}>
              <div className="flex items-center gap-[14px]">
                <Bar className="size-[54px] rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Bar className="h-4 w-40" />
                  <Bar className="h-3 w-56" />
                  <Bar className="h-3 w-28" />
                </div>
                <Bar className="h-[38px] w-[110px]" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
