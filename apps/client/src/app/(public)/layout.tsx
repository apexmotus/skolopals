import { PublicNav } from "@/components/public-nav";

// Rendered per request (the nav shows who is signed in), never prerendered at build, which
// would need the API reachable from CI. The data behind these pages is still cached: the
// `api.public` reads opt into the data cache with their own revalidate, which this leaves as is.
export const revalidate = 0;

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <PublicNav />
      <div className="flex w-full flex-1 flex-col">{children}</div>
    </>
  );
}
