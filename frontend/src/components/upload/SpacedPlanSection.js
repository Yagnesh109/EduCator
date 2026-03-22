function SpacedPlanSection({ schedule = [], onReset }) {
  if (!Array.isArray(schedule) || schedule.length === 0) {
    return null;
  }

  return (
    <section className="result-section">
      <div className="summary-header">
        <h3>Spaced Repetition Queue</h3>
        {onReset && (
          <div className="summary-actions">
            <button type="button" className="ghost-btn" onClick={onReset}>
              Reset Plan
            </button>
          </div>
        )}
      </div>
      <ul className="result-options">
        {schedule.map((item) => (
          <li key={item.cardId}>
            Box {item.box} • review in {item.intervalDays} day{item.intervalDays === 1 ? "" : "s"} •{" "}
            {new Date(item.dueAtEpoch * 1000).toLocaleString()} — {item.topic ? `${item.topic}: ` : ""}
            {item.front}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default SpacedPlanSection;
