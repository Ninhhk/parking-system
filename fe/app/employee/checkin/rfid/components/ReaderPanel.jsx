export default function ReaderPanel({ value, onChange, disabled }) {
    return (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-800">RFID Reader</h2>
            <p className="mt-1 text-sm text-slate-500">Scan or enter the card UID from the reader.</p>
            <label htmlFor="rfid-card-uid" className="mt-4 block text-sm font-medium text-slate-700">
                RFID Card UID
            </label>
            <input
                id="rfid-card-uid"
                name="card_uid"
                type="text"
                value={value}
                onChange={onChange}
                disabled={disabled}
                required
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-500"
                placeholder="CARD-0001"
            />
        </section>
    );
}
