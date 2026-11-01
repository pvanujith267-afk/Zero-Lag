import React, { useState } from 'react';
import { useTradingStream } from './hooks/useTradingStream.js';
import { WatchlistSidebar } from './components/WatchlistSidebar.jsx';
import { MultiChartGrid } from './components/MultiChartGrid.jsx';
import { AlertModal } from './components/AlertModal.jsx';
import { AlertsManager } from './components/AlertsManager.jsx';
import { NotificationDropdown } from './components/NotificationDropdown.jsx';
import { LatencyHUD } from './components/LatencyHUD.jsx';
import { playAlertChime } from './utils/audio.js';
import { Bell, Zap, Volume2, X, ListFilter } from 'lucide-react';

export default function App() {
  const [activeSymbol, setActiveSymbol] = useState('TATACONSUM');
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [targetAlertPrice, setTargetAlertPrice] = useState(null);
  const [isAlertsManagerOpen, setIsAlertsManagerOpen] = useState(false);

  const handleOpenAlertModal = (symbol = activeSymbol, price = null) => {
    if (symbol && symbol !== activeSymbol) {
      setActiveSymbol(symbol);
    }
    setTargetAlertPrice(price);
    setIsAlertModalOpen(true);
  };

  const {
    isConnected,
    latencyMs,
    ticksPerSec,
    alerts,
    notifications,
    recentTriggeredAlert,
    currentTick,
    createAlert,
    deleteAlert,
    resetAlert,
    dismissTriggeredAlert,
    markNotificationsRead,
    clearNotifications,
    deleteNotification,
    registerTickListener
  } = useTradingStream(activeSymbol);

  const currentPrice = currentTick?.price || 0;
  const isUp = currentTick?.close >= currentTick?.open;
  const activeAlertsCount = alerts.filter((a) => !a.triggered).length;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#07090e] text-gray-200 overflow-hidden font-sans">
      {/* Top Header */}
      <header className="flex items-center justify-between px-3 py-2 bg-[#0a0d14] border-b border-[#1b2234] select-none">
        {/* Brand & Active Symbol */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 font-black text-sm tracking-wide bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent font-mono">
            <Zap size={16} className="text-amber-400 fill-amber-400" />
            <span>ZERO-LAG PRO</span>
          </div>

          <div className="h-4 w-px bg-[#1f293d]" />

          {/* Active Symbol & Live Price Pill */}
          <div className="flex items-center space-x-2 font-mono">
            <span className="text-xs font-bold text-white bg-[#141b27] px-2 py-0.5 rounded border border-[#1e2738]">
              NSE: {activeSymbol}
            </span>
            <span className={`text-sm font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
              ₹{currentPrice.toFixed(2)}
            </span>
            {currentTick?.high && currentTick?.low && (
              <span className="hidden sm:inline text-[11px] text-gray-500">
                (H: ₹{currentTick.high.toFixed(2)} • L: ₹{currentTick.low.toFixed(2)})
              </span>
            )}
          </div>
        </div>

        {/* Action Controls: Notifications, Set Alert, All Alerts Manager, Chime */}
        <div className="flex items-center space-x-2">
          {/* Quick Add Alert Button */}
          <button
            onClick={() => handleOpenAlertModal(activeSymbol, currentPrice)}
            className="flex items-center space-x-1.5 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-xs font-semibold transition"
            title="Create alert at target price"
          >
            <Bell size={13} />
            <span>+ Set Alert</span>
          </button>

          {/* Latest Stock Alerts Notification Button with Unread Badge */}
          <NotificationDropdown
            notifications={notifications}
            onSelectSymbol={setActiveSymbol}
            onClearNotifications={clearNotifications}
            onMarkRead={markNotificationsRead}
            onDeleteNotification={deleteNotification}
          />

          {/* All Alerts Manager Button */}
          <button
            onClick={() => setIsAlertsManagerOpen(true)}
            className="relative flex items-center space-x-1 px-2.5 py-1 bg-[#141b27] hover:bg-[#1f293d] border border-[#1e2738] rounded text-xs font-medium text-gray-300 hover:text-white transition"
            title="View & manage all active & triggered alerts"
          >
            <ListFilter size={13} className="text-blue-400" />
            <span>Manage Alerts</span>
            <span className="text-[10px] font-mono px-1 rounded-full bg-[#1e283d] text-gray-300">
              {alerts.length}
            </span>
          </button>

          {/* Test Sound Button */}
          <button
            onClick={playAlertChime}
            className="p-1.5 text-gray-400 hover:text-amber-400 rounded hover:bg-[#141b27] transition"
            title="Test Alert Chime Sound"
          >
            <Volume2 size={15} />
          </button>
        </div>
      </header>

      {/* Floating Trigger Toast when an alert fires */}
      {recentTriggeredAlert && (
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-black px-4 py-2 flex items-center justify-between shadow-2xl animate-bounce">
          <div className="flex items-center space-x-2 font-mono text-xs font-bold">
            <span className="text-base">🔔</span>
            <span>ALERT TRIGGERED:</span>
            <span className="underline">{recentTriggeredAlert.alert.symbol}</span>
            <span>crossed target ₹{recentTriggeredAlert.alert.targetPrice.toFixed(2)}</span>
            <span className="font-normal opacity-90">({recentTriggeredAlert.alert.note})</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setActiveSymbol(recentTriggeredAlert.alert.symbol);
                dismissTriggeredAlert();
              }}
              className="px-2 py-0.5 bg-black text-white rounded text-[11px] font-bold hover:bg-black/80 transition"
            >
              View Chart
            </button>
            <button
              onClick={dismissTriggeredAlert}
              className="p-1 hover:bg-black/10 rounded transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Watchlist Sidebar (with Watchlist & All Alerts tabs!) */}
        <WatchlistSidebar
          activeSymbol={activeSymbol}
          onSelectSymbol={setActiveSymbol}
          alerts={alerts}
          onDeleteAlert={deleteAlert}
          onResetAlert={resetAlert}
          registerTickListener={registerTickListener}
        />

        {/* Center: Multi-Timeframe TradingView Chart Grid */}
        <main className="flex-1 flex flex-col p-2 overflow-hidden">
          <MultiChartGrid
            symbol={activeSymbol}
            registerTickListener={registerTickListener}
            alerts={alerts}
            onOpenAlertModal={handleOpenAlertModal}
          />
        </main>
      </div>

      {/* Real-Time Latency & Diagnostics HUD */}
      <LatencyHUD
        isConnected={isConnected}
        latencyMs={latencyMs}
        ticksPerSec={ticksPerSec}
      />

      {/* Create Alert Modal */}
      <AlertModal
        symbol={activeSymbol}
        currentPrice={currentPrice}
        initialPrice={targetAlertPrice}
        isOpen={isAlertModalOpen}
        onClose={() => {
          setIsAlertModalOpen(false);
          setTargetAlertPrice(null);
        }}
        onCreateAlert={createAlert}
      />

      {/* Alerts Manager Drawer */}
      <AlertsManager
        isOpen={isAlertsManagerOpen}
        onClose={() => setIsAlertsManagerOpen(false)}
        alerts={alerts}
        onDeleteAlert={deleteAlert}
        onResetAlert={resetAlert}
        onSelectSymbol={(sym) => {
          setActiveSymbol(sym);
          setIsAlertsManagerOpen(false);
        }}
      />
    </div>
  );
}
