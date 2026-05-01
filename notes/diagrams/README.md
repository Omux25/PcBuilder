# Project Diagrams

PlantUML source files for the PC Builder platform. Committed to Git — rendered PNGs are gitignored.

## How to regenerate PNGs

Requires Java and Graphviz. Place `plantuml.jar` at the project root.

```bash
# From the project root
java -jar plantuml.jar -tpng notes/diagrams/*.puml -o rendered
```

PNGs are written to `notes/diagrams/rendered/` (gitignored).

---

## Diagram Index

| File | Type | What it shows |
|---|---|---|
| [use_case.puml](use_case.puml) | Use Case | All actors and use cases — user, admin, scheduler |
| [class.puml](class.puml) | Class | Domain model — components, pricing, scraping, services |
| [activity.puml](activity.puml) | Activity | Full user journey — build, validate, compare, buy |
| [sequence_compatibility.puml](sequence_compatibility.puml) | Sequence | Compatibility validation — rules, TDP, response |
| [sequence_scraping.puml](sequence_scraping.puml) | Sequence | Automated scraping — scrapers, aggregator, DNA matcher |
| [sequence_admin.puml](sequence_admin.puml) | Sequence | Admin flow — login, create component, link listing |
