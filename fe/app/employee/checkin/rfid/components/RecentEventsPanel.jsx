export default function RecentEventsPanel({ events }) {
    return (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-800">Recent Events</h2>
            {events.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No recent RFID events.</p>
            ) : (
                <ul className="mt-2 space-y-2">
                    {events.map((event) => (
                        <li key={event.id} className="text-sm text-slate-700">
                            {event.text}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
