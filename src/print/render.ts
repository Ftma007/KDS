// Draws the client-approved sticker and order-ticket designs onto a canvas, so the
// printer prints exactly what he approved (Square's layout: "2 of 6", the order number
// big, date/time with the name on the right, then the item and its extras; Uber orders
// with a black UBER EATS banner and the customer's name big; delivery with a DELIVERY
// banner and the address on the order ticket).

export interface LabelPayload {
  kind: 'label';
  orderNumber: string;
  customerName: string;
  service: string; // Takeaway / Table 4 / Delivery / Courier pickup
  isUber: boolean;
  isDelivery: boolean;
  placedAt: string;
  dueAt?: string | null; // Square pickup/delivery time
  unit: number;
  of: number;
  orderUnit?: number;
  orderUnits?: number;
  itemName: string;
  modifiers: string[];
  remake?: boolean;
  reprint?: boolean;
}

export interface TicketPayload {
  kind: 'ticket';
  orderNumber: string;
  customerName: string;
  service: string;
  isUber: boolean;
  isDelivery: boolean;
  placedAt: string;
  dueAt?: string | null;
  itemCount: number;
  items: { qty: number; name: string; modifiers: string[] }[];
  deliveryAddress?: string | null;
  reprint?: boolean;
}

export type PrintPayload = LabelPayload | TicketPayload;

const FONT = '"DejaVu Sans", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Draws one sticker or ticket. widthDots: 576 for 80 mm paper, 384 for 58 mm. */
export function drawPrint(payload: PrintPayload, widthDots = 576): HTMLCanvasElement {
  const W = widthDots;
  const s = W / 576; // the approved designs were made at 576 dots
  const PAD = Math.round(28 * s);
  const work = document.createElement('canvas');
  work.width = W;
  work.height = 4000;
  const ctx = work.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, work.height);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';
  let y = PAD;

  const font = (size: number, bold = false) => `${bold ? 'bold ' : ''}${Math.max(8, Math.round(size * s))}px ${FONT}`;
  const inner = W - 2 * PAD;
  const wrap = (t: string, maxW: number) => {
    const words = t.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (ctx.measureText(next).width > maxW && line) { lines.push(line); line = w; } else line = next;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  };
  /** Wrapped text; or, with shrink, one line made smaller until it fits (big numbers/names). */
  const text = (t: string, size: number, bold = false, indent = 0, shrink = false) => {
    const x = PAD + Math.round(indent * s);
    const maxW = inner - Math.round(indent * s);
    if (shrink) {
      let sz = size;
      ctx.font = font(sz, bold);
      while (ctx.measureText(t).width > maxW && sz > 20) { sz -= 2; ctx.font = font(sz, bold); }
      ctx.fillText(t, x, y);
      y += Math.round(sz * 1.25 * s);
      return;
    }
    ctx.font = font(size, bold);
    for (const line of wrap(t, maxW)) { ctx.fillText(line, x, y); y += Math.round(size * 1.25 * s); }
  };
  const row = (left: string, right: string, size = 24) => {
    ctx.font = font(size);
    ctx.fillText(left, PAD, y);
    if (right) ctx.fillText(right, W - PAD - ctx.measureText(right).width, y);
    y += Math.round(size * 1.3 * s);
  };
  const band = (t: string) => {
    ctx.fillRect(PAD, y, inner, Math.round(50 * s));
    ctx.fillStyle = '#fff';
    ctx.font = font(30, true);
    ctx.fillText(t, PAD + Math.round(14 * s), y + Math.round(7 * s));
    ctx.fillStyle = '#000';
    y += Math.round(64 * s);
  };
  const rule = (thickness: number) => {
    y += Math.round(6 * s);
    const h = Math.max(1, Math.round(thickness * s));
    ctx.fillRect(PAD, y, inner, h);
    y += h + Math.round(14 * s);
  };
  const gap = (px: number) => { y += Math.round(px * s); };

  const placed = new Date(payload.placedAt);
  const dateStr = placed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = placed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const due = payload.dueAt ? new Date(payload.dueAt) : null;
  const dueStr = due && !isNaN(due.getTime()) ? due.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;
  // Approved: "Prepare by" on Uber, "Deliver by" on delivery, when Square gives a time.
  const uberTime = dueStr ? `Prepare by ${dueStr}` : timeStr;
  const deliveryTime = dueStr ? `Deliver by ${dueStr}` : timeStr;

  if (payload.kind === 'label') {
    const seq = `${payload.orderUnit ?? payload.unit} of ${payload.orderUnits ?? payload.of}`;
    if (payload.isUber) {
      band('UBER EATS');
      text(seq, 26);
      text(payload.customerName, 96, true, 0, true); // approved: name big
      text(`Order #${payload.orderNumber}`, 40, true, 0, true); // approved: order number smaller
      rule(4);
      row(dateStr, 'Courier pickup');
      row(uberTime, '');
    } else {
      if (payload.isDelivery) band('DELIVERY');
      text(seq, 26);
      text(payload.orderNumber, 96, true, 0, true);
      rule(4);
      row(dateStr, payload.customerName);
      row(payload.isDelivery ? deliveryTime : timeStr, payload.isDelivery ? '' : payload.service);
    }
    rule(2);
    text(payload.itemName, 36, true);
    for (const m of payload.modifiers) text(m, 28);
  } else {
    if (payload.isUber) band('UBER EATS');
    else if (payload.isDelivery) band('DELIVERY');
    text(`Order complete  \u00b7  ${payload.itemCount} item${payload.itemCount === 1 ? '' : 's'}`, 26);
    if (payload.isUber) {
      text(payload.customerName, 96, true, 0, true);
      text(`Order #${payload.orderNumber}`, 40, true, 0, true);
    } else {
      text(payload.orderNumber, 96, true, 0, true);
    }
    rule(4);
    row(dateStr, payload.isUber ? 'Courier pickup' : payload.customerName);
    row(payload.isUber ? uberTime : payload.isDelivery ? deliveryTime : timeStr, payload.isUber || payload.isDelivery ? '' : payload.service);
    rule(2);
    if (payload.isDelivery && payload.deliveryAddress) {
      text('Deliver to', 26, true);
      for (const part of payload.deliveryAddress.split(/,\s*/)) text(part, 28);
      rule(2);
    }
    for (const it of payload.items) {
      text(`${it.qty}   ${it.name}`, 30, true);
      for (const m of it.modifiers) text(m, 26, false, 52);
      gap(4);
    }
    rule(2);
  }

  // Crop to the content.
  const out = document.createElement('canvas');
  out.width = W;
  out.height = y + PAD;
  const octx = out.getContext('2d')!;
  octx.fillStyle = '#fff';
  octx.fillRect(0, 0, W, out.height);
  octx.drawImage(work, 0, 0);
  return out;
}

/** For jobs without structured details (older jobs): print their text lines plainly. */
export function drawPlainText(content: string, widthDots = 576): HTMLCanvasElement {
  const lines = content.split('\n');
  const s = widthDots / 576;
  const c = document.createElement('canvas');
  c.width = widthDots;
  c.height = Math.round((lines.length * 34 + 56) * s);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';
  ctx.font = `${Math.round(26 * s)}px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, Math.round(28 * s), Math.round((28 + i * 34) * s)));
  return c;
}
