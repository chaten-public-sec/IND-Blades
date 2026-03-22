import { useState } from 'react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { SelectField } from '../components/ui/select';

export default function WelcomePage() {
  const { config, setConfig, channels, showToast, handleError } = useDashboardContext();
  const [channelInput, setChannelInput] = useState(config.channel_id || '');
  const [saving, setSaving] = useState(false);

  const toggleWelcome = async () => {
    setSaving(true);
    try {
      const r = await api.post('/api/welcome/toggle', { enabled: !config.enabled });
      setConfig(r.data?.config || {});
      showToast(r.data?.config?.enabled ? 'Welcome enabled.' : 'Welcome disabled.');
    } catch (err) { handleError(err, 'Failed to update.'); }
    finally { setSaving(false); }
  };

  const saveChannel = async () => {
    setSaving(true);
    try {
      const r = await api.post('/api/welcome/channel', { channel_id: channelInput || null });
      setConfig(r.data?.config || {});
      showToast('Welcome channel updated.');
    } catch (err) { handleError(err, 'Failed to update.'); }
    finally { setSaving(false); }
  };

  const sendPreview = async () => {
    try {
      await api.post('/api/welcome/preview');
      showToast('Preview sent to Discord.');
    } catch (err) { handleError(err, 'Failed to send preview.'); }
  };

  return (
    <div className="space-y-8 animate-[fadeIn_0.3s_ease]">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Welcome System</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Automatically greet new members joining your server.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Welcome Messages</h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Send an embedded welcome when a member joins.</p>
            </div>
            <Badge variant={config.enabled ? 'success' : 'danger'}>{config.enabled ? 'Enabled' : 'Disabled'}</Badge>
          </div>

          <div className="mt-6 max-w-md space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--text-muted)]">Welcome Channel</label>
              <SelectField value={channelInput} onChange={(e) => setChannelInput(e.target.value)}>
                <option value="">System default</option>
                {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
              </SelectField>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant={config.enabled ? 'danger' : 'default'} onClick={toggleWelcome} loading={saving}>
                {config.enabled ? 'Disable' : 'Enable'}
              </Button>
              <Button variant="secondary" onClick={saveChannel} loading={saving}>Save Channel</Button>
              <Button variant="outline" onClick={sendPreview}>Send Preview</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Discord Preview */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Discord Preview</h3>
          <div className="rounded-xl bg-[#313338] p-4">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-sm shadow-lg">⚡</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-zinc-100">IND Blades Bot</span>
                  <span className="rounded bg-[#5865F2] px-1.5 py-0.5 text-[10px] font-bold text-white">APP</span>
                  <span className="text-xs text-zinc-400">Today</span>
                </div>
                <div className="mt-2 rounded-lg border-l-4 border-l-[#51a7ff] bg-[#2b2d31] p-4">
                  <p className="text-sm font-bold text-zinc-100">✨ Welcome <span className="rounded bg-[#51a7ff]/10 px-1 text-[#51a7ff]">@NewMember</span> to the Sanctuary! ✨</p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    We're thrilled to have you here. Please verify yourself, grab your roles, and dive into the voice chats!
                    <br /><br />
                    Let's make some amazing memories! ⚡
                  </p>
                  <p className="mt-3 border-t border-zinc-700/50 pt-2 text-xs text-zinc-400">IND Blades • Premium Entry</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
