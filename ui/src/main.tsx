import React from "react";
import ReactDOM from "react-dom/client";
import "./tokens.css";
import "./components/primitives/primitives.css";
import App from "./App";
// NOTE: the legacy dashboard stylesheet (styles.css) is intentionally NOT
// imported — it redefined :root design tokens (e.g. --primary) and would
// override the PLAN 2 token system. The new ALICE UI styles entirely from
// tokens.css + component stylesheets.

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
