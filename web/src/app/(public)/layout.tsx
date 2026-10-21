import { PublicNav } from "@/components/public-nav";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <PublicNav />
      <div className="flex w-full flex-1 flex-col">{children}</div>
    </>
  );
}
