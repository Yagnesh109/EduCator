import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { API_BASE } from "../../config/api";
import { auth } from "../../firebase";
import usePremium from "../../premium/usePremium";
import { FEATURE_LABELS, PLAN_DEFS } from "../../premium/plans";
import "./PremiumPage.css";

function PremiumIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="premium-icon">
      <path
        d="M12 2l2.35 6.65L21 9l-5.2 3.9L17.7 20 12 16.4 6.3 20l1.9-7.1L3 9l6.65-.35L12 2z"
        fill="currentColor"
      />
    </svg>
  );
}

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

function PremiumPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const premium = usePremium();
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
        const next = await premium.refresh();
        if (next?.plan && next.plan !== "free") return;
        await new Promise((resolve) => setTimeout(resolve, 1500 + attempt * 400));
      }
    })();

    return () => {
      canceledLocal = true;
    };
  }, [premium.refresh, success]);

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
    { key: "silver", theme: "silver", badge: "Starter" },
    { key: "gold", theme: "gold", badge: "Most popular" },
    { key: "platinum", theme: "platinum", badge: "Best value" },
  ];

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
              Your plan: <strong className="premium-plan-label">{premium.plan}</strong>
              {premium.active && premium.expiresAtEpoch ? " (active)" : ""}
            </p>

            <div className="notebook-card-body">
              <div className="premium-grid">
                {cards.map((card) => {
                  const def = PLAN_DEFS[card.key];
                  const isCurrent = premium.plan === card.key && premium.active;
                  return (
                    <article key={card.key} className={`premium-plan premium-plan-${card.theme}`}>
                      <div className="premium-plan-top">
                        <div className="premium-plan-badge">{card.badge}</div>
                        <div className="premium-plan-name">
                          <PremiumIcon />
                          {def.label}
                        </div>
                        <div className="premium-plan-price">{def.priceText}</div>
                        <div className="premium-plan-note">Billed yearly • Stripe test mode</div>
                      </div>

                      <ul className="premium-features">
                        {def.features.filter((f) => f !== "mcq" && f !== "flashcards" && f !== "text_summary").map((feature) => (
                          <li key={feature}>
                            <CheckIcon />
                            <span>{FEATURE_LABELS[feature] || feature}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        type="button"
                        className="primary-action-btn premium-cta"
                        onClick={() => startCheckout(card.key)}
                        disabled={startingCheckout === card.key || isCurrent}
                      >
                        {isCurrent ? "Current plan" : startingCheckout === card.key ? "Redirecting..." : `Choose ${def.label}`}
                      </button>
                    </article>
                  );
                })}
              </div>

              <div className="premium-footnote">
                <p>
                  Included for everyone: <strong>MCQs</strong>, <strong>Flashcards</strong>, <strong>Text summary</strong>.
                </p>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export default PremiumPage;
