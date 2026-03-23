import { useState, useEffect } from 'react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { SelectField } from '../components/ui/select';

const CATEGORIES = [
  { id: 'moderation', label: 'Moderation Logs', description: 'Kicks, bans, role updates, timeouts' },
  { id: 'voice', label: 'Voice Logs', description: 'Join, leave, move, mute/deafen' },
  { id: 'message', label: 'Message Logs', description: 'Message delete, edit' },
];

export default function DiscordLogsPage() {
  const { channels, showToast, handleError } = useDashboardContext();
  const [config, setConfig] = useState({
    enabled: false,
    categories: {
      moderation: { enabled: false, channel_id: '' },
      voice: { enabled: false, channel_id: '' },
      message: { enabled: false, channel_id: '' },
    },
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await api.get('/api/discord-logs');
        const d = r.data || {};
        setConfig({
          enabled: Boolean(d.enabled),
          categories: {
            moderation: { enabled: Boolean(d.categories?.moderation?.enabled), channel_id: d.categories?.moderation?.channel_id || '' },
            voice: { enabled: Boolean(d.categories?.voice?.enabled), channel_id: d.categories?.voice?.channel_id || '' },
            message: { enabled: Boolean(d.categories?.message?.enabled), channel_id: d.categories?.message?.channel_id || '' },
          },
        });
      } catch (err) {
        handleError(err, 'Failed to load Discord log settings.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [handleError]);

  const updateEnabled = (v) => setConfig((c) => ({ ...c, enabled: v }));

  const updateCategory = (catId, field, value) => {
    setConfig((c) => ({
      ...c,
      categories: {
        ...c.categories,
        [catId]: { ...(c.categories[catId] || {}), [field]: value },
      },
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.post('/api/discord-logs', {
        enabled: config.enabled,
        categories: Object.fromEntries(
          Object.entries(config.categories).map(([k, v]) => [
            k,
            { enabled: v.enabled, channel_id: v.channel_id || null },
          ])
        ),
      });
      setConfig({
        enabled: r.data?.config?.enabled ?? config.enabled,
        categories: r.data?.config?.categories ?? config.categories,
      });
      showToast('Discord log settings saved.');
    } catch (err) {
      handleError(err, 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-[fadeIn_0.3s_ease]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">Discord Logs</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Send server events to Discord channels. Enable categories and assign channels.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-muted)]">Logging</span>
            <button
              onClick={() => updateEnabled(!config.enabled)}
              className={`relative h-7 w-12 rounded-full transition-colors ${config.enabled ? 'bg-cyan-500' : 'bg-black/20 dark:bg-white/15'}`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${config.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
              />
            </button>
          </div>
          <Button onClick={save} loading={saving}>
            Save Settings
          </Button>
        </div>
      </div>

      {!config.enabled && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-[var(--text-muted)]">Logging is off. Enable it above to configure categories.</p>
          </CardContent>
        </Card>
      )}

      {config.enabled && (
        <div className="space-y-6">
          {CATEGORIES.map((cat) => (
            <Card key={cat.id}>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-[var(--text-main)]">{cat.label}</h3>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{cat.description}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => updateCategory(cat.id, 'enabled', !config.categories[cat.id]?.enabled)}
                      className={`relative h-7 w-12 rounded-full transition-colors ${config.categories[cat.id]?.enabled ? 'bg-emerald-500' : 'bg-black/20 dark:bg-white/15'}`}
                    >
                      <span
                        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${config.categories[cat.id]?.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
                      />
                    </button>
                    <div className="w-56">
                      <SelectField
                        value={config.categories[cat.id]?.channel_id || ''}
                        onChange={(e) => updateCategory(cat.id, 'channel_id', e.target.value)}
                        disabled={!config.categories[cat.id]?.enabled}
                      >
                        <option value="">Select channel</option>
                        {(channels || []).map((c) => (
                          <option key={c.id} value={c.id}>
                            #{c.name}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
