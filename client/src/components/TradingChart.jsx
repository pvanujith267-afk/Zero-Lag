import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CrosshairMode, LineStyle, TickMarkType } from 'lightweight-charts';
import { RefreshCw, Bell, Plus, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { API_BASE } from '../config.js';

const RESOLUTIONS = [
  { label: '1m', value: '1' },
  { label: '3m', value: '3' },
  { label: '5m', value: '5' },
  { label: '15m', value: '15' },
  { label: '30m', value: '30' },
  { label: '1h', value: '60' },
  { label: '1D', value: '1D' },
  { label: '1W', value: 'W' }
];

// Wilder's Smoothed RSI (14)
function calculateRSI(candles, period = 14) {
  if (candles.length <= period) return [];
  const rsiData = [];

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  const firstRs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const firstRsi = 100 - (100 / (1 + firstRs));
  rsiData.push({ time: candles[period].time, value: Number(firstRsi.toFixed(2)) });

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const gain = change >= 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    rsiData.push({ time: candles[i].time, value: Number(rsi.toFixed(2)) });
  }

  return rsiData;
}

// Market hours in India (NSE/BSE): 09:15 to 15:30 IST.
// For 5m: 09:15 is first candle, 15:25 is the last candle.
// Any candle past market hours (e.g. 15:30 closing print) is merged into 15:25.
function sanitizeIntradayCandles(data, resolution) {
  if (!data || !data.t || data.t.length === 0) return [];
  const isDaily = resolution === '1D' || resolution === 'W' || resolution === 'M';

  if (isDaily) {
    const list = [];
    for (let i = 0; i < data.t.length; i++) {
      list.push({
        time: data.t[i],
        open: data.o[i],
        high: data.h[i],
        low: data.l[i],
        close: data.c[i]
      });
    }
    return list;
  }

  const resMinutes = parseInt(resolution, 10) || 5;
  // Last candle start timestamp is (15*60 + 30 - resMinutes) minutes from midnight IST
  // For 5m: 15:25:00 IST (55500 seconds from midnight)
  const lastCandleSec = (15 * 60 + 30 - resMinutes) * 60;

  const candles = [];
  for (let i = 0; i < data.t.length; i++) {
    const time = data.t[i];
    const secFromMidnight = (time + 19800) % 86400;

    // If candle is after market hours (e.g. 15:30), merge into the last valid candle of the day
    if (secFromMidnight > lastCandleSec) {
      if (candles.length > 0) {
        const prev = candles[candles.length - 1];
        const prevDay = Math.floor((prev.time + 19800) / 86400);
        const curDay = Math.floor((time + 19800) / 86400);

        if (prevDay === curDay) {
          prev.high = Math.max(prev.high, data.h[i]);
          prev.low = Math.min(prev.low, data.l[i]);
          prev.close = data.c[i];
          continue;
        }
      }
    }

    candles.push({
      time,
      open: data.o[i],
      high: data.h[i],
      low: data.l[i],
      close: data.c[i]
    });
  }

  return candles;
}

// Calculate the bucket time for a real-time tick in IST (09:15 - 15:30)
// For 5m: bucket is strictly between 09:15 and 15:25.
function getIntradayBucketTime(timeSec, resolution) {
  const isDaily = resolution === '1D' || resolution === 'W' || resolution === 'M';
  if (isDaily) return timeSec;

  const resMinutes = parseInt(resolution, 10) || 5;
  const intervalSec = resMinutes * 60;

  // IST offset is UTC+5:30 (+19800s)
  const secFromMidnight = (timeSec + 19800) % 86400;
  const dayStartSec = timeSec - secFromMidnight;

  const marketOpenSec = dayStartSec + (9 * 3600 + 15 * 60); // 09:15:00 IST
  const marketCloseSec = dayStartSec + (15 * 3600 + 30 * 60); // 15:30:00 IST
  const lastCandleSec = marketCloseSec - intervalSec; // 15:25:00 IST for 5m

  if (timeSec < marketOpenSec) {
    return marketOpenSec;
  }
  if (timeSec >= marketCloseSec) {
    return lastCandleSec;
  }

  const elapsed = timeSec - marketOpenSec;
  const bucketIndex = Math.floor(elapsed / intervalSec);
  const bucketTime = marketOpenSec + bucketIndex * intervalSec;

  return Math.min(bucketTime, lastCandleSec);
}

