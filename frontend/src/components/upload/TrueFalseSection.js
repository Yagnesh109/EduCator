import { useState } from "react";

function TrueFalseSection({ items, answers: answersProp = null, onAnswer = null }) {
  const list = Array.isArray(items) ? items : [];
  const [internalAnswers, setInternalAnswers] = useState({});
  const answers = answersProp && typeof answersProp === "object" ? answersProp : internalAnswers;

  if (list.length === 0) {
    return null;
  }

  const handleSelect = (index, value) => {
    if (typeof onAnswer === "function") {
      onAnswer(index, value);
      return;
    }
    setInternalAnswers((prev) => ({ ...prev, [index]: value }));
  };

  return (
    <section className="result-section">
      <h3>True / False</h3>
      <ol>
        {list.map((item, index) => {
          const statement = String(item?.statement || "").trim();
          const correct = Boolean(item?.answer);
          const explanation = String(item?.explanation || "").trim();
          const topic = String(item?.topic || "").trim();
          const selected = answers[index];
          const hasSelected = typeof selected === "boolean";
          const isCorrect = hasSelected ? selected === correct : false;
          const trueBtnClass = hasSelected
            ? correct
              ? "mcq-option-correct"
              : selected === true
              ? "mcq-option-wrong"
              : ""
            : "";
          const falseBtnClass = hasSelected
            ? !correct
              ? "mcq-option-correct"
              : selected === false
              ? "mcq-option-wrong"
              : ""
            : "";

          return (
            <li key={`tf-${index}`}>
              {topic && <p className="history-time" style={{ marginBottom: "0.25rem" }}>{topic}</p>}
              <p className="result-question">{statement}</p>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.55rem" }}>
                <button
                  type="button"
                  className={`ghost-btn ${trueBtnClass}`.trim()}
                  onClick={() => handleSelect(index, true)}
                  disabled={hasSelected}
                >
                  True
                </button>
                <button
                  type="button"
                  className={`ghost-btn ${falseBtnClass}`.trim()}
                  onClick={() => handleSelect(index, false)}
                  disabled={hasSelected}
                >
                  False
                </button>
              </div>
              {hasSelected && (
                <div className="rag-answer" style={{ marginTop: "0.6rem", minHeight: "unset" }}>
                  <span className={`mcq-feedback ${isCorrect ? "mcq-feedback-correct" : "mcq-feedback-wrong"}`}>
                    {isCorrect ? "Correct" : "Wrong"}
                  </span>
                  <span>{" "}Answer:{" "}</span>
                  <strong>{correct ? "True" : "False"}</strong>
                  {explanation && (
                    <>
                      <div style={{ height: "0.5rem" }} />
                      <strong>Why:</strong> {explanation}
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {(() => {
        const total = list.length;
        let answered = 0;
        let correctCount = 0;
        for (let i = 0; i < total; i += 1) {
          if (typeof answers[i] === "boolean") {
            answered += 1;
            if (Boolean(answers[i]) === Boolean(list[i]?.answer)) {
              correctCount += 1;
            }
          }
        }
        const wrongCount = answered - correctCount;
        const unanswered = total - answered;
        return (
          <p className="score-board">
            Score: {correctCount} correct, {wrongCount} wrong{unanswered > 0 ? `, ${unanswered} unanswered` : ""}
          </p>
        );
      })()}
    </section>
  );
}

export default TrueFalseSection;
