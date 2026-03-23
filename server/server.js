const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const session = require('express-session');
const cors = require('cors');
const { Server } = require('socket.io');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const REMINDERS_PATH = path.join(DATA_DIR, 'reminders.json');
const LOGS_PATH = path.join(DATA_DIR, 'logs.json');
const COMMANDS_PATH = path.join(DATA_DIR, 'commands.json');
const LEGACY_WELCOME_PATH = path.join(ROOT_DIR, 'welcome.json');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const RESERVED_KEYS = new Set(['__activity__', '__activity_config__', '__welcome__', '__logs__', '__logs_v2__', '__notifications__', '__vc_config__', '__strikes__', '__strikes_config__', '__discord_logs__']);
const SNOWFLAKE_FIELD_PATTERN = /(:\s*)(\d{15,})(?=\s*[,}\]])/g;
const SNOWFLAKE_STRING_PATTERN = /(:\s*)"(\d{15,})"(?=\s*[,}\]])/g;

function parseEnvFile() {
  const values = {};
  try {
    const raw = fs.readFileSync(ENV_PATH, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)$/);
      if (!match) {
        continue;
      }
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      values[match[1]] = value;
    }
  } catch {}
  return values;
}

const fileEnv = parseEnvFile();

function getEnv(name, fallback = '') {
  if (process.env[name] !== undefined) {
    return process.env[name];
  }
  if (fileEnv[name] !== undefined) {
    return fileEnv[name];
  }
  return fallback;
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

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
  ensureDirectory(path.dirname(filePath));
  const raw = JSON.stringify(value, null, 2).replace(SNOWFLAKE_STRING_PATTERN, '$1$2');
  fs.writeFileSync(filePath, raw, 'utf8');
}

function parseSnowflake(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) {
    return null;
  }
  return text;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  return Boolean(value);
}

function normalizeTime(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) {
    return null;
  }
  const [hoursText, minutesText] = trimmed.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return `${hoursText}:${minutesText}`;
}

function readStore() {
  const store = readSnowflakeJson(REMINDERS_PATH, {});
  if (!store || typeof store !== 'object' || Array.isArray(store)) {
    return {};
  }
  return store;
}

function writeStore(store) {
  writeSnowflakeJson(REMINDERS_PATH, store);
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

const DISCORD_LOG_CATEGORIES = ['moderation', 'voice', 'message'];

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

function getDiscordLogsConfig(store = readStore()) {
  return normalizeDiscordLogsConfig(store.__logs_v2__);
}

function setDiscordLogsConfig(partial) {
  const store = readStore();
  const current = getDiscordLogsConfig(store);
  let next = { ...current };
  if (Object.prototype.hasOwnProperty.call(partial || {}, 'enabled')) {
    next.enabled = parseBoolean(partial.enabled, false);
  }
  if (Array.isArray(partial?.categories)) {
    next.categories = partial.categories.map(cat => ({
      name: String(cat.name || 'Unnamed Category'),
      enabled: parseBoolean(cat.enabled, true),
      logs: Array.isArray(cat.logs) ? cat.logs.map(String) : [],
      channel_id: parseSnowflake(cat.channel_id)
    }));
  }
  store.__logs_v2__ = next;
  writeStore(store);
  return next;
}

function normalizeAutoRoleConfig(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    join_role_id: parseSnowflake(input.join_role_id),
    bindings: Array.isArray(input.bindings)
      ? input.bindings
          .filter((b) => b && typeof b === 'object' && b.role_a && b.role_b)
          .map((b) => ({ role_a: String(b.role_a), role_b: String(b.role_b) }))
      : []
  };
}

function normalizeStrikeData(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    user_id: parseSnowflake(input.user_id),
    strikes: Array.isArray(input.strikes)
      ? input.strikes.map((s) => ({
          reason: String(s.reason || 'Missed Event'),
          timestamp: s.timestamp || new Date().toISOString(),
          expires_at: s.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }))
      : [],
    strike_count: Number(input.strike_count || 0)
  };
}

function getStrikeConfig() {
  const store = readStore();
  const config = store.__strikes_config__ || {};
  const autorole = store.__autorole__ || {};
  return {
    expiry_days: Number(config.expiry_days || 7),
    strike_mapping: config.strike_mapping && typeof config.strike_mapping === 'object'
      ? config.strike_mapping
      : (autorole.strike_mapping && typeof autorole.strike_mapping === 'object' ? autorole.strike_mapping : {})
  };
}

