import React from 'react';
import { KDSConfig, KDSStation, Printer, MenuItem, isPackingStationObj } from '../types';
import { Settings, Save, AlertTriangle, Plus, Trash2, Printer as PrinterIcon, RefreshCw, Eye } from 'lucide-react';

interface AdminConfigProps {
  config: KDSConfig;
  printers: Printer[];
  menuItems: MenuItem[];
  onConfigChange: (newConfig: KDSConfig) => void;
  onPrinterAdd: (printer: Printer) => void;
  onPrinterDelete: (printerId: string) => void;
  venueName?: string | null; // live only
  onVenueNameSave?: (name: string) => void; // live only: shown only when provided
  square?: {
    status: { configured: boolean; configProblem?: string | null; connected: boolean; environment?: string; businessName?: string;
      locationId?: string | null; locationName?: string | null; locations?: { id: string; name: string }[] } | null;
    busy: boolean;
    link: string | null;
    message: string | null;
    onConnect: () => void;
    onRefresh: () => void;
    onImport: () => void;
    onDisconnect: () => void;
    onSetLocation: (id: string) => void;
  }; // live only
  itemRouting?: {
    onPreview: (text: string) => Promise<{ name: string; stationId: string | null; stationName: string | null; matched: string[]; unknownItems: string[] }[]>;
    onApply: (text: string, createMissingStations: boolean) => Promise<string>;
  }; // live only
  allowDeleteStations?: boolean; // live only: Delete button on each station except Packing & Pass
  onClearActiveOrders?: () => Promise<string>; // live only
  printerSetup?: {
    printers: Printer[];
    canTestPrint: boolean;
    onSave: (id: string, body: { ipAddress: string; port: number; paperWidthMm: 58 | 80; commandMode: 'starprnt' | 'stargraphic' }) => Promise<string>;
    onTestPrint: (printer: Printer) => Promise<string>;
  }; // live only
}

