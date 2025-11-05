const jwt = require('jsonwebtoken');

const TOKEN_EXPIRY = '7d';

function getSecret() {
  return process.env.JWT_SECRET || 'change_this_in_production';
}

function issueToken(user) {
  const payload = {
    id: user.id,
    nickname: user.nickname,
    gender: user.gender,
    isAdmin: Boolean(user.isAdmin)
  };
  return jwt.sign(payload, getSecret(), {
    algorithm: 'HS256',
    expiresIn: TOKEN_EXPIRY
  });
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ message: 'Authorization required.' });
  }

  try {
    const decoded = jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
    req.user = {
      id: decoded.id,
      nickname: decoded.nickname,
      gender: decoded.gender,
      isAdmin: Boolean(decoded.isAdmin)
    };
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: 'Admin authorization required.' });
  }
  return next();
}

module.exports = {
  issueToken,
  requireAuth,
  requireAdmin
};