function setStrikeConfig(partial) {
  const store = readStore();
  const current = getStrikeConfig();
  const next = { ...current, ...partial };
  if (partial?.strike_mapping !== undefined) {
    next.strike_mapping = partial.strike_mapping && typeof partial.strike_mapping === 'object'
      ? Object.fromEntries(
          Object.entries(partial.strike_mapping)
            .filter(([, v]) => v != null && v !== '')
            .map(([k, v]) => [String(k), String(v)])
        )
      : {};
  }
  store.__strikes_config__ = next;
  writeStore(store);
  return store.__strikes_config__;
}

function getUserStrikes(userId) {
  const store = readStore();
  const allStrikes = store.__strikes__ || {};
  return normalizeStrikeData(allStrikes[userId] || { user_id: userId });
}

function setUserStrikes(userId, strikeData) {
  const store = readStore();
  if (!store.__strikes__) store.__strikes__ = {};
  store.__strikes__[userId] = normalizeStrikeData(strikeData);
  writeStore(store);
  return store.__strikes__[userId];
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

function getVcConfig(store = readStore()) {
  return normalizeVcConfig(store.__vc_config__);
}

function setVcConfig(partial) {
  const store = readStore();
  const current = getVcConfig(store);
  const next = normalizeVcConfig({ ...current, ...partial });
  store.__vc_config__ = next;
  writeStore(store);
  return next;
}

function syncLegacyWelcome(config) {
  writeSnowflakeJson(LEGACY_WELCOME_PATH, config);
}

function ensureDataFiles() {
  ensureDirectory(DATA_DIR);

  const store = readStore();
  const legacyWelcome = readSnowflakeJson(LEGACY_WELCOME_PATH, {});
  store.__welcome__ = normalizeWelcomeConfig(store.__welcome__ ?? legacyWelcome);
  store.__logs__ = normalizeLogSettings(store.__logs__);
  if (!store.__logs_v2__ || !Array.isArray(store.__logs_v2__.categories)) {
    store.__logs_v2__ = normalizeDiscordLogsConfig(store.__logs_v2__);
  }
  store.__autorole__ = normalizeAutoRoleConfig(store.__autorole__);
  store.__notifications__ = normalizeNotificationConfig(store.__notifications__);
  if (!store.__activity__ || !store.__activity__.last_reset) {
    store.__activity__ = { users: {}, last_reset: Math.floor(Date.now() / 1000) };
  }
  if (!store.__activity_config__ || typeof store.__activity_config__ !== 'object') {
    store.__activity_config__ = { afk_channel_id: null };
  }
  writeStore(store);
  syncLegacyWelcome(store.__welcome__);

  if (!fs.existsSync(LOGS_PATH)) {
    writeJson(LOGS_PATH, []);
  }
  if (!fs.existsSync(COMMANDS_PATH)) {
    writeJson(COMMANDS_PATH, []);
  }
}

function getWelcomeConfig(store = readStore()) {
  return normalizeWelcomeConfig(store.__welcome__);
}

function setWelcomeConfig(partial) {
  const store = readStore();
  const next = normalizeWelcomeConfig({ ...getWelcomeConfig(store), ...partial });
  store.__welcome__ = next;
  writeStore(store);
  syncLegacyWelcome(next);
  return next;
}

function getLogSettings(store = readStore()) {
  return normalizeLogSettings(store.__logs__);
}

function setLogSettings(partial) {
  const store = readStore();
  const next = normalizeLogSettings({ ...getLogSettings(store), ...partial });
  store.__logs__ = next;
  writeStore(store);
  return next;
}

function getAutoRoleConfig(store = readStore()) {
  return normalizeAutoRoleConfig(store.__autorole__);
}

function setAutoRoleConfig(partial) {
  const store = readStore();
  const current = getAutoRoleConfig(store);
  const next = normalizeAutoRoleConfig({ ...current, ...partial });
  store.__autorole__ = next;
  writeStore(store);
  return next;
}

function getNotificationConfig(store = readStore()) {
  return normalizeNotificationConfig(store.__notifications__);
}

function setNotificationConfig(partial) {
  const store = readStore();
  const current = getNotificationConfig(store);
  const next = normalizeNotificationConfig({ ...current, ...partial });
  store.__notifications__ = next;
  writeStore(store);
  return next;
}

function getActivityStats(store = readStore()) {
  const raw = store.__activity__;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { users: {}, last_reset: 0 };
  }
  return {
    users: raw.users && typeof raw.users === 'object' && !Array.isArray(raw.users) ? raw.users : {},
    last_reset: Number(raw.last_reset || 0)
  };
}

function resetActivityStats() {
  const store = readStore();
  const next = {
    users: {},
    last_reset: Math.floor(Date.now() / 1000)
  };
  store.__activity__ = next;
  writeStore(store);
  return next;
}

function getActivityConfig(store = readStore()) {
  const c = store.__activity_config__ || {};
  return { afk_channel_id: parseSnowflake(c.afk_channel_id) || null };
}

