/**
 * Middleware to restrict access to Master users only
 */
const requireMaster = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Não autenticado' });
    }

    if (req.user.role !== 'master') {
        return res.status(403).json({
            error: 'Acesso restrito a usuários Master',
            message: 'Você não tem permissão para acessar esta funcional idade'
        });
    }

    next();
};

module.exports = requireMaster;
