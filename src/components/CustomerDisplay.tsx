import React from 'react';
import { Order, orderLabel } from '../types';
import { Clock, CheckCircle2, Flame, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CustomerDisplayProps {
  orders: Order[];
  venueName?: string | null; // live: the venue's own name (demo keeps its approved text)
}

export const CustomerDisplay: React.FC<CustomerDisplayProps> = ({ orders, venueName }) => {
  const [time, setTime] = React.useState(new Date().toLocaleTimeString());

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter orders: Orders remain in PREPARING until Expeditor/Packing stage completes the order
  const preparingOrders = orders.filter(
    o => o.status === 'receiving' || o.status === 'preparing' || o.status === 'received' || o.status === 'ready_to_pack'
  );

  const readyOrders = orders.filter(
    o => o.status === 'completed'
  );

  return (
    <div className="bg-[#2D1412] text-[#EDD7A1] min-h-[600px] rounded-2xl border-2 border-[#454024] p-6 shadow-2xl overflow-hidden flex flex-col font-sans" id="customer-order-display">
      
      {/* Customer Display Header */}
      <header className="bg-[#3F1C1A] border-b-2 border-[#E5A330]/40 pb-5 mb-6 px-4 flex flex-col sm:flex-row justify-between items-center gap-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#E5A330] text-[#3F1C1A] rounded-xl shadow-md">
            <Sparkles className="h-7 w-7 fill-current" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider text-[#EDD7A1]">
              {venueName ? `${venueName} Order Status` : 'Sufra Order Status'}
            </h1>
            <p className="text-xs text-[#E5A330] font-mono uppercase font-bold tracking-widest">
              {venueName ? 'Live Order Display' : 'Lebanese & Afghan Kitchen • Live Order Display'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-[#2D1412] px-4 py-2 rounded-xl border border-[#454024]">
          <Clock className="h-5 w-5 text-[#E5A330]" />
          <span className="text-lg font-mono font-bold text-[#EDD7A1]">{time}</span>
        </div>
      </header>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
        
        {/* COLUMN 1: PREPARING IN KITCHEN */}
        <div className="bg-[#3F1C1A]/80 border-2 border-[#454024] rounded-2xl p-6 flex flex-col shadow-inner">
          <div className="flex items-center justify-between pb-4 border-b border-[#454024] mb-6">
            <div className="flex items-center gap-3">
              <Flame className="h-7 w-7 text-[#E5A330] animate-bounce" />
              <h2 className="text-xl font-extrabold uppercase tracking-wide text-[#EDD7A1]">
                Preparing
              </h2>
            </div>
            <span className="bg-[#E5A330]/20 text-[#E5A330] text-sm font-mono font-black px-3 py-1 rounded-full border border-[#E5A330]/40">
              {preparingOrders.length} ORDERS
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 overflow-y-auto max-h-[420px] pr-2">
            <AnimatePresence>
              {preparingOrders.map(order => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="bg-[#2D1412] border-2 border-[#E5A330]/30 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-md hover:border-[#E5A330] transition-all"
                >
                  <span className="text-2xl font-black font-mono text-[#EDD7A1] tracking-wider">
                    {orderLabel(order)}
                  </span>
                  <span className="text-[10px] font-mono text-[#E5A330] mt-1 font-bold uppercase truncate max-w-full">
                    {order.customerName}
                  </span>
                  <span className="mt-2 px-2 py-0.5 bg-[#454024]/60 text-[#EDD7A1] text-[9px] font-mono rounded font-semibold uppercase">
                    In Kitchen
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>

            {preparingOrders.length === 0 && (
              <div className="col-span-full py-12 text-center text-[#EDD7A1]/50 font-mono text-sm">
                No active orders preparing.
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 2: READY FOR PICKUP */}
        <div className="bg-[#3F1C1A]/80 border-2 border-[#E5A330] rounded-2xl p-6 flex flex-col shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-[#E5A330]/40 mb-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-7 w-7 text-[#E5A330] animate-pulse" />
              <h2 className="text-xl font-extrabold uppercase tracking-wide text-[#E5A330]">
                Ready For Pickup
              </h2>
            </div>
            <span className="bg-[#E5A330] text-[#3F1C1A] text-sm font-mono font-black px-3 py-1 rounded-full shadow">
              {readyOrders.length} READY
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 overflow-y-auto max-h-[420px] pr-2">
            <AnimatePresence>
              {readyOrders.map(order => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="bg-gradient-to-b from-[#E5A330] to-[#c58a20] text-[#3F1C1A] rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-lg font-bold border-2 border-[#EDD7A1]"
                >
                  <span className="text-2xl font-black font-mono tracking-widest text-[#3F1C1A]">
                    {orderLabel(order)}
                  </span>
                  <span className="text-[11px] font-extrabold uppercase mt-1 truncate max-w-full text-[#2D1412]">
                    {order.customerName}
                  </span>
                  <span className="mt-2 px-2.5 py-1 bg-[#3F1C1A] text-[#EDD7A1] text-[10px] font-mono rounded-lg font-extrabold uppercase shadow-sm">
                    {order.tableNumber || 'PICKUP'}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>

            {readyOrders.length === 0 && (
              <div className="col-span-full py-12 text-center text-[#EDD7A1]/50 font-mono text-sm">
                Orders will appear here when ready!
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Footer Banner */}
      <footer className="mt-6 pt-4 border-t border-[#454024] flex justify-between items-center text-xs text-[#EDD7A1]/70 font-mono">
        <span>Please show your ticket number at the counter when calling.</span>
        <span className="font-bold text-[#E5A330]">{venueName || 'Sufra KDS Smart Queue System'}</span>
      </footer>
    </div>
  );
};
