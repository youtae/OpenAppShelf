import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP, BlockList } from 'node:net';

const blocked = new BlockList();
for (const [address, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.168.0.0',16],['192.0.0.0',24],['192.0.2.0',24],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]]) blocked.addSubnet(address, prefix);
for (const [address, prefix] of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]]) blocked.addSubnet(address, prefix, 'ipv6');
export function isPublicIP(address) {
  if (isIP(address) === 4) return !blocked.check(address);
  // Only global unicast IPv6; exclude documentation and transition mechanisms.
  return isIP(address) === 6 && /^[23]/i.test(address) && !blocked.check(address, 'ipv6');
}

export function publicURL(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')
    || url.hostname === 'localhost' || /\.(localhost|local|internal)$/i.test(url.hostname)) throw new Error('Only public HTTPS URLs are allowed');
  return url;
}

export async function publicGet(value, { maxBytes = 6_000_000, headers = {} } = {}, redirects = 0) {
  const url = publicURL(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicIP(address))) throw new Error('Private or reserved network address blocked');
  const address = addresses[0];
  const result = await new Promise((resolve, reject) => {
    // Pin the verified address, including redirects, to prevent DNS rebinding.
    const req = request(url, { headers: { 'User-Agent': 'OpenAppShelf/0.1 (public catalog collector)', ...headers },
      lookup: (_host, options, done) => options.all ? done(null, [address]) : done(null, address.address, address.family),
      signal: AbortSignal.timeout(15000) }, response => {
      const chunks = []; let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > maxBytes) response.destroy(new Error('Response size limit exceeded'));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks), url: url.href }));
    });
    req.on('error', reject); req.end();
  });
  if ([301,302,303,307,308].includes(result.status) && result.headers.location) {
    if (redirects >= 4) throw new Error('Redirect limit exceeded');
    const next = publicURL(new URL(result.headers.location, url));
    const nextHeaders = { ...headers };
    if (next.origin !== url.origin) delete nextHeaders.Authorization;
    return publicGet(next, { maxBytes, headers: nextHeaders }, redirects + 1);
  }
  if (result.status !== 200) throw Object.assign(new Error(`HTTP ${result.status} from ${url.hostname}`), { status: result.status });
  return result;
}

if (import.meta.main && process.argv.includes('--self-test')) {
  const { default: assert } = await import('node:assert/strict');
  for (const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.0.1','100.64.0.1','::1','::ffff:127.0.0.1','fc00::1','2001:db8::1']) assert.equal(isPublicIP(ip), false, ip);
  assert.equal(isPublicIP('8.8.8.8'), true);
  for (const url of ['file:///etc/passwd','http://example.com','https://user:pass@example.com','https://localhost','https://example.com:5432']) assert.throws(() => publicURL(url));
  console.log('PASS: public URL and private-network checks.');
}
