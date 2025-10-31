"use client";
export default function EditableInput({ label, value, onChange, modoEdicion }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-600">{label}</p>
      {modoEdicion ? (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full border border-gray-300 px-2 py-1 rounded"
        />
      ) : (
        <p className="mt-1 text-sm">{value || "—"}</p>
      )}
    </div>
  );
}
