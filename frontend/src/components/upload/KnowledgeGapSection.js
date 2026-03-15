function KnowledgeGapSection({ result, loading, onAnalyze }) {
  const weakTopics = Array.isArray(result?.weakTopics) ? result.weakTopics : [];
  const recommendedStudy = Array.isArray(result?.recommendedStudy) ? result.recommendedStudy : [];
  const conceptExplanations = Array.isArray(result?.conceptExplanations) ? result.conceptExplanations : [];
  const formatBullets = (value) => {
    const text = String(value || "").trim();
    if (!text) return [];
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^-\\s*/, "").trim())
      .filter(Boolean);
  };

  return (
    <section className="result-section">
      <div className="summary-header">
        <h3>Knowledge Gap Detector</h3>
        <div className="summary-actions">
          <button type="button" className="ghost-btn" onClick={onAnalyze} disabled={loading}>
            {loading ? "Analyzing..." : "Analyze Knowledge Gaps"}
          </button>
        </div>
      </div>

      {weakTopics.length === 0 && !loading && (
        <p className="topic-empty-text">No weak topics detected yet. Complete and analyze your quiz attempts.</p>
      )}

      {conceptExplanations.length > 0 && (
        <>
          <h4>Concept Explanations (Based on Wrong Answers)</h4>
          <div className="history-flashcards">
            {conceptExplanations.map((topicBlock) => (
              <article key={topicBlock.topic} className="history-flashcard">
                <p>
                  <strong>{topicBlock.topic}</strong>
                  {Number.isInteger(topicBlock.wrong) && topicBlock.wrong > 0 ? ` (missed ${topicBlock.wrong})` : ""}
                </p>
                {topicBlock.explanation ? (
                  <ul className="result-options">
                    {formatBullets(topicBlock.explanation).map((point) => (
                      <li key={`${topicBlock.topic}-${point}`}>{point}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="topic-empty-text">No explanation available.</p>
                )}
              </article>
            ))}
          </div>
        </>
      )}

      {weakTopics.length > 0 && (
        <>
          <h4>Your Weak Areas</h4>
          <ul className="result-options">
            {weakTopics.map((item) => (
              <li key={item.topic}>
                {item.topic} (accuracy {(Number(item.accuracy || 0) * 100).toFixed(0)}%)
              </li>
            ))}
          </ul>

          {conceptExplanations.length === 0 && (
            <>
              <h4>Recommended Study</h4>
              <div className="history-flashcards">
                {recommendedStudy.map((topicBlock) => (
                  <article key={topicBlock.topic} className="history-flashcard">
                    <p>
                      <strong>{topicBlock.topic}</strong>
                    </p>
                    {topicBlock.summary && (
                      <ul className="result-options">
                        {formatBullets(topicBlock.summary).map((point) => (
                          <li key={`${topicBlock.topic}-${point}`}>{point}</li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

export default KnowledgeGapSection;
