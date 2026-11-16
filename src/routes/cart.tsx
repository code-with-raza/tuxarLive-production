import { createFileRoute } from "@tanstack/react-router";
import { redirectWithLocale } from "@/i18n/i18n";

export const Route = createFileRoute("/cart")({
  beforeLoad: redirectWithLocale("/cart"),
});
