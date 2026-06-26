"use client";

/**
 * Generic table component for displaying data with actions
 *
 * @param {Object} props
 * @param {Array} props.columns - Array of column definitions with { key, label }
 * @param {Array} props.data - Array of data objects
 * @param {function} props.onEdit - Function to call when edit button is clicked (optional)
 * @param {function} props.onDelete - Function to call when delete button is clicked (optional)
 * @param {function} props.onDetail - Function to call when detail button is clicked (optional)
 * @param {string} props.idField - Name of the ID field in data objects (default: 'id')
 * @param {boolean} props.loading - Whether data is loading
 */
export default function DataTable({
    columns = [],
    data = [],
    onEdit,
    onDelete,
    onDetail,
    idField = "id",
    loading = false,
}) {
    if (loading) {
        return (
            <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-slate-500">Loading...</p>
            </div>
        );
    }

    const actions = onEdit || onDelete || onDetail ? ["edit", "detail", "delete"] : [];

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            {data.length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-250 rounded-xl p-12 text-center font-mono">
                    <p className="text-slate-400 text-xs uppercase tracking-wider">No data available.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-150">
                        <thead className="bg-slate-50/75">
                            <tr>
                                {columns.map((column) => (
                                    <th
                                        key={column.key}
                                        className="px-6 py-3.5 text-left text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider"
                                    >
                                        {column.label}
                                    </th>
                                ))}
                                {actions.length > 0 && (
                                    <th className="px-6 py-3.5 text-left text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-150">
                            {data.map((item) => (
                                <tr key={item[idField]} className="hover:bg-indigo-50/20 transition-colors">
                                    {columns.map((column) => (
                                        <td
                                            key={`${item[idField]}-${column.key}`}
                                            className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-600"
                                        >
                                            {column.key === "guest_identification" &&
                                            typeof item[column.key] === "string" &&
                                            item[column.key].startsWith("data:image") ? (
                                                <img
                                                    src={item[column.key]}
                                                    alt="Guest ID"
                                                    className="max-h-24 max-w-xs rounded border"
                                                />
                                            ) : (
                                                item[column.key]
                                            )}
                                        </td>
                                    ))}
                                    {actions.length > 0 && (
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-600">
                                            {onEdit && (
                                                <button
                                                    className="text-indigo-600 hover:underline mr-2"
                                                    onClick={() => onEdit(item)}
                                                >
                                                    Edit
                                                </button>
                                            )}
                                            {onDetail && (
                                                <button
                                                    className="text-emerald-600 hover:underline mr-2"
                                                    onClick={() => onDetail(item[idField])}
                                                >
                                                    Detail
                                                </button>
                                            )}
                                            {onDelete && (
                                                <button
                                                    className="text-red-600 hover:underline"
                                                    onClick={() => onDelete(item[idField])}
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
