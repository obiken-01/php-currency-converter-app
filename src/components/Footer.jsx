import { Box, Typography, Link } from "@mui/material";

export default function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        mt: 6,
        py: 2,
        textAlign: "center",
        borderTop: "1px solid",
        borderColor: "divider"
      }}
    >
      <Typography variant="body2" color="text.secondary">
        Rates provided by{" "}
        <Link
          href="https://api.frankfurter.dev"
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
        >
          api.frankfurter.dev
        </Link>
        {" • "}
        v{__APP_VERSION__}
      </Typography>
    </Box>
  );
}
