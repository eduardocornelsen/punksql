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
      <body suppressHydrationWarning style={{ margin: 0, padding: 0, background: "#111111", overflowX: "hidden", overflowY: "hidden", height: "100%" }}>
        {/* Landscape warning — hidden by default, shown via CSS media query */}
        <style>{`
          .landscape-warn { display: none; }
          @media screen and (orientation: landscape) and (max-height: 500px) {
            .landscape-warn { display: flex; }
          }
        `}</style>
        <div className="landscape-warn" style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "#000000", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 16, fontFamily: "monospace", textAlign: "center",
          pointerEvents: "none",
        }}>
          <div style={{ fontSize: 40 }}>⟳</div>
          <div style={{ color: "#00FF88", fontSize: 16, letterSpacing: 1 }}>rotate device</div>
          <div style={{ color: "#555555", fontSize: 12 }}>PunkSQL requires portrait mode</div>
        </div>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
