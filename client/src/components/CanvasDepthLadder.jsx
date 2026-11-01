import React, { useEffect, useRef } from 'react';

export function CanvasDepthLadder({ depth, currentPrice, symbol }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // HiDPI device ratio support
      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, width, height);

      const bids = depth?.bids || [];
      const asks = depth?.asks || [];
      const rowCount = 10;
      const rowHeight = (height - 30) / (rowCount * 2);

      // Max cumulative volume for depth background bars
      const maxBidVol = bids[bids.length - 1]?.total || 1000;
      const maxAskVol = asks[asks.length - 1]?.total || 1000;
      const maxTotal = Math.max(maxBidVol, maxAskVol, 1);

      ctx.font = '11px ui-monospace, SFMono-Regular, monospace';

      // 1. Draw Asks (Sell orders: top down, red)
      // Asks should be ordered from highest down to best ask (lowest ask)
      const reversedAsks = [...asks].slice(0, rowCount).reverse();
      for (let i = 0; i < reversedAsks.length; i++) {
        const item = reversedAsks[i];
        const y = i * rowHeight;

        // Depth fill bar
        const barWidth = (item.total / maxTotal) * width;
        ctx.fillStyle = 'rgba(255, 59, 105, 0.15)';
        ctx.fillRect(width - barWidth, y, barWidth, rowHeight - 1);

        // Price
        ctx.fillStyle = '#ff4d79';
        ctx.textAlign = 'left';
        ctx.fillText(item.price.toFixed(2), 12, y + rowHeight - 3);

        // Size
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'right';
        ctx.fillText(item.size.toString(), width - 70, y + rowHeight - 3);

        // Total
        ctx.fillStyle = '#64748b';
        ctx.fillText(item.total.toString(), width - 12, y + rowHeight - 3);
      }

      // 2. Middle Spread Bar
      const midY = rowCount * rowHeight;
      ctx.fillStyle = '#111724';
      ctx.fillRect(0, midY, width, 30);
      ctx.strokeStyle = '#1e283d';
      ctx.strokeRect(0, midY, width, 30);

      // Current Price & Spread
      ctx.font = 'bold 13px ui-monospace, SFMono-Regular, monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(`₹${(currentPrice || 0).toFixed(2)}`, 12, midY + 19);

      ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'right';
      ctx.fillText(`Spread: ₹${(depth?.spread || 0.05).toFixed(2)}`, width - 12, midY + 19);

      // 3. Draw Bids (Buy orders: bottom, green)
      ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
      const slicedBids = bids.slice(0, rowCount);
      for (let i = 0; i < slicedBids.length; i++) {
        const item = slicedBids[i];
        const y = midY + 30 + (i * rowHeight);

        // Depth fill bar
        const barWidth = (item.total / maxTotal) * width;
        ctx.fillStyle = 'rgba(0, 192, 135, 0.15)';
        ctx.fillRect(width - barWidth, y, barWidth, rowHeight - 1);

        // Price
        ctx.fillStyle = '#00c087';
        ctx.textAlign = 'left';
        ctx.fillText(item.price.toFixed(2), 12, y + rowHeight - 3);

        // Size
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'right';
        ctx.fillText(item.size.toString(), width - 70, y + rowHeight - 3);

        // Total
        ctx.fillStyle = '#64748b';
        ctx.fillText(item.total.toString(), width - 12, y + rowHeight - 3);
      }
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [depth, currentPrice]);

  return (
    <div className="flex flex-col h-full bg-[#0a0d14] border border-[#1b2234] rounded-lg overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#0d121c] border-b border-[#1b2234]">
        <div className="text-xs font-semibold tracking-wider text-gray-300 uppercase">
          Order Book (DOM)
        </div>
        <div className="flex space-x-6 text-[10px] font-mono text-gray-500">
          <span>Price</span>
          <span>Size</span>
          <span>Total</span>
        </div>
      </div>

      {/* Canvas Ladder */}
      <div className="relative flex-1 w-full h-full">
        <canvas
          ref={canvasRef}
          width={280}
          height={480}
          className="w-full h-full block"
        />
      </div>
    </div>
  );
}
