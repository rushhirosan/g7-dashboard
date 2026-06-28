import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "G7 news dashboard",
  description: "今日のG7を、あなたの言語で。See what the world is reading.",
  openGraph: {
    title: "G7 news dashboard",
    description: "今日のG7を、あなたの言語で。",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
