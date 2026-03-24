function createAuthController({ authService }) {
  return {
    startDiscordLogin(req, res) {
      authService.startDiscordLogin(req, res);
    },

    async finishDiscordLogin(req, res) {
      await authService.finishDiscordLogin(req, res);
    },

    async getSession(req, res) {
      const viewer = req.viewer || await authService.resolveViewerFromRequest(req);
      res.json({
        authenticated: Boolean(viewer?.primary_role),
        viewer: viewer || null
      });
    },

    logout(req, res) {
      authService.logout(req, res);
    }
  };
}

module.exports = {
  createAuthController
};
