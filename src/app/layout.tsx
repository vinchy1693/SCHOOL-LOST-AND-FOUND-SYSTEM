import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Campus Lost & Found",
    template: "%s · Campus Lost & Found",
  },
  description:
    "A two-sided campus lost and found board. Post what you lost, reply with what you found, and claim it back.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
