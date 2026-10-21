import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/** Absolute base for social previews; falls back to the dev server locally. */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const title = "Skolopals · Learning that clicks";
const description = "Find verified one-to-one tutors for every subject and stage.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s · Skolopals",
  },
  description,
  applicationName: "Skolopals",
  openGraph: {
    type: "website",
    siteName: "Skolopals",
    title,
    description,
    url: "/",
    images: [
      {
        url: "/images/og.png",
        width: 1200,
        height: 630,
        alt: "Skolopals",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/images/og.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
