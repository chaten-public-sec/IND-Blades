const { parseCookies } = require('../utils/http');
const { AUTH_COOKIE_NAME } = require('../services/authService');

function createSocketAuthMiddleware({ authService }) {
  return async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers?.cookie || '');
      const payload = authService.verifyAuthToken(cookies[AUTH_COOKIE_NAME]);
      if (!payload?.sub) {
        next();
        return;
      }

      const viewer = await authService.roleService.resolveViewerByDiscordId(payload.sub);
      socket.viewer = viewer;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  createSocketAuthMiddleware
};
