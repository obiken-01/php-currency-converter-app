import { Stack, Typography, Box } from "@mui/material";

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
        >
          <Typography fontWeight={500}>{code}</Typography>
          <Typography>
            {rates[code]
              ? (amount * rates[code]).toFixed(2)
              : "---"}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
