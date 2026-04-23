# Diagrams

PlantUML source files for all project diagrams. These are the source of truth — the generated PNG images live in `docs/uml/` (gitignored).

## How to regenerate PNGs

You need Java installed. Download the PlantUML jar from [plantuml.com](https://plantuml.com/download) and place it anywhere (e.g. project root). The rendered PNGs go into `notes/diagrams/rendered/` which is gitignored.

```bash
# From the project root — generates all diagrams at once
java -DPLANTUML_LIMIT_SIZE=8192 -jar plantuml.jar -tpng notes/diagrams/*.puml -o rendered
```

To regenerate a single file:
```bash
java -DPLANTUML_LIMIT_SIZE=8192 -jar plantuml.jar -tpng notes/diagrams/class.puml -o rendered
```

## Diagram index

| File | Type | What it shows | Rendered PNG |
|---|---|---|---|
| [use_case.puml](use_case.puml) | Use Case | Actors (User, Admin, Scraping Bot) and all system use cases | `rendered/Use Case Diagram.png` |
| [class.puml](class.puml) | Class | Domain model, services, scrapers, DTOs and their relationships | `rendered/Class Diagram.png` |
| [activity.puml](activity.puml) | Activity | Complete user flow from component selection to retailer redirect | `rendered/Activity Diagram.png` |
| [sequence_1_compatibility.puml](sequence_1_compatibility.puml) | Sequence | Component selection and compatibility validation | `rendered/Sequence 1 - Compatibility Validation.png` |
| [sequence_2_price_comparison.puml](sequence_2_price_comparison.puml) | Sequence | Price comparison and retailer redirect | `rendered/Sequence 2 - Price Comparison.png` |
| [sequence_3_admin.puml](sequence_3_admin.puml) | Sequence | Admin login and component management | `rendered/Sequence 3 - Admin Login and Component Management.png` |
| [sequence_scraping.puml](sequence_scraping.puml) | Sequence | Daily price scraping background process | `rendered/Sequence - Daily Price Scraping.png` |

## PlantUML conventions used in this project

| Syntax | Meaning |
|---|---|
| `<<include>>` | Mandatory relationship — always happens |
| `<<extend>>` | Conditional relationship — only sometimes |
| `/attributeName` | Derived attribute — calculated at runtime, not stored |
| `abstract class` | Cannot be instantiated directly |
| `{abstract}` | Abstract method — must be implemented by subclass |
