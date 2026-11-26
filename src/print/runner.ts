// The Packing & Pass app's print runner: takes jobs from the server queue, prints them
// on the network printer, and reports each result. Rule: a label is never printed twice
// unless a person decides ("Check This Label").
//
// A small note on this device records how far each job got, so after a restart:
//   claimed, never sent      -> back to the queue (nothing reached the printer)
//   could not connect        -> back to the queue, retried after a pause
//   fully sent               -> reported printed (no reprint)
//   interrupted or unknown   -> "uncertain": staff choose Reprint or Mark as printed

import { api } from '../api/client';
import { drawPrint, drawPlainText, PrintPayload } from './render';
import { toMonoBitmap, starPrntCommands, starGraphicCommands, toBase64 } from './starCommands';

export interface PrinterTarget { name?: string; ipAddress?: string | null; port?: number; paperWidthMm?: number; commandMode?: string }
export interface RunnerState { status: 'idle' | 'printing' | 'offline' | 'error'; message?: string }
type Stage = 'claimed' | 'sending' | 'notsent' | 'printed';

const NOTE_KEY = 'kds_print_progress';

function nativePrinter(): any | null {
  const w = window as any;
  return w.Capacitor?.Plugins?.KdsNative?.rawPrintBytes ? w.Capacitor.Plugins.KdsNative : null;
}
export const canPrintHere = () => !!nativePrinter();

const notes = {
  all(): Record<string, Stage> { try { return JSON.parse(localStorage.getItem(NOTE_KEY) || '{}'); } catch { return {}; } },
  set(id: string, stage: Stage) { const n = notes.all(); n[id] = stage; try { localStorage.setItem(NOTE_KEY, JSON.stringify(n)); } catch { /* storage full: worst case the job is checked by a person */ } },
  clear(id: string) { const n = notes.all(); delete n[id]; try { localStorage.setItem(NOTE_KEY, JSON.stringify(n)); } catch { /* ignore */ } },
};

/** The printer commands for one job, as base64. */
export function buildPrintData(job: { payload?: any; content?: string }, printer: PrinterTarget): string {
  const width = printer.paperWidthMm === 58 ? 384 : 576;
  const p = job.payload as PrintPayload | undefined;
  const canvas = p && (p.kind === 'label' || p.kind === 'ticket') ? drawPrint(p, width) : drawPlainText(job.content || '', width);
  const bm = toMonoBitmap(canvas);
  return toBase64(printer.commandMode === 'stargraphic' ? starGraphicCommands(bm) : starPrntCommands(bm));
}

/** Sends printer commands over the shop network (Android app only). */
export async function sendToPrinter(printer: PrinterTarget, data: string): Promise<{ ok: boolean; stage?: 'connect' | 'write'; error?: string }> {
  const native = nativePrinter();
  if (!native) return { ok: false, stage: 'connect', error: 'Printing works only in the Android app.' };
  if (!printer.ipAddress) return { ok: false, stage: 'connect', error: 'No printer address is set (Admin, Printer Connection).' };
  try {
    return await native.rawPrintBytes({ host: printer.ipAddress, port: printer.port || 9100, data, timeoutMs: 6000 });
  } catch (e: any) {
    return { ok: false, stage: 'connect', error: String(e?.message || e) };
  }
}

export function startPrintRunner(onState: (s: RunnerState) => void) {
  let stopped = false;
  let busy = false;
  let pauseUntil = 0;

  const report = async (id: string, outcome: 'printed' | 'failed' | 'uncertain', error?: string) => {
    await api.reportPrintResult(id, outcome, error);
    notes.clear(id); // only once the server has it
  };

  async function printOne(job: any): Promise<boolean> {
    const printer: PrinterTarget = job.printer || {};
    let data: string;
    try { data = buildPrintData(job, printer); }
    catch (e: any) { notes.set(job._id, 'notsent'); await report(job._id, 'failed', `Could not prepare the label: ${e?.message || e}`).catch(() => {}); return true; }

    notes.set(job._id, 'sending');
    onState({ status: 'printing' });
    const r = await sendToPrinter(printer, data);
    if (r.ok) {
      notes.set(job._id, 'printed');
      await report(job._id, 'printed').catch(() => { /* reported again after reconnect */ });
      onState({ status: 'idle' });
      return true;
    }
    if (r.stage === 'connect') {
      notes.set(job._id, 'notsent');
      await report(job._id, 'failed', r.error).catch(() => {});
      onState({ status: 'offline', message: `Printer not reachable${printer.ipAddress ? ` at ${printer.ipAddress}` : ''}: ${r.error}` });
      pauseUntil = Date.now() + 10000;
      return false;
    }
    await report(job._id, 'uncertain', r.error || 'The connection dropped while printing.').catch(() => {});
    onState({ status: 'error', message: 'A print was interrupted: Check This Label.' });
    return true;
  }

  async function tick() {
    if (stopped || busy || Date.now() < pauseUntil) return;
    busy = true;
    try {
      const { reclaimed, jobs } = await api.claimPrintJobs(5);
      // Jobs this device held when it stopped: decide from the note how far they got.
      for (const job of reclaimed) {
        const stage = notes.all()[job._id];
        if (stage === 'printed') await report(job._id, 'printed').catch(() => {});
        else if (stage === 'claimed' || stage === 'notsent') await report(job._id, 'failed', 'Not sent before the app stopped; printing again.').catch(() => {});
        else await report(job._id, 'uncertain', 'The app stopped while this was printing.').catch(() => {});
      }
      for (const job of jobs) notes.set(job._id, 'claimed');
      for (let i = 0; i < jobs.length; i++) {
        if (stopped) break;
        const carryOn = await printOne(jobs[i]);
        if (!carryOn) {
          // Printer unreachable: put the rest back untouched, nothing was sent for them.
          for (const rest of jobs.slice(i + 1)) { notes.set(rest._id, 'notsent'); await report(rest._id, 'failed', 'Waiting for the printer.').catch(() => {}); }
          break;
        }
      }
    } catch {
      /* no connection to the server: try again next time */
    } finally {
      busy = false;
    }
  }

  const timer = window.setInterval(tick, 2500);
  void tick();
  return {
    kick: () => { void tick(); },
    stop: () => { stopped = true; window.clearInterval(timer); },
  };
}

/** A sample sticker for Admin's Test print (not queued, nothing recorded). */
export function testPrintPayload(): PrintPayload {
  return {
    kind: 'label', orderNumber: 'TEST', customerName: 'Test print', service: 'Takeaway', isUber: false, isDelivery: false,
    placedAt: new Date().toISOString(), unit: 1, of: 1, orderUnit: 1, orderUnits: 1,
    itemName: 'Printer check', modifiers: ['If this is clear and cut, printing works'],
  };
}
