import { useState, useMemo, useCallback } from 'react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '../components/ui/dialog';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '../components/ui/table';

function formatDate(v) {
  if (!v) return 'N/A';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleString();
}

function getTimeLeft(expiresAt) {
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
  const { roster, roles, showToast, handleError, refreshUsers } = useDashboardContext();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  // Add Strike Dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addReason, setAddReason] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  // Remove Strike Confirmation
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null); // { userId, index, reason }
  const [removeSaving, setRemoveSaving] = useState(false);

  // User Detail Dialog
  const [detailUser, setDetailUser] = useState(null);

  // Filter users that have strikes or match search
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

  const addStrike = useCallback(async () => {
    if (!addUserId) return showToast('Select a user.');
    if (!addReason.trim()) return showToast('Provide a reason.');
    setAddSaving(true);
    try {
      await api.post('/api/strikes/add', { user_id: addUserId, reason: addReason.trim() });
      showToast('Strike added.');
      setAddOpen(false);
      setAddUserId('');
      setAddReason('');
    } catch (err) { handleError(err, 'Failed to add strike.'); }
    finally { setAddSaving(false); }
  }, [addUserId, addReason, showToast, handleError]);

  const confirmRemove = useCallback(async () => {
    if (!removeTarget) return;
    setRemoveSaving(true);
    try {
      await api.post('/api/strikes/remove', { user_id: removeTarget.userId, index: removeTarget.index });
      showToast('Strike removed.');
      setRemoveOpen(false);
      setRemoveTarget(null);
      // Refresh detail if open
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

  // Update detail user when roster changes
  const currentDetailUser = detailUser ? roster.find(u => u.id === detailUser.id) || detailUser : null;

  const userRoleIds = new Set(currentDetailUser?.roles || []);
  const userRoles = roles.filter(r => userRoleIds.has(r.id));

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Strike Management</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {usersWithStrikes.length} user{usersWithStrikes.length !== 1 ? 's' : ''} with active strikes
          </p>
        </div>
        <div className="flex gap-3">
          <input
            placeholder="Search users..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="surface-soft h-11 w-full rounded-2xl px-4 text-sm text-[var(--text-main)] transition focus:border-cyan-300/30 sm:w-56"
          />
          <Button onClick={() => setAddOpen(true)}>+ Add Strike</Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Users Struck</p>
            <p className="mt-2 text-3xl font-bold text-red-400">{usersWithStrikes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Total Strikes</p>
            <p className="mt-2 text-3xl font-bold text-amber-400">
              {usersWithStrikes.reduce((sum, u) => sum + (u.strike_count || 0), 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">All Members</p>
            <p className="mt-2 text-3xl font-bold">{roster.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Strikes Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Member</TableHeaderCell>
                <TableHeaderCell>Strikes</TableHeaderCell>
                <TableHeaderCell>Last Reason</TableHeaderCell>
                <TableHeaderCell>Latest Expiry</TableHeaderCell>
                <TableHeaderCell className="text-right">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageItems.map(user => {
                const lastStrike = user.strikes && user.strikes.length > 0 ? user.strikes[user.strikes.length - 1] : null;
                return (
                  <TableRow key={user.id} className="cursor-pointer" onClick={() => setDetailUser(user)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-red-400/20 to-amber-300/20 text-sm font-bold">
                          {(user.name || user.username || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold">{user.name || user.username}</p>
                          {user.username && <p className="text-xs text-[var(--text-muted)]">@{user.username}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.strike_count >= 3 ? 'danger' : user.strike_count >= 2 ? 'warning' : 'default'}>
                        {user.strike_count || 0} Strike{(user.strike_count || 0) !== 1 ? 's' : ''}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{lastStrike?.reason || '—'}</TableCell>
                    <TableCell className="text-sm text-[var(--text-muted)]">
                      {lastStrike ? getTimeLeft(lastStrike.expires_at) : '—'}
                    </TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setDetailUser(user)}>View</Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            if (user.strikes?.length > 0) {
                              openRemoveDialog(user.id, user.strikes.length - 1, user.strikes[user.strikes.length - 1].reason);
                            }
                          }}
                          disabled={!user.strikes || user.strikes.length === 0}
                        >
                          Remove
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button size="sm" variant="ghost" disabled={currentPage === 0} onClick={() => setPage(p => p - 1)}>← Prev</Button>
          <span className="text-sm text-[var(--text-muted)]">Page {currentPage + 1} of {totalPages}</span>
          <Button size="sm" variant="ghost" disabled={currentPage >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</Button>
        </div>
      )}

      {/* Add Strike Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Strike</DialogTitle>
            <DialogDescription>Issue a strike to a server member.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--text-muted)]">User</label>
                <select
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value)}
                  className="surface-soft h-11 w-full rounded-2xl px-4 text-sm text-[var(--text-main)] appearance-none"
                >
                  <option value="" disabled>Select a member</option>
                  {roster.map(u => (
                    <option key={u.id} value={u.id}>{u.name || u.username} {u.strike_count ? `(${u.strike_count} strikes)` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--text-muted)]">Reason</label>
                <input
                  value={addReason}
                  onChange={(e) => setAddReason(e.target.value)}
                  placeholder="e.g. Missed Event, Rule Violation"
                  className="surface-soft h-11 w-full rounded-2xl px-4 text-sm text-[var(--text-main)] transition focus:border-cyan-300/30"
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addStrike} loading={addSaving}>Add Strike</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Strike Confirmation Dialog */}
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Strike</DialogTitle>
            <DialogDescription>Are you sure you want to remove this strike?</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {removeTarget && (
              <div className="surface-soft rounded-xl p-4">
                <p className="text-sm"><strong>User:</strong> {getUserName(removeTarget.userId)}</p>
                <p className="text-sm mt-1"><strong>Reason:</strong> {removeTarget.reason}</p>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRemoveOpen(false); setRemoveTarget(null); }}>Cancel</Button>
            <Button variant="danger" onClick={confirmRemove} loading={removeSaving}>Remove Strike</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Detail Dialog */}
      <Dialog open={Boolean(currentDetailUser)} onOpenChange={(open) => { if (!open) setDetailUser(null); }}>
        <DialogContent className="w-[min(96vw,560px)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Strike History</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {currentDetailUser && (
              <div className="space-y-6">
                {/* User Info */}
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-red-400/30 to-amber-300/30 text-2xl font-bold shadow-lg">
                    {(currentDetailUser.name || currentDetailUser.username || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{currentDetailUser.name || currentDetailUser.username}</h3>
                    {currentDetailUser.username && <p className="text-sm text-[var(--text-muted)]">@{currentDetailUser.username}</p>}
                  </div>
                  <div className="ml-auto">
                    <Badge variant={currentDetailUser.strike_count >= 3 ? 'danger' : currentDetailUser.strike_count >= 2 ? 'warning' : 'default'} className="text-lg px-3 py-1">
                      {currentDetailUser.strike_count || 0}
                    </Badge>
                  </div>
                </div>

                {/* Roles */}
                {userRoles.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Roles</p>
                    <div className="flex flex-wrap gap-2">
                      {userRoles.map(r => <Badge key={r.id} variant="default">{r.name}</Badge>)}
                    </div>
                  </div>
                )}

                {/* Strike History */}
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Strike History</p>
                  <div className="space-y-3">
                    {(currentDetailUser.strikes || []).map((strike, i) => (
                      <div key={i} className="surface-soft rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-bold text-red-400">{strike.reason}</p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">Given: {formatDate(strike.timestamp)}</p>
                            <p className="text-xs text-[var(--text-muted)]">Expires: {formatDate(strike.expires_at)}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant={getTimeLeft(strike.expires_at) === 'Expired' ? 'danger' : 'warning'}>
                              {getTimeLeft(strike.expires_at)}
                            </Badge>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => openRemoveDialog(currentDetailUser.id, i, strike.reason)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!currentDetailUser.strikes || currentDetailUser.strikes.length === 0) && (
                      <div className="surface-soft rounded-xl p-4 text-center text-sm text-[var(--text-muted)]">
                        No active strikes. This user is in good standing!
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
