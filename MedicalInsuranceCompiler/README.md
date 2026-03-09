# ALICE (Automated Lifecycle for Insurance & Clinical Evidence)

This repo is a hackathon MVP showing interoperable agents for:

**Medication Reconciliation → Evidence Assembly → Prior Authorization Packet (FHIR Bundle) → Payer Decision**.

## Run locally
```bash
npm install
npm run build
npm start
```

Then open: http://localhost:8787

## Demo
- Choose **Scenario: Complete** (approve) or **Missing Evidence** (deny A1c).
- Click **Run Full Demo** or step through manually.
- Download the generated **FHIR Bundle** after "Compose Packet".

## Render Deploy Notes
- Set `NODE_VERSION=20` for both the Web Service and Static Site.
- Web Service build command: `npm install && npm run build`
- Web Service start command: `npm start`
- Static Site build command: `npm install && npm -w ui run build`
- Static Site publish directory: `ui/dist`
