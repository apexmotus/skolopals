"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function SortSelect({ value, options }: { value: string; options: { value: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="text-[13px] text-muted">
        Sort by
      </label>
      <div className="relative">
        <select
          id="sort"
          value={value}
          onChange={(e) => {
            const next = new URLSearchParams(searchParams);
            next.set("sort", e.target.value);
            next.delete("page");
            router.push(`${pathname}?${next}`);
          }}
          className="h-9 appearance-none rounded-[6px] border border-line bg-white pl-3 pr-8 text-[13px] text-ink"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <img
          src="/icons/chevron-down.svg"
          alt=""
          width={16}
          height={16}
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
        />
      </div>
    </div>
  );
}
