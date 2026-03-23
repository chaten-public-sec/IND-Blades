import { useState, useEffect } from 'react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { SelectField } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';

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
    setConfig((c) => {
      const nextCat = { ...(c.categories[catId] || {}), [field]: value };
      // Auto-enable if channel is selected, or vice-versa logic if needed
      return {
        ...c,
        categories: { ...c.categories, [catId]: nextCat },
      };
    });
  };

  const validate = () => {
    if (!config.enabled) return true;
    for (const catId of CATEGORIES.map(c => c.id)) {
      const cat = config.categories[catId];
      if (cat?.enabled && !cat?.channel_id) {
        showToast(`Please select a channel for ${catId} logs.`, 'error');
        return false;
      }
    }
    return true;
  };

  const save = async () => {
    if (!validate()) return;
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
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Label htmlFor="master-toggle" className="text-sm font-medium text-[var(--text-muted)] cursor-pointer">
              {config.enabled ? 'System Enabled' : 'System Disabled'}
            </Label>
            <Switch 
              id="master-toggle"
              checked={config.enabled} 
              onCheckedChange={updateEnabled} 
            />
          </div>
          <Button onClick={save} loading={saving}>
            Save Configuration
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
            <Card key={cat.id} className={!config.categories[cat.id]?.enabled ? 'opacity-70' : ''}>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 space-y-1">
                    <h3 className="text-lg font-semibold text-[var(--text-main)]">{cat.label}</h3>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">{cat.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-3 sm:w-64">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${config.categories[cat.id]?.enabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {config.categories[cat.id]?.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <Switch 
                        checked={config.categories[cat.id]?.enabled || false}
                        onCheckedChange={(v) => updateCategory(cat.id, 'enabled', v)}
                      />
                    </div>
                    
                    <div className="w-full">
                      <Label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Target Channel</Label>
                      <SelectField
                        value={config.categories[cat.id]?.channel_id || ''}
                        onChange={(e) => updateCategory(cat.id, 'channel_id', e.target.value)}
                        disabled={!config.categories[cat.id]?.enabled}
                        className={!config.categories[cat.id]?.channel_id && config.categories[cat.id]?.enabled ? 'border-red-500/50' : ''}
                      >
                        <option value="">Select channel</option>
                        {(channels || []).map((c) => (
                          <option key={c.id} value={c.id}>
                            #{c.name}
                          </option>
                        ))}
                      </SelectField>
                      {!config.categories[cat.id]?.channel_id && config.categories[cat.id]?.enabled && (
                        <p className="mt-1 text-[10px] whitespace-nowrap font-medium text-red-400">Please select a channel</p>
                      )}
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
