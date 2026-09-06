import React from 'react';
import { MenuItem, UserRole } from '../types';
import { RefreshCw, CheckCircle, AlertTriangle, ShieldCheck, Database } from 'lucide-react';

interface StockManagerProps {
  menuItems: MenuItem[];
  onStockToggle: (itemId: string, inStock: boolean) => void;
  currentUserRole: UserRole;
}

export const StockManager: React.FC<StockManagerProps> = ({
  menuItems,
  onStockToggle,
  currentUserRole,
}) => {
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [permissionError, setPermissionError] = React.useState<string | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const isAuthorized = currentUserRole === 'administrator';

  const handleToggle = (itemId: string, currentInStock: boolean) => {
    if (!isAuthorized) {
      setPermissionError('Admin login is required to modify item availability.');
      setTimeout(() => setPermissionError(null), 4000);
      return;
    }

    // Toggle stock state in KDS
    onStockToggle(itemId, !currentInStock);

    // Simulate instant synchronisation to Square POS Catalog
    setIsSyncing(true);
    setSuccessMessage(`Syncing catalog update with POS server...`);
    
    setTimeout(() => {
      setIsSyncing(false);
      const updatedItem = menuItems.find(i => i.id === itemId);
      setSuccessMessage(`POS Catalog updated: "${updatedItem?.name}" set to ${!currentInStock ? 'IN-STOCK' : 'OUT-OF-STOCK'}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex justify-between items-center bg-stone-50 border border-stone-200 rounded-xl p-5">
        <div className="space-y-1">
          <h2 className="text-base font-tech font-bold text-stone-900 flex items-center gap-2 uppercase tracking-wider">
            <Database className="h-4.5 w-4.5 text-brand-orange" />
            POS Catalog Sync
          </h2>
          <p className="text-xs text-stone-500">
            Control food item availability on POS devices and KDS screens. Out-of-stock items will block new ordering immediately.
          </p>
        </div>
      </div>

      {!isAuthorized && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center gap-3 text-rose-800 text-xs font-mono font-bold uppercase shadow-sm">
          <AlertTriangle className="h-4.5 w-4.5 text-rose-600 shrink-0" />
          <span>
            Admin login is required to modify item availability.
          </span>
        </div>
      )}

      {permissionError && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center gap-3 text-rose-800 text-xs font-mono font-bold uppercase shadow-sm animate-bounce">
          <AlertTriangle className="h-4.5 w-4.5 text-rose-600 shrink-0" />
          <span>{permissionError}</span>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs font-mono font-bold uppercase text-center flex items-center justify-center gap-2 shadow-sm">
          {isSyncing ? <RefreshCw className="h-4 w-4 animate-spin text-brand-orange" /> : <ShieldCheck className="h-4 w-4 text-emerald-600" />}
          <span>{successMessage}</span>
        </div>
      )}

      {/* Grid of Catalog Items */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {menuItems.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                item.inStock
                  ? 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50/30 shadow-sm'
                  : 'bg-amber-50/50 border-amber-200 text-amber-800 shadow-xs'
              }`}
            >
              <div>
                <div className="flex justify-between items-start">
                  <h4 className="text-xs font-tech font-bold text-stone-850 uppercase">{item.name}</h4>
                  <span className="text-[9px] font-mono font-bold uppercase text-stone-500 bg-stone-100 border border-stone-200/50 px-1.5 py-0.5 rounded">{item.category}</span>
                </div>
                <p className="text-[10px] text-stone-500 font-mono font-bold mt-1">${item.price.toFixed(2)} AUD</p>
              </div>

              <div className="flex justify-between items-center border-t border-stone-150 pt-2.5 mt-1">
                <span className="text-[10px] font-mono font-bold uppercase">
                  {item.inStock ? (
                    <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-250">● Active</span>
                  ) : (
                    <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-250">○ Disabled</span>
                  )}
                </span>

                <button
                  id={`btn-stock-toggle-${item.id}`}
                  onClick={() => handleToggle(item.id, item.inStock)}
                  disabled={!isAuthorized}
                  className={`px-3 py-1 text-[9px] font-mono font-bold rounded-lg border transition-all uppercase tracking-wider ${
                    !isAuthorized
                      ? 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed shadow-none'
                      : item.inStock
                      ? 'bg-white hover:bg-stone-50 border-stone-250 text-stone-700 cursor-pointer shadow-xs'
                      : 'bg-amber-500 hover:bg-amber-600 border-amber-500 text-white cursor-pointer shadow-xs'
                  }`}
                >
                  {item.inStock ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
