import { useMemo, useState } from "react";
import { ThemeProvider, createTheme, CssBaseline, Box } from "@mui/material";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import "./App.css";

import ConverterCard from "./components/currency/ConverterCard";
import TimePage from "./components/time/TimePage";
import TopMenu from "./components/common/TopMenu";
import Footer from "./components/Footer";

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
        <Box minHeight="100vh" display="flex" flexDirection="column">
          <TopMenu
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode(v => !v)}
          />

          <Box flexGrow={1}>
            <Routes>
              <Route path="/" element={<Navigate to="/currency" replace />} />
              <Route path="/currency" element={<ConverterCard />} />
              <Route path="/time" element={<TimePage />} />
            </Routes>
          </Box>

          <Footer />
        </Box>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
