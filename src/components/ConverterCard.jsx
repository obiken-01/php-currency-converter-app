import { useEffect, useState } from "react";
import CurrencySelect from "./CurrencySelect";
import ResultList from "./ResultList";

export default function ConverterCard() {
    const [currencies, setCurrencies] = useState({});
    const [fromCurrency, setFromCurrency] = useState("PHP");;
    const [amount, setAmount] = useState(1000);
    const [toCurrencies, setToCurrencies] = useState(["USD"]);
    const [rates, setRates] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        async function fetchCurrencies() {
            try{
                const resp = await fetch("https://api.frankfurter.dev/v1/currencies");
                const data = await resp.json();
                setCurrencies(data);
            }catch(error){
                console.error("Error fetching currencies:", error);
            }
        }
        fetchCurrencies();
    }, []);

    useEffect(() => {
        if(currencies["PHP"]){
            setFromCurrency("PHP");
        }
    }, [currencies]);

    // Ensure the base (fromCurrency) is never present in the target list
    useEffect(() => {
        setToCurrencies((prev) => prev.filter((code) => code !== fromCurrency));
    }, [fromCurrency]);

    function addCurrency(currency) {
        if (!currency) return;

        if (!toCurrencies.includes(currency)) {
            setToCurrencies([...toCurrencies, currency]);
        }
    }

    useEffect(() => {
        async function fetchRates() {
            // Exclude base currency from symbols to avoid API errors
            const symbols = toCurrencies.filter((code) => code !== fromCurrency);
            if (symbols.length === 0) {
                setRates({});
                return;
            }

            setLoading(true);
            try {
                const to = symbols.join(",");
                const resp = await fetch(
                    `https://api.frankfurter.dev/v1/latest?base=${fromCurrency}&symbols=${to}`
                );
                const data = await resp.json();
                setRates(data.rates);
            } catch (error) {
                console.error("Error fetching rates:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchRates();
    }, [fromCurrency, toCurrencies]);

    
    return (
        <div className="card">
            <h1>Currency Converter</h1>

            <CurrencySelect
                label="From Currency:"
                value={fromCurrency}
                options={currencies}
                onChange={setFromCurrency}
            />
            <div className="amount-field">
                <label>
                    Amount:
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        min={0}
                        step={0.01}
                        style={{ marginLeft: "8px" }}
                    />
                </label>
            </div>
            <br />
            <CurrencySelect
                label="To Currency:"
                value=""
                options={Object.fromEntries(
                    Object.entries(currencies).filter(
                    ([code]) =>
                        code !== fromCurrency && !toCurrencies.includes(code)
                    )
                )}
                onChange={addCurrency}
            />
            <hr />
            <ResultList
                amount={amount}
                toCurrencies={toCurrencies}
                rates={rates}
                loading={loading}
            />
        </div>
    );
}