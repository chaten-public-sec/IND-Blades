import { useMemo, useState } from 'react';
import { CheckCircle2, Gavel, ShieldAlert, ShieldCheck, Undo2 } from 'lucide-react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { hasPermission } from '../lib/access';
import { formatDate } from '../lib/format';
import SectionHeader from '../components/SectionHeader';
import SearchPickerDialog from '../components/SearchPickerDialog';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../components/ui/table';

function parseProofLinks(value) {
  return String(value || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function userItems(users) {
  return users.map((item) => ({
    id: item.id,
    label: item.name,
    description: item.username ? `@${item.username}` : `User ID ${item.id}`,
  }));
}

function MetricCard({ label, value, note }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <p className="text-sm font-medium text-[var(--text-muted)]">{label}</p>
        <p className="text-3xl font-semibold text-[var(--text-main)]">{value}</p>
        {note ? <p className="text-sm text-[var(--text-muted)]">{note}</p> : null}
      </CardContent>
    </Card>
  );
}

function validateStrikeForm(targets, form) {
  const errors = {};

  if (!targets.length) {
    errors.targets = 'Select at least one member.';
  }

  if (!String(form.reason || '').trim()) {
    errors.reason = 'Reason is required.';
  }

  return errors;
}

function FieldError({ message }) {
  if (!message) return null;
  return <p className="text-sm font-medium text-rose-300">{message}</p>;
}

export default function StrikePage() {
  const dashboard = useDashboardContext();
  const canApply = hasPermission(dashboard.viewer, 'apply_strikes');
  const canReview = hasPermission(dashboard.viewer, 'review_strikes');
  const canIssue = hasPermission(dashboard.viewer, 'issue_strikes');
  const canRevoke = hasPermission(dashboard.viewer, 'revoke_strikes');

  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [requestPickerOpen, setRequestPickerOpen] = useState(false);
  const [issuePickerOpen, setIssuePickerOpen] = useState(false);
  const [requestTargets, setRequestTargets] = useState([]);
  const [issueTargets, setIssueTargets] = useState([]);
  const [requestForm, setRequestForm] = useState({ reason: '', violationTime: '', proofLinks: '', witnessText: '' });
  const [issueForm, setIssueForm] = useState({ reason: '', violationTime: '', proofLinks: '', witnessText: '' });
  const [requestErrors, setRequestErrors] = useState({});
  const [issueErrors, setIssueErrors] = useState({});
  const [requestSaving, setRequestSaving] = useState(false);
  const [issueSaving, setIssueSaving] = useState(false);
  const [reviewNotes, setReviewNotes] = useState({});
  const [reviewingId, setReviewingId] = useState('');
  const [revokingId, setRevokingId] = useState('');

  const userNameMap = useMemo(() => {
    const map = new Map();
    dashboard.users.forEach((user) => map.set(String(user.id), user.name));
    return map;
  }, [dashboard.users]);

  const activeStrikes = useMemo(() => (
    dashboard.users.flatMap((user) =>
      (user.strikes || [])
        .filter((strike) => strike.status === 'active')
        .map((strike) => ({
          ...strike,
          user_id: user.id,
          user_name: user.name,
          user_username: user.username,
        }))
    )
  ), [dashboard.users]);

  const submitRequest = async () => {
    const errors = validateStrikeForm(requestTargets, requestForm);
    setRequestErrors(errors);
    if (Object.keys(errors).length) {
      return;
    }

    setRequestSaving(true);
    try {
      await api.post('/api/strike-requests', {
        target_user_ids: requestTargets,
        reason: requestForm.reason,
        violation_time: requestForm.violationTime || null,
        proof_links: parseProofLinks(requestForm.proofLinks),
        witness_text: requestForm.witnessText,
      });
      dashboard.showToast('success', 'Strike request submitted.', 'strike-request-submit');
      setRequestForm({ reason: '', violationTime: '', proofLinks: '', witnessText: '' });
      setRequestTargets([]);
      setRequestErrors({});
      setRequestDialogOpen(false);
      await dashboard.loadDashboard(true);
    } catch (error) {
      dashboard.handleError(error, 'Unable to submit the strike request.');
    } finally {
      setRequestSaving(false);
    }
  };

  const issueDirectStrike = async () => {
    const errors = validateStrikeForm(issueTargets, issueForm);
    setIssueErrors(errors);
    if (Object.keys(errors).length) {
      return;
    }

    setIssueSaving(true);
    try {
      await api.post('/api/strikes/add', {
        target_user_ids: issueTargets,
        reason: issueForm.reason,
        violation_time: issueForm.violationTime || null,
        proof_links: parseProofLinks(issueForm.proofLinks),
        witness_text: issueForm.witnessText,
      });
      dashboard.showToast('success', 'Strike issued successfully.', 'strike-direct-issue');
      setIssueForm({ reason: '', violationTime: '', proofLinks: '', witnessText: '' });
      setIssueTargets([]);
      setIssueErrors({});
      setIssueDialogOpen(false);
      await dashboard.loadDashboard(true);
    } catch (error) {
      dashboard.handleError(error, 'Unable to issue the strike.');
    } finally {
      setIssueSaving(false);
    }
  };

  const reviewRequest = async (requestId, decision) => {
    setReviewingId(requestId);
    try {
      await api.post(`/api/strike-requests/${requestId}/review`, {
        decision,
        review_note: reviewNotes[requestId] || '',
      });
      dashboard.showToast('success', `Strike request ${decision}d.`, `strike-review-${requestId}`);
      await dashboard.loadDashboard(true);
    } catch (error) {
      dashboard.handleError(error, 'Unable to review that strike request.');
    } finally {
      setReviewingId('');
    }
  };

  const revokeStrike = async (userId, strikeId) => {
    setRevokingId(strikeId);
    try {
      await api.post('/api/strikes/revoke', {
        user_id: userId,
        strike_id: strikeId,
        reason: 'Revoked from dashboard',
      });
      dashboard.showToast('success', 'Strike revoked.', `strike-revoke-${strikeId}`);
      await dashboard.loadDashboard(true);
    } catch (error) {
      dashboard.handleError(error, 'Unable to revoke that strike.');
    } finally {
      setRevokingId('');
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Strikes"
        title="Strike Center"
        description="Members can review their own strike history. High Command can apply. Deputies and above can issue, review, and revoke."
        actions={(
          <>
            {canApply ? (
              <Button variant="secondary" onClick={() => {
                setRequestErrors({});
                setRequestDialogOpen(true);
              }}>
                <ShieldAlert className="h-4 w-4" />
                Apply for Strike
              </Button>
            ) : null}
            {canIssue ? (
              <Button onClick={() => {
                setIssueErrors({});
                setIssueDialogOpen(true);
              }}>
                <Gavel className="h-4 w-4" />
                Add Strike
              </Button>
            ) : null}
          </>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <MetricCard label="My Active Strikes" value={dashboard.myStrikes.filter((item) => item.status === 'active').length} note="Current live strikes on your profile." />
        <MetricCard label="Pending Requests" value={dashboard.strikeRequests.filter((item) => item.status === 'pending').length} note="Requests waiting for a management decision." />
        <MetricCard label="Active Across Members" value={activeStrikes.length} note="Live active strikes across the tracked roster." />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Strike History</CardTitle>
          <CardDescription>Your read-only strike timeline and current status.</CardDescription>
        </CardHeader>
        <CardContent>
          {dashboard.myStrikes.length ? (
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Reason</TableHeaderCell>
                  <TableHeaderCell>Given By</TableHeaderCell>
                  <TableHeaderCell>Date</TableHeaderCell>
                  <TableHeaderCell>Expiry</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {dashboard.myStrikes.map((strike) => (
                  <TableRow key={strike.id}>
                    <TableCell>
                      <div className="font-semibold text-[var(--text-main)]">{strike.reason}</div>
                      <div className="mt-1 text-sm text-[var(--text-muted)]">
                        {strike.violation_time ? `Violation ${formatDate(strike.violation_time)}` : 'No violation time provided'}
                      </div>
                    </TableCell>
                    <TableCell>{userNameMap.get(String(strike.issued_by)) || strike.issued_by || 'System'}</TableCell>
                    <TableCell>{formatDate(strike.timestamp)}</TableCell>
                    <TableCell>{formatDate(strike.expires_at)}</TableCell>
                    <TableCell>
                      <Badge variant={strike.status === 'active' ? 'danger' : strike.status === 'revoked' ? 'neutral' : 'warning'}>
                        {strike.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="surface-soft rounded-[24px] px-5 py-12 text-center text-sm text-[var(--text-muted)]">
              You have no recorded strikes.
            </div>
          )}
        </CardContent>
      </Card>

      {dashboard.strikeRequests.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Strike Requests</CardTitle>
            <CardDescription>Review submissions and track their current decision status.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Requester</TableHeaderCell>
                  <TableHeaderCell>Targets</TableHeaderCell>
                  <TableHeaderCell>Reason</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  {canReview ? <TableHeaderCell>Review Note</TableHeaderCell> : null}
                  {canReview ? <TableHeaderCell className="text-right">Actions</TableHeaderCell> : null}
                </tr>
              </TableHead>
              <TableBody>
                {dashboard.strikeRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{userNameMap.get(String(request.requester_user_id)) || request.requester_user_id}</TableCell>
                    <TableCell>
                      {(request.target_user_ids || []).map((id) => userNameMap.get(String(id)) || id).join(', ')}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-[var(--text-main)]">{request.reason}</div>
                      <div className="mt-1 text-sm text-[var(--text-muted)]">
                        {formatDate(request.violation_time, 'No time provided')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={request.status === 'pending' ? 'warning' : request.status === 'approved' ? 'success' : 'neutral'}>
                        {request.status}
                      </Badge>
                    </TableCell>
                    {canReview ? (
                      <TableCell>
                        <input
                          value={reviewNotes[request.id] || ''}
                          onChange={(event) => setReviewNotes((current) => ({ ...current, [request.id]: event.target.value }))}
                          className="surface-soft h-11 w-full rounded-[18px] px-3 text-sm"
                          placeholder="Reason or note"
                        />
                      </TableCell>
                    ) : null}
                    {canReview ? (
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {request.status === 'pending' ? (
                            <>
                              <Button size="sm" variant="secondary" loading={reviewingId === request.id} onClick={() => reviewRequest(request.id, 'approve')}>
                                <CheckCircle2 className="h-4 w-4" />
                                Approve
                              </Button>
                              <Button size="sm" variant="ghost" loading={reviewingId === request.id} onClick={() => reviewRequest(request.id, 'reject')}>
                                <Undo2 className="h-4 w-4" />
                                Reject
                              </Button>
                            </>
                          ) : (
                            <span className="text-sm text-[var(--text-muted)]">Reviewed</span>
                          )}
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {(canIssue || canRevoke) ? (
        <Card>
          <CardHeader>
            <CardTitle>Active Strikes</CardTitle>
            <CardDescription>Live strikes across members with direct removal when your role allows it.</CardDescription>
          </CardHeader>
          <CardContent>
            {activeStrikes.length ? (
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>User</TableHeaderCell>
                    <TableHeaderCell>Reason</TableHeaderCell>
                    <TableHeaderCell>Given By</TableHeaderCell>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>Expiry</TableHeaderCell>
                    {canRevoke ? <TableHeaderCell className="text-right">Action</TableHeaderCell> : null}
                  </tr>
                </TableHead>
                <TableBody>
                  {activeStrikes.map((strike) => (
                    <TableRow key={`${strike.user_id}-${strike.id}`}>
                      <TableCell>
                        <div className="font-semibold text-[var(--text-main)]">{strike.user_name}</div>
                        <div className="mt-1 text-sm text-[var(--text-muted)]">
                          {strike.user_username ? `@${strike.user_username}` : `ID ${strike.user_id}`}
                        </div>
                      </TableCell>
                      <TableCell>{strike.reason}</TableCell>
                      <TableCell>{userNameMap.get(String(strike.issued_by)) || strike.issued_by || 'System'}</TableCell>
                      <TableCell>{formatDate(strike.timestamp)}</TableCell>
                      <TableCell>{formatDate(strike.expires_at)}</TableCell>
                      {canRevoke ? (
                        <TableCell>
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="danger"
                              loading={revokingId === strike.id}
                              onClick={() => revokeStrike(strike.user_id, strike.id)}
                            >
                              <Undo2 className="h-4 w-4" />
                              Remove Strike
                            </Button>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="surface-soft rounded-[24px] px-5 py-12 text-center text-sm text-[var(--text-muted)]">
                No active strikes are currently live.
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={requestDialogOpen} onOpenChange={(open) => {
        setRequestDialogOpen(open);
        if (!open) {
          setRequestErrors({});
        }
      }}>
        <DialogContent className="w-[min(96vw,760px)]">
          <DialogHeader>
            <DialogTitle>Apply for Strike</DialogTitle>
            <DialogDescription>Submit a strike request with the people involved, time, and proof.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid gap-4">
              <Button
                variant="secondary"
                className={`justify-between ${requestErrors.targets ? 'border border-rose-400/35 bg-rose-500/8' : ''}`}
                onClick={() => setRequestPickerOpen(true)}
              >
                {requestTargets.length ? `${requestTargets.length} member(s) selected` : 'Choose target members'}
                <ShieldCheck className="h-4 w-4" />
              </Button>
              <FieldError message={requestErrors.targets} />
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  value={requestForm.reason}
                  onChange={(event) => {
                    const value = event.target.value;
                    setRequestForm((current) => ({ ...current, reason: value }));
                    setRequestErrors((current) => ({
                      ...current,
                      reason: value.trim() ? '' : current.reason,
                    }));
                  }}
                  className={`surface-soft h-12 rounded-[22px] px-4 text-sm ${requestErrors.reason ? 'border border-rose-400/35 bg-rose-500/8' : ''}`}
                  placeholder="Reason for strike request"
                />
                <input
                  value={requestForm.violationTime}
                  onChange={(event) => setRequestForm((current) => ({ ...current, violationTime: event.target.value }))}
                  type="datetime-local"
                  className="surface-soft h-12 rounded-[22px] px-4 text-sm"
                />
              </div>
              <FieldError message={requestErrors.reason} />
              <textarea
                value={requestForm.proofLinks}
                onChange={(event) => setRequestForm((current) => ({ ...current, proofLinks: event.target.value }))}
                className="surface-soft min-h-28 rounded-[22px] px-4 py-3 text-sm"
                placeholder="Proof links, one per line"
              />
              <textarea
                value={requestForm.witnessText}
                onChange={(event) => setRequestForm((current) => ({ ...current, witnessText: event.target.value }))}
                className="surface-soft min-h-28 rounded-[22px] px-4 py-3 text-sm"
                placeholder="Witness details or additional notes"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRequestDialogOpen(false)}>Cancel</Button>
            <Button loading={requestSaving} onClick={submitRequest}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={issueDialogOpen} onOpenChange={(open) => {
        setIssueDialogOpen(open);
        if (!open) {
          setIssueErrors({});
        }
      }}>
        <DialogContent className="w-[min(96vw,760px)]">
          <DialogHeader>
            <DialogTitle>Add Strike</DialogTitle>
            <DialogDescription>Directly issue a strike with reason, time of violation, and optional proof.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid gap-4">
              <Button
                variant="secondary"
                className={`justify-between ${issueErrors.targets ? 'border border-rose-400/35 bg-rose-500/8' : ''}`}
                onClick={() => setIssuePickerOpen(true)}
              >
                {issueTargets.length ? `${issueTargets.length} member(s) selected` : 'Choose target members'}
                <Gavel className="h-4 w-4" />
              </Button>
              <FieldError message={issueErrors.targets} />
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  value={issueForm.reason}
                  onChange={(event) => {
                    const value = event.target.value;
                    setIssueForm((current) => ({ ...current, reason: value }));
                    setIssueErrors((current) => ({
                      ...current,
                      reason: value.trim() ? '' : current.reason,
                    }));
                  }}
                  className={`surface-soft h-12 rounded-[22px] px-4 text-sm ${issueErrors.reason ? 'border border-rose-400/35 bg-rose-500/8' : ''}`}
                  placeholder="Reason for direct strike"
                />
                <input
                  value={issueForm.violationTime}
                  onChange={(event) => setIssueForm((current) => ({ ...current, violationTime: event.target.value }))}
                  type="datetime-local"
                  className="surface-soft h-12 rounded-[22px] px-4 text-sm"
                />
              </div>
              <FieldError message={issueErrors.reason} />
              <textarea
                value={issueForm.proofLinks}
                onChange={(event) => setIssueForm((current) => ({ ...current, proofLinks: event.target.value }))}
                className="surface-soft min-h-24 rounded-[22px] px-4 py-3 text-sm"
                placeholder="Proof links, one per line"
              />
              <textarea
                value={issueForm.witnessText}
                onChange={(event) => setIssueForm((current) => ({ ...current, witnessText: event.target.value }))}
                className="surface-soft min-h-24 rounded-[22px] px-4 py-3 text-sm"
                placeholder="Additional notes"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIssueDialogOpen(false)}>Cancel</Button>
            <Button loading={issueSaving} onClick={issueDirectStrike}>Issue Strike</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SearchPickerDialog
        open={requestPickerOpen}
        onOpenChange={setRequestPickerOpen}
        title="Choose Members"
        description="Select one or more members for the strike request."
        items={userItems(dashboard.users)}
        selectedIds={requestTargets}
        onConfirm={(ids) => {
          setRequestTargets(ids);
          setRequestErrors((current) => ({ ...current, targets: '' }));
        }}
        multiple
        placeholder="Search members"
      />

      <SearchPickerDialog
        open={issuePickerOpen}
        onOpenChange={setIssuePickerOpen}
        title="Choose Members"
        description="Select one or more members for a direct strike."
        items={userItems(dashboard.users)}
        selectedIds={issueTargets}
        onConfirm={(ids) => {
          setIssueTargets(ids);
          setIssueErrors((current) => ({ ...current, targets: '' }));
        }}
        multiple
        placeholder="Search members"
      />
    </div>
  );
}
