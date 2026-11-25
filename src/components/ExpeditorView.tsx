import React from 'react';
import { Order, KDSStation, UserRole, orderLabel } from '../types';
import { Shield, RefreshCw, AlertTriangle, Printer, Undo, Eye, CheckCircle2, PackageCheck, Sparkles, RotateCcw, Receipt, Search, X, Clock, History } from 'lucide-react';
import { formatTime, getDurationMinutes } from '../utils';

interface ExpeditorViewProps {
  orders: Order[];
  stations: KDSStation[];
  onItemRecall: (orderId: string, itemId: string) => void;
  onOrderRecall?: (orderId: string) => void;
  onReprintDocket?: (orderId: string) => void;
  onManualReprint: (orderId: string, itemId: string) => void;
  onOrderComplete?: (orderId: string) => void;
  currentUserRole: UserRole;
}

export const ExpeditorView: React.FC<ExpeditorViewProps> = ({
  orders,
  stations,
  onItemRecall,
  onOrderRecall,
  onReprintDocket,
  onManualReprint,
  onOrderComplete,
  currentUserRole,
}) => {
  const activeOrders = orders.filter(o => o.status !== 'completed');
  const completedOrders = orders.filter(o => o.status === 'completed');

  const [activeTab, setActiveTab] = React.useState<'active' | 'history'>('active');
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
  const [permissionError, setPermissionError] = React.useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = React.useState<'15m' | '1h' | 'today' | 'all'>('15m');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRecallClick = (orderId: string, itemId: string) => {
    onItemRecall(orderId, itemId);
    showToast('Item recalled for remake!');
  };

  const handleFullOrderRecall = (orderId: string) => {
    onOrderRecall?.(orderId);
    showToast(`Order #${orderId.slice(-4).toUpperCase()} fully recalled!`);
  };

  const filteredHistoryOrders = React.useMemo(() => {
    return completedOrders.filter(order => {
      const completionTime = order.completedAt || order.createdAt;
      const elapsedMins = getDurationMinutes(completionTime);

      if (historyFilter === '15m' && elapsedMins > 15) return false;
      if (historyFilter === '1h' && elapsedMins > 60) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = order.id.toLowerCase().includes(q) || orderLabel(order).toLowerCase().includes(q);
        const matchCustomer = order.customerName.toLowerCase().includes(q);
        const matchTable = (order.tableNumber || '').toLowerCase().includes(q);
        const matchCombo = (order.comboName || '').toLowerCase().includes(q);
        const matchItem = order.items.some(it => 
          it.name.toLowerCase().includes(q) || 
          (it.modifiers && it.modifiers.some(m => m.toLowerCase().includes(q)))
        );
        if (!matchId && !matchCustomer && !matchTable && !matchCombo && !matchItem) {
          return false;
        }
      }

      return true;
    });
  }, [completedOrders, historyFilter, searchQuery]);

  const displayedOrders = activeTab === 'active' ? activeOrders : filteredHistoryOrders;

  const getStationColor = (stationId: string) => {
    const s = stations.find(st => st.id === stationId);
    if (!s) return 'bg-stone-100 border-stone-200 text-stone-600';
    if (s.id === 'st-grill') return 'bg-orange-50 border border-orange-200 text-orange-700';
    if (s.id === 'st-kitchen') return 'bg-red-50 border border-red-200 text-red-700';
    if (s.id === 'st-hotmezze') return 'bg-amber-50 border border-amber-200 text-amber-800';
    if (s.id === 'st-coldmezze') return 'bg-emerald-50 border border-emerald-200 text-emerald-800';
    if (s.id === 'st-drinks') return 'bg-sky-50 border border-sky-200 text-sky-800';
    if (s.id === 'st-desserts') return 'bg-pink-50 border border-pink-200 text-pink-800';
    return 'bg-stone-50 border border-stone-200 text-stone-600';
  };

  return (
    <div className="space-y-6">
      {/* Unified Header Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#3F1C1A] text-[#EDD7A1] border border-[#454024] rounded-xl p-5 gap-4 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#E5A330]" />
            <h2 className="text-base font-tech font-extrabold uppercase tracking-wider text-[#EDD7A1]">
              Expeditor & Packing Pass Control
            </h2>
            <span className="text-[9px] font-mono bg-[#E5A330] text-[#3F1C1A] px-2 py-0.5 rounded font-extrabold uppercase">
              FINAL PACKING HUB
            </span>
          </div>
          <p className="text-xs text-[#EDD7A1]/80 mt-1">
            Unified pass: Monitor cross-station preparation, verify combo packages, reprint sticky labels, recall items for remakes, and finalize order handoffs.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            id="tab-exp-active"
            onClick={() => setActiveTab('active')}
            className={`px-3 py-1.5 font-tech text-xs font-bold rounded-lg border transition-all cursor-pointer uppercase ${
              activeTab === 'active'
                ? 'bg-[#E5A330] border-[#E5A330] text-[#3F1C1A] shadow-sm font-extrabold'
                : 'bg-[#2A1312] border-[#454024] text-[#EDD7A1] hover:bg-[#3F1C1A]'
            }`}
          >
            Active Tickets ({activeOrders.length})
          </button>
          <button
            id="tab-exp-history"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 font-tech text-xs font-bold rounded-lg border transition-all cursor-pointer uppercase ${
              activeTab === 'history'
                ? 'bg-[#E5A330] border-[#E5A330] text-[#3F1C1A] shadow-sm font-extrabold'
                : 'bg-[#2A1312] border-[#454024] text-[#EDD7A1] hover:bg-[#3F1C1A]'
            }`}
          >
            Completed History ({completedOrders.length})
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#3F1C1A] text-[#EDD7A1] border-2 border-[#E5A330] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 font-tech text-xs animate-bounce">
          <Sparkles className="h-4 w-4 text-[#E5A330]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {permissionError && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center gap-3 text-rose-800 text-xs font-mono animate-bounce uppercase font-bold">
          <AlertTriangle className="h-4.5 w-4.5 text-rose-600 shrink-0" />
          <span>{permissionError}</span>
        </div>
      )}

      {/* Main Grid: Orders Table & Side Panel Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Side: Orders Table */}
        <div className="xl:col-span-8 bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="text-sm font-tech font-bold text-stone-900 uppercase tracking-wider">
              {activeTab === 'active' ? 'Active Production Flow' : 'Handoff History Log'}
            </h3>

            {/* History Filters & Search */}
            {activeTab === 'history' && (
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-1 p-0.5 bg-stone-100 rounded-lg border border-stone-200 text-[10px] font-tech font-bold">
                  <button
                    onClick={() => setHistoryFilter('15m')}
                    className={`px-2 py-1 rounded ${historyFilter === '15m' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'}`}
                  >
                    15M
                  </button>
                  <button
                    onClick={() => setHistoryFilter('1h')}
                    className={`px-2 py-1 rounded ${historyFilter === '1h' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'}`}
                  >
                    1H
                  </button>
                  <button
                    onClick={() => setHistoryFilter('today')}
                    className={`px-2 py-1 rounded ${historyFilter === 'today' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'}`}
                  >
                    TODAY
                  </button>
                  <button
                    onClick={() => setHistoryFilter('all')}
                    className={`px-2 py-1 rounded ${historyFilter === 'all' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'}`}
                  >
                    ALL
                  </button>
                </div>

                <div className="relative flex-1 sm:w-48">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Search history..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-8 pr-3 py-1 text-xs font-mono text-stone-800 focus:outline-none focus:border-stone-400"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-150 text-[10px] font-mono text-stone-400 uppercase tracking-wider font-bold">
                  <th className="py-2.5 px-3">Ticket ID</th>
                  <th className="py-2.5 px-3">Customer & Location</th>
                  <th className="py-2.5 px-3">Package / Combo</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3 text-center">Preparation Progress</th>
                  <th className="py-2.5 px-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {(activeTab === 'active' ? activeOrders : completedOrders).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-stone-400 font-mono font-bold uppercase">
                      No active tickets in queue.
                    </td>
                  </tr>
                ) : (
                  (activeTab === 'active' ? activeOrders : completedOrders).map((order) => {
                    const elapsed = getDurationMinutes(order.createdAt);
                    const completedLines = order.items.filter(i => i.status === 'completed' || i.completedQuantity === i.quantity).length;
                    const totalLines = order.items.length;
                    const isSelected = selectedOrder?.id === order.id;

                    return (
                      <tr
                        key={order.id}
                        className={`hover:bg-amber-50/30 transition-all cursor-pointer ${
                          isSelected ? 'bg-amber-50/80 border-l-4 border-[#E5A330]' : ''
                        }`}
                        onClick={() => setSelectedOrder(order)}
                      >
                        <td className="py-3 px-3">
                          <span className="font-tech font-extrabold text-xs text-stone-900">{orderLabel(order).toUpperCase()}</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-xs font-bold text-stone-850">{order.customerName}</div>
                          <div className="text-[10px] text-stone-500 font-mono font-bold uppercase">{order.tableNumber || 'Takeaway'}</div>
                        </td>
                        <td className="py-3 px-3">
                          {order.comboName ? (
                            <span className="text-[9px] font-tech font-bold bg-[#3F1C1A] text-[#EDD7A1] border border-[#E5A330] px-2 py-0.5 rounded shadow-2xs uppercase">
                              {order.comboName}
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono text-stone-400 font-bold">Standard Order</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-xs font-mono font-bold">
                          {order.completedAt ? (
                            <span className="text-emerald-700 font-bold uppercase text-[10px]">Ready</span>
                          ) : (
                            <span className={elapsed >= 10 ? 'text-rose-700 font-extrabold animate-pulse' : elapsed >= 5 ? 'text-amber-700' : 'text-emerald-700'}>
                              {elapsed}m ago
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex items-center gap-1.5 bg-stone-50 px-2.5 py-1 rounded-full border border-stone-200">
                            <span className={`w-2 h-2 rounded-full ${completedLines === totalLines ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                            <span className="text-[10px] font-mono font-bold text-stone-700">
                              {completedLines}/{totalLines} lines done
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            id={`btn-view-details-${order.id}`}
                            className="p-1 px-2.5 bg-white hover:bg-stone-50 border border-stone-250 text-stone-700 rounded-lg text-[10px] font-mono font-bold uppercase inline-flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                          >
                            <Eye className="h-3 w-3 text-amber-600" /> Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Order Detail Inspector */}
        <div className="xl:col-span-4 bg-stone-50/80 border border-stone-200/80 rounded-xl p-5 flex flex-col justify-between min-h-[500px] shadow-sm">
          {selectedOrder ? (
            <div className="space-y-4 h-full flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start border-b border-stone-200 pb-3">
                  <div>
                    <h4 className="text-xs font-tech font-extrabold text-stone-900 uppercase tracking-wider">
                      Ticket: {orderLabel(selectedOrder).toUpperCase()}
                    </h4>
                    <p className="text-[9px] font-mono text-stone-400 font-bold uppercase">{formatTime(selectedOrder.createdAt)}</p>
                  </div>
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
                    selectedOrder.status === 'completed'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    {selectedOrder.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                {selectedOrder.comboName && (
                  <div className="mt-2 bg-[#3F1C1A] text-[#EDD7A1] border border-[#E5A330] p-2 rounded-lg text-xs font-tech font-bold flex items-center gap-1.5 shadow-xs">
                    <Sparkles className="h-3.5 w-3.5 text-[#E5A330]" />
                    <span>{selectedOrder.comboName}</span>
                  </div>
                )}

                <div className="text-xs space-y-1.5 mt-3 py-1 bg-white border border-stone-200 p-3 rounded-xl shadow-xs">
                  <div className="flex justify-between">
                    <span className="text-stone-400 font-mono font-bold text-[9px]">CUSTOMER:</span>
                    <span className="text-stone-850 font-bold">{selectedOrder.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400 font-mono font-bold text-[9px]">DESTINATION:</span>
                    <span className="text-stone-850 font-bold uppercase">{selectedOrder.tableNumber || 'Takeaway'}</span>
                  </div>
                  {selectedOrder.notes && (
                    <div className="border-t border-stone-150 pt-1.5 mt-1 text-amber-800 italic text-[11px] font-bold uppercase">
                      Note: {selectedOrder.notes}
                    </div>
                  )}
                </div>

                {/* Items in selected order */}
                <div className="space-y-2 mt-4 max-h-[220px] overflow-y-auto pr-1">
                  {selectedOrder.items.map((item) => {
                    const isCompleted = item.status === 'completed' || item.completedQuantity === item.quantity;
                    const isRecalled = item.status === 'recalled';

                    return (
                      <div
                        key={item.id}
                        className={`p-3 bg-white border rounded-xl shadow-xs space-y-2 transition-all ${
                          isRecalled
                            ? 'border-rose-400 bg-rose-50/50'
                            : isCompleted
                            ? 'border-emerald-200'
                            : 'border-stone-200'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <p className="font-bold text-stone-900 font-sans text-xs flex items-center gap-1.5">
                              <span>1x {item.name}</span>
                              {isRecalled && (
                                <span className="text-[8px] font-mono bg-rose-600 text-white px-1.5 py-0.2 rounded font-extrabold uppercase animate-pulse">
                                  RECALLED
                                </span>
                              )}
                            </p>
                            
                            {/* Station Badge */}
                            <div className="flex flex-wrap gap-1 items-center">
                              <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border uppercase ${getStationColor(item.stationId)} font-bold`}>
                                {stations.find(s => s.id === item.stationId)?.name.replace(' Station', '') || 'Kitchen'}
                              </span>
                              <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border uppercase ${
                                isCompleted ? 'bg-emerald-50 border-emerald-250 text-emerald-800 font-bold' : 'bg-stone-50 border-stone-200 text-stone-500'
                              }`}>
                                {item.completedQuantity}/{item.quantity} Prep
                              </span>
                            </div>

                            {/* Modifiers — additions first, removals second, allergies last */}
                            {item.modifiers && item.modifiers.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {[...item.modifiers]
                                  .sort((a, b) => {
                                    const rank = (mod: string) => {
                                      const upper = mod.toUpperCase();
                                      if (upper.includes('ALLERGY') || mod.includes('🚨')) return 2;
                                      if (/^(NO |WITHOUT |REMOVE|HOLD |LIGHT |EASY )/.test(upper)) return 1;
                                      return 0;
                                    };
                                    return rank(a) - rank(b);
                                  })
                                  .map(m => {
                                    const upper = m.toUpperCase();
                                    const isAllergy = upper.includes('ALLERGY') || m.includes('🚨');
                                    const isRemoval = /^(NO |WITHOUT |REMOVE|HOLD |LIGHT |EASY )/.test(upper);
                                    const colorClass = isAllergy
                                      ? 'bg-rose-50 text-rose-700 border-rose-300 font-extrabold'
                                      : isRemoval
                                      ? 'bg-red-50 text-red-700 border-red-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                    return (
                                      <span key={m} className={`text-[8px] font-mono font-bold border px-1 rounded uppercase ${colorClass}`}>
                                        • {m}
                                      </span>
                                    );
                                  })}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons: Reprint Label & Recall */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              id={`btn-manual-reprint-${selectedOrder.id}-${item.id}`}
                              onClick={() => onManualReprint(selectedOrder.id, item.id)}
                              className="p-1.5 bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-250 rounded-lg transition-all cursor-pointer shadow-xs text-[10px] font-mono font-bold flex items-center gap-1"
                              title="Reprint Sticky Label"
                            >
                              <Printer className="h-3.5 w-3.5 text-stone-600" /> Label
                            </button>

                            {isCompleted && (
                              <button
                                id={`btn-recall-${selectedOrder.id}-${item.id}`}
                                onClick={() => handleRecallClick(selectedOrder.id, item.id)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition-all cursor-pointer shadow-xs text-[10px] font-mono font-bold flex items-center gap-1"
                                title="Recall Item to Kitchen Station for Remake"
                              >
                                <Undo className="h-3.5 w-3.5 text-rose-600" /> Recall
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Order Level Actions: Recall Entire Order, Reprint Docket, Bump Complete */}
              <div className="border-t border-stone-200 pt-3 mt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    id={`btn-expeditor-recall-order-${selectedOrder.id}`}
                    onClick={() => handleFullOrderRecall(selectedOrder.id)}
                    className="py-2 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-tech font-bold text-[11px] uppercase tracking-wider rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-rose-600" /> Recall Order
                  </button>

                  <button
                    id={`btn-expeditor-reprint-docket-${selectedOrder.id}`}
                    onClick={() => {
                      onReprintDocket?.(selectedOrder.id);
                      showToast(`Docket sent to packing printer`);
                    }}
                    className="py-2 px-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 font-tech font-bold text-[11px] uppercase tracking-wider rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Receipt className="h-3.5 w-3.5 text-stone-600" /> Reprint Docket
                  </button>
                </div>

                {selectedOrder.status !== 'completed' && onOrderComplete && (
                  <button
                    id={`btn-expeditor-complete-order-${selectedOrder.id}`}
                    onClick={() => {
                      onOrderComplete(selectedOrder.id);
                      setSelectedOrder(prev => prev ? { ...prev, status: 'completed' } : null);
                      showToast(`Order completed & docket printed!`);
                    }}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-tech font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <PackageCheck className="h-4 w-4" /> Bump Order Complete & Print Docket
                  </button>
                )}
                <div className="text-[9px] text-stone-400 font-mono text-center font-bold uppercase tracking-wider">
                  Expeditor / Pass Control Hub
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <Shield className="h-8 w-8 text-stone-300 mb-2" />
              <p className="text-xs text-stone-400 font-mono font-bold uppercase leading-relaxed max-w-[240px]">No Ticket Selected</p>
              <p className="text-[10px] text-stone-500 mt-1 max-w-[200px]">Select a ticket from the flow on the left to inspect modifiers, reprint sticky labels, or recall items to kitchen stations.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
