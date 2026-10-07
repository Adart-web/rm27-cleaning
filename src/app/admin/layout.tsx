import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import AdminShell from "@/components/admin/AdminShell";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "RM27 Painel",
  robots: { index: false, follow: false },
  manifest: "/admin.webmanifest",
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: {
    capable: true,
    title: "RM27 Painel",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FBFCFF",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={dmSans.className}>
      <AdminShell>{children}</AdminShell>
    </div>
  );
}