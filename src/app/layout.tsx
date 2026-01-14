import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import WorkView from "./(workview)/workview";
import Sidebar from "./(sidebar)/sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GuitarShop",
  description:
    "Visualize, edit, and share guitar/part models for your guitar projects.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <div className="app-shell">
          <div>
            <header className="app-header">
              <h1>Guitarshop</h1>
            </header>
            <Sidebar />
          </div>
          <WorkView>{children}</WorkView>
        </div>
      </body>
    </html>
  );
}
