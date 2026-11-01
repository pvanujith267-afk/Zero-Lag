/**
 * High-Speed MoneyControl TechCharts API Client & In-Memory Cache
 */

const BASE_URL = 'https://priceapi.moneycontrol.com/techCharts/indianMarket/stock';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.moneycontrol.com/technical-analysis/',
  'Origin': 'https://www.moneycontrol.com'
};

// In-Memory Fast Cache with TTL
const cache = {
  config: null,
  symbols: new Map(),
  history: new Map(), // key: `${symbol}_${resolution}_${from}_${to}`
  recentQuote: new Map() // key: symbol -> { price, timestamp, high, low, open, close, volume }
};

export async function fetchConfig() {
  if (cache.config) return cache.config;
  try {
    const res = await fetch(`${BASE_URL}/config`, { headers: HEADERS });
    if (!res.ok) throw new Error(`Config HTTP ${res.status}`);
    const data = await res.json();
    cache.config = data;
    return data;
  } catch (err) {
    console.error('[MoneyControl] fetchConfig error:', err.message);
    return {
      supports_search: true,
      supports_group_request: false,
      supports_marks: true,
      supports_timescale_marks: true,
      supports_time: true,
      supported_resolutions: ['1', '3', '5', '15', '30', '60', 'D', '1D', 'W', '1W', 'M', '1M']
    };
  }
}

export async function fetchSymbolInfo(symbol) {
  const sym = symbol.toUpperCase().trim();
  if (cache.symbols.has(sym)) {
    return cache.symbols.get(sym);
  }

  try {
    const res = await fetch(`${BASE_URL}/symbols?symbol=${encodeURIComponent(sym)}`, { headers: HEADERS });
    if (!res.ok) throw new Error(`Symbol HTTP ${res.status}`);
    const data = await res.json();
    cache.symbols.set(sym, data);
    return data;
  } catch (err) {
    console.error(`[MoneyControl] fetchSymbolInfo error for ${sym}:`, err.message);
    return {
      name: sym,
      'exchange-traded': 'NSE',
      'exchange-listed': 'NSE',
      timezone: 'Asia/Kolkata',
      minmov: 1,
      minmov2: 0,
      pointvalue: 1,
      session: '0900-1530',
      has_intraday: true,
      has_daily: true,
      has_no_volume: false,
      description: sym,
      type: 'stock',
      supported_resolutions: ['1', '3', '5', '15', '30', '60', '1D', '1W', '1M']
    };
  }
}

// Sanitize intraday candles so that market close (15:30 IST) is strictly honored.
// For 5m: 15:25 is the last candle of the day. Any 15:30 candle is merged into 15:25.
export function sanitizeIntradayHistory(data, resolution) {
  if (!data || !data.t || data.t.length === 0) return data;
  const isDaily = resolution === '1D' || resolution === 'W' || resolution === 'M';
  if (isDaily) return data;

  const resMinutes = parseInt(resolution, 10) || 5;
  // Indian markets close at 15:30 IST. Last candle start is (15*60 + 30 - resMinutes)*60
  // For 5m: 15:25 IST (55500 seconds from midnight)
  const lastCandleSec = (15 * 60 + 30 - resMinutes) * 60;

  const t = [];
  const o = [];
  const h = [];
  const l = [];
  const c = [];
  const v = [];

  for (let i = 0; i < data.t.length; i++) {
    const time = data.t[i];
    const secFromMidnight = (time + 19800) % 86400;

    // Merge any bar after market hours (e.g. 15:30) into the last candle of the session
    if (secFromMidnight > lastCandleSec) {
      if (t.length > 0) {
        const lastIdx = t.length - 1;
        const prevDay = Math.floor((t[lastIdx] + 19800) / 86400);
        const curDay = Math.floor((time + 19800) / 86400);

        if (prevDay === curDay) {
          h[lastIdx] = Math.max(h[lastIdx], data.h[i]);
          l[lastIdx] = Math.min(l[lastIdx], data.l[i]);
          c[lastIdx] = data.c[i];
          if (v[lastIdx] !== undefined && data.v && data.v[i] !== undefined) {
            v[lastIdx] += data.v[i];
          }
          continue;
        }
      }
    }

    t.push(time);
    o.push(data.o[i]);
    h.push(data.h[i]);
    l.push(data.l[i]);
    c.push(data.c[i]);
    v.push(data.v ? data.v[i] : 0);
  }

  return { s: data.s, t, o, h, l, c, v };
}

