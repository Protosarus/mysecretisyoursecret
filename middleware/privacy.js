module.exports = function privacy(req, res, next) {
  if (req.headers['x-forwarded-for']) {
    delete req.headers['x-forwarded-for'];
  }

  if (req.headers['x-real-ip']) {
    delete req.headers['x-real-ip'];
  }

  try {
    Object.defineProperty(req, 'ip', {
      configurable: true,
      get: () => undefined
    });
  } catch (err) {
    // ignore override issues
  }

  if (req.socket && typeof req.socket === 'object') {
    req.socket.remoteAddress = undefined;
  }

  req.anonymized = true;
  next();
};
