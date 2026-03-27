import { Navigate } from 'react-router-dom';
import { Activity, Crown, Radar, ShieldAlert, Sparkles } from 'lucide-react';
import { useDashboardContext } from '../lib/DashboardContext';
import { hasPermission } from '../lib/access';
import BotMastiPanel from '../components/BotMastiPanel';
import SectionHeader from '../components/SectionHeader';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';

export default function BotChatPage() {
  const dashboard = useDashboardContext();
  const canManageBotChat = hasPermission(dashboard.viewer, 'manage_bot_chat');
  const modeLabel = String(dashboard.botState?.presence_mode || 'idle')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

  if (!canManageBotChat) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Super Admin"
        title="Bot Chat"
        description="Private bot-mask control room for channel replies, live bot posting, and desi masti without using your own Discord identity."
        actions={(
          <Badge className="border-amber-300/20 bg-amber-500/16 text-amber-100 hover:bg-amber-500/16">
            <Crown className="mr-1 h-3.5 w-3.5" />
            Private Route
          </Badge>
        )}
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="surface-highlight">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Radar className="h-5 w-5 text-[var(--primary)]" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Presence Mode</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text-main)]">{modeLabel}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="surface-highlight">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-amber-400" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Reply Tone</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text-main)]">
                  {String(dashboard.botState?.reply_tone || 'friendly').replace(/\b\w/g, (character) => character.toUpperCase())}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="surface-highlight">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Traffic</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text-main)]">{dashboard.botState?.message_rate || 0} msgs/min</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="surface-highlight">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-rose-400" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Strike Watch</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text-main)]">{dashboard.botState?.active_strikes || 0} active</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="surface-highlight">
        <CardContent className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Live Identity</p>
          <p className="mt-3 text-xl font-semibold text-[var(--text-main)]">
            {dashboard.botState?.current_presence_text || 'Observing silently'}
          </p>
          <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
            {dashboard.botState?.profile_line || 'Waiting for the next bot heartbeat to sync system identity.'}
          </p>
        </CardContent>
      </Card>

      <BotMastiPanel />
    </div>
  );
}
