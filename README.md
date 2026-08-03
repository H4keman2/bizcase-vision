# BizCase Vision

# BizCase Builder — Initial Build Prompt

Build a business case / ROI calculator web app called **BizCase Builder**. It lets a product manager model an investment decision (cost savings, revenue impact, capital and NRE spend) and see NPV, IRR, payback, ROI, and margin metrics update live as they adjust assumptions. Cases can be saved as named versions and compared side by side.

## Brand and visual style

Dark, high-contrast, professional, not playful. This is a financial analysis tool, not a marketing site.

- Background: near-black (`#0A0A0A`)

- Card surfaces: dark charcoal (`#141414`), inset fields slightly lighter (`#1B1B1B`)

- Borders: `#2A2A2A`, hairline, no rounded corners on cards (sharp, geometric, industrial feel)

- Accent: neon green-yellow `#C7F92B` (Zebra Technologies' brand accent), used for primary actions, positive deltas, active toggle states, and section labels

- Negative/decline indicator: warm red-orange `#FF5A3C`

- Text: white primary, `#8A8A8A` muted/secondary

- Typography: bold, tight-tracked, uppercase headers; monospace font (e.g. JetBrains Mono or similar) for all numbers and data labels; a standard sans-serif for body text and buttons

- No decorative gradients, no drop shadows, no soft glassmorphism. Clean hairline borders, flat color fills, high legibility.

## Screens

**1. Case List (home)**

- Grid/list of saved cases pulled from storage, each card shows case name, last updated date, version count

- "+ New Case" button creates a blank case and opens the Editor

**2. Case Editor (main workspace)**

- Editable case name field at the top (click-to-edit text, no visible input chrome until focused)

- Header actions: History, Compare, Save Version

- Input sections, each in its own bordered card with a neon-green uppercase section label:

  - **Investment**: NRE ($), Upfront Capex ($), optional phased capex entries (month + amount)

  - **Benefits**: Cost Savings/Yr ($), Time Savings/Yr ($), and a Revenue Model toggle: **None / Aggregate / Unit-Level**

    - Aggregate mode shows: Revenue Lift/Yr ($), COGS/Yr ($)

    - Unit-Level mode shows: Price/Unit ($), Variable Cost/Unit ($), Fixed Costs/Yr ($), Units/Yr

  - **Overhead** (optional, only relevant when a revenue model is active): toggle to enable, then a Basis selector (COGS or Revenue) and a percentage field. Overhead nets out of both cash flow and margin calculations.

  - **Timeline**: toggle between **Flat / Manual / Ramp**

    - Flat: benefits apply at a constant monthly rate across the whole horizon (default)

    - Manual: one multiplier field per year of the horizon (e.g. a 3-year case shows 3 fields), each year's benefit is the base annual benefit times that year's multiplier

    - Ramp: Year 1 % field (what fraction of full run-rate hits in year one) plus a Growth Rate %/Yr field that compounds every year after

  - **Horizon & Discount Rate**: horizon in years, discount rate entered as an **annual** percentage (convert to monthly internally for NPV/IRR math)

- Live outputs panel (sticky on desktop), updates on every input change:

  - NPV, IRR, Payback Period (months), ROI %, Total Investment, Total Revenue

  - Cumulative cash flow line chart across the horizon

  - Margin Analysis card, **only rendered when a revenue model is active** (hidden entirely for pure cost-savings cases): Gross Margin % (aggregate mode) or Contribution Margin per unit / % and Breakeven Units/Yr (unit mode), plus Overhead $ if enabled

- "Import from Excel" entry point (see Excel Import feature below)

- "Generate Executive Summary" entry point (see Exec Summary feature below)

**3. Save Version (modal)**

- Prompts for a version label, defaulting to something like "v3 · [today's date]", fully editable

- Confirming writes a new version snapshot and closes the modal without leaving the Editor

**4. Version History**

- Lists all saved versions for the current case, each showing its label, save date, and NPV

- The current unsaved draft always appears at the top, tagged "Draft (unsaved)", selectable but visually distinct from real saved versions

- Selecting any two rows (draft or saved version) enables a "Compare" action

**5. Comparison View**

- Two case/version selector cards at the top (Case A / Case B), Case B's card gets a neon border to mark it as the comparison target

- A solid neon banner stating the overall verdict and headline delta (e.g. "Case B is the stronger bet · +$240K NPV")

- A metrics ledger: one row per metric (NPV, IRR, Payback, ROI, Breakeven), columns for Case A, Case B, and Delta, with a neon up-arrow for improvements and red-orange down-arrow for regressions (correctly flipped for Payback/Breakeven, where lower is better)

- An overlay line chart of both cases' cumulative cash flow, with a toggle to hide/show Case A

## Data model (use the app's key-value storage)

```

cases:index                    → array of all case ids, for the List screen

cases:{caseId}                 → case shell + live working draft (see shape below)

cases:{caseId}:versions:{n}    → explicit saved snapshots only, never auto-created

```

Every input change updates `cases:{caseId}`'s `draft` object directly (cheap, no version bloat). A version is only created when the user explicitly clicks "Save Version."

`cases:{caseId}` shape:

```json

{

  "id": "case_001",

  "name": "Automated Scan Line QA",

  "createdAt": "ISO timestamp",

  "updatedAt": "ISO timestamp",

  "latestVersion": 2,

  "draft": {

    "inputs": {

      "investment": {

        "nre": 85000,

        "upfront": 260000,

        "phased": [{ "month": 6, "amount": 40000 }]

      },

      "benefits": {

        "costSavingsAnnual": 180000,

        "timeSavingsAnnual": 30000,

        "revenueModel": {

          "type": "unit",

          "aggregate": { "revenueLiftAnnual": 90000, "cogsAnnual": 36000 },

          "unit": { "pricePerUnit": 45, "variableCostPerUnit": 18, "fixedCostsAnnual": 60000, "unitsPerYear": 2000 }

        },

        "overhead": { "enabled": true, "basis": "cogs", "percent": 15 },

        "timeline": {

          "type": "ramp",

          "manual": { "yearlyMultipliers": [0.5, 1.0, 1.0] },

          "ramp": { "year1Percent": 60, "growthRatePercent": 10 }

        }

      },

      "horizonYears": 3,

      "discountRateAnnual": 8

    },

    "outputs": {

      "npv": 652000,

      "irr": 31.4,

      "paybackMonths": 14,

      "roi": 94,

      "totalInvestment": 345000,

      "totalRevenue": 405000,

      "cashFlowSeries": [{ "month": 0, "cumulative": -345000 }],

      "margins": {

        "grossMarginPercent": null,

        "contributionMarginPerUnit": 27,

        "contributionMarginPercent": 60,

        "breakevenUnitsPerYear": 2222,

        "overheadAnnual": 5400

      }

    }

  }

}

```

`cases:{caseId}:versions:{n}` shape: identical `inputs`/`outputs` structure, plus `versionLabel` and `savedAt`, frozen at save time.

Only one of `revenueModel.aggregate` / `revenueModel.unit` is "active" based on `revenueModel.type`, but keep both blocks present in the data so switching the toggle doesn't lose previously entered numbers. Same pattern for `timeline.manual` / `timeline.ramp`.

## Calculation logic

Implement these as pure functions operating on the `inputs` shape above:

- **Cash flow series**: month 0 takes the full NRE + upfront capex hit (plus any phased capex in its scheduled month). Each month 1 through horizon gets `(costSavingsAnnual + netRevenueContribution + timeSavingsAnnual) / 12`, where `netRevenueContribution = revenueAnnual - cogsAnnual - overheadAnnual`, scaled by that year's timeline multiplier (flat = 1.0 always; manual = the entered per-year array, padding with the last entered value if the horizon runs longer than the array; ramp = `year1Percent/100` for year 1, compounding by `growthRatePercent` each subsequent year).

- **NPV**: standard discounted cash flow sum, using the monthly rate derived from the annual discount rate (`monthlyRate = (1 + annualRate)^(1/12) - 1`, or a simple `annualRate/12` approximation is fine).

- **IRR**: solve for the rate where NPV = 0. Use Newton-Raphson first, fall back to bisection over a wide range (e.g. -99% to 500%) if it doesn't converge, since phased capex can create unconventional cash flow shapes. Annualize the result for display: `(1 + monthlyIRR)^12 - 1`.

- **Payback period**: first month where cumulative cash flow crosses zero, with fractional-month interpolation for precision.

- **ROI**: total net cash flow over the horizon divided by total investment (NRE + upfront + phased), as a percentage.

- **Total revenue**: sum of each year's resolved `revenueAnnual` scaled by that year's timeline multiplier.

- **Margins**: only computed if a revenue model is active (return null/hide the whole card otherwise).

  - Aggregate mode: gross margin % = `(revenueAnnual - cogsAnnual - overheadAnnual) / revenueAnnual * 100`

  - Unit mode: contribution margin per unit = `pricePerUnit - variableCostPerUnit - (overheadAnnual / unitsPerYear)`, contribution margin % = that divided by price, breakeven units/year = `fixedCostsAnnual / contributionMarginPerUnit`

  - Overhead amount = `(overheadPercent / 100) * (basis === "cogs" ? cogsAnnual : revenueAnnual)`, zero if overhead isn't enabled

## Feature: Generate Executive Summary (add-on, not a centerpiece)

A button in the Editor's output panel. On click, sends the case's current `inputs`/`outputs` to Claude (via `/v1/messages`, model `claude-sonnet-4-6`, `max_tokens: 1000`) with a prompt that:

- States the case name, horizon, total investment (breaking out NRE), total revenue, NPV, IRR, payback, ROI

- Describes which revenue model and timeline mode is active in plain language

- Asks for a 3-4 sentence plain-English executive summary, leading with the bottom-line recommendation, no jargon, no bullet points, no em dashes

Show loading/error/result states. Result includes Copy and Regenerate actions.

## Feature: Import from Excel

An upload flow, reachable from the Editor or List screen:

1. User uploads an `.xlsx` file (use the `xlsx`/SheetJS library to parse it client-side)

2. Flatten all sheets into row-by-row text (don't try to guess cell coordinates programmatically)

3. Send that text to Claude (`/v1/messages`, `claude-sonnet-4-6`, `max_tokens: 1000`) with a prompt asking it to map values to the input schema (NRE, upfront, cost/time savings, aggregate revenue/COGS, unit price/variable cost/fixed costs/units, overhead %/basis, horizon, discount rate), returning JSON only with a `confidence` (high/medium/low) per field it filled in. Instruct it not to force values into unit fields vs aggregate fields just because one is blank, and not to infer overhead unless explicitly present in the sheet.

4. Show a review screen: every schema field with its extracted value in an editable input, a confidence badge, and "not found" styling for anything the AI couldn't identify

5. Nothing writes into the actual case draft until the user clicks "Confirm & Populate Case"

## Build order

1. Data layer: storage read/write functions matching the key structure above

2. Calculation functions (pure, testable, no UI dependency)

3. Case List screen

4. Case Editor screen wired to live calculations

5. Save Version modal + Version History screen

6. Comparison View

7. Executive Summary feature

8. Excel Import feature

Start with 1-4 first since everything else depends on them working correctly.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/baf6adba-dd3c-4567-9ece-4f792e436d4c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
