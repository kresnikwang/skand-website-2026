// Private service: deploy OUTSIDE the web root. Never ship credentials/tickets.
const { createHash, randomBytes } = require('node:crypto');
const { createServer } = require('node:http');
const ALLOWED_ORIGINS = new Set(['https://skandstudio.com', 'https://www.skandstudio.com']);

function validateUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 4096 || /[\x00-\x20\x7f]/.test(raw)) throw new Error('Invalid URL');
  const url = new URL(raw);
  if (!ALLOWED_ORIGINS.has(url.origin) || url.username || url.password || url.hash || !['/', '/index.html'].includes(url.pathname)) {
    throw new Error('Invalid URL');
  }
  return raw; // Sign the original bytes; URL serialization can change the signature.
}
function signatureFor(ticket, nonceStr, timestamp, url) {
  return createHash('sha1').update(`jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`).digest('hex');
}
function createSigner({ appId, appSecret, fetchImpl = fetch, now = Date.now }) {
  let token, ticket, tokenFlight, ticketFlight, retryAfter = 0;
  async function upstream(url, options) {
    const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error('WeChat unavailable');
    const data = await response.json();
    if (data.errcode) {
      console.warn('[WeChat signer] Upstream error code: ' + Number(data.errcode));
      throw new Error('WeChat rejected configuration');
    }
    return data;
  }
  const fresh = value => value && value.expiresAt > now();
  const expiry = seconds => {
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Invalid credential lifetime');
    return now() + Math.max(1, seconds - Math.min(300, seconds / 10)) * 1000;
  };
  async function getToken() {
    if (fresh(token)) return token.value;
    if (!tokenFlight) {
      tokenFlight = (async () => {
        // Stable access token avoids invalidating another integration on this account.
        const data = await upstream('https://api.weixin.qq.com/cgi-bin/stable_token', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grant_type: 'client_credential', appid: appId, secret: appSecret, force_refresh: false })
        });
        if (!data.access_token) throw new Error('Missing token');
        token = { value: data.access_token, expiresAt: expiry(data.expires_in) };
        return token.value;
      })().finally(() => { tokenFlight = null; });
    }
    return tokenFlight;
  }
  async function getTicket() {
    if (fresh(ticket)) return ticket.value;
    if (now() < retryAfter) throw new Error('WeChat unavailable');
    if (!ticketFlight) {
      ticketFlight = (async () => {
        const accessToken = await getToken();
        const data = await upstream('https://api.weixin.qq.com/cgi-bin/ticket/getticket?type=jsapi&access_token=' + encodeURIComponent(accessToken));
        if (!data.ticket) throw new Error('Missing ticket');
        ticket = { value: data.ticket, expiresAt: expiry(data.expires_in) };
        return ticket.value;
      })().catch(error => { retryAfter = now() + 30000; throw error; }).finally(() => { ticketFlight = null; });
    }
    return ticketFlight;
  }
  return async raw => {
    const url = validateUrl(raw);
    if (!appId || !appSecret) throw new Error('Account not configured');
    const ticketValue = await getTicket();
    const nonceStr = randomBytes(16).toString('hex');
    const timestamp = Math.floor(now() / 1000);
    return { appId, nonceStr, timestamp, signature: signatureFor(ticketValue, nonceStr, timestamp, url) };
  };
}
function createHandler(sign) {
  return async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify(body));
    };
    if (req.url !== '/api/wechat/signature') return send(404, { error: 'Not found' });
    if (req.method !== 'POST') return send(405, { error: 'Method not allowed' });
    if (req.headers.origin && !ALLOWED_ORIGINS.has(req.headers.origin)) return send(403, { error: 'Origin not allowed' });
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return send(415, { error: 'JSON required' });
    let raw;
    try {
      let body = '', size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 8192) return send(413, { error: 'Request too large' });
        body += chunk;
      }
      raw = JSON.parse(body).url;
      validateUrl(raw);
    } catch (_) { return send(400, { error: 'Invalid URL' }); }
    try { send(200, await sign(raw)); }
    catch (_) { send(503, { error: 'Sharing configuration unavailable' }); }
  };
}
if (require.main === module) {
  const sign = createSigner({ appId: process.env.WECHAT_APP_ID, appSecret: process.env.WECHAT_APP_SECRET });
  const server = createServer(createHandler(sign));
  server.requestTimeout = 10000;
  server.listen(Number(process.env.PORT || 8787), '127.0.0.1');
}
module.exports = { validateUrl, signatureFor, createSigner, createHandler };
