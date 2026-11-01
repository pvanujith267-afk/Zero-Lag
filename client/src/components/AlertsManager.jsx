import React from 'react';
import { Bell, Trash2, RotateCcw, ArrowUpRight, ArrowDownRight, CheckCircle2, X } from 'lucide-react';

export function AlertsManager({ isOpen, onClose, alerts, onDeleteAlert, onResetAlert, onSelectSymbol }) {
  if (!isOpen) return null;

  const activeAlerts = alerts.filter((a) => !a.triggered);
  const triggeredAlerts = alerts.filter((a) => a.triggered);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-[#0f1420] border border-[#1f283d] rounded-xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1b2234]">
          <div className="flex items-center space-x-2">
            <Bell size={18} className="text-amber-400" />
            <h3 className="text-base font-bold text-white">Price Alerts Manager</h3>
            <span className="text-xs bg-[#192233] text-gray-300 px-2 py-0.5 rounded-full font-mono">
              {activeAlerts.length} Active
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#192131] transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Active Alerts */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Active Alerts ({activeAlerts.length})
            </div>

            {activeAlerts.length > 0 ? (
              <div className="space-y-2">
                {activeAlerts.map((alt) => (
                  <div
                    key={alt.id}
                    className="flex items-center justify-between p-3 bg-[#131926] border border-[#1f2a3f] rounded-lg hover:border-blue-500/50 transition cursor-pointer"
                    onClick={() => onSelectSymbol && onSelectSymbol(alt.symbol)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-1.5 rounded ${alt.direction === 'CROSS_ABOVE' ? 'bg-emerald-950/60 text-emerald-400' : 'bg-rose-950/60 text-rose-400'}`}>
                        {alt.direction === 'CROSS_ABOVE' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold font-mono text-sm text-white">{alt.symbol}</span>
                          <span className="text-xs font-mono font-semibold text-amber-400">
                            {alt.direction === 'CROSS_ABOVE' ? '≥' : '≤'} ₹{alt.targetPrice.toFixed(2)}
                          </span>
                        </div>
                        {alt.note && <div className="text-[11px] text-gray-400">{alt.note}</div>}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onDeleteAlert(alt.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-400 rounded hover:bg-[#1c2438] transition"
                        title="Delete Alert"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500 font-mono py-4 text-center bg-[#0a0d14] rounded border border-[#171f2f]">
                No active alerts. Click "Set Alert" on the chart to create one.
              </div>
            )}
          </div>

          {/* Triggered Alerts History */}
          {triggeredAlerts.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Triggered History ({triggeredAlerts.length})
              </div>
              <div className="space-y-2">
                {triggeredAlerts.map((alt) => (
                  <div
                    key={alt.id}
                    className="flex items-center justify-between p-3 bg-[#121620] border border-[#1a2232] rounded-lg opacity-85 hover:opacity-100 transition"
                  >
                    <div className="flex items-center space-x-3">
                      <CheckCircle2 size={16} className="text-emerald-500" />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold font-mono text-sm text-gray-300">{alt.symbol}</span>
                          <span className="text-xs font-mono text-emerald-400 font-semibold">
                            Triggered @ ₹{alt.triggerPrice ? alt.triggerPrice.toFixed(2) : alt.targetPrice.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          {alt.triggeredAt ? new Date(alt.triggeredAt).toLocaleTimeString() : 'Recently'}
                          {alt.note ? ` • ${alt.note}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => onResetAlert(alt.id)}
                        className="p-1.5 text-blue-400 hover:text-blue-300 rounded hover:bg-[#1a2336] transition"
                        title="Re-arm / Reset Alert"
                      >
                        <RotateCcw size={13} />
                      </button>
                      <button
                        onClick={() => onDeleteAlert(alt.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-400 rounded hover:bg-[#1a2336] transition"
                        title="Delete Alert"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#1b2234] bg-[#0a0d14] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-[#161e2c] hover:bg-[#202a3d] text-gray-200 rounded transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
