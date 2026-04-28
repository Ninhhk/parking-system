export default function ResultPanel({ stateLabel, detail, sessionId }) {
    return (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-800">Result</h2>
            <p className="mt-2 text-base font-medium text-slate-900">{stateLabel}</p>
            <p className="mt-2 text-sm text-slate-600">{detail || "Awaiting next action."}</p>
            {sessionId ? <p className="mt-1 text-sm text-slate-600">Session #{sessionId}</p> : null}
        </section>
    );
}
