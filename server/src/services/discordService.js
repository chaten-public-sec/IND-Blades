const { getEnv } = require('../config/env');
const { parseSnowflake } = require('../utils/parsers');

class DiscordService {
  constructor() {
    this.cachedChannels = [];
    this.lastChannelCacheAt = 0;
    this.cachedRoles = [];
    this.lastRoleCacheAt = 0;
    this.cachedUsers = [];
    this.lastUserCacheAt = 0;
    this.pendingUserFetch = null;
  }

  get token() {
    return String(getEnv('DISCORD_TOKEN', '')).trim();
  }

  get guildId() {
    return String(getEnv('GUILD_ID', '')).trim();
  }

  get clientId() {
    return String(getEnv('DISCORD_CLIENT_ID', '')).trim();
  }

  get clientSecret() {
    return String(getEnv('DISCORD_CLIENT_SECRET', '')).trim();
  }

  get redirectUri() {
    return String(getEnv('DISCORD_REDIRECT_URI', '')).trim();
  }

  hasBotCredentials() {
    return Boolean(this.token && this.guildId);
  }

  hasOAuthCredentials() {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  buildOAuthUrl(state) {
    const url = new URL('https://discord.com/oauth2/authorize');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('scope', 'identify');
    if (state) {
      url.searchParams.set('state', state);
    }
    return url.toString();
  }

  async exchangeCode(code) {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'authorization_code',
      code: String(code || ''),
      redirect_uri: this.redirectUri
    });

    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });

    if (!response.ok) {
      throw new Error(`Discord token exchange failed with ${response.status}`);
    }

    return response.json();
  }

  async fetchCurrentUser(accessToken) {
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Discord user lookup failed with ${response.status}`);
    }

    return response.json();
  }

  async fetchDiscordJson(endpoint) {
    if (!this.hasBotCredentials()) {
      return [];
    }

    const response = await fetch(`https://discord.com/api/v10/guilds/${this.guildId}/${endpoint}`, {
      headers: {
        Authorization: `Bot ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Discord API returned ${response.status}`);
    }

    return response.json();
  }

  async fetchGuildMember(userId) {
    if (!this.hasBotCredentials()) {
      return null;
    }

    const response = await fetch(`https://discord.com/api/v10/guilds/${this.guildId}/members/${userId}`, {
      headers: {
        Authorization: `Bot ${this.token}`
      }
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Discord member lookup failed with ${response.status}`);
    }

    return response.json();
  }

  async getChannels() {
    if (Date.now() - this.lastChannelCacheAt < 60000 && this.cachedChannels.length > 0) {
      return this.cachedChannels;
    }

    try {
      const channels = await this.fetchDiscordJson('channels');
      this.cachedChannels = Array.isArray(channels)
        ? channels
            .filter((channel) => channel && [0, 2, 5].includes(channel.type))
            .map((channel) => ({
              id: String(channel.id),
              name: channel.name,
              type: channel.type
            }))
            .sort((left, right) => left.name.localeCompare(right.name))
        : [];
      this.lastChannelCacheAt = Date.now();
      return this.cachedChannels;
    } catch {
      return [];
    }
  }

  async getRoles() {
    if (Date.now() - this.lastRoleCacheAt < 60000 && this.cachedRoles.length > 0) {
      return this.cachedRoles;
    }

    try {
      const roles = await this.fetchDiscordJson('roles');
      this.cachedRoles = Array.isArray(roles)
        ? roles
            .filter((role) => role && role.name !== '@everyone')
            .map((role) => ({
              id: String(role.id),
              name: role.name,
              color: Number(role.color || 0),
              position: Number(role.position || 0)
            }))
            .sort((left, right) => right.position - left.position || left.name.localeCompare(right.name))
        : [];
      this.lastRoleCacheAt = Date.now();
      return this.cachedRoles;
    } catch {
      return [];
    }
  }

  async fetchDiscordMembers() {
    if (!this.hasBotCredentials()) {
      return [];
    }

    const members = [];
    let after = null;

    while (true) {
      const url = new URL(`https://discord.com/api/v10/guilds/${this.guildId}/members`);
      url.searchParams.set('limit', '1000');
      if (after) {
        url.searchParams.set('after', after);
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bot ${this.token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Discord members lookup failed with ${response.status}`);
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

  buildUsersFromActivity(activity) {
    return Object.entries(activity.users || {}).map(([id, stats]) => ({
      id,
      name: `User ${id.slice(-4)}`,
      username: null,
      avatar_url: null,
      roles: [],
      joined_at: null,
      voice_time: Number(stats.voice_time || 0),
      messages: Number(stats.messages || 0),
      nickname: null
    }));
  }

  buildUserResponse(members, activity, legacyStoreService) {
    const activityUsers = activity.users || {};
    const store = legacyStoreService.readStore();
    const roleMap = new Map();
    const strikeMap = store.__strikes__ || {};

    const rows = members.map((member) => {
      const user = member.user || {};
      const stats = activityUsers[user.id] || {};
      const strikeData = legacyStoreService.getUserStrikes(user.id, store);
      const avatarUrl = this.resolveAvatarUrl(user);

      roleMap.set(String(user.id), Array.isArray(member.roles) ? member.roles.map(String) : []);

      return {
        id: String(user.id),
        name: user.global_name || user.username || `User ${String(user.id || '').slice(-4)}`,
        username: user.username || null,
        nickname: member.nick || null,
        avatar_url: avatarUrl,
        roles: Array.isArray(member.roles) ? member.roles.map(String) : [],
        joined_at: member.joined_at || null,
        voice_time: Number(stats.voice_time || 0),
        messages: Number(stats.messages || 0),
        strikes: strikeData.strikes,
        strike_count: strikeData.strike_count,
        active_strike_count: strikeData.strikes.filter((item) => item.status === 'active').length
      };
    });

    const knownIds = new Set(rows.map((row) => row.id));

    for (const [userId, stats] of Object.entries(activityUsers)) {
      if (knownIds.has(userId)) {
        continue;
      }
      const strikeData = legacyStoreService.getUserStrikes(userId, store);
      rows.push({
        id: String(userId),
        name: `User ${userId.slice(-4)}`,
        username: null,
        nickname: null,
        avatar_url: null,
        roles: [],
        joined_at: null,
        voice_time: Number(stats.voice_time || 0),
        messages: Number(stats.messages || 0),
        strikes: strikeData.strikes,
        strike_count: strikeData.strike_count,
        active_strike_count: strikeData.strikes.filter((item) => item.status === 'active').length
      });
    }

    return rows.sort((left, right) => left.name.localeCompare(right.name));
  }

  async getUsers(activity, legacyStoreService) {
    if (Date.now() - this.lastUserCacheAt < 5000 && this.cachedUsers.length > 0) {
      return this.cachedUsers;
    }

    if (!this.pendingUserFetch) {
      this.pendingUserFetch = (async () => {
        try {
          const members = await this.fetchDiscordMembers();
          const users = members.length > 0
            ? this.buildUserResponse(members, activity, legacyStoreService)
            : this.buildUsersFromActivity(activity);
          this.cachedUsers = users;
          this.lastUserCacheAt = Date.now();
          return users;
        } catch {
          if (this.cachedUsers.length > 0) {
            return this.cachedUsers;
          }
          return this.buildUsersFromActivity(activity);
        } finally {
          this.pendingUserFetch = null;
        }
      })();
    }

    return this.pendingUserFetch;
  }

  invalidateCatalogCaches() {
    this.cachedChannels = [];
    this.cachedRoles = [];
    this.cachedUsers = [];
    this.lastChannelCacheAt = 0;
    this.lastRoleCacheAt = 0;
    this.lastUserCacheAt = 0;
  }

  resolveAvatarUrl(user) {
    if (!user?.id || !user?.avatar) {
      return null;
    }

    const extension = String(user.avatar).startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=256`;
  }
}

module.exports = {
  DiscordService
};
