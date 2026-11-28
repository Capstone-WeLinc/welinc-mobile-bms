import type { BookingStatus, ChargeLine, JobOrder } from "../types/bms";
import { toDateKey } from "../utils/dates";
import { SEEDER_HELPER, SEEDER_USER } from "./user";

// Seeder job orders, used only when EXPO_PUBLIC_USE_SEEDER_AUTH="true". Real job orders come from SyncService.

type Place = { area: string; address: string };

const PLACES: Record<string, Place> = {
  rainbow: { area: "Caloocan", address: "Blk 6 Lot 5 Mahogany St Rainbow Village 5 Phase 1, Barangay 173, Caloocan, NCR, 1400" },
  langit: { area: "Caloocan", address: "Phase 10-A, Package 2, Blk 30 Langit Road, Barangay 176-A, Caloocan, NCR, 1428" },
  bagumbong: { area: "Caloocan", address: "Bagumbong Rd, Barangay 171, Caloocan, NCR, 1421" },
  marikinaHeights: { area: "Marikina", address: "Warehouse 3, Marikina Heights, Marikina, NCR, 1810" },
  smNorth: { area: "Quezon City", address: "SM North EDSA Loading Bay, North Ave, Quezon City, NCR, 1105" },
  ortigas: { area: "Pasig", address: "Ortigas Ave, San Antonio, Pasig City, NCR, 1605" },
  pasay: { area: "Pasay", address: "Macapagal Blvd, Barangay 76, Pasay City, NCR, 1300" },
  paranaque: { area: "Parañaque", address: "Dr. A. Santos Ave, San Dionisio, Parañaque City, NCR, 1700" },
  makati: { area: "Makati", address: "Chino Roces Ave, Bangkal, Makati City, NCR, 1233" },
  manila: { area: "Manila", address: "Juan Luna St, Binondo, Manila, NCR, 1006" },
  taguig: { area: "Taguig", address: "5th Ave, Bonifacio Global City, Taguig, NCR, 1634" },
  valenzuela: { area: "Valenzuela", address: "McArthur Hwy, Malinta, Valenzuela City, NCR, 1440" },
  malabon: { area: "Malabon", address: "Gov. Pascual Ave, Potrero, Malabon City, NCR, 1475" },
  antipolo: { area: "Antipolo", address: "Sumulong Hwy, Mambugan, Antipolo, Rizal, 1870" },
  mandaluyong: { area: "Mandaluyong", address: "Shaw Blvd, Wack-Wack, Mandaluyong City, NCR, 1555" },
  sanJuan: { area: "San Juan", address: "N. Domingo St, Pasadeña, San Juan City, NCR, 1500" },
};

const VEHICLES = [
  { vehicle: "NBC-5560 · 300 Series 14ft. Dropside w/ Lifter", rate: { label: "NC: 6W 14 FT. W/ Lifter (2 Helpers)", amount: 6990 } },
  { vehicle: "NDA-2214 · Elf 10ft. Closed Van", rate: { label: "NC: 4W 10 FT. Closed Van (1 Helper)", amount: 4590 } },
  { vehicle: "NCX-8831 · Canter 16ft. Wing Van", rate: { label: "NC: 6W 16 FT. Wing Van (2 Helpers)", amount: 8490 } },
];

type Row = {
  days: number;
  time: string;
  client: string;
  from: keyof typeof PLACES;
  to: keyof typeof PLACES;
  status: BookingStatus;
  vehicleIndex?: number;
  insured?: boolean;
  payment?: string;
  items?: number;
  description?: string;
  instruction?: string;
  downPayment?: number;
};

