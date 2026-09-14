import { ThemeProvider, CssBaseline, Box } from "@mui/material";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import "./App.css";
import tuiTheme from "./theme/tuiTheme";

import ConverterCard from "./components/currency/ConverterCard";
import TimePage from "./components/time/TimePage";
import ShoppingListPage from "./components/shopping/ShoppingListPage";
import TopMenu from "./components/common/TopMenu";
import Footer from "./components/Footer";

import ToastProvider from "./work/context/ToastProvider";
import OfflineBar from "./components/common/OfflineBar";
import InstallBanner from "./components/common/InstallBanner";
import PWAUpdatePrompt from "./components/common/PWAUpdatePrompt";

// Work
import WorkLoginPage from "./work/pages/WorkLoginPage";
import WorkLayout from "./work/components/WorkLayout";
import TimeLogPage from "./work/pages/TimeLogPage";
import TasksPage from "./work/pages/TasksPage";
import ProjectsPage from "./work/pages/ProjectsPage";
import ProjectDetailPage from "./work/pages/ProjectDetailPage";
import TokensPage from "./work/pages/TokensPage";
import WorkDashboardPage from "./work/pages/WorkDashboardPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// The four site tools share this chrome; /work brings its own. A real
// component (not a plain helper function) so it can call useLocation() —
// the transition wrapper is keyed by pathname so it actually remounts on
// every nav-tab click, rather than just having its child swap in place
// (which a static wrapper element would do silently, without the CSS
// "on mount" animation ever re-firing).
function SiteChrome({ children }) {
  const location = useLocation();
  return (
    <Box minHeight="100vh" display="flex" flexDirection="column">
      <TopMenu />
      <Box key={location.pathname} flexGrow={1} className="page-transition">
        {children}
      </Box>
      <Footer />
    </Box>
  );
}

function App() {
  return (
    <ThemeProvider theme={tuiTheme}>
      <CssBaseline />

      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            {/* Above the routes so they show on the site tools and inside /work
                alike, both of which bring their own chrome. */}
            <OfflineBar />
            <InstallBanner />

            <Routes>

              {/* ── Existing tools (with TopMenu + Footer) ── */}
              <Route path="/"         element={<SiteChrome><Navigate to="/currency" replace /></SiteChrome>} />
              <Route path="/currency" element={<SiteChrome><ConverterCard /></SiteChrome>} />
              <Route path="/time"     element={<SiteChrome><TimePage /></SiteChrome>} />
              <Route path="/shopping" element={<SiteChrome><ShoppingListPage /></SiteChrome>} />

              {/* ── Work (own layout, no site TopMenu/Footer) ── */}
              <Route path="/work/login" element={<WorkLoginPage />} />

              <Route path="/work" element={<WorkLayout />}>
                <Route index           element={<WorkDashboardPage />} />
                <Route path="logs"     element={<TimeLogPage />} />
                <Route path="tasks"    element={<TasksPage />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="projects/:publicId" element={<ProjectDetailPage />} />
                <Route path="timeline" element={<ProjectsPage timelineMode />} />
                <Route path="tokens"   element={<TokensPage />} />
              </Route>

            </Routes>

            <PWAUpdatePrompt />
          </BrowserRouter>
        </ToastProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
