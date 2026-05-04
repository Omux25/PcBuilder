# Requirements Document

## Introduction

This document defines the functional and non-functional requirements for the **PC Builder Web Platform for Morocco**. The platform allows users to compose a custom PC build by selecting compatible components, compare prices in near real-time from Moroccan retailers, and be redirected to the retailer's website to complete their purchase. The system involves three main actors: the User (visitor), the Administrator, and an autonomous Scraping System.

---

## Glossary

- **Configurator**: The interactive module that allows the User to select and assemble PC components.
- **Compatibility Engine**: The backend subsystem responsible for validating compatibility rules between components.
- **Scraper**: Automated scripts (Node.js/Crawlee) that extract prices and stock availability from Moroccan e-commerce sites.
- **Aggregator**: The module that normalizes and consolidates data collected by the Scraper.
- **User**: Any person (enthusiast, gamer, professional) who accesses the platform to configure a PC build.
- **Administrator**: The developer or manager who maintains the component database and monitors scraping scripts.
- **Component**: An internal PC hardware part from the following categories: CPU, Motherboard, GPU, RAM, Storage, PSU, Case.
- **TDP**: Thermal Design Power — the maximum power consumption of a component, expressed in watts.
- **Socket**: The physical interface between the CPU and the Motherboard (e.g., AM5, LGA1700).
- **Retailer**: A Moroccan e-commerce website referenced in the platform.
- **API**: Application Programming Interface exposed by the Express/Node.js backend.

---

## Requirements

### Requirement 1: Component Selection and Assembly

**User Story:** As a User, I want to select PC components by category so that I can compose a custom build tailored to my needs.

#### Acceptance Criteria

1. THE Configurator SHALL offer the following seven component categories: CPU, Motherboard, GPU, RAM, Storage, PSU, Case.
2. WHEN the User selects a component category, THE Configurator SHALL display the list of available components for that category.
3. WHEN the User selects a component, THE Configurator SHALL add it to the current build and update the build summary.
4. WHEN the User removes a component from the build, THE Configurator SHALL remove it from the summary and recalculate all compatibility validations.
5. THE Configurator SHALL allow the User to reset the entire current build.

---

### Requirement 2: Compatibility Engine — CPU / Motherboard Socket

**User Story:** As a User, I want to be automatically alerted if the CPU and Motherboard are incompatible so that I can avoid a costly purchase mistake.

#### Acceptance Criteria

1. WHEN the User selects a CPU and a Motherboard, THE Compatibility Engine SHALL verify that the CPU socket matches the socket supported by the Motherboard.
2. IF the CPU socket does not match the Motherboard socket, THEN THE Compatibility Engine SHALL display a compatibility alert indicating the conflicting sockets.
3. WHILE a socket incompatibility is detected, THE Configurator SHALL visually highlight the incompatible components in the build summary.
4. WHEN the User filters components in a category after having selected a component in a related category, THE Configurator SHALL prioritize displaying components compatible with the existing selection.

---

### Requirement 3: Compatibility Engine — RAM Type and Frequency

**User Story:** As a User, I want the platform to verify RAM compatibility with the Motherboard so that I can be sure the memory sticks will work correctly.

#### Acceptance Criteria

1. WHEN the User selects a RAM stick and a Motherboard, THE Compatibility Engine SHALL verify that the RAM type (DDR4 or DDR5) is supported by the Motherboard.
2. IF the RAM type is not supported by the Motherboard, THEN THE Compatibility Engine SHALL display an alert specifying the RAM type required by the Motherboard and the type of the selected RAM.
3. WHEN the User selects a RAM stick whose frequency exceeds the maximum frequency supported by the Motherboard, THE Compatibility Engine SHALL display a warning indicating the maximum supported frequency.

---

### Requirement 4: Compatibility Engine — GPU / Case Dimensions

**User Story:** As a User, I want to verify that the GPU physically fits inside the selected Case so that I can avoid a clearance issue.

#### Acceptance Criteria

1. WHEN the User selects a GPU and a Case, THE Compatibility Engine SHALL compare the GPU length (in mm) against the maximum GPU length supported by the Case.
2. IF the GPU length exceeds the maximum length supported by the Case, THEN THE Compatibility Engine SHALL display an alert indicating the GPU length and the Case's maximum GPU clearance.
3. THE Configurator SHALL store the maximum supported GPU length for each Case in the database.

---

### Requirement 5: Compatibility Engine — Power Consumption and PSU Recommendation

**User Story:** As a User, I want the platform to calculate the total power consumption of my build and recommend an appropriate PSU so that I can avoid an underpowered power supply.

#### Acceptance Criteria

