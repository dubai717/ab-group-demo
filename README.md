# AB Group Demo Prototype

This repository contains a working interactive prototype of the AB Group administrative system.

## What is included

- Login screen
- Owner account for the main admin
- Role-based dashboard access
- User management panel
- Department and company views
- Role and permission seed data
- Interactive prototype built with static front-end logic and browser storage
- Arabic / English language switching
- Corporate branding with logo integration
- Updated visual identity using the official AB Group color system

## Demo accounts

Use any of the following demo usernames with their matching passwords:

- Owner: `owner` / `Owner@12345`
- General Manager: `gm` / `Gm@12345`
- Regional Manager: `region_manager` / `Region@12345`
- Employee: `employee1` / `Emp@12345`
- Investor: `investor1` / `Inv@12345`

## Run locally

1. Clone or download this repository.
2. Open a terminal in the project folder.
3. Run:

```bash
npm start
```

4. Open in the browser:

```text
http://localhost:3000
```

## GitHub Pages deployment

This demo is designed to run as a static website. The recommended deployment method is GitHub Pages:

1. Open the repository on GitHub.
2. Go to Settings → Pages.
3. Select `Deploy from a branch`.
4. Choose `main` and `/root`.
5. Save the settings.

Then the app will be available at a URL in the format:

```text
https://<your-username>.github.io/ab-group-demo/
```

## Notes

This is a working front-end prototype for testing the structure, roles, access logic, screens, and user flows. It is designed for iterative refinement as part of the product design and development process.

The prototype stores data in the browser's local storage so it can be used immediately without a database backend.

## Latest update

This version includes:
- official AB Group logo integration in the login page and dashboard shell
- Arabic / English toggle
- RTL / LTR switching support
- updated corporate visual identity with the official red, brown, copper and gold palette
- consistent color system applied across login, sidebar, dashboard, buttons, tables, and controls
- preservation of the original prototype features and test accounts

## Next steps

After this prototype is reviewed, the next iteration can add:
- real database integration
- backend APIs
- secure authentication
- company and investor modules
- task lifecycle and notifications
- reports and dashboard reporting
- deployment setup

## Companies and legal entities

The current prototype also includes company registration, legal entity records, status controls, search and emirate/status filters, and local document uploads.

CSS lives in `styles.css`; browser JavaScript lives in `app.js`. Existing v2 browser data is retained when loading the v3 application.
