import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../../config/api";
import InputSection from "./InputSection";
import VoiceQASection from "./VoiceQASection";
import generateWithTool from "./generateTool";

function UploadPage({ user }) {
  const displayName =
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Learner";
  const navigate = useNavigate();
  const [textValue, setTextValue] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [storedFileId, setStoredFileId] = useState("");
  const [storedFileName, setStoredFileName] = useState("");
  const [inputMode, setInputMode] = useState("");
  const [mcqs, setMcqs] = useState([]);
  const [mcqSetId, setMcqSetId] = useState("");
  const [mcqVerdicts, setMcqVerdicts] = useState({});
  const [verifyingAnswers, setVerifyingAnswers] = useState({});
  const [flashcards, setFlashcards] = useState([]);
  const [fillBlanks, setFillBlanks] = useState([]);
  const [trueFalse, setTrueFalse] = useState([]);
  const [loadingStudySet, setLoadingStudySet] = useState(false);
  const [summary, setSummary] = useState("");
  const [summaryGenerating, setSummaryGenerating] = useState(false);
  const [ttsLanguage] = useState("en");
  const [lastSource, setLastSource] = useState(null);
  const [ragQuestion, setRagQuestion] = useState("");
  const [ragAnswer, setRagAnswer] = useState("");
  const [ragLoading, setRagLoading] = useState(false);
  const [aiGuideMode, setAiGuideMode] = useState("text");
  const [voiceQuestion, setVoiceQuestion] = useState("");
  const [voiceAnswer, setVoiceAnswer] = useState("");
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceAnswerAudioUrl, setVoiceAnswerAudioUrl] = useState("");
  const [recognizer, setRecognizer] = useState(null);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [sources, setSources] = useState([]);
  const [mcqGenerating, setMcqGenerating] = useState(false);
  const [flashGenerating, setFlashGenerating] = useState(false);
  const [fillBlanksGenerating, setFillBlanksGenerating] = useState(false);
  const [trueFalseGenerating, setTrueFalseGenerating] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [mcqReady, setMcqReady] = useState(false);
  const [flashReady, setFlashReady] = useState(false);
  const [fillBlanksReady, setFillBlanksReady] = useState(false);
  const [trueFalseReady, setTrueFalseReady] = useState(false);
  const [mcqPayload, setMcqPayload] = useState(null);
  const [flashPayload, setFlashPayload] = useState(null);
  const [fillBlanksPayload, setFillBlanksPayload] = useState(null);
  const [trueFalsePayload, setTrueFalsePayload] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioLoading, setAudioLoading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState("");
  const [examSyllabus, setExamSyllabus] = useState("");
  const [examPast, setExamPast] = useState("");
  const [examQuestions, setExamQuestions] = useState(20);
  const [examDuration, setExamDuration] = useState(60);
  const [examGenerating, setExamGenerating] = useState(false);
  const [examMock, setExamMock] = useState(null);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [examSyllabusFile, setExamSyllabusFile] = useState(null);
  const [examPastFile, setExamPastFile] = useState(null);

  const persistSourceSession = (sourceType, sourcePreview, sourceText = "", sourceFileId = "", sourceFileName = "") => {
    let existing = {};
    try {
      const savedRaw = sessionStorage.getItem("educator_study_set");
      existing = savedRaw ? JSON.parse(savedRaw) || {} : {};
    } catch (_error) {
      existing = {};
    }
    const payload = {
      sourceType,
      sourcePreview,
      sourceText,
      sourceFileId,
      sourceFileName,
      sources: Array.isArray(existing?.sources) ? existing.sources : [],
      difficultyByMode:
        existing?.difficultyByMode && typeof existing.difficultyByMode === "object"
          ? existing.difficultyByMode
          : {
              mcq: "medium",
              flashcards: "medium",
              true_false: "medium",
              fill_blanks: "medium",
            },
      mcqs: [],
      flashcards: [],
      fillBlanks: [],
      trueFalse: [],
      summary: "",
      mcqSetId: "",
    };
    sessionStorage.setItem("educator_study_set", JSON.stringify(payload));
  };

  const resetGeneratedOutputs = () => {
    setMcqs([]);
    setFlashcards([]);
    setFillBlanks([]);
    setTrueFalse([]);
    setSummary("");
    setMcqSetId("");
    setMcqVerdicts({});
    setVerifyingAnswers({});
    setMcqReady(false);
    setFlashReady(false);
    setFillBlanksReady(false);
    setTrueFalseReady(false);
    setMcqPayload(null);
    setFlashPayload(null);
    setFillBlanksPayload(null);
    setTrueFalsePayload(null);
    setAudioUrl("");
  };

  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      return;
    }
    const rec = new Recognition();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      const text = String(event.results?.[0]?.[0]?.transcript || "").trim();
      if (text) {
        setVoiceQuestion(text);
      }
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setRecognizer(rec);
  }, []);

  const getReadableErrorMessage = (error, fallbackMessage) => {
    const raw = String(error?.message || "").toLowerCase();
    if (raw.includes("failed to fetch") || raw.includes("networkerror") || raw.includes("load failed")) {
      return `Cannot reach backend at ${API_BASE}. Start backend server and verify CORS/API URL.`;
    }
    return error?.message || fallbackMessage;
  };


  const hasText = textValue.trim().length > 0;
  const hasFile = Boolean(uploadFile) || Boolean(storedFileId);
  const canGenerate = hasText || hasFile;
  const hasResults = mcqs.length > 0 || flashcards.length > 0 || fillBlanks.length > 0 || trueFalse.length > 0;
  const hasSummary = summary.trim().length > 0;
  const hasSource =
    sources.length > 0 ||
    (inputMode === "file" && (uploadFile || storedFileId)) ||
    (inputMode === "text" && textValue.trim().length > 0);

  const canUseText = useMemo(() => inputMode !== "file", [inputMode]);
  const canUseFile = useMemo(() => inputMode !== "text", [inputMode]);

  const handleTextChange = (event) => {
    const value = event.target.value;
    setTextValue(value);
    if (value.trim()) {
      setInputMode("text");
      setUploadFile(null);
      setStoredFileId("");
      setStoredFileName("");
      resetGeneratedOutputs();
      persistSourceSession("text", value.slice(0, 300), value);
      return;
    }
    if (!hasFile) {
      setInputMode("");
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0] || null;
    setUploadFile(file);
    if (file) {
      setInputMode("file");
      setTextValue("");
      resetGeneratedOutputs();
      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch(`${API_BASE}/api/source/upload`, { method: "POST", body: formData });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || "Failed to store uploaded file");
        }
        const nextFileId = String(data?.fileId || "");
        const nextFileName = String(data?.fileName || file.name);
        setStoredFileId(nextFileId);
        setStoredFileName(nextFileName);
        persistSourceSession("file", nextFileName, "", nextFileId, nextFileName);
      } catch (error) {
        console.error(error);
        toast.error(getReadableErrorMessage(error, "Failed to store uploaded file"));
        setStoredFileId("");
        setStoredFileName("");
      }
      return;
    }
    if (!hasText) {
      setInputMode("");
    }
  };
  const saveCurrentSession = async () => {
    const activeSource = getActiveSource();
    const sourceType =
      activeSource?.mode ||
      inputMode ||
      (uploadFile || storedFileId ? "file" : "text");
    const sourcePreview =
      activeSource?.label ||
      (activeSource?.mode === "text" ? activeSource.text?.slice(0, 300) : "") ||
      (inputMode === "text" ? textValue.slice(0, 300) : storedFileName || uploadFile?.name || "");
    const payload = {
      sourceType,
      sourcePreview,
      hadMcqs: mcqs.length > 0,
      hadFlashcards: flashcards.length > 0,
      hadFillBlanks: fillBlanks.length > 0,
      hadTrueFalse: trueFalse.length > 0,
      mcqTotal: mcqs.length,
      mcqCorrect: 0,
      mcqs,
      flashcards,
      fillBlanks,
      trueFalse,
      summary,
    };
    const response = await fetch(`${API_BASE}/api/history/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      let message = "Failed to store session";
      try {
        const err = await response.json();
        message = err.error || message;
      } catch (_error) {
        const text = await response.text();
        if (text) {
          message = text;
        }
      }
      throw new Error(message);
    }
    const result = await response.json();
    if (!result?.stored) {
      throw new Error(result?.error || "History not stored. Check Firebase configuration.");
    }
  };

  const handleSaveAndGenerateOtherSource = async () => {
    try {
      setSavingSession(true);
      await saveCurrentSession();
      toast.success("Saved. Ready for another source.");
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setAudioUrl("");
      setTextValue("");
      setUploadFile(null);
      setStoredFileId("");
      setStoredFileName("");
      setInputMode("");
      setSources([]);
      setRagQuestion("");
      setRagAnswer("");
      setVoiceQuestion("");
      setVoiceAnswer("");
      setVoiceAnswerAudioUrl("");
      setListening(false);
      setMcqGenerating(false);
      setFlashGenerating(false);
      setMcqReady(false);
      setFlashReady(false);
      setMcqPayload(null);
      setFlashPayload(null);
      setMcqs([]);
      setMcqSetId("");
      setMcqVerdicts({});
      setVerifyingAnswers({});
      setFlashcards([]);
      setSummary("");
    } catch (error) {
      console.error(error);
      toast.error(getReadableErrorMessage(error, "Failed to save current session"));
    } finally {
      setSavingSession(false);
    }
  };

  const handleSaveSessionOnly = async () => {
    if (!hasSource && !hasResults) {
      toast.info("Add a source or generate MCQs/flashcards first");
      return;
    }
    try {
      setSavingSession(true);
      await saveCurrentSession();
      toast.success("Session saved to history");
    } catch (error) {
      console.error(error);
      toast.error(getReadableErrorMessage(error, "Failed to save current session"));
    } finally {
      setSavingSession(false);
    }
  };

  const handleGenerateOtherSource = async () => {
    // Important: clear stored session, otherwise the restore effect will bring old results back.
    sessionStorage.removeItem("educator_study_set");
    sessionStorage.removeItem("educator_exam_mock");
    setExamModalOpen(false);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    if (voiceAnswerAudioUrl) {
      URL.revokeObjectURL(voiceAnswerAudioUrl);
    }
    if (recognizer && listening) {
      try {
        recognizer.stop();
      } catch (_error) {}
    }
    setAudioUrl("");
    setTextValue("");
    setUploadFile(null);
    setStoredFileId("");
    setStoredFileName("");
    setInputMode("");
    setSources([]);
    setRagQuestion("");
    setRagAnswer("");
    setRagLoading(false);
    setAiGuideMode("text");
    setVoiceQuestion("");
    setVoiceAnswer("");
    setVoiceAnswerAudioUrl("");
    setVoiceLoading(false);
    setListening(false);
    setLastSource(null);
    setMcqGenerating(false);
    setFlashGenerating(false);
    setFillBlanksGenerating(false);
    setTrueFalseGenerating(false);
    setMcqReady(false);
    setFlashReady(false);
    setFillBlanksReady(false);
    setTrueFalseReady(false);
    setMcqPayload(null);
    setFlashPayload(null);
    setFillBlanksPayload(null);
    setTrueFalsePayload(null);
    setMcqs([]);
    setMcqSetId("");
    setMcqVerdicts({});
    setVerifyingAnswers({});
    setFlashcards([]);
    setFillBlanks([]);
    setTrueFalse([]);
    setSummary("");
    setSummaryGenerating(false);
    setAudioLoading(false);
    setLoadingStudySet(false);
    setExamMock(null);
    setExamSyllabus("");
    setExamPast("");
    setExamSyllabusFile(null);
    setExamPastFile(null);
  };

  const getActiveSource = () => {
    if (sources.length > 0) {
      if (sources.length === 1) {
        return sources[0];
      }
      return { mode: "multi", sources };
    }
    if (inputMode === "file" && storedFileId) {
      return { mode: "file", fileId: storedFileId, label: storedFileName };
    }
    if (inputMode === "file" && uploadFile) {
      return { mode: "file", file: uploadFile, label: uploadFile.name };
    }
    if (inputMode === "text" && textValue.trim()) {
      return { mode: "text", text: textValue.trim() };
    }
    return null;
  };

  const handleAskRag = async () => {
    if (!ragQuestion.trim()) {
      toast.info("Type a question for the AI guide.");
      return;
    }
    const formData = buildRagFormData(ragQuestion.trim(), "text");
    if (!formData) return;
    setRagLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/qa/source`, { method: "POST", body: formData });
      const rawText = await response.text();
      let data = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch (_error) {
        data = null;
      }
      if (!response.ok) {
        const message = data?.error || rawText || "Failed to answer question";
        throw new Error(message);
      }
      setRagAnswer(String(data?.answer || rawText || "").trim() || "No answer returned.");
    } catch (error) {
      console.error(error);
      const message = getReadableErrorMessage(error, "Failed to answer question");
      setRagAnswer(message);
      toast.error(message);
    } finally {
      setRagLoading(false);
    }
  };

  const buildRagFormData = (question, mode = "text") => {
    const activeSource = getActiveSource();
    if (!activeSource) {
      toast.info("Add a source before asking.");
      return null;
    }
    const formData = new FormData();
    formData.append("question", question);
    formData.append("mode", mode);
    if (activeSource.mode === "file" && activeSource.fileId) {
      formData.append("fileId", activeSource.fileId);
    } else if (activeSource.mode === "file" && activeSource.file instanceof File) {
      formData.append("file", activeSource.file);
    } else if (activeSource.mode === "text" && activeSource.text) {
      formData.append("text", activeSource.text);
    }
    return formData;
  };

  const askVoiceQuestion = async () => {
    const q = String(voiceQuestion || "").trim();
    if (!q) {
      toast.info("Ask a question first");
      return;
    }
    const formData = buildRagFormData(q, "voice");
    if (!formData) return;
    try {
      setVoiceLoading(true);
      const response = await fetch(`${API_BASE}/api/qa/source`, { method: "POST", body: formData });
      const rawText = await response.text();
      let data = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch (_error) {
        data = null;
      }
      if (!response.ok) {
        const message = data?.error || rawText || "Failed to answer question";
        throw new Error(message);
      }
      const answerText = String(data?.answer || rawText || "").trim() || "No answer returned.";
      setVoiceAnswer(answerText);
      const ttsResponse = await fetch(`${API_BASE}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: answerText, language: ttsLanguage, translate: true }),
      });
      if (!ttsResponse.ok) {
        const err = await ttsResponse.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to generate audio");
      }
      const blob = await ttsResponse.blob();
      const url = URL.createObjectURL(blob);
      if (voiceAnswerAudioUrl) {
        URL.revokeObjectURL(voiceAnswerAudioUrl);
      }
      setVoiceAnswerAudioUrl(url);
    } catch (error) {
      console.error(error);
      toast.error(getReadableErrorMessage(error, "Failed to answer question"));
    } finally {
      setVoiceLoading(false);
    }
  };

  const handleToggleMic = () => {
    if (!recognizer) {
      toast.error("Speech Recognition is not supported in this browser");
      return;
    }
    if (listening) {
      recognizer.stop();
      setListening(false);
      return;
    }
    recognizer.lang = ttsLanguage === "hi" ? "hi-IN" : "en-US";
    try {
      recognizer.start();
      setListening(true);
    } catch (_error) {
      setListening(false);
    }
  };

  const openSourceModal = () => setSourceModalOpen(true);
  const closeSourceModal = () => setSourceModalOpen(false);

  const persistSourcesSnapshot = (list) => {
    const safeSources = Array.isArray(list)
      ? list
          .map((item) => {
            if (item?.mode === "text") {
              return {
                id: item.id,
                type: "text",
                mode: "text",
                label: item.label,
                text: item.text,
              };
            }
            if (item?.mode === "file" && item?.fileId) {
              return {
                id: item.id,
                type: "file",
                mode: "file",
                label: item.label,
                fileId: item.fileId,
              };
            }
            return null;
          })
          .filter(Boolean)
      : [];

    const savedRaw = sessionStorage.getItem("educator_study_set");
    let saved = {};
    if (savedRaw) {
      try {
        saved = JSON.parse(savedRaw) || {};
      } catch (_error) {
        saved = {};
      }
    }
    sessionStorage.setItem("educator_study_set", JSON.stringify({ ...saved, sources: safeSources }));
  };

  const addSourceFromModal = () => {
    if (!canGenerate) {
      toast.info("Add text or upload a file first");
      return;
    }
    if (inputMode === "file" && uploadFile && !storedFileId) {
      toast.info("Please wait for the file upload to finish, then add the source.");
      return;
    }
    const nextSource =
      inputMode === "file" && (uploadFile || storedFileId)
        ? {
            id: `${Date.now()}-file`,
            type: "file",
            mode: "file",
            label: storedFileName || uploadFile?.name || "File source",
            file: uploadFile || null,
            fileId: storedFileId || "",
          }
        : {
            id: `${Date.now()}-text`,
            type: "text",
            mode: "text",
            label: textValue.trim().slice(0, 80) || "Text source",
            text: textValue.trim(),
          };
    setSources((prev) => {
      const nextList = [nextSource, ...prev];
      persistSourcesSnapshot(nextList);
      return nextList;
    });
    setLastSource(
      nextSource.mode === "file"
        ? { mode: "file", file: nextSource.file, fileId: nextSource.fileId }
        : { mode: "text", text: nextSource.text }
    );
  
    setMcqReady(false);
    setFlashReady(false);
    setMcqPayload(null);
    setFlashPayload(null);
    resetGeneratedOutputs();
    persistSourceSession(
      nextSource.mode === "file" ? "file" : "text",
      nextSource.label,
      nextSource.mode === "text" ? nextSource.text : "",
      nextSource.mode === "file" ? nextSource.fileId : "",
      nextSource.mode === "file" ? nextSource.label : ""
    );
    closeSourceModal();
  };

  const buildStudySetPayload = (data) => {
    const sourceType = inputMode || (uploadFile || storedFileId ? "file" : "text");
    const sourcePreview =
      inputMode === "text" ? textValue.slice(0, 300) : storedFileName || uploadFile?.name || "";
    let difficultyByMode = {
      mcq: "medium",
      flashcards: "medium",
      true_false: "medium",
      fill_blanks: "medium",
    };
    try {
      const savedRaw = sessionStorage.getItem("educator_study_set");
      const saved = savedRaw ? JSON.parse(savedRaw) : null;
      if (saved?.difficultyByMode && typeof saved.difficultyByMode === "object") {
        difficultyByMode = { ...difficultyByMode, ...saved.difficultyByMode };
      }
    } catch (_error) {}
    let sourcesSnapshot = [];
    try {
      const savedRaw = sessionStorage.getItem("educator_study_set");
      const saved = savedRaw ? JSON.parse(savedRaw) : null;
      if (Array.isArray(saved?.sources)) {
        sourcesSnapshot = saved.sources;
      }
    } catch (_error) {}
    return {
      mcqs: Array.isArray(data?.mcqs) ? data.mcqs : [],
      flashcards: Array.isArray(data?.flashcards) ? data.flashcards : [],
      fillBlanks: Array.isArray(data?.fillBlanks) ? data.fillBlanks : [],
      trueFalse: Array.isArray(data?.trueFalse) ? data.trueFalse : [],
      summary: String(data?.summary || "").trim(),
      mcqSetId: data?.mcqSetId || "",
      sourceType,
      sourcePreview,
      sourceText: inputMode === "text" ? textValue : "",
      sourceFileId: storedFileId,
      sourceFileName: storedFileName,
      sources: sourcesSnapshot,
      difficultyByMode,
    };
  };

  useEffect(() => {
    const savedRaw = sessionStorage.getItem("educator_study_set");
    if (!savedRaw) return;
    if (
      mcqs.length ||
      flashcards.length ||
      fillBlanks.length ||
      trueFalse.length ||
      summary ||
      textValue ||
      uploadFile ||
      storedFileId
    )
      return;
    try {
      const saved = JSON.parse(savedRaw);
      const hasSavedSources = Array.isArray(saved?.sources) && saved.sources.length > 0;
      if (!sources.length && hasSavedSources) {
        setSources(saved.sources);
        const primary = saved.sources[0];
        if (primary?.mode === "text" && primary?.text) {
          setTextValue(String(primary.text));
          setInputMode("text");
          setLastSource({ mode: "text", text: String(primary.text) });
        } else if (primary?.mode === "file" && primary?.fileId) {
          setInputMode("file");
          setStoredFileId(String(primary.fileId));
          setStoredFileName(String(primary.label || "Uploaded file"));
          setLastSource({ mode: "file", fileId: String(primary.fileId), label: String(primary.label || "Uploaded file") });
        }
      }
      const restoredMcqs = Array.isArray(saved?.mcqs) ? saved.mcqs : [];
      const restoredFlashcards = Array.isArray(saved?.flashcards) ? saved.flashcards : [];
      const restoredFillBlanks = Array.isArray(saved?.fillBlanks) ? saved.fillBlanks : [];
      const restoredTrueFalse = Array.isArray(saved?.trueFalse) ? saved.trueFalse : [];
      const restoredSummary = String(saved?.summary || "").trim();
      const restoredMcqSetId = String(saved?.mcqSetId || "").trim();
      if (restoredMcqs.length) setMcqs(restoredMcqs);
      if (restoredFlashcards.length) setFlashcards(restoredFlashcards);
      if (restoredFillBlanks.length) setFillBlanks(restoredFillBlanks);
      if (restoredTrueFalse.length) setTrueFalse(restoredTrueFalse);
      if (restoredSummary) setSummary(restoredSummary);
      if (restoredMcqSetId) setMcqSetId(restoredMcqSetId);
      if (restoredMcqs.length) {
        setMcqReady(true);
        setMcqPayload({
          mcqs: restoredMcqs,
          flashcards: restoredFlashcards,
          fillBlanks: restoredFillBlanks,
          trueFalse: restoredTrueFalse,
          summary: restoredSummary,
          mcqSetId: restoredMcqSetId,
          sourceType: saved?.sourceType || "",
          sourcePreview: saved?.sourcePreview || "",
          sourceText: saved?.sourceText || "",
          sourceFileId: saved?.sourceFileId || "",
          sourceFileName: saved?.sourceFileName || "",
          difficultyByMode: saved?.difficultyByMode || undefined,
        });
      }
      if (restoredFlashcards.length) {
        setFlashReady(true);
        setFlashPayload({
          mcqs: restoredMcqs,
          flashcards: restoredFlashcards,
          fillBlanks: restoredFillBlanks,
          trueFalse: restoredTrueFalse,
          summary: restoredSummary,
          mcqSetId: restoredMcqSetId,
          sourceType: saved?.sourceType || "",
          sourcePreview: saved?.sourcePreview || "",
          sourceText: saved?.sourceText || "",
          sourceFileId: saved?.sourceFileId || "",
          sourceFileName: saved?.sourceFileName || "",
          difficultyByMode: saved?.difficultyByMode || undefined,
        });
      }
      if (restoredFillBlanks.length) {
        setFillBlanksReady(true);
        setFillBlanksPayload({
          mcqs: restoredMcqs,
          flashcards: restoredFlashcards,
          fillBlanks: restoredFillBlanks,
          trueFalse: restoredTrueFalse,
          summary: restoredSummary,
          mcqSetId: restoredMcqSetId,
          sourceType: saved?.sourceType || "",
          sourcePreview: saved?.sourcePreview || "",
          sourceText: saved?.sourceText || "",
          sourceFileId: saved?.sourceFileId || "",
          sourceFileName: saved?.sourceFileName || "",
          difficultyByMode: saved?.difficultyByMode || undefined,
        });
      }
      if (restoredTrueFalse.length) {
        setTrueFalseReady(true);
        setTrueFalsePayload({
          mcqs: restoredMcqs,
          flashcards: restoredFlashcards,
          fillBlanks: restoredFillBlanks,
          trueFalse: restoredTrueFalse,
          summary: restoredSummary,
          mcqSetId: restoredMcqSetId,
          sourceType: saved?.sourceType || "",
          sourcePreview: saved?.sourcePreview || "",
          sourceText: saved?.sourceText || "",
          sourceFileId: saved?.sourceFileId || "",
          sourceFileName: saved?.sourceFileName || "",
          difficultyByMode: saved?.difficultyByMode || undefined,
        });
      }
      if (!hasSavedSources && saved?.sourceType === "text" && saved?.sourceText) {
        setTextValue(String(saved.sourceText));
        setInputMode("text");
        setLastSource({ mode: "text", text: String(saved.sourceText) });
        if (!sources.length) {
          setSources([
            {
              id: `${Date.now()}-text`,
              type: "text",
              mode: "text",
              label: String(saved.sourceText).slice(0, 80) || "Text source",
              text: String(saved.sourceText),
            },
          ]);
        }
      } else if (!hasSavedSources && saved?.sourceType === "file" && saved?.sourceFileId) {
        setInputMode("file");
        setStoredFileId(String(saved.sourceFileId));
        setStoredFileName(String(saved.sourceFileName || saved.sourcePreview || "Uploaded file"));
        setLastSource({
          mode: "file",
          fileId: String(saved.sourceFileId),
          label: String(saved.sourceFileName || saved.sourcePreview || "Uploaded file"),
        });
        if (!sources.length) {
          setSources([
            {
              id: `${Date.now()}-file`,
              type: "file",
              mode: "file",
              label: String(saved.sourceFileName || saved.sourcePreview || "Uploaded file"),
              file: null,
              fileId: String(saved.sourceFileId),
            },
          ]);
        }
      }
    } catch (_error) {
      // ignore corrupt session
    }
  }, [
    mcqs.length,
    flashcards.length,
    fillBlanks.length,
    trueFalse.length,
    summary,
    textValue,
    uploadFile,
    storedFileId,
    sources.length,
  ]);

  const handleGenerateMcqs = async () => {
    if (!canGenerate) {
      toast.info("Enter text or upload a file first");
      return;
    }
    try {
      setMcqGenerating(true);
      const activeSource = getActiveSource();
      const savedRaw = sessionStorage.getItem("educator_study_set");
      let difficulty = "medium";
      if (savedRaw) {
        try {
          const saved = JSON.parse(savedRaw);
          difficulty = String(saved?.difficultyByMode?.mcq || "medium");
        } catch (_error) {}
      }
      const data = await generateWithTool({ tool: "mcq", source: activeSource, difficulty, count: 20 });
      const normalizeArray = (value) => {
        if (Array.isArray(value)) return value;
        if (typeof value === "string") {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
          } catch (_error) {
            return [];
          }
        }
        return [];
      };
      const mcqItems = normalizeArray(data?.mcqs);
      if (mcqItems.length === 0) {
        throw new Error("Server returned no MCQs");
      }
      const payload = buildStudySetPayload({
        mcqs: mcqItems,
        flashcards,
        fillBlanks,
        trueFalse,
        summary,
        mcqSetId: data?.mcqSetId || mcqSetId || "",
      });
      sessionStorage.setItem("educator_study_set", JSON.stringify(payload));
      setMcqPayload(payload);
      setMcqReady(true);
      toast.success("MCQs generated. Click View to open.");
    } catch (error) {
      console.error(error);
      toast.error(getReadableErrorMessage(error, "Failed to generate MCQs"));
    } finally {
      setMcqGenerating(false);
    }
  };

  const handleGenerateFlashcards = async () => {
    if (!canGenerate) {
      toast.info("Enter text or upload a file first");
      return;
    }
    try {
      setFlashGenerating(true);
      const activeSource = getActiveSource();
      const savedRaw = sessionStorage.getItem("educator_study_set");
      let difficulty = "medium";
      if (savedRaw) {
        try {
          const saved = JSON.parse(savedRaw);
          difficulty = String(saved?.difficultyByMode?.flashcards || "medium");
        } catch (_error) {}
      }
      const data = await generateWithTool({ tool: "flashcards", source: activeSource, difficulty, count: 20 });
      const normalizeArray = (value) => {
        if (Array.isArray(value)) return value;
        if (typeof value === "string") {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
          } catch (_error) {
            return [];
          }
        }
        return [];
      };
      const flashItems = normalizeArray(data?.flashcards);
      if (flashItems.length === 0) {
        throw new Error("Server returned no flashcards");
      }
      const payload = buildStudySetPayload({
        mcqs,
        flashcards: flashItems,
        fillBlanks,
        trueFalse,
        summary,
        mcqSetId,
      });
      sessionStorage.setItem("educator_study_set", JSON.stringify(payload));
      setFlashPayload(payload);
      setFlashReady(true);
      toast.success("Flashcards generated. Click View to open.");
    } catch (error) {
      console.error(error);
      toast.error(getReadableErrorMessage(error, "Failed to generate flashcards"));
    } finally {
      setFlashGenerating(false);
    }
  };

  const handleGenerateFillBlanks = async () => {
    if (fillBlanksReady) {
      handleViewFillBlanks();
      return;
    }
    if (!canGenerate) {
      toast.info("Enter text or upload a file first");
      return;
    }
    try {
      setFillBlanksGenerating(true);
      const activeSource = getActiveSource();
      const savedRaw = sessionStorage.getItem("educator_study_set");
      let difficulty = "medium";
      if (savedRaw) {
        try {
          const saved = JSON.parse(savedRaw);
          difficulty = String(saved?.difficultyByMode?.fill_blanks || "medium");
        } catch (_error) {}
      }
      const data = await generateWithTool({ tool: "fill_blanks", source: activeSource, difficulty, count: 20 });
      const items = Array.isArray(data?.fillBlanks) ? data.fillBlanks : [];
      if (items.length === 0) {
        throw new Error("Server returned no fill-in-the-blanks");
      }
      setFillBlanks(items);
      const payload = buildStudySetPayload({
        mcqs,
        flashcards,
        fillBlanks: items,
        trueFalse,
        summary,
        mcqSetId,
      });
      sessionStorage.setItem("educator_study_set", JSON.stringify(payload));
      setFillBlanksPayload(payload);
      setFillBlanksReady(true);
      toast.success("Fill-in-the-blanks generated. Click to open.");
    } catch (error) {
      console.error(error);
      toast.error(getReadableErrorMessage(error, "Failed to generate fill-in-the-blanks"));
    } finally {
      setFillBlanksGenerating(false);
    }
  };

  const handleGenerateTrueFalse = async () => {
    if (trueFalseReady) {
      handleViewTrueFalse();
      return;
    }
    if (!canGenerate) {
      toast.info("Enter text or upload a file first");
      return;
    }
    try {
      setTrueFalseGenerating(true);
      const activeSource = getActiveSource();
      const savedRaw = sessionStorage.getItem("educator_study_set");
      let difficulty = "medium";
      if (savedRaw) {
        try {
          const saved = JSON.parse(savedRaw);
          difficulty = String(saved?.difficultyByMode?.true_false || "medium");
        } catch (_error) {}
      }
      const data = await generateWithTool({ tool: "true_false", source: activeSource, difficulty, count: 20 });
      const items = Array.isArray(data?.trueFalse) ? data.trueFalse : [];
      if (items.length === 0) {
        throw new Error("Server returned no true/false questions");
      }
      setTrueFalse(items);
      const payload = buildStudySetPayload({
        mcqs,
        flashcards,
        fillBlanks,
        trueFalse: items,
        summary,
        mcqSetId,
      });
      sessionStorage.setItem("educator_study_set", JSON.stringify(payload));
      setTrueFalsePayload(payload);
      setTrueFalseReady(true);
      toast.success("True/False generated. Click to open.");
    } catch (error) {
      console.error(error);
      toast.error(getReadableErrorMessage(error, "Failed to generate true/false"));
    } finally {
      setTrueFalseGenerating(false);
    }
  };

  const handleViewMcqs = () => {
    if (!mcqPayload) return;
    navigate("/mcqs", { state: mcqPayload });
  };

  const handleViewFlashcards = () => {
    if (!flashPayload) return;
    navigate("/flashcards", { state: flashPayload });
  };

  const handleViewFillBlanks = () => {
    if (!fillBlanksPayload) return;
    navigate("/fill-blanks", { state: fillBlanksPayload });
  };

  const handleViewTrueFalse = () => {
    if (!trueFalsePayload) return;
    navigate("/true-false", { state: trueFalsePayload });
  };

  const handleViewSummary = () => {
    if (!hasSummary) return;
    const payload = buildStudySetPayload({
      mcqs,
      flashcards,
      fillBlanks,
      trueFalse,
      summary,
      mcqSetId,
    });
    sessionStorage.setItem("educator_study_set", JSON.stringify(payload));
    navigate("/summary", { state: payload });
  };

  const handleGenerateSummary = async () => {
    if (hasSummary) {
      handleViewSummary();
      return;
    }
    if (!canGenerate) {
      toast.info("Enter text or upload a file first");
      return;
    }
    try {
      setSummaryGenerating(true);
      const activeSource = getActiveSource();
      const data = await generateWithTool({ tool: "summary", source: activeSource, difficulty: "medium", count: 20 });
      const nextSummary = String(data?.summary || "").trim();
      setSummary(nextSummary);
      const payload = buildStudySetPayload({
        mcqs,
        flashcards,
        fillBlanks,
        trueFalse,
        summary: nextSummary,
        mcqSetId,
      });
      sessionStorage.setItem("educator_study_set", JSON.stringify(payload));
      toast.success("Summary generated");
    } catch (error) {
      console.error(error);
      toast.error(getReadableErrorMessage(error, "Failed to generate summary"));
    } finally {
      setSummaryGenerating(false);
    }
  };

  const handleRemoveSource = (id) => {
    setSources((prev) => {
      const next = prev.filter((item) => item.id !== id);
      if (next.length === 0) {
        resetGeneratedOutputs();
        setTextValue("");
        setUploadFile(null);
        setStoredFileId("");
        setStoredFileName("");
        setInputMode("");
        setRagQuestion("");
        setRagAnswer("");
        setVoiceQuestion("");
        setVoiceAnswer("");
        setVoiceAnswerAudioUrl("");
        setListening(false);
        setLastSource(null);
        sessionStorage.removeItem("educator_study_set");
        sessionStorage.removeItem("educator_exam_mock");
        setExamMock(null);
        setExamSyllabus("");
        setExamPast("");
      }
      if (next.length > 0) {
        persistSourcesSnapshot(next);
      }
      return next;
    });
  };

  const handleSpeakSummary = () => {
    if (!summary) {
      toast.info("Summary is empty");
      return "";
    }
    return handleGenerateAudio();
  };

  const handleGenerateAudio = async () => {
    if (!summary) {
      toast.info("Summary is empty");
      return "";
    }
    try {
      setAudioLoading(true);
      const response = await fetch(`${API_BASE}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: summary, language: ttsLanguage, translate: true }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to generate audio");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      setAudioUrl(url);
      toast.success("Audio generated");
      return url;
    } catch (error) {
      console.error(error);
      toast.error(getReadableErrorMessage(error, "Failed to generate audio"));
      return "";
    } finally {
      setAudioLoading(false);
    }
  };

  const handleGenerateMockExam = async () => {
    const activeSource = getActiveSource();
    const syllabusText = examSyllabus.trim() || textValue.trim();
    const hasSyllabusFile = !!examSyllabusFile;
    const hasPastFile = !!examPastFile;
    if (!syllabusText && !hasSyllabusFile && !activeSource) {
      toast.info("Add a syllabus (text or file) or upload a source to generate the mock exam");
      return;
    }
    try {
      setExamGenerating(true);
      let response;
      if (syllabusText && !hasSyllabusFile && !hasPastFile) {
        response = await fetch(`${API_BASE}/api/exam/mock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            syllabus: syllabusText,
            pastPapers: examPast.trim(),
            totalQuestions: Number(examQuestions) || 20,
            durationMinutes: Number(examDuration) || 60,
          }),
        });
      } else {
        const formData = new FormData();
        formData.append("pastPapers", examPast.trim());
        formData.append("totalQuestions", Number(examQuestions) || 20);
        formData.append("durationMinutes", Number(examDuration) || 60);
        if (hasSyllabusFile) {
          formData.append("file", examSyllabusFile);
          formData.append("mode", "file");
        } else if (syllabusText) {
          formData.append("syllabus", syllabusText);
        } else if (activeSource?.mode === "file" && activeSource.fileId) {
          formData.append("fileId", activeSource.fileId);
          formData.append("mode", "file");
        } else if (activeSource?.mode === "file" && activeSource.file instanceof File) {
          formData.append("file", activeSource.file);
          formData.append("mode", "file");
        } else if (activeSource?.mode === "text" && activeSource.text) {
          formData.append("text", activeSource.text);
          formData.append("mode", "text");
        }
        if (hasPastFile) {
          formData.append("pastFile", examPastFile);
        }
        if (activeSource?.mode === "file" && activeSource.fileId) {
          formData.append("fileId", activeSource.fileId);
          formData.append("mode", "file");
        } else if (activeSource?.mode === "file" && activeSource.file instanceof File) {
          formData.append("file", activeSource.file);
          formData.append("mode", "file");
        } else if (activeSource?.mode === "text" && activeSource.text) {
          formData.append("text", activeSource.text);
          formData.append("mode", "text");
        }
        response = await fetch(`${API_BASE}/api/exam/mock`, { method: "POST", body: formData });
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
      setExamMock(nextMock);
      sessionStorage.setItem("educator_exam_mock", JSON.stringify(nextMock || {}));
      toast.success("Mock exam ready");
      navigate("/exam-mock", { state: { mockExam: nextMock } });
    } catch (error) {
      console.error(error);
      toast.error(getReadableErrorMessage(error, "Failed to generate mock exam"));
    } finally {
      setExamGenerating(false);
    }
  };

  const getExportFilename = (response, format) => {
    const fallback = `study_set.${format === "quiz" ? "quiz.txt" : format}`;
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="([^"]+)"/i);
    return match?.[1] || fallback;
  };

  const handleExport = async (format) => {
    if (!hasResults) {
      toast.info("Generate study content first");
      return;
    }
    try {
      setExportingFormat(format);
      const response = await fetch(`${API_BASE}/api/export/study-set/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "educator_study_set",
          mcqs,
          flashcards,
          summary,
        }),
      });

      if (!response.ok) {
        let message = "Export failed";
        try {
          const data = await response.json();
          message = data?.error || message;
        } catch (_error) {
          const text = await response.text();
          if (text) {
            message = text;
          }
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const filename = getExportFilename(response, format);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${filename}`);
    } catch (error) {
      console.error(error);
      toast.error(getReadableErrorMessage(error, "Export failed"));
    } finally {
      setExportingFormat("");
    }
  };

  return (
    <main className="upload-page">
      <div className="home-bots" aria-hidden="true">
        <div className="boat-group">
          <img src="/blue.png" alt="" className="bot boat boat-blue" />
        </div>
      </div>
      <section className="upload-card upload-layout notebook-shell">
        <header className="upload-header">
          <button type="button" className="history-btn" onClick={() => navigate("/history")}>
            History
          </button>
          <h1>{displayName}, Welcome!! Here is the EduCator workspace</h1>
        </header>

        <div className="notebook-grid">
          <section className="notebook-card notebook-sources">
            <div className="card-header">
              <h2 className="card-title">Sources</h2>
            </div>
            <p className="card-subtitle">Add text, PDF, or docs to build a knowledge base.</p>
            <div className="notebook-card-body">
              <div className="sources-body">
                <div className="sources-empty">
                  <p>Click "Add source" to upload text or a file.</p>
                  <button type="button" className="add-source-btn" onClick={openSourceModal}>
                    + Add source
                  </button>
                </div>
                {sources.length > 0 && (
                  <ul className="sources-list">
                    {sources.map((item) => (
                      <li key={item.id} className="sources-item">
                        <span className="sources-type">{item.type === "file" ? "File" : "Text"}</span>
                        <span className="sources-label">{item.label}</span>
                        <button type="button" className="source-remove-btn" onClick={() => handleRemoveSource(item.id)}>
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <section className="notebook-card notebook-chat">
            <div className="card-header">
              <h2 className="card-title">AI Guide</h2>
              <div className="ai-guide-mode-toggle" aria-label="AI mode toggle">
                <label className={`ai-guide-mode-option ${aiGuideMode === "text" ? "active" : ""}`} title="Text chat">
                  <span className="sr-only">Text chat</span>
                  <input
                    type="radio"
                    name="ai-guide-mode"
                    value="text"
                    checked={aiGuideMode === "text"}
                    onChange={() => setAiGuideMode("text")}
                    aria-label="Text chat"
                  />
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path
                      fill="currentColor"
                      d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9.8L5.5 21.7A1 1 0 0 1 4 21V18H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v10h1a1 1 0 0 1 1 1v1.6L9 16h11V6H4z"
                    />
                  </svg>
                </label>
                <label className={`ai-guide-mode-option ${aiGuideMode === "voice" ? "active" : ""}`} title="Voice">
                  <span className="sr-only">Voice</span>
                  <input
                    type="radio"
                    name="ai-guide-mode"
                    value="voice"
                    checked={aiGuideMode === "voice"}
                    onChange={() => setAiGuideMode("voice")}
                    aria-label="Voice"
                  />
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path
                      fill="currentColor"
                      d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a1 1 0 1 0-2 0 3 3 0 1 1-6 0 1 1 0 1 0-2 0 5 5 0 0 0 4 4.9V19H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-3.1A5 5 0 0 0 17 11z"
                    />
                  </svg>
                </label>
              </div>
            </div>
            <p className="card-subtitle">Ask questions grounded in your uploaded sources.</p>
            <div className="notebook-card-body">
              {aiGuideMode === "voice" ? (
                <VoiceQASection
                  question={voiceQuestion}
                  onQuestionChange={setVoiceQuestion}
                  onAsk={askVoiceQuestion}
                  answer={voiceAnswer}
                  loading={voiceLoading}
                  listening={listening}
                  onToggleMic={handleToggleMic}
                  audioUrl={voiceAnswerAudioUrl}
                />
              ) : (
                <>
                  <div className="rag-input">
                    <input
                      type="text"
                      value={ragQuestion}
                      onChange={(event) => setRagQuestion(event.target.value)}
                      placeholder="Ask anything about your sources..."
                      disabled={ragLoading}
                    />
                    <button type="button" onClick={handleAskRag} disabled={ragLoading}>
                      {ragLoading ? "Asking..." : "Ask"}
                    </button>
                  </div>
                  <div className="rag-answer">
                    {ragAnswer
                      ? ragAnswer
                      : ragLoading
                      ? "Thinking..."
                      : "Upload a source and ask a question to get a guided response."}
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="notebook-card notebook-tools">
            <div className="card-header">
              <h2 className="card-title">Tools</h2>
            </div>
            <p className="card-subtitle">Summaries, MCQs, flashcards, fill-in-the-blanks, and true/false.</p>
            <div className="notebook-card-body tools-stack">
              <div className="tool-actions">
                <button
                  type="button"
                  className={`tool-action-card ${mcqReady ? "tool-action-ready" : ""}`}
                  onClick={mcqReady ? handleViewMcqs : handleGenerateMcqs}
                  disabled={
                    mcqReady
                      ? !mcqPayload
                      : !canGenerate ||
                        loadingStudySet ||
                        mcqGenerating ||
                        flashGenerating ||
                        fillBlanksGenerating ||
                        trueFalseGenerating ||
                        summaryGenerating
                  }
                >
                  <span className="tool-action-title">
                    {mcqReady ? "MCQs Ready" : mcqGenerating ? "Generating MCQs..." : "MCQs"}
                  </span>
                  <span className="tool-action-subtitle">
                    {mcqReady ? "Click to open your generated questions" : "Auto-create questions from sources"}
                  </span>
                  {!mcqReady && mcqGenerating && <span className="tool-action-spinner" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  className={`tool-action-card ${flashReady ? "tool-action-ready" : ""}`}
                  onClick={flashReady ? handleViewFlashcards : handleGenerateFlashcards}
                  disabled={
                    flashReady
                      ? !flashPayload
                      : !canGenerate ||
                        loadingStudySet ||
                        flashGenerating ||
                        mcqGenerating ||
                        fillBlanksGenerating ||
                        trueFalseGenerating
                  }
                >
                  <span className="tool-action-title">
                    {flashReady ? "Flashcards Ready" : flashGenerating ? "Generating Flashcards..." : "Flashcards"}
                  </span>
                  <span className="tool-action-subtitle">
                    {flashReady ? "Click to open your flashcards" : "Create quick recall cards"}
                  </span>
                  {flashGenerating && <span className="tool-action-spinner" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  className={`tool-action-card ${fillBlanksReady ? "tool-action-ready" : ""}`}
                  onClick={fillBlanksReady ? handleViewFillBlanks : handleGenerateFillBlanks}
                  disabled={
                    fillBlanksReady
                      ? !fillBlanksPayload
                      : !canGenerate ||
                        loadingStudySet ||
                        fillBlanksGenerating ||
                        mcqGenerating ||
                        flashGenerating ||
                        trueFalseGenerating ||
                        summaryGenerating
                  }
                >
                  <span className="tool-action-title">
                    {fillBlanksReady
                      ? "Fill Blanks Ready"
                      : fillBlanksGenerating
                      ? "Generating Fill Blanks..."
                      : "Fill in the Blanks"}
                  </span>
                  <span className="tool-action-subtitle">
                    {fillBlanksReady ? "Click to open your blanks" : "Practice key facts quickly"}
                  </span>
                  {!fillBlanksReady && fillBlanksGenerating && (
                    <span className="tool-action-spinner" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  className={`tool-action-card ${trueFalseReady ? "tool-action-ready" : ""}`}
                  onClick={trueFalseReady ? handleViewTrueFalse : handleGenerateTrueFalse}
                  disabled={
                    trueFalseReady
                      ? !trueFalsePayload
                      : !canGenerate ||
                        loadingStudySet ||
                        trueFalseGenerating ||
                        mcqGenerating ||
                        flashGenerating ||
                        fillBlanksGenerating ||
                        summaryGenerating
                  }
                >
                  <span className="tool-action-title">
                    {trueFalseReady
                      ? "True / False Ready"
                      : trueFalseGenerating
                      ? "Generating True / False..."
                      : "True and False"}
                  </span>
                  <span className="tool-action-subtitle">
                    {trueFalseReady ? "Click to open your true/false questions" : "Fast check: true or false"}
                  </span>
                  {!trueFalseReady && trueFalseGenerating && (
                    <span className="tool-action-spinner" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  className={`tool-action-card ${hasSummary ? "tool-action-ready" : ""}`}
                  onClick={handleGenerateSummary}
                  disabled={
                    summaryGenerating ||
                    (!hasSummary && !canGenerate) ||
                    mcqGenerating ||
                    flashGenerating ||
                    fillBlanksGenerating ||
                    trueFalseGenerating
                  }
                >
                  <span className="tool-action-title">
                    {hasSummary ? "Summary Ready" : summaryGenerating ? "Generating Summary..." : "Summary"}
                  </span>
                  <span className="tool-action-subtitle">
                    {hasSummary ? "Click to open your generated summary" : "Generate a summary from your source"}
                  </span>
                  {summaryGenerating && <span className="tool-action-spinner" aria-hidden="true" />}
                </button>
              </div>
              <div className="mock-exam-panel">
                <div className="mock-exam-header">
                  <div>
                    <h3>Exam Blueprint / Mock Test</h3>
                    <p>Paste syllabus and (optionally) past papers. We will bias questions per section and timebox.</p>
                  </div>
                  <button
                    type="button"
                    className="primary-action-btn"
                    onClick={() => setExamModalOpen(true)}
                  >
                    Open
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="workspace-actions">
          <div className="workspace-primary-actions">
            <button
              type="button"
              className="save-session-btn primary-action-btn"
              onClick={handleSaveSessionOnly}
              disabled={savingSession || !hasSource}
            >
              {savingSession ? "Saving..." : "Save Session"}
            </button>
            <button
              type="button"
              className="save-session-btn primary-action-btn"
              onClick={handleGenerateOtherSource}
            >
              Generate New Source Content
            </button>
          </div>
        </div>
      </section>

      {sourceModalOpen && (
        <div className="modal-overlay" role="presentation" onClick={closeSourceModal}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-source-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" onClick={closeSourceModal} aria-label="Close">
              x
            </button>
            <header className="modal-header">
              <h2 id="add-source-title">Add a Source</h2>
              <p>Upload text or a file to build your knowledge base.</p>
            </header>
            <div className="modal-body">
              <InputSection
                textValue={textValue}
                onTextChange={handleTextChange}
                uploadFile={uploadFile}
                uploadFileName={storedFileName}
                onFileChange={handleFileChange}
                canUseText={canUseText}
                canUseFile={canUseFile}
              />
              <div className="modal-actions">
                <button type="button" className="ghost-btn" onClick={closeSourceModal}>
                  Cancel
                </button>
                <button type="button" onClick={addSourceFromModal} disabled={!canGenerate}>
                  Add Source
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {examModalOpen && (
        <div className="modal-overlay" role="presentation" onClick={() => setExamModalOpen(false)}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="exam-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" onClick={() => setExamModalOpen(false)} aria-label="Close">
              x
            </button>
            <header className="modal-header">
              <h2 id="exam-modal-title">Exam Blueprint / Mock Test</h2>
              <p>Upload syllabus and past papers, or paste text. We will generate a timed mock exam.</p>
            </header>
            <div className="modal-body exam-modal-body">
              <div className="field">
                <span>Syllabus text</span>
                <textarea
                  value={examSyllabus}
                  onChange={(e) => setExamSyllabus(e.target.value)}
                  placeholder="Paste syllabus bullets or learning objectives..."
                  rows={4}
                />
              </div>
              <div className="field">
                <span>Syllabus file (pdf/docx/pptx/txt)</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.pptx,.txt"
                  onChange={(e) => setExamSyllabusFile(e.target.files?.[0] || null)}
                />
                {examSyllabusFile && <p className="file-hint">Using: {examSyllabusFile.name}</p>}
              </div>
              <div className="field">
                <span>Past papers text (optional)</span>
                <textarea
                  value={examPast}
                  onChange={(e) => setExamPast(e.target.value)}
                  placeholder="Paste question stems or previous papers..."
                  rows={3}
                />
              </div>
              <div className="field">
                <span>Past papers file (optional)</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.pptx,.txt"
                  onChange={(e) => setExamPastFile(e.target.files?.[0] || null)}
                />
                {examPastFile && <p className="file-hint">Using: {examPastFile.name}</p>}
              </div>
              <div className="mock-exam-controls">
                <label>
                  Total questions
                  <input
                    type="number"
                    min="5"
                    max="80"
                    value={examQuestions}
                    onChange={(e) => setExamQuestions(e.target.value)}
                  />
                </label>
                <label>
                  Duration (minutes)
                  <input
                    type="number"
                    min="20"
                    max="240"
                    value={examDuration}
                    onChange={(e) => setExamDuration(e.target.value)}
                  />
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setExamModalOpen(false)}>
                Cancel
              </button>
              <button type="button" onClick={() => { setExamModalOpen(false); handleGenerateMockExam(); }} disabled={examGenerating}>
                {examGenerating ? "Generating..." : "Generate Mock Exam"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default UploadPage;
