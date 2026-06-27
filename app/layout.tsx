import type { Metadata } from "next";
import "@/app/globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Resolume Companion",
  description: "Local media upload and Resolume Arena controller"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
