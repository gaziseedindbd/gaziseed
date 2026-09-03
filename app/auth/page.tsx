'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) { e.preventDefault(); setError(''); const supabase = createClient(); const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }); if (error) setError(error.message); else setSent(true); }
  return <main className="flex min-h-screen items-center justify-center bg-[#f7f8f4] p-4"><div className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-xl"><div className="text-2xl font-black text-[#1f6b3b]">🌱 GAZI SEED</div><h1 className="mt-8 text-3xl font-black">Sign in / Create account</h1><p className="mt-2 text-gray-500">We'll send a secure verification link to your email.</p>{sent ? <div className="mt-8 rounded-2xl bg-[#edf5e9] p-5 font-semibold text-[#14502a]">Check your email to continue. You can return here after verification.</div> : <form onSubmit={submit} className="mt-8 space-y-4"><input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-[#1f6b3b]"/><button className="w-full rounded-xl bg-[#1f6b3b] px-5 py-3 font-bold text-white">Continue with Email</button>{error && <p className="text-sm text-red-600">{error}</p>}</form>}<a href="/" className="mt-6 block text-center text-sm font-semibold text-[#1f6b3b]">← Back to shop</a></div></main>;
}
