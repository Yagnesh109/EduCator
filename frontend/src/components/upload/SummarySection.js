import { useEffect, useRef, useState } from "react";
import { API_BASE } from "../../config/api";

function SummarySection({
  summary,
  onSpeak,
  audioLoading,
  onGenerateAudio,
  audioUrl,
  ttsLanguage,
  onTtsLanguageChange,
  ttsLanguages,
}) {
  const audioRef = useRef(null);
  const autoplayPendingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [displaySummary, setDisplaySummary] = useState(summary);
  const translateCacheRef = useRef({});
  const abortRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return undefined;
    }
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (audioUrl && autoplayPendingRef.current && audioRef.current) {
      audioRef.current.play().catch(() => {});
      autoplayPendingRef.current = false;
    }
  }, [audioUrl]);

  useEffect(() => {
    const base = String(summary || "");
    if (!base.trim()) {
      setDisplaySummary("");
      return undefined;
    }

    const lang = String(ttsLanguage || "en").trim().toLowerCase() || "en";
    if (lang === "en") {
      setDisplaySummary(base);
      return undefined;
    }

    if (translateCacheRef.current[lang]) {
      setDisplaySummary(translateCacheRef.current[lang]);
      return undefined;
    }

    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch (_error) {}
    }
    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: base, targetLanguage: lang }),
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || "Translation failed");
        }
        const translated = String(data?.text || "").trim() || base;
        translateCacheRef.current[lang] = translated;
        setDisplaySummary(translated);
      } catch (error) {
        if (error?.name === "AbortError") return;
        setDisplaySummary(base);
      }
    })();

    return () => {
      try {
        controller.abort();
      } catch (_error) {}
    };
  }, [summary, ttsLanguage]);

  if (!summary) {
    return null;
  }

  const handleSpeakClick = async () => {
    if (audioLoading) {
      return;
    }
    if (audioUrl && audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
      return;
    }
    if (onSpeak) {
      autoplayPendingRef.current = true;
      const nextUrl = await onSpeak();
      if (nextUrl && audioRef.current) {
        audioRef.current.play().catch(() => {});
        autoplayPendingRef.current = false;
      }
    } else if (onGenerateAudio) {
      autoplayPendingRef.current = true;
      const nextUrl = await onGenerateAudio();
      if (nextUrl && audioRef.current) {
        audioRef.current.play().catch(() => {});
        autoplayPendingRef.current = false;
      }
    }
  };

  const handleDownload = () => {
    if (!audioUrl) {
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = audioUrl;
    anchor.download = "summary-audio.mp3";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  return (
    <section className="result-section">
      <div className="summary-header">
        <h3>Summary</h3>
        <div className="summary-actions">
          <button type="button" className="summary-speak-btn" onClick={handleSpeakClick} disabled={audioLoading}>
            {audioLoading ? "Preparing Audio..." : isPlaying ? "Pause" : "Speak"}
          </button>
          {audioUrl && (
            <button type="button" className="summary-download-btn" onClick={handleDownload}>
              Download Audio
            </button>
          )}
        </div>
      </div>
      <div className="summary-controls">
        <label htmlFor="tts-language">Language</label>
        <select id="tts-language" value={ttsLanguage} onChange={(event) => onTtsLanguageChange(event.target.value)}>
          {(ttsLanguages || []).map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <pre className="summary-text">{displaySummary}</pre>
      {audioUrl && (
        <div className="summary-audio">
          <audio ref={audioRef} controls src={audioUrl} />
        </div>
      )}
    </section>
  );
}

export default SummarySection;
