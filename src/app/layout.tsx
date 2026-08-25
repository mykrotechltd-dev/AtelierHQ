import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AtelierHQ — Order management for tailoring shops",
  description:
    "Manage orders, measurements, tasks, payments and invoices for your tailoring business, with an AI assistant built in.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
