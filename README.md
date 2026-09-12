# Warehouse Parcel Dispatch & Hub Transit Tracker

An internal logistics hub console designed for warehouse dispatch operations. The application coordinates inbound parcel registration, zone routing, van payload capacity staging, and atomic transit dispatch.

---

## Table of Contents
1. [Project Title](#1-project-title)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [Real-World Use Case](#4-real-world-use-case)
5. [Main Features](#5-main-features)
6. [Technology Stack](#6-technology-stack)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Project Folder Structure](#8-project-folder-structure)
9. [What Each Important Frontend File Does](#9-what-each-important-frontend-file-does)
10. [How the Application Starts](#10-how-the-application-starts)
11. [Complete Application Flow](#11-complete-application-flow)
12. [Dashboard Flow](#12-dashboard-flow)
13. [Inbound Intake Flow](#13-inbound-intake-flow)
14. [Loading Bay Flow](#14-loading-bay-flow)
15. [Zone Validation](#15-zone-validation)
16. [Payload / Capacity Validation](#16-payload--capacity-validation)
17. [Dispatch Flow](#17-dispatch-flow)
18. [Mock / Simulated Hub Mode](#18-mock--simulated-hub-mode)
19. [Live Flask API Mode](#19-live-flask-api-mode)
20. [API Endpoints Expected by the Frontend](#20-api-endpoints-expected-by-the-frontend)
21. [State & Data Flow](#21-state--data-flow)
22. [Validation Rules](#22-validation-rules)
23. [Complete Demo Scenario](#23-complete-demo-scenario)
24. [Current Limitations & Backend Dependencies](#24-current-limitations--backend-dependencies)
25. [How to Explain the Project During the Hackathon](#25-how-to-explain-the-project-during-the-hackathon)
26. [Understand the Project in 5 Minutes](#26-understand-the-project-in-5-minutes)
27. [How to Explain My Frontend Role](#27-how-to-explain-my-frontend-role)

---

## 1. Project Title
**Warehouse Parcel Dispatch & Hub Transit Tracker**  
*Internal Hub Dispatch & Fleet Loading Console*

---

## 2. Problem Statement
In physical distribution hubs, parcels arrive continuously and must be routed safely and accurately onto delivery vehicles. Warehouse dispatch faces three critical operational hazards:
1. **Misrouting (Zone Mismatches)**: Loading a package into a van assigned to a different geographic zone leads to failed delivery attempts, costly returns, and delayed customer orders.
2. **Vehicle Overloading (Payload Exceeded)**: Loading packages beyond a delivery van's maximum weight limit violates highway safety standards and increases vehicle wear.
3. **Partial & Unsynchronized Dispatches**: If vans leave without an exact locked manifest, hub managers lose visibility over which parcels are truly on the road versus stranded on warehouse shelves.

---

## 3. Solution Overview
The application acts as a central warehouse console with strict software-enforced checks:
* **Manual Parcel Intake**: Staff record tracking code, destination PIN, and weight (no barcode scanner is required).
* **Authoritative Zone Classification**: The system maps the postal PIN code to a dedicated delivery zone.
* **Stage as Unassigned**: Incoming packages enter a staging queue.
* **Intelligent Loading Bay**: When loading a vehicle, the system strictly blocks wrong-zone packages and rejects items exceeding remaining payload capacity.
* **Atomic Transit Dispatch**: Finalizing departure locks the manifest, transitions all loaded packages to `IN_TRANSIT` simultaneously, marks the van `DISPATCHED`, and logs the event in the audit trail.

---

## 4. Real-World Use Case
* **Environment**: Regional postal hub, e-commerce fulfillment center, or city courier terminal.
* **Primary Users**: Warehouse intake clerks, loading bay operators, and hub dispatch managers.
* **Hardware Setup**: Desktop workstations, industrial touch screens, or rugged warehouse tablets mounted at bay doors. (Note: **Barcode scanners are NOT used**; tracking codes are manually entered or selected from active staged queues).

---

## 5. Main Features
* **Manual Parcel Registration**: Simple, fast manual input for tracking codes, 6-digit destination PINs, and parcel weights.
* **Authoritative Zone Classification**: Zone assignment is determined by backend routing logic (not guessed by the frontend).
* **Split-Screen Loading Bay**:
  * Left panel: Filterable list of available unassigned parcels + search + manual "Add by Tracking Code" input.
  * Right panel: Active delivery van, live capacity meter, and itemized manifest.
* **Real-Time Capacity Visualization**: Dynamic progress bar displaying current payload, maximum payload, percentage used, and remaining kilograms (e.g., `58 kg / 100 kg (58%) • 42 kg remaining`).
* **Strict Rejection Alerts**: Clear, descriptive error messages for zone mismatches and vehicle payload violations.
* **Trip Dispatch Modal**: Pre-departure confirmation dialog summarizing total packages, total kilograms, and vehicle utilization.
* **Atomic State Locking**: Departure marks parcels `IN_TRANSIT`, marks van `DISPATCHED`, and locks the manifest against further unloading or modification.
* **Operational Dashboard**: Real-time KPI cards (Total, Unassigned, Loaded, In-Transit, Available Vans), fleet capacity gauges, and a timestamped audit activity stream.
* **Dual-Mode Network Architecture**: Integrated client-side `localStorage` simulator for standalone demonstration, plus a live toggle to connect directly to the team's Flask backend.

---

## 6. Technology Stack
* **Markup**: Semantic HTML5 (native document structure, dialogs, forms, badges).
* **Styling**: Vanilla CSS3 (custom properties / design tokens, CSS Grid, Flexbox, glassmorphism dark theme, no Tailwind or CSS frameworks).
* **Client Logic**: Modern Vanilla JavaScript (ES6+ Modules, standard `import` / `export`, no React, Vite, or Vue).
* **Fonts**: Google Fonts (`Inter` for UI typography; `JetBrains Mono` for tracking codes and vehicle plates).
* **Local Development Server**: Lightweight, zero-dependency Node.js HTTP static server (`server.js`, 64 lines) serving files at `http://localhost:3000`.

---

## 7. Frontend Architecture
The frontend is structured into modular layers with strict separation of concerns:

```
┌────────────────────────────────────────────────────────┐
│                      index.html                        │
│                 (Single Page Layout)                   │
└───────────────────────────┬────────────────────────────┘
                            │ boots
┌───────────────────────────▼────────────────────────────┐
│                        app.js                          │
│               (Router & View Controller)               │
└─────────────┬────────────────────────────┬─────────────┘
              │                            │
   ┌──────────▼──────────┐      ┌──────────▼──────────┐
   │     Components      │      │     Page Views      │
   │  - navbar.js        │      │  - dashboard.js     │
   │  - toast.js         │      │  - intake.js        │
   │  - dispatchModal.js │      │  - loadingBay.js    │
   └──────────┬──────────┘      └──────────┬──────────┘
              │                            │
              └──────────────┬─────────────┘
                             │ subscribes / dispatches
┌────────────────────────────▼───────────────────────────┐
│                       store.js                         │
│             (Central Reactive State Store)             │
└────────────────────────────┬───────────────────────────┘
                             │ calls
┌────────────────────────────▼───────────────────────────┐
│                        api.js                          │
│             (API Client & Mock Hub Engine)             │
└─────────────┬────────────────────────────┬─────────────┘
              │ (Live Mode)                │ (Mock Mode)
┌─────────────▼──────────┐      ┌──────────▼──────────┐
│ Flask Backend REST API │      │ Browser localStorage│
│  http://localhost:5000 │      │  Simulated Database │
└────────────────────────┘      └─────────────────────┘
```

---

## 8. Project Folder Structure
```text
Warehouse-Parcel-Dispatch-Hub-Transit-Tracker/
├── README.md               <-- Root project documentation
├── backend/                <-- Python / Flask backend (handled by teammate)
│   └── .gitkeep
├── database/               <-- Database schemas & migrations (handled by teammate)
│   └── .gitkeep
└── frontend/               <-- Frontend Application
    ├── index.html          <-- Main HTML entry point
    ├── package.json        <-- Local scripts (npm start / npm run dev)
    ├── server.js           <-- Zero-dependency Node.js static web server
    ├── css/
    │   ├── styles.css      <-- Design tokens, dark theme, cards, forms, modals
    │   └── loading-bay.css <-- Split-screen bay, capacity gauge, manifest styling
    └── js/
        ├── app.js          <-- App bootstrap & screen switcher
        ├── types/
        │   └── constants.js<-- Zones, statuses, error strings, initial demo seed data
        ├── services/
        │   └── api.js      <-- REST client + Authoritative mock engine
        ├── state/
        │   └── store.js    <-- Reactive pub/sub state manager
        ├── components/
        │   ├── navbar.js   <-- Top navigation, clock, mode toggle
        │   ├── toast.js    <-- Floating alert notifications
        │   └── dispatchModal.js <-- Confirmation modal dialog & atomic dispatch
        └── pages/
            ├── dashboard.js<-- KPI metric cards, fleet overview, audit stream
            ├── intake.js   <-- Manual parcel entry form & zone feedback
            └── loadingBay.js<-- Split bay, capacity calculations, manifest
```

---

## 9. What Each Important Frontend File Does

| File | Purpose in Simple Terms |
|---|---|
| `frontend/index.html` | The single web page loaded by the browser. Defines the skeleton (header, main screen area, modal overlay container, and toast stack) and loads `app.js`. |
| `frontend/server.js` | A tiny 64-line Node.js script that hosts the `frontend/` folder on `http://localhost:3000` with proper MIME types, allowing ES6 JavaScript modules to load cleanly without CORS blocks. |
| `frontend/package.json` | Provides standard commands (`npm start` and `npm run dev`) so team members can run the local server without remembering CLI arguments. |
| `frontend/css/styles.css` | Defines all colors, fonts, spacing, cards, tables, status pills, toast animations, and modal overlays for the dark logistics console theme. |
| `frontend/css/loading-bay.css` | Handles styling for the split-screen Loading Bay, including the search/filter bar, itemized manifest table, dynamic capacity gauge, and locked state. |
| `frontend/js/app.js` | The main conductor. Initializes the state store, renders the navigation bar and modal, listens for screen change requests, and switches views. |
| `frontend/js/types/constants.js` | Contains standard enumerations (`ZONES`, `PARCEL_STATUS`, `VAN_STATUS`), pre-set error messages, PIN-to-zone classification rules, and initial demo data. |
| `frontend/js/services/api.js` | The network service. Sends fetch calls to the Flask backend when in live mode. When in mock mode, it authoritatively enforces rules and saves data in `localStorage`. |
| `frontend/js/state/store.js` | The central state hub. Stores the list of parcels, vans, active filters, selected vehicle, and audit logs. Notifies UI components when state updates. |
| `frontend/js/components/navbar.js` | Renders the top hub header with the branding logo, navigation tabs with unassigned badge counts, real-time digital clock, and Live/Mock mode switch. |
| `frontend/js/components/toast.js` | Creates floating toast notification popups in the bottom-right corner for success, error, warning, and informational feedback. |
| `frontend/js/components/dispatchModal.js` | Displays the pre-dispatch confirmation dialog showing vehicle plate, zone, parcel count, total weight, and payload percentage before departure. |
| `frontend/js/pages/dashboard.js` | Renders the executive dashboard: 5 KPI metric cards, active fleet vehicle readiness cards, and the recent hub activity feed. |
| `frontend/js/pages/intake.js` | Renders the manual parcel entry form, validates user inputs, submits to the API, displays the backend-returned zone badge, and logs shift intake. |
| `frontend/js/pages/loadingBay.js` | Renders the split-screen loading bay: unassigned parcel search and manual code entry on the left; active van capacity and manifest staging on the right. |

---

## 10. How the Application Starts
1. The developer or judge starts the server:
   ```bash
   node frontend/server.js 3000
   ```
2. The user opens `http://localhost:3000` in any modern web browser.
3. The browser loads `index.html`, which fetches `styles.css` and `loading-bay.css`.
4. `index.html` loads `<script type="module" src="./js/app.js">`.
5. `app.js` runs on `DOMContentLoaded`:
   * Instantiates `NavbarComponent` and `DispatchModalComponent`.
   * Calls `store.init()`, which requests initial data from `api.js`.
   * `api.js` checks `localStorage`. If empty, it seeds initial vans, staged parcels, and shift logs.
   * `app.js` renders the initial view: the **Dashboard**.

---

## 11. Complete Application Flow

```text
[ USER / WAREHOUSE STAFF ]
           │
           ▼
     ┌───────────┐
     │ Dashboard │ ◄── View hub KPIs, fleet status, and activity stream
     └─────┬─────┘
           │ clicks "Inbound Intake"
           ▼
    ┌──────────────┐
    │Inbound Intake│ ◄── Enter Tracking Code, 6-digit PIN, Weight (kg)
    └──────┬───────┘
           │ clicks "Register Parcel"
           ▼
    ┌──────────────┐
    │Backend Check │ ◄── Validate fields, determine Zone from PIN
    └──────┬───────┘
           │ saves as UNASSIGNED
           ▼
    ┌──────────────┐
    │  UNASSIGNED  │ ◄── Parcel is staged in warehouse queue
    └──────┬───────┘
           │ proceeds to Loading Bay
           ▼
    ┌──────────────┐
    │ Loading Bay  │ ◄── Select active delivery vehicle (e.g. DL-01-AX-4821)
    └──────┬───────┘
           │ pick parcel or type code
           ▼
    ┌──────────────┐
    │  Zone Check  │ ──► Mismatch? ──► REJECT with error toast
    └──────┬───────┘
           │ Zone Matches
           ▼
    ┌──────────────┐
    │Capacity Check│ ──► Exceeds remaining kg? ──► REJECT with error toast
    └──────┬───────┘
           │ Fits in Van
           ▼
    ┌──────────────┐
    │    LOADED    │ ◄── Added to Van Manifest; Capacity gauge updates
    └──────┬───────┘
           │ clicks "Dispatch Van"
           ▼
    ┌──────────────┐
    │Confirmation  │ ◄── Review van plate, zone, parcel count, payload %
    │    Modal     │
    └──────┬───────┘
           │ clicks "Confirm & Dispatch"
           ▼
    ┌──────────────┐
    │  IN_TRANSIT  │ ◄── All loaded parcels atomically updated
    │  DISPATCHED  │ ◄── Van marked dispatched; Manifest locked permanently
    └──────┬───────┘
           │ return to Dashboard
           ▼
     ┌───────────┐
     │ Dashboard │ ◄── In-Transit count increments, Available Vans decrements
     └───────────┘
```

---

## 12. Dashboard Flow
* **Metrics Cards**:
  * **Total Registered**: Total parcels recorded in the system.
  * **Unassigned Parcels**: Parcels waiting in the warehouse for van assignment.
  * **Loaded in Vans**: Parcels currently placed into delivery van manifests.
  * **In-Transit Parcels**: Parcels that have departed the hub.
  * **Available Vans**: Number of vehicles ready at loading bays.
* **Fleet Readiness Grid**:
  * Displays every vehicle's license plate, name, zone, and status (`AVAILABLE`, `LOADING`, `DISPATCHED`).
  * Shows a visual payload capacity gauge.
  * Provides a quick "Load This Van" button that selects the vehicle and switches directly to the Loading Bay.
* **Hub Activity Stream**:
  * Real-time audit feed displaying timestamped actions for intake, loading, unloading, and dispatches.

---

## 13. Inbound Intake Flow
1. Staff click the **Inbound Intake** tab.
2. Staff manually enter:
   * **Tracking Code**: e.g., `PKG-99001` (case-insensitive, auto-capitalized).
   * **Destination PIN Code**: e.g., `110001` (strictly 6 numeric digits).
   * **Parcel Weight**: e.g., `15.5` (gross weight in kg, must be greater than 0).
3. **Frontend Validation**:
   * If any field is missing or invalid, submission is blocked and red inline error messages highlight the exact problem.
4. **Submission**:
   * Staff click **Register Parcel**.
   * The API receives the payload, determines the zone, and creates the record.
5. **Confirmation**:
   * A green success card appears: *"Parcel registered successfully"*.
   * Shows the authoritative backend-assigned zone: **"Zone: North Zone"**.
   * Displays a "Proceed to Loading Bay →" quick link.
   * The parcel is added to the "Session Intake Log" on the right.

---

## 14. Loading Bay Flow
1. Staff navigate to the **Van Loading Bay** tab.
2. **Select Vehicle**:
   * Dropdown on top allows choosing any van (e.g., `DL-01-AX-4821 • Van NZ-01 (North Zone) [AVAILABLE]`).
3. **Left Panel (Available Staged Parcels)**:
   * Displays all `UNASSIGNED` parcels.
   * Search input allows instant filtering by tracking code or PIN without losing focus.
   * Zone filter buttons (`All Zones`, `North`, `South`, `West`, `East`) isolate specific regions.
   * Manual entry input: Staff can type a tracking code directly and click **Load Parcel**.
   * Table rows: Each matching parcel has an **Add →** button.
4. **Right Panel (Van Manifest & Capacity)**:
   * Shows vehicle plate, assigned zone, and status pill.
   * Visual Capacity Box: Displays `Current Weight / Max Capacity`, payload %, and remaining kg.
   * Itemized Manifest Table: Lists every parcel currently loaded, its PIN, and weight.
   * Unload Option: Clicking **Unload** removes the parcel and restores it to `UNASSIGNED`.
   * **Dispatch Van Button**: Enabled only when at least one parcel is loaded.

---

## 15. Zone Validation
* **Rule**: A parcel can only be loaded onto a vehicle assigned to the exact same zone.
* **Evaluation**:
  $$\text{parcel.zone} === \text{van.zone}$$
* **Behavior on Mismatch**:
  * If staff attempt to load a South Zone parcel (e.g., `PKG-20411`) onto a North Zone van (`DL-01-AX-4821`), the request is rejected immediately.
  * An inline warning displays:
    > *"Zone mismatch — this parcel belongs to South Zone, but this van is assigned to North Zone."*
  * A red alert toast appears.
  * The parcel remains `UNASSIGNED` and the van payload is untouched.

---

## 16. Payload / Capacity Validation
* **Rule**: A parcel cannot be loaded if its weight exceeds the vehicle's remaining payload capacity.
* **Evaluation**:
  $$\text{Remaining Capacity} = \text{van.maxCapacityKg} - \text{van.currentWeightKg}$$
  $$\text{Valid if: } \text{parcel.weightKg} \le \text{Remaining Capacity}$$
* **Behavior on Overload**:
  * If a van has 4.0 kg remaining and staff attempt to load a 12.0 kg parcel, the request is rejected.
  * Rejection notice:
    > *"Vehicle payload exceeded — parcel weight is 12 kg, but only 4.0 kg remaining."*
  * The manifest is not modified.

---

## 17. Dispatch Flow
1. When the van has finished loading, staff click **Dispatch Van (X parcels • Y kg)**.
2. **Confirmation Modal**:
   * Opens with a dark backdrop overlay.
   * Shows: Vehicle plate, assigned zone, parcel count, total dispatch weight, and payload %.
   * Warning banner explains that the operation is atomic and irreversible.
3. **Execution**:
   * Staff click **Confirm & Dispatch** (or cancel by clicking Cancel, the backdrop, or pressing `Escape`).
   * `api.dispatchVan(vanId)` executes.
4. **Post-Dispatch State**:
   * All loaded parcels atomically transition to `IN_TRANSIT`.
   * The vehicle status becomes `DISPATCHED`.
   * The manifest is permanently locked:
     * Manual load input and Load button are disabled.
     * Table row load buttons are disabled.
     * Manifest unload buttons are replaced with `<span class="badge">In Transit</span>`.
     * Manifest header displays `<span class="locked-manifest-badge">Manifest Locked (Departed)</span>`.
     * The dispatch button is replaced by a green trip departure confirmation card with departure timestamp.

---

## 18. Mock / Simulated Hub Mode
* **What it is**: A complete, self-contained warehouse simulation engine that runs entirely in the browser using `localStorage`.
* **Why it exists**: Allows the frontend team to build, test, and demonstrate the complete logistics workflow even while backend teammates are still writing Flask code.
* **Persistence**: Data stays saved across page refreshes.
* **Demo Reset**: A "Reset Demo" button in the top navigation bar restores the original seed data (4 vans, 7 staged parcels) with one click.

---

## 19. Live Flask API Mode
* **What it is**: Switches network requests to target the teammate's live Flask server running at `http://localhost:5000`.
* **How to switch**: Click the mode toggle button in the top navigation bar (`SIMULATED HUB` $\leftrightarrow$ `LIVE API (5000)`).
* **Error Resilience**: If the Flask server is offline or fails, `api.js` catches the error and displays a non-breaking toast alert (*"Network/API connection failure. Unable to reach warehouse server."*), keeping the application stable.

---

## 20. API Endpoints Expected by the Frontend
The frontend is built to communicate with the following Flask API contract:

| Method | Endpoint | Request Payload | Response Body |
|---|---|---|---|
| `POST` | `/api/parcels/inbound` | `{"trackingCode": "PKG-99001", "pinCode": "110001", "weightKg": 15.5}` | `{"success": true, "parcel": {"trackingCode": "PKG-99001", "pinCode": "110001", "weightKg": 15.5, "zone": "North Zone", "status": "UNASSIGNED"}}` |
| `GET` | `/api/parcels/unassigned?zone=...` | *None* (optional `zone` query param) | `{"parcels": [...]}` |
| `GET` | `/api/vans` | *None* | `{"vans": [{"id": "van-nz-01", "plate": "DL-01-AX-4821", "name": "Van NZ-01", "zone": "North Zone", "maxCapacityKg": 100, "currentWeightKg": 0, "status": "AVAILABLE", "loadedParcels": []}, ...]}` |
| `GET` | `/api/vans/<van_id>` | *None* | `{"van": {...}}` |
| `POST` | `/api/vans/<van_id>/load-parcel` | `{"trackingCode": "PKG-99001"}` | `{"success": true, "van": {...}, "parcel": {...}}` |
| `DELETE` | `/api/vans/<van_id>/parcels/<trackingCode>` | *None* | `{"success": true, "message": "Parcel unloaded", "van": {...}}` |
| `POST` | `/api/vans/<van_id>/dispatch` | *None* | `{"success": true, "van": {...}, "dispatchedCount": 3, "dispatchedParcels": [...]}` |
| `GET` | `/api/dashboard/stats` | *None* | `{"totalParcels": 8, "unassignedParcels": 5, "loadedParcels": 0, "inTransitParcels": 3, "availableVans": 3, "fleetCapacityPct": 25}` |

---

## 21. State & Data Flow
* State is centralized in `store.js`.
* Individual UI screens do not hold isolated, conflicting copies of parcels or vans.
* When an action happens:
  $$\text{User Click} \longrightarrow \text{Page Handler} \longrightarrow \text{api.js} \longrightarrow \text{store.refreshAll()} \longrightarrow \text{All UI Screens Re-render}$$
* This ensures that registering a parcel on the Inbound Intake screen immediately updates the Unassigned counter on the Loading Bay tab and the KPI card on the Dashboard.

---

## 22. Validation Rules
1. **Tracking Code**: Must not be empty. Case-insensitive alphanumeric.
2. **Destination PIN Code**: Must be exactly 6 numeric digits (`/^\d{6}$/`).
3. **Parcel Weight**: Must be a positive number strictly greater than 0 kg.
4. **Zone Match**: Parcel zone must equal the van's assigned zone.
5. **Vehicle Payload**: Parcel weight must be less than or equal to `van.maxCapacityKg - van.currentWeightKg`.
6. **Dispatch Eligibility**: Manifest must contain at least 1 loaded parcel. Dispatched vans cannot accept further parcels.

---

## 23. Complete Demo Scenario
Follow this exact 10-step sequence for hackathon presentations:

1. **Open Application**: Navigate to `http://localhost:3000`. Show the clean Dashboard with 7 initial parcels, 4 available vans, and live activity feed.
2. **Inbound Intake Navigation**: Click the **Inbound Intake** tab.
3. **Show Form Validation**: Click **Register Parcel** with empty inputs. Point out the 3 inline validation errors.
4. **Register Parcel**:
   * Tracking Code: `PKG-99001`
   * Destination PIN: `110001`
   * Weight: `15.5`
   * Click **Register Parcel**. Show the green success card with **"Zone: North Zone"**.
5. **Open Loading Bay**: Click the **Van Loading Bay** tab. Show van `DL-01-AX-4821` (North Zone, 100 kg capacity).
6. **Demonstrate Zone Mismatch Rejection**:
   * In the manual input, type `PKG-20411` (South Zone parcel) and click **Load Parcel**.
   * Show the red rejection error: *"Zone mismatch — this parcel belongs to South Zone, but this van is assigned to North Zone."*
7. **Load Valid North Zone Parcels**:
   * Click **Add →** on `PKG-10824` (24.5 kg) $\rightarrow$ capacity updates to 25%.
   * Click **Add →** on `PKG-10825` (18.0 kg) $\rightarrow$ capacity updates to 43%.
   * In the manual box, enter `PKG-99001` (15.5 kg) and click **Load Parcel** $\rightarrow$ capacity updates to `58 kg / 100 kg (58%) • 42 kg remaining`.
8. **Demonstrate Unload**: Click **Unload** on one parcel to show that it returns to the unassigned staging list, then load it back.
9. **Dispatch Van**:
   * Click **Dispatch Van (3 parcels • 58 kg)**.
   * Show the confirmation modal summarizing the trip.
   * Click **Confirm & Dispatch**.
   * Point out the locked manifest, the disabled inputs, the `In Transit` badges, and the departure notice.
10. **Dashboard Verification**:
    * Click **Dashboard**.
    * Show that In-Transit Parcels increased to 3, Available Vans decremented to 3, and the Recent Activity stream recorded the dispatch event.

---

## 24. Current Limitations & Backend Dependencies
1. **Flask Backend**: The `backend/` directory is currently a placeholder (`.gitkeep`). The backend teammate will implement Flask routes matching the API contract.
2. **Database Persistence**: The `database/` directory is currently a placeholder (`.gitkeep`). Multi-user persistence and table definitions (`parcels`, `vans`, `audit_logs`) will be built by the database teammate.
3. **CORS Configuration**: When connecting the frontend (`http://localhost:3000`) to Flask (`http://localhost:5000`), the backend teammate must enable `flask-cors`.
4. **Definitive PIN Database**: In mock mode, zone classification uses standard postal PIN prefix ranges. The backend team will supply their authoritative PIN lookup table.

---

## 25. How to Explain the Project During the Hackathon
When speaking to judges or audience members:
> "Our project is an internal operations hub console for warehouse parcel dispatch. The core problem in warehouse hubs is that misrouted parcels or overloaded vans cause major shipping delays and safety issues.  
> 
> Our system prevents this at the door: staff register parcels manually—without needing expensive barcode scanners—and the system determines the delivery zone. In the Loading Bay, the system strictly blocks wrong-zone parcels from entering the van and validates payload capacity in real time. Once loaded, the dispatch action is atomic: the entire manifest transitions to IN_TRANSIT, the vehicle departs, and the manifest is permanently locked.
> 
> As the frontend engineer, I built a zero-framework, responsive Vanilla ES6 architecture with a centralized reactive store and an API service layer that supports both a standalone simulated hub engine and seamless integration with our teammate's Flask REST backend."

---

## 26. Understand the Project in 5 Minutes

Here is the entire system explained in plain English:

### The Building Blocks
* **HTML (`index.html`)**: The skeleton. Defines the physical layout elements on screen (header, cards, tables, modal containers).
* **CSS (`styles.css`, `loading-bay.css`)**: The visual styling. Makes the console look like a dark, modern logistics operations room with high-contrast text, color-coded badges, and capacity progress bars.
* **JavaScript (`app.js`)**: The controller. Listens for user interactions, updates the screen, and connects the pieces together.
* **`store.js`**: The single source of truth. Keeps track of which screen is active, which van is selected, and the latest list of parcels.
* **`api.js`**: The communications officer. Sends network requests to the backend, or handles them client-side if running offline.
* **Page Files (`dashboard.js`, `intake.js`, `loadingBay.js`)**: The views. Each file defines what one screen looks like and what happens when you click its buttons.
* **Component Files (`navbar.js`, `toast.js`, `dispatchModal.js`)**: The reusable tools. The top navigation bar, floating alert messages, and pop-up confirmation dialogs.
* **Mock / `localStorage`**: The temporary local database inside the browser that allows testing everything right now.
* **Flask Backend**: The teammate's Python server that will handle live requests.
* **Database (SQL / SQLite / PostgreSQL)**: The permanent storage where all parcels, vans, and audit logs will live.

### Who is Responsible for What?
* **Frontend (You)**: The user interface, user input validation, split-screen loading bay, visual capacity calculations, modal dialogs, and calling the API endpoints.
* **Backend (Teammate)**: The Flask REST API, business rule verification, and database transactions.
* **Database (Teammate)**: Defining tables, relationships, and storing data permanently.
* **Integration**: Connecting the frontend `LIVE API` mode to the running Flask server at `http://localhost:5000`.

---

## 27. How to Explain My Frontend Role

When a teammate or judge asks: **"What did you do in this project?"**, use this concise answer:

> **"I am responsible for the frontend of our logistics hub console.**
> 
> **Here is what I built:**
> 1. **Zero-Framework Architecture**: Built the entire UI using Vanilla HTML5, CSS3, and modern ES6 JavaScript modules with zero external framework overhead.
> 2. **Operational Dashboard**: Created real-time KPI metrics, active fleet readiness cards, and a live audit activity feed.
> 3. **Manual Inbound Intake Station**: Built input validation for tracking codes, 6-digit PINs, and parcel weights, displaying authoritative backend zone classification.
> 4. **Split-Screen Loading Bay**: Built the parcel queue on the left and the active van staging on the right, featuring real-time payload capacity tracking (`68 kg / 100 kg (68%)`) and manifest itemization.
> 5. **Validation Enforcement**: Programmed clear visual rejection feedback for zone mismatches and vehicle payload violations.
> 6. **Atomic Dispatch Flow**: Created the pre-departure confirmation modal and locked manifest state upon departure.
> 7. **API Service Layer**: Created a clean service layer that connects to our Flask REST endpoints, with an integrated mock simulation engine in `localStorage` so our team can test and demonstrate the full workflow immediately."

---

## How to Run the Frontend
1. Ensure Node.js is installed on your machine.
2. Open a terminal in the project directory:
   ```bash
   node frontend/server.js 3000
   ```
   *(Or navigate into `frontend/` and run `npm start`)*
3. Open your browser to:
   ```
   http://localhost:3000
   ```
