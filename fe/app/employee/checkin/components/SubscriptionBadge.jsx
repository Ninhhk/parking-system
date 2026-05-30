/**
 * Displays subscriber info when vehicle type is auto-resolved from subscription.
 * Shows owner_name and a label indicating auto-resolution.
 */
export default function SubscriptionBadge({ subscription }) {
    if (!subscription) return null;

    return (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div className="text-xs">
                <span className="font-semibold">{subscription.owner_name}</span>
                <span className="text-emerald-600 ml-1.5">— Vehicle type auto-resolved from subscription</span>
            </div>
        </div>
    );
}
