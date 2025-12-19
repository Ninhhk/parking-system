"use client";

/**
 * Admin page header with title and optional add button
 *
 * @param {Object} props
 * @param {string} props.title - Page title
 * @param {string} props.buttonText - Text for the add button (optional)
 * @param {function} props.onButtonClick - Function to call when add button is clicked (optional)
 */
export default function PageHeader({ title, buttonText, onButtonClick }) {
    return (
        <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">{title}</h1>
            {buttonText && onButtonClick && (
                <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={onButtonClick}>
                    {buttonText}
                </button>
            )}
        </div>
    );
}