// Format time scale tick marks in Indian Standard Time (IST, UTC+5:30)
// e.g. 09:15, 10:00, 15:25
function formatTickMarkIST(time, tickMarkType) {
  if (!time) return null;
  let date;
  if (typeof time === 'number') {
    date = new Date(time * 1000);
  } else if (typeof time === 'string') {
    date = new Date(time);
  } else if (typeof time === 'object' && time.year) {
    date = new Date(Date.UTC(time.year, time.month - 1, time.day));
  } else {
    return null;
  }
  if (isNaN(date.getTime())) return null;

  // Year (0)
  if (tickMarkType === TickMarkType.Year) {
    return date.toLocaleDateString('en-GB', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric'
    });
  }
  // Month (1)
  if (tickMarkType === TickMarkType.Month) {
    return date.toLocaleDateString('en-GB', {
      timeZone: 'Asia/Kolkata',
      month: 'short'
    });
  }
  // Day of month (2)
  if (tickMarkType === TickMarkType.DayOfMonth) {
    return date.toLocaleDateString('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric'
    });
  }
  // Time (3: Time, 4: TimeWithSeconds)
  return date.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

// Format crosshair / tooltip time in Indian Standard Time (IST, UTC+5:30)
function formatCrosshairTimeIST(time) {
  if (!time) return '';
  let date;
  if (typeof time === 'number') {
    date = new Date(time * 1000);
  } else if (typeof time === 'string') {
    date = new Date(time);
  } else if (typeof time === 'object' && time.year) {
    date = new Date(Date.UTC(time.year, time.month - 1, time.day));
  } else {
    return '';
  }
  if (isNaN(date.getTime())) return '';

  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

export function TradingChart({
  symbol,
  registerTickListener,
  alerts = [],
  onOpenAlertModal,
  initialResolution = '5', // Default 5m intraday as requested
  compact = false
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const rsiSeriesRef = useRef(null);
  const lastBarRef = useRef(null);
  const priceLinesRef = useRef([]);
  const candlesRef = useRef([]);

  const [resolution, setResolution] = useState(initialResolution);
  const [isLoading, setIsLoading] = useState(false);
  const [ohlc, setOhlc] = useState(null);
  const [rsiValue, setRsiValue] = useState(null);
  const [showRsi, setShowRsi] = useState(true);
  const [crosshairPos, setCrosshairPos] = useState(null); // { x, y, price, time }
  const [isHoveringButton, setIsHoveringButton] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const priceScaleMarginsRef = useRef({ top: 0.05, bottom: 0.28 });

  const isHoveringButtonRef = useRef(false);
  const hideTimerRef = useRef(null);
  const lastTimeRef = useRef(null);

  // Mouse Move over chart to calculate price & position the '+' button
  const handleMouseMove = (e) => {
    if (isHoveringButtonRef.current) return;
    if (!containerRef.current || !candleSeriesRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const x = e.clientX - rect.left;

    // When cursor is inside right price scale (last 65px), do NOT show alert button
    // This leaves price scale 100% unobstructed for vertical click-drag and wheel zooming
    if (x >= rect.width - 65 || y < 5 || y > rect.height - 25 || x < 0) {
      scheduleHide();
      return;
    }

    const price = candleSeriesRef.current.coordinateToPrice(y);
    if (price !== null && !isNaN(price) && price > 0) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setCrosshairPos((prev) => ({
        x,
        y,
        price: Number(price.toFixed(2)),
        time: lastTimeRef.current || prev?.time || null
      }));
    }
  };

  const scheduleHide = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!isHoveringButtonRef.current) {
        setCrosshairPos(null);
        setIsHoveringButton(false);
      }
    }, 250);
  };

  // Intercept wheel events in CAPTURE phase with passive: false
  // Stops horizontal time-scale zooming when cursor is over the price scale!
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onNativeWheel = (e) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;

      // If mouse wheel is scrolled over the right price scale (last 65px)
      if (x >= rect.width - 65) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const chart = chartRef.current;
        if (!chart) return;
        const priceScale = chart.priceScale('right');
        if (!priceScale) return;

        const step = 0.03;
        const change = e.deltaY > 0 ? step : -step;
        const newTop = Math.max(0.01, Math.min(0.45, priceScaleMarginsRef.current.top + change));
        const newBottom = Math.max(0.01, Math.min(0.45, priceScaleMarginsRef.current.bottom + change));

        priceScaleMarginsRef.current = { top: newTop, bottom: newBottom };

        priceScale.applyOptions({
          autoScale: false,
          scaleMargins: priceScaleMarginsRef.current
        });
      }
    };

    container.addEventListener('wheel', onNativeWheel, { capture: true, passive: false });
    return () => {
      container.removeEventListener('wheel', onNativeWheel, { capture: true });
    };
  }, []);

  const handleDoubleClick = (e) => {
    if (!containerRef.current || !chartRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;

    if (x >= rect.width - 65) {
      const priceScale = chartRef.current.priceScale('right');
      if (priceScale) {
        const defaultMargins = { top: 0.05, bottom: showRsi ? 0.28 : 0.08 };
        priceScaleMarginsRef.current = defaultMargins;
        priceScale.applyOptions({
          autoScale: true,
          scaleMargins: defaultMargins
        });
      }
    }
  };

  // Initialize TradingView Lightweight Chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#090c12' },
        textColor: '#94a3b8',
        fontSize: compact ? 11 : 12,
        fontFamily: 'ui-monospace, SFMono-Regular, monospace'
      },
      grid: {
        vertLines: { color: '#131926' },
        horzLines: { color: '#131926' }
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#3b82f6',
          width: 1,
          style: LineStyle.Dotted,
          labelBackgroundColor: '#1e293b'
        },
        horzLine: {
          color: '#3b82f6',
          width: 1,
          style: LineStyle.Dotted,
          labelBackgroundColor: '#1e293b'
        }
      },
      localization: {
        locale: 'en-IN',
        dateFormat: 'dd MMM yyyy',
        timeFormatter: (time) => formatCrosshairTimeIST(time)
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 9,
        tickMarkFormatter: (time, tickMarkType) => formatTickMarkIST(time, tickMarkType)
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        autoScale: true,
        scaleMargins: {
          top: 0.05,
          bottom: showRsi ? 0.28 : 0.08
        },
        visible: true
      },
      handleScale: {
        axisPressedMouseMove: {
          time: true,
          price: true
        },
        axisDoubleClickReset: {
          time: true,
          price: true
        },
        mouseWheel: true,
        pinch: true
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true
      }
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00c087',
      downColor: '#ff3b69',
      borderUpColor: '#00c087',
      borderDownColor: '#ff3b69',
      wickUpColor: '#00c087',
      wickDownColor: '#ff3b69',
      scaleMargins: {
        top: 0.05,
        bottom: showRsi ? 0.28 : 0.08
      }
    });

    // Sub-pane RSI (14) Series (matching FYERS / TradingView purple line)
    const rsiSeries = chart.addLineSeries({
      color: '#a855f7',
      lineWidth: 1.5,
      priceScaleId: 'rsi',
      priceFormat: {
        type: 'custom',
        formatter: (val) => val.toFixed(2)
      }
    });

    chart.priceScale('rsi').applyOptions({
      scaleMargins: {
        top: 0.78,
        bottom: 0.02
      },
      visible: false
    });

    // Dashed threshold lines at 80 and 40 (matching image)
    rsiSeries.createPriceLine({
      price: 80,
      color: 'rgba(168, 85, 247, 0.4)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false
    });
    rsiSeries.createPriceLine({
      price: 40,
      color: 'rgba(168, 85, 247, 0.4)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    rsiSeriesRef.current = rsiSeries;

    // Crosshair move handler (OHLC & RSI readout)
    chart.subscribeCrosshairMove((param) => {
      if (param.time) {
        lastTimeRef.current = param.time;
        const data = param.seriesData.get(candleSeries);
        if (data) {
          setOhlc({
            time: param.time,
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close
          });
        }
        if (rsiSeriesRef.current) {
          const rsiPoint = param.seriesData.get(rsiSeriesRef.current);
          if (rsiPoint && rsiPoint.value !== undefined) {
            setRsiValue(rsiPoint.value);
          }
        }
      } else if (lastBarRef.current) {
        setOhlc(lastBarRef.current);
      }
    });

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0] && entries[0].contentRect) {
        const { width, height } = entries[0].contentRect;
        chart.applyOptions({ width, height });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [compact, showRsi]);

  // Load Historical Data
  const loadHistory = async () => {
    if (!symbol || !candleSeriesRef.current) return;
    setIsLoading(true);

    try {
      const count = resolution === '1' || resolution === '3' || resolution === '5' ? 350 : 250;
      const res = await fetch(`${API_BASE}/api/history?symbol=${symbol}&resolution=${resolution}&countback=${count}`);
      const data = await res.json();

      if (data && data.t && data.t.length > 0) {
        const candles = sanitizeIntradayCandles(data, resolution);

        candlesRef.current = candles;
        candleSeriesRef.current.setData(candles);

        // Compute and set RSI (14)
        if (rsiSeriesRef.current && showRsi) {
          const rsiPoints = calculateRSI(candles, 14);
          rsiSeriesRef.current.setData(rsiPoints);
          if (rsiPoints.length > 0) {
            setRsiValue(rsiPoints[rsiPoints.length - 1].value);
          }
        }

        if (candles.length > 0) {
          const last = candles[candles.length - 1];
          lastBarRef.current = last;
          setOhlc(last);

          // Zoom into today's trading session (approx. 80 5-minute bars, matching FYERS image)
          const totalBars = candles.length;
          const visibleBars = resolution === '5' ? 80 : resolution === '1' ? 95 : resolution === '15' ? 45 : 75;

          chartRef.current.timeScale().applyOptions({
            rightOffset: 6,
            barSpacing: 9
          });

          chartRef.current.timeScale().setVisibleLogicalRange({
            from: Math.max(0, totalBars - visibleBars),
            to: totalBars + 5
          });
        }
      }
    } catch (err) {
      console.error('[Chart] Error loading history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset chart to original zoom, time range & price scale (TradingView style)
  const resetChartPosition = () => {
    if (!chartRef.current) return;

    setIsResetting(true);
    setTimeout(() => setIsResetting(false), 500);

    // 1. Reset right price scale to autoScale: true with initial margins
    const priceScale = chartRef.current.priceScale('right');
    if (priceScale) {
      const defaultMargins = { top: 0.05, bottom: showRsi ? 0.28 : 0.08 };
      priceScaleMarginsRef.current = defaultMargins;
      priceScale.applyOptions({
        autoScale: true,
        scaleMargins: defaultMargins
      });
    }

    // 2. Reset RSI price scale margins if shown
    if (showRsi) {
      try {
        chartRef.current.priceScale('rsi').applyOptions({
          scaleMargins: {
            top: 0.78,
            bottom: 0.02
          },
          visible: false
        });
      } catch (e) {
        // ignore
      }
    }

    // 3. Reset Time Scale spacing & rightOffset
    const timeScale = chartRef.current.timeScale();
    timeScale.applyOptions({
      rightOffset: 6,
      barSpacing: 9
    });

    // 4. Reset visible logical range to initial session view
    const totalBars = candlesRef.current?.length || 0;
    if (totalBars > 0) {
      const visibleBars = resolution === '5' ? 80 : resolution === '1' ? 95 : resolution === '15' ? 45 : 75;
      timeScale.setVisibleLogicalRange({
        from: Math.max(0, totalBars - visibleBars),
        to: totalBars + 5
      });
    } else {
      timeScale.resetTimeScale();
      timeScale.scrollToRealTime();
    }
  };

  // TradingView-style keyboard shortcut: Alt+R to reset chart position
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        resetChartPosition();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resolution, showRsi]);

  useEffect(() => {
    loadHistory();
  }, [symbol, resolution, showRsi]);

  // Draw Visual Price Alert Lines directly on Chart
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    for (const line of priceLinesRef.current) {
      try {
        candleSeriesRef.current.removePriceLine(line);
      } catch (e) {
        // ignore
      }
    }
    priceLinesRef.current = [];

    const activeAlerts = alerts.filter((a) => !a.triggered && a.symbol === symbol.toUpperCase().trim());

    for (const alt of activeAlerts) {
      try {
        const line = candleSeriesRef.current.createPriceLine({
          price: alt.targetPrice,
          color: alt.direction === 'CROSS_ABOVE' ? '#10b981' : '#f43f5e',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `🔔 ${alt.note || (alt.direction === 'CROSS_ABOVE' ? 'Alert ≥' : 'Alert ≤')}`
        });
        priceLinesRef.current.push(line);
      } catch (err) {
        console.error('Error drawing price line:', err);
      }
    }
  }, [alerts, symbol]);

  // Real-time Tick Updates (Strictly respecting 09:15 - 15:30 IST market hours; 15:25 is last 5m candle)
  useEffect(() => {
    if (!registerTickListener) return;

    const unbind = registerTickListener((tick) => {
      if (tick.symbol !== symbol || !candleSeriesRef.current) return;

      const currentPrice = tick.price;
      const lastBar = lastBarRef.current;
      const tickTimeSec = tick.time || Math.floor(Date.now() / 1000);
      const isDaily = resolution === '1D' || resolution === 'W';

      if (!lastBar) {
        const bucketTime = isDaily ? tickTimeSec : getIntradayBucketTime(tickTimeSec, resolution);
        const newBar = {
          time: bucketTime,
          open: currentPrice,
          high: currentPrice,
          low: currentPrice,
          close: currentPrice
        };
        lastBarRef.current = newBar;
        candlesRef.current.push(newBar);
        candleSeriesRef.current.update(newBar);
        setOhlc(newBar);
        return;
      }

      if (isDaily) {
        const updatedBar = {
          ...lastBar,
          high: Math.max(lastBar.high, currentPrice),
          low: Math.min(lastBar.low, currentPrice),
          close: currentPrice
        };
        lastBarRef.current = updatedBar;
        if (candlesRef.current.length > 0) {
          candlesRef.current[candlesRef.current.length - 1] = updatedBar;
        }
        candleSeriesRef.current.update(updatedBar);
        setOhlc(updatedBar);
        return;
      }

      // Intraday: compute exact bucket time in IST (09:15 - 15:25)
      const bucketTime = getIntradayBucketTime(tickTimeSec, resolution);

      // If tick belongs to current candle (or at/after market close 15:30, capped to lastBar at 15:25)
      if (bucketTime <= lastBar.time) {
        const updatedBar = {
          ...lastBar,
          high: Math.max(lastBar.high, currentPrice),
          low: Math.min(lastBar.low, currentPrice),
          close: currentPrice
        };
        lastBarRef.current = updatedBar;
        if (candlesRef.current.length > 0) {
          candlesRef.current[candlesRef.current.length - 1] = updatedBar;
        }
        candleSeriesRef.current.update(updatedBar);
        setOhlc(updatedBar);
      } else {
        // New candle bucket during active market hours (09:15 - 15:25)
        const newBar = {
          time: bucketTime,
          open: currentPrice,
          high: currentPrice,
          low: currentPrice,
          close: currentPrice
        };
        lastBarRef.current = newBar;
        candlesRef.current.push(newBar);
        candleSeriesRef.current.update(newBar);
        setOhlc(newBar);
      }
    });

    return () => unbind();
  }, [symbol, resolution, registerTickListener]);

  return (
    <div className="relative flex flex-col w-full h-full bg-[#090c12] border border-[#1b2234] rounded-lg overflow-hidden shadow-2xl">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0d121c] border-b border-[#1b2234]">
        <div className="flex items-center space-x-2.5">
          {/* Header Title: Formatted like FYERS snapshot e.g. "TATA CONSUMER PRODUCT LTD, 5, NSE" */}
          <div className="flex items-center space-x-1.5 font-bold text-white text-xs font-mono">
            <span>{symbol}</span>
            <span className="text-gray-500">•</span>
            <span className="text-blue-400">{resolution === '1D' ? '1D' : `${resolution}m`}</span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-400">NSE (IST)</span>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center bg-[#141b27] rounded p-0.5 border border-[#1e2738]">
            {RESOLUTIONS.map((res) => (
              <button
                key={res.value}
                onClick={() => setResolution(res.value)}
                className={`px-1.5 py-0.5 text-[11px] font-semibold rounded transition-all ${
                  resolution === res.value
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-gray-400 hover:text-white hover:bg-[#1f293d]'
                }`}
              >
                {res.label}
              </button>
            ))}
          </div>

          {/* RSI Toggle Button */}
          <button
            onClick={() => setShowRsi(!showRsi)}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold font-mono border transition ${
              showRsi
                ? 'bg-purple-950/60 border-purple-500/50 text-purple-300'
                : 'bg-[#141b27] border-[#1e2738] text-gray-400 hover:text-white'
            }`}
            title="Toggle RSI (14) indicator"
          >
            <span>RSI (14)</span>
          </button>

          {/* Reload Button */}
          <button
            onClick={loadHistory}
            disabled={isLoading}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#1e2738] transition"
            title="Reload Candlesticks"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin text-blue-400' : ''} />
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {/* Live OHLC and RSI readout */}
          {ohlc && !compact && (
            <div className="hidden lg:flex items-center space-x-2.5 text-[11px] font-mono">
              {ohlc.time && (
                <div className="text-blue-400 font-bold pr-1 border-r border-[#1f293d]">
                  {formatCrosshairTimeIST(ohlc.time)}
                </div>
              )}
              <div><span className="text-gray-500">O:</span> <span className="text-gray-300">₹{ohlc.open?.toFixed(2)}</span></div>
              <div><span className="text-gray-500">H:</span> <span className="text-emerald-400">₹{ohlc.high?.toFixed(2)}</span></div>
              <div><span className="text-gray-500">L:</span> <span className="text-rose-400">₹{ohlc.low?.toFixed(2)}</span></div>
              <div><span className="text-gray-500">C:</span> <span className={ohlc.close >= ohlc.open ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>₹{ohlc.close?.toFixed(2)}</span></div>
              {showRsi && rsiValue !== null && (
                <div className="pl-1 border-l border-[#1f293d]">
                  <span className="text-purple-400 font-bold">RSI (14):</span>{' '}
                  <span className="text-purple-300 font-semibold">{rsiValue.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Quick "Set Alert" Button */}
          {onOpenAlertModal && (
            <button
              onClick={() => onOpenAlertModal(symbol)}
              className="flex items-center space-x-1 px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-[11px] font-semibold transition"
              title="Add Price Alert for this stock"
            >
              <Bell size={11} />
              <span>+ Alert</span>
            </button>
          )}
        </div>
      </div>

      {/* Chart Canvas & Interactive Crosshair "+" Alert Button */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={scheduleHide}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!containerRef.current || !candleSeriesRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const y = e.clientY - rect.top;
          const price = candleSeriesRef.current.coordinateToPrice(y);
          if (price && onOpenAlertModal) {
            onOpenAlertModal(symbol, Number(price.toFixed(2)));
          }
        }}
        className="relative flex-1 w-full h-full min-h-[220px]"
      >
        {/* Persistent Crosshair Lines & Alert Pill (TradingView Style) */}
        {crosshairPos && (
          <>
            {/* Horizontal Crosshair Guideline across Chart */}
            <div
              className="absolute pointer-events-none z-20 border-b border-dashed border-[#3b82f6]/80"
              style={{
                top: `${crosshairPos.y}px`,
                left: 0,
                right: '65px'
              }}
            />

            {/* Vertical Crosshair Guideline (kept steady when hovering alert button) */}
            {isHoveringButton && crosshairPos.x && (
              <div
                className="absolute pointer-events-none z-20 border-r border-dashed border-[#3b82f6]/80"
                style={{
                  top: 0,
                  bottom: '24px',
                  left: `${crosshairPos.x}px`
                }}
              />
            )}

            {/* Price Scale Axis Badge (kept steady when hovering alert button) */}
            {isHoveringButton && (
              <div
                className="absolute pointer-events-none z-20 flex items-center justify-center bg-[#2962ff] text-white text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-l shadow-md"
                style={{
                  top: `${crosshairPos.y - 11}px`,
                  right: 0,
                  width: '65px'
                }}
              >
                {crosshairPos.price.toFixed(2)}
              </div>
            )}

            {/* TradingView-style Stable "+" Crosshair Alert Pill */}
            <div
              className="absolute z-30 pointer-events-auto flex items-center cursor-pointer transition-transform select-none"
              style={{
                top: `${crosshairPos.y - 12}px`,
                right: '68px' // positioned right next to the price scale so vertical zooming is 100% unobstructed
              }}
              onMouseEnter={() => {
                isHoveringButtonRef.current = true;
                setIsHoveringButton(true);
                if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
                if (chartRef.current && candleSeriesRef.current && crosshairPos?.price && crosshairPos?.time) {
                  try {
                    chartRef.current.setCrosshairPosition(crosshairPos.price, crosshairPos.time, candleSeriesRef.current);
                  } catch (e) {
                    // ignore
                  }
                }
              }}
              onMouseLeave={() => {
                isHoveringButtonRef.current = false;
                setIsHoveringButton(false);
                scheduleHide();
                if (chartRef.current) {
                  try {
                    chartRef.current.clearCrosshairPosition();
                  } catch (e) {
                    // ignore
                  }
                }
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (onOpenAlertModal) {
                  onOpenAlertModal(symbol, crosshairPos.price);
                }
              }}
              title={`Click or Right-Click to set Alert for ${symbol} at ₹${crosshairPos.price.toFixed(2)}`}
            >
              {/* Stable Clickable Pill */}
              <div className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-white shadow-2xl transition-all group ${
                isHoveringButton
                  ? 'bg-blue-600 border border-blue-400 scale-105 shadow-blue-500/20'
                  : 'bg-[#141d2c] border border-blue-500/60 hover:bg-blue-600'
              }`}>
                <Plus size={13} strokeWidth={3} className={isHoveringButton ? 'text-white' : 'text-blue-400'} />
                <span className="text-[11px] font-mono font-bold">
                  ₹{crosshairPos.price.toFixed(2)}
                </span>
              </div>
            </div>
          </>
        )}

        {/* TradingView-style Bottom Center Reset/Refresh View Button */}
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-20 pointer-events-auto select-none">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              resetChartPosition();
            }}
            onMouseMove={(e) => e.stopPropagation()}
            onMouseEnter={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
            className={`flex items-center ${
              compact ? 'p-1.5' : 'space-x-1.5 px-2.5 py-1'
            } bg-[#131722]/90 hover:bg-[#1e2738] active:bg-[#253248] text-gray-400 hover:text-white border border-[#232e42] hover:border-blue-500/60 rounded-full shadow-lg backdrop-blur-sm transition-all duration-200 active:scale-95 group cursor-pointer`}
            title="Reset chart to original position (Alt+R)"
          >
            <RotateCcw
              size={12}
              strokeWidth={2.2}
              className={`transition-transform duration-500 ${
                isResetting
                  ? '-rotate-180 text-blue-400'
                  : 'group-hover:-rotate-45 text-gray-400 group-hover:text-blue-400'
              }`}
            />
            {!compact && (
              <span className="text-[11px] font-mono font-medium tracking-wide text-gray-300 group-hover:text-white">
                Reset
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
