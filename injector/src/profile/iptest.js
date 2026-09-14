'use strict';

/**
 * iptest.js — Proxy IP Testing Engine
 *
 * Tests a proxy by routing requests through it to 3 IP info APIs in parallel.
 * Returns a merged result with: IP, country, timezone, ASN, ISP, risk score, type.
 *
 * Proxy-first philosophy:
 *   ALL requests go through the proxy → we see the exit IP, not real IP.
 *   If proxy fails → throw error (never fall back to real IP).
 */

const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const https = require('https');
const http  = require('http');

// ─── Build proxy agent from parsed proxy info ──────────────────────────────
function buildAgent(proxy) {
    if (!proxy) return null;
    const type = (proxy.type || proxy.proxy_type || 'none').toLowerCase();
    if (type === 'none') return null;

    const host = proxy.host || proxy.proxy_host;
    const port = proxy.port || proxy.proxy_port;
    const username = proxy.username || proxy.proxy_username || proxy.user || '';
    const password = proxy.password || proxy.proxy_password || proxy.pass || '';
    const auth = username ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : '';

    if (type === 'socks4' || type === 'socks5') {
        const uri = `${type}://${auth}${host}:${port}`;
        return new SocksProxyAgent(uri);
    }

    if (type === 'http' || type === 'https') {
        const uri = `http://${auth}${host}:${port}`;
        return new HttpsProxyAgent(uri);
    }

    // SSH tunnels need local SOCKS5 endpoint — handled externally
    return null;
}

// ─── Generic HTTP GET through proxy ──────────────────────────────────────
function fetchJson(url, agent, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        const options = { headers: { 'User-Agent': 'Mozilla/5.0' } };
        if (agent) options.agent = agent;

        const req = lib.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { reject(new Error('Invalid JSON from ' + url)); }
            });
        });

        req.on('error', reject);
        req.setTimeout(timeoutMs, () => {
            req.destroy();
            reject(new Error('Timeout: ' + url));
        });
    });
}

// ─── IP API Sources ────────────────────────────────────────────────────────

async function fetchIpApi(agent) {
    // ip-api.com — free, no key needed
    const fields = 'status,message,country,countryCode,region,city,zip,lat,lon,timezone,isp,org,as,proxy,hosting,query';
    const data = await fetchJson(`http://ip-api.com/json?fields=${fields}`, agent);
    if (data.status !== 'success') throw new Error('ip-api.com: ' + data.message);

    return {
        ip:          data.query,
        country:     data.country,
        countryCode: data.countryCode,
        region:      data.region,
        city:        data.city,
        zip:         data.zip,
        lat:         data.lat,
        lng:         data.lon,
        timezone:    data.timezone,
        isp:         data.isp,
        org:         data.org,
        asn:         data.as,
        isProxy:     data.proxy,
        isHosting:   data.hosting,
        source:      'ip-api'
    };
}

async function fetchIpInfo(agent) {
    // ipinfo.io — free tier, no key
    const data = await fetchJson('https://ipinfo.io/json', agent);
    const [lat, lng] = (data.loc || '0,0').split(',').map(Number);

    return {
        ip:          data.ip,
        country:     data.country,
        city:        data.city,
        region:      data.region,
        org:         data.org,  // includes ASN e.g. "AS1234 Company"
        timezone:    data.timezone,
        lat,
        lng,
        source:      'ipinfo'
    };
}

async function fetchIpWhoIs(agent) {
    // ipwho.is — 100% free tier, NO API key required
    const data = await fetchJson('https://ipwho.is/', agent);
    if (!data || data.success === false) {
        throw new Error('ipwho.is: ' + (data?.message || 'Lookup failed'));
    }

    return {
        ip:          data.ip,
        country:     data.country,
        countryCode: data.country_code,
        region:      data.region,
        city:        data.city,
        lat:         data.latitude,
        lng:         data.longitude,
        timezone:    data.timezone?.id || 'UTC',
        isp:         data.connection?.isp || '',
        org:         data.connection?.org || '',
        asn:         data.connection?.asn ? ('AS' + data.connection.asn) : '',
        score:       data.is_proxy ? 65 : 0,
        type:        data.is_proxy ? 'proxy' : 'residential',
        isProxy:     Boolean(data.is_proxy),
        isVpn:       false,
        isDatacenter:false,
        isTor:       false,
        source:      'ipwho.is'
    };
}

