import React from 'react';
import { Order, OrderItem, KDSStation, Printer, PrintJob, AuditLog, KDSConfig, UserRole, MenuItem, PendingBump } from './types';
import { api, setAdminToken, setDeviceCredential, getDeviceCredential, ApiError } from './api/client';
import { connectSocket, getSocket } from './api/socket';
import {
  INITIAL_MENU,
  INITIAL_STATIONS,
  INITIAL_PRINTERS,
  DEFAULT_CONFIG,
  INITIAL_ORDERS,
} from './data';
import {
  formatTime,
  generateLabelPrintContent,
  generatePackingDocketContent,
  createRandomId,
} from './utils';
import { POSSimulator } from './components/POSSimulator';
import { KDSStationView } from './components/KDSStationView';
import { ExpeditorView } from './components/ExpeditorView';
import { PrintersLog } from './components/PrintersLog';
import { AdminConfig } from './components/AdminConfig';
import { AuditLogs } from './components/AuditLogs';
import { StockManager } from './components/StockManager';
import { KitchenDashboard } from './components/KitchenDashboard';
import { CustomerDisplay } from './components/CustomerDisplay';

import {
  Wifi,
  WifiOff,
  User,
  LayoutGrid,
  Settings,
  Database,
  Printer as PrinterIcon,
  Tag,
  MonitorPlay,
  Play,
  TrendingUp,
  PackageCheck,
  RotateCcw,
  BookOpen,
  Sparkles,
  Undo2,
  ShieldCheck,
  Lock,
} from 'lucide-react';

function AdminLockNotice({ onLoginClick, label }: { onLoginClick: () => void; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6" id="admin-lock-notice">
      <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-3">
        <Lock className="h-5 w-5 text-amber-600" />
      </div>
      <h3 className="text-sm font-tech font-bold uppercase tracking-wider text-stone-900">Admin Login Required</h3>
      <p className="text-xs text-stone-500 mt-1.5 max-w-sm">
        This device is paired to a kitchen station with no login, by design. Access to {label} requires an Admin to log in on this device first.
      </p>
      <button
        id="btn-admin-lock-login"
        onClick={onLoginClick}
        className="mt-4 px-4 py-2 bg-brand-orange text-white rounded-lg text-xs font-bold uppercase cursor-pointer hover:bg-orange-600"
      >
        Admin Login
      </button>
    </div>
  );
}