1. WHEN the User adds or removes a component from the build, THE Compatibility Engine SHALL recalculate the sum of TDP values for all selected components.
2. THE Compatibility Engine SHALL calculate the recommended PSU wattage by applying a 20% margin on the total TDP (formula: total_TDP × 1.2).
3. WHEN the wattage of the selected PSU is lower than the calculated recommended wattage, THE Compatibility Engine SHALL display a warning indicating the recommended wattage and the selected PSU's wattage.
4. THE Configurator SHALL permanently display the estimated total power consumption and the recommended PSU wattage in the build summary.

---

### Requirement 6: Scraping and Price Updates

**User Story:** As a User, I want to view up-to-date prices from Moroccan retailers so that I can compare offers without visiting each site manually.

#### Acceptance Criteria

1. THE Scraper SHALL automatically extract the price and stock availability of each referenced component from the pre-selected Moroccan e-commerce sites.
2. THE Scraper SHALL perform a full update of price and stock data every 24 hours.
3. WHEN the Scraper completes a scraping session, THE Aggregator SHALL record the date and time of the last update for each price entry in the database.
4. IF the Scraper encounters an error while extracting from a site (timeout, changed HTML structure, blocking), THEN THE Scraper SHALL log the error to the system logs and continue extracting from the remaining sites without interruption.
5. THE Aggregator SHALL normalize product names collected from different retailers in order to associate them with the corresponding component in the database.

---

### Requirement 7: Price Comparison and Retailer Redirection

**User Story:** As a User, I want to compare prices for a component across different retailers and be redirected to the retailer's website so that I can complete my purchase at the best price.

#### Acceptance Criteria

1. WHEN the User views a component's detail page, THE Configurator SHALL display the list of available offers for that component, sorted by ascending price, with the retailer name, price, and stock availability.
2. WHEN the User clicks on a retailer's offer, THE Configurator SHALL open the retailer's product page in a new browser tab.
3. THE Configurator SHALL display the date of the last price update for each displayed offer.
4. IF no offer is available for a component, THEN THE Configurator SHALL display a message indicating that the component is not available from any referenced retailer.

---

### Requirement 8: Component Catalog Management (Administration)

**User Story:** As an Administrator, I want to manage the component catalog and compatibility rules so that I can keep the database up to date and consistent.

#### Acceptance Criteria

1. THE API SHALL expose secured endpoints allowing the Administrator to add, update, and delete components in the database.
2. WHEN the Administrator adds a component, THE API SHALL validate that all required fields (name, category, socket/type depending on category, TDP, dimensions if applicable) are provided before saving the component.
3. IF a required field is missing when adding a component, THEN THE API SHALL return HTTP 400 with a message describing the missing field(s).
4. THE API SHALL expose endpoints allowing the Administrator to view the Scraper execution logs.

---

### Requirement 9: Scraping Script Monitoring (Administration)

**User Story:** As an Administrator, I want to monitor the status and logs of the scraping scripts so that I can quickly detect and fix data collection anomalies.

#### Acceptance Criteria

1. THE Scraper SHALL log the start and end of each scraping session to the system logs, along with the number of components updated.
2. THE Scraper SHALL log each error encountered during extraction to the system logs, including the site name, error type, and timestamp.
3. WHEN the Administrator queries the logs via the API, THE API SHALL return log entries filterable by date, site, and severity level (INFO, WARNING, ERROR).

---

### Requirement 10: Filtering Engine Performance

**User Story:** As a User, I want filtering and compatibility validation results to appear quickly so that I am not slowed down while configuring my build.

#### Acceptance Criteria

1. WHEN the User submits a filtering or compatibility validation request, THE API SHALL return the response in under 500ms under normal load conditions.
2. THE API SHALL support concurrent requests without degrading response time beyond the 500ms threshold for filtering and compatibility operations.

---

### Requirement 11: API Security

**User Story:** As an Administrator, I want the API to be protected against common attacks so that data integrity and service availability are guaranteed.

#### Acceptance Criteria

1. THE API SHALL use parameterized queries (prepared statements) for all interactions with the PostgreSQL database to prevent SQL injection.
2. THE API SHALL validate and sanitize all input data before any processing or persistence to the database.
3. THE API SHALL restrict access to administration endpoints to authenticated requests only.
4. IF an unauthenticated request attempts to access an administration endpoint, THEN THE API SHALL return HTTP 401.

---

### Requirement 12: Responsive Interface and Accessibility

**User Story:** As a User, I want to access the platform from a desktop or smartphone so that I can configure my PC build from any device.

#### Acceptance Criteria

1. THE Configurator SHALL display a usable and readable interface on screens with widths between 320px and 2560px.
2. THE Configurator SHALL adapt the layout of interface elements (navigation, component lists, build summary) based on the User's screen size.
3. THE Configurator SHALL display compatibility alerts in a visible and understandable manner on both mobile and desktop formats.
