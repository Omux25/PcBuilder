# 📐 Hardware Specifications — PC Builder Morocco

This directory contains the "Master Specification" definitions for every component category. These are used to ensure type-safety across the entire data pipeline — from scraping to database storage to frontend rendering.

---

## 📂 Category Specifications

Each file defines the structure and validation logic for a specific category:

- [**`cpu.ts`**](./cpu.ts) — Sockets, core counts, TDP, integrated graphics.
- [**`gpu.ts`**](./gpu.ts) — VRAM, length, TDP, power connectors.
- [**`motherboard.ts`**](./motherboard.ts) — Chipsets, form factors, RAM slots, PCIe lanes.
- [**`case.ts`**](./case.ts) — Max GPU length, max CPU cooler height, radiator support.
- [**`psu.ts`**](./psu.ts) — Wattage, efficiency rating, modularity.
- [**`ram.ts`**](./ram.ts) — DDR generation, speed, capacity, latency.
- [**`cooling.ts`**](./cooling.ts) — Air/Liquid, radiator sizes, socket compatibility.

---

## 🛠️ How to use

These specs are imported by:
1. **Admin UI:** To generate dynamic forms for editing component data.
2. **Compatibility Engine:** To perform logic checks (e.g., does this CPU fit this motherboard?).
3. **Frontend:** To display technical detail tables to the user.

---

## ➕ Adding a new Spec field

When adding a field (e.g., adding `hdmi_ports` to GPU):
1. Update the interface in the corresponding `.ts` file.
2. Update the default/example object if present.
3. Update the database schema in `apps/backend/src/core/db/schemas`.
4. Run migrations.
