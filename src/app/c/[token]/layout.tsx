import type { Metadata } from "next";

// Página pública do cliente: não aparece em buscadores
export const metadata: Metadata = {
  title: "RM27 Cleaning",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}