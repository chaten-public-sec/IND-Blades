import { useState, useEffect } from 'react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { SelectField } from '../components/ui/select';

export default function AutoRolePage() {
  const { autorole, setAutorole, strikeConfig, setStrikeConfig, roles, showToast, handleError } = useDashboardContext();
  const [joinRoleId, setJoinRoleId] = useState(autorole.join_role_id || '');
  const [bindings, setBindings] = useState(autorole.bindings || []);
  const [strikeMapping, setStrikeMapping] = useState(autorole.strike_mapping || {});
  const [expiryDays, setExpiryDays] = useState(strikeConfig.expiry_days || 7);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setJoinRoleId(autorole.join_role_id || '');
    setBindings(autorole.bindings || []);
    setStrikeMapping(autorole.strike_mapping || {});
    setExpiryDays(strikeConfig.expiry_days || 7);
  }, [autorole, strikeConfig]);

  const addBinding = () => setBindings((b) => [...b, { role_a: '', role_b: '' }]);

  const updateBinding = (index, field, value) => {
    setBindings((b) => b.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const removeBinding = (index) => {
    setBindings((b) => b.filter((_, i) => i !== index));
  };

  const updateStrikeMapping = (count, roleId) => {
    setStrikeMapping(prev => ({ ...prev, [count]: roleId }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const cleanBindings = bindings.filter((b) => b.role_a && b.role_b);
      
      const [autoroleRes, strikeRes] = await Promise.all([
        api.post('/api/autorole', {
          join_role_id: joinRoleId || null,
          bindings: cleanBindings,
          strike_mapping: strikeMapping,
        }),
        api.post('/api/strikes/config', {
          expiry_days: Number(expiryDays),
        })
      ]);

      setAutorole(autoroleRes.data?.config || {});
      setStrikeConfig(strikeRes.data?.config || { expiry_days: 7 });
      showToast('Auto role and strike settings saved.');
    } catch (err) { handleError(err, 'Failed to save.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-8 animate-[fadeIn_0.3s_ease]">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Auto Role & Discipline</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Automatically manage roles and strikes.</p>
        </div>
        <Button onClick={save} loading={saving}>Save All Settings</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          {/* Join Role */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-1 font-semibold">Role on Join</h3>
              <p className="mb-4 text-sm text-[var(--text-muted)]">Assign this role when a new member joins.</p>
              <SelectField value={joinRoleId} onChange={(e) => setJoinRoleId(e.target.value)}>
                <option value="">None</option>
                {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
              </SelectField>
            </CardContent>
          </Card>

          {/* Strike Config */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-1 font-semibold">Strike Expiry</h3>
              <p className="mb-4 text-sm text-[var(--text-muted)]">How many days until a strike expires automatically.</p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                  className="surface-soft h-11 w-24 rounded-2xl px-4 text-sm text-[var(--text-main)] transition focus:border-cyan-300/30"
                />
                <span className="text-sm text-[var(--text-muted)]">Days</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          {/* Strike Role Mapping */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-1 font-semibold">Strike Role Mapping</h3>
              <p className="mb-4 text-sm text-[var(--text-muted)]">Assign specific roles based on total active strikes.</p>
              <div className="space-y-4">
                {[1, 2, 3].map(count => (
                  <div key={count} className="flex items-center gap-4">
                    <div className="w-24 text-sm font-bold text-red-400">{count} Strike{count > 1 ? 's' : ''}</div>
                    <div className="flex-1">
                      <SelectField value={strikeMapping[count] || ''} onChange={(e) => updateStrikeMapping(count, e.target.value)}>
                        <option value="">No Role</option>
                        {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
                      </SelectField>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bindings */}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Role Bindings</h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">When a member gets Role A, automatically assign Role B.</p>
            </div>
            <Button variant="outline" size="sm" onClick={addBinding}>+ Add</Button>
          </div>

          {bindings.length > 0 ? (
            <div className="space-y-3">
              {bindings.map((binding, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1">
                    <SelectField value={binding.role_a} onChange={(e) => updateBinding(i, 'role_a', e.target.value)}>
                      <option value="" disabled>Role A (trigger)</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
                    </SelectField>
                  </div>
                  <span className="text-sm text-[var(--text-muted)]">→</span>
                  <div className="flex-1">
                    <SelectField value={binding.role_b} onChange={(e) => updateBinding(i, 'role_b', e.target.value)}>
                      <option value="" disabled>Role B (assign)</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
                    </SelectField>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeBinding(i)}>✕</Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">No bindings configured. Click "Add" to create one.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
