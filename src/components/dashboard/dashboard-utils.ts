import type { DashboardView } from "@/components/dashboard/dashboard-types";

export const formatFileSize = (size: number) => {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatUpdatedAt = (timestamp: number) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);

export const getViewTitle = (view: DashboardView) => {
  if (view === "documents") {
    return "Documents";
  }

  if (view === "research") {
    return "Research";
  }

  return "Home";
};

export const getViewPath = (view: DashboardView) => {
  if (view === "documents") {
    return "/documents";
  }

  if (view === "research") {
    return "/reasearch";
  }

  return "/";
};

export const getViewFromPathname = (pathname: string): DashboardView => {
  if (pathname === "/documents" || pathname.startsWith("/documents/")) {
    return "documents";
  }

  if (pathname === "/reasearch" || pathname.startsWith("/reasearch/")) {
    return "research";
  }

  return "home";
};
