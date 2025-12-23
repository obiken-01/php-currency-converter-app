export default function CurrencySelect(
    {
        label,
        value,
        options,
        onChange
    }){

    return(
        <>
            <div className="dropdown-field">
                <label>{label}&nbsp;
                    <select value={value} onChange={(e) => onChange(e.target.value)}>
                        <option value="" disabled>Select currency</option>

                        {Object.entries(options).map(([code, name]) => (
                            <option key={code} value={code}>
                                {code} - {name}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
        </>
    );    
}