export type UserRole = 'administrator' | 'manager' | 'kitchen_staff' | 'expeditor' | 'station_device';

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  stationId: string; // which station prepares it
  inStock: boolean;
  stationIds?: string[]; // live: every station that makes this item (item routing, else its category's station)
  hasItemRouting?: boolean;
}

export interface KDSStation {
  id: string;
  name: string;
  color: string; // Tailwind border/bg color code
  printerId: string;
  labelPrintingEnabled?: boolean; // Per-station Label Printing (On/Off)
  isPackingStation?: boolean; // live data: set by the server (demo: id 'st-packing')
  isDocketHandlingStation?: boolean;
  showOtherStationItems?: boolean; // On (default): tickets also show other stations' items for context. Off: only this station's own items and orders. Packing & Pass always sees everything.
}

export interface OrderItem {
  id: string; // unique instance ID for this order line
  menuItemId: string;
  name: string;
  quantity: number;
  completedQuantity: number; // For quantity-based preparation bumping at Prep Station
  packedQuantity: number; // For quantity-based packing at Packing Station
  status: 'pending' | 'preparing' | 'completed' | 'recalled';
  stationId: string; // assigned station
  reprintCount: number;
  lastBumpedAt?: string;
  recalledAt?: string;
  modifiers?: string[];
}

export interface Order {
  id: string; // unique key. Demo: SQ-1001. Live: the server's id
  displayId?: string; // the number shown on screen when it differs from id (live: Square's ticket number)
  source: string; // e.g. Square POS, Online Store, Uber Eats
  customerName: string;
  tableNumber?: string;
  createdAt: string;
  completedAt?: string;
  status: 'received' | 'preparing' | 'ready_to_pack' | 'completed';
  comboName?: string; // E.g., 'Afghan Feast Combo'
  items: OrderItem[];
  notes?: string;
}

export interface Printer {
  id: string;
  name: string;
  type: 'label' | 'receipt';
  status: 'online' | 'offline' | 'jammed';
  stationId?: string; // which station owns it
}

export interface PrintJob {
  id: string;
  printerId: string;
  title: string;
  content: string; // Text mockup
  timestamp: string;
  status: 'pending' | 'printed' | 'failed';
  attempts: number;
  errorMessage?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userRole: UserRole;
  action: string;
  station?: string;
  orderId?: string;
  details: string;
}

export interface KDSConfig {
  stations: KDSStation[];
  categoryRouting: Record<string, string>; // category -> stationId
  displayOrder: string[]; // stationIds order
  undoGracePeriodSeconds: 0 | 3 | 5 | 10; // 5-Second Undo Grace Period
  fadeEmptyStationOrders: boolean; // Empty-station order display
  storageVersion?: string;
}

export interface PendingBump {
  id: string;
  orderId: string;
  itemId?: string;
  bumpType: 'item_prep' | 'item_pack' | 'order_complete';
  itemPreviousQty: { completed: number; packed: number; status: string };
  orderPreviousStatus: 'received' | 'preparing' | 'ready_to_pack' | 'completed';
  scheduledPrintJobs: Array<{ printerId: string; title: string; content: string; orderId?: string }>;
  willCompleteOrder?: boolean;
  secondsRemaining: number;
  totalSeconds: number;
  startTime: number;
}

/** The order number to show people. Live orders show Square's number; demo orders their id. */
export const orderLabel = (o: { id: string; displayId?: string }): string => o.displayId || o.id;

/** Packing & Pass: the server's flag on live data, the 'st-packing' id on demo data. */
export const isPackingStationObj = (st?: { id: string; isPackingStation?: boolean } | null): boolean =>
  !!st && (st.isPackingStation === true || st.id === 'st-packing');
