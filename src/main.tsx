import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

function applyDarkMode(e: MediaQueryListEvent | MediaQueryList) {
  document.documentElement.classList.toggle("dark", e.matches);
}

applyDarkMode(darkModeMediaQuery);
darkModeMediaQuery.addEventListener("change", applyDarkMode);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
