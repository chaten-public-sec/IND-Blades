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

      {/* Discord Preview - Exact match to Discord message */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Discord Preview</h3>
          <p className="mb-3 text-xs text-[var(--text-muted)]">This matches the actual Discord message layout.</p>
          <div className="rounded-xl bg-[#313338] p-4 font-sans">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#5865F2] text-white text-sm font-bold shadow">IB</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-[#f2f3f5]">IND Blades Bot</span>
                  <span className="rounded bg-[#5865F2] px-1.5 py-0.5 text-[10px] font-bold text-white">BOT</span>
                  <span className="text-xs text-[#b5bac1]">Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="mt-2 overflow-hidden rounded" style={{ borderLeft: '4px solid #51a7ff', background: '#2b2d31' }}>
                  <div className="flex gap-4 p-4">
                    <div className="h-16 w-16 flex-shrink-0 rounded-full bg-[#5865F2]/30 flex items-center justify-center text-2xl">👤</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-[#f2f3f5] leading-relaxed whitespace-pre-wrap">
                        {`✨ Welcome @NewMember to the IND Blades Family! ✨

We're thrilled to have you here. Please verify yourself, grab your roles, and dive into the voice chats!

Let's make some amazing memories! ⚡

**Member #1** • IND Blades • Premium Entry`}
                      </div>
                    </div>
                  </div>
                  <div className="px-4 pb-3 pt-0 flex items-center gap-2 text-xs text-[#b5bac1]">
                    <span>IND Blades</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={sendPreview}>Send Preview to Discord</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
