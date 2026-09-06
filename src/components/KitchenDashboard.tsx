import React from 'react';
import { 
  Clock, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  Flame, 
  Utensils, 
  Gauge, 
  Zap, 
  Activity, 
  RotateCw,
  Printer,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  LineChart, 
  Line, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell,
  Legend 
} from 'recharts';
import { Order, KDSStation, MenuItem } from '../types';

interface KitchenDashboardProps {
  orders: Order[];
  stations: KDSStation[];
  menuItems: MenuItem[];
  onSimulateRush: () => void;
  isOffline: boolean;
  currentUserRole: string;
}

export const KitchenDashboard: React.FC<KitchenDashboardProps> = ({
  orders,
  stations,
  menuItems,
  onSimulateRush,
  isOffline,
  currentUserRole
}) => {
  // 1. DASHBOARD PREFERENCES & INTERACTIVE STATE
  const [dashboardTheme, setDashboardTheme] = React.useState<'dark' | 'light'>('dark');
  const [selectedStationId, setSelectedStationId] = React.useState<string>('all');
  const [activeKpiFilter, setActiveKpiFilter] = React.useState<'all' | 'delayed' | 'completed' | 'active'>('all');

  // 2. DYNAMIC CALCULATIONS & METRICS
  const activeOrders = orders.filter(o => o.status !== 'completed');
  const completedOrders = orders.filter(o => o.status === 'completed');
  const totalOrdersCount = orders.length;

  // Calculate dynamic average preparation latency (in minutes)
  const averagePrepTimeMinutes = React.useMemo(() => {
    if (completedOrders.length === 0) return 10.4;
    
    let totalMinutes = 0;
    completedOrders.forEach(order => {
      const created = new Date(order.createdAt).getTime();
      const completed = order.completedAt ? new Date(order.completedAt).getTime() : created;
      totalMinutes += (completed - created) / 60000;
    });
    
    const avg = totalMinutes / completedOrders.length;
    return avg > 0 ? parseFloat(avg.toFixed(1)) : 10.4;
  }, [completedOrders]);

  // SLA Warning Count: Orders active for more than 10 minutes
  const slaWarningCount = React.useMemo(() => {
    const now = new Date().getTime();
    return activeOrders.filter(order => {
      const elapsedMs = now - new Date(order.createdAt).getTime();
      return (elapsedMs / 60000) >= 10;
    }).length;
  }, [activeOrders]);

  // Fulfillment rate today
  const fulfillmentRate = React.useMemo(() => {
    if (totalOrdersCount === 0) return 0;
    return Math.round((completedOrders.length / totalOrdersCount) * 100);
  }, [completedOrders.length, totalOrdersCount]);

  // Filter orders based on activeKPI
  const filteredOrdersList = React.useMemo(() => {
    let list = orders;
    
    // Station filter
    if (selectedStationId !== 'all') {
      list = list.filter(o => o.items.some(i => i.stationId === selectedStationId));
    }
    
    // KPI filter
    if (activeKpiFilter === 'delayed') {
      const now = new Date().getTime();
      list = list.filter(o => o.status !== 'completed' && ((now - new Date(o.createdAt).getTime()) / 60000) >= 10);
    } else if (activeKpiFilter === 'completed') {
      list = list.filter(o => o.status === 'completed');
    } else if (activeKpiFilter === 'active') {
      list = list.filter(o => o.status !== 'completed');
    }
    
    return list;
  }, [orders, selectedStationId, activeKpiFilter]);

  // 3. STATION WORKLOAD DATA (for Bar Chart)
  const stationWorkloadData = React.useMemo(() => {
    return stations.map(station => {
      let activeItemsCount = 0;
      let completedItemsCount = 0;

      orders.forEach(order => {
        order.items.forEach(item => {
          if (item.stationId === station.id) {
            const activeQty = item.quantity - item.completedQuantity;
            activeItemsCount += activeQty;
            completedItemsCount += item.completedQuantity;
          }
        });
      });

      return {
        id: station.id,
        name: station.name.replace(' Station', ''),
        'Active (Prep)': activeItemsCount,
        'Completed (Bumped)': completedItemsCount,
      };
    });
  }, [orders, stations]);

  // 4. ITEM CATEGORY BREAKDOWN (for Pie Chart)
  const categorySplitData = React.useMemo(() => {
    // FIX: previously compared against 'pizza'/'kitchen'/'drinks'/'desserts' —
    // stale category names from an earlier demo menu that no real Sufra menu
    // item ever has, so this chart always fell through to fake hardcoded
    // numbers regardless of actual order data. Grouped into sensible buckets
    // from the real categories in data.ts.
    const counts: Record<string, number> = {
      'Grill': 0,
      'Mains & Mezze': 0,
      'Drinks': 0,
      'Desserts': 0,
    };

    orders.forEach(order => {
      order.items.forEach(item => {
        const menuItem = menuItems.find(i => i.id === item.menuItemId);
        if (menuItem) {
          const cat = menuItem.category;
          if (cat === 'From Our Grill') counts['Grill'] += item.quantity;
          else if (cat === 'Mains' || cat === 'Hot Mezze' || cat === 'Cold Mezze' || cat === 'Salads & Dips') counts['Mains & Mezze'] += item.quantity;
          else if (cat === 'Coffee & Hot Drinks' || cat === 'Cold Drinks') counts['Drinks'] += item.quantity;
          else if (cat === 'Pancakes & French Toast') counts['Desserts'] += item.quantity;
        }
      });
    });

    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [orders, menuItems]);

  const COLORS = ['#E5A330', '#3F1C1A', '#426998', '#454024']; // Sufra Lebanese & Afghan Kitchen Brand Palette

  // 5. STATIONS DRILLDOWN LIST
  const stationPerformanceSummary = React.useMemo(() => {
    return stations.map(station => {
      let totalTime = 0;
      let count = 0;
      let activeLines = 0;

      orders.forEach(order => {
        order.items.forEach(item => {
          if (item.stationId === station.id) {
            if (item.status === 'completed' && item.lastBumpedAt) {
              const elapsed = (new Date(item.lastBumpedAt).getTime() - new Date(order.createdAt).getTime()) / 60000;
              totalTime += elapsed;
              count++;
            } else if (item.status !== 'completed') {
              activeLines++;
            }
          }
        });
      });

      const avgTime = count > 0 ? parseFloat((totalTime / count).toFixed(1)) : 8.5;

      return {
        ...station,
        avgTime,
        activeLines,
        completedCount: count,
        status: activeLines > 4 ? 'high-load' : activeLines > 1 ? 'active' : 'idle'
      };
    });
  }, [orders, stations]);

  // Selected Station Details (drilldown dashboard widget)
  const currentSelectedStationInfo = React.useMemo(() => {
    if (selectedStationId === 'all') return null;
    return stationPerformanceSummary.find(s => s.id === selectedStationId) || null;
  }, [selectedStationId, stationPerformanceSummary]);

  // Items currently pending at selected station
  const selectedStationPendingItems = React.useMemo(() => {
    if (selectedStationId === 'all') return [];
    
    const itemMap: Record<string, { name: string; quantity: number; modifiers: string[] }> = {};
    activeOrders.forEach(o => {
      o.items.forEach(itm => {
        if (itm.stationId === selectedStationId && itm.status !== 'completed') {
          const qtyLeft = itm.quantity - itm.completedQuantity;
          if (qtyLeft > 0) {
            if (!itemMap[itm.menuItemId]) {
              itemMap[itm.menuItemId] = { name: itm.name, quantity: 0, modifiers: [] };
            }
            itemMap[itm.menuItemId].quantity += qtyLeft;
            if (itm.modifiers) {
              itemMap[itm.menuItemId].modifiers.push(...itm.modifiers);
            }
          }
        }
      });
    });
    
    return Object.values(itemMap).sort((a, b) => b.quantity - a.quantity);
  }, [activeOrders, selectedStationId]);

  // Beautiful synthetic data for the continuous area charts
  const hourlyTicketData = React.useMemo(() => {
    return [
      { hour: '11 AM', tickets: 3, latency: 6.5, activeTickets: 2 },
      { hour: '12 PM', tickets: 12, latency: 12.2, activeTickets: 8 },
      { hour: '1 PM', tickets: 8, latency: 11.0, activeTickets: 5 },
      { hour: '2 PM', tickets: 4, latency: 7.2, activeTickets: 3 },
      { hour: '3 PM', tickets: 2, latency: 5.8, activeTickets: 1 },
      { hour: '4 PM', tickets: 5, latency: 8.0, activeTickets: 4 },
      { hour: '5 PM', tickets: 14, latency: 13.5, activeTickets: 11 },
      { hour: '6 PM', tickets: 22, latency: 16.8, activeTickets: 18 },
      { hour: '7 PM', tickets: 18, latency: 14.2, activeTickets: 14 },
      { hour: '8 PM', tickets: 9, latency: 9.4, activeTickets: 6 },
    ];
  }, []);

  // 6. DYNAMIC AI/CO-PILOT RESTAURANT INSIGHT GENERATOR
  const copilotInsights = React.useMemo(() => {
    const list = [];
    
    // Check SLA delay status
    if (slaWarningCount > 0) {
      list.push({
        id: 'sla',
        type: 'critical',
        title: `${slaWarningCount} Tickets Exceeding SLA`,
        message: 'Cook times are currently bottlenecking. Consider re-allocating floaters or secondary chefs to ' + 
          (stationPerformanceSummary.find(s => s.status === 'high-load')?.name || 'primary stations') + '.',
        badge: 'Priority 1 Intervention'
      });
    }

    // Check offline status
    if (isOffline) {
      list.push({
        id: 'network',
        type: 'warning',
        title: 'Local Standalone Mode Active',
        message: 'No active WAN link detected. Local SQLite buffers are stable. Local POS tickets routing successfully without latency.',
        badge: 'Failover Active'
      });
    }

    // Load-based suggestions
    const busiestStation = [...stationPerformanceSummary].sort((a, b) => b.activeLines - a.activeLines)[0];
    if (busiestStation && busiestStation.activeLines > 2) {
      list.push({
        id: 'station-load',
        type: 'info',
        title: `High Load on ${busiestStation.name}`,
        message: `Currently handling ${busiestStation.activeLines} items. Prep times on this line may exceed standard 12m limit. Alert expeditor to double-check plate validation.`,
        badge: 'Line Load Heat'
      });
    }

    // General high efficiency suggestions
    if (fulfillmentRate > 85) {
      list.push({
        id: 'efficiency',
        type: 'success',
        title: 'Outstanding Fulfillment Rate today!',
        message: `Your team is completing ${fulfillmentRate}% of all orders within normal bounds. Average latency is holding strong at ${averagePrepTimeMinutes} minutes.`,
        badge: 'Peak Performance'
      });
    } else {
      list.push({
        id: 'efficiency-low',
        type: 'info',
        title: 'Targeting 90% Pass Rate',
        message: `Currently tracking at ${fulfillmentRate}%. Focus on expediting completed tickets to increase kitchen ticket velocity.`,
        badge: 'SLA Optimization'
      });
    }

    return list;
  }, [slaWarningCount, isOffline, stationPerformanceSummary, fulfillmentRate, averagePrepTimeMinutes]);

  // Class helper for theme switching
  const t = {
    bg: dashboardTheme === 'dark' ? 'bg-stone-950 text-stone-100' : 'bg-stone-50 text-stone-900',
    card: dashboardTheme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200',
    title: dashboardTheme === 'dark' ? 'text-white' : 'text-stone-900',
    subtitle: dashboardTheme === 'dark' ? 'text-stone-400' : 'text-stone-500',
    border: dashboardTheme === 'dark' ? 'border-stone-800' : 'border-stone-200',
    textMuted: dashboardTheme === 'dark' ? 'text-stone-500 font-bold' : 'text-stone-400 font-bold',
    badge: dashboardTheme === 'dark' ? 'bg-stone-800 text-stone-300' : 'bg-stone-100 text-stone-700',
    chartLabel: dashboardTheme === 'dark' ? '#a8a29e' : '#57534e',
    chartGrid: dashboardTheme === 'dark' ? '#292524' : '#e7e5e4',
  };

  return (
    <div className={`p-1 space-y-6 rounded-2xl transition-all ${t.bg}`} id="operations-dashboard-main">
      
      {/* HEADER CONTROL BLOCK */}
      <div className={`flex flex-col lg:flex-row justify-between items-start lg:items-center border p-6 rounded-2xl gap-4 shadow-md ${t.card}`}>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center justify-center p-2 bg-brand-orange/10 rounded-lg text-brand-orange">
              <Activity className="h-5 w-5 animate-pulse" />
            </span>
            <div>
              <h1 className="text-lg font-tech font-black uppercase tracking-wider leading-none flex items-center gap-2">
                Ops Analytics Control Desk
                <span className="text-[9px] font-mono font-black bg-brand-orange/20 text-brand-orange border border-brand-orange/20 px-2 py-0.5 rounded uppercase">
                  B2B Engine v4.2
                </span>
              </h1>
              <p className="text-xs text-stone-500 mt-1 font-medium">
                Live heat-map analytics, active preparation latency matrices, and bottleneck prediction diagnostics.
              </p>
            </div>
          </div>
        </div>

        {/* Action button triggers & Theme Swapper */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Dashboard Theme Switcher */}
          <button
            onClick={() => setDashboardTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            className={`px-3 py-2 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              dashboardTheme === 'dark'
                ? 'bg-stone-800 border-stone-700 text-amber-400 hover:bg-stone-750'
                : 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200'
            }`}
            title="Toggle Dashboard Theme"
          >
            {dashboardTheme === 'dark' ? (
              <>
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
                Theme: Deep Onyx
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 bg-stone-500 rounded-full" />
                Theme: Stone Clean
              </>
            )}
          </button>

          {/* Simulate Peak Rush */}
          <button
            id="btn-trigger-peak-rush-simulation"
            onClick={onSimulateRush}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-orange hover:bg-orange-600 text-white font-tech text-xs font-black rounded-lg cursor-pointer shadow-sm active:scale-95 transition-all uppercase tracking-wider"
          >
            <Flame className="h-4 w-4 animate-bounce" />
            Simulate Rush Hour (+5 Tickets)
          </button>
        </div>
      </div>

      {/* KPI HIGHLIGHT TILES (INTELLIGENT FILTERS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" id="dashboard-kpis-grid">
        
        {/* KPI 1: Speed Latency */}
        <button
          onClick={() => {
            setActiveKpiFilter(activeKpiFilter === 'all' ? 'all' : 'all');
            setSelectedStationId('all');
          }}
          className={`text-left p-5 border rounded-2xl flex items-center justify-between transition-all shadow-xs cursor-pointer active:scale-98 ${t.card} ${
            activeKpiFilter === 'all' && selectedStationId === 'all' ? 'ring-2 ring-brand-orange/60' : 'hover:scale-[1.01]'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-tech font-black uppercase text-stone-400 tracking-widest">
              Avg Cook Duration
            </span>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-tech font-black ${t.title}`}>
                {averagePrepTimeMinutes}m
              </span>
              <span className="text-[10px] font-mono font-bold text-emerald-500 flex items-center gap-0.5">
                <TrendingUp className="h-3 w-3" /> -1.2m
              </span>
            </div>
            <p className="text-[10px] text-stone-500 font-mono font-medium">
              SLA Threshold: &lt; 12m
            </p>
          </div>
          <div className="p-3 bg-brand-orange/10 rounded-xl text-brand-orange">
            <Clock className="h-6 w-6" />
          </div>
        </button>

        {/* KPI 2: SLA Breaches */}
        <button
          onClick={() => {
            setActiveKpiFilter(activeKpiFilter === 'delayed' ? 'all' : 'delayed');
          }}
          className={`text-left p-5 border rounded-2xl flex items-center justify-between transition-all shadow-xs cursor-pointer active:scale-98 ${t.card} ${
            activeKpiFilter === 'delayed' ? 'ring-2 ring-rose-500/80 bg-rose-500/5' : 'hover:scale-[1.01]'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-tech font-black uppercase text-stone-400 tracking-widest">
              SLA Warning Tickets
            </span>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-tech font-black ${slaWarningCount > 0 ? 'text-rose-500' : t.title}`}>
                {slaWarningCount}
              </span>
              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-black uppercase ${
                slaWarningCount > 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-stone-500/10 text-stone-400'
              }`}>
                &gt;10 min aging
              </span>
            </div>
            <p className="text-[10px] text-stone-500 font-mono font-medium">
              {activeKpiFilter === 'delayed' ? 'Showing ONLY delayed tickets' : 'Click to filter delayed tickets'}
            </p>
          </div>
          <div className={`p-3 rounded-xl ${slaWarningCount > 0 ? 'bg-rose-500/15 text-rose-500' : 'bg-stone-500/10 text-stone-400'}`}>
            <AlertTriangle className="h-6 w-6" />
          </div>
        </button>

        {/* KPI 3: Fulfillment Rate */}
        <button
          onClick={() => {
            setActiveKpiFilter(activeKpiFilter === 'completed' ? 'all' : 'completed');
          }}
          className={`text-left p-5 border rounded-2xl flex items-center justify-between transition-all shadow-xs cursor-pointer active:scale-98 ${t.card} ${
            activeKpiFilter === 'completed' ? 'ring-2 ring-emerald-500/80 bg-emerald-500/5' : 'hover:scale-[1.01]'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-tech font-black uppercase text-stone-400 tracking-widest">
              Today's Pass Rate
            </span>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-tech font-black ${t.title}`}>
                {fulfillmentRate}%
              </span>
              <span className="text-[10px] font-mono font-bold text-stone-500">
                {completedOrders.length}/{totalOrdersCount}
              </span>
            </div>
            <p className="text-[10px] text-stone-500 font-mono font-medium">
              {activeKpiFilter === 'completed' ? 'Showing ONLY completed tickets' : 'Click to filter completed'}
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </button>

        {/* KPI 4: Queue Load Factor */}
        <button
          onClick={() => {
            setActiveKpiFilter(activeKpiFilter === 'active' ? 'all' : 'active');
          }}
          className={`text-left p-5 border rounded-2xl flex items-center justify-between transition-all shadow-xs cursor-pointer active:scale-98 ${t.card} ${
            activeKpiFilter === 'active' ? 'ring-2 ring-indigo-500/80 bg-indigo-500/5' : 'hover:scale-[1.01]'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-tech font-black uppercase text-stone-400 tracking-widest">
              Active Cook Volume
            </span>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-tech font-black ${t.title}`}>
                {activeOrders.length}
              </span>
              <span className="text-[9px] font-mono bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-black uppercase">
                Preparing slips
              </span>
            </div>
            <p className="text-[10px] text-stone-500 font-mono font-medium">
              {activeKpiFilter === 'active' ? 'Showing ONLY active slips' : 'Click to filter active'}
            </p>
          </div>
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
            <Gauge className="h-6 w-6" />
          </div>
        </button>

      </div>

      {/* CO-PILOT ADVISOR CARDS */}
      <div className={`border p-5 rounded-2xl ${t.card}`} id="dashboard-copilot-panel">
        <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-stone-800">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4.5 w-4.5 text-brand-orange animate-pulse" />
            <h3 className="text-xs font-tech font-black uppercase tracking-widest text-stone-400">
              Kitchen Co-Pilot Predictive Insights
            </h3>
          </div>
          <span className="text-[8px] font-mono bg-brand-orange/10 text-brand-orange border border-brand-orange/20 px-2 py-0.5 rounded font-black uppercase">
            Auto-Generated Live
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {copilotInsights.map((insight) => (
            <div 
              key={insight.id}
              className={`p-3.5 rounded-xl border flex flex-col justify-between gap-1.5 transition-all text-xs ${
                insight.type === 'critical'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                  : insight.type === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : insight.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : 'bg-stone-500/10 border-stone-500/20 text-stone-300'
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <h4 className="font-tech font-black uppercase tracking-wider text-white">
                  {insight.title}
                </h4>
                <span className={`text-[8px] font-mono px-1.5 py-0.2 rounded font-black uppercase ${
                  insight.type === 'critical'
                    ? 'bg-rose-500/20 text-rose-400'
                    : insight.type === 'warning'
                    ? 'bg-amber-500/20 text-amber-400'
                    : insight.type === 'success'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-stone-500/20 text-stone-300'
                }`}>
                  {insight.badge}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-stone-400 font-medium">
                {insight.message}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* DOUBLE CHART ROW WITH GRADIENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Bar Chart: Workloads with Custom Interactive Highlights */}
        <div className={`lg:col-span-8 border p-5 rounded-2xl shadow-md flex flex-col h-[400px] ${t.card}`}>
          <div className="flex justify-between items-center mb-4 border-b border-stone-800 pb-3">
            <div>
              <h3 className="text-xs font-tech font-black uppercase tracking-widest text-white flex items-center gap-1.5">
                <Utensils className="h-4 w-4 text-brand-orange" />
                Line-by-Line Queue Load Factor
              </h3>
              <p className="text-[10px] text-stone-400 font-mono mt-0.5">
                Click on any cook station in the right side list to isolate line queue data.
              </p>
            </div>
            
            <div className="flex items-center gap-1.5">
              {selectedStationId !== 'all' && (
                <button
                  onClick={() => setSelectedStationId('all')}
                  className="text-[9px] font-mono bg-stone-800 hover:bg-stone-700 text-stone-300 px-2.5 py-1 rounded-md uppercase border border-stone-700 cursor-pointer"
                >
                  Clear Zoom [X]
                </button>
              )}
              <span className="text-[10px] font-mono bg-brand-orange/10 text-brand-orange border border-brand-orange/20 px-2 py-0.5 rounded font-bold uppercase">
                {selectedStationId === 'all' ? 'All Stations' : `Station: ${selectedStationId.replace('st-', '').toUpperCase()}`}
              </span>
            </div>
          </div>

          <div className="flex-1 w-full min-h-0 text-[10px] font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stationWorkloadData}
                margin={{ top: 10, right: 15, left: -20, bottom: 5 }}
              >
                <XAxis dataKey="name" stroke={t.chartLabel} fontSize={10} tickLine={false} />
                <YAxis stroke={t.chartLabel} fontSize={10} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1c1917',
                    border: '1px solid #44403c',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
                  }}
                  cursor={{ fill: '#ea580c', opacity: 0.08 }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} />
                <Bar 
                  dataKey="Active (Prep)" 
                  fill="#ea580c" 
                  radius={[5, 5, 0, 0]} 
                  onClick={(data) => {
                    if (data && data.id) setSelectedStationId(data.id);
                  }}
                  className="cursor-pointer"
                />
                <Bar 
                  dataKey="Completed (Bumped)" 
                  fill="#2563eb" 
                  radius={[5, 5, 0, 0]} 
                  onClick={(data) => {
                    if (data && data.id) setSelectedStationId(data.id);
                  }}
                  className="cursor-pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Menu Categories */}
        <div className={`lg:col-span-4 border p-5 rounded-2xl shadow-md flex flex-col h-[400px] ${t.card}`}>
          <div className="flex justify-between items-center mb-4 border-b border-stone-800 pb-3">
            <h3 className="text-xs font-tech font-black uppercase tracking-widest text-white flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-brand-orange" />
              Categorised Ticket Volume
            </h3>
            <span className="text-[10px] font-mono text-stone-400 uppercase font-black">
              All-Day Split
            </span>
          </div>

          <div className="flex-1 w-full min-h-0 flex flex-col justify-center text-[10px] font-mono relative">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categorySplitData}
                    cx="50%"
                    cy="50%"
                    innerRadius={54}
                    outerRadius={78}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categorySplitData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1c1917',
                      border: '1px solid #44403c',
                      borderRadius: '12px',
                      color: '#ffffff',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Premium Legend Layout */}
            <div className="grid grid-cols-2 gap-2 mt-4 px-2 text-[11px] font-bold">
              {categorySplitData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2 bg-stone-900/40 px-2.5 py-1.5 rounded-lg border border-stone-800/60">
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                  />
                  <span className="text-stone-300 truncate uppercase">{item.name} ({item.value})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* CONTINUOUS AREA RUSH TIMELINE & LIVE STATION HEALTH DECK */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Timeline Area Chart */}
        <div className={`lg:col-span-7 border p-5 rounded-2xl shadow-md flex flex-col h-[380px] ${t.card}`}>
          <div className="flex justify-between items-center mb-4 border-b border-stone-800 pb-3">
            <h3 className="text-xs font-tech font-black uppercase tracking-widest text-white flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-brand-orange animate-pulse" />
              Hourly Rush Timeline Volume & Prep Latency
            </h3>
            <span className="text-[10px] font-mono text-stone-400 font-bold uppercase">
              Operational Heat Map
            </span>
          </div>

          <div className="flex-1 w-full min-h-0 text-[10px] font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={hourlyTicketData}
                margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={t.chartGrid} />
                <XAxis dataKey="hour" stroke={t.chartLabel} fontSize={10} tickLine={false} />
                <YAxis yAxisId="left" stroke={t.chartLabel} fontSize={10} tickLine={false} label={{ value: 'Slips Submitted', angle: -90, position: 'insideLeft', offset: 10, fill: t.chartLabel }} />
                <YAxis yAxisId="right" orientation="right" stroke={t.chartLabel} fontSize={10} tickLine={false} label={{ value: 'Latency (mins)', angle: 90, position: 'insideRight', offset: 10, fill: t.chartLabel }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1c1917',
                    border: '1px solid #44403c',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                  }}
                />
                <Legend verticalAlign="top" height={32} iconType="circle" iconSize={8} />
                <Line yAxisId="left" type="monotone" dataKey="tickets" stroke="#ea580c" strokeWidth={3.5} dot={{ r: 5, strokeWidth: 1.5, fill: '#ea580c' }} name="Ticket Velocity" />
                <Line yAxisId="right" type="monotone" dataKey="latency" stroke="#2563eb" strokeWidth={2.5} strokeDasharray="4 4" dot={{ r: 4, fill: '#2563eb' }} name="Avg Cook Latency (mins)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Station Health and Detailed Drilldown panel */}
        <div className={`lg:col-span-5 border p-5 rounded-2xl shadow-md flex flex-col h-[380px] overflow-hidden ${t.card}`}>
          <div className="flex justify-between items-center mb-4 border-b border-stone-800 pb-3">
            <h3 className="text-xs font-tech font-black uppercase tracking-widest text-white flex items-center gap-1.5">
              <Printer className="h-4 w-4 text-stone-400 animate-spin" style={{ animationDuration: '4s' }} />
              Cook Station Diagnostics
            </h3>
            <span className="text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-black uppercase">
              Online Telemetry
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1" id="dashboard-stations-drilldown-list">
            {stationPerformanceSummary.map((station) => {
              const isSelected = selectedStationId === station.id;
              return (
                <button 
                  key={station.id} 
                  onClick={() => setSelectedStationId(isSelected ? 'all' : station.id)}
                  className={`w-full text-left p-3 border rounded-xl flex items-center justify-between shadow-xs transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-brand-orange/10 border-brand-orange shadow-md scale-[1.01]' 
                      : 'bg-stone-950/40 border-stone-800/80 hover:bg-stone-900/60'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        station.status === 'high-load' 
                          ? 'bg-rose-500 animate-pulse' 
                          : station.status === 'active' 
                          ? 'bg-amber-500' 
                          : 'bg-emerald-500'
                      }`} />
                      <h4 className="text-xs font-tech font-black text-white uppercase tracking-wider">
                        {station.name}
                      </h4>
                    </div>
                    <div className="flex gap-2 text-[10px] font-mono text-stone-400 font-bold uppercase">
                      <span>Active Prep: <strong className="text-white font-black">{station.activeLines}</strong></span>
                      <span>•</span>
                      <span>Total Bumped: <strong className="text-white font-black">{station.completedCount}</strong></span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-tech font-black text-white">
                      {station.avgTime}m avg
                    </div>
                    <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border font-black uppercase ${
                      station.status === 'high-load'
                        ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                        : station.status === 'active'
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                        : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    }`}>
                      {station.status === 'high-load' ? 'Critical Load' : station.status === 'active' ? 'Active Line' : 'Line Clear'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          
          <div className="pt-3 border-t border-stone-800 flex items-center justify-between text-[10px] text-stone-400 font-mono font-bold uppercase">
            <span>SLA Standard: Under 12 mins</span>
            <span className="flex items-center text-brand-orange">
              Interact to zoom <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </div>

      </div>

      {/* DRILLDOWN DETAIL STATION SECTION (ZOOM MODE) */}
      {currentSelectedStationInfo && (
        <div className={`p-6 border rounded-2xl shadow-xl transition-all ${t.card}`} id="station-deep-inspect-panel">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-stone-800 pb-4 mb-4 gap-4">
            <div>
              <span className="text-[9px] font-mono font-black bg-brand-orange/20 text-brand-orange px-2 py-0.5 rounded uppercase tracking-widest">
                Line Inspector Enabled
              </span>
              <h3 className="text-base font-tech font-black text-white uppercase tracking-wider mt-1.5 flex items-center gap-2">
                <span className="w-3 h-3 bg-brand-orange rounded-full animate-ping" />
                Live Feed Zoom: {currentSelectedStationInfo.name}
              </h3>
            </div>
            
            <button
              onClick={() => setSelectedStationId('all')}
              className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 font-mono text-xs font-black rounded-lg uppercase tracking-wider transition-all border border-stone-700 cursor-pointer active:scale-95"
            >
              Close Ledger Swapper [X]
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Box: Aggregated ingredient/prep counts (4 columns) */}
            <div className="lg:col-span-4 bg-stone-950/40 p-4 rounded-xl border border-stone-800 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-tech font-black text-stone-400 uppercase tracking-widest border-b border-stone-800 pb-2 mb-3">
                  All-Day Aggregate Prep Prep (Batching)
                </h4>
                
                {selectedStationPendingItems.length === 0 ? (
                  <div className="text-stone-500 font-mono text-xs text-center py-10">
                    No pending items at this line right now. Ready for next tickets.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedStationPendingItems.map((item, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between p-2 bg-stone-900 border border-stone-800 rounded-lg font-mono text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-brand-orange leading-none">{item.quantity}x</span>
                          <span className="font-tech font-bold text-white uppercase">{item.name}</span>
                        </div>
                        {item.modifiers.length > 0 && (
                          <span className="text-[8px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-black border border-amber-500/20 uppercase">
                            Customised ({item.modifiers.length})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-stone-800 text-[10px] text-stone-500 font-mono font-medium">
                Allows line cooks to batch preparation of identical items across independent order slips.
              </div>
            </div>

            {/* Right Box: Live order tickets queue targeting this station (8 columns) */}
            <div className="lg:col-span-8 bg-stone-950/40 p-4 rounded-xl border border-stone-800">
              <h4 className="text-xs font-tech font-black text-stone-400 uppercase tracking-widest border-b border-stone-800 pb-2 mb-3">
                Current Kitchen Slips Queue at this Station
              </h4>

              {filteredOrdersList.filter(o => o.status !== 'completed' && o.items.some(i => i.stationId === selectedStationId)).length === 0 ? (
                <div className="text-stone-500 font-mono text-xs text-center py-12">
                  No active orders with items waiting for this station. Keep up the high speed!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                  {filteredOrdersList
                    .filter(o => o.status !== 'completed' && o.items.some(i => i.stationId === selectedStationId))
                    .map((order) => {
                      const relevantItems = order.items.filter(i => i.stationId === selectedStationId);
                      const elapsedMins = Math.floor((new Date().getTime() - new Date(order.createdAt).getTime()) / 60000);
                      const isHighAge = elapsedMins >= 10;
                      
                      return (
                        <div 
                          key={order.id} 
                          className={`p-3 bg-stone-900 rounded-xl border text-xs font-mono flex flex-col justify-between ${
                            isHighAge ? 'border-rose-500/50 bg-rose-950/10' : 'border-stone-800'
                          }`}
                        >
                          <div>
                            <div className="flex justify-between items-start border-b border-stone-800 pb-1.5 mb-2">
                              <div>
                                <span className="font-tech font-black text-white uppercase text-xs truncate max-w-[120px] block">
                                  {order.customerName}
                                </span>
                                <span className="text-[9px] text-stone-500 font-bold block">
                                  {order.id.toUpperCase()} • T{order.tableNumber || 'Takeaway'}
                                </span>
                              </div>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${
                                isHighAge ? 'bg-rose-500/20 text-rose-400' : 'bg-stone-800 text-stone-400'
                              }`}>
                                {elapsedMins}m Age
                              </span>
                            </div>

                            <div className="space-y-1">
                              {relevantItems.map((itm) => (
                                <div key={itm.id} className="flex justify-between items-center text-[11px]">
                                  <span className="text-stone-300 font-semibold uppercase">
                                    {itm.quantity}x {itm.name}
                                  </span>
                                  <span className={`text-[9px] font-black uppercase ${
                                    itm.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'
                                  }`}>
                                    {itm.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* FILTERED ORDERS LIST PREVIEW PANEL */}
      <div className={`p-6 border rounded-2xl shadow-md ${t.card}`} id="dashboard-ticket-preview-panel">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-stone-800 pb-3 mb-4 gap-3">
          <div>
            <h3 className="text-xs font-tech font-black uppercase tracking-widest text-white flex items-center gap-1.5">
              <Printer className="h-4 w-4 text-stone-500" />
              Live Ledger Slip Registry
            </h3>
            <p className="text-[10px] text-stone-400 font-mono mt-0.5">
              Showing {filteredOrdersList.length} of {orders.length} total orders. Tap KPI tiles above to filter this ledger list.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-stone-500 font-bold uppercase">
              Filter Active:
            </span>
            <span className="text-[10px] font-mono font-black bg-stone-800 text-white px-2.5 py-1 rounded border border-stone-700 uppercase">
              {activeKpiFilter === 'all' ? 'All Slips' : activeKpiFilter.toUpperCase()}
            </span>
          </div>
        </div>

        {filteredOrdersList.length === 0 ? (
          <div className="text-stone-500 text-center py-10 font-mono text-xs">
            No orders match the selected filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" id="dashboard-ledger-list">
            {filteredOrdersList.slice(0, 12).map((order) => {
              const elapsedMins = Math.floor((new Date().getTime() - new Date(order.createdAt).getTime()) / 60000);
              const isCompleted = order.status === 'completed';
              
              return (
                <div 
                  key={order.id} 
                  className={`p-4 bg-stone-900/50 border rounded-xl flex flex-col justify-between h-[180px] font-mono text-xs ${
                    order.status === 'completed'
                      ? 'border-stone-850 opacity-70'
                      : elapsedMins >= 10
                      ? 'border-rose-500/50 bg-rose-950/10'
                      : 'border-stone-800'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start border-b border-stone-800 pb-2 mb-2">
                      <div>
                        <h4 className="font-tech font-black text-white uppercase text-xs truncate max-w-[120px]">
                          {order.customerName}
                        </h4>
                        <span className="text-[9px] text-stone-500 font-bold block">
                          {order.id.toUpperCase()} • {order.source}
                        </span>
                      </div>
                      
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                        isCompleted 
                          ? 'bg-stone-800 text-stone-400 border border-stone-700' 
                          : elapsedMins >= 10
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                      }`}>
                        {isCompleted ? 'Done' : `${elapsedMins}m age`}
                      </span>
                    </div>

                    <div className="space-y-1 max-h-[70px] overflow-y-auto pr-1">
                      {order.items.map((itm) => (
                        <div key={itm.id} className="flex justify-between items-center text-[10px]">
                          <span className="text-stone-300 truncate max-w-[150px] uppercase">
                            {itm.quantity}x {itm.name}
                          </span>
                          <span className={`text-[8px] px-1 rounded uppercase ${
                            itm.status === 'completed' ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'
                          }`}>
                            {itm.status.slice(0, 4)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-stone-800 flex justify-between items-center text-[9px] text-stone-500 font-bold uppercase">
                    <span>T{order.tableNumber || 'Takeaway'}</span>
                    <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
