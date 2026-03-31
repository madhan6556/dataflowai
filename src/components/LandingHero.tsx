"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const FOUNDER_LINKEDIN_URL = "https://www.linkedin.com/in/madhan-kumar-govindu-6736b5305/";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: EASE_OUT },
});

export default function LandingHero() {
  return (
    <div className="relative min-h-screen bg-black text-white overflow-x-hidden">
      {/* Background Gradients */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-violet-600/8 blur-[100px] rounded-full" />
      </div>

      {/* Nav */}
      <motion.nav
        {...fadeUp(0)}
        className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-6 lg:px-12 py-5 border-b border-white/5 backdrop-blur-md bg-black/60"
      >
        <div className="text-xl font-bold tracking-tighter">
          DataFlow<span className="text-indigo-400">AI</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/auth" className="text-sm text-white/50 hover:text-white transition-colors">Sign In</Link>
          <Link href="/auth" className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-full transition-all hover:scale-105">
            Get Started Free →
          </Link>
        </div>
      </motion.nav>

      <div className="max-w-6xl mx-auto px-6 lg:px-8">

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <section className="pt-40 pb-24 text-center">
          <motion.div {...fadeUp(0.1)}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              AI Data Analyst — Powered by Gemini
            </div>
          </motion.div>

          <motion.h1 {...fadeUp(0.2)} className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            Stop staring at Excel.<br />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
              Start understanding it.
            </span>
          </motion.h1>

          <motion.p {...fadeUp(0.3)} className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed mb-4">
            Upload your CSV or Excel file and get instant insights, trends, and recommendations — powered by AI.
          </motion.p>
          <motion.p {...fadeUp(0.35)} className="text-base text-white/35 max-w-xl mx-auto mb-10">
            No formulas. No dashboards to build. Just answers.
          </motion.p>

          <motion.div {...fadeUp(0.4)} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="group flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-4 rounded-full text-lg transition-all hover:scale-[1.03] shadow-[0_0_40px_rgba(99,102,241,0.3)]"
            >
              Upload Your File Free
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
            <span className="text-white/30 text-sm">No credit card required</span>
          </motion.div>

          {/* Hero Preview Card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.9, ease: EASE_OUT }}
            className="mt-16 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-left max-w-3xl mx-auto"
          >
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-base">✨</div>
              <div>
                <div className="text-white font-bold text-sm">AI Analysis · sales_data_2024.xlsx</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-green-400 text-xs">Analysis complete</span>
                </div>
              </div>
            </div>
            <p className="text-white/60 text-sm leading-relaxed mb-5 border-l-2 border-indigo-500/50 pl-3">
              Your dataset contains 60,390 sales transactions across 3 product categories and 6 regions from 2011–2014. Total revenue of $29.3M shows strong growth driven primarily by the Bikes category.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { icon: "💡", label: "Key Insight", color: "amber", text: "Bikes drive 72% of total revenue at $21.1M — significantly outperforming Accessories ($4.8M) and Clothing ($3.4M)." },
                { icon: "✅", label: "Recommendation", color: "indigo", text: "Focus marketing budget on the Southwest region which shows the highest growth rate at 34% YoY but is underserved." },
              ].map((card, i) => (
                <div key={i} className={`p-4 rounded-xl bg-${card.color}-500/10 border border-${card.color}-500/20`}>
                  <p className={`text-${card.color}-400 text-xs font-bold uppercase tracking-widest mb-2`}>{card.icon} {card.label}</p>
                  <p className="text-white/70 text-sm leading-relaxed">{card.text}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── PROBLEM ────────────────────────────────────────────────────── */}
        <section className="py-24 border-t border-white/5">
          <motion.div {...fadeUp(0)} className="text-center mb-14">
            <p className="text-white/40 text-sm uppercase tracking-widest font-bold mb-3">The Problem</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight">Still doing this?</h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {[
              "⏱️ Spending hours cleaning Excel data",
              "🔍 Struggling to find trends in numbers",
              "📊 Building charts manually just to guess",
              "😤 Not sure what your data is telling you",
            ].map((pain, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 bg-red-500/5 border border-red-500/15 rounded-xl px-5 py-4 text-white/60 text-sm"
              >
                {pain}
              </motion.div>
            ))}
          </div>
          <motion.p
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="text-center text-white/30 mt-8 text-sm"
          >
            You're not alone. That's why we built DataFlowAI.
          </motion.p>
        </section>

        {/* ── SOLUTION ───────────────────────────────────────────────────── */}
        <section className="py-24 border-t border-white/5">
          <div className="text-center mb-14">
            <p className="text-white/40 text-sm uppercase tracking-widest font-bold mb-3">The Solution</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">Meet your AI Data Analyst.</h2>
            <p className="text-white/50 text-lg">Just upload your file and get:</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: "📊", title: "Instant Insights", desc: "Business-language explanations of what your data actually means — no guesswork." },
              { icon: "⚠️", title: "Anomaly Detection", desc: "Automatically surfaces outliers, spikes, and suspicious patterns you'd miss manually." },
              { icon: "📈", title: "Trends & Patterns", desc: "See what's growing, declining, and what's driving your most important metrics." },
              { icon: "💡", title: "Actionable Recommendations", desc: "Specific, numbered actions you can take right now to improve business outcomes." },
              { icon: "💬", title: "Chat with Your Data", desc: "Ask any question in plain English. Get answers instantly without writing formulas." },
              { icon: "📄", title: "Export Reports", desc: "Share professional PDF reports with your team — generated in one click." },
            ].map((feat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all group"
              >
                <div className="text-3xl mb-3">{feat.icon}</div>
                <h3 className="font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">{feat.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
          <p className="text-center text-white/30 mt-8 text-sm">All in under 10 seconds.</p>
        </section>

        {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
        <section className="py-24 border-t border-white/5">
          <div className="text-center mb-14">
            <p className="text-white/40 text-sm uppercase tracking-widest font-bold mb-3">How It Works</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight">Three steps. Zero effort.</h2>
          </div>
          <div className="flex flex-col md:flex-row gap-0 max-w-3xl mx-auto">
            {[
              { n: "01", title: "Upload", desc: "Drop your CSV or Excel file — any size, any format." },
              { n: "02", title: "Analyze", desc: "AI reads, cleans, and analyzes your entire dataset automatically." },
              { n: "03", title: "Understand", desc: "Get insights, charts, recommendations, and a chat interface instantly." },
            ].map((step, i) => (
              <div key={i} className="flex-1 flex flex-col items-center text-center p-8 relative">
                {i < 2 && <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 text-white/10 text-2xl">→</div>}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-black text-lg mb-4">
                  {step.n}
                </div>
                <h3 className="font-bold text-white text-lg mb-2">{step.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-white/30 mt-6 text-sm">No setup required. No technical knowledge needed.</p>
        </section>

        {/* ── DIFFERENTIATOR ─────────────────────────────────────────────── */}
        <section className="py-24 border-t border-white/5">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-3xl bg-gradient-to-br from-indigo-600/15 to-violet-600/10 border border-indigo-500/20 p-10 md:p-14 text-center">
              <p className="text-white/40 text-sm uppercase tracking-widest font-bold mb-6">The Difference</p>
              <p className="text-2xl md:text-3xl font-black text-white/50 mb-4">Most tools show you charts.</p>
              <p className="text-3xl md:text-5xl font-black text-white mb-8 tracking-tight">We tell you what they mean.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                {[
                  { q: "Why did sales drop?", a: "We tell you exactly which region, product, and time period caused it." },
                  { q: "Which customers matter most?", a: "We rank them by lifetime value, frequency, and growth potential." },
                  { q: "Where is my business growing?", a: "We identify the top momentum areas with specific numbers and trends." },
                ].map((item, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-white/40 text-xs mb-2">You ask: "{item.q}"</p>
                    <p className="text-white/80 text-sm leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── SOCIAL PROOF ───────────────────────────────────────────────── */}
        <section className="py-20 border-t border-white/5">
          <div className="max-w-2xl mx-auto">
            <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-8 text-center">
              <div className="flex justify-center gap-1 mb-3">
                {[...Array(5)].map((_, i) => <span key={i} className="text-amber-400 text-lg">★</span>)}
              </div>
              <p className="text-white/70 text-lg italic leading-relaxed mb-4">
                "I uploaded my sales data and got insights in seconds. This saved me hours of manual analysis and showed me trends I never would have found myself."
              </p>
              <p className="text-white/30 text-sm">— Founder, E-commerce company</p>
            </div>
          </div>
        </section>

        <section className="py-24 border-t border-white/5">
          <div className="max-w-5xl mx-auto">
            <motion.div
              {...fadeUp(0)}
              className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.22),transparent_28%),radial-gradient(circle_at_85%_18%,rgba(34,211,238,0.16),transparent_22%),linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))]"
            >
              <div className="absolute inset-y-0 right-[18%] hidden w-px bg-gradient-to-b from-transparent via-white/10 to-transparent xl:block" />
              <div className="absolute -left-16 top-10 h-48 w-48 rounded-full bg-indigo-500/15 blur-3xl" />
              <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />

              <div className="relative grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-10 p-8 md:p-10 lg:p-12">
                <div className="space-y-8">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.26em] text-white/55">
                    Founder Spotlight
                  </div>

                  <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[280px_1fr]">
                    <div className="relative mx-auto lg:mx-0">
                      <div className="absolute -inset-5 rounded-[2.2rem] bg-gradient-to-br from-indigo-500/35 via-violet-500/20 to-cyan-400/25 blur-3xl" />
                      <div className="relative rounded-[2.2rem] border border-white/12 bg-black/35 p-3 backdrop-blur-xl shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
                        <div className="relative aspect-[4/5] overflow-hidden rounded-[1.7rem]">
                          <Image
                            src="/founder-madhan.jpg"
                            alt="Madhan, founder of DataFlowAI"
                            fill
                            sizes="(max-width: 1024px) 280px, 320px"
                            className="object-cover"
                          />
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_24%,transparent_60%,rgba(0,0,0,0.6))]" />
                        </div>
                        <div className="absolute bottom-8 left-8 right-8 rounded-[1.4rem] border border-white/10 bg-black/50 px-4 py-3 backdrop-blur-md">
                          <div className="text-[10px] uppercase tracking-[0.3em] text-white/45">Founder</div>
                          <div className="mt-1 text-2xl font-black tracking-tight text-white">Madhan</div>
                          <div className="mt-1 text-sm text-white/55">DataFlowAI</div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6 text-left">
                      <p className="text-sm uppercase tracking-[0.3em] text-white/35">Meet Madhan</p>
                      <h2 className="max-w-3xl text-4xl font-black leading-[0.98] tracking-tight md:text-5xl xl:text-6xl">
                        Founder-led AI analytics
                        <span className="block text-white/75">with a sharper eye for</span>
                        <span className="bg-gradient-to-r from-indigo-300 via-violet-200 to-cyan-200 bg-clip-text text-transparent">
                          clarity, speed, and trust.
                        </span>
                      </h2>
                      <p className="max-w-2xl text-lg leading-relaxed text-white/58">
                        DataFlowAI is built to make complex spreadsheets feel instantly understandable. The product direction is simple: surface the story inside the data, make the next action obvious, and keep the experience beautiful enough to trust.
                      </p>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {[
                          { value: "Insight-first", label: "AI reveals meaning before charts." },
                          { value: "Founder-built", label: "Hands-on product thinking from Madhan." },
                          { value: "Action-ready", label: "Recommendations designed for real decisions." },
                        ].map((item) => (
                          <div key={item.value} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 backdrop-blur-sm">
                            <div className="text-sm font-bold tracking-tight text-white">{item.value}</div>
                            <div className="mt-1 text-xs leading-relaxed text-white/45">{item.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-between gap-6">
                  <div className="rounded-[1.8rem] border border-white/10 bg-black/28 p-6 backdrop-blur-sm">
                    <p className="mb-5 text-xs uppercase tracking-[0.28em] text-white/35">Product Notes</p>
                    <div className="space-y-4">
                      {[
                        "Designed for founders, operators, analysts, and anyone who wants signal faster than traditional BI tools can provide it.",
                        "Pairs plain-English reasoning with visual summaries so business users do not have to reverse-engineer dashboards.",
                        "Keeps the human in control: upload, understand, ask sharper questions, and move quickly with confidence.",
                      ].map((point, index) => (
                        <div key={index} className="flex items-start gap-4">
                          <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-indigo-400/25 bg-indigo-400/10 text-[11px] font-bold text-indigo-300">
                            0{index + 1}
                          </div>
                          <p className="text-sm leading-relaxed text-white/62">{point}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(135deg,rgba(10,102,194,0.22),rgba(255,255,255,0.03))] p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                      <div className="max-w-sm">
                        <p className="mb-3 text-xs uppercase tracking-[0.28em] text-white/35">Connect</p>
                        <h3 className="text-2xl font-black tracking-tight text-white">Connect with Madhan on LinkedIn</h3>
                        <p className="mt-2 text-sm leading-relaxed text-white/60">
                          Reach out for product conversations, founder networking, or to talk about how DataFlowAI is evolving.
                        </p>
                      </div>
                      <a
                        href={FOUNDER_LINKEDIN_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="group inline-flex items-center gap-3 rounded-2xl border border-[#2f7ef7]/30 bg-black/30 px-5 py-4 text-white transition-all hover:-translate-y-0.5 hover:bg-black/40"
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0A66C2] text-white shadow-[0_12px_30px_rgba(10,102,194,0.35)]">
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M6.94 8.5a1.56 1.56 0 1 1 0-3.12 1.56 1.56 0 0 1 0 3.12ZM5.6 9.7h2.68V18H5.6V9.7Zm4.36 0h2.57v1.13h.04c.36-.68 1.24-1.4 2.54-1.4 2.72 0 3.23 1.79 3.23 4.11V18h-2.68v-3.95c0-.94-.02-2.15-1.31-2.15-1.31 0-1.51 1.02-1.51 2.08V18H9.96V9.7Z" />
                          </svg>
                        </span>
                        <span className="flex flex-col text-left">
                          <span className="text-sm font-bold tracking-tight">View LinkedIn profile</span>
                          <span className="text-xs text-white/50 transition-colors group-hover:text-white/70">
                            Open founder profile
                          </span>
                        </span>
                      </a>
                    </div>
                  </div>

                  <div className="rounded-[1.6rem] border border-white/8 bg-white/[0.025] px-5 py-4">
                    <p className="text-sm italic leading-relaxed text-white/55">
                      "The goal is simple: make people feel like their data is finally speaking clearly."
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── CTA FOOTER ─────────────────────────────────────────────────── */}
        <section className="py-24 border-t border-white/5 text-center">
          <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6">
            Your data has a story.<br />
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">Let AI tell it.</span>
          </h2>
          <p className="text-white/40 mb-10 text-lg">Perfect for founders, analysts, accountants, and anyone tired of manual Excel work.</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-white text-black font-bold px-10 py-5 rounded-full text-lg hover:scale-105 transition-all shadow-[0_0_60px_rgba(255,255,255,0.15)]"
          >
            Start for Free — No Credit Card
            <span>→</span>
          </Link>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 py-8 flex items-center justify-between text-white/20 text-sm">
          <div className="font-bold tracking-tighter">DataFlow<span className="text-indigo-400/60">AI</span></div>
          <div className="text-right">
            <div>© 2026 DataFlowAI. All rights reserved.</div>
            <div className="text-white/30 mt-1">Founded by Madhan</div>
          </div>
        </footer>
      </div>
    </div>
  );
}
