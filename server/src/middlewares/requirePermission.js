function requirePermission(permission, roleService) {
  return (req, res, next) => {
    if (roleService.hasPermission(req.viewer, permission)) {
      next();
      return;
    }

    res.status(403).json({ error: 'You do not have permission to do that.' });
  };
}

module.exports = {
  requirePermission
};
