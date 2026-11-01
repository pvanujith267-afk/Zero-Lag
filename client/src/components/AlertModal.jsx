import React, { useState } from 'react';
import { Bell, Volume2, ArrowUpRight, ArrowDownRight, X, Check } from 'lucide-react';
import { playAlertChime } from '../utils/audio.js';

export function AlertModal({ symbol, currentPrice, initialPrice, isOpen, onClose, onCreateAlert }) {
  if (!isOpen) return null;

  const effectivePrice = initialPrice !== null && initialPrice !== undefined ? initialPrice : currentPrice;
  const [targetPrice, setTargetPrice] = useState(effectivePrice ? effectivePrice.toFixed(2) : '100.00');
  const [direction, setDirection] = useState(
    effectivePrice && currentPrice
      ? effectivePrice >= currentPrice
        ? 'CROSS_ABOVE'
        : 'CROSS_BELOW'
      : 'CROSS_ABOVE'
  );
  const [note, setNote] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const priceNum = parseFloat(targetPrice);
    if (!priceNum || priceNum <= 0) return;

    onCreateAlert({
      symbol,
      targetPrice: priceNum,
      direction,
      note: note.trim() || `${symbol} ${direction === 'CROSS_ABOVE' ? '≥' : '≤'} ₹${priceNum}`
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-[#0f1420] border border-[#1f283d] rounded-xl max-w-sm w-full p-4 space-y-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1b2234] pb-2">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded">
              <Bell size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Create Price Alert</h3>
              <p className="text-[11px] font-mono text-gray-400">
                {symbol} • Current: ₹{(currentPrice || 0).toFixed(2)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#192131] transition"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Condition Select */}
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Trigger Condition
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection('CROSS_ABOVE')}
                className={`flex items-center justify-center space-x-1.5 py-2 px-2 text-xs font-semibold rounded border transition ${
                  direction === 'CROSS_ABOVE'
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-400 shadow'
                    : 'bg-[#141b27] border-[#1e2738] text-gray-400 hover:text-white'
                }`}
              >
                <ArrowUpRight size={14} />
                <span>Crosses Above</span>
              </button>
              <button
                type="button"
                onClick={() => setDirection('CROSS_BELOW')}
                className={`flex items-center justify-center space-x-1.5 py-2 px-2 text-xs font-semibold rounded border transition ${
                  direction === 'CROSS_BELOW'
                    ? 'bg-rose-950/60 border-rose-500 text-rose-400 shadow'
                    : 'bg-[#141b27] border-[#1e2738] text-gray-400 hover:text-white'
                }`}
              >
                <ArrowDownRight size={14} />
                <span>Crosses Below</span>
              </button>
            </div>
          </div>

          {/* Target Price */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Target Price (₹)
              </label>
              {currentPrice > 0 && (
                <button
                  type="button"
                  onClick={() => setTargetPrice(currentPrice.toFixed(2))}
                  className="text-[10px] text-blue-400 hover:underline"
                >
                  Use Current (₹{currentPrice.toFixed(2)})
                </button>
              )}
            </div>
            <input
              type="number"
              step="0.05"
              required
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono font-bold bg-[#111723] border border-[#1e2738] rounded text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Note */}
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Resistance Breakout / Dip Buy"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-[#111723] border border-[#1e2738] rounded text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Audio Test & Submit */}
          <div className="flex items-center justify-between pt-2 border-t border-[#1b2234]">
            <button
              type="button"
              onClick={playAlertChime}
              className="flex items-center space-x-1 text-[11px] text-gray-400 hover:text-amber-400 transition"
              title="Test the chime sound"
            >
              <Volume2 size={13} />
              <span>Test Chime</span>
            </button>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black rounded transition shadow-md shadow-amber-950/40"
              >
                Set Alert
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
