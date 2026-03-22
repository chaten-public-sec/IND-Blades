import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';
import heroImage from '../assets/hero.png';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

export default function Login() {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!key.trim()) {
      setError('Enter your dashboard key.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/api/login', { key });
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to log in right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="floating-orb pointer-events-none absolute left-[8%] top-[10%] h-56 w-56 rounded-full bg-cyan-400/16 blur-[120px]" />
      <div className="floating-orb-delay pointer-events-none absolute bottom-[8%] right-[10%] h-72 w-72 rounded-full bg-sky-400/18 blur-[150px]" />

      <Card className="halo relative w-full max-w-5xl overflow-hidden rounded-[34px] border-white/12">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative hidden min-h-[640px] overflow-hidden lg:block">
            <img src={heroImage} alt="IND Blades" className="absolute inset-0 h-full w-full object-cover opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950/15 via-slate-950/35 to-slate-950/88" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.22),transparent_38%)]" />
            <div className="relative z-10 flex h-full flex-col justify-between p-10">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">
                <ShieldCheck className="h-4 w-4" />
                IND Blades
              </div>

              <div className="max-w-md space-y-5">
                <p className="text-sm uppercase tracking-[0.32em] text-cyan-100/70">Premium Command Center</p>
                <h1 className="text-5xl font-semibold leading-none text-white">
                  Clean control, real-time sync, and a dashboard that feels alive.
                </h1>
                <p className="text-base leading-7 text-slate-300">
                  Manage events, welcome flows, logs, and community activity from one polished surface built for
                  IND Blades.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="surface-soft rounded-[24px] p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Live Sync</p>
                  <p className="mt-2 text-lg font-semibold text-white">Socket Ready</p>
                </div>
                <div className="surface-soft rounded-[24px] p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Events</p>
                  <p className="mt-2 text-lg font-semibold text-white">Full Control</p>
                </div>
                <div className="surface-soft rounded-[24px] p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Welcome</p>
                  <p className="mt-2 text-lg font-semibold text-white">Preview Ready</p>
                </div>
              </div>
            </div>
          </div>

          <CardContent className="relative flex min-h-[640px] flex-col justify-center px-6 py-8 sm:px-10 lg:px-12">
            <div className="absolute inset-x-10 top-8 h-px bg-gradient-to-r from-transparent via-cyan-200/25 to-transparent" />

            <div className="mb-10 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-300 lg:hidden">
                <ShieldCheck className="h-4 w-4 text-cyan-200" />
                IND Blades
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Login</p>
                <h2 className="text-4xl font-semibold text-white">Welcome back.</h2>
                <p className="max-w-md text-sm leading-7 text-slate-400">
                  Enter the dashboard key to open your workspace. Everything else stays ready in the background.
                </p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="dashboard-key" className="text-sm font-semibold text-slate-200">
                  Dashboard Key
                </label>
                <div className="surface-soft flex h-14 items-center gap-3 rounded-[22px] px-4 transition focus-within:border-cyan-300/30 focus-within:bg-slate-950/90">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/6 text-cyan-200">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <input
                    id="dashboard-key"
                    type="password"
                    autoFocus
                    value={key}
                    onChange={(event) => setKey(event.target.value)}
                    placeholder="Enter your dashboard key"
                    className="h-full w-full bg-transparent text-base text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              {error ? (
                <div className="rounded-[22px] border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm font-medium text-rose-100">
                  {error}
                </div>
              ) : null}

              <Button type="submit" loading={loading} className="h-14 w-full rounded-[22px] text-base font-bold">
                {loading ? 'Logging in' : 'Login'}
                {!loading ? <ArrowRight className="h-4 w-4" /> : null}
              </Button>
            </form>

            <div className="mt-8 rounded-[24px] border border-white/8 bg-white/4 px-5 py-4">
              <p className="text-sm font-semibold text-white">Secure access</p>
              <p className="mt-1 text-sm leading-7 text-slate-400">
                Sessions stay in the browser, and the dashboard reconnects to live updates automatically after login.
              </p>
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}
