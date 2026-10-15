import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Jiji Safi | Municipal Waste Command & Hotspot Analytics",
  description:
    "Real-time waste reporting, geospatial hotspot tracking, CO2e carbon-impact analytics, and incentive management powered by Oracle APEX & Autonomous Database.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-slate-950 text-slate-100">
        <ThemeProvider>
          <AuthProvider>
            <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
              <Navbar />
              <div className="flex flex-1 overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                  {children}
                </main>
              </div>
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
