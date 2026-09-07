# React + Vite

## Install as an app

Build the project with `npm run build`, then host the `dist` folder over HTTPS. Open the deployed URL in Chrome, Edge, or Safari and choose **Install app** or **Add to Home Screen**. The service worker enables the app shell to continue opening offline after the first online visit.

The same web build works on phones, tablets, Windows, and macOS. Native Android/iOS packages can be added later with a mobile wrapper such as Capacitor.

## Dispatch configuration

Set these Vite environment variables at build time when deploying a controlled operations workspace:

- `VITE_AUTH_REQUIRED=true` enables the login gate; pair it with `VITE_ADMIN_USER` and `VITE_ADMIN_PASSWORD`.
- `VITE_EMERGENCY_POLICE`, `VITE_EMERGENCY_FIRE`, `VITE_EMERGENCY_MEDICAL`, and `VITE_EMERGENCY_DISASTER` set call-button placeholders.

The emergency numbers can also be edited locally from the Alerts panel. Credentials are build-time configuration; enforce authorization again on a backend for production.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
