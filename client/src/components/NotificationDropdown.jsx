import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, Trash2, ArrowUpRight, ArrowDownRight, ExternalLink, Sparkles } from 'lucide-react';

export function NotificationDropdown({
  notifications = [],
  onSelectSymbol,
  onClearNotifications,
  onMarkRead,
  onDeleteNotification
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen && unreadCount > 0 && onMarkRead) {
      onMarkRead();
    }
    setIsOpen(!isOpen);
  };

  const handleOpenStock = (symbol) => {
    if (onSelectSymbol) {
      onSelectSymbol(symbol);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        onClick={handleToggle}
        className={`relative flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-semibold border transition ${
          unreadCount > 0
            ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-950/40 animate-pulse'
            : 'bg-[#141b27] hover:bg-[#1f293d] border-[#1e2738] text-gray-300 hover:text-white'
        }`}
        title="Recent Triggered Stock Alerts"
      >
        <Bell size={13} className={unreadCount > 0 ? 'text-amber-400 fill-amber-400' : 'text-gray-400'} />
        <span>Notifications</span>
        {unreadCount > 0 && (
          <span className="px-1.5 py-0.2 bg-amber-500 text-black font-mono font-bold text-[10px] rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#0f1420] border border-[#1f283d] rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          {/* Header */}
          <div className="flex items-center justify-between p-3 bg-[#0c101a] border-b border-[#1b2234]">
            <div className="flex items-center space-x-2">
              <Bell size={14} className="text-amber-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Triggered Stock Alerts
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#192233] text-gray-400">
                {notifications.length}
              </span>
            </div>

            {notifications.length > 0 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={onMarkRead}
                  className="text-[10px] text-gray-400 hover:text-white transition"
                  title="Mark all as read"
                >
                  Mark read
                </button>
                <button
                  onClick={onClearNotifications}
                  className="text-[10px] text-rose-400 hover:text-rose-300 transition"
                  title="Clear all notifications"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[#172030]">
            {notifications.length > 0 ? (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleOpenStock(item.alert.symbol)}
                  className={`p-3 hover:bg-[#131b29] transition cursor-pointer flex items-start justify-between space-x-2 ${
                    !item.read ? 'bg-amber-950/20' : ''
                  }`}
                >
                  <div className="flex items-start space-x-2.5">
                    <div
                      className={`p-1.5 rounded mt-0.5 ${
                        item.alert.direction === 'CROSS_ABOVE'
                          ? 'bg-emerald-950/80 text-emerald-400'
                          : 'bg-rose-950/80 text-rose-400'
                      }`}
                    >
                      {item.alert.direction === 'CROSS_ABOVE' ? (
                        <ArrowUpRight size={14} />
                      ) : (
                        <ArrowDownRight size={14} />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold font-mono text-xs text-white">
                          {item.alert.symbol}
                        </span>
                        <span className="text-[11px] font-mono text-emerald-400 font-bold">
                          Triggered @ ₹{(item.price || item.alert.targetPrice).toFixed(2)}
                        </span>
                      </div>

                      {item.alert.note && (
                        <div className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[200px]">
                          {item.alert.note}
                        </div>
                      )}

                      <div className="text-[10px] font-mono text-gray-500 mt-1">
                        {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleOpenStock(item.alert.symbol)}
                      className="p-1 text-gray-400 hover:text-blue-400 rounded hover:bg-[#1c2438] transition"
                      title="Open Stock Chart"
                    >
                      <ExternalLink size={13} />
                    </button>
                    {onDeleteNotification && (
                      <button
                        onClick={() => onDeleteNotification(item.id)}
                        className="p-1 text-gray-400 hover:text-rose-400 rounded hover:bg-[#1c2438] transition"
                        title="Dismiss"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-gray-500 font-mono">
                <Bell size={24} className="mx-auto mb-2 text-gray-600 opacity-40" />
                <div>No alert notifications yet.</div>
                <div className="text-[10px] text-gray-600 mt-1">
                  Alerts will appear here when market prices cross your targets.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
