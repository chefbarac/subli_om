import { addDays, format } from 'date-fns';
import { normalizeColumns } from '@/lib/normalize';
import { labelForTag } from '@/lib/sizes';
import { type ColumnKey } from '@/types';
import type { AppData, Order, OrderItem, Settings } from '@/types';

export const DB_NAME = 'subli_om';
export const DB_VERSION = 2;

export const SETTINGS_VERSION = 2;

export const SETTINGS_MIGRATIONS: Record<number, Partial<Settings>> = {
  1: { exportTagCase: 'lower' },
};

export const DEFAULT_SETTINGS: Settings = {
  companyName: 'subli_om',
  receiptFooter: 'Thank you for your business.',
  currency: 'OMR',
  exportNameCase: 'lower',
  exportLabelCase: 'upper',
  exportTagCase: 'lower',
  exportPositionCase: 'as-is',
};

export const DEFAULT_STAGES = [
  'For Designing',
  'For Approval',
  'For Printing',
  'For Heatpress',
];

export function buildSeedData(): AppData {
  const stages = DEFAULT_STAGES.map((name, index) => ({
    id: index + 1,
    name,
    sortOrder: index,
    isActive: true,
  }));

  return {
    orders: [],
    items: [],
    stages,
    settings: { ...DEFAULT_SETTINGS },
  };
}

const NAME_POOL = [
  'Ahmed Al Hinai',
  'Mohammed Al Balushi',
  'Khalid Al Habsi',
  'Sultan Al Amri',
  'Nasser Al Rawahi',
  'Faisal Al Tamimi',
  'Yousuf Al Mandil',
  'Hamed Al Khuwaiti',
  'Rashed Al Busaidi',
  'Tariq Al Siyabi',
  'Marwan Al Mahbubi',
  'Ziad Al Hinai',
  'Abdullah Al Balushi',
  'Saif Al Jabri',
  'Anas Al Farsi',
  'Matar Al Rusaili',
  'Jalal Al Mahaimari',
  'Bader Al Aabdani',
  'Humaid Al Kindi',
  'Said Al Balushi',
  'Adam Al Hinai',
  'Hamza Al Musalim',
  'Abdullah Al Sawai',
  'Khalid Al Harbi',
  'Talal Al Hinai',
  'Mubarak Al Rashdi',
  'Salem Al Yaqoobi',
  'Issa Albalushi',
  'Ammar Al Siyabi',
  'Nawaf Al Habtoor',
  'Badar Al Awadi',
];

const POSITION_CYCLE = [
  'Captain',
  'Player',
  'Player',
  'Goalkeeper',
  'Player',
  'Assistant Coach',
  'Player',
  'Manager',
  'Player',
  'Player',
  'Coach',
  'Staff',
];

const NECK_CYCLE = ['Round Neck', 'V Neck', 'Polo Collar', 'Mandarin'];

const NOTE_CYCLE = ['', '', 'Name on front', 'Number on back only', 'Long sleeve'];

interface DemoPerson {
  name: string;
  jerseyNo: string;
  position: string;
  neckType: string;
  tag: string;
  notes: string;
}

interface DemoSpec {
  customer: string;
  product: string;
  description: string;
  stageIndex: number;
  dueOffsetDays: number | null;
  completed?: boolean;
  count: number;
  sizes: string[];
  columns: ColumnKey[];
  nameOffset?: number;
}

const ALL_COLUMNS: ColumnKey[] = [
  'name',
  'jerseyNo',
  'position',
  'neckType',
  'tag',
  'label',
  'notes',
];
const JERSEY_COLUMNS: ColumnKey[] = ['name', 'jerseyNo', 'tag', 'label', 'notes'];
const UNIFORM_COLUMNS: ColumnKey[] = ['name', 'position', 'neckType', 'tag', 'label', 'notes'];

