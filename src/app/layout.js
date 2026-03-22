import { Analytics } from "@vercel/analytics/next";
import AuthProvider from "@/components/AuthProvider";

export const metadata = {
// ... existing metadata
  title: "PunkSQL — Learn SQL Like a Game",
  description: "80 SQL challenges with real in-browser execution. Cyberpunk CLI aesthetic. From SELECT to CTEs. Free, no signup required.",
  keywords: ["SQL", "learn SQL", "SQL practice", "SQL challenges", "database", "coding game"],

  // Favicon + icon suite
  icons: {
    // Main browser favicon (modern)
    icon: [
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { url: "/icon.png", type: "image/png" },
    ],
    // Legacy shortcut icon fallback
    shortcut: "/favicon.ico",
    // Apple touch icon for iOS home screen
    apple: [
      { url: "/icon.png", type: "image/png" },
    ],
  },

  openGraph: {
    title: "PunkSQL — Learn SQL Like a Game",
    description: "80 SQL challenges, 8 modules, real in-browser execution. Level up from SELECT to CTEs.",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "PunkSQL — Learn SQL Like a Game",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "PunkSQL — Learn SQL Like a Game",
    description: "80 SQL challenges with real in-browser execution. Free.",
    images: ["/icon.png"],
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
      <body style={{ margin: 0, padding: 0, background: "#020410", overflowX: "hidden", overflowY: "hidden", height: "100%" }}>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
