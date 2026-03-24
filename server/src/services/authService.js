const crypto = require('crypto');
const { getEnv } = require('../config/env');
const { parseCookies, serializeCookie } = require('../utils/http');
const { signToken, verifyToken } = require('../utils/jwt');

const AUTH_COOKIE_NAME = 'ind_blades_auth';
const OAUTH_STATE_COOKIE_NAME = 'ind_blades_oauth_state';
const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

class AuthService {
  constructor({ discordService, roleService, logger = console }) {
    this.discordService = discordService;
    this.roleService = roleService;
    this.logger = logger;
  }

  get jwtSecret() {
    return String(
      getEnv('JWT_SECRET', getEnv('SESSION_SECRET', getEnv('DASHBOARD_KEY', 'ind-blades-secret')))
    ).trim();
  }

  get clientUrl() {
    const explicit = String(getEnv('CLIENT_URL', '')).trim();
    return explicit || 'http://localhost:5173';
  }

  buildCookie(value, maxAgeSeconds = SEVEN_DAYS_IN_SECONDS) {
    return serializeCookie(AUTH_COOKIE_NAME, value, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: false,
      path: '/',
      maxAge: maxAgeSeconds,
      expires: new Date(Date.now() + maxAgeSeconds * 1000)
    });
  }

  buildExpiredCookie() {
    return serializeCookie(AUTH_COOKIE_NAME, '', {
      httpOnly: true,
      sameSite: 'Lax',
      secure: false,
      path: '/',
      maxAge: 0,
      expires: new Date(0)
    });
  }

  buildOAuthStateCookie(value) {
    return serializeCookie(OAUTH_STATE_COOKIE_NAME, value, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: false,
      path: '/',
      maxAge: 10 * 60,
      expires: new Date(Date.now() + 10 * 60 * 1000)
    });
  }

  buildExpiredOAuthStateCookie() {
    return serializeCookie(OAUTH_STATE_COOKIE_NAME, '', {
      httpOnly: true,
      sameSite: 'Lax',
      secure: false,
      path: '/',
      maxAge: 0,
      expires: new Date(0)
    });
  }

  createAuthToken(viewer) {
    return signToken(
      {
        sub: viewer.id,
        username: viewer.username,
        avatar_url: viewer.avatar_url
      },
      this.jwtSecret,
      SEVEN_DAYS_IN_SECONDS
    );
  }

  readTokenFromRequest(req) {
    const cookies = parseCookies(req.headers?.cookie || '');
    return cookies[AUTH_COOKIE_NAME] || null;
  }

  readOAuthState(req) {
    const cookies = parseCookies(req.headers?.cookie || '');
    return cookies[OAUTH_STATE_COOKIE_NAME] || null;
  }

  verifyAuthToken(token) {
    return verifyToken(token, this.jwtSecret);
  }

  async resolveViewerFromRequest(req) {
    const token = this.readTokenFromRequest(req);
    const payload = this.verifyAuthToken(token);
    if (!payload?.sub) {
      return null;
    }

    try {
      const viewer = await this.roleService.resolveViewerByDiscordId(payload.sub);
      return viewer;
    } catch (error) {
      this.logger.warn?.(`[auth] Unable to resolve viewer ${payload.sub}: ${error.message}`);
      return null;
    }
  }

  attachViewer = async (req, _res, next) => {
    req.viewer = await this.resolveViewerFromRequest(req);
    next();
  };

  requireAuth = async (req, res, next) => {
    req.viewer = await this.resolveViewerFromRequest(req);
    if (!req.viewer?.primary_role) {
      res.status(401).json({ error: 'Please log in with your Discord account to continue.' });
      return;
    }
    next();
  };

  startDiscordLogin(req, res) {
    if (!this.discordService.hasOAuthCredentials()) {
      res.status(500).json({ error: 'Discord OAuth is not configured yet.' });
      return;
    }

    const state = crypto.randomBytes(24).toString('hex');
    res.setHeader('Set-Cookie', this.buildOAuthStateCookie(state));
    res.redirect(this.discordService.buildOAuthUrl(state));
  }

  async finishDiscordLogin(req, res, options = {}) {
    const { code, state } = req.query || {};
    const savedState = this.readOAuthState(req);

    if (!code || !state || !savedState || String(savedState) !== String(state)) {
      res.setHeader('Set-Cookie', this.buildExpiredOAuthStateCookie());
      res.redirect(`${this.clientUrl}/auth/callback?status=error&reason=oauth_state`);
      return;
    }

    try {
      const tokenData = await this.discordService.exchangeCode(code);
      const discordUser = await this.discordService.fetchCurrentUser(tokenData.access_token);
      const guildMember = await this.discordService.fetchGuildMember(discordUser.id);

      if (!guildMember) {
        res.setHeader('Set-Cookie', [this.buildExpiredOAuthStateCookie(), this.buildExpiredCookie()]);
        res.redirect(`${this.clientUrl}/auth/callback?status=denied&reason=member_only`);
        return;
      }

      await this.roleService.ensureBootstrappedSuperAdmin(discordUser.id);
      const viewer = await this.roleService.resolveViewerProfile(discordUser, guildMember);

      if (!viewer.primary_role) {
        res.setHeader('Set-Cookie', [this.buildExpiredOAuthStateCookie(), this.buildExpiredCookie()]);
        res.redirect(`${this.clientUrl}/auth/callback?status=denied&reason=member_only`);
        return;
      }

      const authToken = this.createAuthToken(viewer);
      res.setHeader('Set-Cookie', [this.buildExpiredOAuthStateCookie(), this.buildCookie(authToken)]);
      res.redirect(`${this.clientUrl}/dashboard`);
    } catch (error) {
      this.logger.error?.(`[auth] Discord login failed: ${error.message}`);
      res.setHeader('Set-Cookie', [this.buildExpiredOAuthStateCookie(), this.buildExpiredCookie()]);
      res.redirect(`${this.clientUrl}/auth/callback?status=error&reason=oauth_exchange`);
    }
  }

  logout(_req, res) {
    res.setHeader('Set-Cookie', this.buildExpiredCookie());
    res.json({ success: true });
  }
}

module.exports = {
  AuthService,
  AUTH_COOKIE_NAME
};
