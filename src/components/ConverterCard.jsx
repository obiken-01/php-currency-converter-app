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
  const [fromCurrency, setFromCurrency] = useState("PHP");
  const [amount, setAmount] = useState(1000);
  const [toCurrencies, setToCurrencies] = useState(["USD"]);
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

  // Ensure PHP default
  useEffect(() => {
    if (currencies["PHP"]) {
      setFromCurrency("PHP");
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
    <Card sx={{ maxWidth: 420, mx: "auto", mt: 6 }}>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">
            Currency Converter
          </Typography>

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
