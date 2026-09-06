import { MenuItem, KDSStation, Order, Printer, KDSConfig } from './types';

export const INITIAL_MENU: MenuItem[] = [
  // From Our Grill (st-grill)
  { id: 'afghan-mix', name: 'Afghan Mixed Plate', category: 'From Our Grill', price: 38.0, stationId: 'st-grill', inStock: true },
  { id: 'chicken-kebab', name: 'Chicken Kebab (2 Skewers)', category: 'From Our Grill', price: 23.0, stationId: 'st-grill', inStock: true },
  { id: 'chopan-kebab', name: 'Chopan Kebab (Lamb Chops)', category: 'From Our Grill', price: 27.0, stationId: 'st-grill', inStock: true },
  { id: 'kafta-skewer', name: 'Kafta (2 Skewers)', category: 'From Our Grill', price: 15.0, stationId: 'st-grill', inStock: true },
  { id: 'shish-tawook', name: 'Shish Tawook (Chicken)', category: 'From Our Grill', price: 19.0, stationId: 'st-grill', inStock: true },
  { id: 'shami-kebab', name: 'Shami Kebab (2 Skewers)', category: 'From Our Grill', price: 21.0, stationId: 'st-grill', inStock: true },
  { id: 'lamb-tikka', name: 'Lamb Tikka (2 Skewers)', category: 'From Our Grill', price: 25.0, stationId: 'st-grill', inStock: true },
  { id: 'leb-mixed-plate', name: 'Lebanese Mixed Plate', category: 'From Our Grill', price: 38.0, stationId: 'st-grill', inStock: true },

  // Mains (st-kitchen)
  { id: 'chalaw-gosht', name: 'Chalaw Gosht (Lamb Shank)', category: 'Mains', price: 34.0, stationId: 'st-kitchen', inStock: true },
  { id: 'kabuli-palaw', name: 'Kabuli Palaw Plate', category: 'Mains', price: 34.0, stationId: 'st-kitchen', inStock: true },
  { id: 'lamb-korma', name: 'Lamb Korma (Afghan Curry)', category: 'Mains', price: 30.0, stationId: 'st-kitchen', inStock: true },
  { id: 'mansaf-chicken', name: 'Mansaf Chicken Plate', category: 'Mains', price: 29.0, stationId: 'st-kitchen', inStock: true },
  { id: 'mansaf-lamb', name: 'Mansaf Lamb Plate', category: 'Mains', price: 32.0, stationId: 'st-kitchen', inStock: true },
  { id: 'maqloubeh', name: 'Maqloubeh Plate', category: 'Mains', price: 29.0, stationId: 'st-kitchen', inStock: true },

  // Hot Mezze (st-hotmezze)
  { id: 'arnabeet', name: 'Arnabeet (Fried Cauliflower)', category: 'Hot Mezze', price: 17.0, stationId: 'st-hotmezze', inStock: true },
  { id: 'ashak', name: 'Ashak (12 Veg Dumplings)', category: 'Hot Mezze', price: 24.0, stationId: 'st-hotmezze', inStock: true },
  { id: 'cheese-sambousek', name: 'Cheese Sambousek (4pc)', category: 'Hot Mezze', price: 16.0, stationId: 'st-hotmezze', inStock: true },
  { id: 'falafel-6pc', name: 'Falafel with Tahini (6pc)', category: 'Hot Mezze', price: 14.0, stationId: 'st-hotmezze', inStock: true },
  { id: 'mantu-dumplings', name: 'Mantu (12 Lamb Dumplings)', category: 'Hot Mezze', price: 26.0, stationId: 'st-hotmezze', inStock: true },
  { id: 'meat-sambousek', name: 'Meat Sambousek (4pc)', category: 'Hot Mezze', price: 16.0, stationId: 'st-hotmezze', inStock: true },

  // Cold Mezze & Salads (st-coldmezze)
  { id: 'baba-ghanouj', name: 'Baba Ghanouj Dip', category: 'Cold Mezze', price: 15.0, stationId: 'st-coldmezze', inStock: true },
  { id: 'hummus-dip', name: 'Hummus Dip', category: 'Cold Mezze', price: 13.0, stationId: 'st-coldmezze', inStock: true },
  { id: 'fattoush', name: 'Fattoush Salad', category: 'Salads & Dips', price: 10.0, stationId: 'st-coldmezze', inStock: true },
  { id: 'tabouli', name: 'Tabouli Salad', category: 'Salads & Dips', price: 10.0, stationId: 'st-coldmezze', inStock: true },
  { id: 'toum', name: 'Toum (Garlic Dip)', category: 'Salads & Dips', price: 9.0, stationId: 'st-coldmezze', inStock: true },
  { id: 'chutney', name: 'Afghan Green Chutney', category: 'Salads & Dips', price: 10.0, stationId: 'st-coldmezze', inStock: true },

  // Coffee & Drinks (st-drinks)
  { id: 'cappuccino', name: 'Cappuccino', category: 'Coffee & Hot Drinks', price: 4.5, stationId: 'st-drinks', inStock: true },
  { id: 'flat-white', name: 'Flat White', category: 'Coffee & Hot Drinks', price: 4.5, stationId: 'st-drinks', inStock: true },
  { id: 'latte', name: 'Latte', category: 'Coffee & Hot Drinks', price: 4.5, stationId: 'st-drinks', inStock: true },
  { id: 'dirty-chai', name: 'Dirty Chai', category: 'Coffee & Hot Drinks', price: 5.5, stationId: 'st-drinks', inStock: true },
  { id: 'dough-drink', name: 'Dough Yoghurt Drink (Jug)', category: 'Cold Drinks', price: 10.0, stationId: 'st-drinks', inStock: true },
  { id: 'coke-330ml', name: 'Cola 330ml', category: 'Cold Drinks', price: 5.0, stationId: 'st-drinks', inStock: true },
  { id: 'fresh-lemonade-330ml', name: 'Refreshing Lemonade 330ml', category: 'Cold Drinks', price: 5.0, stationId: 'st-drinks', inStock: true },

  // Pancakes & Desserts (st-desserts)
  { id: 'berry-pancakes', name: 'Berry Pancakes', category: 'Pancakes & French Toast', price: 24.0, stationId: 'st-desserts', inStock: true },
  { id: 'biscoff-french-toast', name: 'Biscoff French Toast', category: 'Pancakes & French Toast', price: 24.0, stationId: 'st-desserts', inStock: true },
  { id: 'classic-pancakes', name: 'Classic Pancakes', category: 'Pancakes & French Toast', price: 22.0, stationId: 'st-desserts', inStock: true },
];