const ROWS: Row[] = [
  { days: -5, time: "08:00", client: "Reyes Hardware", from: "bagumbong", to: "ortigas", status: "COMPLETED", items: 45, description: "Hardware supplies, Paint cans", payment: "Bank Transfer", downPayment: 8790 },
  { days: -4, time: "09:30", client: "Lim Electronics", from: "makati", to: "manila", status: "COMPLETED", vehicleIndex: 1, items: 12, description: "Appliances, Boxed electronics" },
  { days: -3, time: "13:00", client: "Garcia Furniture", from: "valenzuela", to: "malabon", status: "COMPLETED", vehicleIndex: 2, items: 18, description: "Sofa set, Dining table" },
  { days: -1, time: "07:30", client: "Santos Trading", from: "marikinaHeights", to: "smNorth", status: "COMPLETED", items: 60, description: "Dry goods, Sacks of rice", insured: false, payment: "Cash" },
  { days: 0, time: "08:00", client: "Dela Rosa Foods", from: "pasay", to: "paranaque", status: "COMPLETED", vehicleIndex: 1, items: 25, description: "Frozen goods (insulated boxes)", instruction: "Keep boxes upright; deliver to the back entrance." },
  { days: 0, time: "10:00", client: "Santos Trading", from: "marikinaHeights", to: "smNorth", status: "ONGOING", items: 40, description: "Dry goods, Canned products", instruction: "Coordinate with the loading bay guard before unloading.", downPayment: 3000 },
  { days: 0, time: "14:00", client: "Santos Trading", from: "marikinaHeights", to: "smNorth", status: "PENDING", items: 35, description: "Dry goods, Beverages" },
  { days: 0, time: "17:00", client: "Test 4", from: "rainbow", to: "langit", status: "PENDING", items: 30, description: "Fragile items, Furniture", instruction: "Parked infront the gate, handle the items with care", payment: "GCash" },
  { days: 1, time: "09:00", client: "Villanueva Builders", from: "antipolo", to: "ortigas", status: "PENDING", vehicleIndex: 2, items: 80, description: "Construction materials, Tiles" },
  { days: 2, time: "11:00", client: "Mendoza Logistics", from: "valenzuela", to: "malabon", status: "PENDING", items: 50, description: "Pallets, Packaged goods" },
  { days: 5, time: "08:30", client: "Cruz Appliances", from: "smNorth", to: "mandaluyong", status: "PENDING", vehicleIndex: 1, items: 8, description: "Refrigerator, Washing machine", instruction: "Unit is on the 3rd floor; use the service elevator." },
  { days: 6, time: "15:00", client: "Tan Supermart", from: "sanJuan", to: "taguig", status: "PENDING", items: 70, description: "Groceries, Frozen goods", payment: "Bank Transfer" },
];

/** Helper teams per vehicle. The seeder helper account (Bryan) is on the first team. */
const HELPERS: Array<Array<{ id: string; name: string }>> = [
  [{ id: SEEDER_HELPER.id, name: SEEDER_HELPER.name }, { id: "team-003", name: "Christian Bautista" }],
  [{ id: "team-004", name: "Mark Reyes" }],
  [{ id: "team-005", name: "Paolo Santos" }, { id: "team-006", name: "Jerome Cruz" }],
];

function minusMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h * 60 + m - minutes + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Seeder job orders placed relative to today so the screens always have data to show. */
export function getSeederJobOrders(today = new Date()): JobOrder[] {
  return ROWS.map((row, index) => {
    const seq = String(11 + index).padStart(4, "0");
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + row.days);
    const vehicle = VEHICLES[row.vehicleIndex ?? 0];
    const insured = row.insured ?? true;
    const from = PLACES[row.from];
    const to = PLACES[row.to];

    const charges: ChargeLine[] = [vehicle.rate, { label: "Ocular / Site Inspection (NCR)", amount: 300 }];
    if (insured) charges.push({ label: "Goods in Transit Insurance", amount: 1500 });

    return {
      id: `jo-${seq}`,
      jobOrderNumber: `JO-${date.getFullYear()}-${seq}`,
      bookingNumber: `BN-${toDateKey(date).replace(/-/g, "")}-0${seq}`,
      status: row.status,
      // Submitting the post-service record is what marks a job as done.
      postServiceFormSubmitted: row.status === "COMPLETED",
      // Seeder records are never finalized by an office.
      postServiceLocked: false,
      clientName: row.client,
      contactNumber: `0934 562 ${String(1980 + index).padStart(4, "0")}`,
      date: toDateKey(date),
      pickupTime: row.time,
      dispatchTime: minusMinutes(row.time, 30),
      driverId: SEEDER_USER.id,
      driverName: SEEDER_USER.name,
      helperIds: HELPERS[row.vehicleIndex ?? 0].map((h) => h.id),
      helperNames: HELPERS[row.vehicleIndex ?? 0].map((h) => h.name),
      garage: "Marikina",
      vehicle: vehicle.vehicle,
      pickupArea: from.area,
      pickupAddress: from.address,
      deliveryArea: to.area,
      deliveryAddress: to.address,
      estimatedItems: row.items ?? 20,
      itemDescription: row.description ?? "General cargo",
      customerInstruction: row.instruction ?? "None",
      insured,
      paymentMethod: row.payment ?? "GCash",
      charges,
      downPayment: row.downPayment ?? 0,
    };
  });
}
