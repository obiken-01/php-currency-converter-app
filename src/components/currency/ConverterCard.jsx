import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Divider,
  Stack,
  Box
} from "@mui/material";

import CurrencySelect from "./CurrencySelect";
import ResultList from "./ResultList";

// Kept at the top of the comparison list, in this order, for quick reference.
const PRIORITY_CURRENCIES = ["PHP", "USD", "JPY", "SGD", "HKD", "EUR"];

export default function ConverterCard() {
  const [currencies, setCurrencies] = useState({});
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [amount, setAmount] = useState(1000);
  const [rates, setRates] = useState({});
  const [loading, setLoading] = useState(false);

  // Fetch supported currencies
  useEffect(() => {
    async function fetchCurrencies() {
      const resp = await fetch("https://api.frankfurter.dev/v1/currencies");
      const data = await resp.json();
      setCurrencies(data);
    }
    fetchCurrencies();
  }, []);

  // Ensure USD default
  useEffect(() => {
    if (currencies["USD"]) {
      setFromCurrency("USD");
    }
  }, [currencies]);

  // Every other supported currency, priority codes first (in PRIORITY_CURRENCIES
  // order, minus whichever is currently selected as "From"), then the rest
  // alphabetically.
  const toCurrencies = useMemo(() => {
    const codes = Object.keys(currencies).filter(
      (code) => code !== fromCurrency
    );
    const priority = PRIORITY_CURRENCIES.filter((code) => codes.includes(code));
    const rest = codes
      .filter((code) => !priority.includes(code))
      .sort();
    return [...priority, ...rest];
  }, [currencies, fromCurrency]);

  // Fetch rates for every currency at once
  useEffect(() => {
    async function fetchRates() {
      setLoading(true);
      try {
        const resp = await fetch(
          `https://api.frankfurter.dev/v1/latest?base=${fromCurrency}`
        );
        const data = await resp.json();
        setRates(data.rates || {});
      } finally {
        setLoading(false);
      }
    }

    fetchRates();
  }, [fromCurrency]);

  return (
    <Card
      elevation={0}
      sx={{
        maxWidth: 720,
        width: "100%",
        mx: "auto",
        my: { xs: 2, sm: 4 },
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        flex: { sm: 1 }
      }}>
      <Stack
        direction="row"
        alignItems="center"
        sx={{
          px: { xs: 2, sm: 3 },
          py: 1.25,
          borderBottom: "1px solid",
          borderColor: "divider"
        }}
      >
        <Typography
          variant="overline"
          color="primary.main"
          fontWeight={700}
          sx={{ letterSpacing: "0.08em" }}
        >
          Currency Converter
        </Typography>
      </Stack>
      <CardContent
        sx={{
          px: { xs: 2, sm: 3 },
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          flex: { sm: 1 }
        }}
      >
        <Stack spacing={2.5} sx={{ minHeight: 0, flex: { sm: 1 } }}>
          <CurrencySelect
            label="From Currency"
            value={fromCurrency}
            options={currencies}
            onChange={setFromCurrency}
          />

          <TextField
            label="Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            inputProps={{ min: 0, step: 0.01 }}
            fullWidth
          />

          <Divider />

          <Box
            sx={{
              maxHeight: { xs: "50vh", sm: "none" },
              minHeight: { sm: 0 },
              flex: { sm: 1 },
              overflowY: "auto"
            }}
          >
            <ResultList
              amount={amount}
              toCurrencies={toCurrencies}
              rates={rates}
              loading={loading}
            />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