export const INITIAL_STATIONS: KDSStation[] = [
  { id: 'st-grill', name: 'Charcoal Grill Station', color: 'orange', printerId: 'pr-grill', labelPrintingEnabled: false },
  { id: 'st-kitchen', name: 'Mains & Kitchen Station', color: 'coffee', printerId: 'pr-kitchen', labelPrintingEnabled: false },
  { id: 'st-hotmezze', name: 'Hot Mezze Station', color: 'sun', printerId: 'pr-hotmezze', labelPrintingEnabled: false },
  { id: 'st-coldmezze', name: 'Cold Mezze & Salads', color: 'olive', printerId: 'pr-coldmezze', labelPrintingEnabled: false },
  { id: 'st-drinks', name: 'Coffee & Beverage Bar', color: 'sky', printerId: 'pr-drinks', labelPrintingEnabled: false },
  { id: 'st-desserts', name: 'Desserts Station', color: 'desert', printerId: 'pr-desserts', labelPrintingEnabled: false },
  { id: 'st-packing', name: 'Packing & Pass Station', color: 'indigo', printerId: 'pr-packing', labelPrintingEnabled: true },
];

export const INITIAL_PRINTERS: Printer[] = [
  { id: 'pr-grill', name: 'Grill Station Label Printer (Brother QL-820)', type: 'label', status: 'online', stationId: 'st-grill' },
  { id: 'pr-kitchen', name: 'Kitchen Label Printer (Zebra ZD421)', type: 'label', status: 'online', stationId: 'st-kitchen' },
  { id: 'pr-hotmezze', name: 'Hot Mezze Printer (Epson TM-T88)', type: 'label', status: 'online', stationId: 'st-hotmezze' },
  { id: 'pr-coldmezze', name: 'Cold Mezze Printer (Brother QL-820)', type: 'label', status: 'online', stationId: 'st-coldmezze' },
  { id: 'pr-drinks', name: 'Bar Printer (Epson TM-T88)', type: 'label', status: 'online', stationId: 'st-drinks' },
  { id: 'pr-desserts', name: 'Dessert Printer (Brother QL-820)', type: 'label', status: 'online', stationId: 'st-desserts' },
  { id: 'pr-packing', name: 'Packing Docket Receipt Printer (Star TSP143)', type: 'receipt', status: 'online', stationId: 'st-packing' },
];

