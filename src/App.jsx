import { useMemo, useState } from "react";
import { ThemeProvider, createTheme, CssBaseline, Box } from "@mui/material";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import "./App.css";

import ConverterCard from "./components/currency/ConverterCard";
import TimePage from "./components/time/TimePage";
import ShoppingListPage from "./components/shopping/ShoppingListPage";
import TopMenu from "./components/common/TopMenu";
import Footer from "./components/Footer";

// Work
import WorkLoginPage from "./work/pages/WorkLoginPage";
import WorkLayout from "./work/components/WorkLayout";
import TimeLogPage from "./work/pages/TimeLogPage";

function App() {
  const [darkMode, setDarkMode] = useState(false);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? "dark" : "light"
        }
      }),
    [darkMode]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <BrowserRouter>
        <Routes>

          {/* ── Existing tools (with TopMenu + Footer) ── */}
          <Route path="/" element={
            <Box minHeight="100vh" display="flex" flexDirection="column">
              <TopMenu
                darkMode={darkMode}
                onToggleDarkMode={() => setDarkMode(v => !v)}
              />
              <Box flexGrow={1}>
                <Navigate to="/currency" replace />
              </Box>
              <Footer />
            </Box>
          } />

          <Route path="/currency" element={
            <Box minHeight="100vh" display="flex" flexDirection="column">
              <TopMenu
                darkMode={darkMode}
                onToggleDarkMode={() => setDarkMode(v => !v)}
              />
              <Box flexGrow={1}><ConverterCard /></Box>
              <Footer />
            </Box>
          } />

          <Route path="/time" element={
            <Box minHeight="100vh" display="flex" flexDirection="column">
              <TopMenu
                darkMode={darkMode}
                onToggleDarkMode={() => setDarkMode(v => !v)}
              />
              <Box flexGrow={1}><TimePage /></Box>
              <Footer />
            </Box>
          } />

          <Route path="/shopping" element={
            <Box minHeight="100vh" display="flex" flexDirection="column">
              <TopMenu
                darkMode={darkMode}
                onToggleDarkMode={() => setDarkMode(v => !v)}
              />
              <Box flexGrow={1}><ShoppingListPage /></Box>
              <Footer />
            </Box>
          } />

          {/* ── Work (own layout, no site TopMenu/Footer) */}
          <Route path="/work/login" element={<WorkLoginPage />} />

          <Route path="/work" element={<WorkLayout />}>
            <Route index element={<TimeLogPage />} />
          </Route>

        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;