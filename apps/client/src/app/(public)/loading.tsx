import { PageSkeleton } from "@skolopals/ui/page-skeleton";

export default function Loading() {
  return (
    <div className="mx-auto mt-[24px] w-full max-w-[1280px] px-4 md:px-[24px]">
      <PageSkeleton />
    </div>
  );
}
