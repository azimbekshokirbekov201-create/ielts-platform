import type { Metadata } from "next";
import "@/styles/globals.css";
export const metadata: Metadata = {
  title: "IELTS Academy · Your ambition, a plan.",
  description:
    "An intentional space to prepare for IELTS. Practice all four skills, explore courses, and track your progress in our local frontend demo.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
