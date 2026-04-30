export default function GateStatusPanel({ isOpen }) {
    return (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-800">Gate Status</h2>
            <p className="mt-2 text-base font-medium text-slate-900">{isOpen ? "Gate open" : "Gate closed"}</p>
        </section>
    );
}
