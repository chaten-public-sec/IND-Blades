import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function AuthCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get('status');
    const reason = params.get('reason');

    if (status === 'denied' || status === 'error') {
      navigate(`/?reason=${reason || ''}`, { replace: true });
      return;
    }

    navigate('/dashboard', { replace: true });
  }, [location.search, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="surface-highlight flex w-full max-w-md flex-col items-center gap-5 rounded-[32px] px-8 py-10 text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--primary-soft)] border-t-[var(--primary)]" />
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Discord Login</p>
          <h1 className="text-2xl font-semibold text-[var(--text-main)]">Finishing your sign in</h1>
          <p className="text-sm leading-7 text-[var(--text-muted)]">
            We are checking your Discord session and opening your dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
