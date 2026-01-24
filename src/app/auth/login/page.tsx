"use client";

import { LoginForm } from "@/components/login-form";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex min-h-svh w-full items-center justify-center p-6 md:p-10"
      onClick={() => router.back()}
    >
      <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <LoginForm />
      </div>
    </div>
  );
}
