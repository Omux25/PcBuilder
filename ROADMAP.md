# 🗺️ PC Builder Morocco - Product Roadmap

This document outlines the strategic product vision, future features, and ongoing developments for the PC Builder Morocco platform.

---

## 🚀 Planned & Active Features

### 1. 📊 Real-time FPS Estimator (Performance Visualization)
*   **Priority:** High
*   **Current Progress:** 🟢 **50% Completed (Backend & Data Ready)**
*   **Description:** An interactive performance panel that unlocks once a user has a "finalized" base build (CPU, GPU, RAM, Motherboard). It displays estimated FPS charts for 5-10 popular competitive and AAA games (e.g., *Fortnite*, *Valorant*, *Cyberpunk 2077*) across 1080p, 1440p, and 4K resolutions.
*   **Current State & Technical Blueprint:**
    *   [x] **Automated Benchmark Syncing:** Swallowed paths in the benchmark importer are fixed. Automated scraper sessions now correctly populate `benchmark_score` for all catalog CPUs and GPUs.
    *   [ ] **FPS Scaling Lookup Engine:** Map game-specific baseline frame rates (e.g., using a reference RTX 4060 + Ryzen 5 7600 configuration) and write scaling functions utilizing the system's calculated CPU/GPU performance delta.
    *   [ ] **Frontend Panel:** Build a high-density charts section in the configurator utilizing smooth transitions and visual graphs to display game scaling.

### 2. 🔗 Build Sharing & PDF/Image Export
*   **Priority:** High
*   **Current Progress:** 🟡 **70% Completed (Core Serialization Ready)**
*   **Description:** Allow builders to generate compact, shareable URLs of their configurator state or export the PC specs list to a beautiful PDF/Image to share on social media or forums.
*   **Current State & Technical Blueprint:**
    *   [x] **State Serialization:** Fully implemented in [buildUrl.ts](file:///c:/Headquarters/Projects/PcBuilder/apps/frontend/src/utils/buildUrl.ts) which encodes/decodes multi-slot component arrays directly into lightweight URL search queries.
    *   [ ] **Configurator Share Action:** Add a "Share Build" action card/button in [Configurator.tsx](file:///c:/Headquarters/Projects/PcBuilder/apps/frontend/src/components/Configurator.tsx) to quickly copy the URL to the clipboard with micro-interaction feedback.
    *   [ ] **Export Sheet Generator:** Integrate SVG/PDF rendering logic (such as client-side `html2canvas` or `jsPDF`) to render and download a printable build sheet.

### 🔑 3. User Accounts & Historical Build History
*   **Priority:** Medium
*   **Current Progress:** 🔴 **20% Completed (Auth Foundations Ready)**
*   **Description:** Enable users to register accounts to save multiple PC build "Drafts", track their historic part lists, and synchronize configurations across devices.
*   **Current State & Technical Blueprint:**
    *   [x] **Authentication Framework:** Core API authentication models and JWT helper classes are established in the backend.
    *   [ ] **Drafts Database Relations:** Create database tables connecting a `saved_builds` list back to the existing `users` table.
    *   [ ] **Auth Dialogs:** Implement premium, responsive login/signup modals on the frontend.

---

## 🔍 Researching & Background Tasks

### 🤖 1. Manufacturer Site Deep spec-Mining
*   **Priority:** Medium
*   **Current Progress:** 🟡 **40% Completed (Mining Logic Ready)**
*   **Goal:** Reach 100% data density for component physical measurements (Case GPU clearance, cooler clearance, cooler heights) to power high-fidelity compatibility validations.
*   **Current State & Technical Blueprint:**
    *   [x] **Specification Mining Services:** Advanced keyword regex match utilities and semantic miners are defined inside `specMiningService.ts`.
    *   [ ] **Deep Manufacturer Crawlers:** Build secondary, low-frequency scrapers targeting official manufacture sites (ASUS, MSI, Gigabyte, Corsair) using exact part numbers (MPNs) as keys to extract precise master specification sheets.

---

## 💤 Long-term Ideas

### 🔔 1. Configurator Price Drop Alerts
*   **Priority:** Low
*   **Current Progress:** 🔴 **0%**
*   **Description:** Alert registered builders via email when any specific part in their saved drafts drops below their defined budget threshold.
*   **Technical Blueprint:**
    *   Set up a automated background cron worker checking the `prices` and `price_history` delta.
    *   Integrate email dispatch services (e.g. Resend, Nodemailer) to push high-conversion alert templates.