// ─── Main export ──────────────────────────────────────────────────────────

/**
 * testProxy(proxy) → Promise<result>
 *
 * @param {Object} proxy — { type, host, port, username, password }
 *   type: 'none'|'http'|'https'|'socks4'|'socks5'|'ssh'
 *
 * @returns {Object} merged IP info:
 *   { ip, country, countryCode, city, timezone, asn, isp, score, type,
 *     lat, lng, isProxy, isHosting, tested_at }
 */
async function testProxy(proxy) {
    const proxyType = (proxy?.type || proxy?.proxy_type || 'none').toLowerCase();
    const agent = buildAgent(proxy);
    if (!agent && proxyType !== 'none') {
        throw new Error('Could not build proxy agent for type: ' + proxyType);
    }

    // Run 3 100% free, no-API-key-needed sources in parallel
    const [ipApi, ipInfo, ipWho] = await Promise.allSettled([
        fetchIpApi(agent),
        fetchIpInfo(agent),
        fetchIpWhoIs(agent),
    ]);

    // Primary source: ip-api (most complete)
    const primary   = ipApi.status === 'fulfilled' ? ipApi.value : null;
    const secondary = ipInfo.status === 'fulfilled' ? ipInfo.value : null;
    const tertiary  = ipWho.status === 'fulfilled' ? ipWho.value : null;

    if (!primary && !secondary && !tertiary) {
        const err = ipApi.reason || ipInfo.reason || ipWho.reason;
        const msg = err?.message || 'Connection failed';
        if (msg.toLowerCase().includes('authentication failed')) {
            throw new Error('Proxy authentication failed — please verify proxy username and password.');
        } else if (msg.toLowerCase().includes('econnrefused') || msg.toLowerCase().includes('enotfound')) {
            throw new Error('Proxy server unreachable (' + (proxy?.host || '') + ':' + (proxy?.port || '') + ').');
        } else if (msg.toLowerCase().includes('timeout')) {
            throw new Error('Proxy connection timed out. Proxy may be offline or slow.');
        }
        throw new Error('Proxy test failed: ' + msg);
    }

    const base = primary || secondary || tertiary;
    const threat = tertiary || {};

    return {
        ip:          base.ip          || '',
        country:     base.country     || secondary?.country     || tertiary?.country || '',
        countryCode: base.countryCode || secondary?.country     || tertiary?.countryCode || '',
        city:        base.city        || secondary?.city        || tertiary?.city || '',
        region:      base.region      || secondary?.region      || tertiary?.region || '',
        timezone:    base.timezone    || secondary?.timezone    || tertiary?.timezone || 'UTC',
        asn:         base.asn         || secondary?.org         || tertiary?.asn || '',
        isp:         base.isp         || secondary?.org         || tertiary?.isp || '',
        lat:         base.lat         || secondary?.lat         || tertiary?.lat || 0,
        lng:         base.lng         || secondary?.lng         || tertiary?.lng || 0,
        score:       base.score       ?? threat?.score          ?? 0,
        type:        base.type        || (base.isHosting ? 'datacenter' : 'residential'),
        isProxy:     base.isProxy     || threat?.isProxy        || false,
        isVpn:       threat?.isVpn    || false,
        isDatacenter:threat?.isDatacenter || base.isHosting     || false,
        isTor:       threat?.isTor    || false,
        tested_at:   new Date().toISOString(),
        sources: {
            ipApi:   ipApi.status,
            ipInfo:  ipInfo.status,
            ipWho:   ipWho.status
        }
    };
}

module.exports = { testProxy, buildAgent };
