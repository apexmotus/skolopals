import { Logo } from "./logo";

/**
 * Full-screen loader: the logo with a ring in the logo's colours circling it.
 * Server-safe, so it can be a route `loading.tsx` fallback as well as an overlay. No
 * backdrop blur: blurring the whole viewport is costly to paint on low-end phones.
 */
export function LoadingScreen({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-white/95"
    >
      <div className="relative flex size-[200px] items-center justify-center">
        <span aria-hidden className="skolo-spinner-ring absolute inset-0" />
        <Logo height={56} priority />
      </div>
      <span className="sr-only">{label}…</span>
    </div>
  );
}
