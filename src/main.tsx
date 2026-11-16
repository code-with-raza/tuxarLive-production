import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

const router = getRouter();

// Build-time homepage tags/content belong to the initial response. Once the
// client starts, React and HeadContent own the live page and its route changes.
document.querySelectorAll('[data-tuxar-static-head]').forEach(tag => tag.remove());
document.getElementById("root")?.removeAttribute("data-prerendered-home");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
