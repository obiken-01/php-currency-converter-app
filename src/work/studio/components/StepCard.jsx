import { Box, Card, CardContent, Stack, Typography } from "@mui/material";

/**
 * One numbered step of the page. A step that is not ready yet is dimmed;
 * its footer (always usable) is not.
 */
export default function StepCard({ number, title, disabled = false, action = null, footer = null, children }) {
  return (
    <Card elevation={0} variant="outlined" aria-disabled={disabled || undefined}>
      <CardContent sx={{ p: { xs: 2, sm: 3 }, "&:last-child": { pb: { xs: 2, sm: 3 } } }}>
        <Box sx={{ opacity: disabled ? 0.55 : 1 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ sm: "center" }}
            justifyContent="space-between"
            spacing={1}
            sx={{ mb: 2 }}
          >
            <Typography variant="overline" color="primary.main" fontWeight={700} sx={{ letterSpacing: "0.08em", lineHeight: 1.6 }}>
              {number} {title}
            </Typography>
            {action}
          </Stack>
          {children}
        </Box>
        {footer}
      </CardContent>
    </Card>
  );
}
