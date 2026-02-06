/**
 * Pairing routes: Allow users to pair their browser with the agent.
 * Provides a web page with pairing link, QR code, and 6-digit fallback code.
 */

import { Router } from 'express';
import { createHmac, randomUUID } from 'crypto';
import { config } from '../config.js';

// In-memory store for pairing codes (6-digit codes with 10-minute expiry)
interface PairingCode {
  code: string;
  agentUrl: string;
  createdAt: number;
  expiresAt: number;
}

const pairingCodes = new Map<string, PairingCode>();

// Secret for signing tokens (generated per agent instance)
const TOKEN_SECRET = randomUUID();

// Clean up expired codes every minute
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of pairingCodes.entries()) {
    if (data.expiresAt < now) {
      pairingCodes.delete(code);
    }
  }
}, 60 * 1000);

// Generate a 6-digit code
function generateCode(): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  // Ensure uniqueness
  if (pairingCodes.has(code)) {
    return generateCode();
  }
  return code;
}

// Create a signed token
function createToken(payload: object, secret: string, expiresInMs: number): string {
  const exp = Date.now() + expiresInMs;
  const data = { ...payload, iat: Date.now(), exp };
  const payloadStr = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = createHmac('sha256', secret).update(payloadStr).digest('base64url');
  return `${payloadStr}.${signature}`;
}

// Verify and decode a token
export function verifyToken(
  token: string,
  secret: string
): { valid: boolean; payload?: Record<string, unknown>; error?: string } {
  try {
    const [payloadStr, signature] = token.split('.');
    if (!payloadStr || !signature) {
      return { valid: false, error: 'Invalid token format' };
    }

    const expectedSignature = createHmac('sha256', secret).update(payloadStr).digest('base64url');
    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }

    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString());

    if (payload.exp && payload.exp < Date.now()) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'Failed to parse token' };
  }
}

// Get agent URL - prefer config, fallback to localhost
function getAgentUrl(): string {
  if (config.agent?.url) {
    return config.agent.url;
  }
  const port = config.agent?.port || 4678;
  return `localhost:${port}`;
}

// Get dashboard URL
function getDashboardUrl(): string {
  return 'https://247.quivr.com';
}

// Generate QR code as SVG using a simple implementation
function generateQRCodeSVG(data: string): string {
  const encoded = encodeURIComponent(data);
  return `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}" alt="QR Code" width="200" height="200" style="image-rendering: pixelated;" />`;
}

