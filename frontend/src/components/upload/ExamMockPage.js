import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./ExamMockPage.css";

function ExamMockPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mock, setMock] = useState(null);

  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    const stateMock = location.state?.mockExam || location.state?.mock || null;
    if (stateMock) {
      setMock(stateMock);
      sessionStorage.setItem("educator_exam_mock", JSON.stringify(stateMock));
      return;
    }
    const saved = sessionStorage.getItem("educator_exam_mock");
    if (saved) {
      try {
        setMock(JSON.parse(saved));
      } catch (_err) {
        setMock(null);
      }
    }
  }, [location.state]);

  const totalQuestions = useMemo(() => mock?.questions?.length || 0, [mock]);
  const totalMinutes = useMemo(() => mock?.timing?.totalMinutes || 0, [mock]);

  // Initialize timer once mock is loaded
  useEffect(() => {
    if (mock?.timing?.totalMinutes && timeLeft === null) {
      setTimeLeft(mock.timing.totalMinutes * 60);
    }
  }, [mock, timeLeft]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft === null || submitted || timeLeft <= 0) return;
    const timerId = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerId);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, submitted]);

  const handleAutoSubmit = () => {
    setSubmitted(true);
    alert("Time is up! Your exam has been auto-submitted.");
  };

  const handleSelect = (qIdx, opt) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qIdx]: opt }));
  };

  const score = useMemo(() => {
    if (!mock?.questions) return 0;
    return mock.questions.reduce((acc, q, idx) => {
      return acc + (answers[idx] === q.answer ? 1 : 0);
    }, 0);
  }, [mock, answers]);

  const handleSubmit = () => {
    if (window.confirm("Are you sure you want to submit your exam?")) {
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const formatTime = (seconds) => {
    if (seconds === null) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!mock) {
    return (
      <main className="exam-mock-page">
        <div className="exam-card">
          <h1>Mock exam not found</h1>
          <p>Add a syllabus/past paper from the workspace and generate a mock exam.</p>
          <button type="button" onClick={() => navigate("/uplod")}>
            Back to workspace
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="exam-mock-page">
      <div className="exam-card">
        {/* Sticky Timer & Actions Bar */}
        <div className="sticky-timer-bar">
          <div className="timer-section">
            <span className="timer-label">Time Remaining: </span>
            <span className={`timer-display ${timeLeft < 300 ? "low-time" : ""}`}>
              {formatTime(timeLeft)}
            </span>
          </div>
          <div className="exam-header-actions" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {submitted ? (
              <span className="score-display">
                Score: {score} / {totalQuestions}
              </span>
            ) : (
              <button
                type="button"
                className="accent-button"
                style={{ background: "#2563eb", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}
                onClick={handleSubmit}
              >
                Submit Exam
              </button>
            )}
            <button
              type="button"
              style={{ background: "#e2e8f0", color: "#0f172a", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}
              onClick={() => navigate("/uplod")}
            >
              Exit
            </button>
          </div>
        </div>

        <header className="exam-header" style={{ borderBottom: "none", paddingBottom: "0" }}>
          <div>
            <p className="eyebrow">Mock Exam</p>
            <h1>Sectioned practice based on your syllabus</h1>
            <p className="subtitle">
              {totalQuestions} questions • {totalMinutes} minutes total
            </p>
          </div>
        </header>

        <section className="exam-sections">
          <h2>Sections & timing</h2>
          <ul>
            {(mock.sections || []).map((section) => (
              <li key={section.name}>
                <div className="section-name">{section.name}</div>
                <div className="section-meta">
                  {section.plannedQuestions} qs • weight {section.weight ?? 0} •
                  {" "}{(section.focusTopics || []).join(", ") || "General"}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="exam-questions">
          <h2>Questions</h2>
          <ol>
            {(mock.questions || []).map((q, idx) => (
              <li key={q.id || q.question} className="exam-question">
                <div className="question-top">
                  <span className="badge">{q.section || "General"}</span>
                  <span className="badge muted">{q.difficulty}</span>
                  <span className="badge muted">{q.suggestedTimeMinutes} min</span>
                </div>
                <p className="question-text">{q.question}</p>
                <ul className="options">
                  {(q.options || []).map((opt, optIdx) => {
                    const isSelected = answers[idx] === opt;
                    const isCorrect = opt === q.answer;
                    let liClass = "option-item";
                    if (isSelected) liClass += " selected";
                    if (submitted) {
                      if (isCorrect) liClass += " correct";
                      else if (isSelected) liClass += " incorrect";
                    }

                    return (
                      <li key={optIdx} className={liClass} onClick={() => handleSelect(idx, opt)}>
                        <span className="opt-label">{String.fromCharCode(65 + optIdx)}.</span> {opt}
                      </li>
                    );
                  })}
                </ul>
                {submitted && (
                  <div className="explanation-box" style={{ marginTop: "12px", padding: "12px", borderRadius: "8px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <p className="explanation" style={{ margin: 0, color: "#334155", fontSize: "14px" }}>
                      <strong style={{ color: "#0f172a" }}>Real Answer:</strong> {q.answer}
                      <br />
                      <strong style={{ color: "#0f172a", marginTop: "4px", display: "inline-block" }}>Explanation:</strong> {q.explanation}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}

export default ExamMockPage;
