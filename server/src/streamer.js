import { WebSocketServer, WebSocket } from 'ws';
import { fetchHistory, getCachedQuote } from './moneycontrol.js';
import { AlertManager } from './alerts.js';

export class MarketStreamer {
  constructor(tradingEngine) {
    this.engine = tradingEngine;
    this.alertManager = new AlertManager();
    this.wss = null;
    this.activeSymbols = new Set(['LAURUSLABS', 'RELIANCE']);

    this.priceState = new Map(); // symbol -> { price, bid, ask, high, low, open, close, volume, bids: [], asks: [] }
    this.pollInterval = null;
    this.tickInterval = null;
  }

  attach(server) {
    this.wss = new WebSocketServer({ server });
    console.log('[WebSocket] Server attached to HTTP server');

    this.wss.on('connection', (ws) => {
      // Send initial snapshot
      ws.send(JSON.stringify({
        type: 'SNAPSHOT',
        account: this.engine.getAccountSummary(),
        positions: Array.from(this.engine.positions.values()).filter(p => p.qty !== 0),
        prices: Object.fromEntries(this.priceState),
        alerts: this.alertManager.getAlerts()
      }));

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(ws, data);
        } catch (err) {
          console.error('[WebSocket] message parse error:', err.message);
        }
      });

      ws.on('close', () => {
        // cleanup if needed
      });
    });

    // Listen to engine fills to broadcast
    this.engine.onUpdate((event) => {
      this.broadcast(event);
    });

    // Start background sync
    this.startStreaming();
  }

  handleClientMessage(ws, data) {
    switch (data.type) {
      case 'PING': {
        // High-precision RTT echo
        ws.send(JSON.stringify({
          type: 'PONG',
          clientTime: data.clientTime,
          serverTime: Date.now()
        }));
        break;
      }

      case 'CREATE_ALERT': {
        try {
          const alert = this.alertManager.addAlert(data);
          this.broadcast({
            type: 'ALERTS_UPDATED',
            alerts: this.alertManager.getAlerts()
          });
        } catch (err) {
          ws.send(JSON.stringify({ type: 'ALERT_ERROR', error: err.message }));
        }
        break;
      }

      case 'DELETE_ALERT': {
        this.alertManager.deleteAlert(data.id);
        this.broadcast({
          type: 'ALERTS_UPDATED',
          alerts: this.alertManager.getAlerts()
        });
        break;
      }

      case 'RESET_ALERT': {
        this.alertManager.resetAlert(data.id);
        this.broadcast({
          type: 'ALERTS_UPDATED',
          alerts: this.alertManager.getAlerts()
        });
        break;
      }


      case 'SUBSCRIBE': {
        if (data.symbol) {
          const sym = data.symbol.toUpperCase().trim();
          this.activeSymbols.add(sym);
          this.refreshSymbolPrice(sym);
        }
        break;
      }

      case 'PLACE_ORDER': {
        try {
          const sym = data.symbol.toUpperCase().trim();
          const currentPrice = this.priceState.get(sym)?.price || data.price;
          const result = this.engine.placeOrder({
            symbol: sym,
            side: data.side, // 'BUY' or 'SELL'
            qty: data.qty,
            orderType: data.orderType || 'MARKET',
            limitPrice: data.limitPrice,
            currentPrice
          });

          ws.send(JSON.stringify({
            type: 'ORDER_ACK',
            orderId: result.order.id,
            latencyUs: result.executionLatencyUs,
            order: result.order
          }));
        } catch (err) {
          ws.send(JSON.stringify({
            type: 'ORDER_ERROR',
            error: err.message
          }));
        }
        break;
      }

      case 'FLATTEN_SYMBOL': {
        const sym = data.symbol.toUpperCase().trim();
        const currentPrice = this.priceState.get(sym)?.price;
        const result = this.engine.flattenSymbol(sym, currentPrice);
        if (result) {
          ws.send(JSON.stringify({
            type: 'ORDER_ACK',
            orderId: result.order.id,
            latencyUs: result.executionLatencyUs,
            order: result.order
          }));
        }
        break;
      }

      case 'FLATTEN_ALL': {
        const priceMap = {};
        for (const [sym, st] of this.priceState.entries()) {
          priceMap[sym] = st.price;
        }
        const results = this.engine.flattenAll(priceMap);
        ws.send(JSON.stringify({
          type: 'FLATTEN_ALL_ACK',
          results
        }));
        break;
      }
    }
  }

  broadcast(payload) {
    if (!this.wss) return;
    const msg = JSON.stringify(payload);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  async refreshSymbolPrice(symbol) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const data = await fetchHistory({
        symbol,
        resolution: '1',
        from: now - 3600,
        to: now,
        countback: 3
      });

      if (data && data.t && data.t.length > 0) {
        const last = data.t.length - 1;
        const close = data.c[last];
        const high = data.h[last];
        const low = data.l[last];
        const open = data.o[last];
        const volume = data.v[last];
        const time = data.t[last];

        const state = this.updateSymbolState(symbol, close, { high, low, open, close, volume, time });

        // Broadcast real MoneyControl price update every 10 seconds
        this.broadcast({
          type: 'TICK',
          symbol: state.symbol,
          price: state.price,
          bid: state.bid,
          ask: state.ask,
          spread: state.spread,
          high: state.high,
          low: state.low,
          open: state.open,
          close: state.close,
          volume: state.volume,
          bids: state.bids,
          asks: state.asks,
          timestamp: Date.now(),
          account: this.engine.getAccountSummary()
        });
      }
    } catch (err) {
      console.error(`[Streamer] refreshSymbolPrice error for ${symbol}:`, err.message);
    }
  }

  updateSymbolState(symbol, basePrice, candleInfo = {}) {
    const sym = symbol.toUpperCase().trim();
    const tickSize = basePrice > 1000 ? 0.25 : 0.05;
    const spread = tickSize;
    const bid = Number((basePrice - spread / 2).toFixed(2));
    const ask = Number((basePrice + spread / 2).toFixed(2));

    const state = {
      symbol: sym,
      price: basePrice,
      bid,
      ask,
      spread: Number((ask - bid).toFixed(2)),
      high: candleInfo.high || basePrice,
      low: candleInfo.low || basePrice,
      open: candleInfo.open || basePrice,
      close: candleInfo.close || basePrice,
      volume: candleInfo.volume || 1000,
      time: candleInfo.time || Math.floor(Date.now() / 1000),
      timestamp: Date.now(),
      bids: [],
      asks: []
    };

    this.priceState.set(sym, state);
    this.engine.updateMarketPrice(sym, basePrice);

    // Check Price Alerts on real 10s price update
    const triggered = this.alertManager.checkPrice(sym, basePrice);
    for (const alt of triggered) {
      console.log(`[ALERT TRIGGERED] ${sym} @ ₹${basePrice} (${alt.note})`);
      this.broadcast({
        type: 'ALERT_TRIGGERED',
        alert: alt,
        price: basePrice,
        timestamp: Date.now()
      });
      this.broadcast({
        type: 'ALERTS_UPDATED',
        alerts: this.alertManager.getAlerts()
      });
    }

    return state;
  }

  startStreaming() {
    // 1. Initial load of all active symbols
    for (const sym of this.activeSymbols) {
      this.refreshSymbolPrice(sym);
    }

    // 2. Auto-refresh price every 10 seconds directly from MoneyControl
    this.pollInterval = setInterval(() => {
      for (const sym of this.activeSymbols) {
        this.refreshSymbolPrice(sym);
      }
    }, 10000);
  }

  stop() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }
}
