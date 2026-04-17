import { BrowserRouter, Route, Routes } from "react-router";

import { DocumentsPage } from "./pages/documents";
import { ResearchPage } from "./pages/research";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Home } from "./pages/home";

export default function App() {
  return (
    <BrowserRouter>
      <DashboardShell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/research" element={<ResearchPage />} />
        </Routes>
      </DashboardShell>
    </BrowserRouter>
  );
}
