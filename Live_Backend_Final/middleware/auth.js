const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  let token = req.header('x-auth-token');
  if (!token && req.header('Authorization')) {
    token = req.header('Authorization').replace('Bearer ', '');
  }

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
}

function superadmin(req, res, next) {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Access denied, Head/Main Admin only' });
  }
  next();
}

function facultyOrAdmin(req, res, next) {
  if (req.user.role !== 'faculty' && req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Access denied, Faculty or Head only' });
  }
  next();
}

module.exports = { auth, superadmin, facultyOrAdmin };
