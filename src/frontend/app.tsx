import { BrowserRouter, Route, Routes } from "react-router";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DocumentsPage } from "./pages/documents";
import { Home } from "./pages/home";
import { ResearchPage } from "./pages/research";
import { SourcesPage } from "./pages/sources";
import { Landing } from "./pages/landing";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/">
          <Route index element={<Landing />} />
          <Route path='dashboard' element={<DashboardShell />}>
            <Route path="home" element={<Home />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="sources" element={<SourcesPage />} />
            <Route path="research" element={<ResearchPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter >
  );
}
