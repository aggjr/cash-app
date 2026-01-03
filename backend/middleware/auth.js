const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// Regular authentication middleware
const auth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied (Middleware)' });
    }

    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified;
        next();
    } catch (error) {
        res.status(400).json({ error: 'Invalid token' });
    }
};

// MASTER-only authentication middleware
const authMaster = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied (Middleware)' });
    }

    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified;

        // Check if user is MASTER
        if (req.user.role !== 'master') {
            return res.status(403).json({ error: 'Acesso negado. Apenas usuários MASTER podem acessar este recurso.' });
        }

        next();
    } catch (error) {
        res.status(400).json({ error: 'Invalid token' });
    }
};

module.exports = auth;
module.exports.authMaster = authMaster;
