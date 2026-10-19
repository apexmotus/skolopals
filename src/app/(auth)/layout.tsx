import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      <div className="flex shrink-0 flex-col justify-between gap-10 bg-night p-8 text-white md:min-h-[650px] md:w-[420px] md:p-[42px]">
        <Link href="/" className="text-[26px] font-extrabold">
          Skolopals
        </Link>
        <p className="text-[26px] font-bold md:text-[32px]">Better learning starts with the right connection.</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-6 md:p-14">{children}</div>
    </div>
  );
}
