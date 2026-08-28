import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "@/app/App";
import "@/shared/i18n";
import "@/styles/global.css";

const raiz = document.getElementById("root");
if (!raiz) throw new Error("Falta #root en index.html");

createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
