import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import AdminOrdersPage from '../../app/admin/orders/page';
import { ToastProvider } from '../../components/site/toast-provider';
import { call, signIn, signOut } from './client';

function App() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [version, setVersion] = useState(0);
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    const form = event.currentTarget;
    const fields = new FormData(form);
    try { await signIn(String(fields.get('email')), String(fields.get('password'))); form.reset(); setReady(true); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Login failed'); }
    finally { setBusy(false); }
  }
  async function checkout() {
    setBusy(true); setMessage('');
    try {
      const r = await call('sandbox-admin-dispatch-preview', { action: 'create_payment' });
      if (r.error) throw Error(r.error.message);
      if (r.data.already_paid) { setMessage('Sandbox payment already paid. Open its order to verify.'); return; }
      const cashfree = (window as any).Cashfree({ mode: 'sandbox' });
      await cashfree.checkout({ paymentSessionId: r.data.payment_session_id, redirectTarget: '_modal' });
      setMessage('Checkout closed. Open the Sandbox order, verify payment, then select shipped.');
      setVersion(v => v + 1);
    } catch { setMessage('Sandbox checkout unavailable'); }
    finally { setBusy(false); }
  }
  return <ToastProvider><main className="mx-auto max-w-7xl p-4 sm:p-6">
    <div className="mb-6 rounded-2xl border border-orange-300 bg-orange-50 p-4 text-orange-950">
      <strong>ISOLATED SANDBOX · NO LIVE PAYMENTS</strong>
      <p className="mt-1 text-sm">আসল Admin Order component · শুধুমাত্র synthetic India orders · Production release blocked</p>
      <p className="mt-1 text-xs">এখানে item list খালি; order display details synthetic। Audit আসে test evidence থেকে। শুধু verified shipped transition চালু।</p>
    </div>
    {!ready ? <form onSubmit={login} className="mx-auto grid max-w-md gap-4 rounded-2xl border p-6">
      <h1 className="text-xl font-bold">Sandbox Admin Login</h1>
      <label>Email<input className="input-bangla mt-1 w-full" name="email" type="email" autoComplete="username" defaultValue="test@gaziseed.com" required /></label>
      <label>Password<input className="input-bangla mt-1 w-full" name="password" type="password" autoComplete="current-password" required /></label>
      <button className="rounded-xl bg-primary p-3 font-bold text-white" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to Sandbox'}</button>
    </form> : <>
      <div className="mb-5 flex flex-wrap gap-3">
        <button className="rounded-xl border p-3" onClick={checkout} disabled={busy}>Create / open ₹1 Sandbox payment</button>
        <button className="rounded-xl border p-3" onClick={() => setVersion(v => v + 1)} disabled={busy}>Refresh orders</button>
        <button className="rounded-xl border p-3" onClick={() => { signOut(); setReady(false); setMessage(''); }} disabled={busy}>Sign out</button>
      </div>
      <AdminOrdersPage key={version} />
    </>}
    {message && <p role="status" className="mt-4 rounded-xl border p-3 text-sm">{message}</p>}
  </main></ToastProvider>;
}
createRoot(document.getElementById('root')!).render(<App />);
