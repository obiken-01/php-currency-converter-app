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
    return <Typography>Loading rates...</Typography>;
  }

  return (
    <Stack spacing={1}>
      {toCurrencies.map((code) => (
        <Box
          key={code}
          display="flex"
          justifyContent="space-between"
          py={1}
          borderBottom="1px solid"
          borderColor="divider"
        >
          <Typography fontWeight={500}>{code}</Typography>
          <Typography fontWeight={600}>
            {rates[code]
              ? formatter.format(amount * rates[code])
              : "---"}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
