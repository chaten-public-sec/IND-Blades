const crypto = require('crypto');
const fs = require('fs');
const {
  REMINDERS_PATH,
  LEGACY_WELCOME_PATH,
  getEnv
} = require('../config/env');
const { ensureDirectory, readJson, writeJson } = require('../utils/files');
const { parseBoolean, parseSnowflake, normalizeTime } = require('../utils/parsers');

const SNOWFLAKE_FIELD_PATTERN = /(:\s*)(\d{15,})(?=\s*[,}\]])/g;
const SNOWFLAKE_STRING_PATTERN = /(:\s*)"(\d{15,})"(?=\s*[,}\]])/g;
const RESERVED_KEYS = new Set([
  '__activity__',
  '__activity_config__',
  '__welcome__',
  '__logs__',
  '__logs_v2__',
  '__notifications__',
  '__vc_config__',
  '__strikes__',
  '__strikes_config__',
  '__discord_logs__',
  '__autorole__'
]);

function readSnowflakeJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }

    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw.replace(SNOWFLAKE_FIELD_PATTERN, '$1"$2"'));
  } catch {
    return fallback;
  }
}

function writeSnowflakeJson(filePath, value) {
  ensureDirectory(require('path').dirname(filePath));
  const raw = JSON.stringify(value, null, 2).replace(SNOWFLAKE_STRING_PATTERN, '$1$2');
  fs.writeFileSync(filePath, raw, 'utf8');
}

function getDefaultReminderChannelId() {
  return parseSnowflake(getEnv('REMINDER_CHANNEL_ID', ''));
}

function getDefaultWelcomeChannelId() {
  return parseSnowflake(getEnv('WELCOME_CHANNEL_ID', ''));
}

function getDefaultEventLogChannelId() {
  return parseSnowflake(getEnv('LOGS_CHANNEL_ID', ''));
}

function getDefaultModerationLogChannelId() {
  return parseSnowflake(getEnv('MODERATION_LOGS_CHANNEL_ID', ''));
}

function normalizeWelcomeConfig(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    enabled: parseBoolean(input.enabled, true),
    channel_id: parseSnowflake(input.channel_id) || getDefaultWelcomeChannelId()
  };
}

function normalizeLogSettings(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const defaultSystemChannel = getDefaultEventLogChannelId();
  return {
    enabled: parseBoolean(input.enabled, true),
    moderation_channel_id: parseSnowflake(input.moderation_channel_id) || getDefaultModerationLogChannelId(),
    event_channel_id: parseSnowflake(input.event_channel_id) || defaultSystemChannel,
    system_channel_id: parseSnowflake(input.system_channel_id) || defaultSystemChannel
  };
}

function normalizeDiscordLogsConfig(value) {
  if (value && typeof value === 'object' && Array.isArray(value.categories)) {
    return value;
  }

  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    enabled: parseBoolean(input.enabled, false),
    categories: []
  };
}

function normalizeAutoRoleConfig(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    join_role_id: parseSnowflake(input.join_role_id),
    bindings: Array.isArray(input.bindings)
      ? input.bindings
          .filter((binding) => binding && typeof binding === 'object' && binding.role_a && binding.role_b)
          .map((binding) => ({ role_a: String(binding.role_a), role_b: String(binding.role_b) }))
      : [],
    strike_mapping: input.strike_mapping && typeof input.strike_mapping === 'object'
      ? Object.fromEntries(
          Object.entries(input.strike_mapping)
            .filter(([, value]) => value !== null && value !== undefined && value !== '')
            .map(([key, value]) => [String(key), String(value)])
        )
      : {}
  };
}

function normalizeNotificationConfig(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    enabled: parseBoolean(input.enabled, false),
    user_ids: Array.isArray(input.user_ids) ? input.user_ids.map(String) : []
  };
}

function normalizeVcConfig(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    channel_id: parseSnowflake(input.channel_id),
    channel_name: String(input.channel_name || '')
  };
}

