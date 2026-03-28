import { useNavigate } from "react-router-dom";
import "./UpgradeNotice.css";

function UpgradeNotice({ title = "Premium feature", message = "Upgrade your plan to unlock this feature." }) {
  const navigate = useNavigate();
  return (
    <section className="upgrade-notice">
      <div className="upgrade-notice-top">
        <div className="upgrade-notice-title">{title}</div>
        <div className="upgrade-notice-sub">{message}</div>
      </div>
      <button type="button" className="primary-action-btn upgrade-notice-cta" onClick={() => navigate("/premium")}>
        View Premium Plans
      </button>
    </section>
  );
}

export default UpgradeNotice;

