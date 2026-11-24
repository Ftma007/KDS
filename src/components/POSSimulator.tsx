import React from 'react';
import { MenuItem, Order } from '../types';
import { ShoppingCart, User, Plus, Trash2, Tag, AlertTriangle, SlidersHorizontal, Check, X, Sparkles } from 'lucide-react';
import { createRandomId } from '../utils';

interface POSSimulatorProps {
  menuItems: MenuItem[];
  onOrderSubmit: (order: Order) => void;
  isOffline: boolean;
}

export interface CartLine {
  cartId: string;
  menuItemId: string;
  name: string;
  price: number;
  stationId: string;
  category: string;
  modifiers: string[];
}

export const POSSimulator: React.FC<POSSimulatorProps> = ({ menuItems, onOrderSubmit, isOffline }) => {
  const [customerName, setCustomerName] = React.useState('');
  const [tableNumber, setTableNumber] = React.useState('Table 3');
  const [notes, setNotes] = React.useState('');
  const [activeComboName, setActiveComboName] = React.useState<string | null>(null);
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // Custom Modifier Modal State
  const [selectedMenuItem, setSelectedMenuItem] = React.useState<MenuItem | null>(null);
  const [activeModifiers, setActiveModifiers] = React.useState<string[]>([]);

  const tableOptions = ['Table 1', 'Table 3', 'Table 5', 'Table 7', 'Table 12', 'Takeaway', 'Delivery UberEats'];

  // Categories & Modifier Presets
  const getCategoryModifiers = (category: string): string[] => {
    switch (category) {
      case 'Coffee & Hot Drinks':
        return ['OAT MILK', 'ALMOND MILK', 'SKIM MILK', 'EXTRA HOT', 'DECAF', 'DOUBLE SHOT', 'SOY MILK'];
      case 'Cold Drinks':
        return ['NO ICE', 'EXTRA ICE', 'ADD LEMON SLICE', 'EASY SUGAR'];
      case 'From Our Grill':
        return ['RICE: KABULI PALAW', 'RICE: CHALAW', 'EXTRA TOUM GARLIC', 'EXTRA SIRMAST DIP', 'NO ONIONS', 'SIDE NAAN BREAD'];
      case 'Mains':
        return ['EXTRA BARBERRIES', 'EXTRA NUTS', 'GRAVY ON SIDE', 'EXTRA NAAN BREAD', 'MILD SPICE'];
      case 'Hot Mezze':
      case 'Cold Mezze':
      case 'Salads & Dips':
        return ['EXTRA TAHINI', 'EXTRA POMEGRANATE MOLASSES', 'CRISPY BREAD ON SIDE', 'SAUCE ON SIDE'];
      case 'Pancakes & French Toast':
        return ['EXTRA MASCARPONE', 'MAPLE SYRUP ON SIDE', 'EXTRA FRESH BERRIES', 'EXTRA BISCOFF CRUMBLE'];
      default:
        return ['EXTRA SAUCE', 'NO ONIONS', 'TAKEAWAY PACKAGING'];
    }
  };

  const handleOpenCustomize = (item: MenuItem) => {
    if (!item.inStock) return;
    setSelectedMenuItem(item);
    setActiveModifiers([]);
  };

  const toggleModifier = (mod: string) => {
    setActiveModifiers(prev =>
      prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]
    );
  };

  const addCustomizedToCart = () => {
    if (!selectedMenuItem) return;
    
    const newCartLine: CartLine = {
      cartId: createRandomId('cart-line'),
      menuItemId: selectedMenuItem.id,
      name: selectedMenuItem.name,
      price: selectedMenuItem.price,
      stationId: selectedMenuItem.stationId,
      category: selectedMenuItem.category,
      modifiers: [...activeModifiers],
    };

    setCart(prev => [...prev, newCartLine]);
    setSelectedMenuItem(null);
    setActiveModifiers([]);
  };

  const quickAddNoMods = (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.inStock) return;

    const newCartLine: CartLine = {
      cartId: createRandomId('cart-line'),
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      stationId: item.stationId,
      category: item.category,
      modifiers: [],
    };

    setCart(prev => [...prev, newCartLine]);
  };

  const removeFromCart = (cartId: string) => {
    setCart(prev => prev.filter(line => line.cartId !== cartId));
  };

  const clearCart = () => {
    setCart([]);
    setNotes('');
    setActiveComboName(null);
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + item.price, 0);
  };

  // Pre-made quick orders based on Sufra Lebanese & Afghan Kitchen menu
  const loadQuickCombo = (type: 'sufra_multi_royal' | 'afghan_feast' | 'lebanese_grill' | 'mezze_dumplings' | 'pancakes_coffee') => {
    clearCart();

    if (type === 'sufra_multi_royal') {
      // MULTI-STATION COMBO REQUESTED BY CLIENT: Grill + Hot Mezze + Drink + Dessert
      const royalLines: CartLine[] = [
        {
          cartId: createRandomId('cart'),
          menuItemId: 'leb-mixed-plate',
          name: 'Lebanese Mixed Plate',
          price: 38.0,
          stationId: 'st-grill',
          category: 'From Our Grill',
          modifiers: ['RICE: KABULI PALAW', 'EXTRA TOUM GARLIC'],
        },
        {
          cartId: createRandomId('cart'),
          menuItemId: 'mantu-dumplings',
          name: 'Mantu (12 Lamb Dumplings)',
          price: 26.0,
          stationId: 'st-hotmezze',
          category: 'Hot Mezze',
          modifiers: ['EXTRA YOGHURT SAUCE'],
        },
        {
          cartId: createRandomId('cart'),
          menuItemId: 'fresh-lemonade-330ml',
          name: 'Refreshing Lemonade 330ml',
          price: 5.0,
          stationId: 'st-drinks',
          category: 'Cold Drinks',
          modifiers: ['LESS ICE'],
        },
        {
          cartId: createRandomId('cart'),
          menuItemId: 'biscoff-french-toast',
          name: 'Biscoff French Toast',
          price: 24.0,
          stationId: 'st-desserts',
          category: 'Pancakes & French Toast',
          modifiers: ['EXTRA MASCARPONE'],
        },
      ];
      setCart(royalLines);
      setCustomerName('Mustafa Al-Hashimi');
      setTableNumber('Table 5');
      setNotes('VIP Multi-Station Combo: Deliver hot items together upon prep signoff');
      setActiveComboName('Sufra Royal Multi-Station Combo');
    } else if (type === 'afghan_feast') {
      const lines: CartLine[] = [
        { cartId: createRandomId('c'), menuItemId: 'afghan-mix', name: 'Afghan Mixed Plate', price: 38.0, stationId: 'st-grill', category: 'From Our Grill', modifiers: ['RICE: KABULI PALAW', 'EXTRA SIRMAST'] },
        { cartId: createRandomId('c'), menuItemId: 'mantu-dumplings', name: 'Mantu (12 Lamb Dumplings)', price: 26.0, stationId: 'st-hotmezze', category: 'Hot Mezze', modifiers: [] },
        { cartId: createRandomId('c'), menuItemId: 'chutney', name: 'Afghan Green Chutney', price: 10.0, stationId: 'st-coldmezze', category: 'Salads & Dips', modifiers: [] },
        { cartId: createRandomId('c'), menuItemId: 'dough-drink', name: 'Dough Yoghurt Drink (Jug)', price: 10.0, stationId: 'st-drinks', category: 'Cold Drinks', modifiers: [] },
      ];
      setCart(lines);
      setCustomerName('Farhad Rahimi');
      setTableNumber('Table 4');
      setNotes('Extra green chutney & fresh warm naan bread');
      setActiveComboName('Afghan Feast Combo');
    } else if (type === 'lebanese_grill') {
      const lines: CartLine[] = [
        { cartId: createRandomId('c'), menuItemId: 'leb-mixed-plate', name: 'Lebanese Mixed Plate', price: 38.0, stationId: 'st-grill', category: 'From Our Grill', modifiers: ['EXTRA TOUM GARLIC'] },
        { cartId: createRandomId('c'), menuItemId: 'hummus-dip', name: 'Hummus Dip', price: 13.0, stationId: 'st-coldmezze', category: 'Cold Mezze', modifiers: [] },
        { cartId: createRandomId('c'), menuItemId: 'fattoush', name: 'Fattoush Salad', price: 10.0, stationId: 'st-coldmezze', category: 'Salads & Dips', modifiers: ['EXTRA CRISPY BREAD'] },
        { cartId: createRandomId('c'), menuItemId: 'coke-330ml', name: 'Cola 330ml', price: 5.0, stationId: 'st-drinks', category: 'Cold Drinks', modifiers: [] },
      ];
      setCart(lines);
      setCustomerName('Zainab Al-Hassan');
      setTableNumber('Table 7');
      setNotes('Toum garlic on side, extra crispy bread for fattoush');
      setActiveComboName('Lebanese Grill Combo');
    } else if (type === 'mezze_dumplings') {
      const lines: CartLine[] = [
        { cartId: createRandomId('c'), menuItemId: 'mantu-dumplings', name: 'Mantu (12 Lamb Dumplings)', price: 26.0, stationId: 'st-hotmezze', category: 'Hot Mezze', modifiers: [] },
        { cartId: createRandomId('c'), menuItemId: 'ashak', name: 'Ashak (12 Veg Dumplings)', price: 24.0, stationId: 'st-hotmezze', category: 'Hot Mezze', modifiers: [] },
        { cartId: createRandomId('c'), menuItemId: 'cheese-sambousek', name: 'Cheese Sambousek (4pc)', price: 16.0, stationId: 'st-hotmezze', category: 'Hot Mezze', modifiers: [] },
        { cartId: createRandomId('c'), menuItemId: 'tabouli', name: 'Tabouli Salad', price: 10.0, stationId: 'st-coldmezze', category: 'Salads & Dips', modifiers: [] },
      ];
      setCart(lines);
      setCustomerName('Tariq Mansour');
      setTableNumber('Takeaway');
      setNotes('Pack tahini dip & yoghurt sauces separately');
      setActiveComboName('Mezze & Dumplings Combo');
    } else {
      // 3 Cappuccinos test case with distinct modifiers as requested by client
      const lines: CartLine[] = [
        { cartId: createRandomId('c'), menuItemId: 'cappuccino', name: 'Cappuccino', price: 4.5, stationId: 'st-drinks', category: 'Coffee & Hot Drinks', modifiers: ['OAT MILK', 'EXTRA HOT'] },
        { cartId: createRandomId('c'), menuItemId: 'cappuccino', name: 'Cappuccino', price: 4.5, stationId: 'st-drinks', category: 'Coffee & Hot Drinks', modifiers: ['ALMOND MILK', 'DECAF'] },
        { cartId: createRandomId('c'), menuItemId: 'cappuccino', name: 'Cappuccino', price: 4.5, stationId: 'st-drinks', category: 'Coffee & Hot Drinks', modifiers: ['SKIM MILK', 'DOUBLE SHOT'] },
        { cartId: createRandomId('c'), menuItemId: 'berry-pancakes', name: 'Berry Pancakes', price: 24.0, stationId: 'st-desserts', category: 'Pancakes & French Toast', modifiers: ['EXTRA MASCARPONE'] },
      ];
      setCart(lines);
      setCustomerName('Layla Abboud');
      setTableNumber('Table 1');
      setNotes('Each cappuccino has unique milk & temperature modifiers');
      setActiveComboName('3x Cappuccino + Pancakes Combo');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    const sqOrderId = `SQ-${Math.floor(1000 + Math.random() * 9000)}`;

    // FIX (regression): cart lines with the SAME item AND identical modifiers
    // must stack into one line with quantity > 1 — only a DIFFERING modifier
    // combination gets its own separate line. Previously every cart line
    // became its own quantity:1 item unconditionally, so "4x Afghan Mixed
    // Plate" with no modifier differences rendered as 4 separate 1x lines
    // instead of a single 4x stack.
    const groupKey = (line: (typeof cart)[number]) =>
      `${line.menuItemId}::${[...line.modifiers].sort().join('|')}`;

    const grouped = new Map<string, { menuItemId: string; name: string; stationId: string; modifiers: string[]; quantity: number }>();
    cart.forEach((line) => {
      const key = groupKey(line);
      const existing = grouped.get(key);
      if (existing) {
        existing.quantity += 1;
      } else {
        grouped.set(key, {
          menuItemId: line.menuItemId,
          name: line.name,
          stationId: line.stationId,
          modifiers: line.modifiers,
          quantity: 1,
        });
      }
    });

    const newOrder: Order = {
      id: sqOrderId,
      source: tableNumber.includes('UberEats') ? 'Online Store' : 'Square POS',
      customerName: customerName.trim() || 'Guest Customer',
      tableNumber: tableNumber,
      createdAt: new Date().toISOString(),
      status: 'preparing',
      comboName: activeComboName || undefined,
      items: Array.from(grouped.values()).map(group => ({
        id: createRandomId('itm-inst'),
        menuItemId: group.menuItemId,
        name: group.name,
        quantity: group.quantity, // stacked count of identical item+modifier lines
        completedQuantity: 0,
        packedQuantity: 0,
        status: 'pending' as const,
        stationId: group.stationId,
        reprintCount: 0,
        modifiers: group.modifiers.length > 0 ? group.modifiers : undefined,
      })),
      notes: notes.trim() || undefined,
    };

    onOrderSubmit(newOrder);

    // Reset Form
    setSuccessMessage(`Order ${sqOrderId} successfully sent to Sufra KDS!`);
    setCart([]);
    setCustomerName('');
    setNotes('');
    setActiveComboName(null);
    
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: POS Menu Grid */}
      <div className="lg:col-span-7 bg-white p-2">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-tech font-bold text-stone-900 flex items-center gap-2 uppercase tracking-wider">
            <Tag className="h-4 w-4 text-brand-orange" />
            POS Menu (Click item to add or customize)
          </h3>
          <span className="text-[10px] font-mono text-stone-400 font-bold bg-stone-100 px-2 py-0.5 rounded">AUD ($)</span>
        </div>

        {/* Quick presets including the requested Multi-Station Combo */}
        <div className="mb-5 bg-stone-50 p-3 rounded-xl border border-stone-150">
          <div className="flex justify-between items-center mb-2">
            <p className="text-[9px] font-mono text-stone-500 uppercase tracking-widest font-bold flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Sufra Multi-Station Combos
            </p>
            <span className="text-[8px] font-mono text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded font-bold">KDS TEST READY</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              id="btn-combo-royal"
              onClick={() => loadQuickCombo('sufra_multi_royal')}
              className="px-2.5 py-1.5 text-[11px] font-tech font-extrabold bg-[#3F1C1A] text-[#EDD7A1] border border-[#E5A330] hover:bg-[#2A1312] rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1"
            >
              Multi-Station Royal Combo
            </button>
            <button
              id="btn-combo-3caps"
              onClick={() => loadQuickCombo('pancakes_coffee')}
              className="px-2.5 py-1.5 text-[11px] font-tech font-bold bg-white text-[#3F1C1A] border border-[#EDD7A1] hover:border-[#E5A330] hover:bg-[#EDD7A1]/20 rounded-lg shadow-xs transition-all cursor-pointer"
            >
              3x Cappuccino + Modifiers Test
            </button>
            <button
              id="btn-combo-afghan"
              onClick={() => loadQuickCombo('afghan_feast')}
              className="px-2.5 py-1.5 text-[11px] font-tech font-bold bg-white text-[#3F1C1A] border border-[#EDD7A1] hover:border-[#E5A330] hover:bg-[#EDD7A1]/20 rounded-lg shadow-xs transition-all cursor-pointer"
            >
              Afghan Feast
            </button>
            <button
              id="btn-combo-lebanese"
              onClick={() => loadQuickCombo('lebanese_grill')}
              className="px-2.5 py-1.5 text-[11px] font-tech font-bold bg-white text-[#3F1C1A] border border-[#EDD7A1] hover:border-[#E5A330] hover:bg-[#EDD7A1]/20 rounded-lg shadow-xs transition-all cursor-pointer"
            >
              Lebanese Grill
            </button>
            <button
              id="btn-combo-mezze"
              onClick={() => loadQuickCombo('mezze_dumplings')}
              className="px-2.5 py-1.5 text-[11px] font-tech font-bold bg-white text-[#3F1C1A] border border-[#EDD7A1] hover:border-[#E5A330] hover:bg-[#EDD7A1]/20 rounded-lg shadow-xs transition-all cursor-pointer"
            >
              Mezze & Dumplings
            </button>
          </div>
        </div>

        {/* Menu Grid Categorized */}
        <div className="space-y-5 max-h-[420px] overflow-y-auto pr-1">
          {Array.from(new Set<string>(menuItems.map(i => i.category))).map((cat: string) => {
            const catItems = menuItems.filter(i => i.category === cat);
            if (catItems.length === 0) return null;
            return (
              <div key={cat} className="space-y-2">
                <h4 className="text-xs font-display font-bold uppercase tracking-wider text-stone-500 border-b border-stone-200/80 pb-1.5">
                  {cat.toUpperCase()}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {catItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleOpenCustomize(item)}
                      className={`flex justify-between items-center p-3 rounded-xl border text-left transition-all ${
                        item.inStock
                          ? 'bg-white border-stone-200 hover:border-amber-400 hover:bg-amber-50/20 cursor-pointer shadow-sm'
                          : 'bg-stone-50/60 border-stone-100 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-stone-800">{item.name}</p>
                        <p className="text-[10px] text-stone-500 font-mono font-bold">${item.price.toFixed(2)} AUD</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {item.inStock ? (
                          <>
                            <button
                              id={`btn-customize-${item.id}`}
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleOpenCustomize(item); }}
                              className="p-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-all"
                              title="Customize Modifiers"
                            >
                              <SlidersHorizontal className="h-3 w-3 text-amber-600" />
                            </button>
                            <button
                              id={`btn-quick-add-${item.id}`}
                              type="button"
                              onClick={(e) => quickAddNoMods(item, e)}
                              className="p-1.5 bg-stone-50 text-stone-700 hover:bg-stone-100 border border-stone-200 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-all"
                              title="Quick Add (Default)"
                            >
                              <Plus className="h-3 w-3 text-stone-600" />
                            </button>
                          </>
                        ) : (
                          <span className="text-[9px] font-mono flex items-center gap-1 text-amber-600 uppercase font-bold">
                            <AlertTriangle className="h-3 w-3" /> OUT
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Order Entry Cart */}
      <div className="lg:col-span-5 bg-stone-50/60 border border-stone-200/80 rounded-xl p-5 flex flex-col justify-between shadow-sm">
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-tech font-bold text-stone-900 flex items-center gap-2 uppercase tracking-wider">
              <ShoppingCart className="h-4 w-4 text-brand-orange" />
              New Ticket Queue ({cart.length} line items)
            </h3>
            <button
              id="btn-clear-cart"
              onClick={clearCart}
              className="text-stone-400 hover:text-stone-700 text-xs font-bold cursor-pointer"
            >
              Clear
            </button>
          </div>

          {/* Form details */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] font-mono text-stone-500 uppercase font-bold">Customer Name</label>
                <div className="relative">
                  <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-stone-400" />
                  <input
                    id="input-customer-name"
                    type="text"
                    required
                    placeholder="e.g. David W."
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 pl-8 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono text-stone-500 uppercase font-bold">Destination</label>
                <select
                  id="select-table-number"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange transition-all cursor-pointer font-bold"
                >
                  {tableOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {activeComboName && (
              <div className="bg-[#3F1C1A] text-[#EDD7A1] border border-[#E5A330] p-2 rounded-lg text-xs font-tech font-bold flex items-center justify-between shadow-xs">
                <span>{activeComboName}</span>
                <button type="button" onClick={() => setActiveComboName(null)} className="text-[#EDD7A1]/60 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[9px] font-mono text-stone-500 uppercase font-bold">Order Notes</label>
              <textarea
                id="input-order-notes"
                placeholder="e.g. Extra hot, sauce on side..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-12 bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange resize-none transition-all"
              />
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 border-t border-stone-250 pt-3">
              <span className="text-[9px] font-mono text-stone-500 uppercase font-bold">Line Items ({cart.length})</span>
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-stone-200 rounded-xl bg-white text-stone-400 text-xs font-mono font-bold">
                    No items selected. Click menu items to add with custom modifiers.
                  </div>
                ) : (
                  cart.map((line) => (
                    <div key={line.cartId} className="flex justify-between items-start bg-white p-2.5 rounded-lg border border-stone-200 shadow-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-stone-800 font-sans">{line.name}</p>
                          <span className="text-[9px] text-stone-500 font-mono font-bold">${line.price.toFixed(2)}</span>
                        </div>

                        {/* Selected Modifiers list */}
                        {line.modifiers.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {line.modifiers.map(mod => (
                              <span key={mod} className="text-[8px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded uppercase">
                                • {mod}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[8px] font-mono text-stone-400 italic">Default Options</span>
                        )}
                      </div>

                      <button
                        id={`btn-remove-line-${line.cartId}`}
                        type="button"
                        onClick={() => removeFromCart(line.cartId)}
                        className="p-1 bg-stone-50 hover:bg-rose-50 text-stone-400 hover:text-rose-600 rounded border border-stone-200 cursor-pointer transition-all shrink-0 ml-2"
                        title="Remove Item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Form Actions */}
        <div className="border-t border-stone-200 pt-4 mt-4 space-y-3">
          <div className="flex justify-between items-center text-xs font-mono px-1">
            <span className="text-stone-500 uppercase font-bold">TOTAL AMOUNT</span>
            <span className="text-stone-950 font-display font-extrabold text-lg">${getCartTotal().toFixed(2)} AUD</span>
          </div>

          {isOffline ? (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-amber-800 text-xs shadow-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span>
                <strong>Offline Mode:</strong> Queued locally. Will auto-sync when network returns.
              </span>
            </div>
          ) : null}

          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-emerald-800 text-xs font-mono text-center shadow-sm font-bold">
              {successMessage}
            </div>
          )}

          <button
            id="btn-place-square-order"
            onClick={handleSubmit}
            disabled={cart.length === 0}
            className={`w-full py-3 rounded-lg font-tech font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border shadow-sm ${
              cart.length > 0 && !isOffline
                ? 'bg-[#E5A330] hover:bg-[#d69320] text-[#3F1C1A] border-[#E5A330] active:scale-[0.98] cursor-pointer'
                : cart.length > 0 && isOffline
                ? 'bg-[#EDD7A1] hover:bg-[#e2c789] text-[#3F1C1A] border-[#E5A330] active:scale-[0.98] cursor-pointer'
                : 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed'
            }`}
          >
            {isOffline ? 'Queue Offline Order' : 'Send Order to Sufra KDS'}
          </button>
        </div>
      </div>

      {/* CUSTOM MODIFIER SELECTION MODAL */}
      {selectedMenuItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-stone-300 shadow-2xl p-6 space-y-4 animate-in fade-in duration-200">
            <div className="flex justify-between items-start border-b border-stone-150 pb-3">
              <div>
                <span className="text-[9px] font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded uppercase">
                  {selectedMenuItem.category}
                </span>
                <h3 className="text-base font-display font-extrabold text-stone-900 mt-1">{selectedMenuItem.name}</h3>
                <p className="text-xs font-mono text-stone-500 font-bold">${selectedMenuItem.price.toFixed(2)} AUD</p>
              </div>
              <button
                onClick={() => setSelectedMenuItem(null)}
                className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-tech font-bold text-stone-700 uppercase tracking-wider">
                Select Modifiers / Preparation Options:
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                {getCategoryModifiers(selectedMenuItem.category).map(mod => {
                  const isChecked = activeModifiers.includes(mod);
                  return (
                    <button
                      key={mod}
                      type="button"
                      onClick={() => toggleModifier(mod)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-mono font-bold transition-all flex items-center justify-between cursor-pointer ${
                        isChecked
                          ? 'bg-[#3F1C1A] text-[#EDD7A1] border-[#E5A330] shadow-sm'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      <span className="truncate">{mod}</span>
                      {isChecked && <Check className="h-3.5 w-3.5 text-[#E5A330] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-stone-150 flex gap-2">
              <button
                id="btn-add-customized-cart"
                type="button"
                onClick={addCustomizedToCart}
                className="flex-1 py-2.5 bg-[#E5A330] hover:bg-[#d69320] text-[#3F1C1A] font-tech font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Add to Ticket ({activeModifiers.length} mods)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
