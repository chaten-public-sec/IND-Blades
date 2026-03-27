import { useEffect, useMemo, useState } from 'react';
import {
  AtSign,
  Bot,
  Crown,
  Hash,
  RadioTower,
  RefreshCcw,
  Reply,
  Send,
  Sparkles,
  Shield,
  WandSparkles,
  X,
} from 'lucide-react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { hasPermission } from '../lib/access';
import { formatDate } from '../lib/format';
import { cn } from '../lib/cn';
import SearchPickerDialog from './SearchPickerDialog';
import ProfileAvatar from './ProfileAvatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

const QUICK_LINES = [
  'Oye hero log, scene ye hai...',
  'Kaun kaun zinda hai chat me?',
  'VC me aa jao, full attendance check chalega.',
  'Aaj full masti mode on hai.',
  'Bhai log, itna shaant kyun ho?',
];

function TypingPreview() {
  return (
    <div className="flex items-center gap-2 rounded-[18px] border border-amber-400/20 bg-gradient-to-r from-amber-500/12 to-emerald-500/10 px-4 py-3 text-sm text-[var(--text-soft)]">
      <Bot className="h-4 w-4 text-amber-300" />
      <span>Bot typing live in Discord</span>
      <div className="ml-auto flex items-center gap-1">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="h-2 w-2 rounded-full bg-amber-300/90 animate-bounce"
            style={{ animationDelay: `${dot * 0.14}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function MessageCard({ message, replyTargetId, onReply }) {
  const isBot = Boolean(message.author?.bot);
  const content = message.content || (message.attachments?.length ? `[${message.attachments.length} attachment${message.attachments.length === 1 ? '' : 's'}]` : 'No text content');
  const isReplyTarget = String(replyTargetId || '') === String(message.id);

  return (
    <div
      className={cn(
        'rounded-[24px] border px-4 py-4 transition',
        isBot
          ? 'border-amber-400/18 bg-[linear-gradient(135deg,rgba(251,146,60,0.16),rgba(16,185,129,0.10))]'
          : 'border-[var(--border)] bg-[rgba(255,255,255,0.02)]',
        isReplyTarget ? 'ring-2 ring-amber-300/40' : ''
      )}
    >
      <div className="flex items-start gap-3">
        <ProfileAvatar
          name={message.author?.display_name || message.author?.username || 'Discord User'}
          avatarUrl={message.author?.avatar_url}
          size="sm"
          className={isBot ? 'ring-2 ring-amber-300/25 ring-offset-2 ring-offset-transparent' : ''}
        />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--text-main)]">
              {message.author?.display_name || message.author?.username || 'Discord User'}
            </p>
            {isBot ? (
              <Badge className="border-amber-300/20 bg-amber-500/15 text-amber-100 hover:bg-amber-500/15">
                Bot Mask
              </Badge>
            ) : null}
            <span className="text-xs text-[var(--text-muted)]">{formatDate(message.timestamp, 'Just now')}</span>
          </div>

          {message.referenced_message ? (
            <div className="rounded-[18px] border border-white/8 bg-black/10 px-3 py-2 text-xs text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text-soft)]">
                Replying to {message.referenced_message.author?.display_name || 'message'}
              </span>
              <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words">
                {message.referenced_message.content || 'Original message had no text.'}
              </p>
            </div>
          ) : null}

          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[var(--text-main)]">{content}</p>

          {message.attachments?.length ? (
            <div className="flex flex-wrap gap-2">
              {message.attachments.map((attachment) => (
                <span
                  key={attachment.id}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-[var(--text-soft)]"
                >
                  {attachment.filename}
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <a
              href={message.jump_url || '#'}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] transition hover:text-[var(--text-main)]"
            >
              Open in Discord
            </a>

            <Button variant="ghost" size="sm" onClick={() => onReply(message)}>
              <Reply className="h-4 w-4" />
              Reply as Bot
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BotMastiPanel() {
  const dashboard = useDashboardContext();
  const canManageBotChat = hasPermission(dashboard.viewer, 'manage_bot_chat');
  const textChannels = useMemo(
    () => dashboard.channels.filter((item) => [0, 5].includes(Number(item.type))),
    [dashboard.channels]
  );

  const [channelPickerOpen, setChannelPickerOpen] = useState(false);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [messages, setMessages] = useState([]);
  const [composer, setComposer] = useState('');
  const [replyTarget, setReplyTarget] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState('');

  const selectedChannel = useMemo(
    () => textChannels.find((item) => String(item.id) === String(selectedChannelId || '')) || null,
    [selectedChannelId, textChannels]
  );

  useEffect(() => {
    if (!canManageBotChat || selectedChannelId || !textChannels.length) {
      return;
    }
    setSelectedChannelId(String(textChannels[0].id));
  }, [canManageBotChat, selectedChannelId, textChannels]);

  useEffect(() => {
    if (!canManageBotChat || !selectedChannelId) {
      return;
    }

    const stillExists = textChannels.some((item) => String(item.id) === String(selectedChannelId));
    if (!stillExists) {
      setSelectedChannelId(textChannels[0] ? String(textChannels[0].id) : '');
      setReplyTarget(null);
    }
  }, [canManageBotChat, selectedChannelId, textChannels]);

  const loadMessages = async (silent = false) => {
    if (!selectedChannelId) {
      setMessages([]);
      setReplyTarget(null);
      return;
    }

    if (!silent) {
      setLoading(true);
    }
    setLoadError('');

    try {
      const response = await api.get('/api/bot-chat/messages', {
        params: {
          channel_id: selectedChannelId,
          limit: 30,
        },
      });
      const nextMessages = Array.isArray(response.data?.messages) ? response.data.messages : [];
      setMessages(nextMessages);
      setReplyTarget((current) => (
        current ? nextMessages.find((item) => String(item.id) === String(current.id)) || null : null
      ));
    } catch (error) {
      setLoadError(error.response?.data?.error || 'Unable to load recent channel messages.');
      if (!silent) {
        setMessages([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!canManageBotChat || !selectedChannelId) {
      return;
    }
    loadMessages(false);
  }, [canManageBotChat, selectedChannelId]);

  useEffect(() => {
    if (!canManageBotChat || !selectedChannelId) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      loadMessages(true);
    }, 20000);

    return () => window.clearInterval(intervalId);
  }, [canManageBotChat, selectedChannelId]);

  if (!canManageBotChat) {
    return null;
  }

  const channelItems = textChannels.map((channel) => ({
    id: channel.id,
    label: channel.name,
    description: channel.type === 5 ? 'Announcement channel' : `Text channel ${channel.id}`,
  }));
  const mentionUserItems = dashboard.users.map((user) => ({
    id: user.id,
    label: user.name,
    description: user.username ? `@${user.username}` : `User ID ${user.id}`,
  }));
  const mentionRoleItems = dashboard.roles.map((role) => ({
    id: role.id,
    label: role.name,
    description: `Role ID ${role.id}`,
  }));

  const insertComposerText = (snippet) => {
    setComposer((current) => {
      const draft = String(current || '');
      if (!draft.trim()) {
        return `${snippet} `;
      }
      const separator = draft.endsWith(' ') || draft.endsWith('\n') ? '' : ' ';
      return `${draft}${separator}${snippet} `;
    });
  };

  const queueBotMessage = async () => {
    const content = composer.trim();
    if (!selectedChannelId) {
      await dashboard.showToast('error', 'Choose a channel before sending.', 'bot-masti-channel');
      return;
    }
    if (!content) {
      await dashboard.showToast('error', 'Type the bot message first.', 'bot-masti-empty');
      return;
    }

    setSending(true);
    try {
      await api.post('/api/bot-chat/send', {
        channel_id: selectedChannelId,
        content,
        reply_to_message_id: replyTarget?.id || null,
      });
      setComposer('');
      setReplyTarget(null);
      await dashboard.showToast(
        'success',
        'Bot message queued. Discord typing will show first.',
        `bot-masti-send-${selectedChannelId}`
      );
      await new Promise((resolve) => window.setTimeout(resolve, 2400));
      await loadMessages(true);
    } catch (error) {
      dashboard.handleError(error, 'Unable to send the bot message right now.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="overflow-hidden border-amber-400/18 bg-[linear-gradient(140deg,rgba(249,115,22,0.14),rgba(16,185,129,0.09)_52%,rgba(59,130,246,0.06))] shadow-[0_26px_90px_-45px_rgba(249,115,22,0.65)]">
      <CardHeader className="border-b border-white/6 pb-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="border-amber-300/20 bg-amber-500/18 text-amber-100 hover:bg-amber-500/18">
                <Crown className="mr-1 h-3.5 w-3.5" />
                Super Admin Only
              </Badge>
              <Badge className="border-emerald-300/20 bg-emerald-500/14 text-emerald-100 hover:bg-emerald-500/14">
                <RadioTower className="mr-1 h-3.5 w-3.5" />
                Bot Mask Live
              </Badge>
            </div>
            <div>
              <CardTitle className="text-[1.75rem] text-white">Bot Masti Console</CardTitle>
              <CardDescription className="max-w-3xl text-[14px] leading-7 text-slate-200/78">
                Only you can see this panel. Pick any text channel, click a recent message, and the bot account will
                type first and then send the message or reply for your little masti scenes.
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setChannelPickerOpen(true)}>
              <Hash className="h-4 w-4" />
              {selectedChannel ? selectedChannel.name : 'Choose Channel'}
            </Button>
            <Button variant="outline" onClick={() => loadMessages(false)} loading={loading}>
              <RefreshCcw className="h-4 w-4" />
              Refresh Feed
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-white/8 bg-black/10 px-4 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-300/72">Active Route</p>
              <p className="mt-3 text-lg font-semibold text-white">{selectedChannel?.name || 'No channel'}</p>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-black/10 px-4 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-300/72">Recent Feed</p>
              <p className="mt-3 text-lg font-semibold text-white">{messages.length}</p>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-black/10 px-4 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-300/72">Posting Identity</p>
              <p className="mt-3 text-lg font-semibold text-white">Bot Account</p>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/8 bg-black/10 p-3">
            <div className="flex items-center justify-between gap-3 px-3 pb-3 pt-2">
              <div>
                <p className="text-sm font-semibold text-white">Recent Channel Messages</p>
                <p className="mt-1 text-xs text-slate-300/70">
                  Click any message below and reply through the bot instead of your own Discord ID.
                </p>
              </div>
              <Badge className="border-white/10 bg-white/6 text-slate-100 hover:bg-white/6">
                {selectedChannel ? `#${selectedChannel.name}` : 'No channel selected'}
              </Badge>
            </div>

            <div className="max-h-[540px] space-y-3 overflow-y-auto px-2 pb-2">
              {loadError ? (
                <div className="rounded-[20px] border border-rose-400/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">
                  {loadError}
                </div>
              ) : null}

              {loading ? (
                <TypingPreview />
              ) : null}

              {!loading && !messages.length ? (
                <div className="rounded-[24px] border border-dashed border-white/12 px-5 py-12 text-center text-sm text-slate-300/72">
                  Pick a text channel to see the recent chat feed here.
                </div>
              ) : null}

              {messages.map((message) => (
                <MessageCard
                  key={message.id}
                  message={message}
                  replyTargetId={replyTarget?.id}
                  onReply={setReplyTarget}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.12))] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-amber-500/16 text-amber-100">
                <WandSparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold text-white">Compose As Bot</p>
                <p className="text-sm text-slate-300/72">Desi style panel for private super-admin mischief.</p>
              </div>
            </div>

            {replyTarget ? (
              <div className="mt-5 rounded-[22px] border border-amber-300/18 bg-amber-500/12 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-100/76">Reply Target</p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {replyTarget.author?.display_name || replyTarget.author?.username || 'Discord User'}
                    </p>
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200/76">
                      {replyTarget.content || 'Original message had no text.'}
                    </p>
                  </div>

                  <Button variant="ghost" size="icon" onClick={() => setReplyTarget(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {QUICK_LINES.map((line) => (
                <button
                  key={line}
                  type="button"
                  onClick={() => setComposer((current) => (current ? `${current.trimEnd()}\n${line}` : line))}
                  className="rounded-full border border-white/10 bg-white/6 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-amber-300/24 hover:bg-amber-500/12"
                >
                  {line}
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-[22px] border border-white/8 bg-black/10 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-300/72">Mention Tools</p>
                  <p className="mt-2 text-sm text-slate-200/76">
                    Insert direct user and role mentions like a proper ops console.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setUserPickerOpen(true)}>
                    <AtSign className="h-4 w-4" />
                    Mention User
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setRolePickerOpen(true)}>
                    <Shield className="h-4 w-4" />
                    Mention Role
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <label className="text-xs font-black uppercase tracking-[0.24em] text-slate-300/72">Bot Message</label>
              <textarea
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                placeholder="Type what the bot should say in the channel..."
                className="min-h-44 w-full rounded-[24px] border border-white/10 bg-black/18 px-4 py-4 text-sm leading-7 text-white placeholder:text-slate-300/45"
              />
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-[20px] border border-emerald-400/14 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100/86">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                The real Discord typing indicator will show before the bot sends. Your personal account stays out of the chat.
              </p>
            </div>

            {sending ? <div className="mt-4"><TypingPreview /></div> : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={queueBotMessage} loading={sending} className="bg-amber-500 text-slate-950 hover:bg-amber-400">
                <Send className="h-4 w-4" />
                Send Through Bot
              </Button>
              <Button variant="ghost" onClick={() => {
                setComposer('');
                setReplyTarget(null);
              }}>
                Clear Draft
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      <SearchPickerDialog
        open={channelPickerOpen}
        onOpenChange={setChannelPickerOpen}
        title="Choose Bot Channel"
        description="Select the text or announcement channel where the bot should speak."
        items={channelItems}
        selectedIds={selectedChannelId ? [selectedChannelId] : []}
        onConfirm={(ids) => {
          setSelectedChannelId(ids[0] || '');
          setReplyTarget(null);
        }}
        placeholder="Search channels"
      />

      <SearchPickerDialog
        open={userPickerOpen}
        onOpenChange={setUserPickerOpen}
        title="Mention User"
        description="Choose a member and insert their Discord mention into the bot message."
        items={mentionUserItems}
        selectedIds={[]}
        onConfirm={(ids) => {
          if (ids[0]) {
            insertComposerText(`<@${ids[0]}>`);
          }
        }}
        placeholder="Search members"
      />

      <SearchPickerDialog
        open={rolePickerOpen}
        onOpenChange={setRolePickerOpen}
        title="Mention Role"
        description="Choose a Discord role and insert the role mention into the bot message."
        items={mentionRoleItems}
        selectedIds={[]}
        onConfirm={(ids) => {
          if (ids[0]) {
            insertComposerText(`<@&${ids[0]}>`);
          }
        }}
        placeholder="Search roles"
      />
    </Card>
  );
}
