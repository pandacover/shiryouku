import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Shiryouku",
    template: "%s | Shiryouku",
  },
  description:
    "Research assistant with hybrid keyword and semantic search across your document corpus.",
  keywords: ["research", "documents", "search", "RAG", "knowledge base"],
  openGraph: {
    title: "Shiryouku",
    description:
      "Research assistant with hybrid keyword and semantic search across your document corpus.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col dark">{children}</body>
    </html>
  );
}
