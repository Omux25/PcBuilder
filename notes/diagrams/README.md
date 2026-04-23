# Diagrams

PlantUML source files for all project diagrams. These are the source of truth — the generated PNG images live in `docs/uml/` (gitignored).

## How to regenerate PNGs

You need Java installed. The PlantUML jar is at `docs/plantuml.jar`.

```bash
# From the project root — generates all diagrams at once
java -DPLANTUML_LIMIT_SIZE=8192 -jar docs/plantuml.jar -tpng notes/diagrams/*.puml -o "../../docs/uml"
```

To regenerate a single file:
```bash
java -DPLANTUML_LIMIT_SIZE=8192 -jar docs/plantuml.jar -tpng notes/diagrams/class.puml -o "../../docs/uml"
```

## Diagram index

| File | Type | What it shows |
|---|---|---|
| [use_case.puml](use_case.puml) | Use Case | Actors (User, Admin, Scraping Bot) and all system use cases |
| [class.puml](class.puml) | Class | Domain model, services, scrapers, DTOs and their relationships |
| [activity.puml](activity.puml) | Activity | Complete user flow from component selection to retailer redirect |
| [user_journey.puml](user_journey.puml) | Activity | Simplified user journey (same flow, less detail) |
| [sequence_1_compatibility.puml](sequence_1_compatibility.puml) | Sequence | Component selection and compatibility validation |
| [sequence_2_price_comparison.puml](sequence_2_price_comparison.puml) | Sequence | Price comparison and retailer redirect |
| [sequence_3_admin.puml](sequence_3_admin.puml) | Sequence | Admin login and component management |
| [sequence_scraping.puml](sequence_scraping.puml) | Sequence | Daily price scraping background process |
| [sequence.puml](sequence.puml) | Sequence | Combined flow: browse, select, validate, compare prices |
| [architecture.puml](architecture.puml) | Component | System architecture: frontend, backend, scraper, database |
| [database.puml](database.puml) | ERD | Database schema with all 5 tables and relationships |
| [api_routes.puml](api_routes.puml) | Component | All REST API routes, public vs protected, linked to services |
| [compatibility_flow.puml](compatibility_flow.puml) | Sequence | Detailed compatibility engine validation flow |
| [scraping_flow.puml](scraping_flow.puml) | Sequence | Detailed scraping cycle with error handling |

## The 4 official UML diagrams (for school submission)

These are the four diagrams required for the project presentation:

| Diagram | File | PNG |
|---|---|---|
| Use Case | `use_case.puml` | `docs/uml/Use Case Diagram.png` |
| Class | `class.puml` | `docs/uml/Class Diagram.png` |
| Activity | `activity.puml` | `docs/uml/Activity Diagram.png` |
| Sequence 1 | `sequence_1_compatibility.puml` | `docs/uml/Sequence 1 - Compatibility Validation.png` |
| Sequence 2 | `sequence_2_price_comparison.puml` | `docs/uml/Sequence 2 - Price Comparison.png` |
| Sequence 3 | `sequence_3_admin.puml` | `docs/uml/Sequence 3 - Admin Login and Component Management.png` |
| Sequence (scraping) | `sequence_scraping.puml` | `docs/uml/Sequence - Daily Price Scraping.png` |

## PlantUML conventions used in this project

| Syntax | Meaning |
|---|---|
| `<<include>>` | Mandatory relationship — always happens |
| `<<extend>>` | Conditional relationship — only sometimes |
| `/attributeName` | Derived attribute — calculated at runtime, not stored |
| `abstract class` | Cannot be instantiated directly |
| `{abstract}` | Abstract method — must be implemented by subclass |