function normalizeStrikeData(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  const strikes = Array.isArray(input.strikes)
    ? input.strikes.map((strike) => ({
        id: String(strike.id || crypto.randomUUID()),
        reason: String(strike.reason || 'Manual Strike'),
        timestamp: strike.timestamp || new Date().toISOString(),
        violation_time: strike.violation_time || strike.timestamp || null,
        expires_at: strike.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        issued_by: strike.issued_by ? String(strike.issued_by) : null,
        issued_by_role: strike.issued_by_role || null,
        proof_links: Array.isArray(strike.proof_links) ? strike.proof_links.map(String) : [],
        witness_text: String(strike.witness_text || ''),
        request_id: strike.request_id ? String(strike.request_id) : null,
        status: strike.status || 'active',
        revoked_at: strike.revoked_at || null,
        revoked_by: strike.revoked_by ? String(strike.revoked_by) : null,
        revoked_reason: String(strike.revoked_reason || ''),
        metadata: strike.metadata && typeof strike.metadata === 'object' && !Array.isArray(strike.metadata) ? strike.metadata : {}
      }))
    : [];

  return {
    user_id: parseSnowflake(input.user_id),
    strikes,
    strike_count: Number(input.strike_count || strikes.filter((item) => item.status === 'active').length || 0)
  };
}

function getStrikeConfigFromInput(config, autorole) {
  const source = config && typeof config === 'object' ? config : {};
  const autoRoleSource = autorole && typeof autorole === 'object' ? autorole : {};
  return {
    expiry_days: Number(source.expiry_days || 7),
    strike_mapping: source.strike_mapping && typeof source.strike_mapping === 'object'
      ? source.strike_mapping
      : (autoRoleSource.strike_mapping && typeof autoRoleSource.strike_mapping === 'object' ? autoRoleSource.strike_mapping : {})
  };
}

function inferTargetType(item) {
  if (item.target_type === 'channel' || item.target_type === 'role' || item.target_type === 'user') {
    return item.target_type;
  }
  if (item.delivery_mode === 'dm') {
    return 'user';
  }
  return 'channel';
}

function normalizeEvent(id, value) {
  const item = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const deliveryMode = item.delivery_mode === 'dm' ? 'dm' : 'server';
  const targetType = inferTargetType(item);
  const targetId =
    parseSnowflake(item.target_id) ||
    (targetType === 'user' ? parseSnowflake(item.creator_id) : null) ||
    (targetType === 'channel' ? parseSnowflake(item.channel_id) : null);

  return {
    id,
    desc: String(item.desc || item.name || 'Untitled Event').trim() || 'Untitled Event',
    time: normalizeTime(item.time) || '',
    daily: parseBoolean(item.daily, false),
    enabled: parseBoolean(item.enabled, true),
    delivery_mode: deliveryMode,
    target_type: targetType,
    target_id: targetId,
    mention_role_id: parseSnowflake(item.mention_role_id),
    channel_id: parseSnowflake(item.channel_id),
    creator_id: parseSnowflake(item.creator_id),
    attending: Array.isArray(item.attending) ? item.attending : [],
    not_attending: Array.isArray(item.not_attending)
      ? item.not_attending.map((entry) => typeof entry === 'object'
          ? {
              user_id: String(entry.user_id || ''),
              reason: String(entry.reason || 'No reason'),
              timestamp: entry.timestamp || null
            }
          : {
              user_id: String(entry),
              reason: 'No reason',
              timestamp: null
            })
      : [],
    vote_message_id: parseSnowflake(item.vote_message_id),
    vote_message_map: item.vote_message_map && typeof item.vote_message_map === 'object' && !Array.isArray(item.vote_message_map)
      ? item.vote_message_map
      : {},
    last_vote_date: item.last_vote_date || null,
    last_reminded_date: item.last_reminded_date || null,
    event_date: item.event_date || null,
    voting_closed: parseBoolean(item.voting_closed, false),
    vc_channel_id: parseSnowflake(item.vc_channel_id)
  };
}