function setActivityConfig(partial) {
  const store = readStore();
  const current = getActivityConfig(store);
  const next = { ...current, ...partial };
  if (partial?.afk_channel_id !== undefined) {
    next.afk_channel_id = parseSnowflake(partial.afk_channel_id) || null;
  }
  store.__activity_config__ = next;
  writeStore(store);
  return next;
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
    attending: Array.isArray(item.attending) ? item.attending : (Array.isArray(item.going) ? item.going : []),
    not_attending: Array.isArray(item.not_attending)
      ? item.not_attending.map((n) => typeof n === 'object' && n?.user_id
          ? { user_id: String(n.user_id), reason: String(n.reason || 'No reason'), timestamp: n.timestamp || null }
          : { user_id: String(n), reason: 'No reason', timestamp: null })
      : (Array.isArray(item.not_sure) ? item.not_sure.map((n) => typeof n === 'object' && n?.user_id ? n : { user_id: String(n), reason: 'No reason', timestamp: null }) : []),
    vote_message_id: parseSnowflake(item.vote_message_id),
    vote_message_map:
      item.vote_message_map && typeof item.vote_message_map === 'object' && !Array.isArray(item.vote_message_map)
        ? item.vote_message_map
        : {},
    last_vote_date: item.last_vote_date || null,
    last_reminded_date: item.last_reminded_date || null,
    event_date: item.event_date || null,
    voting_closed: parseBoolean(item.voting_closed, false),
    vc_channel_id: parseSnowflake(item.vc_channel_id)
  };
}

