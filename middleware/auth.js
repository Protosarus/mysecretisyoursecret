const jwt = require('jsonwebtoken');

const TOKEN_EXPIRY = '7d';

function getSecret() {
  return process.env.JWT_SECRET || 'change_this_in_production';
}

function issueToken(user) {
  const payload = {
    id: user.id,
    nickname: user.nickname,
    gender: user.gender
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
      gender: decoded.gender
    };
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

module.exports = {
  issueToken,
  requireAuth
};
