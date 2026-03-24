import { useState } from 'react';
import { Image as ImageIcon, Send, Sparkles } from 'lucide-react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import SectionHeader from '../components/SectionHeader';
import SearchPickerDialog from '../components/SearchPickerDialog';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

export default function WelcomePage() {
  const dashboard = useDashboardContext();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const channelName = dashboard.channels.find((item) => String(item.id) === String(dashboard.welcome.channel_id || ''))?.name || 'No channel selected';

  const updateWelcome = async (payload, successMessage, toastId) => {
    setSaving(true);
    try {
      await api.post('/api/welcome/channel', payload);
      await dashboard.loadDashboard(true);
      dashboard.showToast('success', successMessage, toastId);
    } catch (error) {
      dashboard.handleError(error, 'Unable to update the welcome settings.');
    } finally {
      setSaving(false);
    }
  };

  const toggleWelcome = async () => {
    setSaving(true);
    try {
      await api.post('/api/welcome/toggle', { enabled: !dashboard.welcome.enabled });
      await dashboard.loadDashboard(true);
      dashboard.showToast('success', dashboard.welcome.enabled ? 'Welcome flow disabled.' : 'Welcome flow enabled.', 'welcome-toggle');
    } catch (error) {
      dashboard.handleError(error, 'Unable to toggle the welcome flow.');
    } finally {
      setSaving(false);
    }
  };

  const sendPreview = async () => {
    setSaving(true);
    try {
      await api.post('/api/welcome/preview', { channel_id: dashboard.welcome.channel_id });
      dashboard.showToast('success', 'Welcome preview queued.', 'welcome-preview');
    } catch (error) {
      dashboard.handleError(error, 'Unable to queue the welcome preview.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Welcome"
        title="Welcome Panel"
        description="Choose the welcome channel, preview the greeting, and keep the first impression clean and consistent."
      />

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>Welcome Controls</CardTitle>
            <CardDescription>Manage the welcome flow and send a preview through the bot.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="surface-soft flex items-center justify-between rounded-[24px] p-5">
              <div>
                <p className="text-sm font-semibold text-[var(--text-main)]">Welcome Flow</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Status for new member greetings.</p>
              </div>
              <Badge variant={dashboard.welcome.enabled ? 'success' : 'danger'}>
                {dashboard.welcome.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>

            <Button variant="secondary" className="w-full justify-between" onClick={() => setPickerOpen(true)}>
              {channelName}
              <span className="text-xs text-[var(--text-muted)]">Choose channel</span>
            </Button>

            <div className="flex flex-wrap gap-3">
              <Button loading={saving} onClick={toggleWelcome}>
                {dashboard.welcome.enabled ? 'Disable' : 'Enable'}
              </Button>
              <Button variant="secondary" loading={saving} onClick={sendPreview}>
                <Send className="h-4 w-4" />
                Send Preview
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="surface-highlight overflow-hidden">
          <div className="border-b border-[var(--border)] px-6 py-5">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Discord Preview</p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--text-main)]">Welcome Message</h3>
          </div>
          <CardContent className="space-y-5 p-6">
            <div className="rounded-[24px] border border-[var(--border)] bg-[var(--bg-soft)] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#5865F2] text-sm font-bold text-white">
                  IB
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-main)]">IND Blades</p>
                  <p className="text-sm text-[var(--text-muted)]">Today at 7:00 PM</p>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-[20px] border border-[var(--border)]">
                <div className="h-32 bg-[linear-gradient(135deg,#315efb,#7aa2ff_55%,#b6cbff)]" />
                <div className="border-t border-[var(--border)] bg-[var(--card-bg)] px-5 py-5">
                  <div className="flex items-center gap-2 text-[var(--primary)]">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-sm font-semibold">Welcome to IND Blades</span>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-[var(--text-main)]">
                    Hello warrior, welcome to the IND Blades family. Read the rules, check the main channels, and get ready to move with the clan.
                  </p>
                  <div className="mt-5 rounded-[18px] border border-[var(--border)] bg-[var(--bg-soft)] px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                      <ImageIcon className="h-4 w-4" />
                      Banner or GIF preview area
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="surface-soft rounded-[24px] p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Preview Channel</p>
              <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">{channelName}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <SearchPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Choose Welcome Channel"
        description="Search and choose the Discord channel used for welcome messages."
        items={dashboard.channels.map((item) => ({ id: item.id, label: item.name, description: `Channel ID ${item.id}` }))}
        selectedIds={dashboard.welcome.channel_id ? [String(dashboard.welcome.channel_id)] : []}
        onConfirm={(ids) => updateWelcome({ channel_id: ids[0] || null }, 'Welcome channel updated.', 'welcome-channel')}
        placeholder="Search channels"
      />
    </div>
  );
}
