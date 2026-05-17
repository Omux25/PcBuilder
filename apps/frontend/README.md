# 🎨 Frontend — PC Builder Morocco

The main user-facing application for configuring PC builds, browsing components, and tracking market trends. Built with **React**, **Vite**, and **TypeScript**.

---

## 🏗️ Architecture

The frontend is a Single Page Application (SPA) designed for high performance and smooth user interactions.

### 📂 [**`src/pages`**](./src/pages)
Major views of the application.
- [**`Home`**](./src/pages/Home.tsx) — Landing page with featured categories.
- [**`CategoryBrowse`**](./src/pages/CategoryBrowse.tsx) — Main catalog with advanced filters.
- [**`ComponentDetail`**](./src/pages/ComponentDetail.tsx) — Detailed specifications and price comparison for a single part.
- [**`Compare`**](./src/pages/Compare.tsx) — Side-by-side comparison of multiple components.
- [**`MarketTrends`**](./src/pages/MarketTrends.tsx) — Price history and availability charts.

### 📂 [**`src/components`**](./src/components)
Reusable UI components.
- [**`Configurator`**](./src/components/Configurator.tsx) — The heart of the app: the build assembly interface.
- [**`ComponentPicker`**](./src/components/ComponentPicker.tsx) — Modal/interface for selecting parts.
- [**`PriceHistoryChart`**](./src/components/PriceHistoryChart.tsx) — Visual data using Recharts.

### 📂 [**`src/context`**](./src/context)
Global state management.
- **`BuildContext`** — Manages the current active PC build across different pages.

---

## 🛠️ Development

### Setup

Install dependencies from the frontend directory:
```bash
bun install
```

### Running

```bash
bun dev     # Start Vite development server
```

### Building

```bash
bun build   # Production build (outputs to dist/)
```

---

## ✨ Features

- **Real-time Configuration:** Automatic compatibility checking as you build.
- **Price Tracking:** Multi-retailer price comparison and historical data.
- **Responsive Design:** Optimized for both desktop and mobile builders.
- **Theme Support:** Native light/dark mode support.
