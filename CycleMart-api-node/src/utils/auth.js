import jwt from 'jsonwebtoken';

export function extractBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;
  const match = authHeader.match(/Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function verifyToken(token) {
  const secret = process.env.JWT_SECRET || 'your_secret_key';
  return jwt.verify(token, secret);
}
