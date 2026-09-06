import { Order, OrderItem, Printer, PrintJob } from './types';

export function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '00:00:00';
  }
}

export function getDurationMinutes(isoString: string): number {
  try {
    const start = new Date(isoString).getTime();
    const end = Date.now();
    return Math.max(0, Math.floor((end - start) / 60000));
  } catch {
    return 0;
  }
}

export function formatDuration(isoString: string): string {
  const mins = getDurationMinutes(isoString);
  if (mins === 0) return 'Just now';
  return `${mins}m ago`;
}

export function generateLabelPrintContent(order: Order, item: OrderItem): string {
  const timestamp = new Date().toLocaleTimeString();
  const border = '═'.repeat(32);
  const divider = '─'.repeat(32);
  
  const modsText = item.modifiers && item.modifiers.length > 0
    ? item.modifiers.map(m => ` • ${m}`).join('\n')
    : '';

  return `${border}
       STICKY LABEL - COMPLETED
${border}
ORDER ID : ${order.id}
STATION  : ${item.stationId.toUpperCase()}
TIME     : ${timestamp}
CUSTOMER : ${order.customerName}
${order.tableNumber ? `TABLE    : ${order.tableNumber}` : 'DELIVERY / TAKEAWAY'}
${order.comboName ? `COMBO    : ${order.comboName}` : ''}
${divider}
ITEM     : 1x ${item.name}
${modsText ? `MODIFIERS:\n${modsText}\n` : ''}${order.notes ? `* NOTES  : ${order.notes}\n` : ''}${divider}
[ UNIT COMPLETED & BUMPED ]
${border}`;
}

export function generatePackingDocketContent(order: Order): string {
  const timestamp = new Date().toLocaleTimeString();
  const border = '█'.repeat(32);
  const divider = '─'.repeat(32);
  
  const itemsText = order.items.map(item => {
    return `[X] ${item.completedQuantity}/${item.quantity}x ${item.name}`;
  }).join('\n');

  return `${border}
     FINAL PACKING DOCKET
${border}
ORDER ID   : ${order.id}
SOURCE     : ${order.source}
TIME READY : ${timestamp}
CUSTOMER   : ${order.customerName}
LOC        : ${order.tableNumber || 'Takeaway'}
${divider}
ALL STATIONS SIGNED-OFF:
${itemsText}
${divider}
${order.notes ? `SPECIAL INST: ${order.notes}\n${divider}` : ''}
READY FOR CLIENT HANDOFF / PICKUP
${border}`;
}

export function createRandomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}
