import { createFileRoute } from "@tanstack/react-router";
import { redirectWithLocale } from "@/i18n/i18n";

export const Route = createFileRoute("/reset-password")({
  beforeLoad: redirectWithLocale("/reset-password"),
});