const DEMO_SPECS: DemoSpec[] = [
  {
    customer: 'Muscat Sports Club',
    product: 'Football jersey, full sublimation',
    description: '18 players. Front crest, back name and number. Navy with gold trim.',
    stageIndex: 0,
    dueOffsetDays: 9,
    count: 18,
    sizes: ['Medium', 'Large', 'XLarge'],
    columns: JERSEY_COLUMNS,
  },
  {
    customer: 'Al Amerat School',
    product: 'House t-shirt, full sublimation',
    description: '30 students, white with red side panel. Names across the back.',
    stageIndex: 1,
    dueOffsetDays: 4,
    count: 30,
    sizes: ['Small', 'Medium', 'Large'],
    columns: UNIFORM_COLUMNS,
  },
  {
    customer: 'Oman Petroleum Club',
    product: 'Basketball jersey, full sublimation',
    description: '12 players. Yellow with black number, no name on front.',
    stageIndex: 2,
    dueOffsetDays: 2,
    count: 12,
    sizes: ['Large', 'XLarge', '2XLarge'],
    columns: JERSEY_COLUMNS,
    nameOffset: 6,
  },
  {
    customer: 'Qurum Housing Company',
    product: 'Safety vest, heat transfer logo',
    description: '8 vests for site staff. Logo on back and left chest.',
    stageIndex: 3,
    dueOffsetDays: 1,
    count: 8,
    sizes: ['Large', 'XLarge', 'B'],
    columns: UNIFORM_COLUMNS,
    nameOffset: 12,
  },
  {
    customer: 'Salalah Port Authority',
    product: 'Polo shirt, embroidery',
    description: '20 staff polos. Left chest logo, name on right chest.',
    stageIndex: 2,
    dueOffsetDays: -3,
    count: 20,
    sizes: ['Medium', 'Large', 'XLarge'],
    columns: UNIFORM_COLUMNS,
    nameOffset: 3,
  },
  {
    customer: 'Al Khuwair Cafeteria',
    product: 'Menu cover and staff apron',
    description: '4 aprons plus one menu board. Bring before opening hours.',
    stageIndex: 0,
    dueOffsetDays: 16,
    count: 4,
    sizes: ['B'],
    columns: UNIFORM_COLUMNS,
    nameOffset: 18,
  },
  {
    customer: 'Barka Mall Sports Academy',
    product: 'Training kit, jersey and shorts',
    description: '16 players aged 9 to 12. Two colour sets, one design.',
    stageIndex: 1,
    dueOffsetDays: 6,
    count: 16,
    sizes: ['Small', 'Medium', 'Large'],
    columns: ALL_COLUMNS,
    nameOffset: 9,
  },
  {
    customer: 'Ibri Municipality',
    product: 'Event staff vest, full sublimation',
    description: '10 volunteers for the heritage week. Green vest, white text.',
    stageIndex: 3,
    dueOffsetDays: -1,
    count: 10,
    sizes: ['Medium', 'Large', 'XLarge'],
    columns: UNIFORM_COLUMNS,
    nameOffset: 15,
  },
  {
    customer: 'Nizwa Date Festival Stall',
    product: 'Apron and cap, sublimation',
    description: '3 stall staff. Logo large on apron, small on cap.',
    stageIndex: 2,
    dueOffsetDays: 11,
    count: 3,
    sizes: ['B'],
    columns: UNIFORM_COLUMNS,
    nameOffset: 21,
  },
  {
    customer: 'Muscat Golf Club',
    product: 'Cap with embroidered logo',
    description: '6 caps. Embroider club crest on the front.',
    stageIndex: 1,
    dueOffsetDays: 21,
    count: 6,
    sizes: ['B'],
    columns: UNIFORM_COLUMNS,
    nameOffset: 24,
  },
  {
    customer: 'Sohar Aluminium',
    product: 'Gift mug, dye sublimation',
    description: '5 mugs for the annual dinner. Quote to be agreed, no due date yet.',
    stageIndex: 0,
    dueOffsetDays: null,
    count: 5,
    sizes: ['B'],
    columns: UNIFORM_COLUMNS,
    nameOffset: 2,
  },
  {
    customer: 'Rustaq Football Team',
    product: 'Away kit, full sublimation',
    description: '14 players, orange away kit. Delivered last week.',
    stageIndex: 3,
    dueOffsetDays: -6,
    completed: true,
    count: 14,
    sizes: ['Medium', 'Large', 'XLarge'],
    columns: JERSEY_COLUMNS,
    nameOffset: 5,
  },
];

function buildPeople(spec: DemoSpec): DemoPerson[] {
  const offset = spec.nameOffset ?? 0;
  return Array.from({ length: spec.count }, (_, index) => ({
    name: NAME_POOL[(index + offset) % NAME_POOL.length],
    jerseyNo: spec.columns.includes('jerseyNo')
        ? String(((index * 7 + offset) % 30) + 1)
        : '',
    position: POSITION_CYCLE[index % POSITION_CYCLE.length],
    neckType: NECK_CYCLE[index % NECK_CYCLE.length],
    tag: spec.sizes[index % spec.sizes.length],
    notes: NOTE_CYCLE[index % NOTE_CYCLE.length],
  }));
}

export function buildDemoOrders(): { orders: Order[]; items: OrderItem[] } {
  const base = buildSeedData();

  const today = new Date();
  const year = today.getFullYear();

  const orders: Order[] = DEMO_SPECS.map((spec, index) => {
    const id = index + 1;
    const created = addDays(today, -(14 - index));
    created.setHours(9, 0, 0, 0);
    const createdAt = created.toISOString();
    return {
      id,
      orderNo: `ORD-${year}-${String(id).padStart(4, '0')}`,
      customerName: spec.customer,
      description: spec.description,
      dueDate:
        spec.dueOffsetDays === null
          ? null
          : format(addDays(today, spec.dueOffsetDays), 'yyyy-MM-dd'),
      stageId: base.stages[spec.stageIndex].id,
      product: spec.product,
      columns: normalizeColumns(spec.columns),
      isCompleted: spec.completed ?? false,
      createdAt,
      updatedAt: createdAt,
    };
  });

  let itemId = 1;
  const items: OrderItem[] = [];

  DEMO_SPECS.forEach((spec, orderIndex) => {
    const order = orders[orderIndex];
    for (const [seq, person] of buildPeople(spec).entries()) {
      items.push({
        id: itemId,
        orderId: order.id,
        seq,
        name: person.name,
        jerseyNo: person.jerseyNo,
        position: person.position,
        neckType: person.neckType,
        tag: person.tag,
        label: labelForTag(person.tag),
        notes: person.notes,
      });
      itemId += 1;
    }
  });

  return { orders, items };
}

export function buildDemoData(): AppData {
  const base = buildSeedData();
  const { orders, items } = buildDemoOrders();
  return { ...base, orders, items };
}
