import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  title: "QueryQuest — Learn SQL Like a Game",
  description: "80 SQL challenges with real in-browser execution. Cyberpunk CLI aesthetic. From SELECT to CTEs. Free, no signup required.",
  keywords: ["SQL", "learn SQL", "SQL practice", "SQL challenges", "database", "coding game"],
  openGraph: {
    title: "QueryQuest — Learn SQL Like a Game",
    description: "80 SQL challenges, 8 modules, real in-browser execution. Level up from SELECT to CTEs.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "QueryQuest — Learn SQL Like a Game",
    description: "80 SQL challenges with real in-browser execution. Free.",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#020410",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#020410", overflow: "hidden" }}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
