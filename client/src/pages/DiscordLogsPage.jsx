import { useState, useEffect, useMemo } from 'react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { SelectField } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '../components/ui/dialog';
import { Plus, ListFilter, Trash2, Edit3, Shield, Mic, MessageSquare, Save, Settings2 } from 'lucide-react';

const LOG_TYPES = [
  { id: 'ban', label: 'Bans', category: 'Moderation', icon: Shield },
  { id: 'unban', label: 'Unbans', category: 'Moderation', icon: Shield },
  { id: 'kick', label: 'Kicks', category: 'Moderation', icon: Shield },
  { id: 'timeout', label: 'Timeouts', category: 'Moderation', icon: Shield },
  { id: 'join', label: 'VC Join', category: 'Voice', icon: Mic },
  { id: 'leave', label: 'VC Leave', category: 'Voice', icon: Mic },
  { id: 'move', label: 'VC Move', category: 'Voice', icon: Mic },
  { id: 'mute', label: 'VC Mute', category: 'Voice', icon: Mic },
  { id: 'deafen', label: 'VC Deafen', category: 'Voice', icon: Mic },
  { id: 'delete', label: 'Msg Delete', category: 'Message', icon: MessageSquare },
  { id: 'edit', label: 'Msg Edit', category: 'Message', icon: MessageSquare },
];

