# Diagrams

PlantUML source files for all project diagrams. These are the source of truth — the generated PNG images live in `notes/diagrams/rendered2/` (gitignored).

## How to regenerate PNGs

You need Java installed. Download the PlantUML jar from [plantuml.com](https://plantuml.com/download) and place it at the project root. The rendered PNGs go into `notes/diagrams/rendered2/` which is gitignored.

```bash
# From the project root — generates all diagrams at once
java -DPLANTUML_LIMIT_SIZE=8192 -jar plantuml.jar -tpng notes/diagrams/*.puml -o rendered2
```

To regenerate a single file:
```bash
java -DPLANTUML_LIMIT_SIZE=8192 -jar plantuml.jar -tpng notes/diagrams/class.puml -o rendered2
```

## Diagram index

| File | Type | What it shows |
|---|---|---|
| [use_case.puml](use_case.puml) | Use Case | Actors (User, Admin, Scraping Bot) and all 27 system use cases |
| [class.puml](class.puml) | Class | Domain model (8 component types), services, scrapers, DTOs and relationships |
| [activity.puml](activity.puml) | Activity | Complete user flow: component selection → compatibility → price comparison → redirect |
| [sequence_1_compatibility.puml](sequence_1_compatibility.puml) | Sequence | Component browsing and compatibility validation (6 rules) |
| [sequence_2_price_comparison.puml](sequence_2_price_comparison.puml) | Sequence | Price comparison, price history chart, and retailer redirect |
| [sequence_3_admin.puml](sequence_3_admin.puml) | Sequence | Admin login (JWT + refresh tokens) and component management |
| [sequence_scraping.puml](sequence_scraping.puml) | Sequence | Automated scraping: 5 scrapers → aggregation → auto-mapping → catalog builder |

## PlantUML conventions used in this project

| Syntax | Meaning |
|---|---|
| `<<include>>` | Mandatory relationship — always happens |
| `<<extend>>` | Conditional relationship — only sometimes |
| `/attributeName` | Derived attribute — calculated at runtime, not stored |
| `abstract class` | Cannot be instantiated directly |
| `{abstract}` | Abstract method — must be implemented by subclass |
