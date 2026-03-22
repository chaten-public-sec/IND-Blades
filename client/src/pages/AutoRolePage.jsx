import { useState, useEffect } from 'react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { SelectField } from '../components/ui/select';

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
      const r = await api.post('/api/autorole', {
        join_role_id: joinRoleId || null,
        bindings: cleanBindings,
      });
      setAutorole(r.data?.config || {});
      showToast('Auto role settings saved.');
    } catch (err) { handleError(err, 'Failed to save.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-8 animate-[fadeIn_0.3s_ease]">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Auto Role</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Automatically assign roles to members.</p>
      </div>

      {/* Join Role */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="mb-1 font-semibold">Role on Join</h3>
          <p className="mb-4 text-sm text-[var(--text-muted)]">Automatically assign this role when a new member joins the server.</p>
          <div className="max-w-sm">
            <SelectField value={joinRoleId} onChange={(e) => setJoinRoleId(e.target.value)}>
              <option value="">None</option>
              {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
            </SelectField>
          </div>
        </CardContent>
      </Card>

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

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>Save Settings</Button>
      </div>
    </div>
  );
}
