import Image from "next/image";

/** Intrinsic size of public/images/logo.png, used to keep every lockup on ratio. */
const RATIO = 960 / 492;

/** The Skolopals wordmark. `alt` carries the name for screen readers and link labels. */
export function Logo({ height = 40, priority = false }: { height?: number; priority?: boolean }) {
  return (
    <Image
      src="/images/logo.png"
      alt="Skolopals"
      width={Math.round(height * RATIO)}
      height={height}
      priority={priority}
    />
  );
}
