import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "@skolopals/ui/globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

// Only a fallback in the font stack (--font-sans), so it isn't preloaded on every page.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "Skolopals Admin",
    template: "%s · Skolopals Admin",
  },
  description: "Skolopals Tutoring Centre Administration Portal",
  applicationName: "Skolopals Admin",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
