import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Divider,
  Stack
} from "@mui/material";

import CurrencySelect from "./CurrencySelect";
import ResultList from "./ResultList";

export default function ConverterCard() {
  const [currencies, setCurrencies] = useState({});
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [amount, setAmount] = useState(1000);
  const [toCurrencies, setToCurrencies] = useState(["PHP"]);
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

  // Ensure base is not in targets
  useEffect(() => {
    setToCurrencies((prev) =>
      prev.filter((code) => code !== fromCurrency)
    );
  }, [fromCurrency]);

  function addCurrency(currency) {
    if (!currency) return;
    if (!toCurrencies.includes(currency)) {
      setToCurrencies([...toCurrencies, currency]);
    }
  }

  // Fetch rates
  useEffect(() => {
    async function fetchRates() {
      // Exclude base currency from target symbols to avoid API error
      const targetSymbols = toCurrencies.filter(
        (code) => code !== fromCurrency
      );

      if (targetSymbols.length === 0) {
        setRates({});
        return;
      }

      setLoading(true);
      try {
        const symbols = targetSymbols.join(",");
        const resp = await fetch(
          `https://api.frankfurter.dev/v1/latest?base=${fromCurrency}&symbols=${symbols}`
        );
        const data = await resp.json();
        setRates(data.rates || {});
      } finally {
        setLoading(false);
      }
    }

    fetchRates();
  }, [fromCurrency, toCurrencies]);

  return (
    <Card
      elevation={0}
      sx={{
        maxWidth: 720,
        mx: "auto",
        mt: { xs: 2, sm: 4 }
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
      <CardContent sx={{ px: { xs: 2, sm: 3 } }}>
        <Stack spacing={2.5}>
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

          <CurrencySelect
            label="To Currency"
            value=""
            options={Object.fromEntries(
              Object.entries(currencies).filter(
                ([code]) =>
                  code !== fromCurrency &&
                  !toCurrencies.includes(code)
              )
            )}
            onChange={addCurrency}
          />

          <Divider />

          <ResultList
            amount={amount}
            toCurrencies={toCurrencies}
            rates={rates}
            loading={loading}
          />
        </Stack>
      </CardContent>
    </Card>
  );
}
