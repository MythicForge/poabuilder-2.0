import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import CommandPaletteServer from "@/components/CommandPaletteServer";

export const metadata: Metadata = {
  icons: {
    icon: [
      {
        url: "/logo.svg", // /public path
        href: "/logo.svg", // /public path
      },
    ],
  },
  title: {
    default: "Path of Ambition — Player Reference",
    template: "%s | Path of Ambition",
  },
  description:
    "A comprehensive reference site for Path of Ambition tabletop RPG players.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=localStorage.getItem('poa-theme');var t=s||(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <CommandPaletteServer />
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 min-w-0 pt-14 lg:pt-0">
              <div
                style={{ maxWidth: "1400px", padding: "1.5rem 2rem 4rem" }}
                className="lg:pt-8"
              >
                {children}
              </div>
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
