import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { API_BASE } from "../../config/api";
import "./ExamMockPage.css";
import usePremium from "../../premium/usePremium";
import UpgradeNotice from "../premium/UpgradeNotice";

function ExamMockPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const premium = usePremium();
  const historyStoredRef = useRef(false);

  const [mock, setMock] = useState(null);
  const [answers, setAnswers] = useState({});
  const [reviewMap, setReviewMap] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAgree, setConfirmAgree] = useState(false);

  useEffect(() => {
    if (!submitted) historyStoredRef.current = false;
  }, [submitted]);

  useEffect(() => {
    const stateMock = location.state?.mockExam || location.state?.mock || null;
    if (stateMock) {
      setMock(stateMock);
      sessionStorage.setItem("educator_exam_mock", JSON.stringify(stateMock));
      setActiveIndex(0);
      return;
    }

    const saved = sessionStorage.getItem("educator_exam_mock");
    if (saved) {
      try {
        setMock(JSON.parse(saved));
        setActiveIndex(0);
      } catch (_err) {
        setMock(null);
      }
    }
  }, [location.state]);

  const totalQuestions = useMemo(() => mock?.questions?.length || 0, [mock]);
  const totalMinutes = useMemo(() => {
    const raw =
      mock?.timing?.totalMinutes ??
      mock?.timing?.durationMinutes ??
      mock?.durationMinutes ??
      mock?.totalMinutes ??
      0;
    const value = Number(raw || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }, [mock]);

  useEffect(() => {
    if (submitted) return;
    if (!totalMinutes) return;
    if (timeLeft !== null) return;
    setTimeLeft(totalMinutes * 60);
  }, [submitted, timeLeft, totalMinutes]);

  const formatTime = (seconds) => {
    if (seconds === null) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleAutoSubmit = () => {
    setSubmitted(true);
    alert("Time is up! Your exam has been auto-submitted.");
  };

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

  useEffect(() => {
    if (!mock || submitted) return;

    const notifyBlocked = (type) => {
      toast.info("Copy, paste, and text selection are not allowed during exam.", { toastId: `exam-block-${type}` });
    };

    const stop = (event) => {
      event.preventDefault();
      if (event.type === "contextmenu") notifyBlocked("copy");
      if (event.type === "copy" || event.type === "cut" || event.type === "paste") notifyBlocked("copy");
    };

    const stopKeys = (event) => {
      const key = String(event.key || "").toLowerCase();
      const ctrl = event.ctrlKey || event.metaKey;
      if (!ctrl) return;
      if (key === "c" || key === "v" || key === "x" || key === "a") {
        event.preventDefault();
        notifyBlocked(key === "a" ? "select" : "copy");
      }
    };

    const stopSelection = () => {
      const selection = window.getSelection?.();
      const text = selection ? String(selection.toString() || "") : "";
      if (!text.trim()) return;
      try {
        selection.removeAllRanges();
      } catch (_err) {
        // ignore
      }
      notifyBlocked("select");
    };

    document.addEventListener("contextmenu", stop, { capture: true });
    document.addEventListener("copy", stop, { capture: true });
    document.addEventListener("cut", stop, { capture: true });
    document.addEventListener("paste", stop, { capture: true });
    document.addEventListener("keydown", stopKeys, { capture: true });
    document.addEventListener("selectionchange", stopSelection, { capture: true });

    return () => {
      document.removeEventListener("contextmenu", stop, { capture: true });
      document.removeEventListener("copy", stop, { capture: true });
      document.removeEventListener("cut", stop, { capture: true });
      document.removeEventListener("paste", stop, { capture: true });
      document.removeEventListener("keydown", stopKeys, { capture: true });
      document.removeEventListener("selectionchange", stopSelection, { capture: true });
    };
  }, [mock, submitted]);

  const handleSelect = (qIdx, opt) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qIdx]: opt }));
  };

  const toggleReview = (qIdx) => {
    if (submitted) return;
    setReviewMap((prev) => ({ ...prev, [qIdx]: !prev?.[qIdx] }));
  };

  const counts = useMemo(() => {
    const total = totalQuestions;
    const attempted = Object.keys(answers || {}).length;
    const review = Object.values(reviewMap || {}).filter(Boolean).length;
    const notAttempted = Math.max(0, total - attempted);
    return { total, attempted, review, notAttempted };
  }, [answers, reviewMap, totalQuestions]);

  const score = useMemo(() => {
    if (!mock?.questions) return 0;
    return mock.questions.reduce((acc, q, idx) => {
      return acc + (answers[idx] === q.answer ? 1 : 0);
    }, 0);
  }, [mock, answers]);

  const isLastQuestion = totalQuestions > 0 && activeIndex >= totalQuestions - 1;
  const attemptedCount = useMemo(() => {
    return Object.keys(answers || {}).filter((key) => {
      const idx = Number(key);
      const val = answers[key];
      return Number.isFinite(idx) && val !== undefined && val !== null && String(val).trim().length > 0;
    }).length;
  }, [answers]);

  const correctCount = useMemo(() => {
    if (!mock?.questions) return 0;
    return mock.questions.reduce((acc, q, idx) => acc + (answers[idx] === q.answer ? 1 : 0), 0);
  }, [mock, answers]);

  const wrongCount = Math.max(0, attemptedCount - correctCount);
  const notAttemptedCount = Math.max(0, totalQuestions - attemptedCount);

  const openSubmitConfirm = () => {
    if (submitted) return;
    if (!isLastQuestion) {
      toast.info("Go to the last question to submit the exam.");
      return;
    }
    setConfirmAgree(false);
    setConfirmOpen(true);
  };

  const confirmSubmit = () => {
    if (!confirmAgree) return;
    setSubmitted(true);
    setConfirmOpen(false);
  };

  useEffect(() => {
    if (!submitted || !mock) return;
    if (historyStoredRef.current) return;
    historyStoredRef.current = true;

    const buildConcepts = () => {
      const concepts = [];
      const sections = Array.isArray(mock?.sections) ? mock.sections : [];
      for (const section of sections) {
        if (section?.name) concepts.push(String(section.name));
        const topics = Array.isArray(section?.focusTopics) ? section.focusTopics : [];
        for (const topic of topics) {
          if (topic) concepts.push(String(topic));
        }
      }
      const uniq = Array.from(new Set(concepts.map((c) => c.trim()).filter(Boolean)));
      return uniq.slice(0, 30);
    };

    const saveAttempt = async () => {
      try {
        const concepts = buildConcepts();
        const questions = Array.isArray(mock?.questions) ? mock.questions : [];
        const sectionStats = {};
        for (let idx = 0; idx < questions.length; idx += 1) {
          const q = questions[idx] || {};
          const sectionName = String(q.section || "General").trim() || "General";
          if (!sectionStats[sectionName]) {
            sectionStats[sectionName] = { total: 0, attempted: 0, correct: 0, wrong: 0, notAttempted: 0 };
          }
          sectionStats[sectionName].total += 1;

          const a = answers[idx];
          const attempted = a !== undefined && a !== null && String(a).trim().length > 0;
          if (!attempted) {
            sectionStats[sectionName].notAttempted += 1;
            continue;
          }
          sectionStats[sectionName].attempted += 1;
          if (a === q.answer) sectionStats[sectionName].correct += 1;
          else sectionStats[sectionName].wrong += 1;
        }

        const duration = Number(totalMinutes || mock?.requestedDurationMinutes || 0);
        const questionCount = Number(totalQuestions || mock?.requestedTotalQuestions || 0);
        const payload = {
          kind: "mock_exam_attempt",
          sourceType: "mock_exam",
          sourcePreview: concepts.length ? `Concepts: ${concepts.slice(0, 6).join(", ")}` : "Mock exam attempt",
          examConcepts: concepts,
          examTotalQuestions: questionCount,
          examDurationMinutes: duration,
          examAttempted: attemptedCount,
          examCorrect: correctCount,
          examWrong: wrongCount,
          examNotAttempted: notAttemptedCount,
          examSectionStats: sectionStats,
        };

        await fetch(`${API_BASE}/api/history/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (_err) {
        // best-effort only
      }
    };

    saveAttempt();
  }, [submitted, mock, answers, attemptedCount, correctCount, wrongCount, notAttemptedCount, totalMinutes, totalQuestions]);

  const goNext = () => {
    if (activeIndex >= totalQuestions - 1) {
      openSubmitConfirm();
      return;
    }
    setActiveIndex((prev) => Math.min(totalQuestions - 1, prev + 1));
  };

  if (!mock) {
    return (
      <main className="exam-mock-page">
        <div className="exam-card">
          <h1>Mock exam not found</h1>
          <p>Generate a mock exam first.</p>
          <button type="button" onClick={() => navigate("/uplod")}>Back to workspace</button>
        </div>
      </main>
    );
  }

  if (!premium.canUse("mock_exam")) {
    return (
      <main className="exam-mock-page">
        <div className="exam-card">
          <h1>Mock Exam</h1>
          <p>This is a Premium feature.</p>
          <UpgradeNotice title="Mock Exam" message="Upgrade to Platinum to unlock mock exams." />
          <div style={{ textAlign: "center", marginTop: "1rem" }}>
            <button type="button" className="ghost-btn" onClick={() => navigate("/uplod")}>Back</button>
          </div>
        </div>
      </main>
    );
  }

  const question = (mock?.questions || [])[activeIndex] || null;
  const markedForReview = Boolean(reviewMap?.[activeIndex]);
  const currentAttempted = answers[activeIndex] !== undefined && answers[activeIndex] !== null && String(answers[activeIndex]).length > 0;
  const currentIsCorrect = submitted && currentAttempted && question && answers[activeIndex] === question.answer;
  const currentIsWrong = submitted && currentAttempted && question && answers[activeIndex] !== question.answer;
  const questionCardClass = ["exam-question-card", currentIsCorrect ? "is-correct" : "", currentIsWrong ? "is-wrong" : ""].filter(Boolean).join(" ");
  const questionTextClass = ["question-text", submitted ? (currentIsCorrect ? "is-correct" : currentIsWrong ? "is-wrong" : "") : ""].filter(Boolean).join(" ");

  return (
    <main className="exam-runner-page">
      <header className="exam-runner-topbar">
        <div />

        <div className={`exam-runner-timer ${timeLeft !== null && timeLeft < 300 ? "low-time" : ""}`}>{formatTime(timeLeft)}</div>

        <div className="exam-runner-top-actions">
          {submitted ? (
            <span className="score-display">
              Score: {score} / {totalQuestions}
            </span>
          ) : (
            <button
              type="button"
              className="primary-action-btn exam-submit-btn"
              onClick={openSubmitConfirm}
              disabled={!isLastQuestion}
              title={isLastQuestion ? "Submit exam" : "Reach the last question to submit"}
            >
              Submit
            </button>
          )}
        </div>
      </header>

      <div className="exam-runner-layout">
        <section className="exam-main">
          <div className={questionCardClass}>
            <div className="exam-question-meta">
              <div className="exam-question-index">
                Question {Math.min(totalQuestions, activeIndex + 1)} / {totalQuestions}
              </div>
              {markedForReview ? <div className="exam-review-pill">Under review</div> : null}
            </div>

            <div className="exam-question-scroll">
              {question ? (
                <>
                  <div className="question-top">
                    <span className="badge">{question.section || "General"}</span>
                    {question.difficulty ? <span className="badge muted">{question.difficulty}</span> : null}
                    {question.suggestedTimeMinutes ? <span className="badge muted">{question.suggestedTimeMinutes} min</span> : null}
                    {totalMinutes ? <span className="badge muted">{totalMinutes} min</span> : null}
                  </div>

                  <p className={questionTextClass}>{question.question}</p>

                  <ul className="options">
                    {(question.options || []).map((opt, optIdx) => {
                      const isSelected = answers[activeIndex] === opt;
                      const isCorrect = opt === question.answer;
                      let liClass = "option-item";
                      if (isSelected) liClass += " selected";
                      if (submitted) {
                        if (isCorrect) liClass += " correct";
                        else if (isSelected) liClass += " incorrect";
                      }

                      return (
                        <li key={optIdx} className={liClass} onClick={() => handleSelect(activeIndex, opt)}>
                          <span className="opt-label">{String.fromCharCode(65 + optIdx)}.</span> {opt}
                        </li>
                      );
                    })}
                  </ul>

                  {submitted && question.explanation ? (
                    <div className="exam-explanation-box">
                      <p className="exam-explanation">
                        <strong>Answer:</strong> {question.answer}
                        <br />
                        <strong>Explanation:</strong> {question.explanation}
                      </p>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="exam-empty">No questions found.</div>
              )}
            </div>

            <div className="exam-runner-actions">
              <button type="button" className="primary-action-btn" onClick={goNext} disabled={submitted}>
                Save & Next
              </button>
              <button type="button" className="ghost-btn" onClick={() => toggleReview(activeIndex)} disabled={submitted}>
                {markedForReview ? "Unmark review" : "Mark for review"}
              </button>
              <button
                type="button"
                className="ghost-btn exam-exit-btn"
                onClick={() => navigate("/uplod")}
                disabled={!submitted}
                title={submitted ? "Exit exam" : "Submit the exam to enable Exit"}
              >
                Exit
              </button>
            </div>
          </div>
        </section>

        <aside className="exam-sidebar">
          <div className="exam-counts">
            <div className="exam-count-card">
              <div className="exam-count-label">Attempted</div>
              <div className="exam-count-value">{counts.attempted}</div>
            </div>
            <div className="exam-count-card">
              <div className="exam-count-label">Under review</div>
              <div className="exam-count-value">{counts.review}</div>
            </div>
            <div className="exam-count-card">
              <div className="exam-count-label">Not attempted</div>
              <div className="exam-count-value">{counts.notAttempted}</div>
            </div>
            <div className="exam-count-card">
              <div className="exam-count-label">Total</div>
              <div className="exam-count-value">{counts.total}</div>
            </div>
          </div>

          <div className="exam-qgrid" aria-label="Question navigation">
            {(mock.questions || []).map((q, idx) => {
              const attempted = answers[idx] !== undefined && answers[idx] !== null && String(answers[idx]).length > 0;
              const review = Boolean(reviewMap?.[idx]);
              const isActive = idx === activeIndex;
              const isCorrect = submitted && attempted && answers[idx] === q.answer;
              const isWrong = submitted && attempted && answers[idx] !== q.answer;
              const cls = [
                "exam-qnum",
                attempted ? "is-attempted" : "is-unattempted",
                review ? "is-review" : "",
                isActive ? "is-active" : "",
                isCorrect ? "is-correct" : "",
                isWrong ? "is-wrong" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button key={q.id || q.question || idx} type="button" className={cls} onClick={() => setActiveIndex(idx)}>
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      {confirmOpen ? (
        <div className="exam-modal-overlay" role="dialog" aria-modal="true" aria-label="Submit exam confirmation">
          <div className="exam-modal">
            <h3>Submit exam</h3>

            <ul className="exam-modal-counts">
              <li>
                <strong>Total:</strong> {counts.total}
              </li>
              <li>
                <strong>Attempted:</strong> {counts.attempted}
              </li>
              <li>
                <strong>Under review:</strong> {counts.review}
              </li>
              <li>
                <strong>Not attempted:</strong> {counts.notAttempted}
              </li>
            </ul>

            <label className="exam-modal-agree">
              <input type="checkbox" checked={confirmAgree} onChange={(e) => setConfirmAgree(e.target.checked)} /> I agree to submit.
            </label>

            <div className="exam-modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setConfirmOpen(false)}>
                Cancel
              </button>
              <button type="button" className="primary-action-btn" onClick={confirmSubmit} disabled={!confirmAgree}>
                Submit
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default ExamMockPage;