function buildEventRecord(body, existingEvent) {
  const current = existingEvent ? normalizeEvent(existingEvent.id, existingEvent) : null;
  const desc = String(body.name ?? body.desc ?? current?.desc ?? '').trim();
  if (!desc) {
    return { error: 'Event name is required.' };
  }

  const time = normalizeTime(body.time ?? current?.time);
  if (!time) {
    return { error: 'Time must use HH:MM format.' };
  }

  const deliveryMode = body.mode ?? body.delivery_mode ?? current?.delivery_mode ?? 'server';
  if (!['server', 'dm'].includes(deliveryMode)) {
    return { error: 'Event mode must be Server or DM.' };
  }

  const targetType = body.target_type ?? current?.target_type ?? (deliveryMode === 'dm' ? 'user' : 'channel');
  if (!['channel', 'role', 'user'].includes(targetType)) {
    return { error: 'Target type must be Channel, Role, or User.' };
  }

  if (deliveryMode === 'server' && targetType === 'user') {
    return { error: 'Server mode can target channels or roles.' };
  }

  if (deliveryMode === 'dm' && targetType === 'channel') {
    return { error: 'DM mode can target users or roles.' };
  }

  const targetId = parseSnowflake(body.target_id ?? current?.target_id);
  if (!targetId) {
    return { error: 'Select a valid target before saving.' };
  }

  const channelId =
    deliveryMode === 'server' && targetType === 'channel'
      ? targetId
      : current?.channel_id || getDefaultReminderChannelId();
  const creatorId = deliveryMode === 'dm' && targetType === 'user' ? targetId : null;
  const mentionRoleId =
    deliveryMode === 'server' ? parseSnowflake(body.mention_role_id ?? current?.mention_role_id) : null;

  const record = {
    id: current?.id || crypto.randomUUID(),
    desc,
    time,
    daily: parseBoolean(body.daily, current?.daily ?? false),
    enabled: parseBoolean(body.enabled, current?.enabled ?? true),
    delivery_mode: deliveryMode,
    target_type: targetType,
    target_id: targetId,
    mention_role_id: mentionRoleId,
    channel_id: channelId,
    creator_id: creatorId,
    attending: current?.attending || [],
    not_attending: current?.not_attending || [],
    vote_message_id: current?.vote_message_id || null,
    vote_message_map: current?.vote_message_map || {},
    last_vote_date: current?.last_vote_date || null,
    last_reminded_date: current?.last_reminded_date || null,
    event_date: current?.event_date || null,
    voting_closed: current?.voting_closed || false,
    vc_channel_id: parseSnowflake(body.vc_channel_id ?? current?.vc_channel_id)
  };

  if (current && record.time !== current.time) {
    record.vote_message_id = null;
    record.vote_message_map = {};
    record.last_vote_date = null;
    record.last_reminded_date = null;
    record.event_date = null;
    record.voting_closed = false;
  }

  return { record };
}

class LegacyStoreService {
  ensureDataFiles() {
    ensureDirectory(require('path').dirname(REMINDERS_PATH));

    const store = this.readStore();
    const legacyWelcome = readSnowflakeJson(LEGACY_WELCOME_PATH, {});
    store.__welcome__ = normalizeWelcomeConfig(store.__welcome__ ?? legacyWelcome);
    store.__logs__ = normalizeLogSettings(store.__logs__);
    store.__logs_v2__ = normalizeDiscordLogsConfig(store.__logs_v2__);
    store.__autorole__ = normalizeAutoRoleConfig(store.__autorole__);
    store.__notifications__ = normalizeNotificationConfig(store.__notifications__);
    if (!store.__activity__ || !store.__activity__.last_reset) {
      store.__activity__ = { users: {}, last_reset: Math.floor(Date.now() / 1000) };
    }
    if (!store.__activity_config__ || typeof store.__activity_config__ !== 'object') {
      store.__activity_config__ = { afk_channel_id: null };
    }
    if (!store.__strikes__ || typeof store.__strikes__ !== 'object') {
      store.__strikes__ = {};
    }
    if (!store.__strikes_config__ || typeof store.__strikes_config__ !== 'object') {
      store.__strikes_config__ = { expiry_days: 7, strike_mapping: {} };
    }
    writeSnowflakeJson(REMINDERS_PATH, store);
    writeSnowflakeJson(LEGACY_WELCOME_PATH, store.__welcome__);
  }

  readStore() {
    const store = readSnowflakeJson(REMINDERS_PATH, {});
    if (!store || typeof store !== 'object' || Array.isArray(store)) {
      return {};
    }
    return store;
  }

  writeStore(store) {
    writeSnowflakeJson(REMINDERS_PATH, store);
  }

