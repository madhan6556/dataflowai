"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);

  // Get the redirect destination from the URL
  const getNextPath = () => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("next") || "/dashboard";
    }
    return "/dashboard";
  };

  // If already logged in, redirect immediately
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setSessionCookieAndRedirect();
      }
    });
    return () => unsub();
  }, []);

  const setSessionCookieAndRedirect = () => {
    // Set a lightweight session cookie that the proxy can read
    document.cookie = "firebase_session=1; path=/; max-age=86400; SameSite=Lax";
    window.location.href = getNextPath();
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        setMessage({ text: "Logged in! Redirecting...", type: "success" });
        setSessionCookieAndRedirect();
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        setMessage({ text: "Account created! Redirecting...", type: "success" });
        setSessionCookieAndRedirect();
      }
    } catch (error: any) {
      const msg =
        error.code === "auth/user-not-found" ? "No account found with this email." :
        error.code === "auth/wrong-password" ? "Incorrect password. Please try again." :
        error.code === "auth/email-already-in-use" ? "An account with this email already exists." :
        error.code === "auth/weak-password" ? "Password must be at least 6 characters." :
        error.code === "auth/invalid-email" ? "Please enter a valid email address." :
        error.code === "auth/invalid-credential" ? "Invalid email or password." :
        error.message || "An error occurred.";
      setMessage({ text: msg, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative isolate min-h-screen flex items-center justify-center p-4 bg-black overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-0 left-0 w-[300px] h-[300px] bg-blue-500/5 blur-[100px] rounded-full pointer-events-none -z-10" />

      <Link href="/" className="absolute top-8 left-8 text-white/40 hover:text-white transition-colors text-sm flex items-center gap-2 group">
        <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to home
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-white to-gray-400 flex items-center justify-center shadow-lg">
            <div className="w-3.5 h-3.5 bg-black rounded-sm" />
          </div>
          <span className="text-xl font-bold tracking-tighter text-white">DataFlow<span className="text-white/40">AI</span></span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-2xl font-bold tracking-tight text-white mb-1.5">
              {isLogin ? "Welcome back" : "Create account"}
            </h2>
            <p className="text-sm text-white/40 mb-8">
              {isLogin ? "Sign in to access your dashboards." : "Start analyzing your data for free."}
            </p>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/40 focus:border-white/40 transition-all text-sm"
                  placeholder="name@company.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/40 focus:border-white/40 transition-all text-sm"
                  placeholder="••••••••"
                />
              </div>

              {message && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-xs px-4 py-3 rounded-xl border ${
                    message.type === "error"
                      ? "bg-red-500/10 border-red-500/20 text-red-400"
                      : "bg-green-500/10 border-green-500/20 text-green-400"
                  }`}
                >
                  {message.text}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-white text-black font-bold rounded-xl px-4 py-3.5 mt-2 hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(255,255,255,0.15)]"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin rounded-full"></div>
                    Please wait...
                  </>
                ) : isLogin ? "Sign In" : "Create Account"}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/5 text-center">
              <button
                onClick={() => { setIsLogin(!isLogin); setMessage(null); }}
                className="text-xs text-white/40 hover:text-white transition-colors"
              >
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <span className="text-white font-semibold underline underline-offset-2">
                  {isLogin ? "Sign up" : "Log in"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
