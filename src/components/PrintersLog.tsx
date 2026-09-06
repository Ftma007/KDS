import React from 'react';
import { Printer, PrintJob } from '../types';
import { RefreshCw, CheckCircle, AlertTriangle, Wifi, WifiOff, ScrollText, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PrintersLogProps {
  printers: Printer[];
  printJobs: PrintJob[];
  togglePrinterStatus: (printerId: string, status: 'online' | 'offline' | 'jammed') => void;
  clearPrintJobs: () => void;
  retryAllFailedJobs: () => void;
}

export const PrintersLog: React.FC<PrintersLogProps> = ({
  printers,
  printJobs,
  togglePrinterStatus,
  clearPrintJobs,
  retryAllFailedJobs,
}) => {
  const [selectedJob, setSelectedJob] = React.useState<PrintJob | null>(null);

  // Filter jobs
  const pendingJobs = printJobs.filter(j => j.status === 'pending');
  const printedJobs = printJobs.filter(j => j.status === 'printed');
  const failedJobs = printJobs.filter(j => j.status === 'failed');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Column 1: Printer Status & Diagnostics */}
      <div className="lg:col-span-1 bg-white border border-stone-200 rounded-xl p-5 shadow-sm" id="printers-status-panel">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-tech font-bold text-stone-900 flex items-center gap-2 uppercase tracking-wider">
            <Sliders className="h-4.5 w-4.5 text-brand-orange" />
            Hardware Diagnostics
          </h3>
          <span className="text-[10px] font-mono bg-stone-100 px-2 py-0.5 rounded text-stone-500 font-bold">
            Local Net
          </span>
        </div>

        <p className="text-xs text-stone-500 mb-5">
          Simulate offline hardware events (Wi-Fi drops, paper jams) to verify resilient memory-buffered local spooler retry flows.
        </p>

        <div className="space-y-4">
          {printers.map((printer) => (
            <div key={printer.id} className="bg-stone-50/50 border border-stone-200 p-4 rounded-xl space-y-3 shadow-xs">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-xs font-bold text-stone-850 font-tech">{printer.name}</h4>
                  <p className="text-[9px] text-stone-400 font-mono font-bold">ID: {printer.id.toUpperCase()}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {printer.status === 'online' ? (
                    <span className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded text-[9px] font-mono font-bold">
                      <Wifi className="h-3 w-3" /> ONLINE
                    </span>
                  ) : printer.status === 'offline' ? (
                    <span className="flex items-center gap-1 bg-rose-50 border border-rose-200 text-rose-700 px-2 py-0.5 rounded text-[9px] font-mono font-bold animate-pulse">
                      <WifiOff className="h-3 w-3" /> OFFLINE
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded text-[9px] font-mono font-bold animate-bounce">
                      <AlertTriangle className="h-3 w-3" /> JAMMED
                    </span>
                  )}
                </div>
              </div>

              {/* Control Buttons */}
              <div className="grid grid-cols-3 gap-1 pt-1">
                <button
                  id={`btn-printer-${printer.id}-online`}
                  onClick={() => togglePrinterStatus(printer.id, 'online')}
                  className={`text-[9px] font-mono font-bold py-1.5 rounded-lg border transition-all cursor-pointer uppercase tracking-wider ${
                    printer.status === 'online'
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                      : 'bg-white border-stone-250 text-stone-500 hover:text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  Online
                </button>
                <button
                  id={`btn-printer-${printer.id}-offline`}
                  onClick={() => togglePrinterStatus(printer.id, 'offline')}
                  className={`text-[9px] font-mono font-bold py-1.5 rounded-lg border transition-all cursor-pointer uppercase tracking-wider ${
                    printer.status === 'offline'
                      ? 'bg-rose-500 border-rose-500 text-white shadow-xs'
                      : 'bg-white border-stone-250 text-stone-500 hover:text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  Offline
                </button>
                <button
                  id={`btn-printer-${printer.id}-jammed`}
                  onClick={() => togglePrinterStatus(printer.id, 'jammed')}
                  className={`text-[9px] font-mono font-bold py-1.5 rounded-lg border transition-all cursor-pointer uppercase tracking-wider ${
                    printer.status === 'jammed'
                      ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                      : 'bg-white border-stone-250 text-stone-500 hover:text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  Jam
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Column 2: Job Queue Status */}
      <div className="lg:col-span-1 bg-white border border-stone-200 rounded-xl p-5 flex flex-col h-[520px] shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-tech font-bold text-stone-900 flex items-center gap-2 uppercase tracking-wider">
            <ScrollText className="h-4.5 w-4.5 text-brand-orange" />
            Print Spooler
          </h3>
          <div className="flex gap-2">
            {failedJobs.length > 0 && (
              <button
                id="btn-retry-failed-print"
                onClick={retryAllFailedJobs}
                className="p-1 hover:bg-stone-50 rounded text-amber-700 flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                title="Retry Failed Jobs"
              >
                <RefreshCw className="h-3 w-3 animate-spin text-amber-600" /> Retry
              </button>
            )}
            <button
              id="btn-clear-print-jobs"
              onClick={clearPrintJobs}
              className="text-stone-400 hover:text-stone-700 text-xs font-bold cursor-pointer font-tech"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-3 gap-2 mb-4 text-center font-mono">
          <div className="bg-stone-50 border border-stone-150 p-2 rounded-lg">
            <p className="text-[9px] uppercase text-stone-400 font-bold">Printed</p>
            <p className="text-base font-extrabold text-emerald-700">{printedJobs.length}</p>
          </div>
          <div className="bg-stone-50 border border-stone-150 p-2 rounded-lg">
            <p className="text-[9px] uppercase text-stone-400 font-bold">Failed</p>
            <p className="text-base font-extrabold text-rose-700">{failedJobs.length}</p>
          </div>
          <div className="bg-stone-50 border border-stone-150 p-2 rounded-lg">
            <p className="text-[9px] uppercase text-stone-400 font-bold">Queue</p>
            <p className="text-base font-extrabold text-amber-700">{pendingJobs.length}</p>
          </div>
        </div>

        {/* Spooled Job List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {printJobs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <ScrollText className="h-8 w-8 text-stone-200 mb-2" />
              <p className="text-xs text-stone-400 font-mono font-bold uppercase">Spooler Empty</p>
              <p className="text-[10px] text-stone-500 mt-1 max-w-[160px] leading-relaxed">Completing items triggers automatic docket printing dockets here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {printJobs.slice().reverse().map((job) => {
                  const printer = printers.find(p => p.id === job.printerId);
                  return (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setSelectedJob(job)}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        selectedJob?.id === job.id 
                          ? 'bg-stone-100 border-stone-400 shadow-sm' 
                          : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50/50 shadow-xs'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-stone-850 truncate max-w-[150px] font-tech">{job.title}</p>
                          <p className="text-[9px] text-stone-500 font-mono font-bold uppercase">{printer?.name}</p>
                        </div>
                        <div>
                          {job.status === 'printed' ? (
                            <span className="flex items-center gap-0.5 text-emerald-700 text-[10px] font-mono font-bold">
                              <CheckCircle className="h-3 w-3" /> OK
                            </span>
                          ) : job.status === 'failed' ? (
                            <span className="flex items-center gap-0.5 text-rose-700 text-[10px] font-mono font-bold">
                              <AlertTriangle className="h-3 w-3" /> FAIL
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5 text-amber-700 text-[10px] font-mono font-bold animate-pulse">
                              <RefreshCw className="h-3 w-3 animate-spin text-amber-600" /> RETRY ({job.attempts})
                            </span>
                          )}
                        </div>
                      </div>
                      {job.errorMessage && (
                        <p className="text-[9px] text-rose-700 font-mono mt-1.5 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-bold uppercase">
                          {job.errorMessage}
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Column 3: Thermal Ticket Visualizer */}
      <div className="lg:col-span-1 bg-white border border-stone-200 rounded-xl p-5 flex flex-col h-[520px] shadow-sm">
        <h3 className="text-sm font-tech font-bold text-stone-900 flex items-center gap-2 mb-4 uppercase tracking-wider">
          <ScrollText className="h-4.5 w-4.5 text-brand-orange" />
          Virtual Receipt
        </h3>

        <div className="flex-1 bg-stone-50/50 border border-stone-200 rounded-xl p-4 flex flex-col justify-between overflow-hidden relative shadow-xs">
          {/* Virtual Serrated Top */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-[linear-gradient(135deg,#e7e5e4_25%,transparent_25%),linear-gradient(225deg,#e7e5e4_25%,transparent_25%)] bg-[size:10px_10px] bg-repeat-x"></div>

          <div className="flex-1 overflow-y-auto font-mono text-xs text-stone-600 py-3 select-text whitespace-pre leading-relaxed border-b border-stone-150">
            {selectedJob ? (
              <div className="p-3 bg-white text-stone-900 border border-stone-200 shadow-md rounded-lg font-mono text-[11px] leading-relaxed">
                {selectedJob.content}
              </div>
            ) : printJobs.filter(j => j.status === 'printed').length > 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <ScrollText className="h-8 w-8 text-stone-200 mb-2" />
                <p className="text-xs text-stone-400 max-w-[160px] leading-relaxed font-bold uppercase font-tech">Select Job</p>
                <p className="text-[10px] text-stone-500 mt-1">Select a printed job on the left to inspect the thermal receipt render.</p>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <ScrollText className="h-8 w-8 text-stone-200 mb-2" />
                <p className="text-xs text-stone-400 font-bold uppercase tracking-wide font-tech">No Tickets Printed</p>
              </div>
            )}
          </div>

          <div className="pt-3 text-[10px] text-stone-400 flex justify-between font-mono font-semibold">
            <span>Thermal Mock: 80mm docket</span>
            <span>{selectedJob ? `ID: ${selectedJob.id.substring(0, 8).toUpperCase()}` : 'Ready'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
