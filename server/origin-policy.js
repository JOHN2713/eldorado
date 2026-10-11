export function normalizeOrigin(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.origin : '';
  } catch { return ''; }
}

export function createOriginPolicy(origins) {
  const allowed = new Set(origins.map(normalizeOrigin).filter(Boolean));
  return {
    allows: (origin) => allowed.has(origin),
    middleware(req, res, next) {
      const origin = req.get('origin');
      if (origin && allowed.has(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
        res.vary('Origin');
        res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        if (req.method === 'OPTIONS') return res.sendStatus(204);
      } else if (req.method === 'OPTIONS') return res.sendStatus(403);
      next();
    },
  };
}