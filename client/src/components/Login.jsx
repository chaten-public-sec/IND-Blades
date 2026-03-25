import { ArrowRight, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { buildApiUrl } from '../lib/api';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

function DiscordGlyph(props) {
  return (
    <svg viewBox="0 0 127.14 96.36" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77.7,77.7,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.3,46,96.19,53,91.08,65.69,84.69,65.69Z" />
    </svg>
  );
}

export default function Login() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="floating-soft absolute left-[-6%] top-[-12%] h-[420px] w-[420px] rounded-full bg-[linear-gradient(135deg,rgba(var(--primary-rgb),0.18),rgba(99,102,241,0.08))] blur-[130px]" />
        <div className="floating-soft-delay absolute bottom-[-16%] right-[-4%] h-[360px] w-[360px] rounded-full bg-[linear-gradient(135deg,rgba(59,130,246,0.12),rgba(16,185,129,0.08))] blur-[140px]" />
      </div>

      <Card className="relative w-full max-w-5xl overflow-hidden rounded-[34px] border border-[var(--border)] bg-[var(--bg-panel)]/92">
        <div className="grid gap-0 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="relative hidden min-h-[620px] overflow-hidden border-r border-[var(--border)] bg-[linear-gradient(180deg,rgba(var(--primary-rgb),0.12),rgba(11,18,32,0.3))] p-10 lg:flex lg:flex-col lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-soft)] px-4 py-2 text-xs font-black uppercase tracking-[0.26em] text-[var(--primary)]">
                <Sparkles className="h-4 w-4" />
                IND Blades
              </div>
              <div className="space-y-4">
                <h1 className="max-w-xl text-5xl font-semibold leading-[1.05] text-[var(--text-main)]">
                  Clean access into the IND Blades control room.
                </h1>
                <p className="max-w-lg text-base leading-8 text-[var(--text-muted)]">
                  Sign in with Discord to open the same live dashboard used for events, strikes, notifications, logs, and activity tracking.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="surface-soft rounded-[24px] p-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Auth</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text-main)]">Discord OAuth</p>
              </div>
              <div className="surface-soft rounded-[24px] p-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Sync</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text-main)]">Realtime</p>
              </div>
              <div className="surface-soft rounded-[24px] p-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Access</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text-main)]">Role Based</p>
              </div>
            </div>
          </div>

          <div className="flex min-h-[620px] flex-col justify-center p-6 sm:p-10 lg:p-12">
            <CardHeader className="px-0 pt-0">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-4 py-2 text-xs font-black uppercase tracking-[0.26em] text-[var(--text-muted)] lg:hidden">
                <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
                IND Blades
              </div>
              <CardTitle className="text-4xl">Sign in</CardTitle>
              <CardDescription className="max-w-md text-base leading-7">
                Use your Discord account to continue. Access is granted automatically based on your IND Blades server membership and role setup.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 px-0 pb-0">
              <Button
                className="h-14 w-full rounded-[20px] bg-[#5865F2] text-base font-bold text-white hover:bg-[#4752C4]"
                onClick={() => {
                  window.location.href = buildApiUrl('/api/auth/discord');
                }}
              >
                <DiscordGlyph className="h-5 w-5" />
                Continue with Discord
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="surface-soft rounded-[24px] p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    Secure session
                  </div>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                    Authentication is handled through Discord and stored in an authenticated browser session.
                  </p>
                </div>
                <div className="surface-soft rounded-[24px] p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
                    <LockKeyhole className="h-4 w-4 text-[var(--primary)]" />
                    Access control
                  </div>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                    Dashboard sections open automatically based on the role resolved for your account.
                  </p>
                </div>
              </div>
            </CardContent>
          </div>
        </div>
      </Card>
    </div>
  );
}