export const AdminConfig: React.FC<AdminConfigProps> = ({
  config,
  printers,
  menuItems,
  onConfigChange,
  onPrinterAdd,
  venueName,
  onVenueNameSave,
  square,
  itemRouting,
  allowDeleteStations,
  onClearActiveOrders,
  printerSetup,
  onPrinterDelete,
}) => {
  const [stations, setStations] = React.useState<KDSStation[]>(config.stations);
  const [routing, setRouting] = React.useState<Record<string, string>>(config.categoryRouting);
  const [venueNameDraft, setVenueNameDraft] = React.useState<string>(venueName || '');
  const [irText, setIrText] = React.useState('');
  const [clearBusy, setClearBusy] = React.useState(false);
  const [clearMsg, setClearMsg] = React.useState<string | null>(null);
  const [irPreview, setIrPreview] = React.useState<{ name: string; stationId: string | null; stationName: string | null; matched: string[]; unknownItems: string[] }[] | null>(null);
  const [irBusy, setIrBusy] = React.useState(false);
  const [irCreate, setIrCreate] = React.useState(true);
  const [irMessage, setIrMessage] = React.useState<string | null>(null);
  React.useEffect(() => { setVenueNameDraft(venueName || ''); }, [venueName]);
  const [undoGracePeriod, setUndoGracePeriod] = React.useState<number>(
    config.undoGracePeriodSeconds !== undefined ? config.undoGracePeriodSeconds : 5
  );
  const [fadeEmptyStationOrders, setFadeEmptyStationOrders] = React.useState<boolean>(
    config.fadeEmptyStationOrders !== undefined ? config.fadeEmptyStationOrders : true
  );
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // Sync state if config prop updates externally
  React.useEffect(() => {
    setStations(config.stations);
    setRouting(config.categoryRouting);
    setUndoGracePeriod(config.undoGracePeriodSeconds !== undefined ? config.undoGracePeriodSeconds : 5);
    setFadeEmptyStationOrders(config.fadeEmptyStationOrders !== undefined ? config.fadeEmptyStationOrders : true);
  }, [config]);

  // New Category form states
  const [newCategoryName, setNewCategoryName] = React.useState('');
  const [newStationName, setNewStationName] = React.useState('');
  const [newStationColor, setNewStationColor] = React.useState('orange');
  const [newStationError, setNewStationError] = React.useState<string | null>(null);
  const [newCategoryStationId, setNewCategoryStationId] = React.useState(stations[0]?.id || 'st-kitchen');

  // New Printer form states
  const [newPrinterName, setNewPrinterName] = React.useState('');
  const [newPrinterType, setNewPrinterType] = React.useState<'label' | 'receipt'>('label');

  const handleMoveStation = (index: number, direction: 'up' | 'down') => {
    const newStations = [...stations];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newStations.length) return;

    const temp = newStations[index];
    newStations[index] = newStations[targetIndex];
    newStations[targetIndex] = temp;

    setStations(newStations);
    onConfigChange({
      ...config,
      stations: newStations,
      categoryRouting: routing,
      displayOrder: newStations.map(s => s.id),
      undoGracePeriodSeconds: undoGracePeriod,
      fadeEmptyStationOrders,
    });
  };

  const handleRoutingChange = (category: string, stationId: string) => {
    const updated = {
      ...routing,
      [category]: stationId,
    };
    setRouting(updated);
    onConfigChange({
      ...config,
      stations,
      categoryRouting: updated,
      displayOrder: stations.map(s => s.id),
      undoGracePeriodSeconds: undoGracePeriod,
      fadeEmptyStationOrders,
    });
  };

  // Add a station: as many as the venue needs. New stations go just before Packing &
  // Pass (which stays last), start with Label Printing Off and "Show other stations'
  // items" On, like the existing ones. Names must be unique (pasted lists match by name).
  const handleAddStationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newStationName.trim().replace(/\s+/g, ' ');
    if (!name) return;
    if (stations.some(s => s.name.trim().toLowerCase() === name.toLowerCase())) {
      setNewStationError(`There is already a station called "${name}".`);
      return;
    }
    const newStation: KDSStation = {
      id: `st-${Date.now()}`,
      name,
      color: newStationColor,
      printerId: '',
      labelPrintingEnabled: false,
      showOtherStationItems: true,
    };
    const packIdx = stations.findIndex(s => isPackingStationObj(s));
    const updatedStations = packIdx >= 0
      ? [...stations.slice(0, packIdx), newStation, ...stations.slice(packIdx)]
      : [...stations, newStation];
    setStations(updatedStations);
    onConfigChange({
      ...config,
      stations: updatedStations,
      categoryRouting: routing,
      displayOrder: updatedStations.map(s => s.id),
      undoGracePeriodSeconds: undoGracePeriod,
      fadeEmptyStationOrders,
    });
    setNewStationName('');
    setNewStationError(null);
    setSuccessMessage(`Station "${name}" added.`);
    setTimeout(() => setSuccessMessage(null), 2500);
  };

  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const catKey = newCategoryName.trim().toLowerCase().replace(/\s+/g, '_');
    if (!catKey) return;

    const targetStation = newCategoryStationId || stations[0]?.id || 'st-kitchen';
    const updatedRouting = {
      ...routing,
      [catKey]: targetStation,
    };
    setRouting(updatedRouting);
    onConfigChange({
      ...config,
      stations,
      categoryRouting: updatedRouting,
      displayOrder: stations.map(s => s.id),
      undoGracePeriodSeconds: undoGracePeriod,
      fadeEmptyStationOrders,
    });
    setNewCategoryName('');
    setSuccessMessage(`New category "${newCategoryName.trim()}" added and routed to station!`);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const handleSave = () => {
    onConfigChange({
      ...config,
      stations,
      categoryRouting: routing,
      displayOrder: stations.map(s => s.id),
      undoGracePeriodSeconds: undoGracePeriod,
      fadeEmptyStationOrders,
    });
    setSuccessMessage('KDS Configuration & Timing parameters saved securely!');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleAddPrinterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrinterName.trim()) return;

    const newPrinter: Printer = {
      id: `pr-${Math.random().toString(36).substr(2, 5)}`,
      name: newPrinterName.trim(),
      type: newPrinterType,
      status: 'online',
    };

    onPrinterAdd(newPrinter);
    setNewPrinterName('');
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex justify-between items-center bg-stone-50 border border-stone-200 rounded-xl p-5">
        <div className="space-y-1">
          <h2 className="text-base font-display font-bold text-stone-900 flex items-center gap-2 uppercase tracking-wide">
            <Settings className="h-4.5 w-4.5 text-brand-orange" />
            Local Server & Routing Config
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Control the routing business logic of your kitchen. Updates sync instantly to all screen kiosks over the local network.
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs font-mono text-center shadow-xs font-bold">
          {successMessage}
        </div>
      )}

      {/* Square connection (live system only) */}
      {square && (
        <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3 shadow-sm" id="square-card">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-display font-bold text-stone-850 uppercase tracking-wide">Square</h3>
            <span className={`text-[9px] font-mono font-black px-1.5 py-0.5 rounded border uppercase ${
              square.status?.connected ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-stone-100 text-stone-600 border-stone-300'
            }`}>
              {square.status?.connected ? `Connected${square.status.environment === 'sandbox' ? ' (sandbox)' : ''}` : 'Not connected'}
            </span>
          </div>

          {square.status && !square.status.configured && (
            <p className="text-xs text-rose-700 font-mono" id="square-config-problem">Server not ready for Square: {square.status.configProblem}</p>
          )}

          {square.status?.connected ? (
            <>
              <p className="text-xs text-stone-600">
                Orders come from <strong>{square.status.businessName || 'your Square business'}</strong>
                {square.status.locationName ? <> at <strong>{square.status.locationName}</strong></> : null}.
              </p>
              {!square.status.locationId && square.status.locations && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-stone-500 uppercase">Location:</span>
                  <select
                    id="select-square-location"
                    defaultValue=""
                    onChange={(e) => e.target.value && square.onSetLocation(e.target.value)}
                    className="bg-white border border-stone-200 text-xs rounded-lg px-2.5 py-1 text-stone-700 font-semibold"
                  >
                    <option value="">Choose this venue's location</option>
                    {square.status.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button id="btn-square-import-menu" type="button" disabled={square.busy} onClick={square.onImport}
                  className="px-3 py-2 rounded-lg bg-[#3F1C1A] text-[#EDD7A1] text-xs font-tech font-bold uppercase tracking-wider cursor-pointer disabled:opacity-40">
                  Import menu from Square
                </button>
                <button id="btn-square-disconnect" type="button" disabled={square.busy} onClick={square.onDisconnect}
                  className="px-3 py-2 rounded-lg border border-stone-300 text-xs font-tech font-bold uppercase tracking-wider text-stone-600 cursor-pointer disabled:opacity-40">
                  Disconnect
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-stone-600">Connect this venue's Square business so its orders come straight to the screens. You'll sign in on Square's own page and choose the business.</p>
              <div className="flex flex-wrap gap-2">
                <button id="btn-square-connect" type="button" disabled={square.busy || !square.status?.configured} onClick={square.onConnect}
                  className="px-3 py-2 rounded-lg bg-[#3F1C1A] text-[#EDD7A1] text-xs font-tech font-bold uppercase tracking-wider cursor-pointer disabled:opacity-40">
                  Connect Square
                </button>
                <button id="btn-square-refresh" type="button" disabled={square.busy} onClick={square.onRefresh}
                  className="px-3 py-2 rounded-lg border border-stone-300 text-xs font-tech font-bold uppercase tracking-wider text-stone-600 cursor-pointer disabled:opacity-40">
                  Check connection
                </button>
              </div>
              {square.link && (
                <div className="text-[11px] text-stone-600 bg-stone-50 border border-stone-200 rounded-lg p-2.5 space-y-1.5" id="square-link-box">
                  <p>If Square didn't open, open this link in any browser (it works once, for 10 minutes), then press Check connection:</p>
                  <div className="flex gap-2 items-center">
                    <input readOnly value={square.link} className="flex-1 bg-white border border-stone-200 rounded px-2 py-1 font-mono text-[10px]" onFocus={(e) => e.target.select()} />
                    <button type="button" onClick={() => navigator.clipboard?.writeText(square.link!)} className="px-2 py-1 rounded border border-stone-300 text-[10px] font-bold uppercase cursor-pointer">Copy</button>
                  </div>
                </div>
              )}
            </>
          )}
          {square.message && <p className="text-xs font-mono text-stone-700" id="square-message">{square.message}</p>}
        </div>
      )}

      {/* Printer connection (live system only): where the Packing & Pass app prints */}
      {printerSetup && (
        <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3 shadow-sm" id="printer-connection-card">
          <h3 className="text-sm font-display font-bold text-stone-850 uppercase tracking-wide">Printer Connection</h3>
          <p className="text-xs text-stone-600">
            The Packing & Pass screen prints stickers and order tickets straight to this printer over the shop network.
            {!printerSetup.canTestPrint && ' Test print works from the Android app on the screen (a browser cannot reach printers).'}
          </p>
          {printerSetup.printers.map(p => (
            <React.Fragment key={p.id}>
              <PrinterConnectionRow printer={p} canTestPrint={printerSetup.canTestPrint} onSave={printerSetup.onSave} onTestPrint={printerSetup.onTestPrint} />
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Current orders (live system only): clear everything on the screens without printing */}
      {onClearActiveOrders && (
        <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3 shadow-sm" id="clear-orders-card">
          <h3 className="text-sm font-display font-bold text-stone-850 uppercase tracking-wide">Current Orders</h3>
          <p className="text-xs text-stone-600">
            Clears every current order from all screens without printing anything, and cancels anything still waiting to print.
            For setup and while Square's own KDS is still in use. Orders stay in History.
          </p>
          <button id="btn-clear-active-orders" type="button" disabled={clearBusy}
            onClick={async () => {
              if (!window.confirm('Clear all current orders from every screen?\n\nNothing will print, and anything waiting to print is cancelled. Orders stay in History.')) return;
              setClearBusy(true); setClearMsg(null);
              try { setClearMsg(await onClearActiveOrders()); } catch (e) { setClearMsg(e instanceof Error ? e.message : 'Not cleared.'); } finally { setClearBusy(false); }
            }}
            className="px-3 py-2 rounded-lg border border-rose-300 text-rose-700 bg-rose-50 text-xs font-tech font-bold uppercase tracking-wider cursor-pointer disabled:opacity-40">
            Clear all current orders
          </button>
          {clearMsg && <p className="text-xs font-mono text-stone-700" id="clear-orders-message">{clearMsg}</p>}
        </div>
      )}

      {/* Item routing (live system only): paste the section lists */}
      {itemRouting && (
        <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3 shadow-sm" id="item-routing-card">
          <h3 className="text-sm font-display font-bold text-stone-850 uppercase tracking-wide">Item Routing</h3>
          <p className="text-xs text-stone-600">
            Paste section lists: a line like <span className="font-mono">Cafe Section :</span> then one item per line. Each pasted section replaces only that
            section's items, so lists can be added one at a time. An item listed under two sections is made by both. Items on no list follow Category Routing.
          </p>
          <textarea
            id="input-item-routing"
            rows={8}
            value={irText}
            onChange={(e) => { setIrText(e.target.value); setIrPreview(null); setIrMessage(null); }}
            placeholder={'Cafe Section :\nLatte\nCappuccino\n\nBBQ Shish :\nKafta'}
            className="w-full bg-white border border-stone-200 text-xs rounded-lg p-2.5 font-mono text-stone-800 focus:outline-hidden"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button id="btn-item-routing-preview" type="button" disabled={irBusy || !irText.trim()}
              onClick={async () => { setIrBusy(true); setIrMessage(null); try { setIrPreview(await itemRouting.onPreview(irText)); } catch (e) { setIrMessage(e instanceof Error ? e.message : 'Preview failed.'); } finally { setIrBusy(false); } }}
              className="px-3 py-2 rounded-lg border border-stone-300 text-xs font-tech font-bold uppercase tracking-wider text-stone-700 cursor-pointer disabled:opacity-40">
              Preview
            </button>
            <button id="btn-item-routing-apply" type="button" disabled={irBusy || !irPreview}
              onClick={async () => { setIrBusy(true); try { setIrMessage(await itemRouting.onApply(irText, irCreate)); setIrPreview(null); } catch (e) { setIrMessage(e instanceof Error ? e.message : 'Not saved.'); } finally { setIrBusy(false); } }}
              className="px-3 py-2 rounded-lg bg-[#3F1C1A] text-[#EDD7A1] text-xs font-tech font-bold uppercase tracking-wider cursor-pointer disabled:opacity-40">
              Apply
            </button>
            {irPreview && irPreview.some(p => !p.stationId) && (
              <label className="flex items-center gap-1.5 text-[11px] text-stone-600">
                <input id="chk-item-routing-create" type="checkbox" checked={irCreate} onChange={(e) => setIrCreate(e.target.checked)} />
                Create stations for sections that don't exist yet
              </label>
            )}
          </div>
          {irPreview && (
            <div className="space-y-2" id="item-routing-preview">
              {irPreview.map((p, idx) => (
                <div key={idx} className="text-[11px] bg-stone-50 border border-stone-200 rounded-lg p-2.5">
                  <p className="font-bold text-stone-800">
                    {p.name}: {p.stationId ? `${p.matched.length} items → ${p.stationName}` : (irCreate ? `${p.matched.length} items → new station "${p.name}"` : 'no station with this name')}
                  </p>
                  {p.unknownItems.length > 0 && <p className="text-rose-700 mt-0.5">Not found in the menu: {p.unknownItems.join(', ')}</p>}
                </div>
              ))}
            </div>
          )}
          {irMessage && <p className="text-xs font-mono text-stone-700" id="item-routing-message">{irMessage}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: KDS Stations & Printing Assignment */}
        <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-display font-bold text-stone-850 uppercase tracking-wide">
            Kitchen Station Settings
          </h3>
          <p className="text-xs text-stone-500 leading-relaxed">
            Configure display station aliases. Rename these screens depending on your seasonal shift constraints.
          </p>

          {/* Venue name (live system): shown on the Customer Display, set per venue */}
          {onVenueNameSave && (
            <div className="bg-stone-50/50 p-3 rounded-xl border border-stone-200 shadow-xs flex items-end gap-2" id="venue-name-card">
              <div className="flex-1">
                <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wide mb-1" htmlFor="input-venue-name">
                  Venue Name
                </label>
                <input
                  id="input-venue-name"
                  type="text"
                  maxLength={60}
                  value={venueNameDraft}
                  onChange={(e) => setVenueNameDraft(e.target.value)}
                  className="w-full bg-white border border-stone-200 text-xs rounded-lg p-2 text-stone-800 focus:outline-hidden"
                />
              </div>
              <button
                id="btn-save-venue-name"
                type="button"
                disabled={!venueNameDraft.trim() || venueNameDraft.trim() === (venueName || '')}
                onClick={() => onVenueNameSave(venueNameDraft.trim())}
                className="px-3 py-2 rounded-lg bg-[#3F1C1A] text-[#EDD7A1] text-xs font-tech font-bold uppercase tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-default"
              >
                Save
              </button>
            </div>
          )}

          <div className="space-y-3.5">
            {stations.map((st, index) => (
              <div key={st.id} className="bg-stone-50/50 border border-stone-200 p-4 rounded-xl space-y-3 shadow-xs">
                <div className="flex justify-between items-center gap-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMoveStation(index, 'up')}
                      className="p-1 text-stone-500 hover:text-stone-900 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-stone-200 rounded text-xs font-bold"
                      title="Move Up on KDS Display"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={index === stations.length - 1}
                      onClick={() => handleMoveStation(index, 'down')}
                      className="p-1 text-stone-500 hover:text-stone-900 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-stone-200 rounded text-xs font-bold"
                      title="Move Down on KDS Display"
                    >
                      ▼
                    </button>
                  </div>
                  <input
                    id={`input-station-name-${st.id}`}
                    type="text"
                    value={st.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setStations(prev => prev.map(s => s.id === st.id ? { ...s, name } : s));
                    }}
                    className="flex-1 bg-white border border-stone-200 text-xs text-stone-850 px-2.5 py-1.5 rounded-lg focus:outline-hidden focus:border-brand-orange font-semibold"
                  />
                  <span className="text-[10px] font-mono text-stone-400 font-bold">POS Pos #{index + 1}</span>
                  {allowDeleteStations && !isPackingStationObj(st) && (
                    <button
                      type="button"
                      id={`btn-delete-station-${st.id}`}
                      title={`Delete ${st.name}`}
                      aria-label={`Delete ${st.name}`}
                      onClick={() => {
                        if (!window.confirm(`Delete "${st.name}"?\n\nIts items will go to Packing & Pass until you assign them to another station, and any unfinished items there now move to Packing & Pass, ready to pack. Screens set up as "${st.name}" will need setting up again.`)) return;
                        const updatedStations = stations.filter(s => s.id !== st.id);
                        setStations(updatedStations);
                        onConfigChange({
                          ...config,
                          stations: updatedStations,
                          categoryRouting: routing,
                          displayOrder: updatedStations.map(s => s.id),
                          undoGracePeriodSeconds: undoGracePeriod,
                          fadeEmptyStationOrders,
                        });
                      }}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] text-stone-400 uppercase font-mono font-bold">Assigned Printer</span>
                    <select
                      id={`select-station-printer-${st.id}`}
                      value={st.printerId}
                      onChange={(e) => {
                        setStations(prev => prev.map(s => s.id === st.id ? { ...s, printerId: e.target.value } : s));
                      }}
                      className="w-full bg-white border border-stone-200 text-[11px] rounded-lg p-1.5 text-stone-700 focus:outline-hidden"
                    >
                      {printers.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.type === 'label' ? 'Sticky' : 'Receipt'})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-stone-400 uppercase font-mono font-bold">Border Glow Theme</span>
                    <select
                      id={`select-station-color-${st.id}`}
                      value={st.color}
                      onChange={(e) => {
                        setStations(prev => prev.map(s => s.id === st.id ? { ...s, color: e.target.value } : s));
                      }}
                      className="w-full bg-white border border-stone-200 text-[11px] rounded-lg p-1.5 text-stone-700 focus:outline-hidden"
                    >
                      <option value="orange">Orange Glow</option>
                      <option value="red">Red Crimson</option>
                      <option value="blue">Ice Blue</option>
                      <option value="emerald">Emerald Green</option>
                      <option value="indigo">Deep Indigo</option>
                    </select>
                  </div>
                </div>

                {/* Per-Station Label Printing Toggle (On/Off) */}
                <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <PrinterIcon className="h-3.5 w-3.5 text-stone-600" />
                      <span className="text-[11px] font-tech font-bold text-stone-800 uppercase tracking-wide">
                        Label Printing:
                      </span>
                      <span className={`text-[9px] font-mono font-black px-1.5 py-0.2 rounded border uppercase ${
                        st.labelPrintingEnabled
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-stone-100 text-stone-600 border-stone-300'
                      }`}>
                        {st.labelPrintingEnabled ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-500 font-mono mt-0.5">
                      {st.labelPrintingEnabled
                        ? (isPackingStationObj(st)
                            ? 'Sticky item labels & final packing docket reprint active on pass.'
                            : 'Sticky label print/reprint controls enabled for this station\'s items.')
                        : 'No print or reprint controls rendered on this kiosk screen.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    id={`btn-toggle-label-printing-${st.id}`}
                    onClick={() => {
                      const updatedEnabled = !st.labelPrintingEnabled;
                      const updatedStations = stations.map(s => s.id === st.id ? { ...s, labelPrintingEnabled: updatedEnabled } : s);
                      setStations(updatedStations);
                      onConfigChange({
                        ...config,
                        stations: updatedStations,
                        categoryRouting: routing,
                        displayOrder: updatedStations.map(s => s.id),
                        undoGracePeriodSeconds: undoGracePeriod,
                        fadeEmptyStationOrders,
                      });
                      setSuccessMessage(`${st.name}: Label printing set to ${updatedEnabled ? 'ON' : 'OFF'}`);
                      setTimeout(() => setSuccessMessage(null), 2500);
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      st.labelPrintingEnabled ? 'bg-emerald-600' : 'bg-stone-300'
                    }`}
                    title={`Toggle Label Printing for ${st.name}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        st.labelPrintingEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Per-Station: show other stations' items (Packing & Pass always sees everything) */}
                {!isPackingStationObj(st) && (() => {
                  const showOthers = st.showOtherStationItems !== false;
                  return (
                    <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5 text-stone-600" />
                          <span className="text-[11px] font-tech font-bold text-stone-800 uppercase tracking-wide">
                            Show Other Stations' Items:
                          </span>
                          <span className={`text-[9px] font-mono font-black px-1.5 py-0.2 rounded border uppercase ${
                            showOthers
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-stone-100 text-stone-600 border-stone-300'
                          }`}>
                            {showOthers ? 'ON' : 'OFF'}
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-500 font-mono mt-0.5">
                          {showOthers
                            ? 'Tickets also show other stations\' items, for context.'
                            : 'This screen shows only its own items and orders.'}
                        </p>
                      </div>

                      <button
                        type="button"
                        id={`btn-toggle-show-others-${st.id}`}
                        onClick={() => {
                          const updatedShow = !showOthers;
                          const updatedStations = stations.map(s => s.id === st.id ? { ...s, showOtherStationItems: updatedShow } : s);
                          setStations(updatedStations);
                          onConfigChange({
                            ...config,
                            stations: updatedStations,
                            categoryRouting: routing,
                            displayOrder: updatedStations.map(s => s.id),
                            undoGracePeriodSeconds: undoGracePeriod,
                            fadeEmptyStationOrders,
                          });
                          setSuccessMessage(`${st.name}: Show other stations' items set to ${updatedShow ? 'ON' : 'OFF'}`);
                          setTimeout(() => setSuccessMessage(null), 2500);
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          showOthers ? 'bg-emerald-600' : 'bg-stone-300'
                        }`}
                        title={`Toggle showing other stations' items for ${st.name}`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            showOthers ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>

          {/* Form to Add New Station (as many as the venue needs) */}
          <form onSubmit={handleAddStationSubmit} className="space-y-3.5 border-t border-stone-150 pt-3" id="add-station-form">
            <p className="text-[10px] font-mono text-stone-500 uppercase tracking-wider font-extrabold flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5 text-brand-orange" /> Add New Station:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <input
                id="input-new-station-name"
                type="text"
                required
                maxLength={40}
                placeholder="E.g., Cafe Section, BBQ Shish..."
                value={newStationName}
                onChange={(e) => { setNewStationName(e.target.value); setNewStationError(null); }}
                className="bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-850 focus:outline-hidden focus:border-brand-orange font-medium"
              />
              <select
                id="select-new-station-color"
                value={newStationColor}
                onChange={(e) => setNewStationColor(e.target.value)}
                className="bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-700 focus:outline-hidden focus:border-brand-orange font-medium"
              >
                <option value="orange">Glow: Orange Glow</option>
                <option value="red">Glow: Red Crimson</option>
                <option value="blue">Glow: Ice Blue</option>
                <option value="emerald">Glow: Emerald Green</option>
                <option value="indigo">Glow: Deep Indigo</option>
              </select>
            </div>
            {newStationError && <p className="text-xs text-rose-700 font-bold" id="add-station-error">{newStationError}</p>}
            <button
              id="btn-add-new-station"
              type="submit"
              className="w-full py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs uppercase tracking-wider"
            >
              <Plus className="h-4 w-4" /> Add Station
            </button>
          </form>

          <button
            id="btn-save-kds-config"
            onClick={handleSave}
            className="w-full py-2.5 bg-brand-orange hover:bg-orange-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Save className="h-4 w-4" /> Save Configuration
          </button>
        </div>

        {/* Right Column: Menu Category Router & Printer Installer */}
        <div className="space-y-6">
          {/* Menu Category Routing Table */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-display font-bold text-stone-850 flex items-center gap-2 uppercase tracking-wide">
              <RefreshCw className="h-4 w-4 text-indigo-600" />
              Category Routing Rules
            </h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              When webhooks are pushed from Square with product catalog category identifiers, route those lines automatically to designated stations.
            </p>

            <div className="space-y-2 border-t border-stone-150 pt-3">
              {Object.keys(routing).map((category) => (
                <div key={category} className="flex justify-between items-center bg-stone-50/50 p-3 rounded-xl border border-stone-200 shadow-xs">
                  <span className="text-xs font-extrabold text-stone-800 capitalize font-display">
                    {category === 'pizza' ? 'Woodfired Pizza' : category === 'kitchen' ? 'Kitchen Grill & Mains' : category === 'drinks' ? 'Drinks Bar' : category === 'desserts' ? 'Sweet Desserts' : `${category.replace('_', ' ')}`}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-stone-400 font-bold">Maps To:</span>
                    <select
                      id={`select-route-category-${category}`}
                      value={routing[category]}
                      onChange={(e) => handleRoutingChange(category, e.target.value)}
                      className="bg-white border border-stone-200 text-xs rounded-lg px-2.5 py-1 text-stone-700 focus:outline-hidden focus:border-brand-orange font-semibold"
                    >
                      {routing[category] === '' && <option value="">Not set</option>}
                      {stations.map(st => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            {/* Form to Add New Category */}
            <form onSubmit={handleAddCategorySubmit} className="space-y-3.5 border-t border-stone-150 pt-3">
              <p className="text-[10px] font-mono text-stone-500 uppercase tracking-wider font-extrabold flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5 text-brand-orange" /> Add New Category:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <input
                  id="input-new-category-name"
                  type="text"
                  required
                  placeholder="E.g., Appetizers, Sushi, Sides..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-850 focus:outline-hidden focus:border-brand-orange font-medium"
                />
                <select
                  id="select-new-category-station"
                  value={newCategoryStationId}
                  onChange={(e) => setNewCategoryStationId(e.target.value)}
                  className="bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-700 focus:outline-hidden focus:border-brand-orange font-medium"
                >
                  {stations.map(st => (
                    <option key={st.id} value={st.id}>Assign To: {st.name}</option>
                  ))}
                </select>
              </div>
              <button
                id="btn-add-new-category"
                type="submit"
                className="w-full py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs uppercase tracking-wider"
              >
                <Plus className="h-4 w-4" /> Add Category & Set Route
              </button>
            </form>
            
            <p className="text-[10px] font-mono text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200/80 flex items-start gap-1.5 shadow-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                <strong>Engine Rule:</strong> Unassigned categories default to general kitchen station displays to ensure zero order loss.
              </span>
            </p>
          </div>

          {/* Printer Hardware Installer */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-display font-bold text-stone-850 flex items-center gap-2 uppercase tracking-wide">
              <PrinterIcon className="h-4 w-4 text-emerald-600" />
              Thermal Hardware Spoolers
            </h3>

            {/* List existing printers */}
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
              {printers.map((pr) => (
                <div key={pr.id} className="flex justify-between items-center bg-stone-50/50 p-2.5 rounded-xl text-xs border border-stone-200 shadow-xs">
                  <div>
                    <span className="font-bold text-stone-800">{pr.name}</span>
                    <span className="text-[10px] font-mono block text-stone-400 capitalize font-semibold">{pr.type} format</span>
                  </div>
                  {/* Prevent deleting default printers for demo stability, but support deleting custom ones */}
                  {!['pr-pizza', 'pr-kitchen', 'pr-drinks', 'pr-desserts', 'pr-packing'].includes(pr.id) ? (
                    <button
                      id={`btn-delete-printer-${pr.id}`}
                      onClick={() => onPrinterDelete(pr.id)}
                      className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <span className="text-[9px] font-mono text-stone-500 bg-stone-100/80 border border-stone-200 px-1.5 py-0.5 rounded uppercase font-bold">SYSTEM</span>
                  )}
                </div>
              ))}
            </div>

            {/* Installer Form */}
            <form onSubmit={handleAddPrinterSubmit} className="space-y-3.5 border-t border-stone-150 pt-3">
              <p className="text-[10px] font-mono text-stone-400 uppercase tracking-wider font-bold">Install New LAN Printer:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <input
                  id="input-new-printer-name"
                  type="text"
                  required
                  placeholder="E.g., Star TSP650"
                  value={newPrinterName}
                  onChange={(e) => setNewPrinterName(e.target.value)}
                  className="bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-850"
                />
                <select
                  id="select-new-printer-type"
                  value={newPrinterType}
                  onChange={(e) => setNewPrinterType(e.target.value as 'label' | 'receipt')}
                  className="bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-700 focus:outline-hidden"
                >
                  <option value="label">Label Sticky Format</option>
                  <option value="receipt">Standard Receipt Docket</option>
                </select>
              </div>
              <button
                id="btn-add-printer-hardware"
                type="submit"
                className="w-full py-2 bg-stone-50 hover:bg-stone-100 border border-stone-200 hover:border-brand-orange text-stone-700 hover:text-brand-orange text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
              >
                <Plus className="h-4 w-4" /> Register New Printer
              </button>
            </form>
          </div>

          {/* Workflow & Undo Timing Settings */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4 shadow-sm" id="timing-settings-card">
            <h3 className="text-sm font-display font-bold text-stone-850 flex items-center gap-2 uppercase tracking-wide">
              <Settings className="h-4 w-4 text-amber-600" />
              KDS Timing & Grace Period Rules
            </h3>
            
            <div className="space-y-4 text-xs">
              {/* Grace Period Selector */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="font-tech font-bold text-stone-700 uppercase tracking-wide">
                    Undo Bump Grace Period Window:
                  </label>
                  <span className="font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {undoGracePeriod === 0 ? 'Disabled (0s)' : `${undoGracePeriod} Seconds`}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 3, 5, 10].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      id={`btn-grace-${sec}s`}
                      onClick={() => {
                        setUndoGracePeriod(sec);
                        onConfigChange({
                          ...config,
                          stations,
                          categoryRouting: routing,
                          displayOrder: stations.map(s => s.id),
                          undoGracePeriodSeconds: sec,
                          fadeEmptyStationOrders,
                        });
                      }}
                      className={`py-2 rounded-lg font-tech font-black text-xs border transition-all cursor-pointer uppercase ${
                        undoGracePeriod === sec
                          ? 'bg-[#3F1C1A] border-[#3F1C1A] text-[#EDD7A1] shadow-xs'
                          : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      {sec === 0 ? '0s (Immediate)' : `${sec} Seconds`}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] font-mono text-stone-500 mt-1 leading-relaxed">
                  When enabled (&gt;0s), bumping items or packing orders triggers an on-screen countdown banner. During this window, cooks can click Undo. Physical label/docket printing and Customer Ready flips are held until grace expiry.
                </p>
              </div>

              {/* Empty Station Fading Toggle */}
              <div className="border-t border-stone-150 pt-3 space-y-1.5">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-tech font-bold text-stone-700 uppercase tracking-wide block">
                      Fade & Compact Empty Station Orders
                    </span>
                    <span className="text-[10px] text-stone-500 font-mono">
                      Orders without items for a station render faded and collapsible.
                    </span>
                  </div>
                  <button
                    type="button"
                    id="btn-toggle-fade-empty"
                    onClick={() => {
                      const nextVal = !fadeEmptyStationOrders;
                      setFadeEmptyStationOrders(nextVal);
                      onConfigChange({
                        ...config,
                        stations,
                        categoryRouting: routing,
                        displayOrder: stations.map(s => s.id),
                        undoGracePeriodSeconds: undoGracePeriod,
                        fadeEmptyStationOrders: nextVal,
                      });
                    }}
                    className={`px-3 py-1.5 rounded-lg font-tech font-black text-xs border transition-all cursor-pointer uppercase ${
                      fadeEmptyStationOrders
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'bg-stone-200 border-stone-300 text-stone-600'
                    }`}
                  >
                    {fadeEmptyStationOrders ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/** One printer's network settings, with Save and Test print (live system only). */
function PrinterConnectionRow({ printer, canTestPrint, onSave, onTestPrint }: {
  printer: Printer;
  canTestPrint: boolean;
  onSave: (id: string, body: { ipAddress: string; port: number; paperWidthMm: 58 | 80; commandMode: 'starprnt' | 'stargraphic' }) => Promise<string>;
  onTestPrint: (printer: Printer) => Promise<string>;
}) {
  const [ip, setIp] = React.useState(printer.ipAddress || '');
  const [port, setPort] = React.useState(String(printer.port || 9100));
  const [width, setWidth] = React.useState<58 | 80>(printer.paperWidthMm === 58 ? 58 : 80);
  const [mode, setMode] = React.useState<'starprnt' | 'stargraphic'>(printer.commandMode === 'stargraphic' ? 'stargraphic' : 'starprnt');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const ipOk = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip.trim()) || /^[a-zA-Z0-9.-]+$/.test(ip.trim());
  const portNum = Number(port);
  const valid = ip.trim() !== '' && ipOk && Number.isInteger(portNum) && portNum > 0 && portNum < 65536;
  const current = { ...printer, ipAddress: ip.trim(), port: portNum, paperWidthMm: width, commandMode: mode };
  const run = async (fn: () => Promise<string>) => { setBusy(true); setMsg(null); try { setMsg(await fn()); } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed.'); } finally { setBusy(false); } };
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-2" id={`printer-conn-${printer.id}`}>
      <p className="text-xs font-bold text-stone-800">{printer.name}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <input id={`input-printer-ip-${printer.id}`} value={ip} onChange={(e) => setIp(e.target.value)} placeholder="192.168.20.31"
          className="bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 font-mono" />
        <input id={`input-printer-port-${printer.id}`} value={port} onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ''))} placeholder="9100"
          className="bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 font-mono" />
        <select id={`select-printer-width-${printer.id}`} value={width} onChange={(e) => setWidth(Number(e.target.value) === 58 ? 58 : 80)}
          className="bg-white border border-stone-200 rounded-lg px-2.5 py-1.5">
          <option value={80}>Paper: 80 mm</option>
          <option value={58}>Paper: 58 mm</option>
        </select>
        <select id={`select-printer-mode-${printer.id}`} value={mode} onChange={(e) => setMode(e.target.value === 'stargraphic' ? 'stargraphic' : 'starprnt')}
          className="bg-white border border-stone-200 rounded-lg px-2.5 py-1.5">
          <option value="starprnt">Commands: StarPRNT</option>
          <option value="stargraphic">Commands: Star Graphic</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" id={`btn-printer-save-${printer.id}`} disabled={busy || !valid}
          onClick={() => run(() => onSave(printer.id, { ipAddress: ip.trim(), port: portNum, paperWidthMm: width, commandMode: mode }))}
          className="px-3 py-1.5 rounded-lg bg-[#3F1C1A] text-[#EDD7A1] text-xs font-tech font-bold uppercase tracking-wider cursor-pointer disabled:opacity-40">
          Save
        </button>
        <button type="button" id={`btn-printer-test-${printer.id}`} disabled={busy || !valid || !canTestPrint}
          onClick={() => run(() => onTestPrint(current))}
          className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-tech font-bold uppercase tracking-wider text-stone-700 cursor-pointer disabled:opacity-40">
          Test print
        </button>
      </div>
      {msg && <p className="text-xs font-mono text-stone-700" id={`printer-msg-${printer.id}`}>{msg}</p>}
    </div>
  );
}
