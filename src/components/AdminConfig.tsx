import React from 'react';
import { KDSConfig, KDSStation, Printer, MenuItem } from '../types';
import { Settings, Save, AlertTriangle, Plus, Trash2, Printer as PrinterIcon, RefreshCw } from 'lucide-react';

interface AdminConfigProps {
  config: KDSConfig;
  printers: Printer[];
  menuItems: MenuItem[];
  onConfigChange: (newConfig: KDSConfig) => void;
  onPrinterAdd: (printer: Printer) => void;
  onPrinterDelete: (printerId: string) => void;
}

export const AdminConfig: React.FC<AdminConfigProps> = ({
  config,
  printers,
  menuItems,
  onConfigChange,
  onPrinterAdd,
  onPrinterDelete,
}) => {
  const [stations, setStations] = React.useState<KDSStation[]>(config.stations);
  const [routing, setRouting] = React.useState<Record<string, string>>(config.categoryRouting);
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: KDS Stations & Printing Assignment */}
        <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-display font-bold text-stone-850 uppercase tracking-wide">
            Kitchen Station Settings
          </h3>
          <p className="text-xs text-stone-500 leading-relaxed">
            Configure display station aliases. Rename these screens depending on your seasonal shift constraints.
          </p>

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
                        ? (st.id === 'st-packing'
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
              </div>
            ))}
          </div>

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
                    {category === 'pizza' ? '🍕 Woodfired Pizza' : category === 'kitchen' ? '🍔 Kitchen Grill & Mains' : category === 'drinks' ? '🥤 Drinks Bar' : category === 'desserts' ? '🍰 Sweet Desserts' : `🏷️ ${category.replace('_', ' ')}`}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-stone-400 font-bold">Maps To:</span>
                    <select
                      id={`select-route-category-${category}`}
                      value={routing[category]}
                      onChange={(e) => handleRoutingChange(category, e.target.value)}
                      className="bg-white border border-stone-200 text-xs rounded-lg px-2.5 py-1 text-stone-700 focus:outline-hidden focus:border-brand-orange font-semibold"
                    >
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
