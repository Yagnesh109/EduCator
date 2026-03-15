import { useState } from "react";

function FillBlanksSection({
  items,
  answers: answersProp = null,
  onAnswer = null,
  checkedMap: checkedMapProp = null,
  onCheck = null,
}) {
  const list = Array.isArray(items) ? items : [];
  const [openIndex, setOpenIndex] = useState(null);
  const [internalAnswers, setInternalAnswers] = useState({});
  const [internalCheckedMap, setInternalCheckedMap] = useState({});
  const answers = answersProp && typeof answersProp === "object" ? answersProp : internalAnswers;
  const checkedMap = checkedMapProp && typeof checkedMapProp === "object" ? checkedMapProp : internalCheckedMap;

  if (list.length === 0) {
    return null;
  }

  const handleChange = (index, value) => {
    if (checkedMap[index]) {
      return;
    }
    if (typeof onAnswer === "function") {
      onAnswer(index, value);
      return;
    }
    setInternalAnswers((prev) => ({ ...prev, [index]: value }));
  };

  const handleCheck = (index) => {
    if (typeof onCheck === "function") {
      onCheck(index);
    } else {
      setInternalCheckedMap((prev) => ({ ...prev, [index]: true }));
    }
    setOpenIndex(index);
  };

  return (
    <section className="result-section">
      <h3>Fill in the Blanks</h3>
      <ol>
        {list.map((item, index) => {
          const prompt = String(item?.prompt || "").trim();
          const answer = String(item?.answer || "").trim();
          const explanation = String(item?.explanation || "").trim();
          const topic = String(item?.topic || "").trim();
          const isOpen = openIndex === index;
          const userAnswer = String(answers[index] ?? "").trim();
          const checked = Boolean(checkedMap[index]);
          const isCorrect = checked && userAnswer ? userAnswer.toLowerCase() === answer.toLowerCase() : false;
          const inputStyle = checked
            ? isCorrect
              ? { borderColor: "#2e9c5d", background: "#d9f8e6", color: "#176e3f" }
              : { borderColor: "#c94141", background: "#ffe0e0", color: "#8d1e1e" }
            : {};

          return (
            <li key={`fill-blank-${index}`}>
              {topic && <p className="history-time" style={{ marginBottom: "0.25rem" }}>{topic}</p>}
              <p className="result-question">{prompt}</p>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
                <input
                  type="text"
                  value={userAnswer}
                  placeholder="Type your answer"
                  onChange={(event) => handleChange(index, event.target.value)}
                  disabled={checked}
                  style={{
                    flex: 1,
                    minWidth: "220px",
                    border: "1px solid rgba(17, 36, 60, 0.2)",
                    borderRadius: "10px",
                    padding: "0.55rem 0.65rem",
                    ...inputStyle,
                  }}
                />
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => handleCheck(index)}
                  disabled={!userAnswer || checked}
                >
                  Check
                </button>
              </div>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                <button type="button" className="ghost-btn" onClick={() => setOpenIndex(isOpen ? null : index)}>
                  {isOpen ? "Hide Answer" : "Show Answer"}
                </button>
              </div>
              {isOpen && (
                <div className="rag-answer" style={{ marginTop: "0.6rem", minHeight: "unset" }}>
                  {checked && (
                    <>
                      <span className={`mcq-feedback ${isCorrect ? "mcq-feedback-correct" : "mcq-feedback-wrong"}`}>
                        {isCorrect ? "Correct" : "Wrong"}
                      </span>
                      <div style={{ height: "0.35rem" }} />
                    </>
                  )}
                  <strong>Answer:</strong> {answer || "Not provided."}
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
        const checkedKeys = Object.keys(checkedMap || {});
        const attempted = checkedKeys.filter((key) => checkedMap[key]).length;
        let correctCount = 0;
        checkedKeys.forEach((key) => {
          if (!checkedMap[key]) return;
          const idx = Number(key);
          if (!Number.isInteger(idx) || idx < 0 || idx >= total) return;
          const expected = String(list[idx]?.answer || "").trim().toLowerCase();
          const given = String(answers[idx] ?? "").trim().toLowerCase();
          if (expected && given && expected === given) {
            correctCount += 1;
          }
        });
        const wrongCount = attempted - correctCount;
        const unanswered = total - attempted;
        return (
          <p className="score-board">
            Score: {correctCount} correct, {wrongCount} wrong{unanswered > 0 ? `, ${unanswered} unanswered` : ""}
          </p>
        );
      })()}
    </section>
  );
}

export default FillBlanksSection;
