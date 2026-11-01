import { useState, useEffect, useRef, useCallback } from 'react';
import { playAlertChime } from '../utils/audio.js';

export function useTradingStream(activeSymbol) {
  const [isConnected, setIsConnected] = useState(false);
  const [latencyMs, setLatencyMs] = useState(0);
  const [ticksPerSec, setTicksPerSec] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [recentTriggeredAlert, setRecentTriggeredAlert] = useState(null);
  const [account, setAccount] = useState({
    equity: 1000000,
    cash: 1000000,
    realizedPnl: 0,
    unrealizedPnl: 0,
    openPositions: [],
    totalTrades: 0
  });

  const [currentTick, setCurrentTick] = useState(null);
  const [depth, setDepth] = useState({ bids: [], asks: [], spread: 0 });
  const [lastAckLatency, setLastAckLatency] = useState(null);

  const wsRef = useRef(null);
  const tickCountRef = useRef(0);
  const listenersRef = useRef(new Set()); // External high-performance listeners (e.g. Chart)

  const registerTickListener = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  useEffect(() => {
    let reconnectTimeout = null;
    let pingInterval = null;
    let tpsInterval = null;

    const connect = () => {
      const isDev = import.meta.env.DEV;
      const host = isDev ? 'localhost:4000' : window.location.host;
      const protocol = !isDev && window.location.protocol === 'https:' ? 'wss://' : 'ws://';
      const ws = new WebSocket(`${protocol}${host}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        if (activeSymbol) {
          ws.send(JSON.stringify({ type: 'SUBSCRIBE', symbol: activeSymbol }));
        }

        // Start High-Precision RTT Ping loop (every 1.5s)
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING', clientTime: performance.now() }));
          }
        }, 1500);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          tickCountRef.current++;

          switch (msg.type) {
            case 'PONG': {
              const rtt = performance.now() - msg.clientTime;
              setLatencyMs(Number(rtt.toFixed(1)));
              break;
            }

            case 'SNAPSHOT': {
              if (msg.account) setAccount(msg.account);
              if (msg.alerts) setAlerts(msg.alerts);
              if (activeSymbol && msg.prices?.[activeSymbol]) {
                const p = msg.prices[activeSymbol];
                setCurrentTick(p);
                setDepth({ bids: p.bids || [], asks: p.asks || [], spread: p.spread || 0 });
              }
              break;
            }

            case 'ALERTS_UPDATED': {
              if (msg.alerts) setAlerts(msg.alerts);
              break;
            }

            case 'ALERT_TRIGGERED': {
              playAlertChime();
              const notif = {
                id: 'NOTIF_' + Math.random().toString(36).substring(2, 9),
                alert: msg.alert,
                price: msg.price,
                time: msg.timestamp || Date.now(),
                read: false
              };
              setNotifications((prev) => [notif, ...prev]);
              setRecentTriggeredAlert(notif);
              break;
            }


            case 'TICK': {
              if (msg.symbol === activeSymbol) {
                setCurrentTick(msg);
                setDepth({ bids: msg.bids || [], asks: msg.asks || [], spread: msg.spread || 0 });
              }
              if (msg.account) {
                setAccount(msg.account);
              }
              // Notify decoupled listeners (Chart)
              for (const fn of listenersRef.current) {
                fn(msg);
              }
              break;
            }


            case 'ORDER_ACK': {
              setLastAckLatency(msg.latencyUs);
              if (msg.account) setAccount(msg.account);
              break;
            }

            case 'ORDER_FILLED': {
              if (msg.account) setAccount(msg.account);
              break;
            }
          }
        } catch (e) {
          console.error('[Stream] Message parse error:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (pingInterval) clearInterval(pingInterval);
        reconnectTimeout = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    // TPS Counter
    tpsInterval = setInterval(() => {
      setTicksPerSec(tickCountRef.current);
      tickCountRef.current = 0;
    }, 1000);

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (pingInterval) clearInterval(pingInterval);
      if (tpsInterval) clearInterval(tpsInterval);
      if (wsRef.current) wsRef.current.close();
    };
  }, [activeSymbol]);

  // Subscribe when active symbol changes
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && activeSymbol) {
      wsRef.current.send(JSON.stringify({ type: 'SUBSCRIBE', symbol: activeSymbol }));
    }
  }, [activeSymbol]);

  // Send Order
  const placeOrder = useCallback(({ side, qty, orderType = 'MARKET', limitPrice = null }) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'PLACE_ORDER',
      symbol: activeSymbol,
      side,
      qty,
      orderType,
      limitPrice,
      price: currentTick?.price
    }));
  }, [activeSymbol, currentTick]);

  // Flatten Symbol
  const flattenSymbol = useCallback((symbol = activeSymbol) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'FLATTEN_SYMBOL',
      symbol
    }));
  }, [activeSymbol]);

  // Flatten All Positions
  const flattenAll = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'FLATTEN_ALL'
    }));
  }, []);

  // Alerts API
  const createAlert = useCallback(({ symbol = activeSymbol, targetPrice, direction = 'CROSS_ABOVE', note = '' }) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'CREATE_ALERT',
      symbol,
      targetPrice,
      direction,
      note
    }));
  }, [activeSymbol]);

  const deleteAlert = useCallback((id) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'DELETE_ALERT',
      id
    }));
  }, []);

  const resetAlert = useCallback((id) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'RESET_ALERT',
      id
    }));
  }, []);

  const markNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setRecentTriggeredAlert(null);
  }, []);

  const dismissTriggeredAlert = useCallback(() => {
    setRecentTriggeredAlert(null);
  }, []);

  const deleteNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return {
    isConnected,
    latencyMs,
    ticksPerSec,
    alerts,
    notifications,
    recentTriggeredAlert,
    account,
    currentTick,
    depth,
    lastAckLatency,
    createAlert,
    deleteAlert,
    resetAlert,
    dismissTriggeredAlert,
    markNotificationsRead,
    clearNotifications,
    deleteNotification,
    placeOrder,
    flattenSymbol,
    flattenAll,
    registerTickListener
  };
}