export const DEFAULT_CONFIG: KDSConfig = {
  stations: INITIAL_STATIONS,
  categoryRouting: {
    'From Our Grill': 'st-grill',
    'Mains': 'st-kitchen',
    'Hot Mezze': 'st-hotmezze',
    'Cold Mezze': 'st-coldmezze',
    'Salads & Dips': 'st-coldmezze',
    'Coffee & Hot Drinks': 'st-drinks',
    'Cold Drinks': 'st-drinks',
    'Pancakes & French Toast': 'st-desserts',
  },
  displayOrder: ['st-grill', 'st-kitchen', 'st-hotmezze', 'st-coldmezze', 'st-drinks', 'st-desserts', 'st-packing'],
  undoGracePeriodSeconds: 5,
  fadeEmptyStationOrders: true,
  storageVersion: '2.1.0',
};

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'SUFRA-101',
    source: 'Square POS',
    customerName: 'Tariq Al-Mansoor',
    tableNumber: 'Table 4',
    createdAt: new Date(Date.now() - 12 * 60000).toISOString(), // 12 mins ago
    status: 'preparing',
    comboName: '🇦🇫 Afghan Feast Combo',
    items: [
      {
        id: 'item-1',
        menuItemId: 'afghan-mix',
        name: 'Afghan Mixed Plate',
        quantity: 2,
        completedQuantity: 1, // 1 prepared, 1 cooking
        packedQuantity: 0,
        status: 'preparing',
        stationId: 'st-grill',
        reprintCount: 0,
        modifiers: ['RICE CHOICE: KABULI PALAW', 'EXTRA SIRMAST DIP'],
      },
      {
        id: 'item-2',
        menuItemId: 'mantu-dumplings',
        name: 'Mantu (12 Lamb Dumplings)',
        quantity: 1,
        completedQuantity: 1, // fully prepared
        packedQuantity: 0,
        status: 'preparing',
        stationId: 'st-hotmezze',
        reprintCount: 0,
      },
      {
        id: 'item-3',
        menuItemId: 'fattoush',
        name: 'Fattoush Salad',
        quantity: 1,
        completedQuantity: 1,
        packedQuantity: 0,
        status: 'preparing',
        stationId: 'st-coldmezze',
        reprintCount: 0,
        modifiers: ['EXTRA POMEGRANATE MOLASSES'],
      },
      {
        id: 'item-4',
        menuItemId: 'dough-drink',
        name: 'Dough Yoghurt Drink (Jug)',
        quantity: 1,
        completedQuantity: 1,
        packedQuantity: 0,
        status: 'preparing',
        stationId: 'st-drinks',
        reprintCount: 0,
      },
    ],
    notes: 'Extra fresh naan bread with mixed plate please',
  },
  {
    id: 'SUFRA-102',
    source: 'Online Store',
    customerName: 'Amina Khan',
    tableNumber: 'Takeaway Pickup',
    createdAt: new Date(Date.now() - 6 * 60000).toISOString(), // 6 mins ago
    status: 'preparing',
    items: [
      {
        id: 'item-5',
        menuItemId: 'chalaw-gosht',
        name: 'Chalaw Gosht (Lamb Shank)',
        quantity: 1,
        completedQuantity: 0,
        packedQuantity: 0,
        status: 'preparing',
        stationId: 'st-kitchen',
        reprintCount: 0,
        modifiers: ['EXTRA BARBERRIES'],
      },
      {
        id: 'item-6',
        menuItemId: 'arnabeet',
        name: 'Arnabeet (Fried Cauliflower)',
        quantity: 1,
        completedQuantity: 0,
        packedQuantity: 0,
        status: 'preparing',
        stationId: 'st-hotmezze',
        reprintCount: 0,
      },
      {
        id: 'item-7',
        menuItemId: 'fresh-lemonade-330ml',
        name: 'Refreshing Lemonade 330ml',
        quantity: 2,
        completedQuantity: 2,
        packedQuantity: 0,
        status: 'preparing',
        stationId: 'st-drinks',
        reprintCount: 0,
      },
    ],
  },
  {
    id: 'SUFRA-100',
    source: 'Square POS',
    customerName: 'Youssef Hadid',
    tableNumber: 'Table 9',
    createdAt: new Date(Date.now() - 28 * 60000).toISOString(),
    completedAt: new Date(Date.now() - 4 * 60000).toISOString(),
    status: 'completed',
    items: [
      {
        id: 'item-8',
        menuItemId: 'mansaf-lamb',
        name: 'Mansaf Lamb Plate',
        quantity: 1,
        completedQuantity: 1,
        packedQuantity: 1,
        status: 'completed',
        stationId: 'st-kitchen',
        reprintCount: 1,
      },
      {
        id: 'item-9',
        menuItemId: 'hummus-dip',
        name: 'Hummus Dip',
        quantity: 1,
        completedQuantity: 1,
        packedQuantity: 1,
        status: 'completed',
        stationId: 'st-coldmezze',
        reprintCount: 0,
      },
    ],
  },
];
