const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const auth = require('../middleware/auth');

router.post('/', auth, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    // Return the relative path to be stored in DB
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
        message: 'Upload realizado com sucesso',
        fileUrl: fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname
    });
});

module.exports = router;
