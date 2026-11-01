import http from 'http';
import express from 'express';
import cors from 'cors';
import { fetchConfig, fetchSymbolInfo, fetchHistory, searchSymbols, fetchQuotes } from './moneycontrol.js';
import { TradingEngine } from './engine.js';
import { MarketStreamer } from './streamer.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

const PORT = process.env.PORT || 4000;
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Serve Client Static Build if available
app.use(express.static(CLIENT_DIST));


// Initialize Trading Engine and Market Streamer
const engine = new TradingEngine(1000000); // 10 Lakh INR demo equity
const streamer = new MarketStreamer(engine);

// In-Memory Custom Watchlist (including top gainers from screenshot)
let watchlist = [
  { symbol: 'LAURUSLABS', name: 'Laurus Labs', exchange: 'NSE' },
  { symbol: 'TRENT', name: 'Trent', exchange: 'NSE' },
  { symbol: 'ZYDUSLIFE', name: 'Zydus Life Science', exchange: 'NSE' },
  { symbol: 'NAVINFLUOR', name: 'Navin Fluorine International', exchange: 'NSE' },
  { symbol: 'INDIGO', name: 'Interglobe Aviation', exchange: 'NSE' },
  { symbol: 'WIPRO', name: 'Wipro', exchange: 'NSE' },
  { symbol: 'COFORGE', name: 'Coforge', exchange: 'NSE' },
  { symbol: 'UNITDSPR', name: 'United Spirits', exchange: 'NSE' },
  { symbol: 'LTM', name: 'LTM', exchange: 'NSE' },
  { symbol: 'INFY', name: 'Infosys Ltd', exchange: 'NSE' },
  { symbol: 'ABCAPITAL', name: 'Aditya Birla Capital', exchange: 'NSE' },
  { symbol: 'APOLLOHOSP', name: 'Apollo Hospitals', exchange: 'NSE' },
  { symbol: 'FORCEMOT', name: 'Force Motors', exchange: 'NSE' },
  { symbol: 'TATACONSUM', name: 'Tata Consumer Products', exchange: 'NSE' },
  { symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', exchange: 'NSE' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors', exchange: 'NSE' },
  { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel', exchange: 'NSE' },
  { symbol: 'ITC', name: 'ITC Ltd', exchange: 'NSE' }
];

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now(), mode: 'ultra-fast-zero-lag' });
});

// MoneyControl TechCharts Config
app.get('/api/config', async (req, res) => {
  try {
    const config = await fetchConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Symbol Info
app.get('/api/symbols/:symbol', async (req, res) => {
  try {
    const symbolInfo = await fetchSymbolInfo(req.params.symbol);
    res.json(symbolInfo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Historical Candles
app.get('/api/history', async (req, res) => {
  const { symbol, resolution, from, to, countback } = req.query;
  if (!symbol) {
    return res.status(400).json({ error: 'Missing symbol query param' });
  }

  try {
    const data = await fetchHistory({
      symbol,
      resolution: resolution || '1D',
      from: from ? parseInt(from, 10) : undefined,
      to: to ? parseInt(to, 10) : undefined,
      countback: countback ? parseInt(countback, 10) : undefined
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Symbol Search
app.get('/api/search', async (req, res) => {
  const q = req.query.q || '';
  try {
    const results = await searchSymbols(q);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Watchlist endpoints
app.get('/api/watchlist', (req, res) => {
  res.json(watchlist);
});

// Watchlist Quotes Endpoint (% change with current price from previous day close)
app.get('/api/quotes', async (req, res) => {
  const symParam = req.query.symbols;
  const symbols = symParam
    ? symParam.split(',').map(s => s.trim().toUpperCase())
    : watchlist.map(w => w.symbol);

  try {
    const quotes = await fetchQuotes(symbols);
    res.json({ success: true, quotes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/watchlist', (req, res) => {
  const { symbols } = req.body;
  if (Array.isArray(symbols)) {
    watchlist = symbols;
    // ensure active streamer tracks them
    for (const item of watchlist) {
      if (item.symbol) streamer.activeSymbols.add(item.symbol.toUpperCase());
    }
  }
  res.json({ success: true, watchlist });
});

// Price Alerts Endpoints
app.get('/api/alerts', (req, res) => {
  res.json(streamer.alertManager.getAlerts(req.query.symbol));
});

app.post('/api/alerts', (req, res) => {
  try {
    const alert = streamer.alertManager.addAlert(req.body);
    streamer.broadcast({
      type: 'ALERTS_UPDATED',
      alerts: streamer.alertManager.getAlerts()
    });
    res.json({ success: true, alert });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/alerts/:id', (req, res) => {
  const removed = streamer.alertManager.deleteAlert(req.params.id);
  streamer.broadcast({
    type: 'ALERTS_UPDATED',
    alerts: streamer.alertManager.getAlerts()
  });
  res.json({ success: true, removed });
});

app.post('/api/alerts/:id/reset', (req, res) => {
  const reset = streamer.alertManager.resetAlert(req.params.id);
  streamer.broadcast({
    type: 'ALERTS_UPDATED',
    alerts: streamer.alertManager.getAlerts()
  });
  res.json({ success: true, reset });
});

// Paper Trading Account Summary

app.get('/api/account', (req, res) => {
  res.json(engine.getAccountSummary());
});

// Fallback to client SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

// Create HTTP and WebSocket Server
const server = http.createServer(app);

streamer.attach(server);

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 ZERO-LAG TRADING SERVER READY ON http://localhost:${PORT}`);
  console.log(`📡 WebSocket stream listening on ws://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
