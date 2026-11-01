import React, { useState, useEffect } from 'react';
import { Activity, Wifi, Gauge, Keyboard, Info } from 'lucide-react';

export function LatencyHUD({ isConnected, latencyMs, ticksPerSec }) {
  const [fps, setFps] = useState(60);
  const [showHotkeys, setShowHotkeys] = useState(false);

  // RAF-based real FPS calculation
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId;

    const loop = (now) => {
      frameCount++;
      if (now - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <>
      <div className="flex items-center space-x-4 px-3 py-1 bg-[#0b0e15] border-t border-[#1b2234] text-[11px] font-mono text-gray-400 select-none">
        {/* Connection Status */}
        <div className="flex items-center space-x-1.5">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className={isConnected ? 'text-gray-300' : 'text-rose-400'}>
            {isConnected ? 'STREAM CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>

        <div className="h-3 w-px bg-[#1e2738]" />

        {/* WebSocket Latency (RTT) */}
        <div className="flex items-center space-x-1.5">
          <Wifi size={12} className={latencyMs < 10 ? 'text-emerald-400' : latencyMs < 50 ? 'text-amber-400' : 'text-rose-400'} />
          <span>Ping:</span>
          <span className={`font-bold ${latencyMs < 10 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {latencyMs} ms
          </span>
        </div>

        <div className="h-3 w-px bg-[#1e2738]" />

        {/* Auto Refresh Info */}
        <div className="flex items-center space-x-1.5">
          <Activity size={12} className="text-blue-400" />
          <span>Refresh Cycle:</span>
          <span className="font-bold text-blue-400">Every 10s</span>
        </div>


        <div className="h-3 w-px bg-[#1e2738]" />

        {/* Display FPS */}
        <div className="flex items-center space-x-1.5">
          <Gauge size={12} className={fps >= 55 ? 'text-emerald-400' : 'text-amber-400'} />
          <span>UI Engine:</span>
          <span className={`font-bold ${fps >= 55 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {fps} FPS
          </span>
        </div>

        <div className="flex-1" />

        {/* Hotkeys Cheat Sheet Trigger */}
        <button
          onClick={() => setShowHotkeys(true)}
          className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#131926] hover:bg-[#1f293d] text-gray-300 hover:text-white transition"
        >
          <Keyboard size={12} className="text-amber-400" />
          <span>Hotkeys [?]</span>
        </button>
      </div>

      {/* Hotkeys Modal */}
      {showHotkeys && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1420] border border-[#1f283d] rounded-lg max-w-md w-full p-4 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1b2234] pb-2">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Keyboard size={16} className="text-amber-400" />
                <span>Instant Zero-Lag Hotkeys</span>
              </h3>
              <button
                onClick={() => setShowHotkeys(false)}
                className="text-gray-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <div className="divide-y divide-[#182133] text-xs font-mono">
              <div className="flex justify-between py-2">
                <span className="text-gray-400">Buy Market Order</span>
                <span className="px-2 py-0.5 bg-[#172134] rounded text-emerald-400 font-bold">[Space] or [B]</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-400">Sell Market Order</span>
                <span className="px-2 py-0.5 bg-[#172134] rounded text-rose-400 font-bold">[Shift + Space] or [S]</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-400">Flatten / Close Symbol Position</span>
                <span className="px-2 py-0.5 bg-[#172134] rounded text-amber-400 font-bold">[Esc] or [X]</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-400">Increase Quantity (+10)</span>
                <span className="px-2 py-0.5 bg-[#172134] rounded text-blue-400 font-bold">[↑ Up Arrow]</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-400">Decrease Quantity (-10)</span>
                <span className="px-2 py-0.5 bg-[#172134] rounded text-blue-400 font-bold">[↓ Down Arrow]</span>
              </div>
            </div>

            <div className="text-[11px] text-gray-500 bg-[#090c12] p-2.5 rounded border border-[#1b2234]">
              💡 <strong>Zero Latency Tip:</strong> Hotkeys fire directly to the execution pipeline without opening popups or confirmation dialogues for instantaneous fill.
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowHotkeys(false)}
                className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 font-semibold text-white rounded transition"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