export async function fetchHistory({ symbol, resolution = '1D', from, to, countback }) {
  const sym = symbol.toUpperCase().trim();
  const now = Math.floor(Date.now() / 1000);
  const toTime = to || now;
  
  // Default range calculation if from is not provided
  let fromTime = from;
  if (!fromTime) {
    if (resolution === '1' || resolution === '3' || resolution === '5') {
      fromTime = toTime - (7 * 86400); // 7 days of intraday
    } else if (resolution === '15' || resolution === '30' || resolution === '60') {
      fromTime = toTime - (30 * 86400); // 30 days
    } else {
      fromTime = toTime - (365 * 86400); // 1 year of daily
    }
  }

  const count = countback || (resolution === '1' ? 300 : 250);
  const cacheKey = `${sym}_${resolution}_${fromTime}_${toTime}_${count}`;

  // Cache hit check (TTL 10 seconds for intraday, 60 seconds for daily)
  const cached = cache.history.get(cacheKey);
  const ttl = resolution === '1' || resolution === '5' ? 10000 : 60000;
  if (cached && (Date.now() - cached.cachedAt < ttl)) {
    return cached.data;
  }

  // MoneyControl accepts resolution: '1', '5', '15', '60', '1D', 'D', 'W', 'M'
  let resParam = resolution;
  if (resParam === 'D') resParam = '1D';

  const url = `${BASE_URL}/history?symbol=${encodeURIComponent(sym)}&resolution=${resParam}&from=${fromTime}&to=${toTime}&countback=${count}`;

  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      throw new Error(`History HTTP ${res.status}`);
    }
    let data = await res.json();
    data = sanitizeIntradayHistory(data, resolution);
    
    // Store in cache
    cache.history.set(cacheKey, { data, cachedAt: Date.now() });

    // Update recent quote if we have candles
    if (data && data.t && data.t.length > 0) {
      const last = data.t.length - 1;
      cache.recentQuote.set(sym, {
        price: data.c[last],
        open: data.o[last],
        high: data.h[last],
        low: data.l[last],
        close: data.c[last],
        volume: data.v[last],
        time: data.t[last],
        timestamp: Date.now()
      });
    }

    return data;
  } catch (err) {
    console.error(`[MoneyControl] fetchHistory error for ${sym} (${resolution}):`, err.message);
    if (cached) return cached.data; // Return stale cache on network failure
    return { s: 'no_data', t: [], o: [], h: [], l: [], c: [], v: [] };
  }
}

export async function searchSymbols(query) {
  if (!query || query.trim().length === 0) return [];
  const q = query.trim().toUpperCase();

  try {
    const url = `${BASE_URL}/search?query=${encodeURIComponent(q)}&type=&exchange=&limit=15`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`Search HTTP ${res.status}`);
    const results = await res.json();
    return Array.isArray(results) ? results : [];
  } catch (err) {
    console.error(`[MoneyControl] searchSymbols error for ${query}:`, err.message);
    return [];
  }
}

export function getCachedQuote(symbol) {
  return cache.recentQuote.get(symbol.toUpperCase().trim());
}

export async function fetchQuote(symbol) {
  const sym = symbol.toUpperCase().trim();
  const cached = cache.recentQuote.get(sym);
  // Cache TTL: 15 seconds
  if (cached && cached.prevClose && (Date.now() - cached.timestamp < 15000)) {
    return cached;
  }

  try {
    const data = await fetchHistory({
      symbol: sym,
      resolution: '1D',
      countback: 3
    });

    if (data && data.c && data.c.length >= 2) {
      const last = data.c.length - 1;
      const price = data.c[last];
      const prevClose = data.c[last - 1];
      const change = Number((price - prevClose).toFixed(2));
      const changePct = Number((((price - prevClose) / prevClose) * 100).toFixed(2));
      const quote = {
        symbol: sym,
        price,
        prevClose,
        change,
        changePct,
        high: data.h[last],
        low: data.l[last],
        open: data.o[last],
        close: data.c[last],
        volume: data.v ? data.v[last] : 0,
        time: data.t[last],
        timestamp: Date.now()
      };
      cache.recentQuote.set(sym, quote);
      return quote;
    } else if (data && data.c && data.c.length === 1) {
      const price = data.c[0];
      const quote = {
        symbol: sym,
        price,
        prevClose: price,
        change: 0,
        changePct: 0,
        high: data.h[0],
        low: data.l[0],
        open: data.o[0],
        close: price,
        volume: data.v ? data.v[0] : 0,
        time: data.t[0],
        timestamp: Date.now()
      };
      cache.recentQuote.set(sym, quote);
      return quote;
    }
  } catch (err) {
    console.error(`[MoneyControl] fetchQuote error for ${sym}:`, err.message);
  }

  if (cached) return cached;
  return null;
}

export async function fetchQuotes(symbols = []) {
  const results = {};
  const tasks = symbols.map(async (s) => {
    const sym = typeof s === 'string' ? s : s?.symbol;
    if (!sym) return;
    const q = await fetchQuote(sym);
    if (q) results[sym.toUpperCase().trim()] = q;
  });
  await Promise.all(tasks);
  return results;
}
