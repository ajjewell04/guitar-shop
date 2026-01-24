"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/client";

export default function WorkView({ children }: { children: React.ReactNode }) {
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = createClient();

    fetchUser.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });

    const { data: authListener } = fetchUser.auth.onAuthStateChange(
      (event, session) => {
        setUserEmail(session?.user.email ?? null);
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="flex flex-1 flex-col m-h-0 bg-(--background2) rounded-lg m-2 p-4">
      <header className="flex h-16 justify-between items-center">
        <div className="text-xl font-bold">Workview</div>
        <input
          className="flex flex-1 min-w-xs max-w-3xl rounded-2xl p-2 m-2 bg-(--background)"
          type="text"
          placeholder=" Search"
        />
        <div className="flex gap-6">
          <button id="newProjBtn">+ New Project</button>
          {userEmail ? (
            <Link href="/protected">{userEmail}</Link>
          ) : (
            <Link href="/auth/login">Login</Link>
          )}
        </div>
      </header>
      <hr />
      <section>{children}</section>
    </main>
  );
}
