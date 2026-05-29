import { sql } from 'bun';
import { extractMotherboardSpecs } from '../../../../shared/hardware/specs/motherboard';

console.log('🔍 Auditing motherboards in database...\n');

const boards = await sql`
  SELECT id, name, brand, socket, chipset, form_factor, supported_ram_types, ram_slots
  FROM components
  WHERE category = 'motherboard' AND is_active = true
  ORDER BY id ASC
`;

console.log(`Total active motherboards in DB: ${boards.length}\n`);

let mismatchedSockets = 0;
let mismatchedRam = 0;
let mismatchedSlots = 0;
let missingSocketInDb = 0;
let missingRamInDb = 0;
let titleErrors = 0;

const socketMismatches: any[] = [];
const ramMismatches: any[] = [];
const slotsMismatches: any[] = [];
const missingSockets: any[] = [];
const missingRams: any[] = [];
const titleNoises: any[] = [];

for (const board of boards) {
  // Check for prefix/suffix noise in the title or brand
  if (board.name.startsWith(':') || board.name.includes(':') || board.name.startsWith('Cm ') || board.name.includes('Carte mere') || board.name.includes('Carte Mère')) {
    titleErrors++;
    titleNoises.push({ id: board.id, brand: board.brand, name: board.name });
  }

  const specs = extractMotherboardSpecs(board.name, board.brand);
  if (!specs) {
    console.log(`❌ Could not parse specs for: [${board.brand}] ${board.name}`);
    continue;
  }

  // Socket audit
  if (!board.socket) {
    missingSocketInDb++;
    missingSockets.push({ id: board.id, brand: board.brand, name: board.name, inferred: specs.socket });
  } else if (board.socket !== specs.socket) {
    mismatchedSockets++;
    socketMismatches.push({
      id: board.id,
      brand: board.brand,
      name: board.name,
      db: board.socket,
      inferred: specs.socket
    });
  }

  // RAM audit
  const dbRam = board.supported_ram_types ? board.supported_ram_types.join(',') : '';
  const inferredRam = specs.supported_ram_types ? specs.supported_ram_types.join(',') : '';

  if (!board.supported_ram_types || board.supported_ram_types.length === 0) {
    missingRamInDb++;
    missingRams.push({ id: board.id, brand: board.brand, name: board.name, inferred: inferredRam });
  } else if (dbRam !== inferredRam) {
    mismatchedRam++;
    ramMismatches.push({
      id: board.id,
      brand: board.brand,
      name: board.name,
      db: dbRam,
      inferred: inferredRam
    });
  }

  // Slots audit
  if (board.ram_slots !== specs.ram_slots) {
    mismatchedSlots++;
    slotsMismatches.push({
      id: board.id,
      brand: board.brand,
      name: board.name,
      db: board.ram_slots,
      inferred: specs.ram_slots
    });
  }
}

console.log(`\n--- RESULTS ---`);
console.log(`Title prefix/suffix noise detected: ${titleErrors}`);
if (titleNoises.length > 0) {
  console.log(titleNoises.slice(0, 10));
}

console.log(`Missing socket in DB: ${missingSocketInDb}`);
if (missingSockets.length > 0) {
  console.log(missingSockets.slice(0, 10));
}

console.log(`Mismatched sockets (DB vs Inferred): ${mismatchedSockets}`);
if (socketMismatches.length > 0) {
  console.log(socketMismatches.slice(0, 15));
}

console.log(`Missing RAM types in DB: ${missingRamInDb}`);
if (missingRams.length > 0) {
  console.log(missingRams.slice(0, 10));
}

console.log(`Mismatched RAM types (DB vs Inferred): ${mismatchedRam}`);
if (ramMismatches.length > 0) {
  console.log(ramMismatches.slice(0, 10));
}

console.log(`Mismatched slots (DB vs Inferred): ${mismatchedSlots}`);
if (slotsMismatches.length > 0) {
  console.log(slotsMismatches.slice(0, 15));
}

process.exit(0);
