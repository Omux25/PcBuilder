# PC Builder - Future Features & Roadmap

## 📋 Instructions for Adding Features
To keep this roadmap organized and actionable, please follow these guidelines when adding new ideas:

1.  **Sectioning:** Place features in the appropriate status category (Planned, Researching, or Long-term).
2.  **Description:** Briefly explain the "What" and "Why" (User value).
3.  **Technical Notes:** Include ideas for implementation, potential data sources, or architectural impact.
4.  **Priority:** Mark as Low, Medium, or High.

---

## 🚀 Planned Features

### 1. FPS Estimator (Build Performance Visualization)
- **Status:** Planned
- **Priority:** High
- **Description:** A dedicated page or section that becomes available once a build is "finalized" (Motherboard, CPU, GPU, and RAM selected). It will show estimated FPS for 5-10 popular games (e.g., Fortnite, Valorant, Cyberpunk 2077) at 1080p, 1440p, and 4K resolutions.
- **Technical Implementation:**
    - **Logic:** Calculate a "Performance Score" by combining the CPU and GPU benchmark scores already in our database.
    - **Data Mapping:** Create a lookup table of "Base Game Performance" (FPS on a reference system) and scale it using the build's Performance Score.
    - **Data Sources:** 
        - Scraping/Gathering data from tech reviewers like *Hardware Unboxed* or *Gamers Nexus*.
        - Using the [Technical City API](https://technical.city/en/can-i-run-it) or similar benchmark databases.
        - Community-submitted benchmarks for specific hardware combos.

### 2. Build Sharing & Export
- **Status:** In Progress
- **Priority:** High
- **Description:** Allow users to generate a short, shareable link or a PDF/Image export of their build to show friends or get advice on forums.

---

## 🔍 Researching

### 1. Manufacturer Site "Deep-Deep" Scraper
- **Description:** Automate the search for missing MPNs directly on MSI, ASUS, and Gigabyte sites when retailer technical sheets are incomplete.
- **Goal:** Reach 100% data density for "Physical Dimensions" (Cooler heights, Case widths).

---

## 💤 Long-term Ideas

### 1. User Accounts & Build History
- Allow users to save multiple "Drafts" to their profile.

### 2. Price Alerts
- Notify users via email when a specific component in their build drops below a certain price.