  getWelcomeConfig(store = this.readStore()) {
    return normalizeWelcomeConfig(store.__welcome__);
  }

  setWelcomeConfig(partial) {
    const store = this.readStore();
    const next = normalizeWelcomeConfig({ ...this.getWelcomeConfig(store), ...partial });
    store.__welcome__ = next;
    this.writeStore(store);
    writeSnowflakeJson(LEGACY_WELCOME_PATH, next);
    return next;
  }

  getLogSettings(store = this.readStore()) {
    return normalizeLogSettings(store.__logs__);
  }

  setLogSettings(partial) {
    const store = this.readStore();
    const next = normalizeLogSettings({ ...this.getLogSettings(store), ...partial });
    store.__logs__ = next;
    this.writeStore(store);
    return next;
  }

  getDiscordLogsConfig(store = this.readStore()) {
    return normalizeDiscordLogsConfig(store.__logs_v2__);
  }

  setDiscordLogsConfig(partial) {
    const store = this.readStore();
    const current = this.getDiscordLogsConfig(store);
    const next = {
      ...current,
      enabled: partial?.enabled !== undefined ? parseBoolean(partial.enabled, false) : current.enabled,
      categories: Array.isArray(partial?.categories)
        ? partial.categories.map((category) => ({
            name: String(category.name || 'Unnamed Category'),
            enabled: parseBoolean(category.enabled, true),
            logs: Array.isArray(category.logs) ? category.logs.map(String) : [],
            channel_id: parseSnowflake(category.channel_id)
          }))
        : current.categories
    };
    store.__logs_v2__ = next;
    this.writeStore(store);
    return next;
  }

  getAutoRoleConfig(store = this.readStore()) {
    return normalizeAutoRoleConfig(store.__autorole__);
  }

  setAutoRoleConfig(partial) {
    const store = this.readStore();
    const next = normalizeAutoRoleConfig({ ...this.getAutoRoleConfig(store), ...partial });
    store.__autorole__ = next;
    this.writeStore(store);
    return next;
  }

  getNotificationConfig(store = this.readStore()) {
    return normalizeNotificationConfig(store.__notifications__);
  }

  setNotificationConfig(partial) {
    const store = this.readStore();
    const next = normalizeNotificationConfig({ ...this.getNotificationConfig(store), ...partial });
    store.__notifications__ = next;
    this.writeStore(store);
    return next;
  }

  getActivityStats(store = this.readStore()) {
    const raw = store.__activity__;
    return {
      users: raw && typeof raw.users === 'object' && !Array.isArray(raw.users) ? raw.users : {},
      last_reset: Number(raw?.last_reset || 0)
    };
  }

  getActivityConfig(store = this.readStore()) {
    const config = store.__activity_config__ || {};
    return {
      afk_channel_id: parseSnowflake(config.afk_channel_id) || null
    };
  }

  setActivityConfig(partial) {
    const store = this.readStore();
    const next = {
      ...this.getActivityConfig(store),
      afk_channel_id: partial?.afk_channel_id !== undefined ? parseSnowflake(partial.afk_channel_id) || null : this.getActivityConfig(store).afk_channel_id
    };
    store.__activity_config__ = next;
    this.writeStore(store);
    return next;
  }

  resetActivityStats() {
    const store = this.readStore();
    const next = {
      users: {},
      last_reset: Math.floor(Date.now() / 1000)
    };
    store.__activity__ = next;
    this.writeStore(store);
    return next;
  }

  getVcConfig(store = this.readStore()) {
    return normalizeVcConfig(store.__vc_config__);
  }

  setVcConfig(partial) {
    const store = this.readStore();
    const next = normalizeVcConfig({ ...this.getVcConfig(store), ...partial });
    store.__vc_config__ = next;
    this.writeStore(store);
    return next;
  }

  getStrikeConfig(store = this.readStore()) {
    return getStrikeConfigFromInput(store.__strikes_config__, store.__autorole__);
  }

  setStrikeConfig(partial) {
    const store = this.readStore();
    const current = this.getStrikeConfig(store);
    const next = {
      ...current,
      ...partial,
      strike_mapping: partial?.strike_mapping !== undefined
        ? normalizeAutoRoleConfig({ strike_mapping: partial.strike_mapping }).strike_mapping
        : current.strike_mapping
    };
    store.__strikes_config__ = next;
    this.writeStore(store);
    return next;
  }

