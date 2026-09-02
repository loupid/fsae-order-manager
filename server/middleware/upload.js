import multer from 'multer';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'invoices');

// Ensure upload destination exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer Disk Storage Engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const sanitizedOriginal = path.basename(file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueName = `INV-${Date.now()}-${Math.round(Math.random() * 1e6)}-${sanitizedOriginal}`;
    cb(null, uniqueName);
  }
});

// Multer Filter (MIME type & extension check)
const fileFilter = (req, file, cb) => {
  const isPdfMime = file.mimetype === 'application/pdf';
  const isPdfExt = path.extname(file.originalname).toLowerCase() === '.pdf';

  if (isPdfMime && isPdfExt) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type: Only PDF files are allowed'), false);
  }
};

export const uploadInvoice = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

/**
 * Middleware: Strict PDF Magic Bytes buffer verification (%PDF)
 */
export function validatePdfMagicBytes(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ error: 'PDF file is required' });
  }

  const filePath = req.file.path;
  try {
    const buffer = Buffer.alloc(5);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, 5, 0);
    fs.closeSync(fd);

    if (bytesRead < 4) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(400).json({
        error: 'Invalid PDF format: file too small or empty'
      });
    }

    const header = buffer.toString('ascii', 0, 4);
    if (header !== '%PDF') {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(400).json({
        error: 'Invalid PDF format: file failed magic bytes header check (%PDF missing)'
      });
    }

    next();
  } catch (err) {
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
    return res.status(500).json({ error: 'Failed to inspect file magic bytes: ' + err.message });
  }
}

/**
 * Multer error handling wrapper middleware
 */
export function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File exceeds maximum size limit of 10MB' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
}
