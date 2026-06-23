import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { LanguageProvider } from "./i18n/LanguageContext";
import { BackgroundThemeProvider } from "./themes/BackgroundThemeContext";
import "./index.css";

/** React entry point — mounts the dashboard into index.html #root */
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BackgroundThemeProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </BackgroundThemeProvider>
  </React.StrictMode>,
);