function listEvents(store = readStore()) {
  return Object.entries(store)
    .filter(([key, value]) => !key.startsWith('__') && value && typeof value === 'object' && !Array.isArray(value))
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

function getLogs() {
  const logs = readJson(LOGS_PATH, []);
  return Array.isArray(logs) ? logs : [];
}

function appendLog(message, level = 'info', source = 'server', meta = {}) {
  const logs = getLogs();
  logs.unshift({
    id: crypto.randomUUID(),
    message: String(message),
    level,
    source,
    meta,
    timestamp: new Date().toISOString()
  });
  // Keep last 500 logs only for production stability
  writeJson(LOGS_PATH, logs.slice(0, 500));
}

function getCommands() {
  const commands = readJson(COMMANDS_PATH, []);
  return Array.isArray(commands) ? commands : [];
}

function enqueueCommand(type, payload = {}) {
  const commands = getCommands();
  const command = {
    id: crypto.randomUUID(),
    type,
    payload,
    status: 'pending',
    created_at: new Date().toISOString()
  };
  commands.push(command);
  writeJson(COMMANDS_PATH, commands.slice(-100));
  return command;
}

function getHealth() {
  const remindersStat = fs.existsSync(REMINDERS_PATH) ? fs.statSync(REMINDERS_PATH) : null;
  return {
    status: 'ok',
    timestamp: Date.now(),
    port: Number(getEnv('PORT', process.env.PORT || 3001)),
    has_discord_credentials: Boolean(getEnv('DISCORD_TOKEN', '') && getEnv('GUILD_ID', '')),
    reminders_last_updated_at: remindersStat ? remindersStat.mtime.toISOString() : null
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
  if (deliveryMode !== 'server' && deliveryMode !== 'dm') {
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

async function fetchDiscordJson(endpoint) {
  const token = getEnv('DISCORD_TOKEN', '').trim();
  const guildId = getEnv('GUILD_ID', '').trim();
  if (!token || !guildId) {
    return [];
  }

  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/${endpoint}`, {
      headers: {
        Authorization: `Bot ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Discord API returned ${response.status}`);
    }

    return await response.json();
  } catch {
    return [];
  }
}

let cachedChannels = [];
let lastChannelCacheAt = 0;
async function getChannels() {
  if (Date.now() - lastChannelCacheAt < 60000 && cachedChannels.length > 0) {
    return cachedChannels;
  }

  const channels = await fetchDiscordJson('channels');
  cachedChannels = Array.isArray(channels)
    ? channels
        .filter((channel) => channel && [0, 2, 5].includes(channel.type))
        .map((channel) => ({
          id: String(channel.id),
          name: channel.name,
          type: channel.type
        }))
        .sort((left, right) => left.name.localeCompare(right.name))
    : [];
  lastChannelCacheAt = Date.now();
  return cachedChannels;
}

let cachedRoles = [];
let lastRoleCacheAt = 0;
async function getRoles() {
  if (Date.now() - lastRoleCacheAt < 60000 && cachedRoles.length > 0) {
    return cachedRoles;
  }

  const roles = await fetchDiscordJson('roles');
  cachedRoles = Array.isArray(roles)
    ? roles
        .filter((role) => role && role.name !== '@everyone')
        .map((role) => ({
          id: String(role.id),
          name: role.name
        }))
        .sort((left, right) => left.name.localeCompare(right.name))
    : [];
  lastRoleCacheAt = Date.now();
  return cachedRoles;
}

let cachedUsers = [];
let lastUserCacheAt = 0;
let pendingUserFetch = null;

async function fetchDiscordMembers() {
  const token = getEnv('DISCORD_TOKEN', '').trim();
  const guildId = getEnv('GUILD_ID', '').trim();

  if (!token || !guildId) {
    return [];
  }

  const members = [];
  let after = null;

  while (true) {
    const url = new URL(`https://discord.com/api/v10/guilds/${guildId}/members`);
    url.searchParams.set('limit', '1000');
    if (after) {
      url.searchParams.set('after', after);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bot ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Discord API returned ${response.status}`);
    }

    const batch = await response.json();
    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }

    members.push(...batch);

    if (batch.length < 1000) {
      break;
    }

    after = batch[batch.length - 1]?.user?.id;
    if (!after) {
      break;
    }
  }

  return members;
}

function buildUsersFromActivity(activity) {
  return Object.entries(activity.users || {}).map(([id, stats]) => ({
    id,
    name: `User ${id.slice(-4)}`,
    roles: [],
    joined_at: null,
    voice_time: Number(stats.voice_time || 0),
    messages: Number(stats.messages || 0)
  }));
}

function buildUserResponse(members, activity) {
  const activityUsers = activity.users || {};
  const store = readStore();
  const allStrikes = store.__strikes__ || {};

  const rows = members.map((member) => {
    const user = member.user || {};
    const stats = activityUsers[user.id] || {};
    const strikeData = normalizeStrikeData(allStrikes[user.id] || { user_id: user.id });
    
    return {
      id: user.id,
      name: user.global_name || user.username || `User ${String(user.id || '').slice(-4)}`,
      username: user.username || null,
      roles: Array.isArray(member.roles) ? member.roles.map(String) : [],
      joined_at: member.joined_at || null,
      voice_time: Number(stats.voice_time || 0),
      messages: Number(stats.messages || 0),
      strikes: strikeData.strikes,
      strike_count: strikeData.strike_count
    };
  });

  const knownIds = new Set(rows.map((row) => row.id));

  for (const [userId, stats] of Object.entries(activityUsers)) {
    if (knownIds.has(userId)) {
      continue;
    }
    const strikeData = normalizeStrikeData(allStrikes[userId] || { user_id: userId });
    rows.push({
      id: userId,
      name: `User ${userId.slice(-4)}`,
      username: null,
      roles: [],
      joined_at: null,
      voice_time: Number(stats.voice_time || 0),
      messages: Number(stats.messages || 0),
      strikes: strikeData.strikes,
      strike_count: strikeData.strike_count
    });
  }

  return rows.sort((left, right) => left.name.localeCompare(right.name));
}

async function getUsers() {
  // Reduced cache time to 5 seconds to ensure fresh data while preventing spam
  if (Date.now() - lastUserCacheAt < 5000 && cachedUsers.length > 0) {
    return cachedUsers;
  }

  if (!pendingUserFetch) {
    pendingUserFetch = (async () => {
      const activity = getActivityStats();
      try {
        const members = await fetchDiscordMembers();
        const users = members.length > 0 ? buildUserResponse(members, activity) : buildUsersFromActivity(activity);
        cachedUsers = users;
        lastUserCacheAt = Date.now();
        return users;
      } catch {
        if (cachedUsers.length > 0) {
          return cachedUsers;
        }
        return buildUsersFromActivity(activity);
      } finally {
        pendingUserFetch = null;
      }
    })();
  }

  return pendingUserFetch;
}

function createCorsOptions() {
  const configuredOrigins = getEnv('ALLOWED_ORIGINS', '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    ...configuredOrigins
  ]);

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      try {
        const parsed = new URL(origin);
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
          callback(null, true);
          return;
        }
      } catch {}
      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS']
  };
}

function invalidateCatalogCaches() {
  cachedChannels = [];
  cachedRoles = [];
  cachedUsers = [];
  lastChannelCacheAt = 0;
  lastRoleCacheAt = 0;
  lastUserCacheAt = 0;
}

ensureDataFiles();

const app = express();
const server = http.createServer(app);
const corsOptions = createCorsOptions();
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true
  },
  transports: ['websocket', 'polling'] // Both for reliability
});
const port = getEnv('PORT', 3001);
const dashboardKey = getEnv('DASHBOARD_KEY', 'Blades@123');
const sessionSecret = getEnv('SESSION_SECRET', dashboardKey);

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

let lastManualEmit = 0;

function emitSystemUpdate(type, payload = {}) {
  lastManualEmit = Date.now();
  io.emit('systemUpdate', { type, payload });
  
  // High-priority mapping for Bot Status
  if (type === 'BOT_STATUS_UPDATED') {
    io.emit('systemUpdate', { type: 'BOT_STATUS', payload });
  }

  // Legacy events for backward compatibility
  if (type.startsWith('EVENT_')) io.emit('eventsUpdated');
  if (type === 'WELCOME_UPDATED') io.emit('welcomeUpdated');
  if (type === 'USER_UPDATED') io.emit('statsUpdated');
  if (type === 'LOG_UPDATED') io.emit('logsUpdated');
}

function emitDataRefresh() {
  invalidateCatalogCaches();
  emitSystemUpdate('EVENT_UPDATED');
}

fs.watchFile(REMINDERS_PATH, { interval: 1000 }, (current, previous) => {
  if (current.mtimeMs !== previous.mtimeMs) {
    if (Date.now() - lastManualEmit < 1500) return; // Suppress redundant emit from dashboard action
    invalidateCatalogCaches();
    emitSystemUpdate('EVENT_UPDATED');
  }
});

fs.watchFile(LOGS_PATH, { interval: 1000 }, (current, previous) => {
  if (current.mtimeMs !== previous.mtimeMs) {
    if (Date.now() - lastManualEmit < 1500) return;
    emitSystemUpdate('LOG_UPDATED');
  }
});

fs.watchFile(COMMANDS_PATH, { interval: 1000 }, (current, previous) => {
  if (current.mtimeMs !== previous.mtimeMs) {
    const commands = getCommands();
    const last = commands[commands.length - 1];
    if (last && last.status === 'done') {
      if (last.type === 'strike_added' || last.type === 'strike_removed') {
        invalidateCatalogCaches();
        emitSystemUpdate('USER_UPDATED');
      }
    }
  }
});

io.on('connection', (socket) => {
  socket.emit('connected', {
    ok: true,
    timestamp: Date.now()
  });
});

function requireAuth(req, res, next) {
  if (req.session?.authenticated) {
    next();
    return;
  }
  res.status(401).json({ error: 'Please log in to continue.' });
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime()
  });
});

app.get('/api/bot-status', (req, res) => {
  res.json({
    connected: botState.connected,
    timestamp: Date.now()
  });
});

app.get('/api/test', (req, res) => {
  res.json({
    ...getHealth(),
    authenticated: Boolean(req.session?.authenticated)
  });
});

app.post('/api/login', (req, res) => {
  const key = String(req.body?.key || '').trim();
  if (!key) {
    res.status(400).json({ success: false, error: 'Enter your dashboard key.' });
    return;
  }
  
  // SUPPORT SESSION_SECRET OR DASHBOARD_KEY AS PASSWORD
  const validKeys = [
    String(dashboardKey).trim(),
    String(sessionSecret).trim()
  ].filter(k => k && k !== 'undefined');

  if (!validKeys.includes(key)) {
    appendLog('Failed dashboard login attempt.', 'warning', 'auth');
    res.status(401).json({ success: false, error: 'That login key is not valid.' });
    return;
  }
  
  req.session.authenticated = true;
  appendLog('Dashboard login successful.', 'info', 'auth');
  res.json({ success: true });
});

app.get('/api/check-session', (req, res) => {
  res.json({ authenticated: Boolean(req.session?.authenticated) });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    appendLog('Dashboard session closed.', 'info', 'auth');
    res.json({ success: true });
  });
});

app.get(['/channels', '/api/channels'], requireAuth, async (req, res) => {
  res.json(await getChannels());
});

app.get(['/roles', '/api/roles'], requireAuth, async (req, res) => {
  res.json(await getRoles());
});

app.use('/api', requireAuth);

app.get('/api/dashboard/bootstrap', async (req, res) => {
  const store = readStore();
  const [users, channels, roles] = await Promise.all([getUsers(), getChannels(), getRoles()]);
  res.json({
    health: getHealth(),
    events: listEvents(store),
    welcome: getWelcomeConfig(store),
    log_settings: getLogSettings(store),
    discord_logs: getDiscordLogsConfig(store),
    activity: getActivityStats(store),
    activity_config: getActivityConfig(store),
    autorole: getAutoRoleConfig(store),
    notifications: getNotificationConfig(store),
    strike_config: getStrikeConfig(),
    logs: getLogs(),
    users,
    channels,
    roles
  });
});

app.get('/api/strikes/config', (req, res) => {
  res.json(getStrikeConfig());
});

app.post('/api/strikes/config', (req, res) => {
  const config = setStrikeConfig(req.body || {});
  emitSystemUpdate('STRIKE_CONFIG_UPDATED', config);
  appendLog('Updated strike configuration.', 'info', 'strikes');
  res.json({ success: true, config });
});

app.post('/api/strikes/add', async (req, res) => {
  const { user_id, reason } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'User ID required' });

  const config = getStrikeConfig();
  const strikeData = getUserStrikes(user_id);
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.expiry_days);

  strikeData.strikes.push({
    reason: reason || 'Manual Strike',
    timestamp: new Date().toISOString(),
    expires_at: expiresAt.toISOString()
  });
  strikeData.strike_count = strikeData.strikes.length;
  
  setUserStrikes(user_id, strikeData);
  
  enqueueCommand('strike_added', {
    user_id,
    reason: reason || 'Manual Strike',
    strike_count: strikeData.strike_count
  });

  emitSystemUpdate('STRIKE_ADDED', { user_id, strike_count: strikeData.strike_count });
  appendLog(`Added strike to user ${user_id}.`, 'warning', 'strikes', { user_id });
  res.json({ success: true, strikeData });
});

app.post('/api/strikes/remove', async (req, res) => {
  const { user_id, index } = req.body || {};
  if (!user_id || index === undefined) return res.status(400).json({ error: 'User ID and index required' });

  const strikeData = getUserStrikes(user_id);
  if (strikeData.strikes[index]) {
    strikeData.strikes.splice(index, 1);
    strikeData.strike_count = strikeData.strikes.length;
    setUserStrikes(user_id, strikeData);
    
    enqueueCommand('strike_removed', {
      user_id,
      strike_count: strikeData.strike_count
    });

    emitSystemUpdate('STRIKE_REMOVED', { user_id, strike_count: strikeData.strike_count });
    appendLog(`Removed strike from user ${user_id}.`, 'info', 'strikes', { user_id });
    res.json({ success: true, strikeData });
  } else {
    res.status(404).json({ error: 'Strike not found' });
  }
});

app.get('/api/events', (req, res) => {
  res.json(listEvents());
});

app.post('/api/events/create', (req, res) => {
  const result = buildEventRecord(req.body || {}, null);
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }

  const store = readStore();
  const record = result.record;
  store[record.id] = record;
  writeStore(store);
  invalidateCatalogCaches();

  enqueueCommand('event_created', { event: normalizeEvent(record.id, record) });

  emitSystemUpdate('EVENT_CREATED', { event: normalizeEvent(record.id, record) });
  appendLog(`Created event "${record.desc}".`, 'info', 'events', { id: record.id });
  res.json({ success: true, event: normalizeEvent(record.id, record) });
});

app.post('/api/events/update', (req, res) => {
  const id = String(req.body?.id || '').trim();
  if (!id) {
    res.status(400).json({ error: 'Choose an event to update.' });
    return;
  }

  const store = readStore();
  if (!store[id]) {
    res.status(404).json({ error: 'That event could not be found.' });
    return;
  }

  const result = buildEventRecord(req.body || {}, { id, ...store[id] });
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }

  store[id] = result.record;
  writeStore(store);
  invalidateCatalogCaches();

  enqueueCommand('event_updated', { event: normalizeEvent(id, result.record) });

  emitSystemUpdate('EVENT_UPDATED', { event: normalizeEvent(id, result.record) });
  appendLog(`Updated event "${result.record.desc}".`, 'info', 'events', { id });
  res.json({ success: true, event: normalizeEvent(id, result.record) });
});

app.post('/api/events/toggle', (req, res) => {
  const id = String(req.body?.id || '').trim();
  if (!id) {
    res.status(400).json({ error: 'Choose an event first.' });
    return;
  }

  const store = readStore();
  if (!store[id]) {
    res.status(404).json({ error: 'That event could not be found.' });
    return;
  }

  const event = normalizeEvent(id, store[id]);
  event.enabled = parseBoolean(req.body?.enabled, !event.enabled);
  store[id] = event;
  writeStore(store);
  invalidateCatalogCaches();
  const toggleType = event.enabled ? 'EVENT_RESUMED' : 'EVENT_PAUSED';
  
  enqueueCommand(event.enabled ? 'event_resumed' : 'event_paused', { event });

  emitSystemUpdate(toggleType, { event });
  appendLog(`${event.enabled ? 'Enabled' : 'Disabled'} event "${event.desc}".`, 'info', 'events', { id });
  res.json({ success: true, event });
});

app.post('/api/events/delete', (req, res) => {
  const id = String(req.body?.id || '').trim();
  if (!id) {
    res.status(400).json({ error: 'Choose an event first.' });
    return;
  }

  const store = readStore();
  if (!store[id]) {
    res.status(404).json({ error: 'That event could not be found.' });
    return;
  }

  const event = normalizeEvent(id, store[id]);
  delete store[id];
  writeStore(store);
  invalidateCatalogCaches();

  enqueueCommand('event_deleted', { id, name: event.desc });

  emitSystemUpdate('EVENT_DELETED', { id, name: event.desc });
  appendLog(`Deleted event "${event.desc}".`, 'warning', 'events', { id });
  res.json({ success: true });
});

app.get('/api/welcome', (req, res) => {
  res.json(getWelcomeConfig());
});

app.post('/api/welcome/toggle', (req, res) => {
  const config = setWelcomeConfig({
    enabled: parseBoolean(req.body?.enabled, true)
  });
  emitSystemUpdate('WELCOME_UPDATED', { config });
  appendLog(`Turned ${config.enabled ? 'on' : 'off'} the welcome system.`, 'info', 'welcome');
  res.json({ success: true, config });
});

app.post('/api/welcome/channel', (req, res) => {
  const config = setWelcomeConfig({
    channel_id: parseSnowflake(req.body?.channel_id)
  });
  emitSystemUpdate('WELCOME_UPDATED', { config });
  appendLog('Updated the welcome channel.', 'info', 'welcome');
  res.json({ success: true, config });
});

app.post('/api/welcome/preview', (req, res) => {
  const config = getWelcomeConfig();
  if (!config.channel_id) {
    res.status(400).json({ error: 'Choose a welcome channel before sending a preview.' });
    return;
  }
  enqueueCommand('welcome_preview', {
    channel_id: config.channel_id
  });
  appendLog('Queued a welcome preview message.', 'info', 'welcome');
  res.json({ success: true });
});

app.get('/api/log-settings', (req, res) => {
  res.json(getLogSettings());
});

app.get('/api/discord-logs', (req, res) => {
  res.json(getDiscordLogsConfig());
});

app.post('/api/discord-logs', (req, res) => {
  const config = setDiscordLogsConfig(req.body || {});
  emitSystemUpdate('DISCORD_LOGS_UPDATED', { config });
  appendLog('Updated Discord log settings.', 'info', 'settings');
  res.json({ success: true, config });
});

app.post('/api/log-settings', (req, res) => {
  const partial = {};
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'enabled')) {
    partial.enabled = parseBoolean(req.body?.enabled, true);
  }
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'moderation_channel_id')) {
    partial.moderation_channel_id = parseSnowflake(req.body?.moderation_channel_id);
  }
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'event_channel_id')) {
    partial.event_channel_id = parseSnowflake(req.body?.event_channel_id);
  }
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'system_channel_id')) {
    partial.system_channel_id = parseSnowflake(req.body?.system_channel_id);
  }
  const settings = setLogSettings(partial);
  emitSystemUpdate('LOG_SETTINGS_UPDATED', { settings });
  appendLog('Updated log settings.', 'info', 'settings');
  res.json({ success: true, settings });
});

app.get('/api/activity/stats', (req, res) => {
  res.json(getActivityStats());
});

app.get('/api/activity/config', (req, res) => {
  res.json(getActivityConfig());
});

app.post('/api/activity/config', (req, res) => {
  const config = setActivityConfig(req.body || {});
  emitSystemUpdate('ACTIVITY_CONFIG_UPDATED', { config });
  appendLog('Updated activity config (AFK channel).', 'info', 'activity');
  res.json({ success: true, config });
});

app.post('/api/activity/reset', (req, res) => {
  const stats = resetActivityStats();
  emitSystemUpdate('SYSTEM_REFRESH');
  appendLog('Reset weekly activity stats.', 'warning', 'activity');
  res.json({ success: true, stats });
});

app.get('/api/logs', (req, res) => {
  res.json(getLogs());
});

app.post('/api/logs/clear', (req, res) => {
  writeJson(LOGS_PATH, []);
  emitSystemUpdate('LOG_UPDATED', { cleared: true });
  appendLog('Logs cleared successfully.', 'info', 'system');
  res.json({ success: true });
});

app.get('/api/users', async (req, res) => {
  res.json(await getUsers());
});

app.get('/api/users/:id', async (req, res) => {
  const users = await getUsers();
  const user = users.find((u) => u.id === req.params.id);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  res.json(user);
});

app.get('/api/users/:id/strikes', (req, res) => {
  const data = getUserStrikes(req.params.id);
  res.json(data);
});

app.get('/api/vc-config', (req, res) => {
  res.json(getVcConfig());
});

app.post('/api/vc-config', (req, res) => {
  const config = setVcConfig(req.body || {});
  appendLog('Updated VC config.', 'info', 'settings');
  res.json({ success: true, config });
});

app.get('/api/autorole', (req, res) => {
  res.json(getAutoRoleConfig());
});

app.post('/api/autorole', (req, res) => {
  const config = setAutoRoleConfig(req.body || {});
  emitSystemUpdate('AUTOROLE_UPDATED', { config });
  appendLog('Updated auto role settings.', 'info', 'autorole');
  res.json({ success: true, config });
});

app.get('/api/notifications', (req, res) => {
  res.json(getNotificationConfig());
});

app.post('/api/notifications', (req, res) => {
  const config = setNotificationConfig(req.body || {});
  emitSystemUpdate('NOTIFICATIONS_UPDATED', { config });
  appendLog('Updated notification settings.', 'info', 'notifications');
  res.json({ success: true, config });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    bot: botState.connected ? 'connected' : 'disconnected'
  });
});

app.get('/api/bot-status', (req, res) => {
  res.json({
    status: botState.connected ? 'connected' : 'disconnected'
  });
});

// Bot Heartbeat from Python
app.post('/api/bot/heartbeat', (req, res) => {
  const { connected } = req.body || {};
  if (connected !== undefined) {
    const wasConnected = botState.connected;
    botState.connected = !!connected;
    
    if (wasConnected !== botState.connected) {
      emitSystemUpdate('BOT_STATUS_UPDATED', { connected: botState.connected });
      
      if (botState.connected) {
        appendLog('Discord bot connected.', 'info', 'bot');
        botState.lastAnnounced = true;
      } else {
        appendLog('Discord bot disconnected.', 'warning', 'bot');
        botState.lastAnnounced = false;
      }
    }
  }
  res.json({ success: true });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'That page was not found.' });
});

// --- GLOBAL ERROR HANDLERS ---
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
  appendLog(`Uncaught Exception: ${err.message}`, 'error', 'system');
  // Do NOT exit in production unless necessary
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
  appendLog(`Unhandled Rejection: ${reason}`, 'error', 'system');
});

const { spawn } = require('child_process');

let botRetryDelay = 30000; // Start with 30s
const MAX_BOT_RETRY_DELAY = 300000; // 5 mins
const botState = { connected: false, lastAnnounced: false };

function startBot() {
  const botPath = path.join(ROOT_DIR, 'bot.py');
  console.log(`[INFO] Starting bot process (Retry Delay: ${botRetryDelay / 1000}s)`);
  
  if (global.activeBotProcess) {
    console.log('[INFO] Killing existing bot process before restart...');
    try { global.activeBotProcess.kill(); } catch {}
  }

  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const botProcess = spawn(pythonCmd, [botPath], {
    stdio: 'inherit',
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  });

  global.activeBotProcess = botProcess;

  botProcess.on('close', (code) => {
    botState.connected = false;
    console.error(`[ERROR] Bot process exited with code ${code}.`);
    appendLog(`Bot exited with code ${code}. Re-spawning in ${botRetryDelay / 1000}s...`, 'error', 'bot');
    
    setTimeout(() => {
      // Exponential backoff
      botRetryDelay = Math.min(botRetryDelay * 2, MAX_BOT_RETRY_DELAY);
      startBot();
    }, botRetryDelay);
  });

  botProcess.on('error', (err) => {
    console.error('[ERROR] Bot spawn error:', err);
    appendLog(`Failed to spawn bot: ${err.message}`, 'error', 'bot');
  });

  // Reset delay if bot lasts longer than 2 mins
  setTimeout(() => {
    if (botProcess.exitCode === null) {
      botRetryDelay = 30000;
    }
  }, 120000);
}

startBot();

setInterval(() => {
  try {
    const store = readStore();
    const strikes = store.__strikes__ || {};
    let changed = false;

    for (const userId in strikes) {
      const data = normalizeStrikeData(strikes[userId]);

      const validStrikes = data.strikes.filter(
        s => new Date(s.expires_at) > new Date()
      );

      if (validStrikes.length !== data.strikes.length) {
        data.strikes = validStrikes;
        data.strike_count = validStrikes.length;
        strikes[userId] = data;
        changed = true;

        emitSystemUpdate('STRIKE_REMOVED', { user_id: userId });
      }
    }

    if (changed) {
      store.__strikes__ = strikes;
      writeStore(store);
      appendLog("Expired strikes cleaned automatically.", "info", "system");
    }
  } catch (err) {
    console.error("Strike cleanup error:", err);
  }
}, 60 * 60 * 1000); 
app.set('trust proxy', 1);

global.fetch = global.fetch || require('node-fetch');

app.use(express.static(path.join(ROOT_DIR, 'client/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'client/dist/index.html'));
});

server.listen(port, () => {
  appendLog(`API server listening on port ${port}.`, 'info', 'server');
  console.log(`🚀 Server running on port ${port}`);
});