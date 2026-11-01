import React, { useState } from 'react';
import { TradingChart } from './TradingChart.jsx';
import { Columns2, Rows2, Square, LayoutGrid } from 'lucide-react';

export function MultiChartGrid({
  symbol,
  registerTickListener,
  alerts,
  onOpenAlertModal
}) {
  // Layouts: 'SINGLE' | 'SPLIT_HORIZONTAL' | 'SPLIT_VERTICAL'
  const [layout, setLayout] = useState('SINGLE');
  const [timeframe1, setTimeframe1] = useState('5');
  const [timeframe2, setTimeframe2] = useState('1D');

  return (
    <div className="flex flex-col h-full w-full overflow-hidden space-y-1.5">
      {/* Multi-Timeframe Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#0b0e15] border border-[#1b2234] rounded">
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Chart Layout:
          </span>

          <div className="flex items-center bg-[#141b27] rounded p-0.5 border border-[#1e2738]">
            <button
              onClick={() => setLayout('SINGLE')}
              className={`flex items-center space-x-1 px-2 py-0.5 text-xs font-semibold rounded transition ${
                layout === 'SINGLE'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-400 hover:text-white hover:bg-[#1f293d]'
              }`}
              title="Single Full Chart"
            >
              <Square size={12} />
              <span>Single</span>
            </button>

            <button
              onClick={() => setLayout('SPLIT_HORIZONTAL')}
              className={`flex items-center space-x-1 px-2 py-0.5 text-xs font-semibold rounded transition ${
                layout === 'SPLIT_HORIZONTAL'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-400 hover:text-white hover:bg-[#1f293d]'
              }`}
              title="Dual Chart Side-by-Side (e.g. 5m + 1D)"
            >
              <Columns2 size={12} />
              <span>Dual (Side)</span>
            </button>

            <button
              onClick={() => setLayout('SPLIT_VERTICAL')}
              className={`flex items-center space-x-1 px-2 py-0.5 text-xs font-semibold rounded transition ${
                layout === 'SPLIT_VERTICAL'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-400 hover:text-white hover:bg-[#1f293d]'
              }`}
              title="Dual Chart Stacked (Top & Bottom)"
            >
              <Rows2 size={12} />
              <span>Dual (Stacked)</span>
            </button>
          </div>
        </div>

        {layout !== 'SINGLE' && (
          <div className="text-[11px] font-mono text-gray-400">
            Comparing <span className="text-blue-400 font-bold">{timeframe1 === '1D' ? 'Daily' : `${timeframe1}m`}</span> + <span className="text-emerald-400 font-bold">{timeframe2 === '1D' ? 'Daily' : `${timeframe2}m`}</span>
          </div>
        )}
      </div>

      {/* Grid Container */}
      <div className="flex-1 w-full h-full min-h-0 overflow-hidden">
        {layout === 'SINGLE' && (
          <TradingChart
            symbol={symbol}
            registerTickListener={registerTickListener}
            alerts={alerts}
            onOpenAlertModal={onOpenAlertModal}
            initialResolution="5"
          />
        )}

        {layout === 'SPLIT_HORIZONTAL' && (
          <div className="grid grid-cols-2 gap-2 w-full h-full">
            <TradingChart
              symbol={symbol}
              registerTickListener={registerTickListener}
              alerts={alerts}
              onOpenAlertModal={onOpenAlertModal}
              initialResolution={timeframe1}
              compact={true}
            />
            <TradingChart
              symbol={symbol}
              registerTickListener={registerTickListener}
              alerts={alerts}
              onOpenAlertModal={onOpenAlertModal}
              initialResolution={timeframe2}
              compact={true}
            />
          </div>
        )}

        {layout === 'SPLIT_VERTICAL' && (
          <div className="grid grid-rows-2 gap-2 w-full h-full">
            <TradingChart
              symbol={symbol}
              registerTickListener={registerTickListener}
              alerts={alerts}
              onOpenAlertModal={onOpenAlertModal}
              initialResolution={timeframe1}
              compact={true}
            />
            <TradingChart
              symbol={symbol}
              registerTickListener={registerTickListener}
              alerts={alerts}
              onOpenAlertModal={onOpenAlertModal}
              initialResolution={timeframe2}
              compact={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}
