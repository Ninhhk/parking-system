"use client";

/**
 * Reusable FormField component to use with Modal forms
 *
 * @param {Object} props
 * @param {string} props.name - Field name
 * @param {string} props.label - Field label
 * @param {string} props.type - Input type (text, number, password, date, select, textarea)
 * @param {string} props.value - Field value
 * @param {Function} props.onChange - Change handler
 * @param {boolean} props.required - Whether field is required
 * @param {Array} props.options - Options for select field
 * @param {string} props.placeholder - Placeholder text
 * @param {number} props.min - Min value for number inputs
 * @param {number} props.max - Max value for number inputs
 * @param {string} props.error - Error message
 */
export default function FormField({
    name,
    label,
    type = "text",
    value,
    onChange,
    required = false,
    options = [],
    placeholder = "",
    min,
    max,
    error = "",
}) {
    // Common classes
    const labelClass = "block text-gray-700 font-medium mb-2";
    const inputClass =
        "w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";
    const errorClass = "mt-1 text-sm text-red-600";

    // Render the appropriate input based on type
    const renderInput = () => {
        switch (type) {
            case "select":
                return (
                    <select
                        id={name}
                        name={name}
                        value={value || ""}
                        onChange={onChange}
                        required={required}
                        className={inputClass}
                    >
                        {placeholder && <option value="">{placeholder}</option>}
                        {options.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                );

            case "textarea":
                return (
                    <textarea
                        id={name}
                        name={name}
                        value={value || ""}
                        onChange={onChange}
                        required={required}
                        placeholder={placeholder}
                        className={`${inputClass} min-h-[80px]`}
                    />
                );

            case "number":
                return (
                    <input
                        id={name}
                        name={name}
                        type="number"
                        value={value === 0 ? "0" : value || ""}
                        onChange={(e) => {
                            // Handle min value constraint in the UI
                            if (min !== undefined && Number(e.target.value) < min) {
                                return onChange({ target: { name, value: min } });
                            }
                            onChange(e);
                        }}
                        required={required}
                        min={min}
                        max={max}
                        placeholder={placeholder}
                        className={inputClass}
                    />
                );

            case "date":
                return (
                    <input
                        id={name}
                        name={name}
                        type="date"
                        value={value || ""}
                        onChange={onChange}
                        required={required}
                        className={inputClass}
                    />
                );

            default:
                return (
                    <input
                        id={name}
                        name={name}
                        type={type}
                        value={value || ""}
                        onChange={onChange}
                        required={required}
                        placeholder={placeholder}
                        className={inputClass}
                    />
                );
        }
    };

    return (
        <div className="mb-2">
            <label htmlFor={name} className={labelClass}>
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            {renderInput()}
            {error && <p className={errorClass}>{error}</p>}
        </div>
    );
}
