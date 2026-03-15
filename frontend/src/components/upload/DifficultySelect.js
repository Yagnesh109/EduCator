const DIFFICULTY_LABELS = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

function normalizeDifficulty(value) {
  const raw = String(value || "").trim().toLowerCase();
  return raw === "easy" || raw === "hard" ? raw : "medium";
}

function DifficultySelect({ value, onChange, disabled = false, label = "Difficulty" }) {
  const normalized = normalizeDifficulty(value);
  return (
    <div className="difficulty-control">
      <label>
        {label}
        <select
          value={normalized}
          onChange={(event) => onChange?.(normalizeDifficulty(event.target.value))}
          disabled={disabled}
        >
          {Object.keys(DIFFICULTY_LABELS).map((key) => (
            <option key={key} value={key}>
              {DIFFICULTY_LABELS[key]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export { normalizeDifficulty };
export default DifficultySelect;

