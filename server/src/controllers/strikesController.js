const crypto = require('crypto');

function normalizeTargetIds(body) {
  if (Array.isArray(body?.target_user_ids)) {
    return body.target_user_ids.map(String).filter(Boolean);
  }
  if (body?.user_id) {
    return [String(body.user_id)];
  }
  return [];
}

function buildStrikeEntry(body, actor, strikeConfig, requestId = null) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + Number(strikeConfig.expiry_days || 7) * 24 * 60 * 60 * 1000);

  return {
    id: crypto.randomUUID(),
    reason: String(body.reason || 'Manual Strike'),
    timestamp: now.toISOString(),
    violation_time: body.violation_time || now.toISOString(),
    expires_at: expiresAt.toISOString(),
    issued_by: actor.id,
    issued_by_role: actor.primary_role,
    proof_links: Array.isArray(body.proof_links) ? body.proof_links.map(String).filter(Boolean) : [],
    witness_text: String(body.witness_text || ''),
    request_id: requestId,
    status: 'active',
    metadata: {
      multiple_users: normalizeTargetIds(body).length > 1
    }
  };
}

function countActiveStrikes(strikes) {
  return (Array.isArray(strikes) ? strikes : []).filter((item) => item.status === 'active').length;
}

function syncUserStrikeRoles({
  commandQueueService,
  emitSystemUpdate,
  userId,
  strikeCount,
  commandType = 'strike_sync',
  action = 'sync',
  payload = {}
}) {
  const syncPayload = {
    user_id: String(userId),
    strike_count: Number(strikeCount || 0),
    action,
    ...payload
  };

  commandQueueService.enqueueCommand(commandType, syncPayload);
  emitSystemUpdate('STRIKE_UPDATED', syncPayload);
  return syncPayload;
}

async function applyStrikeToTargets({
  targetIds,
  body,
  actor,
  requestId,
  legacyStoreService,
  commandQueueService,
  emitSystemUpdate,
  notificationService,
  logService
}) {
  const strikeConfig = legacyStoreService.getStrikeConfig();
  const updated = [];

  for (const targetUserId of targetIds) {
    const strikeData = legacyStoreService.getUserStrikes(targetUserId);
    const strikeEntry = buildStrikeEntry(body, actor, strikeConfig, requestId);
    strikeData.strikes.push(strikeEntry);
    strikeData.strike_count = countActiveStrikes(strikeData.strikes);
    const saved = legacyStoreService.setUserStrikes(targetUserId, strikeData);

    syncUserStrikeRoles({
      commandQueueService,
      emitSystemUpdate,
      userId: targetUserId,
      strikeCount: saved.strike_count,
      commandType: 'strike_added',
      action: 'added',
      payload: {
        reason: strikeEntry.reason,
        issued_by: actor.id,
        issued_by_name: actor.display_name || actor.username || actor.id,
        issued_by_role: actor.primary_role || null,
        violation_time: strikeEntry.violation_time,
        expires_at: strikeEntry.expires_at,
        proof_links: strikeEntry.proof_links,
        witness_text: strikeEntry.witness_text,
        strike_id: strikeEntry.id,
        request_id: requestId
      }
    });

    await notificationService.createForUsers([targetUserId], {
      actor_user_id: actor.id,
      type: 'strike_update',
      title: 'Strike Issued',
      message: `${actor.display_name} issued you a strike for "${strikeEntry.reason}".`,
      meta: {
        request_id: requestId,
        expires_at: strikeEntry.expires_at
      }
    });

    logService.appendLog(`Issued strike to ${targetUserId}.`, 'warning', 'strikes', { user_id: targetUserId, request_id: requestId });
    updated.push({ user_id: targetUserId, strike_data: saved });
  }

  return updated;
}

