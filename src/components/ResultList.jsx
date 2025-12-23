export default function ResultList(
    { 
        amount, 
        toCurrencies, 
        rates, 
        loading
    }){
    if (loading) return <p>Loading rates...</p>;

    return(
        <>
        <div className="results">
            {toCurrencies.map((code) => (
                <div key={code} className="rate">
                <span>{code}</span>&nbsp; = &nbsp;
                <span>
                    {rates[code]
                    ? (amount * rates[code]).toFixed(2)
                    : "---"}
                </span>
                </div>
            ))}
        </div>
        </>
    );
}