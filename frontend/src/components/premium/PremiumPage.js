import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { API_BASE } from "../../config/api";
import { auth } from "../../firebase";
import usePremium from "../../premium/usePremium";
import { FEATURE_LABELS, PLAN_DEFS, hasFeature } from "../../premium/plans";
import "./PremiumPage.css";

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="premium-check">
      <path
        d="M9.2 16.2 4.9 11.9l1.4-1.4 2.9 2.9 8.5-8.5 1.4 1.4-9.9 9.9z"
        fill="currentColor"
      />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="premium-cross">
      <path
        d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4z"
        fill="currentColor"
      />
    </svg>
  );
}

function splitPrice(priceText) {
  const raw = String(priceText || "").trim();
  const numberMatch = raw.match(/([0-9,.]+)/);
  if (!numberMatch) return { amount: raw || "", period: "" };

  const number = numberMatch[1];
  const prefix = raw.slice(0, numberMatch.index ?? 0).trim();
  const suffix = raw.slice((numberMatch.index ?? 0) + number.length);

  const amount = `${prefix}${number}`.trim();
  const periodMatch = suffix.match(/\/\s*(yr|mo|year|month)/i);
  const periodRaw = (periodMatch?.[1] || "").toLowerCase();
  const period =
    periodRaw === "yr" || periodRaw === "year"
      ? "year"
      : periodRaw === "mo" || periodRaw === "month"
        ? "month"
        : "";
  return { amount, period };
}

function PremiumPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh, plan, active, expiresAtEpoch } = usePremium();
  const [startingCheckout, setStartingCheckout] = useState("");
  const activationStartedRef = useRef(false);

  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const success = query.get("success") === "1";
  const canceled = query.get("canceled") === "1";

  useEffect(() => {
    if (canceled) {
      toast.info("Checkout canceled.", { toastId: "billing-canceled" });
    }
  }, [canceled]);

  useEffect(() => {
    if (!success) return;
    if (activationStartedRef.current) return;
    activationStartedRef.current = true;

    toast.success("Payment received. Activating plan...", { toastId: "billing-activating" });
    let canceledLocal = false;

    (async () => {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        if (canceledLocal) return;
        const next = await refresh();
        if (next?.plan && next.plan !== "free") return;
        await new Promise((resolve) => setTimeout(resolve, 1500 + attempt * 400));
      }
    })();

    return () => {
      canceledLocal = true;
    };
  }, [refresh, success]);

  const startCheckout = async (planKey) => {
    if (!auth.currentUser) {
      toast.info("Login first");
      navigate("/login", { state: { from: "/premium" } });
      return;
    }
    try {
      setStartingCheckout(planKey);
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`${API_BASE}/api/billing/checkout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to start checkout");
      }
      if (!data?.checkoutUrl) {
        throw new Error("Checkout URL missing from backend");
      }
      window.location.href = String(data.checkoutUrl);
    } catch (error) {
      console.error(error);
      toast.error(error?.message || "Failed to start checkout");
    } finally {
      setStartingCheckout("");
    }
  };

  const cards = [
    { key: "silver", theme: "basic", ribbon: "BASIC" },
    { key: "gold", theme: "standard", ribbon: "STANDARD", featured: true },
    { key: "platinum", theme: "premium", ribbon: "PREMIUM" },
  ];

  const premiumFeatureRows = ["fill_blanks", "audio_summary", "knowledge_gap", "true_false", "mock_exam", "youtube_guide"];

  return (
    <main className="premium-page">
      <section className="notebook-shell">
        <div className="notebook-grid notebook-grid-full">
          <section className="notebook-card premium-card">
            <div className="card-header">
              <h2 className="card-title">Premium Plans</h2>
              <div className="card-actions">
                <button type="button" className="ghost-btn" onClick={() => navigate("/uplod")}>
                  Back
                </button>
              </div>
            </div>
            <p className="card-subtitle">
              Your plan: <strong className="premium-plan-label">{plan}</strong>
              {active && expiresAtEpoch ? " (active)" : ""}
            </p>

            <div className="notebook-card-body">
              <div className="premium-grid">
                {cards.map((card) => {
                  const def = PLAN_DEFS[card.key];
                  const isCurrent = plan === card.key && active;
                  const price = splitPrice(def.priceText);
                  return (
                    <article
                      key={card.key}
                      className={`premium-plan premium-plan-${card.theme}${card.featured ? " premium-plan-featured" : ""}`}
                    >
                      <div className="premium-plan-ribbon" aria-hidden="true">
                        <div className="premium-plan-ribbon-inner">
                          <div className="premium-plan-ribbon-title">{card.ribbon}</div>
                          <div className="premium-plan-ribbon-subtitle">PACKAGE</div>
                        </div>
                      </div>

                      <ul className="premium-features">
                        {premiumFeatureRows.map((feature) => {
                          const enabled = hasFeature(card.key, feature);
                          return (
                            <li key={feature} className={enabled ? "is-on" : "is-off"}>
                              {enabled ? <CheckIcon /> : <CrossIcon />}
                              <span>{FEATURE_LABELS[feature] || feature}</span>
                            </li>
                          );
                        })}
                      </ul>

                      <div className="premium-plan-bottom">
                        <div className="premium-plan-price">
                          <div className="premium-plan-price-amount">{price.amount || def.priceText}</div>
                          <div className="premium-plan-price-period">{price.period ? `per ${price.period}` : "per year"}</div>
                        </div>

                        <button
                          type="button"
                          className="premium-cta"
                          onClick={() => startCheckout(card.key)}
                          disabled={startingCheckout === card.key || isCurrent}
                        >
                          {isCurrent ? "CURRENT" : startingCheckout === card.key ? "REDIRECTING..." : "SELECT"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export default PremiumPage;

