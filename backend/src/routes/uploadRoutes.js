const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const { computeBaselines } = require('../services/baselineService');
const { parseWhoopExport } = require('../services/whoopCsvParser');
const { parseAppleHealthExport } = require('../services/appleHealthParser');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }
});

function cleanupFile(filePath) {
  fs.unlink(filePath, () => {});
}

router.post('/whoop', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const counts = await parseWhoopExport(req.user.userId, req.file.path);
    computeBaselines(req.user.userId);
    cleanupFile(req.file.path);
    return res.json({ ok: true, ingested: counts });
  } catch (error) {
    cleanupFile(req.file.path);
    return res.status(400).json({ error: error.message });
  }
});

router.post('/apple-health', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const counts = await parseAppleHealthExport(req.user.userId, req.file.path);
    computeBaselines(req.user.userId);
    cleanupFile(req.file.path);
    return res.json({ ok: true, ingested: counts });
  } catch (error) {
    cleanupFile(req.file.path);
    return res.status(400).json({ error: error.message });
  }
});

module.exports = router;
