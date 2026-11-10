import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brioche Encomendas",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
