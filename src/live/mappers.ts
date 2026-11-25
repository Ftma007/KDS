// Turns the server's data into exactly the shapes the approved screens already
// use, so the screens themselves don't change between demo and live.
import { Order, OrderItem, KDSStation, MenuItem, Printer, KDSConfig } from '../types';

// The "Border glow theme" choices in Admin. The server's first-time setup stored
// hex colours, so anything that isn't one of these names gets one by position.
const GLOW_NAMES = ['orange', 'red', 'blue', 'emerald', 'indigo'];

export function mapStations(server: any[]): KDSStation[] {
  return server.map((s, i) => ({
    id: String(s._id),
    name: s.name,
    color: GLOW_NAMES.includes(s.color) ? s.color : s.isPackingStation ? 'indigo' : GLOW_NAMES[i % 4],
    printerId: s.printerId ? String(s.printerId) : '',
    labelPrintingEnabled: !!s.labelPrintingEnabled,
    isPackingStation: !!s.isPackingStation,
    isDocketHandlingStation: !!s.isDocketHandlingStation,
    showOtherStationItems: s.showOtherStationItems !== false,
  }));
}

export function mapMenuItem(m: any): MenuItem {
  return {
    id: String(m._id),
    name: m.name,
    category: m.category,
    price: Number(m.price || 0),
    stationId: m.stationId ? String(m.stationId) : '',
    inStock: m.inStock !== false,
  };
}

export function mapOrder(o: any): Order {
  return {
    id: String(o._id),
    displayId: o.displayId,
    source: o.source === 'Online Store' ? 'Online Store' : 'Square POS',
    customerName: o.customerName,
    // Real orders carry just the number; the approved screens read "Table 4".
    tableNumber: o.tableNumber ? (/^\d+$/.test(String(o.tableNumber).trim()) ? `Table ${String(o.tableNumber).trim()}` : String(o.tableNumber)) : undefined,
    createdAt: o.createdAt,
    completedAt: o.completedAt || undefined,
    status: o.status,
    comboName: o.comboName || undefined,
    notes: o.notes || undefined,
    items: (o.items || []).map(
      (i: any): OrderItem => ({
        id: i.itemId,
        menuItemId: i.menuItemId ? String(i.menuItemId) : '',
        name: i.name,
        quantity: i.quantity,
        completedQuantity: i.completedQuantity,
        packedQuantity: i.packedQuantity,
        status: i.status,
        stationId: String(i.stationId),
        reprintCount: i.reprintCount || 0,
        lastBumpedAt: i.lastBumpedAt || undefined,
        recalledAt: i.recalledAt || undefined,
        modifiers: i.modifiers && i.modifiers.length ? i.modifiers : undefined,
      })
    ),
  };
}

export function mapPrinter(p: any): Printer {
  return {
    id: String(p._id),
    name: p.name,
    type: p.type === 'label' ? 'label' : 'receipt',
    status: p.status === 'offline' || p.status === 'jammed' ? p.status : 'online',
  };
}

export function applyServerConfig(prev: KDSConfig, stations: KDSStation[], serverConfig: any): KDSConfig {
  const grace = [0, 3, 5, 10].includes(serverConfig?.undoGracePeriodSeconds) ? serverConfig.undoGracePeriodSeconds : 5;
  return {
    ...prev,
    stations,
    displayOrder: stations.map((s) => s.id),
    categoryRouting: serverConfig?.categoryRouting || {},
    undoGracePeriodSeconds: grace,
  };
}
