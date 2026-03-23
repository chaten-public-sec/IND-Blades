import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { SelectField } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Shield, UserPlus, Link, Trash2, Save, Zap, Hash, ShieldCheck, ArrowRight } from 'lucide-react';

export default function AutoRolePage() {
  const { autorole, setAutorole, roles, showToast, handleError } = useDashboardContext();
  const [joinRoleId, setJoinRoleId] = useState(autorole.join_role_id || '');
  const [bindings, setBindings] = useState(autorole.bindings || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setJoinRoleId(autorole.join_role_id || '');
    setBindings(autorole.bindings || []);
  }, [autorole]);

  const addBinding = () => setBindings((b) => [...b, { role_a: '', role_b: '' }]);

  const updateBinding = (index, field, value) => {
    setBindings((b) => b.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const removeBinding = (index) => {
    setBindings((b) => b.filter((_, i) => i !== index));
  };

  const save = async () => {
    setSaving(true);
    try {
      const cleanBindings = bindings.filter((b) => b.role_a && b.role_b);
      const autoroleRes = await api.post('/api/autorole', {
        join_role_id: joinRoleId || null,
        bindings: cleanBindings,
      });

      setAutorole(autoroleRes.data?.config || {});
      showToast('Auto role settings saved.');
    } catch (err) { handleError(err, 'Failed to save.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-[var(--text-main)]">Security Automation</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)] font-medium">Auto-role provisioning and discipline escalation.</p>
        </div>
        <Button onClick={save} loading={saving} className="gap-2 h-10 px-5 shadow-lg shadow-cyan-500/10">
           <Save className="h-4 w-4" />
           Sync Configuration
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="relative overflow-hidden group">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-6">
               <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-400 group-hover:scale-110 transition-transform">
                  <UserPlus className="h-6 w-6" />
               </div>
               <div>
                  <h3 className="font-bold text-[var(--text-main)]">Role on Join</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Entry Provisioning</p>
               </div>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-6 leading-relaxed">
              Define the default role assigned to every member upon entry to the secure environment.
            </p>
            <div className="space-y-2">
               <Label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Default Rank</Label>
               <div className="relative">
                  <SelectField value={joinRoleId} onChange={(e) => setJoinRoleId(e.target.value)} className="pl-10 h-11">
                    <option value="">None (Entry Only)</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
                  </SelectField>
                  <Hash className="absolute left-3.5 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
               </div>
            </div>
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl" />
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden group border-amber-500/20">
           <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-6">
                 <div className="rounded-xl bg-amber-500/10 p-2 text-amber-400 group-hover:scale-110 transition-transform">
                    <Zap className="h-6 w-6" />
                 </div>
                 <div>
                    <h3 className="font-bold text-[var(--text-main)]">Escalation Logic</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Discipline Sync</p>
                 </div>
              </div>
              <p className="text-sm text-[var(--text-muted)] mb-6 leading-relaxed">
                 Manage advanced role bindings used for automated discipline and escalation flows.
              </p>
              <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-2">
                 <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Logic Engine Ready</span>
                 </div>
                 <Badge variant="warning" className="text-[9px] font-black">{bindings.length} ACTIVE BINDINGS</Badge>
              </div>
              <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl" />
           </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border border-white/5 bg-white/[0.02]">
        <CardContent className="p-0">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-400">
                  <Link className="h-5 w-5" />
               </div>
               <div>
                  <h3 className="font-bold text-[var(--text-main)]">Logical Role Bindings</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Dependent Mapping</p>
               </div>
            </div>
            <Button variant="ghost" size="sm" onClick={addBinding} className="h-8 gap-2 bg-white/5 border border-white/5 hover:bg-white/10 transition-all font-bold text-[10px] uppercase tracking-widest">
               <Plus className="h-3.5 w-3.5" />
               Add Logic
            </Button>
          </div>

          <div className="p-6">
            {bindings.length > 0 ? (
              <div className="space-y-4">
                {bindings.map((binding, i) => (
                  <div key={i} className="group flex flex-col gap-4 p-5 rounded-3xl bg-white/[0.03] border border-white/5 sm:flex-row sm:items-center">
                    <div className="flex-1 space-y-2">
                       <Label className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] opacity-50">Trigger Role (A)</Label>
                       <div className="relative">
                          <SelectField value={binding.role_a} onChange={(e) => updateBinding(i, 'role_a', e.target.value)} className="pl-10 h-11 border-dashed">
                            <option value="" disabled>Select trigger role...</option>
                            {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
                          </SelectField>
                          <Zap className="absolute left-3.5 top-3.5 h-4 w-4 text-amber-400" />
                       </div>
                    </div>
                    
                    <div className="flex items-center justify-center p-2 rounded-full bg-white/5">
                       <ArrowRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-cyan-400 transition-colors" />
                    </div>

                    <div className="flex-1 space-y-2">
                       <Label className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] opacity-50">Assigned Role (B)</Label>
                       <div className="relative">
                          <SelectField value={binding.role_b} onChange={(e) => updateBinding(i, 'role_b', e.target.value)} className="pl-10 h-11 border-dashed">
                            <option value="" disabled>Select provisioned role...</option>
                            {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
                          </SelectField>
                          <ShieldCheck className="h-4 w-4 absolute left-3.5 top-3.5 text-emerald-400" />
                       </div>
                    </div>

                    <Button variant="ghost" size="sm" onClick={() => removeBinding(i)} className="h-11 w-11 p-0 rounded-2xl text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all">
                       <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-white/5 rounded-3xl opacity-50">
                <Link className="h-10 w-10 mb-3 text-slate-700" />
                <p className="text-sm font-semibold">No dependency logic mapped.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
