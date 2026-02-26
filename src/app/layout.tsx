"use client";

import { useState } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import WorkView from "../components/workview";
import Sidebar from "../components/sidebar";
import { NewProjectForm } from "@/components/new-project-form";
import { NewAssetForm } from "@/components/new-asset-form";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isNewAssetOpen, setIsNewAssetOpen] = useState(false);

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <div className="h-screen w-screen flex overflow-hidden">
          <div className="flex flex-col h-screen">
            <header className="flex flex-col p-8">
              <h1 className="self-center text-3xl font-bold">Guitarshop</h1>
            </header>
            <Sidebar
              onNewProject={() => setIsNewProjectOpen(true)}
              onNewAsset={() => setIsNewAssetOpen(true)}
            />
          </div>
          <WorkView onNewProject={() => setIsNewProjectOpen(true)}>
            {children}
          </WorkView>
        </div>
        {isNewProjectOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex min-h-svh w-full justify-center items-center p-6 md:p-10"
            onClick={() => setIsNewProjectOpen(false)}
          >
            <div
              className="w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <NewProjectForm onSuccess={() => setIsNewProjectOpen(false)} />
            </div>
          </div>
        )}
        {isNewAssetOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex min-h-svh w-full justify-center items-center p-6 md:p-10"
            onClick={() => setIsNewAssetOpen(false)}
          >
            <div
              className="w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <NewAssetForm onSuccess={() => setIsNewAssetOpen(false)} />
            </div>
          </div>
        )}
      </body>
    </html>
  );
}