export default function DiscordLogsPage() {
  const { channels, showToast, handleError } = useDashboardContext();
  const [enabled, setEnabled] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    enabled: true,
    logs: [],
    channel_id: ''
  });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const r = await api.get('/api/discord-logs');
        setEnabled(Boolean(r.data?.enabled));
        setCategories(Array.isArray(r.data?.categories) ? r.data.categories : []);
      } catch (err) {
        handleError(err, 'Failed to load log settings.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [handleError]);

  const saveConfig = async (nextEnabled = enabled, nextCategories = categories) => {
    setSaving(true);
    try {
      await api.post('/api/discord-logs', {
        enabled: nextEnabled,
        categories: nextCategories
      });
      showToast('success', 'Log settings updated', 'discord-logs-sync');
    } catch (err) {
      handleError(err, 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setEditingIdx(null);
    setFormData({ name: '', enabled: true, logs: [], channel_id: '' });
    setFormErrors({});
    setDialogOpen(true);
  };

  const openEdit = (idx) => {
    const cat = categories[idx];
    setEditingIdx(idx);
    setFormData({ ...cat });
    setFormErrors({});
    setDialogOpen(true);
  };

  const validate = () => {
    const e = {};
    if (!formData.name.trim()) e.name = 'Name is required';
    if (formData.logs.length === 0) e.logs = 'Select at least one log type';
    if (!formData.channel_id) e.channel = 'Select a destination channel';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSaveCategory = () => {
    if (!validate()) return;

    let next;
    if (editingIdx !== null) {
      next = [...categories];
      next[editingIdx] = formData;
    } else {
      next = [...categories, formData];
    }

    setCategories(next);
    saveConfig(enabled, next);
    setDialogOpen(false);
  };

  const handleDelete = (idx) => {
    const next = categories.filter((_, i) => i !== idx);
    setCategories(next);
    saveConfig(enabled, next);
  };

  const toggleMaster = (v) => {
    setEnabled(v);
    saveConfig(v, categories);
  };

  const toggleCategoryEnabled = (idx, v) => {
    const next = [...categories];
    next[idx].enabled = v;
    setCategories(next);
    saveConfig(enabled, next);
  };

  const toggleLogType = (id) => {
    setFormData(prev => {
      const nextLogs = prev.logs.includes(id)
        ? prev.logs.filter(l => l !== id)
        : [...prev.logs, id];
      return { ...prev, logs: nextLogs };
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500/20 border-t-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-[fadeIn_0.3s_ease]">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-black text-[var(--text-main)] tracking-tight">Advanced Logs</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)] font-medium">Create multi-channel logging filters for specific server events.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 surface-soft rounded-2xl px-4 h-12 border border-white/5">
             <Label className="text-xs font-bold uppercase tracking-widest opacity-70">Master Engine</Label>
             <Switch checked={enabled} onCheckedChange={toggleMaster} />
          </div>
          <Button onClick={openCreate} className="h-12 px-6 gap-2 shadow-xl shadow-cyan-500/10">
            <Plus className="h-5 w-5" />
            Create Category
          </Button>
        </div>
      </div>

      {!enabled && (
        <Card className="border-amber-500/20 bg-amber-500/[0.02]">
          <CardContent className="py-12 text-center">
             <Settings2 className="h-12 w-12 text-amber-500/50 mx-auto mb-4" />
             <h3 className="text-lg font-bold text-amber-200">Logging Engine Paused</h3>
             <p className="text-sm text-amber-500/60 mt-1">Enable the Master Engine above to resume event processing.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {categories.map((cat, idx) => (
          <Card key={idx} className={`group relative overflow-hidden transition-all hover:border-cyan-500/30 ${!cat.enabled ? 'opacity-60 grayscale-[0.5]' : ''}`}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-[var(--text-main)]">{cat.name}</h3>
                  <div className="flex items-center gap-2 text-xs font-medium text-cyan-400">
                    <ListFilter className="h-3.5 w-3.5" />
                    <span>#{channels.find(c => c.id === cat.channel_id)?.name || 'Unknown Channel'}</span>
                  </div>
                </div>
                <Switch checked={cat.enabled} onCheckedChange={(v) => toggleCategoryEnabled(idx, v)} />
              </div>

              <div className="flex flex-wrap gap-1.5 mb-6">
                 {cat.logs.map(logId => {
                   const logType = LOG_TYPES.find(lt => lt.id === logId);
                   return (
                     <Badge key={logId} variant="secondary" className="px-2 py-0.5 text-[10px] bg-white/5 border-white/5">
                       {logType?.label || logId}
                     </Badge>
                   );
                 })}
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-white/5">
                <Button size="sm" variant="ghost" onClick={() => openEdit(idx)} className="h-9 gap-2 flex-1 hover:bg-cyan-500/10 hover:text-cyan-400">
                  <Edit3 className="h-4 w-4" />
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(idx)} className="h-9 w-9 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {categories.length === 0 && (
          <div className="md:col-span-2 border-2 border-dashed border-white/5 rounded-3xl py-24 text-center">
             <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/3 border border-white/5 mb-4 mb-4">
                <ListFilter className="h-8 w-8 text-[var(--text-muted)]" />
             </div>
             <h3 className="text-xl font-bold text-[var(--text-main)]">No Log Categories</h3>
             <p className="text-sm text-[var(--text-muted)] mt-2">Create your first advanced logging filter to monitor server activity.</p>
             <Button onClick={openCreate} variant="ghost" className="mt-6 border border-white/10 hover:bg-white/5">Get Started</Button>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[min(96vw,600px)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingIdx !== null ? 'Edit Log Category' : 'Create Log Category'}</DialogTitle>
            <DialogDescription>Define what events to log and where they should be sent.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className={`text-[10px] font-bold uppercase tracking-widest ${formErrors.name ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>Category Name</Label>
                <input
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., Critical Moderation"
                  className={`surface-soft h-12 w-full rounded-2xl px-4 text-sm text-[var(--text-main)] focus:border-cyan-500/30 outline-none transition-all ${formErrors.name ? 'border-red-500/50 bg-red-500/5' : ''}`}
                />
                {formErrors.name && <p className="text-[10px] font-medium text-red-400">{formErrors.name}</p>}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className={`text-[10px] font-bold uppercase tracking-widest ${formErrors.logs ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>Select Event Types</Label>
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">{formData.logs.length} selected</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {LOG_TYPES.map(type => (
                    <button
                      key={type.id}
                      onClick={() => toggleLogType(type.id)}
                      className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all ${
                        formData.logs.includes(type.id)
                          ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
                          : 'border-white/5 bg-white/3 text-[var(--text-muted)] hover:bg-white/5'
                      }`}
                    >
                      <type.icon className="h-4 w-4" />
                      <div>
                        <p className="text-[11px] font-bold leading-none">{type.label}</p>
                        <p className="mt-1 text-[9px] font-medium opacity-50">{type.category}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {formErrors.logs && <p className="text-[10px] font-medium text-red-400">{formErrors.logs}</p>}
              </div>

              <div className="space-y-2">
                <Label className={`text-[10px] font-bold uppercase tracking-widest ${formErrors.channel ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>Log Channel</Label>
                <SelectField
                  value={formData.channel_id}
                  onChange={(e) => setFormData(p => ({ ...p, channel_id: e.target.value }))}
                  className={formErrors.channel ? 'border-red-500/50 bg-red-500/5' : ''}
                >
                  <option value="">Select a channel...</option>
                  {(channels || []).map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                </SelectField>
                {formErrors.channel && <p className="text-[10px] font-medium text-red-400">{formErrors.channel}</p>}
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
             <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
             <Button onClick={handleSaveCategory} loading={saving}>
               <Save className="h-4 w-4 mr-2" />
               {editingIdx !== null ? 'Update Category' : 'Create Category'}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
