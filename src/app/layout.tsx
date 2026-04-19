import type { Metadata } from "next";
import Script from "next/script";
import { GeistMono, GeistSans } from "geist/font";
import { GeistPixelGrid } from "geist/font/pixel";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Shiryoku",
    template: "%s | Shiryoku",
  },
  description:
    "Research assistant with hybrid keyword and semantic search across your document corpus.",
  keywords: ["research", "documents", "search", "RAG", "knowledge base"],
  openGraph: {
    title: "Shiryoku",
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
      className={`${GeistSans.variable} ${GeistMono.variable} ${GeistPixelGrid.variable} h-full antialiased`}
    >
      <head>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body className="min-h-full flex flex-col dark">{children}</body>
    </html>
  );
}
