import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, ListFilter, Trash2, Check, FileText, Bell, ArrowUpRight, ArrowDownRight, RotateCcw } from 'lucide-react';
import { API_BASE } from '../config.js';

export function WatchlistSidebar({
  activeSymbol,
  onSelectSymbol,
  alerts = [],
  onDeleteAlert,
  onResetAlert,
  registerTickListener
}) {
  const [activeTab, setActiveTab] = useState('WATCHLIST'); // 'WATCHLIST' or 'ALERTS'
  const [watchlist, setWatchlist] = useState([]);
  const [quotes, setQuotes] = useState({}); // symbol -> { price, prevClose, change, changePct, ... }
  const [sortField, setSortField] = useState('changePct'); // default 'changePct' like the screenshot
  const [sortDirection, setSortDirection] = useState('desc'); // default 'desc' (gainers first)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [alertFilter, setAlertFilter] = useState('');

  // Fetch initial watchlist from backend
  const loadWatchlist = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/watchlist`);
      const data = await res.json();
      if (Array.isArray(data)) setWatchlist(data);
    } catch (e) {
      console.error('Error loading watchlist:', e);
    }
  };

  // Fetch quotes with previous day close and % change
  const loadQuotes = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/quotes`);
      const data = await res.json();
      if (data && data.quotes) {
        setQuotes((prev) => ({ ...prev, ...data.quotes }));
      }
    } catch (e) {
      console.error('Error loading quotes:', e);
    }
  };

  useEffect(() => {
    loadWatchlist();
    loadQuotes();
    const interval = setInterval(loadQuotes, 10000);
    return () => clearInterval(interval);
  }, []);

  // Real-time Tick Updates for all symbols in watchlist
  useEffect(() => {
    if (!registerTickListener) return;

    const unbind = registerTickListener((tick) => {
      if (!tick || !tick.symbol || tick.price === undefined) return;
      const sym = tick.symbol.toUpperCase().trim();

      setQuotes((prev) => {
        const existing = prev[sym];
        const prevClose = tick.prevClose || existing?.prevClose || tick.open || tick.price;
        const price = tick.price;
        const change = prevClose ? Number((price - prevClose).toFixed(2)) : 0;
        const changePct = prevClose ? Number((((price - prevClose) / prevClose) * 100).toFixed(2)) : 0;

        return {
          ...prev,
          [sym]: {
            symbol: sym,
            price,
            prevClose,
            change,
            changePct,
            high: tick.high || existing?.high || price,
            low: tick.low || existing?.low || price,
            open: tick.open || existing?.open || price,
            close: price,
            volume: tick.volume || existing?.volume || 0,
            timestamp: Date.now()
          }
        };
      });
    });

    return () => unbind();
  }, [registerTickListener]);

  // Search MoneyControl symbols
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const addSymbol = async (item) => {
    const sym = (item.ticker || item.symbol).toUpperCase().trim();
    if (watchlist.some((w) => w.symbol === sym)) return;

    const updated = [
      {
        symbol: sym,
        name: item.full_name || item.description || sym,
        exchange: item.exchange || 'NSE'
      },
      ...watchlist
    ];

    setWatchlist(updated);
    setSearchQuery('');
    setSearchResults([]);
    onSelectSymbol(sym);

    fetch(`${API_BASE}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: updated })
    }).catch(console.error);

    // Fetch quote immediately for the new symbol
    fetch(`${API_BASE}/api/quotes?symbols=${sym}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && d.quotes) {
          setQuotes((prev) => ({ ...prev, ...d.quotes }));
        }
      })
      .catch(console.error);
  };

  const removeSymbol = (e, symToRemove) => {
    e.stopPropagation();
    const updated = watchlist.filter((w) => w.symbol !== symToRemove);
    setWatchlist(updated);
    if (activeSymbol === symToRemove && updated.length > 0) {
      onSelectSymbol(updated[0].symbol);
    }
    fetch(`${API_BASE}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: updated })
    }).catch(console.error);
  };

  const handleImportSymbols = () => {
    if (!pasteContent.trim()) return;

    let tokens = [];
    if (pasteContent.trim().startsWith('[') && pasteContent.trim().endsWith(']')) {
      try {
        tokens = JSON.parse(pasteContent);
      } catch (err) {
        tokens = pasteContent.split(/[,\n\s]+/);
      }
    } else {
      tokens = pasteContent.split(/[,\n\s]+/);
    }

    const cleanList = [];
    for (const token of tokens) {
      const sym = typeof token === 'string' ? token.toUpperCase().trim() : token?.symbol?.toUpperCase().trim();
      if (sym && sym.length >= 2 && !cleanList.some((c) => c.symbol === sym)) {
        cleanList.push({
          symbol: sym,
          name: sym,
          exchange: 'NSE'
        });
      }
    }

    if (cleanList.length > 0) {
      const combined = [...cleanList, ...watchlist.filter((w) => !cleanList.some((c) => c.symbol === w.symbol))];
      setWatchlist(combined);
      onSelectSymbol(cleanList[0].symbol);
      setShowImportModal(false);
      setPasteContent('');

      fetch(`${API_BASE}/api/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: combined })
      }).catch(console.error);

      const syms = cleanList.map((c) => c.symbol).join(',');
      fetch(`${API_BASE}/api/quotes?symbols=${syms}`)
        .then((r) => r.json())
        .then((d) => {
          if (d && d.quotes) {
            setQuotes((prev) => ({ ...prev, ...d.quotes }));
          }
        })
        .catch(console.error);
    }
  };

  // Sorted watchlist based on current sort settings
  const sortedWatchlist = useMemo(() => {
    const list = [...watchlist];

    return list.sort((a, b) => {
      const qA = quotes[a.symbol.toUpperCase()];
      const qB = quotes[b.symbol.toUpperCase()];

      if (sortField === 'changePct') {
        const pctA = qA?.changePct !== undefined ? qA.changePct : -999999;
        const pctB = qB?.changePct !== undefined ? qB.changePct : -999999;
        return sortDirection === 'desc' ? pctB - pctA : pctA - pctB;
      }

      if (sortField === 'price') {
        const pA = qA?.price !== undefined ? qA.price : 0;
        const pB = qB?.price !== undefined ? qB.price : 0;
        return sortDirection === 'desc' ? pB - pA : pA - pB;
      }

      if (sortField === 'name') {
        const nameA = (a.name || a.symbol).toLowerCase();
        const nameB = (b.name || b.symbol).toLowerCase();
        return sortDirection === 'asc'
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      }

      return 0;
    });
  }, [watchlist, quotes, sortField, sortDirection]);

  const filteredAlerts = alerts.filter((a) => {
    if (!alertFilter.trim()) return true;
    const q = alertFilter.toUpperCase().trim();
    return a.symbol.includes(q) || (a.note && a.note.toUpperCase().includes(q));
  });

  const activeAlertsCount = alerts.filter((a) => !a.triggered).length;

  return (
    <div className="flex flex-col w-72 h-full bg-[#0a0d14] border-r border-[#1b2234] select-none">
      {/* Top Sidebar Tab Switcher: Watchlist vs All Alerts */}
      <div className="flex items-center border-b border-[#1b2234] bg-[#0c101a] p-1">
        <button
          onClick={() => setActiveTab('WATCHLIST')}
          className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 text-xs font-semibold rounded transition ${
            activeTab === 'WATCHLIST'
              ? 'bg-[#182234] text-white shadow'
              : 'text-gray-400 hover:text-white hover:bg-[#121824]'
          }`}
        >
          <ListFilter size={13} className="text-blue-400" />
          <span>Watchlist</span>
          <span className="text-[10px] font-mono text-gray-500">({watchlist.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ALERTS')}
          className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 text-xs font-semibold rounded transition ${
            activeTab === 'ALERTS'
              ? 'bg-[#182234] text-white shadow'
              : 'text-gray-400 hover:text-white hover:bg-[#121824]'
          }`}
        >
          <Bell size={13} className={activeAlertsCount > 0 ? 'text-amber-400' : 'text-gray-400'} />
          <span>All Alerts</span>
          <span className={`text-[10px] font-mono px-1 rounded-full ${activeAlertsCount > 0 ? 'bg-amber-500/20 text-amber-400 font-bold' : 'text-gray-500'}`}>
            {alerts.length}
          </span>
        </button>
      </div>

      {/* TAB 1: WATCHLIST CONTENT */}
      {activeTab === 'WATCHLIST' && (
        <>
          {/* Subheader: Import Button */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1b2234] bg-[#0a0d14]">
            <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">
              Stock List
            </span>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center space-x-1 px-2 py-0.5 text-[11px] font-semibold bg-[#141b27] hover:bg-[#1f293d] border border-[#1e2738] rounded text-blue-400 transition"
              title="Import or paste symbol list"
            >
              <FileText size={11} />
              <span>Import</span>
            </button>
          </div>

          {/* Live Search Bar */}
          <div className="relative p-2 border-b border-[#1b2234]">
            <div className="relative flex items-center">
              <Search size={14} className="absolute left-2.5 text-gray-500" />
              <input
                type="text"
                placeholder="Search NSE/BSE stock..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#111723] border border-[#1e2738] rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            {/* Live Search Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute left-2 right-2 top-11 bg-[#131926] border border-[#1f2a3f] rounded shadow-2xl z-50 max-h-60 overflow-y-auto">
                {searchResults.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => addSymbol(item)}
                    className="flex items-center justify-between p-2 hover:bg-[#1e283d] cursor-pointer border-b border-[#1b2234] last:border-0"
                  >
                    <div>
                      <div className="font-bold text-xs font-mono text-white">
                        {item.ticker || item.symbol}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate max-w-[160px]">
                        {item.full_name || item.description}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono px-1 rounded bg-[#090c12] text-blue-400">
                      {item.exchange || 'NSE'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Table Header: Name vs Price %Change (Matches screenshot) */}
          <div className="flex items-center justify-between px-3 py-2 bg-[#0d121c] border-b border-[#1b2234] text-[11px] font-mono select-none">
            <button
              onClick={() => {
                if (sortField === 'name') {
                  setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                } else {
                  setSortField('name');
                  setSortDirection('asc');
                }
              }}
              className={`flex items-center space-x-1 cursor-pointer transition ${
                sortField === 'name' ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-white'
              }`}
              title="Click to sort by Name"
            >
              <span>Name</span>
              {sortField === 'name' && (
                <span className="text-xs">{sortDirection === 'asc' ? '▲' : '▼'}</span>
              )}
            </button>

            <button
              onClick={() => {
                if (sortField === 'changePct') {
                  setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
                } else {
                  setSortField('changePct');
                  setSortDirection('desc');
                }
              }}
              className={`flex items-center space-x-1 cursor-pointer transition ${
                sortField === 'changePct' ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-white'
              }`}
              title="Click to sort by % change from previous day close"
            >
              <span className="text-xs">{sortDirection === 'desc' ? '▼' : '▲'}</span>
              <span>Price %Change</span>
            </button>
          </div>

          {/* Watchlist Symbol Rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#151d2c]">
            {sortedWatchlist.map((item) => {
              const isSelected = activeSymbol === item.symbol;
              const q = quotes[item.symbol];
              const price = q?.price;
              const prevClose = q?.prevClose;
              const changePct = q?.changePct;
              const isPositive = changePct > 0;
              const isNegative = changePct < 0;

              return (
                <div
                  key={item.symbol}
                  onClick={() => onSelectSymbol(item.symbol)}
                  className={`group flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-950/40 border-l-2 border-blue-500 text-white'
                      : 'hover:bg-[#111724] text-gray-300'
                  }`}
                  title={
                    q
                      ? `${item.name} (${item.symbol})\nLTP: ₹${price?.toFixed(2)} | Prev Close: ₹${prevClose?.toFixed(2)}\nChange: ${isPositive ? '+' : ''}₹${q.change?.toFixed(2)} (${isPositive ? '+' : ''}${changePct?.toFixed(2)}%)`
                      : item.name
                  }
                >
                  {/* Left: Stock Name & NSE Badge (like image) */}
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-semibold text-xs text-white truncate max-w-[130px]">
                        {item.name || item.symbol}
                      </span>
                      <span className="text-[9px] text-gray-400 font-mono font-medium px-1 py-0.2 bg-[#141b27] border border-[#1e2738] rounded">
                        {item.exchange || 'NSE'}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-gray-500 truncate">
                      {item.symbol}
                    </div>
                  </div>

                  {/* Right: % Change (like image) and Current Price */}
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <div className="text-right flex flex-col items-end">
                      <span
                        className={`text-xs font-mono font-bold ${
                          isPositive
                            ? 'text-emerald-400'
                            : isNegative
                            ? 'text-rose-400'
                            : 'text-gray-400'
                        }`}
                      >
                        {changePct !== undefined
                          ? `${isPositive ? '+' : ''}${changePct.toFixed(2)}%`
                          : '--'}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400 font-medium">
                        {price !== undefined ? `₹${price.toFixed(2)}` : '--'}
                      </span>
                    </div>

                    <button
                      onClick={(e) => removeSymbol(e, item.symbol)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-rose-400 transition ml-1"
                      title="Remove from watchlist"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer: Count of results (like screenshot) */}
          <div className="px-3 py-1.5 border-t border-[#1b2234] bg-[#0c101a] text-[10px] font-mono text-gray-500 flex justify-between items-center select-none">
            <span>Showing {sortedWatchlist.length} stocks</span>
            <span className="text-gray-400">
              {sortField === 'changePct'
                ? sortDirection === 'desc'
                  ? '▼ Top Gainers'
                  : '▲ Top Losers'
                : sortField === 'name'
                ? sortDirection === 'asc'
                  ? 'A → Z'
                  : 'Z → A'
                : ''}
            </span>
          </div>
        </>
      )}

      {/* TAB 2: ALL ALERTS ACROSS STOCKS */}
      {activeTab === 'ALERTS' && (
        <>
          {/* Search/Filter Alerts */}
          <div className="p-2 border-b border-[#1b2234] bg-[#0c101a]">
            <div className="relative flex items-center">
              <Search size={13} className="absolute left-2.5 text-gray-500" />
              <input
                type="text"
                placeholder="Filter alerts by symbol..."
                value={alertFilter}
                onChange={(e) => setAlertFilter(e.target.value)}
                className="w-full pl-8 pr-2 py-1 text-xs bg-[#111723] border border-[#1e2738] rounded text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>

          {/* All Alerts List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#151d2c]">
            {filteredAlerts.length > 0 ? (
              filteredAlerts.map((alt) => {
                const isCurrent = activeSymbol === alt.symbol;
                return (
                  <div
                    key={alt.id}
                    onClick={() => onSelectSymbol(alt.symbol)}
                    className={`group p-2.5 hover:bg-[#131b29] transition cursor-pointer flex flex-col space-y-1 ${
                      isCurrent ? 'bg-blue-950/20 border-l-2 border-blue-500' : ''
                    }`}
                  >
                    {/* Top line: Symbol, Direction, Price, Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold font-mono text-xs text-white">
                          {alt.symbol}
                        </span>
                        <span className={`text-[11px] font-mono font-bold ${
                          alt.direction === 'CROSS_ABOVE' ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {alt.direction === 'CROSS_ABOVE' ? '≥' : '≤'} ₹{alt.targetPrice.toFixed(2)}
                        </span>
                      </div>

                      {/* Status badge */}
                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded uppercase font-bold ${
                        alt.triggered
                          ? 'bg-amber-950 text-amber-400 border border-amber-800/40'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                      }`}>
                        {alt.triggered ? 'Triggered' : 'Active'}
                      </span>
                    </div>

                    {/* Bottom line: Note & Action Buttons */}
                    <div className="flex items-center justify-between pt-0.5">
                      <div className="text-[10px] text-gray-400 truncate max-w-[150px]">
                        {alt.note || 'Price Target'}
                      </div>

                      <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                        {alt.triggered && onResetAlert && (
                          <button
                            onClick={() => onResetAlert(alt.id)}
                            className="p-1 text-blue-400 hover:text-blue-300 rounded hover:bg-[#1e2738] transition"
                            title="Re-arm / Reset Alert"
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                        {onDeleteAlert && (
                          <button
                            onClick={() => onDeleteAlert(alt.id)}
                            className="p-1 text-gray-500 hover:text-rose-400 rounded hover:bg-[#1e2738] transition"
                            title="Delete Alert"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 px-4 text-center text-xs text-gray-500 font-mono">
                <Bell size={24} className="mx-auto mb-2 text-gray-600 opacity-40" />
                <div>No alerts found.</div>
                <div className="text-[10px] text-gray-600 mt-1">
                  Click "+ Alert" on any chart to create an alert.
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1420] border border-[#1f283d] rounded-lg max-w-md w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1b2234] pb-2">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <FileText size={16} className="text-blue-400" />
                <span>Import Custom Symbol List</span>
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Paste your list of symbols (separated by newlines, commas, or JSON array e.g. <code className="text-blue-400">TATACONSUM, LAURUSLABS, RELIANCE</code>):
            </p>
            <textarea
              rows={6}
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder="TATACONSUM&#10;LAURUSLABS&#10;RELIANCE&#10;TCS&#10;INFY"
              className="w-full p-2 text-xs font-mono bg-[#090c12] border border-[#1e2738] rounded text-white focus:outline-none focus:border-blue-500 resize-none"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleImportSymbols}
                className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded transition"
              >
                Import Symbols
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