function createStrikesController({
  legacyStoreService,
  appStoreService,
  commandQueueService,
  emitSystemUpdate,
  notificationService,
  logService
}) {
  return {
    getStrikeConfig(_req, res) {
      res.json(legacyStoreService.getStrikeConfig());
    },

    postStrikeConfig(req, res) {
      const config = legacyStoreService.setStrikeConfig(req.body || {});

      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'strike_mapping')) {
        const store = legacyStoreService.readStore();
        const strikeRows = store.__strikes__ && typeof store.__strikes__ === 'object' ? Object.values(store.__strikes__) : [];

        for (const row of strikeRows) {
          const userId = row?.user_id ? String(row.user_id) : '';
          if (!userId) {
            continue;
          }

          commandQueueService.enqueueCommand('strike_sync', {
            user_id: userId,
            strike_count: Number(row?.strike_count || 0)
          });
        }
      }

      emitSystemUpdate('STRIKE_CONFIG_UPDATED', config);
      logService.appendLog('Updated strike configuration.', 'info', 'strikes');
      res.json({ success: true, config });
    },

    async directIssue(req, res) {
      const targetIds = normalizeTargetIds(req.body || {});
      if (targetIds.length === 0) {
        res.status(400).json({ error: 'Choose at least one target user.' });
        return;
      }

      const updated = await applyStrikeToTargets({
        targetIds,
        body: req.body || {},
        actor: req.viewer,
        requestId: null,
        legacyStoreService,
        commandQueueService,
        emitSystemUpdate,
        notificationService,
        logService
      });

      await notificationService.notifyEscalation(
        req.viewer,
        'Direct Strike Issued',
        `${req.viewer.display_name} issued ${targetIds.length} strike${targetIds.length > 1 ? 's' : ''}.`,
        { target_user_ids: targetIds }
      );

      res.json({ success: true, updated });
    },

    async revoke(req, res) {
      const userId = String(req.body?.user_id || '').trim();
      const strikeId = String(req.body?.strike_id || '').trim();
      const revokeReason = String(req.body?.reason || '');

      if (!userId || !strikeId) {
        res.status(400).json({ error: 'Choose a user and strike first.' });
        return;
      }

      const strikeData = legacyStoreService.getUserStrikes(userId);
      const index = strikeData.strikes.findIndex((item) => String(item.id) === strikeId);
      if (index === -1) {
        res.status(404).json({ error: 'Strike not found.' });
        return;
      }

      strikeData.strikes[index] = {
        ...strikeData.strikes[index],
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by: req.viewer.id,
        revoked_reason: revokeReason
      };
      strikeData.strike_count = countActiveStrikes(strikeData.strikes);
      const saved = legacyStoreService.setUserStrikes(userId, strikeData);

      syncUserStrikeRoles({
        commandQueueService,
        emitSystemUpdate,
        userId,
        strikeCount: saved.strike_count,
        commandType: 'strike_removed',
        action: 'removed',
        payload: {
          removed_by: req.viewer.id,
          removed_by_name: req.viewer.display_name || req.viewer.username || req.viewer.id,
          reason: revokeReason || '',
          strike_id: strikeId
        }
      });
      logService.appendLog(`Revoked strike ${strikeId} from ${userId}.`, 'info', 'strikes', { user_id: userId, strike_id: strikeId });

      await notificationService.createForUsers([userId], {
        actor_user_id: req.viewer.id,
        type: 'strike_update',
        title: 'Strike Revoked',
        message: `${req.viewer.display_name} revoked one of your strikes.`,
        meta: {
          strike_id: strikeId,
          reason: revokeReason
        }
      });

      await notificationService.notifyEscalation(
        req.viewer,
        'Strike Revoked',
        `${req.viewer.display_name} revoked a strike from ${userId}.`,
        { user_id: userId, strike_id: strikeId }
      );

      res.json({ success: true, strike_data: saved });
    },

    async clearHistory(req, res) {
      const userId = String(req.body?.user_id || '').trim();

      if (!userId) {
        res.status(400).json({ error: 'Choose a user first.' });
        return;
      }

      const existing = legacyStoreService.getUserStrikes(userId);
      const clearedCount = Array.isArray(existing.strikes) ? existing.strikes.length : 0;
      const saved = legacyStoreService.setUserStrikes(userId, {
        user_id: userId,
        strikes: [],
        strike_count: 0
      });

      syncUserStrikeRoles({
        commandQueueService,
        emitSystemUpdate,
        userId,
        strikeCount: 0,
        commandType: 'strike_sync',
        action: 'history_cleared',
        payload: {
          cleared_by: req.viewer.id,
          cleared_by_name: req.viewer.display_name || req.viewer.username || req.viewer.id,
          cleared_count: clearedCount
        }
      });

      logService.appendLog(`Cleared strike history for ${userId}.`, 'warning', 'strikes', {
        user_id: userId,
        cleared_count: clearedCount,
        cleared_by: req.viewer.id
      });

      await notificationService.createForUsers([userId], {
        actor_user_id: req.viewer.id,
        type: 'strike_update',
        title: 'Strike History Cleared',
        message: `${req.viewer.display_name} cleared your strike history.`,
        meta: {
          cleared_count: clearedCount
        }
      });

      await notificationService.notifyEscalation(
        req.viewer,
        'Strike History Cleared',
        `${req.viewer.display_name} cleared all strike history for ${userId}.`,
        { user_id: userId, cleared_count: clearedCount }
      );

      res.json({
        success: true,
        strike_data: saved,
        cleared_count: clearedCount
      });
    },

    async listRequests(req, res) {
      const requests = await appStoreService.listStrikeRequests();
      const visible = req.viewer.permissions.includes('review_strikes')
        ? requests
        : requests.filter((item) => String(item.requester_user_id) === String(req.viewer.id));
      res.json(visible);
    },

    async createRequest(req, res) {
      const targetIds = normalizeTargetIds(req.body || {});
      if (targetIds.length === 0) {
        res.status(400).json({ error: 'Choose at least one target user.' });
        return;
      }

      if (!String(req.body?.reason || '').trim()) {
        res.status(400).json({ error: 'Provide a reason for the strike request.' });
        return;
      }

      const requestRecord = await appStoreService.saveStrikeRequest({
        requester_user_id: req.viewer.id,
        target_user_ids: targetIds,
        reason: req.body.reason,
        violation_time: req.body.violation_time || null,
        proof_links: Array.isArray(req.body?.proof_links) ? req.body.proof_links : [],
        witness_text: req.body?.witness_text || '',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      emitSystemUpdate('STRIKE_REQUEST_CREATED', { request: requestRecord });
      logService.appendLog(`Created strike request ${requestRecord.id}.`, 'info', 'strikes', { request_id: requestRecord.id });

      await notificationService.notifyEscalation(
        req.viewer,
        'Strike Request Submitted',
        `${req.viewer.display_name} submitted a strike request for ${targetIds.length} member${targetIds.length > 1 ? 's' : ''}.`,
        { request_id: requestRecord.id }
      );

      res.json({ success: true, request: requestRecord });
    },

    async reviewRequest(req, res) {
      const requestId = String(req.params.id || '').trim();
      const decision = String(req.body?.decision || '').trim().toLowerCase();
      const reviewNote = String(req.body?.review_note || '').trim();

      const requestRecord = await appStoreService.getStrikeRequestById(requestId);
      if (!requestRecord) {
        res.status(404).json({ error: 'Strike request not found.' });
        return;
      }

      if (requestRecord.status !== 'pending') {
        res.status(400).json({ error: 'That strike request has already been reviewed.' });
        return;
      }

      if (!['approve', 'reject'].includes(decision)) {
        res.status(400).json({ error: 'Decision must be approve or reject.' });
        return;
      }

      const updatedRequest = await appStoreService.saveStrikeRequest({
        ...requestRecord,
        status: decision === 'approve' ? 'approved' : 'rejected',
        reviewer_user_id: req.viewer.id,
        review_note: reviewNote,
        updated_at: new Date().toISOString()
      });

      let updated = [];
      if (decision === 'approve') {
        updated = await applyStrikeToTargets({
          targetIds: updatedRequest.target_user_ids,
          body: updatedRequest,
          actor: req.viewer,
          requestId: updatedRequest.id,
          legacyStoreService,
          commandQueueService,
          emitSystemUpdate,
          notificationService,
          logService
        });
      }

      emitSystemUpdate('STRIKE_REQUEST_REVIEWED', { request: updatedRequest });
      logService.appendLog(`Reviewed strike request ${updatedRequest.id} as ${updatedRequest.status}.`, 'info', 'strikes', { request_id: updatedRequest.id });

      await notificationService.createForUsers([updatedRequest.requester_user_id], {
        actor_user_id: req.viewer.id,
        type: 'strike_request',
        title: `Strike Request ${decision === 'approve' ? 'Approved' : 'Rejected'}`,
        message: `${req.viewer.display_name} ${decision}d your strike request.`,
        meta: {
          request_id: updatedRequest.id,
          review_note: reviewNote
        }
      });

      await notificationService.notifyEscalation(
        req.viewer,
        'Strike Request Reviewed',
        `${req.viewer.display_name} ${decision}d strike request ${updatedRequest.id}.`,
        { request_id: updatedRequest.id, decision }
      );

      res.json({ success: true, request: updatedRequest, updated });
    }
  };
}

module.exports = {
  createStrikesController
};
