import { Router } from 'express';
import { parseVendorUrl } from '../services/parsers/vendorParser.js';

export function createParsersRouter() {
  const router = Router();

  // POST /api/parsers/parse-url
  router.post('/parse-url', (req, res) => {
    try {
      const { url } = req.body;
      const parsed = parseVendorUrl(url);
      return res.status(200).json(parsed);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to parse URL: ' + err.message });
    }
  });

  return router;
}

export default createParsersRouter();
