import { Navigate } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { useDashboardContext } from '../lib/DashboardContext';
import { hasPermission } from '../lib/access';
import BotMastiPanel from '../components/BotMastiPanel';
import SectionHeader from '../components/SectionHeader';
import { Badge } from '../components/ui/badge';

export default function BotChatPage() {
  const dashboard = useDashboardContext();
  const canManageBotChat = hasPermission(dashboard.viewer, 'manage_bot_chat');

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

      <BotMastiPanel />
    </div>
  );
}
