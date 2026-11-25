import React from 'react';
import { Order, OrderItem, KDSStation, UserRole, MenuItem, PendingBump, KDSConfig } from '../types';
import { Check, Clock, AlertTriangle, Printer, ToggleLeft, ToggleRight, PackageX, PackageCheck, Search, X, Sparkles, History, Undo, RotateCcw, Receipt, ArrowLeft, Undo2, Timer, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { formatTime, getDurationMinutes } from '../utils';
import { motion, AnimatePresence } from 'motion/react';

interface KDSStationViewProps {
  station: KDSStation;
  orders: Order[];
  menuItems?: MenuItem[];
  onToggleStock?: (itemId: string) => void;
  onItemBump: (orderId: string, itemId: string) => void;
  onPackingItemBump?: (orderId: string, itemId: string) => void;
  onOrderComplete: (orderId: string) => void; // for packing station fallback
  onOrderRecall?: (orderId: string) => void;
  onItemRecall?: (orderId: string, itemId: string) => void;
  onReprintDocket?: (orderId: string) => void;
  onManualReprint?: (orderId: string, itemId: string, actingStationId?: string) => void;
  currentUserRole: UserRole;
  allStations: KDSStation[];
  pendingBumps?: PendingBump[];
  onUndoBump?: (pendingBumpId: string) => void;
  config?: KDSConfig;
  onConfigChange?: (newConfig: KDSConfig) => void;
}

// Modifier presentation (client request): additions and removals grouped
// separately — additions first, removals second — and colour-coded so
// kitchen staff can spot a change at a glance during service. Allergy
// warnings are their own, more emphatic category, always last and pulsing.
type ModifierKind = 'addition' | 'removal' | 'allergy';

function classifyModifier(mod: string): ModifierKind {
  const upper = mod.toUpperCase();
  if (upper.includes('ALLERGY') || mod.includes('🚨')) return 'allergy';
  if (/^(NO |WITHOUT |REMOVE|HOLD |LIGHT |EASY )/.test(upper)) return 'removal';
  return 'addition'; // EXTRA, ADD, WITH, OAT MILK, etc. — anything not explicitly a removal
}

function sortModifiersForDisplay(mods: string[]): string[] {
  const rank: Record<ModifierKind, number> = { addition: 0, removal: 1, allergy: 2 };
  return [...mods].sort((a, b) => rank[classifyModifier(a)] - rank[classifyModifier(b)]);
}

function modifierBadgeClass(mod: string, kdsTheme: 'dark' | 'light'): string {
  const kind = classifyModifier(mod);
  if (kind === 'allergy') return 'bg-rose-500/20 border-rose-500 text-rose-400 font-extrabold animate-pulse';
  if (kind === 'removal') return kdsTheme === 'dark' ? 'bg-red-950/50 border-red-800 text-red-300' : 'bg-red-50 border-red-300 text-red-700';
  return kdsTheme === 'dark' ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-300 text-emerald-700';
}

const getStationBannerProps = (stationId: string, stationName: string, color: string) => {
  const nameUpper = stationName.toUpperCase();
  if (stationId === 'st-grill' || nameUpper.includes('GRILL')) {
    return {
      badgeClass: 'bg-orange-500/25 border-orange-500/70 text-orange-400 shadow-sm',
    };
  }
  if (stationId === 'st-kitchen' || nameUpper.includes('MAINS') || nameUpper.includes('KITCHEN')) {
    return {
      badgeClass: 'bg-red-500/25 border-red-500/70 text-red-400 shadow-sm',
    };
  }
  if (stationId === 'st-hotmezze' || nameUpper.includes('HOT')) {
    return {
      badgeClass: 'bg-amber-500/25 border-amber-500/70 text-amber-300 shadow-sm',
    };
  }
  if (stationId === 'st-coldmezze' || nameUpper.includes('COLD') || nameUpper.includes('SALAD')) {
    return {
      badgeClass: 'bg-emerald-500/25 border-emerald-500/70 text-emerald-300 shadow-sm',
    };
  }
  if (stationId === 'st-drinks' || nameUpper.includes('DRINK') || nameUpper.includes('COFFEE') || nameUpper.includes('BAR')) {
    return {
      badgeClass: 'bg-sky-500/25 border-sky-500/70 text-sky-300 shadow-sm',
    };
  }
  if (stationId === 'st-desserts' || nameUpper.includes('DESSERT') || nameUpper.includes('SWEET')) {
    return {
      badgeClass: 'bg-pink-500/25 border-pink-500/70 text-pink-300 shadow-sm',
    };
  }
  if (stationId === 'st-packing' || nameUpper.includes('PACK') || nameUpper.includes('PASS')) {
    return {
      badgeClass: 'bg-indigo-500/25 border-indigo-500/70 text-indigo-300 shadow-sm',
    };
  }
  return {
    badgeClass: 'bg-yellow-500/25 border-yellow-500/70 text-yellow-300 shadow-sm',
  };
};

export const KDSStationView: React.FC<KDSStationViewProps> = ({
  station,
  orders,
  menuItems = [],
  onToggleStock,
  onItemBump,
  onPackingItemBump,
  onOrderComplete,
  onOrderRecall,
  onItemRecall,
  onReprintDocket,
  onManualReprint,
  currentUserRole,
  allStations,
  pendingBumps = [],
  onUndoBump,
  config,
  onConfigChange,
}) => {
  const isPackingStation = station.id === 'st-packing';
  // Admin option per station. Packing & Pass always sees every item and order.
  const showOtherStationItems = isPackingStation || station.showOtherStationItems !== false;
  const isStationLabelPrintingEnabled = station.labelPrintingEnabled ?? false;

  const [kdsTheme, setKdsTheme] = React.useState<'dark' | 'light'>('dark');
  const [showStockModal, setShowStockModal] = React.useState(false);
  const [stockSearchQuery, setStockSearchQuery] = React.useState('');
  const [collapsedEmptyOrders, setCollapsedEmptyOrders] = React.useState<Record<string, boolean>>({});

  // History / Completed Orders State
  const [showHistoryModal, setShowHistoryModal] = React.useState(false);
  const [historyFilter, setHistoryFilter] = React.useState<'15m' | '1h' | 'today' | 'all'>('15m');
  const [historySearchQuery, setHistorySearchQuery] = React.useState('');
  const [feedbackToast, setFeedbackToast] = React.useState<string | null>(null);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  const toggleOrderCollapse = (orderId: string) => {
    setCollapsedEmptyOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  // Dynamic real-time ticker to update elapsed time visual warnings on screen
  const [_, setTick] = React.useState(0);
  React.useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // FIX (workflow issue): previously every station's "active" list was
  // governed by the WHOLE order's status, so a production station kept
  // showing a ticket until Packing & Pass finished everything else. Per the
  // client: a production station should clear a ticket from its own active
  // queue once ITS OWN items are done, independent of other stations or
  // Packing & Pass — the order stays fully accessible via this station's own
  // History for Recall/Remake. Packing & Pass's own view is unaffected: its
  // job genuinely is order-level completion, so it keeps the old rule.
  const hasPendingBumpForStation = React.useCallback(
    (order: Order) =>
      pendingBumps.some(pb => {
        if (pb.orderId !== order.id) return false;
        const item = order.items.find(i => i.id === pb.itemId);
        return item?.stationId === station.id;
      }),
    [pendingBumps, station.id]
  );

  const stationHasOutstandingWork = React.useCallback(
    (order: Order) =>
      order.items.some(i => i.stationId === station.id && i.completedQuantity < i.quantity) ||
      hasPendingBumpForStation(order),
    [station.id, hasPendingBumpForStation]
  );

  // Show all active orders across all stations
  const activeOrders = orders.filter(order => {
    if (order.status === 'completed') return false;
    if (isPackingStation) return true; // order-level completion still governs Packing & Pass
    const hasAnyItemForStation = order.items.some(i => i.stationId === station.id);
    if (!hasAnyItemForStation) return showOtherStationItems; // nothing routed here: shown faded for context only when the station's option is On
    return stationHasOutstandingWork(order); // clears once this station's own work here is actually done
  });
  const completedOrders = orders.filter(order => order.status === 'completed');

  // History orders relevant to this station (completed orders or active orders with completed/bumped items)
  const stationHistoryOrders = React.useMemo(() => {
    return orders.filter(order => {
      if (order.status === 'completed') return true;
      if (isPackingStation) {
        return order.items.some(i => i.packedQuantity > 0 || i.completedQuantity > 0);
      }
      return order.items.some(i => i.stationId === station.id && i.completedQuantity > 0);
    });
  }, [orders, isPackingStation, station.id]);

  // Filtered completed history
  const filteredHistoryOrders = React.useMemo(() => {
    return stationHistoryOrders.filter(order => {
      const completionTime = order.completedAt || order.createdAt;
      const elapsedMins = getDurationMinutes(completionTime);

      if (historyFilter === '15m' && elapsedMins > 15) return false;
      if (historyFilter === '1h' && elapsedMins > 60) return false;

      if (historySearchQuery.trim()) {
        const q = historySearchQuery.toLowerCase();
        const matchId = order.id.toLowerCase().includes(q);
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
  }, [stationHistoryOrders, historyFilter, historySearchQuery]);

  // Calculate All-Day Aggregate Counts for items pending preparation at this station (or ready to pack)
  const allDayCounts = React.useMemo(() => {
    const counts: Record<string, { id: string; name: string; qty: number }> = {};
    
    activeOrders.forEach(order => {
      order.items.forEach(item => {
        const matchesStation = isPackingStation || item.stationId === station.id;
        
        if (isPackingStation) {
          const readyToPack = item.completedQuantity - item.packedQuantity;
          if (readyToPack > 0) {
            if (!counts[item.menuItemId]) {
              counts[item.menuItemId] = { id: item.menuItemId, name: item.name, qty: 0 };
            }
            counts[item.menuItemId].qty += readyToPack;
          }
        } else if (matchesStation) {
          const remainingQty = item.quantity - item.completedQuantity;
          if (remainingQty > 0) {
            if (!counts[item.menuItemId]) {
              counts[item.menuItemId] = { id: item.menuItemId, name: item.name, qty: 0 };
            }
            counts[item.menuItemId].qty += remainingQty;
          }
        }
      });
    });
    
    return Object.values(counts).sort((a, b) => b.qty - a.qty);
  }, [activeOrders, station.id, isPackingStation]);

  // Station colors for glowing borders mapped to Sufra Lebanese & Afghan Kitchen Palette
  const getStationColorClasses = (color: string) => {
    switch (color) {
      case 'orange':
      case 'sun':
        return {
          glow: 'shadow-[0_0_12px_rgba(229,163,48,0.35)] border-[#E5A330]',
          text: 'text-[#E5A330]',
          badge: 'bg-[#E5A330]/20 text-[#E5A330] border-[#E5A330]/40',
          bg: 'bg-[#E5A330]/20'
        };
      case 'red':
      case 'coffee':
        return {
          glow: 'shadow-[0_0_12px_rgba(63,28,26,0.5)] border-[#EDD7A1]',
          text: 'text-[#EDD7A1]',
          badge: 'bg-[#3F1C1A] text-[#EDD7A1] border-[#454024]',
          bg: 'bg-[#3F1C1A]/40'
        };
      case 'blue':
      case 'sky':
        return {
          glow: 'shadow-[0_0_12px_rgba(66,105,152,0.35)] border-[#426998]',
          text: 'text-[#426998]',
          badge: 'bg-[#426998]/20 text-[#426998] border-[#426998]/40',
          bg: 'bg-[#426998]/20'
        };
      case 'green':
      case 'emerald':
      case 'olive':
        return {
          glow: 'shadow-[0_0_12px_rgba(69,64,36,0.35)] border-[#454024]',
          text: 'text-[#EDD7A1]',
          badge: 'bg-[#454024]/40 text-[#EDD7A1] border-[#454024]',
          bg: 'bg-[#454024]/30'
        };
      case 'purple':
      case 'desert':
        return {
          glow: 'shadow-[0_0_12px_rgba(237,215,161,0.35)] border-[#EDD7A1]',
          text: 'text-[#EDD7A1]',
          badge: 'bg-[#EDD7A1]/20 text-[#EDD7A1] border-[#EDD7A1]/40',
          bg: 'bg-[#EDD7A1]/20'
        };
      default:
        return {
          glow: 'shadow-md border-[#EDD7A1]/40',
          text: 'text-[#EDD7A1]',
          badge: 'bg-[#454024]/20 text-[#EDD7A1] border-[#454024]/30',
          bg: 'bg-[#454024]/20'
        };
    }
  };

  const currentGlow = getStationColorClasses(station.color);

  // Helper to determine ticket delay colors for dark/light themes
  const getTicketHeaderColor = (createdAt: string, isDark: boolean) => {
    const elapsedMins = getDurationMinutes(createdAt);
    if (isDark) {
      if (elapsedMins >= 10) return 'bg-rose-950/90 border-rose-800 text-rose-200';
      if (elapsedMins >= 5) return 'bg-[#3F1C1A] border-[#E5A330] text-[#E5A330]';
      return 'bg-[#3F1C1A] border-[#454024] text-[#EDD7A1]';
    } else {
      if (elapsedMins >= 10) return 'bg-rose-100 border-rose-200 text-rose-800';
      if (elapsedMins >= 5) return 'bg-[#EDD7A1]/60 border-[#E5A330] text-[#3F1C1A]';
      return 'bg-[#F2E8D5] border-[#EDD7A1] text-[#3F1C1A]';
    }
  };

  const getTicketStatusBadge = (createdAt: string, isDark: boolean) => {
    const elapsedMins = getDurationMinutes(createdAt);
    if (isDark) {
      if (elapsedMins >= 10) return 'text-red-300 bg-red-950/80 border-red-700 animate-pulse';
      if (elapsedMins >= 5) return 'text-[#E5A330] bg-[#E5A330]/20 border-[#E5A330]/40';
      return 'text-[#EDD7A1] bg-[#454024]/40 border-[#454024]';
    } else {
      if (elapsedMins >= 10) return 'text-rose-700 bg-rose-100 border-rose-200 animate-pulse';
      if (elapsedMins >= 5) return 'text-[#3F1C1A] bg-[#E5A330]/30 border-[#E5A330]';
      return 'text-[#3F1C1A] bg-[#EDD7A1] border-[#EDD7A1]';
    }
  };

  const getTicketBorderColor = (createdAt: string, isDark: boolean) => {
    const elapsedMins = getDurationMinutes(createdAt);
    if (isDark) {
      if (elapsedMins >= 10) return 'border-red-800/90 bg-[#230F0E] shadow-[0_0_12px_rgba(239,68,68,0.2)]';
      if (elapsedMins >= 5) return 'border-[#E5A330] bg-[#2A1312] shadow-[0_0_12px_rgba(229,163,48,0.2)]';
      return 'border-[#454024] bg-[#2A1312]';
    } else {
      if (elapsedMins >= 10) return 'border-rose-300 bg-white shadow-sm';
      if (elapsedMins >= 5) return 'border-[#E5A330] bg-white shadow-sm';
      return 'border-[#EDD7A1] bg-white shadow-xs';
    }
  };

  return (
    <div className={`space-y-4 p-1 rounded-2xl transition-colors duration-300 ${kdsTheme === 'dark' ? 'bg-stone-950 text-stone-200' : 'bg-white text-stone-800'}`}>
      
      {/* 1. Header with Compact Control and Toggle */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center border rounded-xl p-4 gap-4 transition-colors ${
        kdsTheme === 'dark' ? 'bg-stone-900/90 border-stone-800' : 'bg-stone-50 border-stone-200'
      }`}>
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full bg-${station.color}-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]`} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-display uppercase tracking-wider font-extrabold">{station.name}</h2>
              <span className={`text-[9px] font-tech uppercase font-bold px-2 py-0.5 rounded border ${
                kdsTheme === 'dark' ? 'bg-stone-950 border-stone-800 text-stone-400' : 'bg-white border-stone-200 text-stone-500'
              }`}>
                {isPackingStation ? 'Packing' : 'Station Kiosk'}
              </span>
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5 font-medium">
              {isPackingStation ? 'Consolidate orders & handoff' : 'Prepare and bump routed tickets'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {/* Active Tickets Counter */}
          <div className={`px-3 py-1 rounded-lg border text-center font-mono min-w-[70px] ${
            kdsTheme === 'dark' ? 'bg-stone-950 border-stone-800' : 'bg-white border-stone-200'
          }`}>
            <span className="text-stone-500 text-[8px] block uppercase font-bold tracking-wider font-tech">Tickets</span>
            <span className="font-extrabold text-sm">{activeOrders.length}</span>
          </div>

          {/* Grace period is Admin-only (Server Admin > General Settings) — no
              selector on operational KDS screens, per client request to keep
              the kitchen UI uncluttered. The station simply uses whatever
              value Admin has configured (config.undoGracePeriodSeconds). */}

          {/* Empty Orders Visibility Toggle */}
          <button
            id="btn-toggle-fade-empty"
            onClick={() => {
              if (config && onConfigChange) {
                const currentVal = config.fadeEmptyStationOrders ?? true;
                onConfigChange({ ...config, fadeEmptyStationOrders: !currentVal });
                showToast(currentVal ? 'Empty orders set to normal view' : 'Empty orders set to faded/compact');
              }
            }}
            title="Toggle whether orders with 0 items for this station appear faded and compact"
            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-tech font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              config?.fadeEmptyStationOrders !== false
                ? 'bg-amber-950/40 border-amber-800/80 text-amber-300'
                : 'bg-stone-800 border-stone-700 text-stone-300'
            }`}
          >
            {config?.fadeEmptyStationOrders !== false ? (
              <>
                <EyeOff className="h-3.5 w-3.5 text-amber-400" /> EMPTY: FADED
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5 text-stone-400" /> EMPTY: FULL
              </>
            )}
          </button>

          {/* History / Completed Orders Button */}
          <button
            id="btn-kds-history"
            onClick={() => setShowHistoryModal(true)}
            className={`px-3 py-1.5 rounded-lg border text-[10px] font-tech font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isPackingStation
                ? 'bg-indigo-950/80 border-indigo-700 text-indigo-200 hover:bg-indigo-900 shadow-sm ring-1 ring-indigo-500/40'
                : kdsTheme === 'dark'
                ? 'bg-stone-800 border-stone-700 text-stone-200 hover:bg-stone-700'
                : 'bg-stone-100 border-stone-300 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <History className="h-4 w-4 text-indigo-400" />
            <span>HISTORY</span>
            {completedOrders.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-indigo-500 text-white rounded-full text-[9px] font-mono">
                {completedOrders.length}
              </span>
            )}
          </button>

          {/* Out of stock control */}
          <button
            id="btn-kds-quick-stock"
            onClick={() => setShowStockModal(true)}
            className={`px-3 py-1.5 rounded-lg border text-[10px] font-tech font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              kdsTheme === 'dark'
                ? 'bg-amber-950/60 border-amber-800 text-amber-300 hover:bg-amber-900/80'
                : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <PackageX className="h-4 w-4 text-amber-400" /> OUT OF STOCK
          </button>

          {/* Theme switcher */}
          <button
            id="btn-toggle-kds-theme"
            onClick={() => setKdsTheme(t => t === 'dark' ? 'light' : 'dark')}
            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-tech font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              kdsTheme === 'dark' 
                ? 'bg-stone-800 hover:bg-stone-700 border-stone-700 text-orange-400' 
                : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
            }`}
          >
            {kdsTheme === 'dark' ? (
              <>
                <ToggleRight className="h-4 w-4 text-orange-400" /> KDS DARK
              </>
            ) : (
              <>
                <ToggleLeft className="h-4 w-4 text-stone-400" /> KDS LIGHT
              </>
            )}
          </button>
        </div>
      </div>

      {/* Real-time Undo Grace Period Banner & Countdown Dock */}
      {pendingBumps && pendingBumps.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="bg-[#2D1412] text-[#EDD7A1] border-2 border-[#E5A330] rounded-xl p-3.5 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3 relative overflow-hidden"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#E5A330] text-[#3F1C1A] rounded-lg shadow-sm animate-pulse">
              <Undo2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-tech font-black uppercase text-[#EDD7A1] tracking-wider">
                  UNDO GRACE PERIOD ACTIVE
                </span>
                <span className="bg-[#E5A330] text-[#3F1C1A] font-mono font-black text-xs px-2 py-0.5 rounded-full shadow-xs animate-bounce">
                  {pendingBumps[0].secondsRemaining}s
                </span>
              </div>
              <p className="text-[11px] text-[#EDD7A1]/80 font-mono mt-0.5">
                Print jobs, final dockets, and customer pickup status delayed during grace window.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            {pendingBumps.map(pb => (
              <button
                key={pb.id}
                id={`btn-undo-bump-bar-${pb.id}`}
                onClick={() => {
                  onUndoBump?.(pb.id);
                  showToast(`Bump undone for ${pb.type === 'order_complete' ? 'Order' : 'Item'} #${pb.orderId.slice(-4).toUpperCase()}!`);
                }}
                className="px-4 py-2 bg-[#E5A330] hover:bg-[#d69320] text-[#3F1C1A] font-tech font-black text-xs rounded-lg shadow-md flex items-center gap-2 cursor-pointer active:scale-95 transition-all uppercase tracking-wider"
              >
                <Undo className="h-4 w-4 stroke-[3]" />
                <span>UNDO {pb.type === 'order_complete' ? 'COMPLETE' : 'BUMP'} (#{pb.orderId.slice(-4).toUpperCase()})</span>
                <span className="bg-[#3F1C1A] text-[#EDD7A1] text-[10px] font-mono px-1.5 py-0.2 rounded font-bold">
                  {pb.secondsRemaining}s
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Floating Action Feedback Toast */}
      {feedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#3F1C1A] text-[#EDD7A1] border-2 border-[#E5A330] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 font-tech text-xs animate-bounce">
          <Sparkles className="h-4 w-4 text-[#E5A330]" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* History & Completed Orders Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#2D1412] text-[#EDD7A1] border-2 border-[#E5A330]/60 rounded-2xl max-w-4xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh] relative">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-[#454024] mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-950/80 border border-indigo-700/80 rounded-xl text-indigo-300">
                    <History className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-display font-black uppercase text-[#EDD7A1] tracking-wider">
                      {isPackingStation ? 'Packing & Pass History & Recall' : `${station.name} History & Recall`}
                    </h2>
                    <p className="text-xs text-[#EDD7A1]/70 font-mono">
                      {isPackingStation 
                        ? (isStationLabelPrintingEnabled
                            ? 'Fast lookup, reprint labels/dockets, recall items from any station, or recall entire orders.' 
                            : 'Fast lookup, recall items from any station, or recall entire orders.')
                        : (isStationLabelPrintingEnabled
                            ? `View recently completed items for ${station.name}. Reprint item labels or recall items directly for remake.`
                            : `View recently completed items for ${station.name}. Recall your station's items directly for remake.`)}
                    </p>
                  </div>
                </div>
              </div>
              <button
                id="btn-close-history-modal"
                onClick={() => setShowHistoryModal(false)}
                className="text-[#EDD7A1]/60 hover:text-[#EDD7A1] p-1.5 rounded-xl hover:bg-[#3F1C1A] transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Quick Filters & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              {/* Quick Filters */}
              <div className="flex items-center gap-1.5 p-1 bg-[#1C0B0A] rounded-xl border border-[#454024] shrink-0">
                <button
                  onClick={() => setHistoryFilter('15m')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-tech font-bold transition-all ${
                    historyFilter === '15m'
                      ? 'bg-[#E5A330] text-[#3F1C1A] shadow-sm'
                      : 'text-[#EDD7A1]/70 hover:text-[#EDD7A1]'
                  }`}
                >
                  LAST 15 MINS
                </button>
                <button
                  onClick={() => setHistoryFilter('1h')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-tech font-bold transition-all ${
                    historyFilter === '1h'
                      ? 'bg-[#E5A330] text-[#3F1C1A] shadow-sm'
                      : 'text-[#EDD7A1]/70 hover:text-[#EDD7A1]'
                  }`}
                >
                  LAST 1 HOUR
                </button>
                <button
                  onClick={() => setHistoryFilter('today')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-tech font-bold transition-all ${
                    historyFilter === 'today'
                      ? 'bg-[#E5A330] text-[#3F1C1A] shadow-sm'
                      : 'text-[#EDD7A1]/70 hover:text-[#EDD7A1]'
                  }`}
                >
                  TODAY
                </button>
                <button
                  onClick={() => setHistoryFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-tech font-bold transition-all ${
                    historyFilter === 'all'
                      ? 'bg-[#E5A330] text-[#3F1C1A] shadow-sm'
                      : 'text-[#EDD7A1]/70 hover:text-[#EDD7A1]'
                  }`}
                >
                  ALL ({stationHistoryOrders.length})
                </button>
              </div>

              {/* Search input */}
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3 top-3 text-[#E5A330]" />
                <input
                  type="text"
                  placeholder="Search by order #, customer, table, or item name..."
                  value={historySearchQuery}
                  onChange={e => setHistorySearchQuery(e.target.value)}
                  className="w-full bg-[#1C0B0A] border border-[#454024] rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-[#EDD7A1] placeholder-[#EDD7A1]/40 focus:outline-none focus:border-[#E5A330]"
                />
                {historySearchQuery && (
                  <button
                    onClick={() => setHistorySearchQuery('')}
                    className="absolute right-3 top-2.5 text-[#EDD7A1]/40 hover:text-[#EDD7A1]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Completed Orders List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {filteredHistoryOrders.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-[#454024] rounded-2xl bg-[#1C0B0A]/50 p-6">
                  <Clock className="h-10 w-10 text-[#E5A330]/40 mx-auto mb-2" />
                  <p className="font-tech font-bold text-sm text-[#EDD7A1]/80 uppercase">No completed orders or items found in this filter range</p>
                  <p className="text-xs font-mono text-[#EDD7A1]/50 mt-1">
                    Try selecting a wider timeframe or clear your search query.
                  </p>
                </div>
              ) : (
                filteredHistoryOrders.map(order => {
                  const completedAgoMins = getDurationMinutes(order.completedAt || order.createdAt);
                  return (
                    <div
                      key={order.id}
                      className="bg-[#1C0B0A] border border-[#454024] rounded-xl p-4 transition-all hover:border-[#E5A330]/50 space-y-3"
                    >
                      {/* Order Summary Row */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#3F1C1A] pb-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-mono text-base font-black text-[#E5A330] bg-[#3F1C1A] px-2.5 py-1 rounded-lg border border-[#454024]">
                            #{order.id.slice(-4).toUpperCase()}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-tech font-black text-sm uppercase text-white">
                                {order.customerName}
                              </span>
                              {order.tableNumber && (
                                <span className="text-[10px] font-mono font-bold bg-[#E5A330]/20 text-[#E5A330] border border-[#E5A330]/40 px-2 py-0.5 rounded">
                                  TABLE {order.tableNumber}
                                </span>
                              )}
                              <span className="text-[10px] font-tech font-bold uppercase bg-stone-800 text-stone-300 px-2 py-0.5 rounded">
                                {order.type}
                              </span>
                              {order.comboName && (
                                <span className="text-[10px] font-tech font-black uppercase bg-[#E5A330] text-[#3F1C1A] px-2 py-0.5 rounded">
                                  ★ {order.comboName}
                                </span>
                              )}
                              <span className={`text-[9px] font-tech font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                                order.status === 'completed'
                                  ? 'bg-emerald-950/70 border-emerald-700 text-emerald-300'
                                  : 'bg-amber-950/70 border-amber-700 text-amber-300'
                              }`}>
                                {order.status === 'completed' ? 'ORDER COMPLETED' : 'IN PROGRESS'}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-stone-400 mt-0.5 flex items-center gap-2">
                              <span>{order.status === 'completed' ? `Completed ${formatTime(order.completedAt || order.createdAt)} (${completedAgoMins}m ago)` : `Started ${formatTime(order.createdAt)}`}</span>
                              <span>•</span>
                              <span>{order.items.length} items</span>
                            </div>
                          </div>
                        </div>

                        {/* Order Level Master Actions */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Recall Entire Order Button (Only Packing & Pass station has authority to recall entire order) */}
                          {isPackingStation ? (
                            <button
                              id={`btn-recall-order-${order.id}`}
                              onClick={() => {
                                onOrderRecall?.(order.id);
                                showToast(`Order #${order.id.slice(-4).toUpperCase()} recalled to kitchen!`);
                                setShowHistoryModal(false);
                              }}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 border border-rose-400 text-white rounded-lg text-xs font-tech font-black flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95 uppercase tracking-wider"
                            >
                              <RotateCcw className="h-3.5 w-3.5 stroke-[2.5]" />
                              RECALL ENTIRE ORDER
                            </button>
                          ) : (
                            <div className="px-2.5 py-1 bg-stone-900 border border-stone-800 rounded-lg text-[10px] font-tech text-stone-400 flex items-center gap-1.5" title="Full order recall is restricted to Packing & Pass station">
                              <ShieldAlert className="h-3.5 w-3.5 text-stone-500" />
                              <span>FULL RECALL AT PACKING ONLY</span>
                            </div>
                          )}

                          {/* Reprint Docket Button (Available only if station has Label Printing ON and is the designated docket-handling station: Packing & Pass) */}
                          {isStationLabelPrintingEnabled && isPackingStation && (
                            <button
                              id={`btn-reprint-docket-${order.id}`}
                              onClick={() => {
                                onReprintDocket?.(order.id);
                                showToast(`Sent Docket #${order.id.slice(-4).toUpperCase()} to ${station.name} Printer!`);
                              }}
                              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-200 rounded-lg text-xs font-tech font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                            >
                              <Receipt className="h-3.5 w-3.5 text-[#E5A330]" />
                              REPRINT DOCKET
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Items breakdown list */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {order.items.map(item => {
                          const itemStation = allStations.find(s => s.id === item.stationId);
                          const isOwnStationItem = item.stationId === station.id;
                          // Can recall if this device is Packing & Pass OR if item belongs to this station
                          const canRecallThisItem = isPackingStation || isOwnStationItem;

                          return (
                            <div
                              key={item.id}
                              className={`border rounded-lg p-2.5 flex justify-between items-center text-xs transition-all ${
                                isOwnStationItem && !isPackingStation
                                  ? 'bg-[#381816] border-[#E5A330]/60'
                                  : 'bg-[#2D1412] border-[#454024]'
                              }`}
                            >
                              <div className="pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-[#E5A330] font-mono">{item.quantity}x</span>
                                  <span className="font-bold text-white uppercase">{item.name}</span>
                                  {isOwnStationItem && !isPackingStation && (
                                    <span className="text-[8px] font-tech font-extrabold bg-[#E5A330] text-[#3F1C1A] px-1.5 py-0.2 rounded">
                                      THIS STATION
                                    </span>
                                  )}
                                  {item.status === 'recalled' && (
                                    <span className="text-[8px] font-tech bg-rose-500/20 border border-rose-500/40 text-rose-400 px-1.5 py-0.2 rounded font-bold shrink-0">
                                      RECALLED
                                    </span>
                                  )}
                                </div>
                                {item.modifiers && item.modifiers.length > 0 && (
                                  <div className="text-[10px] text-amber-300/80 font-mono mt-0.5">
                                    + {item.modifiers.join(', ')}
                                  </div>
                                )}
                                <span className="text-[9px] text-stone-400 font-tech uppercase block mt-0.5">
                                  {itemStation?.name || 'Kitchen'}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {/* Reprint Label Button (Rendered only when Label Printing is ON and for own station items or Packing Pass) */}
                                {isStationLabelPrintingEnabled && (isPackingStation || isOwnStationItem) && (
                                  <button
                                    id={`btn-reprint-label-${order.id}-${item.id}`}
                                    onClick={() => {
                                      onManualReprint?.(order.id, item.id, station.id);
                                      showToast(`Reprinted label for ${item.name}`);
                                    }}
                                    title="Reprint Item Label without recall"
                                    className="p-1.5 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700 text-indigo-200 rounded-md text-[10px] font-tech font-bold flex items-center gap-1 cursor-pointer transition-all"
                                  >
                                    <Printer className="h-3 w-3" />
                                    <span className="hidden sm:inline">LABEL</span>
                                  </button>
                                )}

                                {/* Recall Single Item (Own Station OR Packing & Pass) */}
                                {canRecallThisItem ? (
                                  <button
                                    id={`btn-recall-item-${order.id}-${item.id}`}
                                    onClick={() => {
                                      onItemRecall?.(order.id, item.id);
                                      showToast(`Item "${item.name}" recalled for remake at ${itemStation?.name || 'station'}!`);
                                      setShowHistoryModal(false);
                                    }}
                                    title={`Recall ${item.name} for remake`}
                                    className="p-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-700 text-rose-200 rounded-md text-[10px] font-tech font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                  >
                                    <Undo className="h-3 w-3" />
                                    <span className="hidden sm:inline">RECALL</span>
                                  </button>
                                ) : (
                                  <span 
                                    className="px-2 py-1 bg-stone-900/80 border border-stone-800 text-stone-500 rounded text-[9px] font-tech font-bold uppercase"
                                    title={`Item routed to ${itemStation?.name || 'other station'}. Recall is only allowed at that station or Packing & Pass.`}
                                  >
                                    {itemStation?.name ? `${itemStation.name.replace(' Station', '')} ONLY` : 'OTHER STATION'}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {order.notes && (
                        <div className="text-[10px] font-mono bg-amber-950/40 border border-amber-900/60 text-amber-300 px-3 py-1.5 rounded-lg flex items-center gap-2">
                          <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                          <span>* {order.notes}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-[#454024] mt-4 flex justify-between items-center text-xs font-mono text-[#EDD7A1]/60">
              <span>Showing {filteredHistoryOrders.length} of {completedOrders.length} completed orders</span>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-[#3F1C1A] hover:bg-[#454024] text-[#EDD7A1] rounded-xl font-tech font-bold cursor-pointer"
              >
                CLOSE HISTORY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Management Modal overlay */}
      {showStockModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#3F1C1A] text-[#EDD7A1] border-2 border-[#454024] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowStockModal(false)}
              className="absolute top-4 right-4 text-[#EDD7A1]/60 hover:text-[#EDD7A1] p-1 rounded-lg hover:bg-[#454024]"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <PackageX className="h-6 w-6 text-[#E5A330]" />
              <h2 className="text-lg font-black uppercase text-[#EDD7A1] tracking-wide">
                Out of Stock
              </h2>
            </div>
            <p className="text-xs text-[#EDD7A1]/70 mb-4 font-mono">
              Toggle items out of stock directly from the kitchen screen. Unavailable items will be greyed out in POS.
            </p>

            <div className="relative mb-4">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-[#E5A330]" />
              <input
                type="text"
                placeholder="Search menu items..."
                value={stockSearchQuery}
                onChange={e => setStockSearchQuery(e.target.value)}
                className="w-full bg-[#2D1412] border border-[#454024] rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-[#EDD7A1] focus:outline-none focus:border-[#E5A330]"
              />
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {menuItems
                .filter(i => isPackingStation || i.stationId === station.id) // each station: only its own items; Packing & Pass: all
                .filter(i => i.name.toLowerCase().includes(stockSearchQuery.toLowerCase()) || i.category.toLowerCase().includes(stockSearchQuery.toLowerCase()))
                .map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      item.inStock
                        ? 'bg-[#2D1412] border-[#454024]'
                        : 'bg-rose-950/40 border-rose-800'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-xs text-[#EDD7A1] block">{item.name}</span>
                      <span className="text-[10px] text-[#E5A330] font-mono">{item.category} • ${item.price.toFixed(2)}</span>
                    </div>

                    <button
                      id={`btn-kds-toggle-stock-${item.id}`}
                      onClick={() => onToggleStock && onToggleStock(item.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 ${
                        item.inStock
                          ? 'bg-rose-950/80 text-rose-300 border border-rose-800 hover:bg-rose-900'
                          : 'bg-emerald-600 text-white border border-emerald-500 hover:bg-emerald-500'
                      }`}
                    >
                      {item.inStock ? (
                        <>
                          <PackageX className="h-3.5 w-3.5 text-rose-400" /> MARK OUT OF STOCK
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-200" /> RESTORE IN STOCK
                        </>
                      )}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. All-Day Prep Aggregate Counts (Station Cook's Surface) */}
      {activeOrders.length > 0 && allDayCounts.length > 0 && (
        <div className={`border rounded-xl p-4 transition-colors ${
          kdsTheme === 'dark' 
            ? 'bg-stone-900 border-stone-800' 
            : 'bg-stone-50 border-stone-200'
        }`} id="all-day-counts-panel">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[10px] font-tech font-black uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              All-Day Cook Batching Totals (Aggregate prep)
            </h3>
            <span className="text-[9px] font-mono font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded uppercase">
              Live Aggregate
            </span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {allDayCounts.map((item) => (
              <div 
                key={item.id} 
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border font-tech text-xs font-black transition-all shadow-xs ${
                  kdsTheme === 'dark'
                    ? 'bg-stone-950 border-stone-800 text-white'
                    : 'bg-white border-stone-250 text-stone-900'
                }`}
              >
                <span className="text-sm text-brand-orange font-black font-display leading-none">
                  {item.qty}x
                </span>
                <span className="uppercase tracking-wide">
                  {item.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Grid of Active Tickets */}
      {activeOrders.length === 0 ? (
        <div className={`border border-dashed rounded-xl p-12 text-center flex flex-col items-center justify-center transition-colors ${
          kdsTheme === 'dark' ? 'bg-stone-900/30 border-stone-800' : 'bg-stone-50 border-stone-200'
        }`}>
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3 shadow-sm">
            <Check className="h-5 w-5 text-emerald-400" />
          </div>
          <h3 className="text-sm font-tech font-bold text-emerald-400 uppercase tracking-wider">ALL DISPATCHED</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-xs font-medium">
            New orders from Square POS will stream here instantly.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {activeOrders.map((order) => {
              const ticketHeaderColor = getTicketHeaderColor(order.createdAt, kdsTheme === 'dark');
              const elapsedMins = getDurationMinutes(order.createdAt);
              
              // Items this screen draws: all of them, or only its own when the option is Off
              const visibleItems = showOtherStationItems ? order.items : order.items.filter(i => i.stationId === station.id);

              // Group order items by stationId
              const stationGroups: { station: KDSStation; items: OrderItem[] }[] = [];
              const groupMap = new Map<string, OrderItem[]>();

              visibleItems.forEach((item) => {
                if (!groupMap.has(item.stationId)) {
                  groupMap.set(item.stationId, []);
                }
                groupMap.get(item.stationId)!.push(item);
              });

              // Maintain ordered station grouping with CURRENT STATION AT THE TOP
              allStations.forEach((st) => {
                if (groupMap.has(st.id)) {
                  stationGroups.push({ station: st, items: groupMap.get(st.id)! });
                }
              });

              groupMap.forEach((items, stId) => {
                if (!stationGroups.some((g) => g.station.id === stId)) {
                  const fallbackStation: KDSStation = {
                    id: stId,
                    name: 'Kitchen Station',
                    color: 'red',
                    printerId: '',
                  };
                  stationGroups.push({ station: fallbackStation, items });
                }
              });

              // SORT current station's category TO THE TOP
              stationGroups.sort((a, b) => {
                if (a.station.id === station.id) return -1;
                if (b.station.id === station.id) return 1;
                return 0;
              });

              const hasMyStationItems = isPackingStation || order.items.some(i => i.stationId === station.id);
              const isFadedEmpty = !hasMyStationItems && config?.fadeEmptyStationOrders !== false;
              const isCollapsed = Boolean(isFadedEmpty && collapsedEmptyOrders[order.id]);
              const orderPendingBumps = pendingBumps.filter(pb => pb.orderId === order.id);

              return (
                <motion.div
                  id={`kds-ticket-${order.id}`}
                  key={order.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  className={`border ${getTicketBorderColor(order.createdAt, kdsTheme === 'dark')} rounded-xl overflow-hidden flex flex-col justify-between transition-all ${
                    isFadedEmpty
                      ? 'opacity-40 hover:opacity-95 saturate-50 scale-[0.98] border-dashed bg-stone-950/40 shadow-none'
                      : ''
                  }`}
                  style={{ minHeight: isCollapsed ? 'auto' : '320px' }}
                >
                  <div>
                    {/* Ticket Header */}
                    <div className={`p-3 border-b flex justify-between items-center transition-colors ${ticketHeaderColor}`}>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-display font-extrabold text-lg tracking-wider text-white bg-stone-950 px-2 py-0.5 rounded-md border border-stone-850">
                            {order.id}
                          </h3>
                          <span className={`text-[9px] font-tech font-bold uppercase px-1.5 py-0.5 rounded border ${
                            kdsTheme === 'dark' ? 'bg-stone-900 border-stone-800 text-stone-400' : 'bg-white border-stone-200 text-stone-500'
                          }`}>
                            {order.source}
                          </span>
                          {!hasMyStationItems && (
                            <span className="text-[8px] font-tech font-extrabold uppercase px-1.5 py-0.5 rounded border bg-amber-950/70 border-amber-700 text-amber-300">
                              0 THIS STATION
                            </span>
                          )}
                        </div>
                        <p className={`text-xs font-tech font-bold mt-1 uppercase tracking-wide ${kdsTheme === 'dark' ? 'text-stone-200' : 'text-stone-800'}`}>
                          {order.customerName}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getTicketStatusBadge(order.createdAt, kdsTheme === 'dark')}`}>
                          <Clock className="h-3 w-3 inline mr-1 -mt-0.5" /> {elapsedMins}m
                        </span>
                        <p className="text-[9px] font-mono text-stone-500 mt-1">{formatTime(order.createdAt)}</p>
                      </div>
                    </div>

                    {/* Pending Bump Alert Ribbon if active on this ticket */}
                    {orderPendingBumps.length > 0 && (
                      <div className="mx-3 mt-2 p-2 bg-[#E5A330]/20 border border-[#E5A330] rounded-lg flex items-center justify-between text-xs animate-pulse">
                        <div className="flex items-center gap-1.5 text-[#E5A330] font-tech font-black">
                          <Timer className="h-4 w-4" />
                          <span>BUMP PENDING ({orderPendingBumps[0].secondsRemaining}s)</span>
                        </div>
                        <button
                          id={`btn-undo-bump-inline-${order.id}`}
                          onClick={() => {
                            onUndoBump?.(orderPendingBumps[0].id);
                            showToast(`Bump cancelled!`);
                          }}
                          className="px-2.5 py-1 bg-[#E5A330] hover:bg-[#d69320] text-[#3F1C1A] text-[10px] font-tech font-black rounded cursor-pointer uppercase"
                        >
                          UNDO ({orderPendingBumps[0].secondsRemaining}s)
                        </button>
                      </div>
                    )}

                    {/* Table/Delivery Location */}
                    <div className={`px-3.5 py-2 border-b flex justify-between items-center text-xs font-mono transition-colors ${
                      kdsTheme === 'dark' ? 'bg-stone-900/40 border-stone-900 text-stone-300' : 'bg-stone-50 border-stone-100 text-stone-600'
                    }`}>
                      <span className="text-stone-500 font-bold text-[9px] tracking-wider font-tech">LOCATION</span>
                      <span className="text-orange-500 font-display font-bold text-sm tracking-wide">{order.tableNumber || 'Takeaway'}</span>
                    </div>

                    {/* Empty Station Info Bar with Collapse/Expand Toggle */}
                    {!hasMyStationItems && (
                      <div className="p-2.5 bg-stone-900/80 border-b border-stone-800 flex items-center justify-between text-xs">
                        <span className="text-[10px] font-tech font-bold text-stone-400">
                          {order.items.length} items routed to other kitchen stations
                        </span>
                        <button
                          onClick={() => toggleOrderCollapse(order.id)}
                          className="px-2 py-0.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded text-[9px] font-tech font-bold cursor-pointer uppercase"
                        >
                          {isCollapsed ? 'Show Items' : 'Compact'}
                        </button>
                      </div>
                    )}

                    {/* Ticket Items Grouped by Station / Category or Combo */}
                    {!isCollapsed && (
                    <div className="p-3 space-y-4">
                      {order.comboName ? (
                        /* IF COMBO ORDER: DISPLAY COMBO NAME HEADING & ALL ITEMS IN A SINGLE CARD */
                        <div className="space-y-2">
                          {/* PROMINENT COMBO HEADER BAR */}
                          <div className="p-3 rounded-xl bg-gradient-to-r from-[#E5A330] via-[#d69320] to-[#E5A330] text-[#3F1C1A] border border-[#E5A330] flex justify-between items-center shadow-md">
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-5 w-5 shrink-0" />
                              <div>
                                <span className="text-[9px] font-mono font-black uppercase tracking-widest text-[#3F1C1A]/80 block leading-tight">
                                  COMBO MEAL PACKAGE
                                </span>
                                <h4 className="text-base font-tech font-black tracking-wide leading-tight">
                                  {order.comboName}
                                </h4>
                              </div>
                            </div>
                            <span className="text-xs font-mono font-black bg-[#3F1C1A] text-[#EDD7A1] px-2.5 py-1 rounded-lg shadow-xs">
                              {order.items.length} ITEMS
                            </span>
                          </div>

                          {/* SINGLE CARD CONTAINER FOR ALL COMBO ITEMS (Sorted so current station items are at the top) */}
                          <div className={`p-3 rounded-xl border space-y-2.5 transition-colors ${
                            kdsTheme === 'dark' 
                              ? 'bg-[#1C1716] border-[#E5A330]/50 shadow-md' 
                              : 'bg-amber-50/60 border-amber-200 shadow-sm'
                          }`}>
                            {[...visibleItems]
                              .sort((a, b) => {
                                if (a.stationId === station.id) return -1;
                                if (b.stationId === station.id) return 1;
                                return 0;
                              })
                              .map((item) => {
                              const itemStation = allStations.find(s => s.id === item.stationId);
                              const stationName = itemStation?.name || 'Kitchen Station';
                              const bannerProps = getStationBannerProps(item.stationId, stationName, itemStation?.color || '');
                              const isPrepCompleted = item.completedQuantity === item.quantity;
                              const isPackedCompleted = item.packedQuantity === item.quantity;
                              const isRecalled = item.status === 'recalled';
                              const isMyStationItem = item.stationId === station.id;
                              const readyToPackQty = item.completedQuantity - item.packedQuantity;

                              return (
                                <div
                                  key={item.id}
                                  className={`p-3 rounded-lg border transition-all ${
                                    !isMyStationItem && !isPackingStation
                                      ? 'opacity-75 bg-[#171312] border-stone-800'
                                      : isPackedCompleted || (isPrepCompleted && !isPackingStation)
                                      ? kdsTheme === 'dark'
                                        ? 'bg-emerald-950/20 border-emerald-900/40'
                                        : 'bg-emerald-50/50 border-emerald-200/60'
                                      : isRecalled
                                      ? 'bg-rose-950/30 border-rose-800 animate-pulse'
                                      : kdsTheme === 'dark'
                                      ? 'bg-[#2A2220] border-[#3D3330]'
                                      : 'bg-white border-stone-200'
                                  }`}
                                >
                                  {/* Station indicator tag above item name inside combo card */}
                                  <div className="flex justify-between items-center mb-1.5">
                                    <span className={`text-[11px] font-tech font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md border flex items-center gap-1.5 ${bannerProps.badgeClass}`}>
                                      <span>{stationName}</span>
                                    </span>
                                    {isMyStationItem && !isPackingStation ? (
                                      <span className="text-[9px] font-tech font-black uppercase bg-[#E5A330] text-[#3F1C1A] px-2 py-0.5 rounded shadow-xs">
                                        ★ THIS STATION
                                      </span>
                                    ) : !isPackingStation && (
                                      <span className="text-[9px] font-tech font-bold uppercase text-stone-500">
                                        OTHER STATION
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                                    {/* Item Details */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-base font-tech font-black text-[#E5A330] shrink-0">
                                          {item.quantity}x
                                        </span>
                                        <span className={`text-sm font-tech font-extrabold truncate ${
                                          kdsTheme === 'dark' ? 'text-stone-100' : 'text-stone-900'
                                        }`}>
                                          {item.name}
                                        </span>
                                        {isRecalled && (
                                          <span className="text-[8px] font-tech bg-rose-500/20 border border-rose-500/40 text-rose-400 px-1.5 py-0.2 rounded font-bold shrink-0">
                                            RECALLED
                                          </span>
                                        )}
                                      </div>

                                      {/* Modifiers — additions first, removals second, allergies last */}
                                      {item.modifiers && item.modifiers.length > 0 && (
                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                          {sortModifiersForDisplay(item.modifiers).map((mod, i) => (
                                            <span
                                              key={i}
                                              className={`text-[10px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded border whitespace-normal break-words leading-tight ${modifierBadgeClass(mod, kdsTheme)}`}
                                            >
                                              {mod}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    {/* Bump Button / Status */}
                                    <div className="shrink-0 flex items-center justify-end sm:min-w-[150px]">
                                      {!isPackingStation ? (
                                        isMyStationItem ? (
                                          !isPrepCompleted ? (
                                            <button
                                              id={`btn-bump-${order.id}-${item.id}`}
                                              onClick={() => onItemBump(order.id, item.id)}
                                              className="w-full sm:w-auto px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 text-white font-tech text-xs font-black rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 uppercase tracking-wider"
                                            >
                                              <Check className="h-4 w-4 stroke-[3]" />
                                              {item.quantity > 1
                                                ? `BUMP ONE · ${item.completedQuantity} OF ${item.quantity} DONE`
                                                : `BUMP`}
                                            </button>
                                          ) : (
                                            <span className="text-[10px] font-tech font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 uppercase tracking-wider">
                                              <Check className="h-3 w-3" /> PREPARED ({item.completedQuantity}/{item.quantity})
                                            </span>
                                          )
                                        ) : (
                                          isPrepCompleted ? (
                                            <span className="text-[10px] font-tech font-bold text-emerald-400/80 bg-emerald-500/5 border border-emerald-500/10 px-2 py-1 rounded-lg inline-flex items-center gap-1 uppercase tracking-wider">
                                              <Check className="h-3 w-3" /> PREPARED ({item.completedQuantity}/{item.quantity})
                                            </span>
                                          ) : (
                                            <span className="text-[10px] font-tech font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg inline-flex items-center gap-1 animate-pulse uppercase tracking-wider">
                                              <Clock className="h-3 w-3" /> COOKING ({item.completedQuantity}/{item.quantity})
                                            </span>
                                          )
                                        )
                                      ) : (
                                        readyToPackQty > 0 ? (
                                          <button
                                            id={`btn-pack-bump-${order.id}-${item.id}`}
                                            onClick={() => onPackingItemBump?.(order.id, item.id)}
                                            className="w-full sm:w-auto px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 text-white font-tech text-xs font-black rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 uppercase tracking-wider"
                                          >
                                            <Check className="h-4 w-4 stroke-[3]" />
                                            {item.quantity > 1
                                              ? `PACK ONE · ${item.packedQuantity} OF ${item.quantity} DONE`
                                              : `PACK ITEM`}
                                          </button>
                                        ) : isPackedCompleted ? (
                                          <span className="text-[10px] font-tech font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 uppercase tracking-wider">
                                            <Check className="h-3 w-3" /> PACKED ({item.packedQuantity}/{item.quantity})
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-tech font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg inline-flex items-center gap-1 animate-pulse uppercase tracking-wider">
                                            <Clock className="h-3 w-3" /> WAITING PREP ({item.completedQuantity}/{item.quantity})
                                          </span>
                                        )
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        /* REGULAR NON-COMBO ORDERS: GROUPED BY STATION / CATEGORY */
                        stationGroups.map(({ station: groupStation, items: groupItems }) => {
                          const isCurrentStation = groupStation.id === station.id;
                          const bannerProps = getStationBannerProps(groupStation.id, groupStation.name, groupStation.color);

                          return (
                            <div key={groupStation.id} className="space-y-2">
                              {/* ENHANCED PROMINENT STATION / CATEGORY HEADER OUTSIDE THE CARD */}
                              <div className="flex justify-between items-center px-0.5">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs sm:text-sm font-tech font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border-2 shadow-sm flex items-center gap-2 ${bannerProps.badgeClass}`}>
                                    <span>{groupStation.name}</span>
                                  </span>
                                  {isCurrentStation && !isPackingStation && (
                                    <span className="text-[10px] font-tech font-black uppercase bg-[#E5A330] text-[#3F1C1A] px-2.5 py-1 rounded-lg shadow-sm border border-[#E5A330]">
                                      ★ THIS STATION
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs font-mono font-extrabold text-stone-300 bg-stone-900/80 px-2.5 py-1 rounded-lg border border-stone-800 shadow-xs">
                                  {groupItems.length} {groupItems.length === 1 ? 'item' : 'items'}
                                </span>
                              </div>

                              {/* ONE SINGLE CARD CONTAINER FOR ALL ITEMS OF THIS CATEGORY / STATION */}
                              <div className={`p-3 rounded-xl border space-y-2 transition-colors ${
                                kdsTheme === 'dark' 
                                  ? 'bg-[#1C1716] border-[#3D3330] shadow-sm' 
                                  : 'bg-stone-50/80 border-stone-200 shadow-xs'
                              }`}>
                                {groupItems.map((item) => {
                                  const isPrepCompleted = item.completedQuantity === item.quantity;
                                  const isPackedCompleted = item.packedQuantity === item.quantity;
                                  const isRecalled = item.status === 'recalled';
                                  const isMyStationItem = item.stationId === station.id;
                                  const readyToPackQty = item.completedQuantity - item.packedQuantity;

                                  return (
                                    <div
                                      key={item.id}
                                      className={`p-3 rounded-lg border transition-all ${
                                        !isMyStationItem && !isPackingStation
                                          ? 'opacity-75 bg-[#171312] border-stone-800'
                                          : isPackedCompleted || (isPrepCompleted && !isPackingStation)
                                          ? kdsTheme === 'dark'
                                            ? 'bg-emerald-950/20 border-emerald-900/40'
                                            : 'bg-emerald-50/50 border-emerald-200/60'
                                          : isRecalled
                                          ? 'bg-rose-950/30 border-rose-800 animate-pulse'
                                          : kdsTheme === 'dark'
                                          ? 'bg-[#2A2220] border-[#3D3330]'
                                          : 'bg-white border-stone-200'
                                      }`}
                                    >
                                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                                        {/* Item Info: Quantity, Title & Modifiers */}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="text-base font-tech font-black text-[#E5A330] shrink-0">
                                              {item.quantity}x
                                            </span>
                                            <span className={`text-sm font-tech font-extrabold truncate ${
                                              kdsTheme === 'dark' ? 'text-stone-100' : 'text-stone-900'
                                            }`}>
                                              {item.name}
                                            </span>
                                            {isRecalled && (
                                              <span className="text-[8px] font-tech bg-rose-500/20 border border-rose-500/40 text-rose-400 px-1.5 py-0.2 rounded font-bold shrink-0">
                                                RECALLED
                                              </span>
                                            )}
                                          </div>

                                          {/* Modifiers — additions first, removals second, allergies last */}
                                          {item.modifiers && item.modifiers.length > 0 && (
                                            <div className="mt-1.5 flex flex-wrap gap-1">
                                              {sortModifiersForDisplay(item.modifiers).map((mod, i) => (
                                                <span
                                                  key={i}
                                                  className={`text-[10px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded border whitespace-normal break-words leading-tight ${modifierBadgeClass(mod, kdsTheme)}`}
                                                >
                                                  {mod}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>

                                        {/* Bump Button or Status in front / below */}
                                        <div className="shrink-0 flex items-center justify-end sm:min-w-[150px]">
                                          {!isPackingStation ? (
                                            /* KITCHEN PREP STATIONS */
                                            isMyStationItem ? (
                                              !isPrepCompleted ? (
                                                <button
                                                  id={`btn-bump-${order.id}-${item.id}`}
                                                  onClick={() => onItemBump(order.id, item.id)}
                                                  className="w-full sm:w-auto px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 text-white font-tech text-xs font-black rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 uppercase tracking-wider"
                                                >
                                                  <Check className="h-4 w-4 stroke-[3]" />
                                                  {item.quantity > 1
                                                    ? `BUMP ONE · ${item.completedQuantity} OF ${item.quantity} DONE`
                                                    : `BUMP`}
                                                </button>
                                              ) : (
                                                <span className="text-[10px] font-tech font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 uppercase tracking-wider">
                                                  <Check className="h-3 w-3" /> PREPARED ({item.completedQuantity}/{item.quantity})
                                                </span>
                                              )
                                            ) : (
                                              isPrepCompleted ? (
                                                <span className="text-[10px] font-tech font-bold text-emerald-400/80 bg-emerald-500/5 border border-emerald-500/10 px-2 py-1 rounded-lg inline-flex items-center gap-1 uppercase tracking-wider">
                                                  <Check className="h-3 w-3" /> PREPARED ({item.completedQuantity}/{item.quantity})
                                                </span>
                                              ) : (
                                                <span className="text-[10px] font-tech font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg inline-flex items-center gap-1 animate-pulse uppercase tracking-wider">
                                                  <Clock className="h-3 w-3" /> COOKING ({item.completedQuantity}/{item.quantity})
                                                </span>
                                              )
                                            )
                                          ) : (
                                            /* PACKING STATION */
                                            readyToPackQty > 0 ? (
                                              <button
                                                id={`btn-pack-bump-${order.id}-${item.id}`}
                                                onClick={() => onPackingItemBump?.(order.id, item.id)}
                                                className="w-full sm:w-auto px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 text-white font-tech text-xs font-black rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 uppercase tracking-wider"
                                              >
                                                <Check className="h-4 w-4 stroke-[3]" />
                                                {item.quantity > 1
                                                  ? `PACK ONE · ${item.packedQuantity} OF ${item.quantity} DONE`
                                                  : `PACK ITEM`}
                                              </button>
                                            ) : isPackedCompleted ? (
                                              <span className="text-[10px] font-tech font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 uppercase tracking-wider">
                                                <Check className="h-3 w-3" /> PACKED ({item.packedQuantity}/{item.quantity})
                                              </span>
                                            ) : (
                                              <span className="text-[10px] font-tech font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg inline-flex items-center gap-1 animate-pulse uppercase tracking-wider">
                                                <Clock className="h-3 w-3" /> WAITING PREP ({item.completedQuantity}/{item.quantity})
                                              </span>
                                            )
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    )}

                    {/* Customer order notes */}
                    {order.notes && (
                      <div className={`mx-3.5 mb-3.5 p-2 border rounded-lg text-[10px] italic font-mono flex items-start gap-1 transition-colors ${
                        kdsTheme === 'dark' ? 'bg-amber-950/20 border-amber-900/40 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}>
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>* {order.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Ticket Footer action */}
                  <div className={`p-3 border-t rounded-b-xl flex justify-between items-center transition-colors ${
                    kdsTheme === 'dark' ? 'bg-stone-900 border-stone-850/60' : 'bg-stone-50 border-stone-100'
                  }`}>
                    <span className="text-[9px] font-mono text-stone-500 font-bold uppercase">
                      SQL INGESTED
                    </span>

                    {/* Packing Station Status / Auto-Receipt Indicator */}
                    {isPackingStation ? (
                      <span className="text-[10px] font-tech font-extrabold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                        {isStationLabelPrintingEnabled && <Printer className="h-3 w-3" />}
                        {isStationLabelPrintingEnabled
                          ? `AUTO-RECEIPT ON FULL BUMP (${order.items.reduce((acc, i) => acc + i.packedQuantity, 0)}/${order.items.reduce((acc, i) => acc + i.quantity, 0)})`
                          : `PACKING QUEUE (${order.items.reduce((acc, i) => acc + i.packedQuantity, 0)}/${order.items.reduce((acc, i) => acc + i.quantity, 0)})`}
                      </span>
                    ) : (
                      <span className="text-[10px] font-tech font-bold">
                        {order.items.every(i => i.completedQuantity === i.quantity) ? (
                          <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider text-[9px]">● ALL PREPARED</span>
                        ) : (
                          <span className="text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider text-[9px] animate-pulse">● COOKING</span>
                        )}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

