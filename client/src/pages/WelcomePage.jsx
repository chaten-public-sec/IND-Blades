import { useState } from 'react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { SelectField } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Eye, Send } from 'lucide-react';

export default function WelcomePage() {
  const { config, setConfig, channels, showToast, handleError } = useDashboardContext();
  const [channelInput, setChannelInput] = useState(config.channel_id || '');
  const [saving, setSaving] = useState(false);

  const toggleWelcome = async () => {
    setSaving(true);
    try {
      const nextEnabled = !config.enabled;
      const r = await api.post('/api/welcome/toggle', { enabled: nextEnabled });
      setConfig(r.data?.config || {});
      showToast(nextEnabled ? 'success' : 'info', nextEnabled ? 'Welcome system enabled' : 'Welcome system disabled', 'welcome-toggle');
    } catch (err) { handleError(err, 'Failed to update system status.'); }
    finally { setSaving(false); }
  };

  const saveChannel = async () => {
    setSaving(true);
    try {
      const r = await api.post('/api/welcome/channel', { channel_id: channelInput || null });
      setConfig(r.data?.config || {});
      showToast('success', 'Welcome settings updated', 'welcome-channel');
    } catch (err) { handleError(err, 'Failed to update.'); }
    finally { setSaving(false); }
  };

  const sendPreview = async () => {
    try {
      await api.post('/api/welcome/preview');
      showToast('success', 'Preview sent to Discord', 'welcome-preview');
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
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-[var(--text-main)]">System Configuration</h3>
              <p className="text-sm text-[var(--text-muted)]">Choose where new members are greeted.</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <Label className="text-sm font-medium text-[var(--text-muted)] cursor-pointer" htmlFor="welcome-toggle">
                  {config.enabled ? 'Active' : 'Inactive'}
                </Label>
                <Switch 
                  id="welcome-toggle"
                  checked={config.enabled || false}
                  onCheckedChange={toggleWelcome}
                />
              </div>
              <Button variant="outline" onClick={sendPreview} size="sm" className="gap-2">
                <Send className="h-3.5 w-3.5" />
                Test in Discord
              </Button>
            </div>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Target Channel</Label>
              <div className="flex gap-2">
                <SelectField 
                  value={channelInput} 
                  onChange={(e) => setChannelInput(e.target.value)}
                  className={!channelInput && config.enabled ? 'border-amber-500/50' : ''}
                >
                  <option value="">System default</option>
                  {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                </SelectField>
                <Button variant="secondary" onClick={saveChannel} loading={saving}>Save</Button>
              </div>
              {!channelInput && config.enabled && (
                <p className="text-[10px] font-medium text-amber-500">Using server's global default channel.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Discord Preview - Pixel Perfect Clone */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Eye className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">Live Discord Preview</h3>
        </div>
        
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#313338] p-4 font-sans shadow-2xl transition-all hover:border-white/10 sm:p-6">
          <div className="flex gap-4">
            <div className="relative flex h-10 w-10 flex-shrink-0">
               <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5865F2] text-white text-[10px] font-bold">
                 IB
               </div>
               <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-[#23a55a] border-[3px] border-[#313338]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-[#f2f3f5] hover:underline cursor-pointer">IND Blades Bot</span>
                <span className="flex items-center gap-1 rounded bg-[#5865F2] px-1.25 py-0.25 text-[10px] font-medium text-white h-[15px]">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M9.307 11.839l-4.103-1.896a.352.352 0 00-.323.018.353.353 0 00-.174.306v6.974c0 .121.062.233.166.297l4.104 2.503a.35.35 0 00.354 0l4.103-2.503a.353.353 0 00.167-.297v-6.974a.352.352 0 00-.175-.306.355.355 0 00-.323-.018l-4.103 1.896zm0-5.748l-4.103-2.203a.352.352 0 00-.339 0l-4.104 2.203a.352.352 0 000 .611l4.104 2.204a.352.352 0 00.339 0l4.103-2.204a.352.352 0 000-.611zm8.216 5.755l-4.103-1.896a.352.352 0 00-.323.018.353.353 0 00-.174.306v6.974c0 .121.062.233.166.297l4.104 2.503a.35.35 0 00.354 0l4.103-2.503a.353.353 0 00.167-.297v-6.974a.352.352 0 00-.175-.306.355.355 0 00-.323-.018l-4.103 1.896z" /></svg>
                  BOT
                </span>
                <span className="text-[11px] font-medium text-[#b5bac1]">Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              <div className="mt-2.5 overflow-hidden rounded-[4px] bg-[#2b2d31] shadow-sm max-w-[432px] group" style={{ borderLeft: '4px solid #51a7ff' }}>
                <div className="flex flex-col gap-0">
                  <div className="flex gap-4 p-4 items-start">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="text-[15px] text-[#dbdee1] leading-[1.375rem] whitespace-pre-wrap font-sans">
                        ✨ Welcome <span className="text-[#e9f5ff] bg-[#5865f2]/30 px-0.5 rounded cursor-pointer hover:bg-[#5865f2] hover:text-white transition-colors">@NewMember</span> to the IND Blades Family! ✨

We're thrilled to have you here. Please verify yourself, grab your roles, and dive into the voice chats!

Let's make some amazing memories! ⚡
                      </div>
                      
                      <div className="text-[13px] text-[#dbdee1] flex flex-col gap-1">
                         <span className="font-bold">Member #777</span>
                         <span className="text-[#b5bac1] font-normal leading-relaxed text-[12px]">IND Blades • Premium Entry</span>
                      </div>
                    </div>
                    
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-white/5">
                      <div className="flex h-full w-full items-center justify-center bg-[#5865F2]/20 text-2xl">👤</div>
                    </div>
                  </div>
                  
                  <div className="px-4 pb-4">
                     <div className="relative aspect-[16/6] overflow-hidden rounded-md border border-white/5">
                        <img 
                          src="https://media.discordapp.net/attachments/1083400000000000000/1083400000000000000/welcome.gif" 
                          alt="Welcome Banner"
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.target.src = "https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJmZzI1ZzI5aHh5Nnh5Nnh5Nnh5Nnh5Nnh5Nnh5Nnh5Nnh5JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKVUn7iM8FMEU24/giphy.gif";
                          }}
                        />
                     </div>
                  </div>

                  <div className="px-4 pb-3 flex items-center gap-2">
                     <div className="h-5 w-5 rounded-full bg-[#5865F2] flex items-center justify-center text-[8px] font-bold text-white">IB</div>
                     <span className="text-[11px] font-medium text-[#f2f3f5] hover:underline cursor-pointer">IND Blades</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
