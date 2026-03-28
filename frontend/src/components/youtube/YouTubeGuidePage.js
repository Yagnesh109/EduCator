import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { API_BASE } from "../../config/api";
import "./YouTubeGuidePage.css";
import usePremium from "../../premium/usePremium";
import UpgradeNotice from "../premium/UpgradeNotice";
import { auth } from "../../firebase";

function YouTubeGuidePage() {
  const navigate = useNavigate();
  const premium = usePremium();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState([]);
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [filterText, setFilterText] = useState("");

  const savedStudySet = useMemo(() => {
    try {
      const raw = localStorage.getItem("educator_study_set") || sessionStorage.getItem("educator_study_set");
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }, []);

  const getReadableErrorMessage = (err, fallbackMessage) => {
    const raw = String(err?.message || "").toLowerCase();
    if (raw.includes("failed to fetch") || raw.includes("networkerror") || raw.includes("load failed")) {
      return `Cannot reach backend at ${API_BASE}. Start backend server and verify CORS/API URL.`;
    }
    return err?.message || fallbackMessage;
  };

  const embedUrl = useMemo(() => {
    const id = String(selectedVideoId || "").trim();
    if (!id) return "";
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
  }, [selectedVideoId]);

  const selectedVideo = useMemo(() => {
    const id = String(selectedVideoId || "").trim();
    if (!id) return null;
    return videos.find((video) => String(video?.videoId || "") === id) || null;
  }, [selectedVideoId, videos]);

  const openUrl = useMemo(() => {
    const id = String(selectedVideoId || "").trim();
    if (!id) return "";
    return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  }, [selectedVideoId]);

  const filteredVideos = useMemo(() => {
    const q = String(filterText || "").trim().toLowerCase();
    if (!q) return videos;
    return videos.filter((video) => {
      const title = String(video?.title || "").toLowerCase();
      const channel = String(video?.channelTitle || "").toLowerCase();
      return title.includes(q) || channel.includes(q);
    });
  }, [filterText, videos]);

  const buildFormData = () => {
    const formData = new FormData();
    formData.append("maxResults", "10");

    const snapshot = savedStudySet;
    const sources = Array.isArray(snapshot?.sources) ? snapshot.sources : [];

    if (sources.length > 0) {
      for (const item of sources) {
        if (item?.mode === "text" && item?.text) {
          formData.append("text", String(item.text));
        }
        if (item?.mode === "file" && item?.fileId) {
          formData.append("fileId", String(item.fileId));
        }
      }
      return formData;
    }

    const sourceText = String(snapshot?.sourceText || "").trim();
    const sourceFileId = String(snapshot?.sourceFileId || "").trim();
    if (sourceText) {
      formData.append("text", sourceText);
      return formData;
    }
    if (sourceFileId) {
      formData.append("fileId", sourceFileId);
      return formData;
    }

    return null;
  };

  const fetchRecommendations = async () => {
    const formData = buildFormData();
    if (!formData) {
      toast.info("Add a source in Upload first.");
      navigate("/uplod");
      return;
    }

    setLoading(true);
    setError("");
    try {
      // Note: This endpoint is premium-gated on backend.
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
      const response = await fetch(`${API_BASE}/api/youtube/recommend`, {
        method: "POST",
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const raw = await response.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch (_error) {
        data = null;
      }
      if (!response.ok) {
        throw new Error(data?.error || raw || "Failed to load YouTube recommendations");
      }

      const nextQuery = String(data?.query || "").trim();
      const nextVideos = Array.isArray(data?.videos) ? data.videos : [];
      setQuery(nextQuery);
      setVideos(nextVideos);
      setSelectedVideoId(nextVideos[0]?.videoId ? String(nextVideos[0].videoId) : "");

      if (nextVideos.length === 0) {
        setError("No videos found for your source. Try adding more content or a different source.");
      }
    } catch (err) {
      console.error(err);
      setError(getReadableErrorMessage(err, "Failed to load YouTube recommendations"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!premium.canUse("youtube_guide")) return;
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premium]);

  if (!premium.canUse("youtube_guide")) {
    return (
      <main className="youtube-guide-page">
        <section className="notebook-shell">
          <div className="notebook-grid notebook-grid-full">
            <section className="notebook-card">
              <div className="card-header">
                <h2 className="card-title">YouTube Guide</h2>
                <div className="card-actions">
                  <button type="button" className="ghost-btn" onClick={() => navigate("/uplod")}>
                    Back
                  </button>
                </div>
              </div>
              <p className="card-subtitle">This is a Premium feature.</p>
              <div className="notebook-card-body youtube-guide-body">
                <UpgradeNotice title="YouTube Guide" message="Upgrade to Platinum to unlock YouTube recommendations." />
              </div>
            </section>
          </div>
        </section>
      </main>
    );
  }

  const handleCopyLink = async () => {
    if (!openUrl) {
      toast.info("Pick a video first.");
      return;
    }
    try {
      await navigator.clipboard.writeText(openUrl);
      toast.success("Link copied.");
    } catch (_error) {
      toast.info("Copy not available in this browser.");
    }
  };

  return (
    <main className="youtube-guide-page">
      <section className="notebook-shell">
        <div className="notebook-grid notebook-grid-full">
          <section className="notebook-card">
            <div className="card-header">
              <h2 className="card-title">YouTube Guide</h2>
              <div className="card-actions">
                <button type="button" className="ghost-btn" onClick={() => navigate("/uplod")}>
                  Back
                </button>
                <button type="button" className="primary-action-btn" onClick={fetchRecommendations} disabled={loading}>
                  {loading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>
            <p className="card-subtitle">Recommendations based on your uploaded source.</p>

            <div className="notebook-card-body youtube-guide-body">
              {query ? <div className="youtube-guide-hint">Based on: {query}</div> : null}
              {loading && <div className="rag-answer">Finding the best videos...</div>}
              {!loading && error ? <div className="rag-answer">{error}</div> : null}

              {!loading && !error && (
                <div className="youtube-guide-layout">
                  <div className="youtube-guide-player">
                    <div className="youtube-guide-viewer">
                      <div className="youtube-guide-aspect">
                        {embedUrl ? (
                          <iframe
                            className="youtube-guide-frame"
                            title="Recommended YouTube video"
                            src={embedUrl}
                            loading="lazy"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            referrerPolicy="strict-origin-when-cross-origin"
                          />
                        ) : (
                          <div className="youtube-guide-empty">Pick a video to start watching.</div>
                        )}
                      </div>
                      <div className="youtube-guide-viewer-meta">
                        <div className="youtube-guide-viewer-title">{selectedVideo?.title || "Recommended video"}</div>
                        {selectedVideo?.channelTitle ? (
                          <div className="youtube-guide-viewer-channel">{selectedVideo.channelTitle}</div>
                        ) : null}
                        <div className="youtube-guide-viewer-actions">
                          <button
                            type="button"
                            className="primary-action-btn"
                            onClick={() => window.open(openUrl, "_blank", "noopener,noreferrer")}
                            disabled={!openUrl}
                          >
                            Open on YouTube
                          </button>
                          <button type="button" className="ghost-btn" onClick={handleCopyLink} disabled={!openUrl}>
                            Copy link
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="youtube-guide-list">
                    <div className="youtube-guide-list-panel">
                      <div className="youtube-guide-list-head">
                        <div>
                          <div className="youtube-guide-list-title">Up next</div>
                          <div className="youtube-guide-list-subtitle">{videos.length} recommendations</div>
                        </div>
                        <input
                          className="youtube-guide-search"
                          value={filterText}
                          onChange={(event) => setFilterText(event.target.value)}
                          placeholder="Search title or channel"
                          aria-label="Search recommended videos"
                        />
                      </div>
                      <div className="youtube-videos-scroll">
                        <div className="youtube-videos-grid youtube-videos-grid-page">
                          {filteredVideos.map((video) => (
                            <button
                              key={video.videoId}
                              type="button"
                              className={`youtube-video-card ${
                                selectedVideoId === video.videoId ? "youtube-video-selected" : ""
                              }`}
                              onClick={() => setSelectedVideoId(video.videoId)}
                            >
                              <img
                                className="youtube-video-thumb"
                                src={video.thumbnailUrl}
                                alt={video.title || "Video thumbnail"}
                                loading="lazy"
                              />
                              <div className="youtube-video-meta">
                                <div className="youtube-video-title">{video.title}</div>
                                <div className="youtube-video-channel">{video.channelTitle}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                        {filteredVideos.length === 0 ? (
                          <div className="youtube-guide-empty-list">No videos match your search.</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export default YouTubeGuidePage;
