import fs from 'fs';
import path from 'path';

export class AlertManager {
  constructor() {
    this.alerts = [
      {
        id: 'ALT_1',
        symbol: 'LAURUSLABS',
        targetPrice: 2450.0,
        direction: 'CROSS_ABOVE',
        note: 'Breakout Resistance',
        active: true,
        triggered: false,
        createdAt: Date.now()
      }
    ];
    this.lastPrices = new Map(); // symbol -> lastPrice
  }

  getAlerts(symbol = null) {
    if (symbol) {
      return this.alerts.filter((a) => a.symbol === symbol.toUpperCase().trim());
    }
    return this.alerts;
  }

  addAlert({ symbol, targetPrice, direction = 'CROSS_ABOVE', note = '' }) {
    const sym = symbol.toUpperCase().trim();
    const price = parseFloat(targetPrice);
    if (!price || price <= 0) {
      throw new Error('Invalid target price');
    }

    const newAlert = {
      id: 'ALT_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      symbol: sym,
      targetPrice: price,
      direction: direction.toUpperCase(), // 'CROSS_ABOVE' or 'CROSS_BELOW'
      note: note.trim() || `Target ₹${price}`,
      active: true,
      triggered: false,
      createdAt: Date.now(),
      triggeredAt: null
    };

    this.alerts.unshift(newAlert);
    return newAlert;
  }

  deleteAlert(id) {
    const idx = this.alerts.findIndex((a) => a.id === id);
    if (idx !== -1) {
      const removed = this.alerts.splice(idx, 1)[0];
      return removed;
    }
    return null;
  }

  resetAlert(id) {
    const alert = this.alerts.find((a) => a.id === id);
    if (alert) {
      alert.triggered = false;
      alert.active = true;
      alert.triggeredAt = null;
      return alert;
    }
    return null;
  }

  // Evaluates alerts when a new price arrives for a symbol
  checkPrice(symbol, currentPrice) {
    const sym = symbol.toUpperCase().trim();
    const prevPrice = this.lastPrices.get(sym);
    this.lastPrices.set(sym, currentPrice);

    if (prevPrice === undefined) {
      return []; // Wait for next tick to detect a true cross
    }

    const triggeredNow = [];

    for (const alert of this.alerts) {
      if (!alert.active || alert.triggered || alert.symbol !== sym) {
        continue;
      }

      let shouldTrigger = false;

      if (alert.direction === 'CROSS_ABOVE') {
        if (prevPrice <= alert.targetPrice && currentPrice >= alert.targetPrice) {
          shouldTrigger = true;
        }
      } else if (alert.direction === 'CROSS_BELOW') {
        if (prevPrice >= alert.targetPrice && currentPrice <= alert.targetPrice) {
          shouldTrigger = true;
        }
      }

      if (shouldTrigger) {
        alert.triggered = true;
        alert.active = false;
        alert.triggeredAt = Date.now();
        alert.triggerPrice = currentPrice;
        triggeredNow.push(alert);
      }
    }

    return triggeredNow;
  }
}
