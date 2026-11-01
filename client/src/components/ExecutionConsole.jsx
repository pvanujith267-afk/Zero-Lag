import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, Zap, ShieldAlert, Award, Hash } from 'lucide-react';

const PRESET_QTYS = [10, 50, 100, 250, 500, 1000];

export function ExecutionConsole({
  symbol,
  currentPrice,
  depth,
  account,
  placeOrder,
  flattenSymbol,
  flattenAll,
  lastAckLatency
}) {
  const [qty, setQty] = useState(50);

  // Position for active symbol
  const activePosition = account?.openPositions?.find(
    (p) => p.symbol.toUpperCase() === symbol.toUpperCase() && p.qty !== 0
  );

  // Global Hotkey Listener for Instant Execution
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        return;
      }

      if (e.code === 'Space' && !e.shiftKey) {
        e.preventDefault();
        placeOrder({ side: 'BUY', qty });
      } else if (e.code === 'Space' && e.shiftKey) {
        e.preventDefault();
        placeOrder({ side: 'SELL', qty });
      } else if (e.key === 'b' || e.key === 'B') {
        placeOrder({ side: 'BUY', qty });
      } else if (e.key === 's' || e.key === 'S') {
        placeOrder({ side: 'SELL', qty });
      } else if (e.key === 'Escape' || e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        flattenSymbol(symbol);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setQty((prev) => Math.min(prev + 10, 10000));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setQty((prev) => Math.max(prev - 10, 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [symbol, qty, placeOrder, flattenSymbol]);

  const bestAsk = depth?.asks?.[0]?.price || currentPrice;
  const bestBid = depth?.bids?.[0]?.price || currentPrice;

  return (
    <div className="flex flex-col bg-[#0d121c] border border-[#1b2234] rounded-lg p-3 space-y-3 shadow-2xl">
      {/* Top Header: Account Equity & Execution Latency */}
      <div className="flex items-center justify-between pb-2 border-b border-[#1b2234]">
        <div className="flex items-center space-x-4">
          <div>
            <div className="text-[10px] text-gray-400 font-mono">EQUITY</div>
            <div className="text-sm font-bold font-mono text-white">
              ₹{(account?.equity || 1000000).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 font-mono">REALIZED P&L</div>
            <div className={`text-sm font-bold font-mono ${(account?.realizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {(account?.realizedPnl || 0) >= 0 ? '+' : ''}₹{(account?.realizedPnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 font-mono">UNREALIZED P&L</div>
            <div className={`text-sm font-bold font-mono ${(account?.unrealizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {(account?.unrealizedPnl || 0) >= 0 ? '+' : ''}₹{(account?.unrealizedPnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Execution Engine Latency Badge */}
        <div className="flex items-center space-x-1.5 px-2 py-1 bg-[#141b29] rounded border border-[#1f293d] text-[11px] font-mono">
          <Zap size={12} className="text-amber-400 animate-pulse" />
          <span className="text-gray-400">Exec Latency:</span>
          <span className="text-emerald-400 font-semibold">
            {lastAckLatency !== null ? `${lastAckLatency.toFixed(1)} µs` : '< 1 ms'}
          </span>
        </div>
      </div>

      {/* Quantity Selector Bar */}
      <div className="flex items-center justify-between space-x-2">
        <div className="flex items-center space-x-1">
          <span className="text-xs text-gray-400 font-semibold">Qty:</span>
          <input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-20 px-2 py-1 text-sm font-mono font-bold bg-[#141b27] border border-[#1e2738] rounded text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Preset Quick Buttons */}
        <div className="flex items-center space-x-1">
          {PRESET_QTYS.map((val) => (
            <button
              key={val}
              onClick={() => setQty(val)}
              className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded transition ${
                qty === val ? 'bg-blue-600 text-white' : 'bg-[#141b27] text-gray-400 hover:text-white hover:bg-[#1f293d]'
              }`}
            >
              {val}
            </button>
          ))}
        </div>
      </div>

      {/* Big 1-Click / Hotkey Execution Buttons */}
      <div className="grid grid-cols-2 gap-2">
        {/* BUY BUTTON */}
        <button
          onClick={() => placeOrder({ side: 'BUY', qty })}
          className="group relative flex flex-col items-center justify-center py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all rounded font-bold text-white shadow-lg shadow-emerald-950/40"
        >
          <div className="flex items-center space-x-1">
            <ArrowUpRight size={16} />
            <span>BUY MARKET</span>
          </div>
          <div className="text-xs font-mono font-normal opacity-90">
            Ask: ₹{(bestAsk || currentPrice || 0).toFixed(2)}
          </div>
          <span className="absolute bottom-1 right-2 text-[9px] font-mono bg-black/30 px-1 rounded text-emerald-200">
            [Space] or [B]
          </span>
        </button>

        {/* SELL BUTTON */}
        <button
          onClick={() => placeOrder({ side: 'SELL', qty })}
          className="group relative flex flex-col items-center justify-center py-2.5 px-3 bg-rose-600 hover:bg-rose-500 active:scale-[0.98] transition-all rounded font-bold text-white shadow-lg shadow-rose-950/40"
        >
          <div className="flex items-center space-x-1">
            <ArrowDownRight size={16} />
            <span>SELL MARKET</span>
          </div>
          <div className="text-xs font-mono font-normal opacity-90">
            Bid: ₹{(bestBid || currentPrice || 0).toFixed(2)}
          </div>
          <span className="absolute bottom-1 right-2 text-[9px] font-mono bg-black/30 px-1 rounded text-rose-200">
            [Shift+Space] or [S]
          </span>
        </button>
      </div>

      {/* Active Position Info & Flatten Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-[#1b2234]">
        {activePosition ? (
          <div className="flex items-center space-x-3 text-xs font-mono">
            <div>
              <span className="text-gray-400">Position:</span>{' '}
              <span className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${activePosition.qty > 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>
                {activePosition.qty > 0 ? 'LONG' : 'SHORT'} {Math.abs(activePosition.qty)}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Avg:</span>{' '}
              <span className="text-white">₹{activePosition.avgPrice.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-400">Live PnL:</span>{' '}
              <span className={`font-bold ${activePosition.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {activePosition.unrealizedPnl >= 0 ? '+' : ''}₹{activePosition.unrealizedPnl.toFixed(2)}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-500 font-mono">No open position in {symbol}</div>
        )}

        {/* Flatten Button */}
        <button
          onClick={() => flattenSymbol(symbol)}
          disabled={!activePosition}
          className="flex items-center space-x-1 px-3 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:hover:bg-amber-600 text-white rounded text-xs font-semibold font-mono transition"
          title="Close current symbol position immediately"
        >
          <ShieldAlert size={13} />
          <span>FLATTEN [Esc]</span>
        </button>
      </div>
    </div>
  );
}
