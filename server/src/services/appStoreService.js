const crypto = require('crypto');
const path = require('path');
const { MongoClient } = require('mongodb');
const { APP_STATE_PATH, getEnv } = require('../config/env');
const { parseSnowflake } = require('../utils/parsers');
const { ensureDirectory, readJson, writeJson } = require('../utils/files');

function createDefaultState() {
  return {
    settings: {
      super_admin_ids: [],
      fam_discord_role_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    web_users: [],
    notifications: [],
    strike_requests: []
  };
}

class AppStoreService {
  constructor(logger = console) {
    this.logger = logger;
    this.mode = 'file';
    this.client = null;
    this.db = null;
    this.fileState = null;
    this.mongoAvailable = false;
  }

  async init() {
    ensureDirectory(path.dirname(APP_STATE_PATH));

    const uri = String(getEnv('MONGODB_URI', '')).trim();
    const dbName = String(getEnv('MONGODB_DB_NAME', 'ind_blades_dashboard')).trim() || 'ind_blades_dashboard';

    if (uri) {
      try {
        this.client = new MongoClient(uri, {
          serverSelectionTimeoutMS: 2500
        });
        await this.client.connect();
        this.db = this.client.db(dbName);
        this.mode = 'mongo';
        this.mongoAvailable = true;
        await this.ensureMongoIndexes();
        return;
      } catch (error) {
        this.logger.warn?.(`[store] MongoDB unavailable, using file fallback: ${error.message}`);
      }
    }

    this.fileState = readJson(APP_STATE_PATH, createDefaultState());
    this.mode = 'file';
    this.mongoAvailable = false;
    this.persistFileState();
  }

  async close() {
    if (this.client) {
      await this.client.close();
    }
  }

  async ensureMongoIndexes() {
    await this.db.collection('web_users').createIndex({ discord_id: 1 }, { unique: true });
    await this.db.collection('notifications').createIndex({ target_user_id: 1, created_at: -1 });
    await this.db.collection('strike_requests').createIndex({ status: 1, created_at: -1 });
  }

  persistFileState() {
    writeJson(APP_STATE_PATH, this.fileState || createDefaultState());
  }

  getStorageMode() {
    return this.mode;
  }

  async getSettings() {
    if (this.mode === 'mongo') {
      const collection = this.db.collection('settings');
      const current = await collection.findOne({ _id: 'app_settings' });
      if (current) {
        return this.normalizeSettings(current);
      }

      const initial = createDefaultState().settings;
      await collection.insertOne({ _id: 'app_settings', ...initial });
      return this.normalizeSettings(initial);
    }

    return this.normalizeSettings(this.fileState?.settings);
  }

  async updateSettings(partial) {
    const current = await this.getSettings();
    const next = this.normalizeSettings({
      ...current,
      ...partial,
      updated_at: new Date().toISOString()
    });

    if (this.mode === 'mongo') {
      await this.db.collection('settings').updateOne(
        { _id: 'app_settings' },
        { $set: next },
        { upsert: true }
      );
      return next;
    }

    this.fileState.settings = next;
    this.persistFileState();
    return next;
  }

  normalizeSettings(value) {
    const input = value && typeof value === 'object' ? value : {};
    const configuredFamRoleId = parseSnowflake(
      getEnv('FAM_DISCORD_ROLE_ID', getEnv('FAMILY_ROLE_ID', getEnv('MEMBER_ROLE_ID', '')))
    );
    const storedFamRoleId = parseSnowflake(input.fam_discord_role_id);

    return {
      super_admin_ids: Array.isArray(input.super_admin_ids) ? input.super_admin_ids.map(String) : [],
      fam_discord_role_id: storedFamRoleId || configuredFamRoleId,
      created_at: input.created_at || new Date().toISOString(),
      updated_at: input.updated_at || new Date().toISOString()
    };
  }

  normalizeManagedUser(value) {
    const input = value && typeof value === 'object' ? value : {};
    return {
      discord_id: String(input.discord_id || ''),
      assigned_role: input.assigned_role || null,
      assigned_by: input.assigned_by ? String(input.assigned_by) : null,
      assigned_at: input.assigned_at || null,
      notes: String(input.notes || '')
    };
  }

  async getManagedUser(discordId) {
    const targetId = String(discordId);

    if (this.mode === 'mongo') {
      const record = await this.db.collection('web_users').findOne({ discord_id: targetId });
      return record ? this.normalizeManagedUser(record) : null;
    }

    const record = (this.fileState?.web_users || []).find((item) => String(item.discord_id) === targetId);
    return record ? this.normalizeManagedUser(record) : null;
  }

  async listManagedUsers() {
    if (this.mode === 'mongo') {
      const records = await this.db.collection('web_users').find({}).toArray();
      return records.map((record) => this.normalizeManagedUser(record));
    }

    return (this.fileState?.web_users || []).map((record) => this.normalizeManagedUser(record));
  }

  async saveManagedUser(record) {
    const normalized = this.normalizeManagedUser(record);
    if (!normalized.discord_id) {
      return null;
    }

    if (this.mode === 'mongo') {
      await this.db.collection('web_users').updateOne(
        { discord_id: normalized.discord_id },
        { $set: normalized },
        { upsert: true }
      );
      return normalized;
    }

    const rows = this.fileState.web_users || [];
    const index = rows.findIndex((item) => String(item.discord_id) === normalized.discord_id);
    if (index === -1) {
      rows.push(normalized);
    } else {
      rows[index] = normalized;
    }
    this.fileState.web_users = rows;
    this.persistFileState();
    return normalized;
  }

  async clearManagedRole(discordId) {
    const targetId = String(discordId);

    if (this.mode === 'mongo') {
      await this.db.collection('web_users').deleteOne({ discord_id: targetId });
      return;
    }

    this.fileState.web_users = (this.fileState.web_users || []).filter((item) => String(item.discord_id) !== targetId);
    this.persistFileState();
  }

  normalizeNotification(value) {
    const input = value && typeof value === 'object' ? value : {};
    return {
      id: String(input.id || input._id || crypto.randomUUID()),
      target_user_id: String(input.target_user_id || ''),
      actor_user_id: input.actor_user_id ? String(input.actor_user_id) : null,
      type: String(input.type || 'system'),
      title: String(input.title || 'Notification'),
      message: String(input.message || ''),
      meta: input.meta && typeof input.meta === 'object' && !Array.isArray(input.meta) ? input.meta : {},
      read_at: input.read_at || null,
      created_at: input.created_at || new Date().toISOString()
    };
  }

  async listNotificationsForUser(userId) {
    const targetId = String(userId);

    if (this.mode === 'mongo') {
      const records = await this.db.collection('notifications')
        .find({ target_user_id: targetId })
        .sort({ created_at: -1 })
        .limit(100)
        .toArray();
      return records.map((record) => this.normalizeNotification(record));
    }

    return (this.fileState.notifications || [])
      .filter((item) => String(item.target_user_id) === targetId)
      .map((item) => this.normalizeNotification(item))
      .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
      .slice(0, 100);
  }

  async createNotifications(items) {
    const docs = (Array.isArray(items) ? items : [items])
      .map((item) => this.normalizeNotification(item))
      .filter((item) => item.target_user_id);

    if (docs.length === 0) {
      return [];
    }

    if (this.mode === 'mongo') {
      await this.db.collection('notifications').insertMany(docs.map((doc) => ({ ...doc, _id: doc.id })));
      return docs;
    }

    this.fileState.notifications = [...(this.fileState.notifications || []), ...docs];
    this.persistFileState();
    return docs;
  }

  async markNotificationRead(notificationId, userId) {
    const id = String(notificationId);
    const targetId = String(userId);
    const readAt = new Date().toISOString();

    if (this.mode === 'mongo') {
      await this.db.collection('notifications').updateOne(
        { _id: id, target_user_id: targetId },
        { $set: { read_at: readAt } }
      );
      return readAt;
    }

    this.fileState.notifications = (this.fileState.notifications || []).map((item) => {
      if (String(item.id) === id && String(item.target_user_id) === targetId) {
        return { ...item, read_at: readAt };
      }
      return item;
    });
    this.persistFileState();
    return readAt;
  }

  async markAllNotificationsRead(userId) {
    const targetId = String(userId);
    const readAt = new Date().toISOString();

    if (this.mode === 'mongo') {
      await this.db.collection('notifications').updateMany(
        { target_user_id: targetId, read_at: null },
        { $set: { read_at: readAt } }
      );
      return readAt;
    }

    this.fileState.notifications = (this.fileState.notifications || []).map((item) => {
      if (String(item.target_user_id) === targetId && !item.read_at) {
        return { ...item, read_at: readAt };
      }
      return item;
    });
    this.persistFileState();
    return readAt;
  }

  normalizeStrikeRequest(value) {
    const input = value && typeof value === 'object' ? value : {};
    return {
      id: String(input.id || input._id || crypto.randomUUID()),
      requester_user_id: String(input.requester_user_id || ''),
      target_user_ids: Array.isArray(input.target_user_ids) ? input.target_user_ids.map(String) : [],
      reason: String(input.reason || ''),
      violation_time: input.violation_time || null,
      proof_links: Array.isArray(input.proof_links) ? input.proof_links.map(String) : [],
      witness_text: String(input.witness_text || ''),
      status: String(input.status || 'pending'),
      reviewer_user_id: input.reviewer_user_id ? String(input.reviewer_user_id) : null,
      review_note: String(input.review_note || ''),
      created_at: input.created_at || new Date().toISOString(),
      updated_at: input.updated_at || new Date().toISOString()
    };
  }

  async listStrikeRequests() {
    if (this.mode === 'mongo') {
      const records = await this.db.collection('strike_requests')
        .find({})
        .sort({ created_at: -1 })
        .limit(200)
        .toArray();
      return records.map((record) => this.normalizeStrikeRequest(record));
    }

    return (this.fileState.strike_requests || [])
      .map((record) => this.normalizeStrikeRequest(record))
      .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
      .slice(0, 200);
  }

  async getStrikeRequestById(id) {
    const requestId = String(id);

    if (this.mode === 'mongo') {
      const record = await this.db.collection('strike_requests').findOne({ _id: requestId });
      return record ? this.normalizeStrikeRequest(record) : null;
    }

    const record = (this.fileState.strike_requests || []).find((item) => String(item.id) === requestId);
    return record ? this.normalizeStrikeRequest(record) : null;
  }

  async saveStrikeRequest(record) {
    const normalized = this.normalizeStrikeRequest(record);

    if (this.mode === 'mongo') {
      await this.db.collection('strike_requests').updateOne(
        { _id: normalized.id },
        { $set: normalized },
        { upsert: true }
      );
      return normalized;
    }

    const rows = this.fileState.strike_requests || [];
    const index = rows.findIndex((item) => String(item.id) === normalized.id);
    if (index === -1) {
      rows.push(normalized);
    } else {
      rows[index] = normalized;
    }
    this.fileState.strike_requests = rows;
    this.persistFileState();
    return normalized;
  }
}

module.exports = {
  AppStoreService
};