export function createPairRoutes(): Router {
  const router = Router();

  // GET /pair - HTML page with pairing info
  router.get('/', (_req, res) => {
    const agentUrl = getAgentUrl();
    const dashboardUrl = getDashboardUrl();

    // Create token (10 minute expiry)
    const token = createToken(
      {
        url: agentUrl,
      },
      TOKEN_SECRET,
      10 * 60 * 1000
    );

    // Generate or reuse existing code
    let existingCode: string | undefined;
    for (const [code, data] of pairingCodes.entries()) {
      if (data.agentUrl === agentUrl && data.expiresAt > Date.now()) {
        existingCode = code;
        break;
      }
    }

    const code =
      existingCode ||
      (() => {
        const newCode = generateCode();
        pairingCodes.set(newCode, {
          code: newCode,
          agentUrl,
          createdAt: Date.now(),
          expiresAt: Date.now() + 10 * 60 * 1000,
        });
        return newCode;
      })();

    const pairingLink = `${dashboardUrl}/connect?token=${encodeURIComponent(token)}`;
    const qrCodeSvg = generateQRCodeSVG(pairingLink);

    // Calculate time remaining
    const codeData = pairingCodes.get(code)!;
    const secondsRemaining = Math.floor((codeData.expiresAt - Date.now()) / 1000);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pair Agent - 247</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0a0a10 0%, #1a1a2e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #fff;
    }
    .container {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      padding: 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .machine-icon {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, #f97316 0%, #f59e0b 100%);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 40px;
    }
    h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 32px;
    }
    .qr-section {
      background: #fff;
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 24px;
      display: inline-block;
    }
    .qr-section img {
      display: block;
    }
    .link-section {
      margin-bottom: 24px;
    }
    .pair-button {
      display: inline-block;
      background: linear-gradient(135deg, #f97316 0%, #f59e0b 100%);
      color: #fff;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 16px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .pair-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(249, 115, 22, 0.3);
    }
    .divider {
      display: flex;
      align-items: center;
      margin: 24px 0;
      color: rgba(255, 255, 255, 0.4);
      font-size: 14px;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: rgba(255, 255, 255, 0.1);
    }
    .divider span {
      padding: 0 16px;
    }
    .code-section {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 20px;
    }
    .code-label {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.6);
      margin-bottom: 12px;
    }
    .code {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 36px;
      font-weight: 700;
      letter-spacing: 8px;
      color: #f97316;
    }
    .expires {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.4);
      margin-top: 12px;
    }
    .refresh-note {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.3);
      margin-top: 24px;
    }
    .agent-info {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.4);
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="machine-icon">💻</div>
    <h1>Pair Your Agent</h1>

    <div class="qr-section">
      ${qrCodeSvg}
    </div>

    <div class="link-section">
      <a href="${pairingLink}" class="pair-button" target="_blank">Open Dashboard to Pair</a>
    </div>

    <div class="divider"><span>or enter this code</span></div>

    <div class="code-section">
      <p class="code-label">Pairing Code</p>
      <p class="code">${code}</p>
      <p class="expires">Expires in <span id="countdown">${Math.floor(secondsRemaining / 60)}:${String(secondsRemaining % 60).padStart(2, '0')}</span></p>
    </div>

    <p class="refresh-note">Page will auto-refresh when code expires</p>

    <p class="agent-info">
      Agent URL: ${agentUrl}
    </p>
  </div>

  <script>
    let remaining = ${secondsRemaining};
    const countdown = document.getElementById('countdown');

    setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        location.reload();
        return;
      }
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      countdown.textContent = mins + ':' + String(secs).padStart(2, '0');
    }, 1000);
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });

  // GET /pair/info - JSON API for pairing info
  router.get('/info', (_req, res) => {
    const agentUrl = getAgentUrl();
    const dashboardUrl = getDashboardUrl();

    // Create token (10 minute expiry)
    const token = createToken(
      {
        url: agentUrl,
      },
      TOKEN_SECRET,
      10 * 60 * 1000
    );

    // Generate or reuse existing code
    let existingCode: string | undefined;
    for (const [code, data] of pairingCodes.entries()) {
      if (data.agentUrl === agentUrl && data.expiresAt > Date.now()) {
        existingCode = code;
        break;
      }
    }

    const code =
      existingCode ||
      (() => {
        const newCode = generateCode();
        pairingCodes.set(newCode, {
          code: newCode,
          agentUrl,
          createdAt: Date.now(),
          expiresAt: Date.now() + 10 * 60 * 1000,
        });
        return newCode;
      })();

    const codeData = pairingCodes.get(code)!;

    res.json({
      agentUrl,
      token,
      code,
      pairingLink: `${dashboardUrl}/connect?token=${encodeURIComponent(token)}`,
      expiresAt: codeData.expiresAt,
    });
  });

  // GET /pair/code/:code - Lookup a pairing code (for dashboard to verify)
  router.get('/code/:code', (req, res) => {
    const { code } = req.params;
    const data = pairingCodes.get(code);

    if (!data || data.expiresAt < Date.now()) {
      return res.status(404).json({ error: 'Code not found or expired' });
    }

    res.json({
      agentUrl: data.agentUrl,
      expiresAt: data.expiresAt,
    });
  });

  // POST /pair/verify - Verify a token (for dashboard to validate)
  router.post('/verify', (req, res) => {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required' });
    }

    const result = verifyToken(token, TOKEN_SECRET);

    if (!result.valid) {
      return res.status(401).json({ error: result.error });
    }

    res.json({
      valid: true,
      agentUrl: result.payload?.url,
    });
  });

  return router;
}

// Export for testing
export { pairingCodes, generateCode, createToken, getAgentUrl, getDashboardUrl, TOKEN_SECRET };
