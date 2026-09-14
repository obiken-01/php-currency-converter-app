import { createTheme } from "@mui/material/styles";

/**
 * Terminal/TUI palette. `bg` matches the color already shipped in
 * manifest.webmanifest and index.html's theme-color meta — the app's icons
 * and PWA splash screen are already this near-black, so the redesign builds
 * on that instead of introducing a second one.
 */
export const tui = {
  bg: "#0B0F14",
  panel: "#121922",
  border: "#232D38",
  borderStrong: "#2F3B47",
  text: "#DCE4EA",
  dim: "#7C8A99",
  accent: "#39D97A",
  accentDim: "#1F6B41",
  amber: "#E8B23D",
  red: "#F2685F",
  cyan: "#5BC9D9",
};

export const FONT_STACK =
  '"JetBrains Mono", ui-monospace, "Fira Code", Consolas, monospace';

const glyphStyle = {
  fontFamily: FONT_STACK,
  fontSize: "0.95em",
  fontWeight: 700,
  userSelect: "none",
  lineHeight: 1,
};

// Checkbox glyphs read as "[ ]" / "[x]" rather than a filled square — the one
// place a literal bracket notation earns its keep as a real control instead
// of decoration, since a checkbox already has exactly two textual states.
const CheckboxOff = <span style={{ ...glyphStyle, color: tui.dim }}>[ ]</span>;
const CheckboxOn = (
  <span style={{ ...glyphStyle, color: tui.accent }}>[x]</span>
);

const tuiTheme = createTheme({
  palette: {
    mode: "dark",
    background: { default: tui.bg, paper: tui.panel },
    text: { primary: tui.text, secondary: tui.dim },
    divider: tui.border,
    primary: { main: tui.accent, contrastText: tui.bg },
    error: { main: tui.red },
    warning: { main: tui.amber },
    info: { main: tui.cyan },
    success: { main: tui.accent },
  },
  shape: { borderRadius: 2 },
  typography: {
    fontFamily: FONT_STACK,
    button: { textTransform: "none", fontWeight: 600, letterSpacing: "0.02em" },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: tui.bg },
        "::selection": { backgroundColor: tui.accentDim, color: tui.text },
        // A thin dark scrollbar reads a lot more like a terminal than the
        // OS-default light one does on a near-black page.
        "*::-webkit-scrollbar": { width: 10, height: 10 },
        "*::-webkit-scrollbar-track": { background: tui.bg },
        "*::-webkit-scrollbar-thumb": {
          background: tui.borderStrong,
          border: `2px solid ${tui.bg}`,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { border: `1px solid ${tui.borderStrong}` },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 2 },
        // Bracket notation is reserved for buttons that commit an action
        // (outlined/contained) — plain "text" buttons (nav links, quiet
        // inline actions like "+ add item") stay unbracketed, matching the
        // wireframes.
        outlined: {
          borderColor: tui.borderStrong,
          "&::before": { content: '"["', marginRight: 6, color: tui.dim },
          "&::after": { content: '"]"', marginLeft: 6, color: tui.dim },
          "&:hover": {
            borderColor: tui.accentDim,
            backgroundColor: "rgba(57,217,122,0.08)",
          },
        },
        contained: {
          boxShadow: "none",
          "&::before": { content: '"["', marginRight: 6, opacity: 0.55 },
          "&::after": { content: '"]"', marginLeft: 6, opacity: 0.55 },
          "&:hover": { boxShadow: "none" },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: tui.borderStrong },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: tui.accentDim },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: tui.accent,
            borderWidth: 1,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          textTransform: "uppercase",
          fontSize: "0.72rem",
          letterSpacing: "0.06em",
          "&.Mui-focused": { color: tui.accent },
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: { color: tui.accent },
        thumb: { borderRadius: 1, width: 14, height: 14 },
        rail: { backgroundColor: tui.borderStrong, opacity: 1 },
        track: { border: "none" },
      },
    },
    MuiCheckbox: {
      defaultProps: { icon: CheckboxOff, checkedIcon: CheckboxOn },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: tui.border } },
    },
    MuiAppBar: {
      styleOverrides: { root: { backgroundImage: "none" } },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: { backgroundColor: tui.panel, borderTop: `1px solid ${tui.borderStrong}` },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: { color: tui.dim, "&.Mui-selected": { color: tui.accent } },
      },
    },
    // Every dialog in the Work suite (task/project/token forms, task detail,
    // token reveal) picks this up for free — none of them override it.
    MuiDialog: {
      styleOverrides: {
        paper: { border: `1px solid ${tui.borderStrong}`, backgroundImage: "none" },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: "0.8125rem",
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: tui.accent,
          borderBottom: `1px solid ${tui.border}`,
        },
      },
    },
    // Sharp, bracket-adjacent selected state — used by the list/board switch,
    // the "my tasks / all" filter, and the Gantt day/week/month scale toggle.
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          borderColor: tui.borderStrong,
          textTransform: "none",
          "&.Mui-selected": {
            backgroundColor: tui.accent,
            color: tui.bg,
            "&:hover": { backgroundColor: tui.accent },
          },
        },
      },
    },
  },
});

export default tuiTheme;
