import { Stack, Typography, Box } from "@mui/material";

const formatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export default function ResultList({
  amount,
  toCurrencies,
  rates,
  loading
}) {
  if (loading) {
    return (
      <Typography variant="body2" color="text.secondary">
        loading rates…
      </Typography>
    );
  }

  if (toCurrencies.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        + choose a currency above to see results
      </Typography>
    );
  }

  return (
    <Stack spacing={0}>
      {toCurrencies.map((code) => (
        <Box
          key={code}
          display="flex"
          alignItems="baseline"
          justifyContent="space-between"
          gap={1.5}
          py={1.1}
          borderBottom="1px dashed"
          borderColor="divider"
          sx={{ "&:last-of-type": { borderBottom: "none" } }}
        >
          <Typography variant="body2" color="info.main" fontWeight={700} sx={{ flexShrink: 0 }}>
            {code}
          </Typography>
          <Typography
            variant="body2"
            fontWeight={700}
            noWrap
            sx={{ textAlign: "right" }}
          >
            {rates[code]
              ? formatter.format(amount * rates[code])
              : "---"}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
