import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sniper Engine | Command Center",
  description: "Real-time monitoring dashboard for the multi-agent memecoin sniping engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-slate-950 text-slate-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
