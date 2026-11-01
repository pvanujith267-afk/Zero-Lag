/**
 * Sub-Millisecond Paper Trading & Matching Engine
 */

export class TradingEngine {
  constructor(initialCapital = 1000000) {
    this.initialCapital = initialCapital;
    this.cash = initialCapital;
    this.realizedPnl = 0;
    this.positions = new Map(); // symbol -> { qty, avgPrice, currentPrice, unrealizedPnl, realizedPnl }
    this.orders = [];
    this.tradeHistory = [];
    this.listeners = new Set();
  }

  onUpdate(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('[Engine] listener error:', e);
      }
    }
  }

  updateMarketPrice(symbol, price) {
    if (!price || price <= 0) return;
    const sym = symbol.toUpperCase().trim();
    const pos = this.positions.get(sym);
    if (pos && pos.qty !== 0) {
      pos.currentPrice = price;
      pos.unrealizedPnl = Number(((price - pos.avgPrice) * pos.qty).toFixed(2));
      this.checkLimitOrders(sym, price);
    }
  }

  checkLimitOrders(symbol, currentPrice) {
    const pending = this.orders.filter(o => o.symbol === symbol && o.status === 'PENDING');
    for (const order of pending) {
      let shouldFill = false;
      if (order.side === 'BUY' && currentPrice <= order.price) {
        shouldFill = true;
      } else if (order.side === 'SELL' && currentPrice >= order.price) {
        shouldFill = true;
      }

      if (shouldFill) {
        this.fillOrder(order, currentPrice);
      }
    }
  }

  placeOrder({ symbol, side, qty, orderType = 'MARKET', limitPrice = null, currentPrice = null }) {
    const startHr = process.hrtime.bigint();
    const sym = symbol.toUpperCase().trim();
    const quantity = Math.abs(parseInt(qty, 10));

    if (!quantity || quantity <= 0) {
      throw new Error('Invalid order quantity');
    }

    const orderId = 'ORD_' + Math.random().toString(36).substring(2, 9).toUpperCase();
    const order = {
      id: orderId,
      symbol: sym,
      side: side.toUpperCase(), // 'BUY' or 'SELL'
      type: orderType.toUpperCase(),
      qty: quantity,
      price: limitPrice || currentPrice,
      status: 'PENDING',
      timestamp: Date.now()
    };

    if (order.type === 'MARKET') {
      const execPrice = currentPrice || limitPrice;
      if (!execPrice || execPrice <= 0) {
        throw new Error('Cannot execute market order without current price');
      }
      this.fillOrder(order, execPrice);
    } else {
      this.orders.unshift(order);
    }

    const endHr = process.hrtime.bigint();
    const execLatencyUs = Number(endHr - startHr) / 1000; // microseconds

    return {
      order,
      executionLatencyUs: execLatencyUs,
      account: this.getAccountSummary()
    };
  }

  fillOrder(order, execPrice) {
    const sym = order.symbol;
    let pos = this.positions.get(sym);
    if (!pos) {
      pos = {
        symbol: sym,
        qty: 0,
        avgPrice: 0,
        currentPrice: execPrice,
        unrealizedPnl: 0,
        realizedPnl: 0
      };
      this.positions.set(sym, pos);
    }

    const deltaQty = order.side === 'BUY' ? order.qty : -order.qty;
    const oldQty = pos.qty;
    const newQty = oldQty + deltaQty;

    let tradeRealizedPnl = 0;

    if (oldQty === 0) {
      // New Position
      pos.avgPrice = execPrice;
      pos.qty = newQty;
    } else if ((oldQty > 0 && deltaQty > 0) || (oldQty < 0 && deltaQty < 0)) {
      // Adding to existing position
      const totalCost = (Math.abs(oldQty) * pos.avgPrice) + (Math.abs(deltaQty) * execPrice);
      pos.qty = newQty;
      pos.avgPrice = Number((totalCost / Math.abs(newQty)).toFixed(2));
    } else {
      // Reducing or Reversing position
      const closingQty = Math.min(Math.abs(oldQty), Math.abs(deltaQty));
      if (oldQty > 0) {
        // Closing Long
        tradeRealizedPnl = (execPrice - pos.avgPrice) * closingQty;
      } else {
        // Closing Short
        tradeRealizedPnl = (pos.avgPrice - execPrice) * closingQty;
      }

      this.realizedPnl += tradeRealizedPnl;
      pos.realizedPnl += tradeRealizedPnl;

      if (newQty === 0) {
        pos.qty = 0;
        pos.avgPrice = 0;
        pos.unrealizedPnl = 0;
      } else if ((oldQty > 0 && newQty < 0) || (oldQty < 0 && newQty > 0)) {
        // Reversal
        pos.qty = newQty;
        pos.avgPrice = execPrice;
      } else {
        // Partial close
        pos.qty = newQty;
      }
    }

    pos.currentPrice = execPrice;
    pos.unrealizedPnl = pos.qty !== 0 ? Number(((execPrice - pos.avgPrice) * pos.qty).toFixed(2)) : 0;

    order.status = 'FILLED';
    order.fillPrice = execPrice;
    order.fillTime = Date.now();
    order.realizedPnl = Number(tradeRealizedPnl.toFixed(2));

    this.tradeHistory.unshift({
      id: order.id,
      symbol: sym,
      side: order.side,
      qty: order.qty,
      price: execPrice,
      realizedPnl: Number(tradeRealizedPnl.toFixed(2)),
      timestamp: Date.now()
    });

    this.notify({
      type: 'ORDER_FILLED',
      order,
      position: { ...pos },
      account: this.getAccountSummary()
    });
  }

  flattenSymbol(symbol, currentPrice) {
    const sym = symbol.toUpperCase().trim();
    const pos = this.positions.get(sym);
    if (!pos || pos.qty === 0) return null;

    const side = pos.qty > 0 ? 'SELL' : 'BUY';
    const qty = Math.abs(pos.qty);
    return this.placeOrder({
      symbol: sym,
      side,
      qty,
      orderType: 'MARKET',
      currentPrice: currentPrice || pos.currentPrice
    });
  }

  flattenAll(priceMap = {}) {
    const results = [];
    for (const [sym, pos] of this.positions.entries()) {
      if (pos.qty !== 0) {
        const p = priceMap[sym] || pos.currentPrice;
        results.push(this.flattenSymbol(sym, p));
      }
    }
    return results;
  }

  cancelAllOrders(symbol = null) {
    const cancelled = [];
    this.orders = this.orders.filter(o => {
      if (o.status === 'PENDING' && (!symbol || o.symbol === symbol.toUpperCase())) {
        o.status = 'CANCELLED';
        cancelled.push(o);
        return false;
      }
      return true;
    });
    return cancelled;
  }

  getAccountSummary() {
    let totalUnrealizedPnl = 0;
    const openPositions = [];

    for (const pos of this.positions.values()) {
      if (pos.qty !== 0) {
        totalUnrealizedPnl += pos.unrealizedPnl;
        openPositions.push({ ...pos });
      }
    }

    const equity = this.cash + this.realizedPnl + totalUnrealizedPnl;

    return {
      initialCapital: this.initialCapital,
      cash: Number((this.cash + this.realizedPnl).toFixed(2)),
      equity: Number(equity.toFixed(2)),
      realizedPnl: Number(this.realizedPnl.toFixed(2)),
      unrealizedPnl: Number(totalUnrealizedPnl.toFixed(2)),
      openPositions,
      totalTrades: this.tradeHistory.length
    };
  }
}
