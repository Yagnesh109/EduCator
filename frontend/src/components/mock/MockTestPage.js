import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { API_BASE } from "../../config/api";
import "./MockTestPage.css";
import usePremium from "../../premium/usePremium";
import UpgradeNotice from "../premium/UpgradeNotice";
import { auth } from "../../firebase";

function MockTestPage() {
  const navigate = useNavigate();
  const premium = usePremium();
  const [syllabusText, setSyllabusText] = useState("");
  const [pastPapersText, setPastPapersText] = useState("");
  const [syllabusFile, setSyllabusFile] = useState(null);
  const [pastFile, setPastFile] = useState(null);
  const [totalQuestions, setTotalQuestions] = useState(20);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [generating, setGenerating] = useState(false);
  const [savedSourceHint, setSavedSourceHint] = useState("");

  const savedStudySet = useMemo(() => {
    try {
      const raw = localStorage.getItem("educator_study_set") || sessionStorage.getItem("educator_study_set");
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }, []);

  useEffect(() => {
    const label =
      String(savedStudySet?.sourcePreview || "").trim() ||
      String(savedStudySet?.sourceFileName || "").trim() ||
      (Array.isArray(savedStudySet?.sources) && savedStudySet.sources[0]?.label ? String(savedStudySet.sources[0].label) : "");
    if (label) {
      setSavedSourceHint(label);
    }
  }, [savedStudySet]);

  if (!premium.canUse("mock_exam")) {
    return (
      <main className="mock-builder-page">
        <section className="notebook-shell">
          <div className="notebook-grid notebook-grid-full">
            <section className="notebook-card">
              <div className="card-header">
                <h2 className="card-title">Mock Test</h2>
              </div>
              <p className="card-subtitle">This is a Premium feature.</p>
              <div className="notebook-card-body mock-builder-body">
                <UpgradeNotice title="Mock Exam" message="Upgrade to Platinum to unlock mock exams." />
                <div style={{ textAlign: "center", marginTop: "1rem" }}>
                  <button type="button" className="ghost-btn" onClick={() => navigate("/uplod")}>
                    Back
                  </button>
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>
    );
  }

  const getReadableErrorMessage = (error, fallbackMessage) => {
    const raw = String(error?.message || "").toLowerCase();
    if (raw.includes("failed to fetch") || raw.includes("networkerror") || raw.includes("load failed")) {
      return `Cannot reach backend at ${API_BASE}. Start backend server and verify CORS/API URL.`;
    }
    return error?.message || fallbackMessage;
  };

  const handleGenerate = async () => {
    const syllabus = String(syllabusText || "").trim();
    const pastPapers = String(pastPapersText || "").trim();
    const hasSyllabusFile = syllabusFile instanceof File;
    const hasPastFile = pastFile instanceof File;

    const savedFileId = String(savedStudySet?.sourceFileId || "").trim();
    const savedText = String(savedStudySet?.sourceText || "").trim();

    if (!syllabus && !hasSyllabusFile && !savedFileId && !savedText) {
      toast.info("Paste syllabus text, upload a syllabus file, or generate a source in Upload first.");
      return;
    }

    try {
      setGenerating(true);
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
      let response;

      if (syllabus && !hasSyllabusFile && !hasPastFile) {
        response = await fetch(`${API_BASE}/api/exam/mock`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            syllabus,
            pastPapers,
            totalQuestions: Number(totalQuestions) || 20,
            durationMinutes: Number(durationMinutes) || 60,
          }),
        });
      } else {
        const formData = new FormData();
        formData.append("pastPapers", pastPapers);
        formData.append("totalQuestions", Number(totalQuestions) || 20);
        formData.append("durationMinutes", Number(durationMinutes) || 60);

        if (hasSyllabusFile) {
          formData.append("file", syllabusFile);
          formData.append("mode", "file");
        } else if (syllabus) {
          formData.append("syllabus", syllabus);
        } else if (savedFileId) {
          formData.append("fileId", savedFileId);
          formData.append("mode", "file");
        } else if (savedText) {
          formData.append("text", savedText);
          formData.append("mode", "text");
        }

        if (hasPastFile) {
          formData.append("pastFile", pastFile);
        }

        response = await fetch(`${API_BASE}/api/exam/mock`, {
          method: "POST",
          body: formData,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
      }

      const raw = await response.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch (_err) {
        data = null;
      }
      if (!response.ok) {
        throw new Error(data?.error || raw || "Failed to generate mock exam");
      }

      const nextMock = data?.mockExam;
      sessionStorage.setItem("educator_exam_mock", JSON.stringify(nextMock || {}));
      toast.success("Mock exam ready");
      navigate("/exam-mock", { state: { mockExam: nextMock } });
    } catch (error) {
      console.error(error);
      toast.error(getReadableErrorMessage(error, "Failed to generate mock exam"));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="mock-builder-page">
      <section className="notebook-shell">
        <div className="notebook-grid notebook-grid-full">
          <section className="notebook-card">
            <div className="card-header">
              <h2 className="card-title">Mock Test</h2>
            </div>
            <p className="card-subtitle">
              Paste syllabus (or upload a file). We’ll generate a timed mock exam.
            </p>

            <div className="notebook-card-body mock-builder-body">
              <div className="mock-exam-panel">
                <div className="mock-exam-header">
                  <div>
                    <h3>Build your exam</h3>
                    <p>Use your syllabus + past papers to generate a realistic timed test.</p>
                  </div>
                  {savedSourceHint ? <div className="mock-source-pill">Last source: {savedSourceHint}</div> : null}
                </div>

                <div className="mock-builder-grid">
                  <section className="mock-builder-card">
                    <div className="mock-card-head">
                      <h4>Study material</h4>
                      <p>Add syllabus content and (optional) past papers.</p>
                    </div>

                    <div className="mock-field-grid">
                      <div className="field">
                        <span>Syllabus text</span>
                        <textarea
                          value={syllabusText}
                          onChange={(e) => setSyllabusText(e.target.value)}
                          placeholder="Paste syllabus bullets or learning objectives..."
                          rows={7}
                        />
                      </div>

                      <div className="field">
                        <span>Syllabus file (pdf/docx/pptx/txt)</span>
                        <input
                          type="file"
                          accept=".pdf,.docx,.pptx,.txt"
                          onChange={(e) => setSyllabusFile(e.target.files?.[0] || null)}
                        />
                        {syllabusFile && <p className="file-hint">Using: {syllabusFile.name}</p>}
                      </div>
                    </div>

                    <div className="mock-divider" />

                    <div className="mock-field-grid">
                      <div className="field">
                        <span>Past papers text (optional)</span>
                        <textarea
                          value={pastPapersText}
                          onChange={(e) => setPastPapersText(e.target.value)}
                          placeholder="Paste past-paper questions or patterns..."
                          rows={6}
                        />
                      </div>

                      <div className="field">
                        <span>Past papers file (optional)</span>
                        <input
                          type="file"
                          accept=".pdf,.docx,.pptx,.txt"
                          onChange={(e) => setPastFile(e.target.files?.[0] || null)}
                        />
                        {pastFile && <p className="file-hint">Using: {pastFile.name}</p>}
                      </div>
                    </div>
                  </section>

                  <section className="mock-builder-card mock-builder-settings">
                    <div className="mock-card-head">
                      <h4>Exam settings</h4>
                      <p>Pick a length that matches your real test.</p>
                    </div>

                    <div className="mock-exam-controls">
                      <label>
                        <span>Total questions</span>
                        <input
                          type="number"
                          min="5"
                          max="100"
                          value={totalQuestions}
                          onChange={(e) => setTotalQuestions(e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Duration (minutes)</span>
                        <input
                          type="number"
                          min="10"
                          max="240"
                          value={durationMinutes}
                          onChange={(e) => setDurationMinutes(e.target.value)}
                        />
                      </label>
                    </div>

                    <div className="mock-presets">
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => {
                          setTotalQuestions(20);
                          setDurationMinutes(60);
                        }}
                      >
                        20Q / 60m
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => {
                          setTotalQuestions(30);
                          setDurationMinutes(90);
                        }}
                      >
                        30Q / 90m
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => {
                          setTotalQuestions(50);
                          setDurationMinutes(120);
                        }}
                      >
                        50Q / 120m
                      </button>
                    </div>

                    <div className="mock-builder-actions">
                      <button type="button" className="ghost-btn" onClick={() => navigate("/uplod")}>
                        Back to Upload
                      </button>
                      <button type="button" className="primary-action-btn" onClick={handleGenerate} disabled={generating}>
                        {generating ? "Generating..." : "Generate Mock Test"}
                      </button>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export default MockTestPage;
