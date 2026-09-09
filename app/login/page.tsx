"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    const supabase = createClient();

    const { data, error } =
      mode === "sign_in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (error) {
      const message = error.message.toLowerCase();
      setError(
        message.includes("invalid login credentials")
          ? "Email or password is incorrect. If you just signed up, confirm your email first."
          : message.includes("email not confirmed")
          ? "Confirm your email from Supabase’s sign-up message, then sign in."
          : error.message
      );
      setPending(false);
      return;
    }
    if (mode === "sign_up" && !data.session) {
      setNotice("Account created. Check your email to confirm it, then return here to sign in.");
      setPending(false);
      return;
    }
    router.push("/");
    router.refresh();
    setPending(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-neutral-900 p-6"
      >
        <h1 className="text-xl font-semibold text-white">
          {mode === "sign_in" ? "Sign in" : "Create account"}
        </h1>
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-white outline-none"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-white outline-none"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        {notice && <p className="text-sm text-emerald-400">{notice}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-white py-2 font-medium text-neutral-950"
        >
          {pending ? "Please wait…" : mode === "sign_in" ? "Sign in" : "Sign up"}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "sign_in" ? "sign_up" : "sign_in")}
          className="w-full text-sm text-neutral-400"
        >
          {mode === "sign_in"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