  getUserStrikes(userId, store = this.readStore()) {
    const allStrikes = store.__strikes__ || {};
    return normalizeStrikeData(allStrikes[String(userId)] || { user_id: userId });
  }

  setUserStrikes(userId, strikeData) {
    const store = this.readStore();
    if (!store.__strikes__) {
      store.__strikes__ = {};
    }
    store.__strikes__[String(userId)] = normalizeStrikeData(strikeData);
    this.writeStore(store);
    return store.__strikes__[String(userId)];
  }

  listEvents(store = this.readStore()) {
    return Object.entries(store)
      .filter(([key, value]) => !RESERVED_KEYS.has(key) && !key.startsWith('__') && value && typeof value === 'object' && !Array.isArray(value))
      .map(([id, value]) => normalizeEvent(id, value))
      .sort((left, right) => {
        const leftTime = left.time || '99:99';
        const rightTime = right.time || '99:99';
        if (leftTime !== rightTime) {
          return leftTime.localeCompare(rightTime);
        }
        return left.desc.localeCompare(right.desc);
      });
  }

  createEvent(input) {
    const store = this.readStore();
    const result = buildEventRecord(input, null);
    if (result.error) {
      return result;
    }

    store[result.record.id] = result.record;
    this.writeStore(store);
    return { event: normalizeEvent(result.record.id, result.record) };
  }

  updateEvent(eventId, input) {
    const store = this.readStore();
    const existing = store[String(eventId)];
    if (!existing) {
      return { error: 'That event could not be found.', code: 404 };
    }

    const result = buildEventRecord(input, { id: String(eventId), ...existing });
    if (result.error) {
      return result;
    }

    store[String(eventId)] = result.record;
    this.writeStore(store);
    return { event: normalizeEvent(String(eventId), result.record) };
  }

  toggleEvent(eventId, enabled) {
    const store = this.readStore();
    const current = store[String(eventId)];
    if (!current) {
      return { error: 'That event could not be found.', code: 404 };
    }

    const event = normalizeEvent(String(eventId), current);
    event.enabled = parseBoolean(enabled, !event.enabled);
    store[String(eventId)] = event;
    this.writeStore(store);
    return { event };
  }

  deleteEvent(eventId) {
    const store = this.readStore();
    const current = store[String(eventId)];
    if (!current) {
      return { error: 'That event could not be found.', code: 404 };
    }

    const event = normalizeEvent(String(eventId), current);
    delete store[String(eventId)];
    this.writeStore(store);
    return { event };
  }

  cleanupExpiredStrikes() {
    const store = this.readStore();
    const strikes = store.__strikes__ || {};
    const now = Date.now();
    let changed = false;

    for (const userId of Object.keys(strikes)) {
      const data = normalizeStrikeData(strikes[userId]);
      const nextStrikes = data.strikes.map((strike) => {
        if (strike.status !== 'active') {
          return strike;
        }
        const expiry = Date.parse(strike.expires_at);
        if (Number.isFinite(expiry) && expiry < now) {
          changed = true;
          return {
            ...strike,
            status: 'expired'
          };
        }
        return strike;
      });

      strikes[userId] = {
        ...data,
        strikes: nextStrikes,
        strike_count: nextStrikes.filter((item) => item.status === 'active').length
      };
    }

    if (changed) {
      store.__strikes__ = strikes;
      this.writeStore(store);
    }

    return changed;
  }

  getHealth() {
    const remindersStat = fs.existsSync(REMINDERS_PATH) ? fs.statSync(REMINDERS_PATH) : null;
    return {
      status: 'ok',
      timestamp: Date.now(),
      port: Number(getEnv('PORT', process.env.PORT || 3001)),
      has_discord_credentials: Boolean(getEnv('DISCORD_TOKEN', '') && getEnv('GUILD_ID', '')),
      reminders_last_updated_at: remindersStat ? remindersStat.mtime.toISOString() : null
    };
  }
}

module.exports = {
  LegacyStoreService,
  buildEventRecord,
  normalizeEvent,
  normalizeStrikeData
};