export default function App() {
  // --- CORE KDS STATES & PERSISTENCE ---
  const [orders, setOrders] = React.useState<Order[]>(INITIAL_ORDERS);
  const [menuItems, setMenuItems] = React.useState<MenuItem[]>(INITIAL_MENU);
  
  // Production-Grade Persistent Station Config
  const [config, setConfig] = React.useState<KDSConfig>(() => {
    try {
      const saved = localStorage.getItem('sufra_kds_config_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          undoGracePeriodSeconds: parsed.undoGracePeriodSeconds !== undefined ? parsed.undoGracePeriodSeconds : 5,
          fadeEmptyStationOrders: parsed.fadeEmptyStationOrders !== undefined ? parsed.fadeEmptyStationOrders : true,
        };
      }
    } catch (e) {
      console.warn('Failed to load saved KDS config, using defaults:', e);
    }
    return DEFAULT_CONFIG;
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('sufra_kds_config_v2', JSON.stringify(config));
    } catch (e) {
      console.error('Failed to persist KDS config:', e);
    }
  }, [config]);

  const [printers, setPrinters] = React.useState<Printer[]>(INITIAL_PRINTERS);
  const [printJobs, setPrintJobs] = React.useState<PrintJob[]>([]);
  
  // 5-Second Undo Grace Period Buffer State
  const [pendingBumps, setPendingBumps] = React.useState<PendingBump[]>([]);

  const [auditLogs, setAuditLogs] = React.useState<AuditLog[]>([
    {
      id: 'log-init',
      timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
      userId: 'system',
      userRole: 'administrator',
      action: 'Server Boot',
      details: 'Local KDS Node provisioned with 5-second Undo Grace Period and production persistent configuration.',
    },
    {
      id: 'log-pos-connected',
      timestamp: new Date(Date.now() - 29 * 60000).toISOString(),
      userId: 'system',
      userRole: 'administrator',
      action: 'Square POS Sync',
      details: 'Secure SSL link established with Square Orders, Catalog, and Inventory endpoints.',
    },
  ]);

  // --- DEVICE IDENTITY MODEL ---
  // No individual staff login exists anywhere. A device is either paired to a
  // station and usable by anyone on shift with no login, or temporarily in
  // Admin Mode for configuration — which does require real Admin credentials
  // against the backend below.
  const [isAdminMode, setIsAdminMode] = React.useState(false);
  const [showAdminLogin, setShowAdminLogin] = React.useState(false);
  const [adminEmailInput, setAdminEmailInput] = React.useState('');
  const [adminPasswordInput, setAdminPasswordInput] = React.useState('');
  const [adminLoginError, setAdminLoginError] = React.useState<string | null>(null);
  const currentUserRole: UserRole = isAdminMode ? 'administrator' : 'station_device';

  // --- BACKEND CONNECTIVITY ---
  // True once the real backend has been reached at least once. Until then (no
  // deployment exists yet, or the backend is unreachable), the app runs on its
  // local in-memory demo data exactly as before — this is a graceful fallback,
  // not a silent failure, and is always visible in the header.
  const [isBackendConnected, setIsBackendConnected] = React.useState(false);
  const [backendVenueId, setBackendVenueId] = React.useState<string | null>(null);
  const [activeStationId, setActiveStationId] = React.useState<string>(() => {
    return localStorage.getItem('sufra_kds_station_id') || 'st-grill';
  });

  React.useEffect(() => {
    if (activeStationId) {
      localStorage.setItem('sufra_kds_station_id', activeStationId);
    }
  }, [activeStationId]);

  const [activeWorkspaceTab, setActiveWorkspaceTab] = React.useState<'split' | 'single' | 'dashboard' | 'customer'>('split');
  const [singleViewTab, setSingleViewTab] = React.useState<'kds' | 'expeditor' | 'pos' | 'printers' | 'stock' | 'admin' | 'logs' | 'dashboard'>('kds');
  
  // Internet status (Section 10: Offline Operation and Recovery)
  const [isOffline, setIsOffline] = React.useState(false);
  const [offlineBufferQueue, setOfflineBufferQueue] = React.useState<Order[]>([]);

  // --- ADMIN LOGIN / LOGOUT (the only login in the whole system) ---
  // Demo credentials used only when the real backend isn't reachable yet —
  // matches the backend's own seed script so the same login works either way
  // once the backend is actually deployed.
  const DEMO_ADMIN_EMAIL = 'admin@sufra.example';
  const DEMO_ADMIN_PASSWORD = 'ChangeMe123!';

  const handleAdminLoginAttempt = async () => {
    setAdminLoginError(null);

    if (isBackendConnected) {
      try {
        const { token } = await api.adminLogin(adminEmailInput.trim(), adminPasswordInput);
        setAdminToken(token);
        setIsAdminMode(true);
        setShowAdminLogin(false);
        setAdminEmailInput('');
        setAdminPasswordInput('');
        writeLog('Admin Login', 'Admin authenticated on this device.', 'admin', 'administrator');
      } catch (err) {
        setAdminLoginError(err instanceof ApiError && err.status === 401 ? 'Incorrect email or password.' : 'Could not reach the backend server.');
      }
      return;
    }

    // No live backend yet — fall back to local demo credentials so Admin
    // features remain fully testable on the standalone prototype.
    if (adminEmailInput.trim().toLowerCase() === DEMO_ADMIN_EMAIL && adminPasswordInput === DEMO_ADMIN_PASSWORD) {
      setIsAdminMode(true);
      setShowAdminLogin(false);
      setAdminEmailInput('');
      setAdminPasswordInput('');
      writeLog('Admin Login', 'Admin authenticated on this device (local demo mode — no backend connected).', 'admin', 'administrator');
    } else {
      setAdminLoginError(`Incorrect email or password. (Demo login: ${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_PASSWORD})`);
    }
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    setIsAdminMode(false);
    writeLog('Admin Logout', 'Admin session ended. Device returned to its paired station, no login required.', 'admin', 'administrator');
  };

  // --- INITIAL BACKEND CONNECTION ---
  // Attempts to reach the real backend once on load. If it succeeds, live
  // data replaces the local demo arrays and Socket.IO takes over pushing
  // updates. If it fails (no deployment yet, network issue), the app quietly
  // continues on its local in-memory demo data — this is the same app you've
  // already been testing, not a broken one.
  React.useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        const [configRes, printersRes, menuRes] = await Promise.all([
          api.getConfig(),
          api.getPrinters(),
          api.getMenu(),
        ]);
        if (cancelled) return;

        setConfig((prev) => ({ ...prev, ...configRes.config }));
        setPrinters(printersRes.printers);
        setMenuItems(menuRes.items);
        setIsBackendConnected(true);

        writeLog('Backend Connected', 'Live backend reached — using real data instead of local demo data.', 'system', 'administrator');

        // A device credential from a previous pairing, if this browser has one.
        const existingCredential = getDeviceCredential();
        if (existingCredential) {
          try {
            const identity = await api.whoAmI();
            setActiveStationId(identity.stationId);
          } catch {
            // Stale/invalid credential — fall back to local station selection.
            setDeviceCredential(null);
          }
        }
      } catch {
        // Backend not reachable — expected until it's actually deployed.
        // eslint-disable-next-line no-console
        console.warn('[backend] not reachable — running on local demo data.');
      }
    }

    connect();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- LOGGING HELPER ---
  const writeLog = (action: string, details: string, userId = 'staff', role: UserRole = currentUserRole, orderId?: string) => {
    const newLog: AuditLog = {
      id: createRandomId('log'),
      timestamp: new Date().toISOString(),
      userId,
      userRole: role,
      action,
      details,
      orderId,
    };
    setAuditLogs(prev => [...prev, newLog]);
  };

  // --- ORDER SUBMISSION HANDLER (SQUARE WEBHOOK SIMULATOR) ---
  const handleOrderSubmit = (newOrder: Order) => {
    if (isOffline) {
      // Buffer the order in simulated "Square cloud buffer"
      setOfflineBufferQueue(prev => [...prev, newOrder]);
      writeLog(
        'Square Webhook Queued',
        `Internet outage in progress. Order ${newOrder.id} successfully queued on Square Cloud buffers.`,
        'square_api',
        'administrator',
        newOrder.id
      );
      return;
    }

    // Standard immediate ingest
    setOrders(prev => [newOrder, ...prev]);
    writeLog(
      'Square Webhook Received',
      `New order from ${newOrder.customerName} (${newOrder.tableNumber || 'Takeaway'}) successfully ingested and routed.`,
      'square_api',
      'administrator',
      newOrder.id
    );
  };

  // --- INTERNET RECOVERY SIMULATION ---
  const handleToggleInternet = () => {
    if (isOffline) {
      // Reconnecting!
      setIsOffline(false);
      writeLog(
        'Network Recovered',
        'Local server internet link re-established. Synchronising missed orders from Square Cloud API buffers...',
        'system',
        'administrator'
      );

      // Ingest backlogged orders
      if (offlineBufferQueue.length > 0) {
        setTimeout(() => {
          setOrders(prev => [...offlineBufferQueue, ...prev]);
          offlineBufferQueue.forEach(order => {
            writeLog(
              'Backlog Synchronised',
              `Autorecover: Missed order ${order.id} for ${order.customerName} successfully pulled down and routed.`,
              'square_api',
              'administrator',
              order.id
            );
          });
          setOfflineBufferQueue([]);
        }, 1500);
      }
    } else {
      // Going offline
      setIsOffline(true);
      writeLog(
        'Network Disrupted',
        'Internet outage simulated. Local network communication remains ACTIVE. Webhooks from Square are buffered.',
        'system',
        'administrator'
      );
    }
  };

  // --- PEAK RUSH SIMULATOR ---
  const handleSimulateRush = () => {
    const customerNames = [
      'Sarah Jenkins', 'Michael Chang', 'Emma Watson', 'Liam Neeson', 
      'Sophia Loren', 'James Bond', 'Olivia Wilde', 'David Beckham'
    ];
    const sources: Array<'Square POS' | 'Online Store'> = ['Square POS', 'Online Store'];
    
    const newSimulatedOrders: Order[] = [];
    
    for (let i = 0; i < 5; i++) {
      const orderId = createRandomId('ord');
      const randomCustomer = customerNames[Math.floor(Math.random() * customerNames.length)];
      const randomSource = sources[Math.floor(Math.random() * sources.length)];
      const tableNum = randomSource === 'Square POS' ? String(Math.floor(Math.random() * 20) + 1) : undefined;
      
      // select 1-3 random menu items
      const selectedItems: MenuItem[] = [];
      const count = Math.floor(Math.random() * 3) + 1;
      while (selectedItems.length < count) {
        const item = menuItems[Math.floor(Math.random() * menuItems.length)];
        if (item.inStock && !selectedItems.some(si => si.id === item.id)) {
          selectedItems.push(item);
        }
      }
      
      const orderItems: OrderItem[] = selectedItems.map(menuItem => {
        const qty = Math.floor(Math.random() * 2) + 1;
        const mods: string[] = [];
        // FIX: previously compared against 'pizza'/'kitchen'/'drinks'/'desserts'
        // — stale categories from an earlier demo menu that no real Sufra item
        // ever has, so Simulate Rush never generated any modifiers at all.
        if (menuItem.category === 'From Our Grill' || menuItem.category === 'Mains') {
          const options = ['EXTRA MEAT', 'WELL DONE', 'MEDIUM', 'EXTRA RICE', 'SAUCE ON SIDE'];
          if (Math.random() > 0.45) mods.push(options[Math.floor(Math.random() * options.length)]);
        } else if (menuItem.category === 'Hot Mezze' || menuItem.category === 'Cold Mezze' || menuItem.category === 'Salads & Dips') {
          const options = ['NO ONIONS', '🚨 SESAME ALLERGY — TAHINI-FREE', 'EXTRA CRISPY', 'PINE NUTS ADD-ON'];
          if (Math.random() > 0.45) mods.push(options[Math.floor(Math.random() * options.length)]);
        } else if (menuItem.category === 'Coffee & Hot Drinks' || menuItem.category === 'Cold Drinks') {
          const options = ['OAT MILK', 'EXTRA SHOT', 'NO ICE', 'ADD LEMON SLICE'];
          if (Math.random() > 0.6) mods.push(options[Math.floor(Math.random() * options.length)]);
        } else if (menuItem.category === 'Pancakes & French Toast') {
          const options = ['🚨 ALLERGY: NUTS', 'EXTRA MASCARPONE', 'SUB MAPLE FOR HONEY'];
          if (Math.random() > 0.6) mods.push(options[Math.floor(Math.random() * options.length)]);
        }
        
        return {
          id: createRandomId('itm-inst'),
          menuItemId: menuItem.id,
          name: menuItem.name,
          quantity: qty,
          completedQuantity: 0,
          packedQuantity: 0,
          status: 'pending' as const,
          stationId: menuItem.stationId,
          reprintCount: 0,
          modifiers: mods.length > 0 ? mods : undefined,
        };
      });
      
      const newOrder: Order = {
        id: orderId,
        customerName: randomCustomer,
        tableNumber: tableNum,
        createdAt: new Date().toISOString(),
        status: 'preparing',
        items: orderItems,
        source: randomSource,
      };
      
      newSimulatedOrders.push(newOrder);
    }
    
    // Ingest all
    setOrders(prev => [...newSimulatedOrders, ...prev]);
    
    // Logs
    writeLog(
      'Peak Rush Simulated',
      `Injected 5 active multi-station orders to simulate critical load on kitchen.`,
      'system',
      'administrator'
    );
  };

  // --- PRINTER ACTIONS ---
  const queuePrintJob = (printerId: string, title: string, content: string, orderId?: string) => {
    const printer = printers.find(p => p.id === printerId);
    const newJob: PrintJob = {
      id: createRandomId('print-job'),
      printerId,
      title,
      content,
      timestamp: new Date().toISOString(),
      status: 'pending',
      attempts: 1,
    };

    if (!printer) return;

    if (printer.status === 'online') {
      newJob.status = 'printed';
      setPrintJobs(prev => [...prev, newJob]);
      writeLog(
        'Print Successful',
        `Printed: "${title}" on printer "${printer.name}"`,
        'local_printer_spooler',
        currentUserRole,
        orderId
      );
    } else {
      newJob.status = 'failed';
      newJob.errorMessage = printer.status === 'offline' ? 'Printer Offline (No ping)' : 'Paper Jam Detected';
      setPrintJobs(prev => [...prev, newJob]);
      writeLog(
        'Print Failure',
        `Failed to print: "${title}" on "${printer.name}" - ${newJob.errorMessage}`,
        'local_printer_spooler',
        currentUserRole,
        orderId
      );
    }
  };

  // --- AUTOMATIC RE-SPOOLER / RE-TRY THREAD (Section 8: Printer Failures & Duplicate prevention) ---
  React.useEffect(() => {
    const failedOrPendingJobs = printJobs.filter(j => j.status === 'failed' || j.status === 'pending');
    if (failedOrPendingJobs.length === 0) return;

    // Check if any failed jobs have their printers now restored to online
    const jobsToRetry = failedOrPendingJobs.filter(job => {
      const printer = printers.find(p => p.id === job.printerId);
      return printer && printer.status === 'online';
    });

    if (jobsToRetry.length === 0) return;

    // Trigger automatic reprint retry thread
    const timer = setTimeout(() => {
      setPrintJobs(prev => prev.map(job => {
        const printer = printers.find(p => p.id === job.printerId);
        if (job.status === 'failed' && printer && printer.status === 'online') {
          writeLog(
            'Print Retry Success',
            `Auto-Retry: Spooler printed backlogged "${job.title}" on printer "${printer.name}" after hardware recovery.`,
            'local_printer_spooler',
            currentUserRole
          );
          return { ...job, status: 'printed', attempts: job.attempts + 1, errorMessage: undefined };
        }
        return job;
      }));
    }, 1200);

    return () => clearTimeout(timer);
  }, [printers, printJobs]);

  const togglePrinterStatus = (printerId: string, status: 'online' | 'offline' | 'jammed') => {
    setPrinters(prev => prev.map(p => p.id === printerId ? { ...p, status } : p));
    const printer = printers.find(p => p.id === printerId);
    writeLog(
      'Printer State Changed',
      `Diagnostic status for printer "${printer?.name}" set to ${status.toUpperCase()}`,
      'hardware_monitor',
      currentUserRole
    );
  };

  const retryAllFailedJobs = () => {
    setPrintJobs(prev => prev.map(job => {
      const printer = printers.find(p => p.id === job.printerId);
      if (job.status === 'failed' && printer && printer.status === 'online') {
        return { ...job, status: 'printed', attempts: job.attempts + 1, errorMessage: undefined };
      }
      return job;
    }));
    writeLog('Print Manual Retry', 'Staff requested manual reprint on all spooler failure buffers.', 'staff');
  };

  // --- 5-SECOND UNDO BUMP GRACE PERIOD TICKER ---
  React.useEffect(() => {
    if (pendingBumps.length === 0) return;

    const interval = setInterval(() => {
      setPendingBumps(prevBumps => {
        const remainingBumps: PendingBump[] = [];

        prevBumps.forEach(bump => {
          const nextSeconds = bump.secondsRemaining - 1;

          if (nextSeconds <= 0) {
            // GRACE PERIOD EXPIRED -> FINALIZE BUMP, DISPATCH PRINT JOBS & COMPLETE STATUS
            bump.scheduledPrintJobs.forEach(job => {
              queuePrintJob(job.printerId, job.title, job.content, job.orderId);
            });

            if (bump.willCompleteOrder) {
              setOrders(prevOrders => prevOrders.map(order => {
                if (order.id !== bump.orderId) return order;
                return {
                  ...order,
                  status: 'completed',
                  completedAt: new Date().toISOString(),
                };
              }));

              writeLog(
                'Order Completed (Finalized)',
                `Grace period elapsed for Order ${bump.orderId}. Final docket printed and order transitioned to Ready for Pickup.`,
                'expeditor',
                currentUserRole,
                bump.orderId
              );
            } else {
              writeLog(
                'Bump Finalized',
                `Grace period elapsed for Order ${bump.orderId}. Sticky label dispatched to printer.`,
                'expeditor',
                currentUserRole,
                bump.orderId
              );
            }
          } else {
            remainingBumps.push({
              ...bump,
              secondsRemaining: nextSeconds,
            });
          }
        });

        return remainingBumps;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingBumps, currentUserRole]);

  // --- UNDO BUMP ACTION (Cancels delayed prints, resets quantities, keeps order state) ---
  const handleUndoBump = (pendingBumpId: string) => {
    const targetBump = pendingBumps.find(b => b.id === pendingBumpId);
    if (!targetBump) return;

    // 1. Revert order items and order status
    setOrders(prevOrders => prevOrders.map(order => {
      if (order.id !== targetBump.orderId) return order;

      if (targetBump.itemId) {
        const updatedItems = order.items.map(item => {
          if (item.id !== targetBump.itemId) return item;
          return {
            ...item,
            completedQuantity: targetBump.itemPreviousQty.completed,
            packedQuantity: targetBump.itemPreviousQty.packed,
            status: targetBump.itemPreviousQty.status as any,
          };
        });

        return {
          ...order,
          items: updatedItems,
          status: targetBump.orderPreviousStatus,
          completedAt: targetBump.orderPreviousStatus === 'completed' ? order.completedAt : undefined,
        };
      }

      return {
        ...order,
        status: targetBump.orderPreviousStatus,
        completedAt: targetBump.orderPreviousStatus === 'completed' ? order.completedAt : undefined,
      };
    }));

    // 2. Remove from pending bumps (aborts delayed label printing & docket printing)
    setPendingBumps(prev => prev.filter(b => b.id !== pendingBumpId));

    // 3. Log the undo
    writeLog(
      'Bump Undone (Grace Period)',
      `Operator cancelled bump for order ${targetBump.orderId} within ${targetBump.totalSeconds}s grace window. Scheduled label/docket printing cancelled.`,
      'kitchen_staff',
      currentUserRole,
      targetBump.orderId
    );
  };

  // --- BUMPING EVENT HANDLERS (With Configurable 0/3/5/10s Grace Period) ---
  const handleItemBump = (orderId: string, itemId: string) => {
    const targetOrder = orders.find(o => o.id === orderId);
    const targetItem = targetOrder?.items.find(i => i.id === itemId);
    if (!targetOrder || !targetItem) return;

    const previousItemCompleted = targetItem.completedQuantity;
    const previousItemPacked = targetItem.packedQuantity;
    const previousItemStatus = targetItem.status;
    const previousOrderStatus = targetOrder.status;

    const nextCompletedQty = Math.min(targetItem.quantity, targetItem.completedQuantity + 1);
    const isLineFinished = nextCompletedQty === targetItem.quantity;

    // Optimistically update item
    setOrders(prevOrders => prevOrders.map(order => {
      if (order.id !== orderId) return order;

      const updatedItems = order.items.map(item => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          completedQuantity: nextCompletedQty,
          status: isLineFinished ? 'completed' : 'preparing',
          lastBumpedAt: new Date().toISOString(),
        };
      });

      const allPrepared = updatedItems.every(i => i.completedQuantity === i.quantity);
      const nextStatus = allPrepared ? 'ready_to_pack' : 'preparing';

      return {
        ...order,
        items: updatedItems,
        status: order.status === 'completed' ? 'completed' : (nextStatus as any),
      };
    }));

    const graceSeconds = config.undoGracePeriodSeconds;

    if (graceSeconds > 0) {
      // Register Pending Bump with Undo window
      const bumpId = `bump-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const newPendingBump: PendingBump = {
        id: bumpId,
        orderId,
        itemId,
        bumpType: 'item_prep',
        itemPreviousQty: {
          completed: previousItemCompleted,
          packed: previousItemPacked,
          status: previousItemStatus,
        },
        orderPreviousStatus: previousOrderStatus,
        scheduledPrintJobs: [],
        willCompleteOrder: false,
        secondsRemaining: graceSeconds,
        totalSeconds: graceSeconds,
        startTime: Date.now(),
      };
      setPendingBumps(prev => [newPendingBump, ...prev]);

      writeLog(
        'Item Unit Prepared (Grace Window Active)',
        `Station prepared unit ${nextCompletedQty}/${targetItem.quantity} of "${targetItem.name}". ${graceSeconds}s Undo grace period active.`,
        'kitchen_staff',
        currentUserRole,
        orderId
      );
    } else {
      writeLog(
        'Item Unit Prepared',
        `Station prepared unit ${nextCompletedQty}/${targetItem.quantity} of "${targetItem.name}". Ready to pack.`,
        'kitchen_staff',
        currentUserRole,
        orderId
      );
    }
  };

  const handlePackingItemBump = (orderId: string, itemId: string) => {
    const targetOrder = orders.find(o => o.id === orderId);
    const targetItem = targetOrder?.items.find(i => i.id === itemId);
    if (!targetOrder || !targetItem) return;

    const previousItemCompleted = targetItem.completedQuantity;
    const previousItemPacked = targetItem.packedQuantity;
    const previousItemStatus = targetItem.status;
    const previousOrderStatus = targetOrder.status;

    const nextPackedQty = Math.min(targetItem.completedQuantity, targetItem.packedQuantity + 1);
    const bumpedItemName = targetItem.name;
    const currentPackedQty = nextPackedQty;
    const totalQty = targetItem.quantity;

    // Generate sticky label content
    const printedLabelContent = generateLabelPrintContent(targetOrder, { ...targetItem, completedQuantity: nextPackedQty });
    // FIX: labels are printed physically at Packing & Pass in this deployment —
    // production stations have no printer hardware at all (Label Printing Off).
    // Route to the ACTING station's own printer (Packing & Pass), never the
    // item's owning station's printer, regardless of which station the item
    // was routed to for preparation.
    const printedPrinterId = config.stations.find(st => st.id === 'st-packing')?.printerId || 'pr-packing';

    const labelJob = {
      printerId: printedPrinterId,
      title: `Packing Sticky Label (${currentPackedQty}/${totalQty}): ${bumpedItemName}`,
      content: printedLabelContent,
      orderId,
    };

    // Check if ALL items in order will now be fully packed
    const updatedItemsPreview = targetOrder.items.map(i => i.id === itemId ? { ...i, packedQuantity: nextPackedQty } : i);
    const allPacked = updatedItemsPreview.every(i => i.packedQuantity === i.quantity);

    let docketJob: { printerId: string; title: string; content: string; orderId: string } | null = null;
    if (allPacked) {
      const docketContent = generatePackingDocketContent({ ...targetOrder, items: updatedItemsPreview });
      docketJob = {
        printerId: 'pr-packing',
        title: `Complete Order Receipt: ${targetOrder.id}`,
        content: docketContent,
        orderId,
      };
    }

    const graceSeconds = config.undoGracePeriodSeconds;

    if (graceSeconds > 0) {
      // Optimistically update packedQuantity but hold the final completed status & prints in pending buffer
      setOrders(prevOrders => prevOrders.map(order => {
        if (order.id !== orderId) return order;
        return {
          ...order,
          items: updatedItemsPreview,
          // Keep status as 'ready_to_pack' or 'preparing' so Customer Display does not prematurely flip!
          status: order.status === 'completed' ? 'completed' : 'ready_to_pack',
        };
      }));

      const bumpId = `bump-pack-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const newPendingBump: PendingBump = {
        id: bumpId,
        orderId,
        itemId,
        bumpType: 'item_pack',
        itemPreviousQty: {
          completed: previousItemCompleted,
          packed: previousItemPacked,
          status: previousItemStatus,
        },
        orderPreviousStatus: previousOrderStatus,
        scheduledPrintJobs: [labelJob, ...(docketJob ? [docketJob] : [])],
        willCompleteOrder: allPacked,
        secondsRemaining: graceSeconds,
        totalSeconds: graceSeconds,
        startTime: Date.now(),
      };
      setPendingBumps(prev => [newPendingBump, ...prev]);

      writeLog(
        'Item Unit Packed (Grace Window Active)',
        `Packing station packed unit ${nextPackedQty}/${totalQty} of "${bumpedItemName}". Sticky label & docket delayed by ${graceSeconds}s grace window.`,
        'expeditor',
        currentUserRole,
        orderId
      );
    } else {
      // Instant execution (0s grace period)
      setOrders(prevOrders => prevOrders.map(order => {
        if (order.id !== orderId) return order;
        return {
          ...order,
          items: updatedItemsPreview,
          status: allPacked ? 'completed' : 'preparing',
          completedAt: allPacked ? new Date().toISOString() : order.completedAt,
        };
      }));

      // Queue sticky label immediately
      queuePrintJob(labelJob.printerId, labelJob.title, labelJob.content, labelJob.orderId);

      if (docketJob) {
        queuePrintJob(docketJob.printerId, docketJob.title, docketJob.content, docketJob.orderId);
      }

      writeLog(
        'Item Unit Packed',
        `Packing station packed unit ${nextPackedQty}/${totalQty} of "${bumpedItemName}". Sticky label printed immediately.`,
        'expeditor',
        currentUserRole,
        orderId
      );
    }
  };

  const handleOrderComplete = (orderId: string) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;

    const previousOrderStatus = targetOrder.status;
    const docketContent = generatePackingDocketContent(targetOrder);
    const docketJob = {
      printerId: 'pr-packing',
      title: `Final Packing Docket: ${targetOrder.id}`,
      content: docketContent,
      orderId,
    };

    const graceSeconds = config.undoGracePeriodSeconds;

    if (graceSeconds > 0) {
      const bumpId = `bump-ord-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const newPendingBump: PendingBump = {
        id: bumpId,
        orderId,
        bumpType: 'order_complete',
        itemPreviousQty: { completed: 0, packed: 0, status: 'completed' },
        orderPreviousStatus: previousOrderStatus,
        scheduledPrintJobs: [docketJob],
        willCompleteOrder: true,
        secondsRemaining: graceSeconds,
        totalSeconds: graceSeconds,
        startTime: Date.now(),
      };
      setPendingBumps(prev => [newPendingBump, ...prev]);

      writeLog(
        'Order Complete Initiated (Grace Window Active)',
        `Order ${orderId} marked complete. ${graceSeconds}s Undo grace period active before final docket print & customer display update.`,
        'expeditor',
        currentUserRole,
        orderId
      );
    } else {
      // Instant execution
      setOrders(prevOrders => prevOrders.map(order => {
        if (order.id !== orderId) return order;
        return {
          ...order,
          status: 'completed',
          completedAt: new Date().toISOString(),
        };
      }));

      queuePrintJob(docketJob.printerId, docketJob.title, docketJob.content, docketJob.orderId);

      writeLog(
        'Order Handoff Dispatched',
        `Order ${orderId} completed and bumped from Packing Station. Final docket tape printed.`,
        'expeditor',
        currentUserRole,
        orderId
      );
    }
  };

  // --- RECALL / REMAKE EVENT HANDLERS (Section 13: Recalling and Remaking Completed Items) ---
  const handleItemRecall = (orderId: string, itemId: string) => {
    setOrders(prevOrders => {
      return prevOrders.map(order => {
        if (order.id !== orderId) return order;

        const updatedItems = order.items.map(item => {
          if (item.id !== itemId) return item;

          writeLog(
            'Item Recalled for Remake',
            `Item "${item.name}" RECALLED back to active kitchen queue for remake.`,
            'kitchen_staff',
            currentUserRole || 'kitchen_staff',
            orderId
          );

          return {
            ...item,
            completedQuantity: 0,
            packedQuantity: 0,
            status: 'recalled' as const,
            recalledAt: new Date().toISOString(),
          };
        });

        return {
          ...order,
          items: updatedItems,
          status: 'preparing', // reverts from ready_to_pack or completed back to active cooking!
          completedAt: undefined,
        };
      });
    });
  };

  const handleOrderRecall = (orderId: string) => {
    setOrders(prevOrders => {
      return prevOrders.map(order => {
        if (order.id !== orderId) return order;

        writeLog(
          'Full Order Recall',
          `Entire Order ${order.id} RECALLED for remake across all kitchen stations.`,
          'kitchen_staff',
          currentUserRole || 'expeditor',
          orderId
        );

        const updatedItems = order.items.map(item => ({
          ...item,
          completedQuantity: 0,
          packedQuantity: 0,
          status: 'recalled' as const,
          recalledAt: new Date().toISOString(),
        }));

        return {
          ...order,
          items: updatedItems,
          status: 'preparing',
          completedAt: undefined,
        };
      });
    });
  };

  const handleReprintDocket = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    writeLog(
      'Manual Docket Reprint',
      `Manual final packing docket reprint requested for order ${order.id}.`,
      'staff',
      currentUserRole,
      orderId
    );

    const docketContent = generatePackingDocketContent(order);
    queuePrintJob('pr-packing', `Reprint Final Docket: ${order.id}`, docketContent, orderId);
  };

  const handleManualReprint = (orderId: string, itemId: string, actingStationId: string = 'st-packing') => {
    const order = orders.find(o => o.id === orderId);
    const item = order?.items.find(i => i.id === itemId);
    if (!order || !item) return;

    // Trigger reprint logs & jobs
    writeLog(
      'Manual Label Reprint',
      `Manual sticky label reprint requested for item "${item.name}".`,
      'staff',
      currentUserRole,
      orderId
    );

    const labelContent = generateLabelPrintContent(order, item);
    // FIX: route to the ACTING station's own printer (wherever the reprint was
    // actually triggered from), never the item's owning production station —
    // those have no printer hardware at all in this deployment.
    const assignedPrinterId = config.stations.find(st => st.id === actingStationId)?.printerId || 'pr-packing';
    queuePrintJob(assignedPrinterId, `Reprint Label: 1x ${item.name}`, labelContent, orderId);

    // Increment reprint count
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return {
        ...o,
        items: o.items.map(it => it.id === itemId ? { ...it, reprintCount: it.reprintCount + 1 } : it),
      };
    }));
  };

  // --- MENU STOCK TOGGLES ---
  const handleStockToggle = (itemId: string, inStock?: boolean) => {
    let newInStockState = false;
    setMenuItems(prev => prev.map(item => {
      if (item.id === itemId) {
        newInStockState = inStock !== undefined ? inStock : !item.inStock;
        return { ...item, inStock: newInStockState };
      }
      return item;
    }));
    writeLog(
      'Catalog Inventory Sync',
      `Item "${menuItems.find(i => i.id === itemId)?.name}" marked ${newInStockState ? 'IN-STOCK' : 'OUT-OF-STOCK'}. Square POS updated.`,
      'manager',
      currentUserRole
    );
  };

  // --- SYSTEM LOG CLEARS ---
  const handleClearLogs = () => {
    setAuditLogs([]);
  };

  const handleClearPrintJobs = () => {
    setPrintJobs([]);
  };

  // --- CONFIG CHANGES ---
  const handleConfigChange = (newConfig: KDSConfig) => {
    setConfig(newConfig);
    writeLog(
      'KDS Config Updated',
      'Local stations, category routers, and printer mappings updated successfully.',
      'administrator',
      'administrator'
    );
  };

  const handlePrinterAdd = (newPrinter: Printer) => {
    setPrinters(prev => [...prev, newPrinter]);
    writeLog(
      'Hardware Registered',
      `New thermal printer "${newPrinter.name}" successfully integrated to local subnet.`,
      'administrator',
      'administrator'
    );
  };

  const handlePrinterDelete = (printerId: string) => {
    setPrinters(prev => prev.filter(p => p.id !== printerId));
    writeLog(
      'Hardware Deregistered',
      `Thermal printer with ID "${printerId}" removed from network interface.`,
      'administrator',
      'administrator'
    );
  };

  return (
    <div className="min-h-screen bg-[#F8F3EA] flex flex-col text-[#2D1412] font-sans" id="app-viewport">
      
      {/* 1. TOP STATUS UTILITY HEADER */}
      <header className="bg-[#3F1C1A] text-[#EDD7A1] border-b border-[#454024] px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-md" id="header">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#E5A330] text-[#3F1C1A] rounded-xl shadow-sm">
            <MonitorPlay className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-lg font-display uppercase tracking-wider text-[#EDD7A1] flex items-center gap-2 font-extrabold">
              Sufra KDS & POS
            </h1>
            <p className="text-[10px] text-[#EDD7A1]/80 font-mono tracking-widest uppercase font-bold">
              Lebanese & Afghan Kitchen • Local KDS Node • Webhooks Connected
            </p>
          </div>
        </div>

        {/* System Health Indicators */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Internet Status Toggle */}
          <button
            id="btn-toggle-internet"
            onClick={handleToggleInternet}
            className={`px-3 py-1.5 rounded-lg border font-mono text-[9px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isOffline
                ? 'bg-rose-950/60 border-rose-700 text-rose-300 hover:bg-rose-900'
                : 'bg-[#454024] border-[#E5A330]/40 text-[#EDD7A1] hover:bg-[#454024]/80'
            }`}
          >
            {isOffline ? (
              <>
                <WifiOff className="h-3.5 w-3.5 text-rose-400" /> NET: OFFLINE (BUFFERED)
              </>
            ) : (
              <>
                <Wifi className="h-3.5 w-3.5 text-[#E5A330]" /> NET: ONLINE
              </>
            )}
          </button>

          {/* Backend Connectivity Indicator — separate from the simulated internet
              toggle above, which only affects Square order buffering. This shows
              whether the REAL backend (once deployed) is actually reachable. */}
          <span
            id="backend-connection-status"
            title={isBackendConnected ? 'Connected to the live backend — using real data.' : 'Backend not reachable — running on local demo data.'}
            className={`px-3 py-1.5 rounded-lg border font-mono text-[9px] font-bold flex items-center gap-1.5 ${
              isBackendConnected
                ? 'bg-emerald-950/40 border-emerald-700 text-emerald-300'
                : 'bg-stone-800 border-stone-700 text-stone-400'
            }`}
          >
            {isBackendConnected ? 'BACKEND: LIVE' : 'BACKEND: DEMO DATA'}
          </span>

          {/* Device Identity: no per-staff login. Either paired-and-open, or Admin Mode. */}
          {isAdminMode ? (
            <div className="flex items-center bg-[#E5A330]/20 border border-[#E5A330] rounded-lg px-2.5 py-1.5 gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-[#E5A330]" />
              <span className="text-[9px] text-[#EDD7A1] uppercase font-mono font-bold">Admin Mode — full access</span>
              <button
                id="btn-admin-logout"
                onClick={handleAdminLogout}
                className="text-[9px] font-mono font-bold text-[#E5A330] underline hover:text-white cursor-pointer"
              >
                Log Out
              </button>
            </div>
          ) : (
            <div className="flex items-center bg-[#2D1412] border border-[#454024] rounded-lg px-2.5 py-1.5 gap-2">
              <User className="h-3.5 w-3.5 text-[#EDD7A1]/60" />
              <span className="text-[9px] text-[#EDD7A1]/70 uppercase font-mono font-bold">
                This device: no login required
              </span>
              <button
                id="btn-admin-login-open"
                onClick={() => setShowAdminLogin(true)}
                className="text-[9px] font-mono font-bold text-[#E5A330] underline hover:text-white cursor-pointer"
              >
                Admin Login
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ADMIN LOGIN MODAL — the only login screen in the whole system */}
      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" id="admin-login-modal">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand-orange" />
              <h3 className="font-tech font-bold text-sm uppercase tracking-wider text-stone-900">Admin Login</h3>
            </div>
            <p className="text-xs text-stone-500">
              Kitchen staff never log in. Admin login is only for configuration, stock, and audit access.
            </p>
            {!isBackendConnected && (
              <p className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-2">
                Backend not connected — using local demo login. Use: admin@sufra.example / ChangeMe123!
              </p>
            )}
            <input
              id="input-admin-email"
              type="email"
              value={adminEmailInput}
              onChange={(e) => setAdminEmailInput(e.target.value)}
              placeholder="admin@sufra.example"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-brand-orange"
              autoFocus
            />
            <input
              id="input-admin-password"
              type="password"
              value={adminPasswordInput}
              onChange={(e) => setAdminPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdminLoginAttempt()}
              placeholder="Password"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-brand-orange"
            />
            {adminLoginError && <p className="text-xs text-rose-600 font-bold">{adminLoginError}</p>}
            <div className="flex gap-2">
              <button
                id="btn-admin-login-submit"
                onClick={handleAdminLoginAttempt}
                className="flex-1 bg-brand-orange text-white rounded-lg py-2 text-xs font-bold uppercase cursor-pointer hover:bg-orange-600"
              >
                Log In
              </button>
              <button
                id="btn-admin-login-cancel"
                onClick={() => { setShowAdminLogin(false); setAdminEmailInput(''); setAdminPasswordInput(''); setAdminLoginError(null); }}
                className="flex-1 bg-stone-100 text-stone-700 rounded-lg py-2 text-xs font-bold uppercase cursor-pointer hover:bg-stone-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. LIVE METRICS BAR */}
      <section className="bg-[#EDD7A1]/30 border-b border-[#EDD7A1] px-6 py-3 grid grid-cols-2 md:grid-cols-4 gap-4" id="metrics-bar">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#E5A330]" />
          <span className="text-xs text-[#3F1C1A] font-mono font-bold">
            ACTIVE ORDERS: <strong className="text-[#3F1C1A] font-black">{orders.filter(o => o.status !== 'completed').length}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <PackageCheck className="h-4 w-4 text-[#426998]" />
          <span className="text-xs text-[#3F1C1A] font-mono font-bold">
            COMPLETED: <strong className="text-[#3F1C1A] font-black">{orders.filter(o => o.status === 'completed').length}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <PrinterIcon className="h-4 w-4 text-[#426998]" />
          <span className="text-xs text-[#3F1C1A] font-mono font-bold">
            PRINTERS: <strong className="text-[#3F1C1A] font-black">{printers.filter(p => p.status === 'online').length}/{printers.length}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-[#E5A330] animate-pulse" />
          <span className="text-xs text-[#3F1C1A] font-mono font-bold">
            OFFLINE QUEUE: <strong className="text-[#3F1C1A] font-black">{offlineBufferQueue.length}</strong>
          </span>
        </div>
      </section>

      {/* 3. WORKSPACE PERSPECTIVE TOGGLE */}
      <div className="bg-[#F8F3EA] border-b border-[#EDD7A1] px-6 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3" id="workspace-controls">
        <div className="flex flex-wrap gap-2">
          <button
            id="btn-tab-split"
            onClick={() => setActiveWorkspaceTab('split')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-tech font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              activeWorkspaceTab === 'split'
                ? 'bg-[#3F1C1A] text-[#EDD7A1] border-[#3F1C1A] shadow-sm'
                : 'bg-white text-[#3F1C1A] border-[#EDD7A1] hover:bg-[#EDD7A1]/20'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5 text-[#E5A330]" /> SIDE-BY-SIDE SIMULATOR
          </button>
          <button
            id="btn-tab-single"
            onClick={() => setActiveWorkspaceTab('single')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-tech font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              activeWorkspaceTab === 'single'
                ? 'bg-[#3F1C1A] text-[#EDD7A1] border-[#3F1C1A] shadow-sm'
                : 'bg-white text-[#3F1C1A] border-[#EDD7A1] hover:bg-[#EDD7A1]/20'
            }`}
          >
            <MonitorPlay className="h-3.5 w-3.5 text-[#E5A330]" /> SINGLE DEVICE SCREEN
          </button>
          <button
            id="btn-tab-dashboard"
            onClick={() => setActiveWorkspaceTab('dashboard')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-tech font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              activeWorkspaceTab === 'dashboard'
                ? 'bg-[#3F1C1A] text-[#EDD7A1] border-[#3F1C1A] shadow-sm'
                : 'bg-white text-[#3F1C1A] border-[#EDD7A1] hover:bg-[#EDD7A1]/20'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5 text-[#E5A330]" /> OPERATIONS DASHBOARD
          </button>
          <button
            id="btn-tab-customer"
            onClick={() => setActiveWorkspaceTab('customer')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-tech font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              activeWorkspaceTab === 'customer'
                ? 'bg-[#3F1C1A] text-[#EDD7A1] border-[#3F1C1A] shadow-sm'
                : 'bg-white text-[#3F1C1A] border-[#EDD7A1] hover:bg-[#EDD7A1]/20'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-[#E5A330]" /> CUSTOMER ORDER DISPLAY
          </button>
        </div>

        <div className="text-[10px] font-mono font-bold text-[#454024] uppercase tracking-wider">
          Sufra Kitchen Operations Console
        </div>
      </div>

      {/* 4. MAIN WORKSPACE CONTAINER */}
      <main className="flex-1 p-6" id="workspace-viewport">
        
        {/* --- PERSPECTIVE A: SPLIT SCREEN (EXCELLENT FOR INSTANT DEMOING) --- */}
        {activeWorkspaceTab === 'split' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            
            {/* Left Column (5 Cols): Square POS Terminal */}
            <div className="xl:col-span-5 space-y-6">
              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4 border-b border-stone-100 pb-3">
                  <Play className="h-4 w-4 text-brand-orange" />
                  <span className="text-xs font-mono font-bold text-stone-750 tracking-widest">POS REGISTER</span>
                </div>
                <POSSimulator
                  menuItems={menuItems}
                  onOrderSubmit={handleOrderSubmit}
                  isOffline={isOffline}
                />
              </div>

              {/* Virtual Printer Tapes Mini-Feed */}
              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-3 border-b border-stone-100 pb-2">
                  <span className="text-xs font-mono font-bold text-stone-750 uppercase tracking-widest">PRINTER SPOOLER</span>
                  <span className="text-[9px] font-mono bg-stone-100 text-stone-600 px-2 py-0.5 rounded font-bold uppercase">{printJobs.length} slips</span>
                </div>
                <div className="h-44 overflow-y-auto space-y-2 font-mono text-[10px] pr-1">
                  {printJobs.length === 0 ? (
                    <div className="text-stone-400 text-center py-10 flex flex-col items-center gap-1">
                      <span>No print jobs.</span>
                      <span className="text-[9px] text-stone-400">Items or bump events route tickets here.</span>
                    </div>
                  ) : (
                    printJobs.slice().reverse().map(job => (
                      <div key={job.id} className="p-2.5 bg-stone-50 border border-stone-100 rounded-md flex justify-between items-center">
                        <span className="text-stone-700 font-medium font-tech">{job.title}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${job.status === 'printed' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          {job.status.toUpperCase()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column (7 Cols): Multi-KDS Station Screen Swapper */}
            <div className="xl:col-span-7 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-stone-200 pb-3 gap-3">
                <span className="text-xs font-mono font-bold text-stone-750 uppercase tracking-widest">KDS STATIONS</span>
                
                {/* Selector for active kitchen screen */}
                <div className="flex flex-wrap gap-1">
                  {config.stations.map((st) => (
                    <button
                      id={`btn-station-tab-${st.id}`}
                      key={st.id}
                      onClick={() => setActiveStationId(st.id)}
                      className={`px-3 py-1.5 text-[10px] font-tech font-bold rounded-lg border transition-all cursor-pointer uppercase ${
                        activeStationId === st.id
                          ? 'bg-stone-900 border-stone-900 text-white shadow-sm'
                          : 'bg-white border-stone-250 text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                      }`}
                    >
                      {st.name.replace(' Station', '')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Render the selected screen kiosk */}
              {config.stations.find(s => s.id === activeStationId) && (
                <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
                  <KDSStationView
                    station={config.stations.find(s => s.id === activeStationId)!}
                    orders={orders}
                    menuItems={menuItems}
                    onToggleStock={handleStockToggle}
                    onItemBump={handleItemBump}
                    onPackingItemBump={handlePackingItemBump}
                    onOrderComplete={handleOrderComplete}
                    onOrderRecall={handleOrderRecall}
                    onItemRecall={handleItemRecall}
                    onReprintDocket={handleReprintDocket}
                    onManualReprint={handleManualReprint}
                    currentUserRole={currentUserRole}
                    allStations={config.stations}
                    pendingBumps={pendingBumps}
                    onUndoBump={handleUndoBump}
                    config={config}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- PERSPECTIVE B: SINGLE FULLSCREEN SIMULATION --- */}
        {activeWorkspaceTab === 'single' && (
          <div className="space-y-6">
            
            {/* Workspace tabs */}
            <div className="flex flex-wrap gap-1.5 border-b border-stone-200 pb-4" id="workspace-tabs-group">
              <button
                id="btn-single-dashboard"
                onClick={() => setSingleViewTab('dashboard')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer border transition-all ${
                  singleViewTab === 'dashboard' ? 'bg-brand-orange text-white border-brand-orange shadow-sm' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" /> Operations Dashboard
              </button>
              <button
                id="btn-single-pos"
                onClick={() => setSingleViewTab('pos')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer border transition-all ${
                  singleViewTab === 'pos' ? 'bg-brand-orange text-white border-brand-orange shadow-sm' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                <Tag className="h-3.5 w-3.5" /> Order Entry (POS)
              </button>
              <button
                id="btn-single-kds"
                onClick={() => setSingleViewTab('kds')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer border transition-all ${
                  singleViewTab === 'kds' ? 'bg-brand-orange text-white border-brand-orange shadow-sm' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Kitchen & Packing KDS
              </button>
              <button
                id="btn-single-expeditor"
                onClick={() => setSingleViewTab('expeditor')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer border transition-all ${
                  singleViewTab === 'expeditor' ? 'bg-brand-orange text-white border-brand-orange shadow-sm' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                <Settings className="h-3.5 w-3.5" /> Expeditor & Handoff Logs
              </button>
              <button
                id="btn-single-printers"
                onClick={() => setSingleViewTab('printers')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer border transition-all ${
                  singleViewTab === 'printers' ? 'bg-brand-orange text-white border-brand-orange shadow-sm' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                <PrinterIcon className="h-3.5 w-3.5" /> Spoolers & Printers
              </button>
              <button
                id="btn-single-stock"
                onClick={() => setSingleViewTab('stock')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer border transition-all ${
                  singleViewTab === 'stock' ? 'bg-brand-orange text-white border-brand-orange shadow-sm' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                <PackageCheck className="h-3.5 w-3.5" /> Menu & Stock Controls
              </button>
              <button
                id="btn-single-admin"
                onClick={() => setSingleViewTab('admin')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer border transition-all ${
                  singleViewTab === 'admin' ? 'bg-brand-orange text-white border-brand-orange shadow-sm' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                <Settings className="h-3.5 w-3.5" /> Server Admin
              </button>
              <button
                id="btn-single-logs"
                onClick={() => setSingleViewTab('logs')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer border transition-all ${
                  singleViewTab === 'logs' ? 'bg-brand-orange text-white border-brand-orange shadow-sm' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                <Database className="h-3.5 w-3.5" /> Audit Security Logs
              </button>
            </div>

            {/* Render single panel content */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
              {singleViewTab === 'dashboard' && (
                <KitchenDashboard
                  orders={orders}
                  stations={config.stations}
                  menuItems={menuItems}
                  onSimulateRush={handleSimulateRush}
                  isOffline={isOffline}
                  currentUserRole={currentUserRole}
                />
              )}

              {singleViewTab === 'pos' && (
                <POSSimulator
                  menuItems={menuItems}
                  onOrderSubmit={handleOrderSubmit}
                  isOffline={isOffline}
                />
              )}

              {singleViewTab === 'kds' && (
                <div className="space-y-4">
                  <div className="flex gap-1.5 border-b border-stone-100 pb-3">
                    {config.stations.map((st) => (
                      <button
                        id={`btn-single-station-${st.id}`}
                        key={st.id}
                        onClick={() => setActiveStationId(st.id)}
                        className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                          activeStationId === st.id
                            ? 'bg-stone-900 border-stone-900 text-white shadow-sm'
                            : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                        }`}
                      >
                        {st.name}
                      </button>
                    ))}
                  </div>

                  {config.stations.find(s => s.id === activeStationId) && (
                    <KDSStationView
                      station={config.stations.find(s => s.id === activeStationId)!}
                      orders={orders}
                      menuItems={menuItems}
                      onToggleStock={handleStockToggle}
                      onItemBump={handleItemBump}
                      onPackingItemBump={handlePackingItemBump}
                      onOrderComplete={handleOrderComplete}
                      onOrderRecall={handleOrderRecall}
                      onItemRecall={handleItemRecall}
                      onReprintDocket={handleReprintDocket}
                      onManualReprint={handleManualReprint}
                      currentUserRole={currentUserRole}
                      allStations={config.stations}
                      pendingBumps={pendingBumps}
                      onUndoBump={handleUndoBump}
                      config={config}
                    />
                  )}
                </div>
              )}

              {singleViewTab === 'expeditor' && (
                <ExpeditorView
                  orders={orders}
                  stations={config.stations}
                  onItemRecall={handleItemRecall}
                  onOrderRecall={handleOrderRecall}
                  onReprintDocket={handleReprintDocket}
                  onManualReprint={handleManualReprint}
                  onOrderComplete={handleOrderComplete}
                  currentUserRole={currentUserRole}
                />
              )}

              {singleViewTab === 'printers' && (
                <PrintersLog
                  printers={printers}
                  printJobs={printJobs}
                  togglePrinterStatus={togglePrinterStatus}
                  clearPrintJobs={handleClearPrintJobs}
                  retryAllFailedJobs={retryAllFailedJobs}
                />
              )}

              {singleViewTab === 'stock' && (
                isAdminMode ? (
                  <StockManager
                    menuItems={menuItems}
                    onStockToggle={handleStockToggle}
                    currentUserRole={currentUserRole}
                  />
                ) : (
                  <AdminLockNotice onLoginClick={() => setShowAdminLogin(true)} label="stock and out-of-stock controls" />
                )
              )}

              {singleViewTab === 'admin' && (
                isAdminMode ? (
                <AdminConfig
                  config={config}
                  printers={printers}
                  menuItems={menuItems}
                  onConfigChange={handleConfigChange}
                  onPrinterAdd={handlePrinterAdd}
                  onPrinterDelete={handlePrinterDelete}
                />
                ) : (
                  <AdminLockNotice onLoginClick={() => setShowAdminLogin(true)} label="stations, routing, printers and venue configuration" />
                )
              )}

              {singleViewTab === 'logs' && (
                isAdminMode ? (
                  <AuditLogs
                    logs={auditLogs}
                    onClearLogs={handleClearLogs}
                  />
                ) : (
                  <AdminLockNotice onLoginClick={() => setShowAdminLogin(true)} label="the audit log" />
                )
              )}
            </div>
          </div>
        )}

        {/* --- PERSPECTIVE C: TOP-LEVEL OPERATIONS DASHBOARD --- */}
        {activeWorkspaceTab === 'dashboard' && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
            <KitchenDashboard
              orders={orders}
              stations={config.stations}
              menuItems={menuItems}
              onSimulateRush={handleSimulateRush}
              isOffline={isOffline}
              currentUserRole={currentUserRole}
            />
          </div>
        )}

        {/* --- PERSPECTIVE D: CUSTOMER ORDER PROGRESS DISPLAY --- */}
        {activeWorkspaceTab === 'customer' && (
          <CustomerDisplay orders={orders} />
        )}
      </main>

      {/* FOOTER DOCS GUIDE BRIEF */}
      <footer className="bg-white border-t border-stone-200 px-6 py-5 flex flex-col md:flex-row justify-between items-center text-xs text-stone-500 gap-3" id="footer-copyright">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-stone-400" />
          <span>Kitchen Management System • Resilient off-grid thermal print spooler & live sync sandbox.</span>
        </div>
        <div>
          <span>Restaurant Operations Control Engine © 2026</span>
        </div>
      </footer>
    </div>
  );
}
