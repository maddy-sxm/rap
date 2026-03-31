import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpeedX — Website Revenue Score",
  description:
    "Find out how much revenue your website is leaving behind. Get a free diagnostic score across four revenue-critical dimensions in under 60 seconds.",
  keywords: "website revenue score, marketing diagnostic, conversion analysis, paid traffic readiness, lead generation",
  openGraph: {
    title: "SpeedX — Website Revenue Score",
    description:
      "Find out how much revenue your website is leaving behind. Free diagnostic in under 60 seconds.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Unbounded:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-zinc-950 text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
