import { useState, useMemo, useCallback, useEffect } from 'react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { SelectField } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '../components/ui/dialog';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '../components/ui/table';
import { Label } from '../components/ui/label';
import { Gavel, Shield, AlertTriangle, Users, Search, Trash2, History, Clock, MapPin, Calendar, ExternalLink } from 'lucide-react';

function formatDate(v) {
  if (!v) return 'N/A';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleString();
}

function getTimeLeft(expiresAt) {
  if (!expiresAt) return '—';
  const diff = new Date(expiresAt) - new Date();
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${mins}m`;
}

const PAGE_SIZE = 15;

export default function StrikePage() {
  const { roster, roles, strikeConfig, setStrikeConfig, showToast, handleError } = useDashboardContext();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  // Add Strike Dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addReason, setAddReason] = useState('');
  const [addErrors, setAddErrors] = useState({});
  const [addSaving, setAddSaving] = useState(false);

  // Remove Strike Confirmation
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null); 
  const [removeSaving, setRemoveSaving] = useState(false);

  // User Detail Dialog
  const [detailUser, setDetailUser] = useState(null);

  const [expiryDays, setExpiryDays] = useState(strikeConfig.expiry_days ?? 7);
  const [strikeMapping, setStrikeMapping] = useState(strikeConfig.strike_mapping ?? {});
  const [configSaving, setConfigSaving] = useState(false);

  useEffect(() => {
    setExpiryDays(strikeConfig.expiry_days ?? 7);
    setStrikeMapping(strikeConfig.strike_mapping ?? {});
  }, [strikeConfig]);

  const updateStrikeMapping = (count, roleId) => setStrikeMapping((p) => ({ ...p, [count]: roleId }));

  const saveConfig = async () => {
    setConfigSaving(true);
    try {
      const r = await api.post('/api/strikes/config', {
        expiry_days: Number(expiryDays),
        strike_mapping: strikeMapping,
      });
      setStrikeConfig(r.data?.config || strikeConfig);
      showToast('Strike configuration saved.', 'success');
    } catch (err) { handleError(err, 'Failed to save configuration.'); }
    finally { setConfigSaving(false); }
  };

  const usersWithStrikes = useMemo(() => {
    return roster
      .filter(u => (u.strike_count || 0) > 0 || (u.strikes && u.strikes.length > 0))
      .sort((a, b) => (b.strike_count || 0) - (a.strike_count || 0));
  }, [roster]);

  const filtered = useMemo(() => {
    if (!search.trim()) return usersWithStrikes;
    const q = search.toLowerCase();
    return usersWithStrikes.filter(u =>
      `${u.name || ''} ${u.username || ''} ${u.id}`.toLowerCase().includes(q)
    );
  }, [usersWithStrikes, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const validateStrike = () => {
    const e = {};
    if (!addUserId) e.user = 'Select a recipient';
    if (!addReason.trim()) e.reason = 'Mention the violation reason';
    setAddErrors(e);
    return Object.keys(e).length === 0;
  };

  const addStrike = useCallback(async () => {
    if (!validateStrike()) return;
    setAddSaving(true);
    try {
      await api.post('/api/strikes/add', { user_id: addUserId, reason: addReason.trim() });
      showToast('Strike issued successfully.', 'success');
      setAddOpen(false);
      setAddUserId('');
      setAddReason('');
    } catch (err) { handleError(err, 'Failed to issue strike.'); }
    finally { setAddSaving(false); }
  }, [addUserId, addReason, showToast, handleError]);

  const confirmRemove = useCallback(async () => {
    if (!removeTarget) return;
    setRemoveSaving(true);
    try {
      await api.post('/api/strikes/remove', { user_id: removeTarget.userId, index: removeTarget.index });
      showToast('Strike removed.', 'info');
      setRemoveOpen(false);
      setRemoveTarget(null);
      if (detailUser && detailUser.id === removeTarget.userId) {
        const updated = roster.find(u => u.id === removeTarget.userId);
        if (updated) setDetailUser(updated);
      }
    } catch (err) { handleError(err, 'Failed to remove strike.'); }
    finally { setRemoveSaving(false); }
  }, [removeTarget, showToast, handleError, detailUser, roster]);

  const openRemoveDialog = (userId, index, reason) => {
    setRemoveTarget({ userId, index, reason });
    setRemoveOpen(true);
  };

  const getUserName = (id) => {
    const u = roster.find(r => r.id === id);
    return u ? (u.name || u.username || `User ${id.slice(-4)}`) : `User ${id.slice(-4)}`;
  };

  const currentDetailUser = detailUser ? roster.find(u => u.id === detailUser.id) || detailUser : null;
  const userRoleIds = new Set(currentDetailUser?.roles || []);
  const userRoles = roles.filter(r => userRoleIds.has(r.id));

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">Strike Management</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {usersWithStrikes.length} user{usersWithStrikes.length !== 1 ? 's' : ''} with active strikes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
             <input
               placeholder="Filter by name or ID..."
               value={search}
               onChange={(e) => { setSearch(e.target.value); setPage(0); }}
               className="surface-soft h-11 w-full rounded-2xl pl-10 pr-4 text-sm text-[var(--text-main)] transition focus:border-cyan-300/30 sm:w-64"
             />
             <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
          </div>
          <Button onClick={() => setAddOpen(true)} className="gap-2 shadow-lg shadow-red-500/10">
             <Gavel className="h-4 w-4" />
             Issue Strike
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-8 lg:flex-row">
            <div className="space-y-4 lg:w-1/3">
              <div className="flex items-center gap-2">
                 <Clock className="h-4 w-4 text-cyan-400" />
                 <h3 className="font-semibold text-[var(--text-main)]">Strike Expiry</h3>
              </div>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                Configure how long a strike remains active before it is automatically forgiven.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(Number(e.target.value))}
                  className="surface-soft h-11 w-24 rounded-2xl px-4 text-sm text-[var(--text-main)] focus:border-cyan-300/30 transition-all font-mono"
                />
                <span className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-widest">Days</span>
              </div>
            </div>

            <div className="hidden lg:block w-px bg-white/5 self-stretch" />

            <div className="flex-1 space-y-4">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-rose-400" />
                    <h3 className="font-semibold text-[var(--text-main)]">Role Mapping Escalation</h3>
                 </div>
                 <Button onClick={saveConfig} loading={configSaving} size="sm" className="h-8">Save Changes</Button>
              </div>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                Automatically assign restrictive roles based on strike counts. Roles stack as strikes increase.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {[1, 2, 3].map((count) => (
                  <div key={count} className="space-y-2 rounded-2xl bg-white/3 border border-white/5 p-3">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                       {count} Strike{count > 1 ? 's' : ''} Target
                    </Label>
                    <SelectField value={strikeMapping[count] || ''} onChange={(e) => updateStrikeMapping(count, e.target.value)}>
                      <option value="">No Role</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>@{r.name}</option>
                      ))}
                    </SelectField>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="overflow-hidden border-rose-500/20 shadow-lg shadow-red-500/5">
          <CardContent className="pt-6 text-center">
            <div className="flex justify-center mb-2"><Users className="h-5 w-5 text-rose-400 opacity-50" /></div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Flagged Users</p>
            <p className="mt-1 text-4xl font-black text-rose-500">{usersWithStrikes.length}</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-amber-500/20 shadow-lg shadow-amber-500/5">
          <CardContent className="pt-6 text-center">
            <div className="flex justify-center mb-2"><Gavel className="h-5 w-5 text-amber-400 opacity-50" /></div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Active Strikes</p>
            <p className="mt-1 text-4xl font-black text-amber-500">
               {usersWithStrikes.reduce((sum, u) => sum + (u.strike_count || 0), 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-cyan-500/20 shadow-lg shadow-cyan-500/5">
          <CardContent className="pt-6 text-center">
            <div className="flex justify-center mb-2"><MapPin className="h-5 w-5 text-cyan-400 opacity-50" /></div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Total Reach</p>
            <p className="mt-1 text-4xl font-black text-cyan-100">{roster.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Member</TableHeaderCell>
                <TableHeaderCell>Strikes</TableHeaderCell>
                <TableHeaderCell>Last Reason</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell className="text-right">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageItems.map(user => {
                const lastStrike = user.strikes && user.strikes.length > 0 ? user.strikes[user.strikes.length - 1] : null;
                return (
                  <TableRow key={user.id} className="cursor-pointer group" onClick={() => setDetailUser(user)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-bold border border-white/5 overflow-hidden">
                           {(user.name || user.username || 'U').charAt(0).toUpperCase()}
                           <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-transparent" />
                        </div>
                        <div>
                          <p className="font-bold text-[var(--text-main)] group-hover:text-cyan-400 transition-colors">{user.name || user.username}</p>
                          <p className="text-[10px] font-mono text-[var(--text-muted)]">{user.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.strike_count >= 3 ? 'danger' : user.strike_count >= 2 ? 'warning' : 'default'} className="px-3 shrink-0">
                        {user.strike_count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate font-medium text-[var(--text-muted)]">
                       {lastStrike?.reason || '—'}
                    </TableCell>
                    <TableCell>
                       <div className="flex flex-col gap-0.5">
                          <span className={`text-[11px] font-bold ${getTimeLeft(lastStrike?.expires_at) === 'Expired' ? 'text-red-400' : 'text-emerald-400'}`}>
                             {lastStrike ? getTimeLeft(lastStrike.expires_at) : '—'}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)]">Until Forgiveness</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-2 text-[var(--text-main)]">
                         <Button size="sm" variant="ghost" onClick={() => setDetailUser(user)} className="h-8 w-8 p-0">
                           <ExternalLink className="h-4 w-4" />
                         </Button>
                         <Button
                           size="sm"
                           variant="ghost"
                           className="h-8 w-8 p-0 text-red-500/70 hover:text-red-500 hover:bg-red-500/10"
                           onClick={() => {
                             if (user.strikes?.length > 0) {
                               openRemoveDialog(user.id, user.strikes.length - 1, user.strikes[user.strikes.length - 1].reason);
                             }
                           }}
                           disabled={!user.strikes || user.strikes.length === 0}
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {pageItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-[var(--text-muted)]">
                    {search ? 'No matching users with strikes.' : 'No users with active strikes.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button size="sm" variant="ghost" disabled={currentPage === 0} onClick={() => setPage(p => p - 1)}>← Prev</Button>
          <span className="text-sm text-[var(--text-muted)] font-medium">Page {currentPage + 1} of {totalPages}</span>
          <Button size="sm" variant="ghost" disabled={currentPage >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</Button>
        </div>
      )}

      {/* Issuance Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Strike</DialogTitle>
            <DialogDescription>Apply a strike record to a server member.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className={`text-[10px] font-bold uppercase tracking-widest ${addErrors.user ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>Target Member</Label>
                <div className="relative">
                   <select
                     value={addUserId}
                     onChange={(e) => { setAddUserId(e.target.value); setAddErrors(p => ({ ...p, user: '' })); }}
                     className={`surface-soft h-12 w-full rounded-2xl pl-11 pr-4 text-sm text-[var(--text-main)] appearance-none outline-none transition-all ${addErrors.user ? 'border-red-500/50 bg-red-500/5' : 'focus:border-cyan-500/30'}`}
                   >
                     <option value="" disabled>Search or select member...</option>
                     {roster.map(u => (
                       <option key={u.id} value={u.id}>
                         {u.name || u.username} {u.strike_count ? `(${u.strike_count} active)` : ''}
                       </option>
                     ))}
                   </select>
                   <Users className={`absolute left-4 top-3.5 h-5 w-5 ${addErrors.user ? 'text-red-400' : 'text-[var(--text-muted)]'}`} />
                </div>
                {addErrors.user && <p className="text-[10px] font-medium text-red-400">{addErrors.user}</p>}
              </div>
              
              <div className="space-y-2">
                <Label className={`text-[10px] font-bold uppercase tracking-widest ${addErrors.reason ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>Violation Reason</Label>
                <div className="relative">
                  <input
                    value={addReason}
                    onChange={(e) => { setAddReason(e.target.value); setAddErrors(p => ({ ...p, reason: '' })); }}
                    placeholder="Describe the incident (e.g. Missed Event)"
                    className={`surface-soft h-12 w-full rounded-2xl pl-11 pr-4 text-sm text-[var(--text-main)] transition-all outline-none ${addErrors.reason ? 'border-red-500/50 bg-red-500/5' : 'focus:border-cyan-500/30'}`}
                  />
                  <AlertTriangle className={`absolute left-4 top-3.5 h-5 w-5 ${addErrors.reason ? 'text-red-400' : 'text-[var(--text-muted)]'}`} />
                </div>
                {addErrors.reason && <p className="text-[10px] font-medium text-red-400">{addErrors.reason}</p>}
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addStrike} loading={addSaving}>Confirm Issue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Strike</DialogTitle>
            <DialogDescription>This will remove the strike record from the member.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {removeTarget && (
              <div className="surface-soft rounded-xl p-4 border border-dashed border-red-500/20 bg-red-500/5">
                <p className="text-sm font-semibold text-red-200">User: {getUserName(removeTarget.userId)}</p>
                <p className="text-sm mt-1 text-[var(--text-muted)] italic">Reason: {removeTarget.reason}</p>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRemoveOpen(false); setRemoveTarget(null); }}>Cancel</Button>
            <Button variant="danger" onClick={confirmRemove} loading={removeSaving}>Revoke Strike</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={Boolean(currentDetailUser)} onOpenChange={(open) => { if (!open) setDetailUser(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle>Member Strike History</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {currentDetailUser && (
              <div className="space-y-8">
                <div className="flex items-center gap-5">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500/20 to-amber-500/20 text-3xl font-bold border border-white/10 shadow-xl">
                    {(currentDetailUser.name || currentDetailUser.username || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-black text-[var(--text-main)] truncate">{currentDetailUser.name || currentDetailUser.username}</h3>
                    <p className="text-xs font-mono text-[var(--text-muted)] truncate">{currentDetailUser.id}</p>
                    <div className="mt-2 flex gap-2">
                       {userRoles.slice(0, 3).map(r => <Badge key={r.id} variant="default" className="text-[10px]">{r.name}</Badge>)}
                       {userRoles.length > 3 && <Badge variant="secondary" className="text-[10px]">+{userRoles.length - 3}</Badge>}
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">Total</p>
                    <p className="text-4xl font-black text-red-500">{currentDetailUser.strike_count || 0}</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                     <History className="h-4 w-4 text-cyan-400" />
                     <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Historical Incidents</h4>
                  </div>
                  <div className="space-y-4">
                    {(currentDetailUser.strikes || []).map((strike, i) => (
                      <div key={i} className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/3 p-5 transition-all hover:bg-white/5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-4 flex-1">
                            <div>
                               <p className="font-bold text-rose-500 text-lg leading-tight">{strike.reason}</p>
                               <div className="mt-2 flex items-center gap-3 text-[10px] font-medium text-[var(--text-muted)] bg-white/5 w-fit px-2 py-1 rounded-md">
                                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3 " /> {formatDate(strike.timestamp).split(',')[0]}</span>
                                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(strike.timestamp).split(',')[1]}</span>
                               </div>
                            </div>
                            
                            <div className="space-y-2">
                               <div className="flex items-center justify-between">
                                  <Label className="text-[9px] font-bold uppercase tracking-widest opacity-50">Forgiveness Timeline</Label>
                                  <span className={`text-[10px] font-bold ${getTimeLeft(strike.expires_at) === 'Expired' ? 'text-red-400' : 'text-emerald-400'}`}>
                                     {getTimeLeft(strike.expires_at)}
                                  </span>
                               </div>
                               <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                                  <div className={`h-full rounded-full transition-all duration-1000 ${getTimeLeft(strike.expires_at) === 'Expired' ? 'bg-red-500 w-full' : 'bg-emerald-500 w-2/3 animate-pulse'}`} />
                               </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 w-9 p-0 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/5 hover:bg-red-500/20"
                            onClick={() => openRemoveDialog(currentDetailUser.id, i, strike.reason)}
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {(!currentDetailUser.strikes || currentDetailUser.strikes.length === 0) && (
                      <div className="flex flex-col items-center justify-center py-12 opacity-50 bg-white/[0.02] rounded-3xl border-2 border-dashed border-white/10 mt-4">
                        <Shield className="h-12 w-12 mb-3 text-emerald-500" />
                        <p className="text-sm font-semibold tracking-wide">Excellent standing. No violations recorded.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}
