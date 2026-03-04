import { useState, useEffect, useRef } from "react";

// ─── Data ─────────────────────────────────────────────────────────────────

const DEBT_STACK = [
  {
    id: 1,
    name: "Grab PayLater",
    due: "Due in 5 days",
    amount: 320.0,
    used: 45,
    limit: 1000,
    color: "#00B14F",
    bg: "#00B14F1A",
    icon: "local_shipping",
  },
  {
    id: 2,
    name: "Shopee SPayLater",
    due: "Due in 12 days",
    amount: 150.0,
    used: 15,
    limit: 1000,
    color: "#EE4D2D",
    bg: "#EE4D2D1A",
    icon: "shopping_bag",
  },
  {
    id: 3,
    name: "Atome",
    due: "No active bills",
    amount: 0.0,
    used: 0,
    limit: 500,
    color: "#EAB308",
    bg: "#FEF08A33",
    icon: "credit_score",
    iconColor: "#854D0E",
  },
];

const NAV_ITEMS = [
  { id: "home",       label: "Home",       icon: "home" },
  { id: "budget",     label: "Budget",     icon: "donut_large" },
  { id: "simulation", label: "Simulation", icon: "play_circle" },
  { id: "wishlist",   label: "Wishlist",   icon: "auto_awesome" },
  { id: "profile",    label: "Profile",    icon: "person" },
];

// ─── ECG Wave Component ───────────────────────────────────────────────────
// Renders on a <canvas> and scrolls the ECG from right to left continuously.

function EcgCanvas({ color = "#13ecc8" }) {
  const canvasRef = useRef(null);
  const frameRef  = useRef(null);
  const offsetRef = useRef(0);

  // One full ECG "beat" pattern in normalised x∈[0,1], y∈[0,1] (0=top,1=bottom)
  // The pattern is defined relative to width W; we'll tile it.
  const BEAT_W = 200; // pixels per beat cycle at 1x scale

  // Generate y value for a given x offset within one beat
  function ecgY(x, mid) {
    const t = ((x % BEAT_W) + BEAT_W) % BEAT_W;
    const p = t / BEAT_W;

    if (p < 0.25) return mid;                              // flat baseline
    if (p < 0.30) return mid - (p - 0.25) / 0.05 * mid * 0.35;  // tiny P wave up
    if (p < 0.35) return mid - (0.35 - p) / 0.05 * mid * 0.35;  // P wave down
    if (p < 0.42) return mid;                              // flat PR segment
    if (p < 0.44) return mid + (p - 0.42) / 0.02 * mid * 0.25;  // Q dip
    if (p < 0.46) return mid - (p - 0.44) / 0.02 * mid * 1.5;   // R spike up  ← sharp peak
    if (p < 0.49) return mid + (p - 0.46) / 0.03 * mid * 0.6;   // S dip down
    if (p < 0.52) return mid - (0.52 - p) / 0.03 * mid * 0.6;   // back to base
    if (p < 0.58) return mid;                              // ST segment
    if (p < 0.66) {                                        // T wave (smooth bump)
      const tp = (p - 0.58) / 0.08;
      return mid - Math.sin(tp * Math.PI) * mid * 0.5;
    }
    return mid;                                            // rest of baseline
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    const W      = canvas.width;
    const H      = canvas.height;
    const mid    = H / 2;
    const SPEED  = 1.2; // px per frame

    // Erase-head width (blank zone ahead of the drawing point, hospital-monitor style)
    const ERASE_W = 40;

    // We keep a circular "line buffer" of y values, length = W
    const yBuf = new Float32Array(W).fill(mid);
    let   head = 0; // current write position (moves right each frame)

    function tick() {
      // Advance head by SPEED pixels
      const steps = Math.ceil(SPEED);
      for (let s = 0; s < steps; s++) {
        head = (head + 1) % W;
        yBuf[head] = ecgY(offsetRef.current, mid);
        offsetRef.current += 1;
      }

      // Clear
      ctx.clearRect(0, 0, W, H);

      // Gradient fill under the line
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0,   color === "#13ecc8" ? "rgba(19,236,200,0.25)" : "rgba(186,26,26,0.2)");
      grad.addColorStop(1,   "rgba(0,0,0,0)");

      // Draw fill path
      ctx.beginPath();
      ctx.moveTo(0, mid);
      for (let i = 0; i < W; i++) {
        const x  = i;
        const bi = (head - W + 1 + i + W) % W;
        // blank out the erase zone (ERASE_W pixels ahead of head)
        const dist = (W - i); // distance behind head
        if (dist < ERASE_W) continue;
        ctx.lineTo(x, yBuf[bi]);
      }
      ctx.lineTo(W, mid);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Draw ECG line
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2.5;
      ctx.lineJoin    = "round";
      ctx.lineCap     = "round";

      let started = false;
      for (let i = 0; i < W; i++) {
        const x  = i;
        const bi = (head - W + 1 + i + W) % W;
        const dist = W - i;
        if (dist < ERASE_W) {
          if (started) { ctx.stroke(); ctx.beginPath(); started = false; }
          continue;
        }
        const y = yBuf[bi];
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      if (started) ctx.stroke();

      // Glowing dot at the head position (left edge of erase zone)
      const dotX = W - ERASE_W;
      const dotY = yBuf[(head - ERASE_W + W) % W];

      // Outer glow
      const r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
      const radialGrad = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, 12);
      radialGrad.addColorStop(0,   `rgba(${r},${g},${b},0.6)`);
      radialGrad.addColorStop(1,   `rgba(${r},${g},${b},0)`);
      ctx.beginPath();
      ctx.arc(dotX, dotY, 12, 0, Math.PI * 2);
      ctx.fillStyle = radialGrad;
      ctx.fill();

      // Solid core dot
      ctx.beginPath();
      ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Horizontal centre line
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${r},${g},${b},0.2)`;
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 4]);
      ctx.moveTo(0, mid);
      ctx.lineTo(W, mid);
      ctx.stroke();
      ctx.setLineDash([]);

      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={380}
      height={72}
      style={{
        width: "100%",
        height: 72,
        display: "block",
        filter: color === "#13ecc8"
          ? "drop-shadow(0 0 8px rgba(19,236,200,0.5))"
          : "drop-shadow(0 0 8px rgba(186,26,26,0.5))",
      }}
    />
  );
}

// ─── Debt Card ────────────────────────────────────────────────────────────

function DebtCard({ item, danger }) {
  const barColor = danger ? "#d41111" : item.color;
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100"
      style={{ borderColor: danger && item.used > 50 ? "rgba(212,17,17,0.2)" : undefined }}
    >
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: item.bg }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 20,
                color: item.iconColor || item.color,
                fontVariationSettings: "'FILL' 1",
              }}
            >
              {item.icon}
            </span>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm leading-tight">{item.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{item.due}</p>
          </div>
        </div>
        <span className="text-sm font-bold text-gray-900">MYR {item.amount.toFixed(2)}</span>
      </div>

      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${item.used}%`, background: barColor }}
        />
      </div>

      <div className="flex justify-between mt-2 text-xs font-medium" style={{ color: danger && item.used > 50 ? "#d41111" : "#9CA3AF" }}>
        <span>{item.used}% Used</span>
        <span>MYR {item.limit.toLocaleString()} Limit</span>
      </div>
    </div>
  );
}

// ─── Budget Page Data ─────────────────────────────────────────────────────

const DETECTED_DATES_INIT = [
  { id: 1, label: "Salary",    schedule: "28th of every month", icon: "attach_money",  iconBg: "#EEF2FF", iconColor: "#4F6EF7" },
  { id: 2, label: "Rent",      schedule: "1st of every month",  icon: "home",          iconBg: "#FFF3EE", iconColor: "#F97316" },
  { id: 3, label: "Utilities", schedule: "15th of every month", icon: "water_drop",    iconBg: "#EFF6FF", iconColor: "#3B82F6" },
];

// ─── Toggle Switch ────────────────────────────────────────────────────────

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 52, height: 30, borderRadius: 999,
        background: checked ? "#2563EB" : "#D1D5DB",
        border: "none", cursor: "pointer",
        position: "relative", transition: "background 0.25s",
        flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 3,
        left: checked ? 25 : 3,
        width: 24, height: 24, borderRadius: "50%",
        background: "white",
        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
        transition: "left 0.25s cubic-bezier(.4,0,.2,1)",
      }} />
    </button>
  );
}


// ─── Budget Page ──────────────────────────────────────────────────────────

const BILL_OPTIONS = ["Rent", "Utilities", "Car", "Insurance", "Internet", "Phone"];

const ICON_OPTIONS = [
  { icon: "attach_money", bg: "#EEF2FF", color: "#4F6EF7", label: "Income" },
  { icon: "home",         bg: "#FFF3EE", color: "#F97316", label: "Housing" },
  { icon: "water_drop",   bg: "#EFF6FF", color: "#3B82F6", label: "Utility" },
  { icon: "directions_car", bg: "#F0FDF4", color: "#16A34A", label: "Car" },
  { icon: "shopping_cart",  bg: "#FFF7ED", color: "#EA580C", label: "Shopping" },
  { icon: "favorite",       bg: "#FFF1F2", color: "#E11D48", label: "Health" },
  { icon: "school",         bg: "#F5F3FF", color: "#7C3AED", label: "Education" },
  { icon: "restaurant",     bg: "#FFFBEB", color: "#D97706", label: "Food" },
];

const FREQ_OPTIONS = [
  "Every month",
  "Every 2 weeks",
  "Every week",
  "Once a year",
  "Custom",
];

// ── Sub-page: Add Manual Date Form ────────────────────────────────────────

function AddManualDatePage({ onBack, onSave }) {
  const [label, setLabel]         = useState("");
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [freq, setFreq]           = useState("Every month");
  const [selectedIcon, setSelectedIcon] = useState(0);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showFreqPicker, setShowFreqPicker] = useState(false);
  const [saving, setSaving]       = useState(false);

  const ordinal = (n) => {
    const s = ["th","st","nd","rd"]; const v = n % 100;
    return n + (s[(v-20)%10] || s[v] || s[0]);
  };

  const handleSave = () => {
    if (!label.trim()) return;
    setSaving(true);
    setTimeout(() => {
      onSave({
        id: Date.now(),
        label: label.trim(),
        schedule: `${ordinal(dayOfMonth)} of every month`,
        icon: ICON_OPTIONS[selectedIcon].icon,
        iconBg: ICON_OPTIONS[selectedIcon].bg,
        iconColor: ICON_OPTIONS[selectedIcon].color,
      });
      setSaving(false);
    }, 800);
  };

  const inputStyle = {
    width: "100%", border: "none", borderBottom: "2px solid #E2E8F0",
    outline: "none", background: "transparent", fontSize: 16,
    fontWeight: 500, color: "#0F172A", padding: "10px 0",
    fontFamily: "inherit", transition: "border-color 0.2s",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "#f6f6f8" }}>

      {/* Top Bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        display: "flex", alignItems: "center",
        padding: "52px 16px 12px",
        background: "rgba(255,255,255,0.88)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid #F1F5F9",
      }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#111" }}>arrow_back</span>
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", margin: 0, flex: 1, textAlign: "center", paddingRight: 40 }}>
          Add Manual Date
        </h2>
      </div>

      {/* Scrollable Form */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 120px" }}>

        {/* Headline */}
        <div style={{ paddingTop: 24, paddingBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            New Date Entry
          </h1>
          <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>
            Add a custom bill, income, or payment date.
          </p>
        </div>

        {/* ── Icon Picker ── */}
        <div style={{ background: "#fff", borderRadius: 20, padding: 20, border: "1px solid #E2E8F0", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#64748B", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Category Icon</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {ICON_OPTIONS.map((opt, i) => (
              <button
                key={i}
                onClick={() => setSelectedIcon(i)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  padding: "12px 8px", borderRadius: 16, border: "2px solid",
                  borderColor: selectedIcon === i ? "#135bec" : "transparent",
                  background: selectedIcon === i ? "#EEF4FF" : "#F8FAFC",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: opt.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: opt.color, fontVariationSettings: "'FILL' 1" }}>{opt.icon}</span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: selectedIcon === i ? "#135bec" : "#64748B" }}>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Label Input ── */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "20px 20px 24px", border: "1px solid #E2E8F0", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#64748B", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Label</p>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Car Loan, Gym Membership…"
            style={{ ...inputStyle }}
            onFocus={e => e.target.style.borderColor = "#135bec"}
            onBlur={e => e.target.style.borderColor = "#E2E8F0"}
          />
          {/* Live preview chip */}
          {label.trim() && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: "10px 14px", background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: ICON_OPTIONS[selectedIcon].bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: ICON_OPTIONS[selectedIcon].color, fontVariationSettings: "'FILL' 1" }}>{ICON_OPTIONS[selectedIcon].icon}</span>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>{label}</p>
                <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>{ordinal(dayOfMonth)} of every month</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Day of Month ── */}
        <div style={{ background: "#fff", borderRadius: 20, padding: 20, border: "1px solid #E2E8F0", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#64748B", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Day of Month</p>
          <button
            onClick={() => { setShowDayPicker(!showDayPicker); setShowFreqPicker(false); }}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#F6F6F8", borderRadius: 999, height: 48, padding: "0 16px 0 20px",
              border: "none", cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>{ordinal(dayOfMonth)} of the month</span>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#94A3B8" }}>
              {showDayPicker ? "expand_less" : "expand_more"}
            </span>
          </button>
          {showDayPicker && (
            <div style={{
              marginTop: 10, background: "#F8FAFC", borderRadius: 16, padding: "12px 8px",
              border: "1px solid #E2E8F0", display: "flex", flexWrap: "wrap", gap: 4,
            }}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <button key={d} onClick={() => { setDayOfMonth(d); setShowDayPicker(false); }}
                  style={{
                    width: 40, height: 40, borderRadius: 10, border: "none", cursor: "pointer",
                    fontSize: 14, fontWeight: d === dayOfMonth ? 700 : 500,
                    background: d === dayOfMonth ? "#135bec" : "transparent",
                    color: d === dayOfMonth ? "#fff" : "#334155",
                  }}>
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Frequency ── */}
        <div style={{ background: "#fff", borderRadius: 20, padding: 20, border: "1px solid #E2E8F0", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#64748B", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Frequency</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {FREQ_OPTIONS.map(f => (
              <button key={f} onClick={() => setFreq(f)}
                style={{
                  padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600,
                  border: "1.5px solid", cursor: "pointer", transition: "all 0.15s",
                  borderColor: freq === f ? "#135bec" : "#E2E8F0",
                  background: freq === f ? "#EEF4FF" : "#fff",
                  color: freq === f ? "#135bec" : "#64748B",
                }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* ── Notes (optional) ── */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "20px 20px 24px", border: "1px solid #E2E8F0", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", marginBottom: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#64748B", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Notes <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></p>
          <textarea
            placeholder="e.g. Shared with flatmate, auto-deducted…"
            rows={3}
            style={{
              width: "100%", border: "none", borderBottom: "2px solid #E2E8F0",
              outline: "none", background: "transparent", fontSize: 14,
              color: "#0F172A", padding: "10px 0", fontFamily: "inherit",
              resize: "none", lineHeight: 1.6,
            }}
            onFocus={e => e.target.style.borderColor = "#135bec"}
            onBlur={e => e.target.style.borderColor = "#E2E8F0"}
          />
        </div>
      </div>

      {/* ── Save Button ── */}
      <div style={{
        position: "sticky", bottom: 0, padding: "12px 16px 28px",
        background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)",
        borderTop: "1px solid #F1F5F9", zIndex: 10,
      }}>
        <button
          onClick={handleSave}
          disabled={!label.trim()}
          style={{
            width: "100%", height: 56, borderRadius: 999,
            background: saving ? "#22C55E" : !label.trim() ? "#CBD5E1" : "#135bec",
            border: "none", cursor: label.trim() ? "pointer" : "not-allowed",
            color: "#fff", fontSize: 16, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: saving ? "0 4px 20px rgba(34,197,94,0.3)" : label.trim() ? "0 4px 20px rgba(19,91,236,0.3)" : "none",
            transition: "background 0.3s",
          }}
        >
          <span>{saving ? "Saved!" : "Save Date"}</span>
          <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>
            {saving ? "check_circle" : "save"}
          </span>
        </button>
      </div>
    </div>
  );
}

// ── Sub-page: Customize Cycle ─────────────────────────────────────────────

function CustomizeCyclePage({ onBack }) {
  const [paycheckDay, setPaycheckDay] = useState(1);
  const [showPaycheckPicker, setShowPaycheckPicker] = useState(false);
  const [activeBills, setActiveBills] = useState(["Rent", "Utilities"]);
  const [showBillPicker, setShowBillPicker] = useState(false);
  const [newBill, setNewBill] = useState("");
  const [saved, setSaved] = useState(false);

  const toggleBill = (bill) => setActiveBills(b => b.includes(bill) ? b.filter(x => x !== bill) : [...b, bill]);
  const addCustomBill = () => {
    const v = newBill.trim();
    if (v && !activeBills.includes(v)) setActiveBills(b => [...b, v]);
    setNewBill("");
  };
  const handleSave = () => { setSaved(true); setTimeout(() => { setSaved(false); onBack(); }, 1200); };
  const ordinal = (n) => { const s = ["th","st","nd","rd"]; const v = n%100; return n+(s[(v-20)%10]||s[v]||s[0]); };
  const stressStart = ((paycheckDay - 1) / 30) * 100;
  const stressWidth = (10 / 30) * 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "#f6f6f8" }}>

      {/* ── Sticky Top Bar ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        display: "flex", alignItems: "center",
        padding: "52px 16px 12px",
        background: "rgba(255,255,255,0.88)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #F1F5F9",
      }}>
        <button
          onClick={onBack}
          style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#111" }}>arrow_back</span>
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", margin: 0, flex: 1, textAlign: "center", paddingRight: 40 }}>
          Budget Cycle
        </h2>
      </div>

      {/* ── Scrollable Content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 120px" }}>

        {/* Headline */}
        <div style={{ paddingTop: 24, paddingBottom: 20 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            Customize your Cycle
          </h1>
          <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>
            Align your buffer with your financial timeline.
          </p>
        </div>

        {/* ── Paycheck Date Card ── */}
        <div style={{
          background: "#fff", borderRadius: 20, padding: 20,
          border: "1px solid #E2E8F0",
          boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ background: "#EEF2FF", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#135bec", fontVariationSettings: "'FILL' 1" }}>calendar_month</span>
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Paycheck Date</span>
              </div>
              <p style={{ fontSize: 14, color: "#64748B", margin: 0, lineHeight: 1.5 }}>Set the start of your monthly cycle.</p>
            </div>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#dbeafe,#e0e7ff)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24, color: "#135bec", fontVariationSettings: "'FILL' 1" }}>payments</span>
            </div>
          </div>
          <button
            onClick={() => setShowPaycheckPicker(!showPaycheckPicker)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#F6F6F8", borderRadius: 999, height: 48, padding: "0 16px 0 20px",
              border: "none", cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>{ordinal(paycheckDay)} of the month</span>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#94A3B8" }}>chevron_right</span>
          </button>
          {showPaycheckPicker && (
            <div style={{
              marginTop: 10, background: "#F8FAFC", borderRadius: 16, padding: "12px 8px",
              border: "1px solid #E2E8F0", display: "flex", flexWrap: "wrap", gap: 4,
            }}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <button key={d} onClick={() => { setPaycheckDay(d); setShowPaycheckPicker(false); }}
                  style={{
                    width: 40, height: 40, borderRadius: 10, border: "none", cursor: "pointer",
                    fontSize: 14, fontWeight: d === paycheckDay ? 700 : 500,
                    background: d === paycheckDay ? "#135bec" : "transparent",
                    color: d === paycheckDay ? "#fff" : "#334155",
                  }}>
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Fixed Bill Alignment Card ── */}
        <div style={{
          background: "#fff", borderRadius: 20, padding: 20,
          border: "1px solid #E2E8F0",
          boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
          marginBottom: 24,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ background: "#EEF2FF", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#135bec", fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Fixed Bill Alignment</span>
              </div>
              <p style={{ fontSize: 14, color: "#64748B", margin: 0, lineHeight: 1.5 }}>Group Rent, Utilities, and Car payments.</p>
            </div>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#dbeafe,#e0e7ff)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24, color: "#135bec", fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
            </div>
          </div>

          {/* Active bill chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {activeBills.map(bill => (
              <button key={bill} onClick={() => toggleBill(bill)} style={{
                padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600,
                border: "1.5px solid #135bec", background: "#EEF4FF", color: "#135bec",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              }}>
                {bill}
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
              </button>
            ))}
            {showBillPicker ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  autoFocus value={newBill} onChange={e => setNewBill(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addCustomBill(); if (e.key === "Escape") setShowBillPicker(false); }}
                  placeholder="Bill name"
                  style={{ fontSize: 13, padding: "6px 12px", borderRadius: 999, border: "1.5px solid #135bec", outline: "none", background: "#fff", color: "#0F172A", width: 100 }}
                />
                <button onClick={addCustomBill} style={{ background: "#135bec", color: "#fff", border: "none", borderRadius: 999, padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
                <button onClick={() => setShowBillPicker(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 13 }}>✕</button>
              </div>
            ) : (
              <button onClick={() => setShowBillPicker(true)} style={{
                padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600,
                border: "1.5px solid #CBD5E1", background: "#fff", color: "#64748B", cursor: "pointer",
              }}>
                + Add Bill
              </button>
            )}
          </div>

          {/* Preset quick-pick */}
          {showBillPicker && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 10, background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0", marginBottom: 12 }}>
              {BILL_OPTIONS.filter(b => !activeBills.includes(b)).map(bill => (
                <button key={bill} onClick={() => setActiveBills(b => [...b, bill])} style={{
                  padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 500,
                  border: "1px solid #CBD5E1", background: "#fff", color: "#475569", cursor: "pointer",
                }}>{bill}</button>
              ))}
            </div>
          )}

          <button style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#F6F6F8", borderRadius: 999, height: 48, padding: "0 16px 0 20px",
            border: "none", cursor: "pointer",
          }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>Select Bills</span>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#94A3B8" }}>chevron_right</span>
          </button>
        </div>

        {/* ── Cycle Preview ── */}
        <h3 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", margin: "0 0 14px", letterSpacing: "-0.01em" }}>
          Cycle Preview
        </h3>
        <div style={{
          background: "#fff", borderRadius: 20, padding: "20px 20px 24px",
          border: "1px solid #E2E8F0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", marginBottom: 8,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94A3B8" }}>Timeline</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F87171" }} />
              <span style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>High Stress</span>
            </div>
          </div>

          {/* Bar */}
          <div style={{ position: "relative", height: 8, background: "#F1F5F9", borderRadius: 999, marginBottom: 16 }}>
            <div style={{ position: "absolute", top: 0, height: "100%", left: `${stressStart}%`, width: `${stressWidth}%`, background: "rgba(248,113,113,0.4)", borderRadius: 999 }} />
            <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${stressStart + 1}%`, background: "#135bec", borderRadius: 999, transition: "width 0.4s ease" }} />
            <div style={{
              position: "absolute", top: "50%", left: `${stressStart}%`,
              transform: "translate(-50%,-50%)",
              width: 18, height: 18, background: "#fff", border: "3px solid #135bec",
              borderRadius: "50%", boxShadow: "0 2px 8px rgba(19,91,236,0.3)", zIndex: 2,
              transition: "left 0.4s ease",
            }} />
          </div>

          {/* Labels */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
            {[
              { val: String(paycheckDay), sub: "Day", color: "#0F172A" },
              { val: String(Math.min(paycheckDay + 4, 30)), sub: "Bills", color: "#EF4444" },
              { val: "15", sub: "Mid", color: "#64748B" },
              { val: "30", sub: "End", color: "#64748B" },
            ].map((item, i) => (
              <div key={i} style={{ textAlign: "center", minWidth: 32 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.val}</div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{item.sub}</div>
              </div>
            ))}
          </div>

          {/* Tip note */}
          <div style={{ background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0", padding: "12px 16px", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
              Your <strong style={{ color: "#0F172A" }}>"High Stress"</strong> period is aligned with the first 10 days.
            </p>
          </div>
        </div>
      </div>

      {/* ── Save Cycle CTA ── */}
      <div style={{
        position: "sticky", bottom: 0, padding: "12px 16px 28px",
        background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)",
        borderTop: "1px solid #F1F5F9", zIndex: 10,
      }}>
        <button
          onClick={handleSave}
          style={{
            width: "100%", height: 56, borderRadius: 999,
            background: saved ? "#22C55E" : "#135bec",
            border: "none", cursor: "pointer",
            color: "#fff", fontSize: 16, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: saved ? "0 4px 20px rgba(34,197,94,0.35)" : "0 4px 20px rgba(19,91,236,0.3)",
            transition: "background 0.3s, box-shadow 0.3s",
          }}
        >
          <span>{saved ? "Saved!" : "Save Cycle"}</span>
          <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>
            {saved ? "check_circle" : "check"}
          </span>
        </button>
      </div>
    </div>
  );
}

// ─── Budget Page (Detected Dates — main view) ────────────────────────────

function BudgetPage({ onBack }) {
  const [subPage, setSubPage] = useState(null); // null | "add-manual" | "customize"
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [dates, setDates] = useState(DETECTED_DATES_INIT);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  const saveEdit = (id) => {
    setDates(d => d.map(item => item.id === id ? { ...item, schedule: editValue } : item));
    setEditingId(null);
  };

  const handleAddDate = (newItem) => {
    setDates(d => [...d, newItem]);
    setSubPage(null);
  };

  // Route to sub-pages
  if (subPage === "add-manual") {
    return <AddManualDatePage onBack={() => setSubPage(null)} onSave={handleAddDate} />;
  }
  if (subPage === "customize") {
    return <CustomizeCyclePage onBack={() => setSubPage(null)} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "#fff" }}>

      {/* ── Top Bar ── */}
      <div style={{
        display: "flex", alignItems: "center",
        padding: "52px 16px 14px",
        background: "#fff",
        borderBottom: "1px solid #F8FAFC",
      }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#111" }}>arrow_back</span>
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", margin: 0, flex: 1, textAlign: "center", paddingRight: 40 }}>
          Budget Cycle
        </h2>
      </div>

      {/* ── Scrollable Content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px 120px" }}>

        {/* Sync Card */}
        <div style={{
          background: "#F3F4F6", borderRadius: 20, padding: "20px",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 16, marginBottom: 28,
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: "0 0 6px" }}>Sync with Bank Account</p>
            <p style={{ fontSize: 14, color: "#6B7280", margin: 0, lineHeight: 1.6 }}>
              Automatically detect paycheck and bill dates from your linked accounts.
            </p>
          </div>
          <Toggle checked={syncEnabled} onChange={setSyncEnabled} />
        </div>

        {/* Detected Dates Header */}
        <h3 style={{ fontSize: 20, fontWeight: 800, color: "#111", margin: "0 0 16px" }}>Detected Dates</h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {dates.map((item) => (
            <div key={item.id} style={{
              background: "#fff", borderRadius: 18, border: "1px solid #E5E7EB",
              padding: "16px 18px", display: "flex", alignItems: "center", gap: 14,
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: item.iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: item.iconColor, fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: "0 0 2px" }}>{item.label}</p>
                {editingId === item.id ? (
                  <input
                    autoFocus value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={() => saveEdit(item.id)}
                    onKeyDown={e => e.key === "Enter" && saveEdit(item.id)}
                    style={{ fontSize: 13, color: "#135bec", border: "none", borderBottom: "1.5px solid #135bec", background: "transparent", outline: "none", width: "100%", padding: "2px 0" }}
                  />
                ) : (
                  <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>{item.schedule}</p>
                )}
              </div>
              <button
                onClick={() => { if (editingId === item.id) { saveEdit(item.id); } else { setEditingId(item.id); setEditValue(item.schedule); } }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#9CA3AF" }}>
                  {editingId === item.id ? "check" : "edit"}
                </span>
              </button>
            </div>
          ))}

          {/* Add Manual Date Button */}
          <button
            onClick={() => setSubPage("add-manual")}
            style={{
              background: "#fff", borderRadius: 18,
              border: "1.5px dashed #CBD5E1",
              padding: "18px", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, cursor: "pointer", transition: "border-color 0.2s, background 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#135bec"; e.currentTarget.style.background = "#F8FAFF"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#CBD5E1"; e.currentTarget.style.background = "#fff"; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#94A3B8" }}>add</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#94A3B8" }}>Add Manual Date</span>
          </button>
        </div>

        {/* Nudge Tip */}
        <div style={{
          marginTop: 24, background: "#EFF6FF", borderRadius: 18,
          padding: "18px", display: "flex", alignItems: "flex-start", gap: 14,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#fff", fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#1E3A5F", margin: "0 0 4px" }}>Nudge Tip</p>
            <p style={{ fontSize: 14, color: "#3B5A82", margin: 0, lineHeight: 1.55 }}>
              Aligning your cycle accurately helps your Guardian Angel give better purchase advice and calculate your safe-to-spend balance.
            </p>
          </div>
        </div>

        {/* Customize Cycle entry point */}
        <button
          onClick={() => setSubPage("customize")}
          style={{
            marginTop: 16, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#EEF4FF", borderRadius: 18, padding: "16px 20px",
            border: "1.5px solid #C7D7FD", cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#135bec", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#fff", fontVariationSettings: "'FILL' 1" }}>tune</span>
            </div>
            <div style={{ textAlign: "left" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#135bec", margin: 0 }}>Customize your Cycle</p>
              <p style={{ fontSize: 12, color: "#5B7EBF", margin: 0 }}>Set paycheck date & bill alignment</p>
            </div>
          </div>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#135bec" }}>arrow_forward</span>
        </button>
      </div>
    </div>
  );
}

// ─── Simulation Page ──────────────────────────────────────────────────────

const BNPL_PROVIDERS = [
  { id: "grab",    label: "Grab",    color: "#00B14F", textColor: "#fff" },
  { id: "shopee",  label: "Shopee",  color: "#EE4D2D", textColor: "#fff" },
  { id: "atome",   label: "Atome",   color: "#F5C400", textColor: "#111" },
  { id: "lazada",  label: "Lazada",  color: "#0F146D", textColor: "#fff" },
  { id: "split",   label: "Split",   color: "#7C3AED", textColor: "#fff" },
  { id: "klarna",  label: "Klarna",  color: "#FFB3C7", textColor: "#111" },
];

const DURATION_OPTIONS = [3, 6, 9, 12];

// ── Simulation: Loading Screen ─────────────────────────────────────────────
function SimLoadingScreen({ progress }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", flex: 1,
      background: "#f6f8f5", fontFamily: "Inter, sans-serif",
      alignItems: "center", justifyContent: "space-between",
      padding: "48px 24px 32px",
    }}>
      {/* Top bar */}
      <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ width: 48 }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: 0 }}>Risk Analysis</h2>
        <div style={{ width: 48 }} />
      </div>

      {/* Centre content */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32, flex: 1, justifyContent: "center" }}>
        {/* Glow blob */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            position: "absolute", width: 220, height: 220, borderRadius: "50%",
            background: "rgba(89,244,37,0.18)", filter: "blur(40px)",
          }} />
          {/* Circle card */}
          <div style={{
            width: 192, height: 192, borderRadius: "50%",
            background: "#fff", boxShadow: "0 0 40px 20px rgba(89,244,37,0.15), 0 8px 40px rgba(0,0,0,0.10)",
            border: "1px solid #f1f5f0",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
          }}>
            <svg width="128" height="64" viewBox="0 0 100 50" fill="none" stroke="#59f425" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path opacity="0.5" d="M0 25 L20 25 L30 10 L40 40 L50 25 L60 25 L70 5 L80 45 L90 25 L100 25" />
              <path d="M0 25 L20 25 L30 10 L40 40 L50 25">
                <animate attributeName="stroke-dasharray" from="0,200" to="200,0" dur="1.5s" repeatCount="indefinite" />
              </path>
            </svg>
            {/* Badge */}
            <div style={{
              position: "absolute", bottom: 4, right: 4,
              width: 40, height: 40, borderRadius: "50%",
              background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              border: "1px solid #f1f5f1",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#59f425", fontVariationSettings: "'FILL' 1" }}>health_and_safety</span>
            </div>
          </div>
        </div>

        {/* Text */}
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
            Analyzing your finances...
          </h1>
          <p style={{ fontSize: 15, color: "#64748B", margin: 0, lineHeight: 1.6 }}>
            Your Guardian Angel is looking for potential risks.
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ width: 192, height: 6, background: "#E2E8F0", borderRadius: 999, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 999,
            background: "#59f425",
            width: `${progress}%`,
            transition: "width 0.3s ease",
          }} />
        </div>
      </div>
    </div>
  );
}

// ── Simulation: Result Screen ──────────────────────────────────────────────
function SimResultScreen({ isHighRisk, bufferImpact, totalImpact, monthlyPay, amount, duration, itemName, providerLabel, onBack, onRetry, onPostpone, onProceed }) {
  const SAFETY_BUFFER = 1240.50;
  const projectedAfter = SAFETY_BUFFER - amount;
  const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fmt2 = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{
      display: "flex", flexDirection: "column", flex: 1,
      background: isHighRisk ? "#1a1200" : "#f6f8f5",
      fontFamily: "Inter, sans-serif",
      animation: "fadeSlideUp 0.35s ease both",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "52px 16px 16px", justifyContent: "space-between" }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: isHighRisk ? "#f29e0d" : "#0F172A" }}>arrow_back_ios</span>
        </button>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: isHighRisk ? "rgba(242,158,13,0.7)" : "#94A3B8", flex: 1, textAlign: "center", paddingRight: 40 }}>
          RISK ANALYSIS
        </span>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 140px", display: "flex", flexDirection: "column", alignItems: "center" }}>

        {/* Icon */}
        <div style={{ marginTop: 16, marginBottom: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: isHighRisk ? "rgba(242,158,13,0.2)" : "rgba(34,197,94,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: isHighRisk ? "#f29e0d" : "#22c55e", fontVariationSettings: "'FILL' 1" }}>
              {isHighRisk ? "warning" : "check_circle"}
            </span>
          </div>

          <h2 style={{ fontSize: 32, fontWeight: 800, color: isHighRisk ? "#fff" : "#0F172A", margin: 0, textAlign: "center", letterSpacing: "-0.02em" }}>
            {isHighRisk ? "High Impact Detected" : "Looks Safe to Proceed"}
          </h2>

          <p style={{ fontSize: 16, color: isHighRisk ? "#94A3B8" : "#64748B", margin: 0, textAlign: "center", lineHeight: 1.6, maxWidth: 280 }}>
            {isHighRisk
              ? <>This purchase totals <strong style={{ color: "#f29e0d" }}>{totalImpact}%</strong> of your current balance.</>
              : <>This purchase is only <strong style={{ color: "#22c55e" }}>{totalImpact}%</strong> of your current balance.</>
            }
          </p>
        </div>

        {/* Before / After card */}
        <div style={{
          width: "100%",
          background: isHighRisk ? "rgba(242,158,13,0.05)" : "rgba(255,255,255,0.9)",
          border: `1px solid ${isHighRisk ? "rgba(242,158,13,0.15)" : "#E2E8F0"}`,
          borderRadius: 20, padding: "20px 20px 16px",
          marginBottom: 16,
          boxShadow: isHighRisk ? "none" : "0 2px 12px rgba(0,0,0,0.05)",
        }}>
          {/* Current */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: isHighRisk ? "#64748B" : "#94A3B8" }}>Current Budget (Before)</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#22c55e" }}>MYR {fmt(SAFETY_BUFFER)}</span>
            </div>
            <div style={{ height: 14, background: isHighRisk ? "rgba(255,255,255,0.08)" : "#F1F5F9", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: "100%", background: "#22c55e", borderRadius: 999 }} />
            </div>
          </div>

          {/* Projected */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: isHighRisk ? "#64748B" : "#94A3B8" }}>Projected Budget (After)</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: isHighRisk ? "#ef4444" : "#22c55e" }}>
                MYR {fmt(Math.max(projectedAfter, 0))}
              </span>
            </div>
            <div style={{ height: 14, background: isHighRisk ? "rgba(255,255,255,0.08)" : "#F1F5F9", borderRadius: 999, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.max(100 - totalImpact, 0)}%`,
                background: isHighRisk ? "#ef4444" : "#22c55e",
                borderRadius: 999,
                transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
              }} />
            </div>
            <p style={{ fontSize: 12, fontWeight: 600, fontStyle: "italic", color: isHighRisk ? "#ef4444" : "#22c55e", textAlign: "right", margin: "6px 0 0" }}>
              -{totalImpact}% Impact
            </p>
          </div>
        </div>

        {/* Guardian speech bubble */}
        <div style={{
          width: "100%",
          display: "flex", alignItems: "flex-start", gap: 14,
          padding: "16px",
          background: isHighRisk ? "rgba(242,158,13,0.08)" : "rgba(34,197,94,0.07)",
          border: `1px solid ${isHighRisk ? "rgba(242,158,13,0.2)" : "rgba(34,197,94,0.2)"}`,
          borderRadius: 16, marginBottom: 8,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
            background: isHighRisk ? "#f29e0d" : "#22c55e",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 4px 16px ${isHighRisk ? "rgba(242,158,13,0.35)" : "rgba(34,197,94,0.35)"}`,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 26, color: "#fff", fontVariationSettings: "'FILL' 1" }}>shield_with_heart</span>
          </div>
          <div style={{
            flex: 1, background: isHighRisk ? "#1e1a0e" : "#fff",
            borderRadius: "0 12px 12px 12px",
            padding: "12px 14px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            position: "relative",
          }}>
            <div style={{
              position: "absolute", left: -8, top: 0,
              width: 0, height: 0,
              borderTop: `8px solid ${isHighRisk ? "#1e1a0e" : "#fff"}`,
              borderLeft: "8px solid transparent",
            }} />
            <p style={{ fontSize: 14, color: isHighRisk ? "#E2E8F0" : "#1E293B", margin: 0, lineHeight: 1.6 }}>
              {isHighRisk
                ? <>Your <strong style={{ color: "#f29e0d" }}>"{itemName}"</strong> purchase via <strong style={{ color: "#f29e0d" }}>{providerLabel}</strong> will seriously strain your cash flow. Consider postponing or splitting over more months.</>
                : <>Great news! Buying <strong style={{ color: "#22c55e" }}>"{itemName}"</strong> via <strong style={{ color: "#22c55e" }}>{providerLabel}</strong> fits comfortably within your budget.</>
              }
            </p>
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div style={{
        position: "sticky", bottom: 0, padding: "12px 24px 32px",
        background: isHighRisk ? "rgba(26,18,0,0.95)" : "rgba(246,248,245,0.95)",
        backdropFilter: "blur(12px)",
        borderTop: `1px solid ${isHighRisk ? "rgba(242,158,13,0.12)" : "#E2E8F0"}`,
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {isHighRisk ? (
          <>
            <button onClick={onPostpone} style={{
              width: "100%", height: 56, borderRadius: 9999,
              background: "#f29e0d", border: "none", cursor: "pointer",
              color: "#1a1200", fontSize: 16, fontWeight: 800,
              boxShadow: "0 8px 24px rgba(242,158,13,0.3)",
              transition: "transform 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.01)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >
              Postpone to Next Month
            </button>
            <button onClick={onProceed} style={{
              width: "100%", height: 56, borderRadius: 9999,
              background: "transparent",
              border: "2px solid rgba(255,255,255,0.15)", cursor: "pointer",
              color: "#94A3B8", fontSize: 16, fontWeight: 600,
              transition: "border-color 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"}
            >
              Continue to Buy
            </button>
          </>
        ) : (
          <>
            <button onClick={onRetry} style={{
              width: "100%", height: 56, borderRadius: 9999,
              background: "#22c55e", border: "none", cursor: "pointer",
              color: "#fff", fontSize: 16, fontWeight: 800,
              boxShadow: "0 8px 24px rgba(34,197,94,0.3)",
              transition: "transform 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.01)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >
              Confirm Purchase
            </button>
            <button onClick={onBack} style={{
              width: "100%", height: 56, borderRadius: 9999,
              background: "transparent",
              border: "2px solid #E2E8F0", cursor: "pointer",
              color: "#64748B", fontSize: 16, fontWeight: 600,
            }}>
              Go Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Proceed Anyway Screen ─────────────────────────────────────────────────
function ProceedAnywayScreen({ itemName, amount, duration, onDone }) {
  const [checked, setChecked]   = useState(false);
  const [countdown, setCountdown] = useState(null); // null = not started, 7..0
  const [proceeded, setProceeded] = useState(false);

  const hoursOfWork = Math.round(amount / 15); // assume $15/hr wage
  const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleProceed = () => {
    if (!checked) return;
    setProceeded(true);
    setCountdown(7);
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) { onDone(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", flex: 1,
      background: "#f8f6f6", fontFamily: "Inter, sans-serif",
      animation: "fadeSlideUp 0.3s ease both",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "52px 24px 8px" }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", margin: 0 }}>Proceed Anyway</h2>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 140px" }}>

        {/* Big headline */}
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#0F172A", margin: "24px 0 24px", letterSpacing: "-0.025em", lineHeight: 1.15 }}>
          Choice Confirmed:<br/>Financial Shackles On.
        </h1>

        {/* Work timer card */}
        <div style={{
          background: "#E2E8F0", borderRadius: 12, padding: "24px",
          borderLeft: "4px solid #d41111", marginBottom: 16,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#d41111", fontVariationSettings: "'FILL' 1" }}>schedule</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#d41111", textTransform: "uppercase", letterSpacing: "0.1em" }}>Work Timer</span>
          </div>
          <p style={{ fontSize: 32, fontWeight: 800, color: "#0F172A", margin: "0 0 10px", letterSpacing: "-0.02em" }}>{hoursOfWork} Hours</p>
          <p style={{ fontSize: 14, color: "#475569", margin: 0, lineHeight: 1.6 }}>
            You aren't buying a product; you are selling <strong>{hoursOfWork} hours</strong> of your life to a billionaire.
          </p>
        </div>

        {/* Lifestyle card */}
        <div style={{
          background: "#fff", borderRadius: 12, padding: "20px",
          border: "1px solid #E2E8F0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", marginBottom: 24,
          display: "flex", alignItems: "flex-start", gap: 16,
        }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: "#64748B" }}>restaurant_menu</span>
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 4px" }}>Current Lifestyle: Instant Noodles Mode</p>
            <p style={{ fontSize: 13, color: "#94A3B8", margin: 0 }}>Welcome to the struggle.</p>
          </div>
        </div>

        {/* Shame checkbox */}
        <div
          onClick={() => !proceeded && setChecked(c => !c)}
          style={{
            background: checked ? "rgba(212,17,17,0.08)" : "rgba(212,17,17,0.05)",
            border: `1.5px solid ${checked ? "rgba(212,17,17,0.3)" : "rgba(212,17,17,0.15)"}`,
            borderRadius: 12, padding: "16px", marginBottom: 32,
            display: "flex", alignItems: "flex-start", gap: 12, cursor: proceeded ? "default" : "pointer",
            transition: "background 0.2s, border-color 0.2s",
          }}
        >
          <div style={{
            width: 20, height: 20, borderRadius: 4, flexShrink: 0, marginTop: 1,
            border: `2px solid ${checked ? "#d41111" : "#CBD5E1"}`,
            background: checked ? "#d41111" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
          }}>
            {checked && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <p style={{ fontSize: 14, color: "#334155", margin: 0, lineHeight: 1.55, fontWeight: 500 }}>
            I admit I am being a slave to my impulses and I accept the stress this will cause me later.
          </p>
        </div>

        {/* Countdown message */}
        {proceeded && countdown !== null && (
          <div style={{
            textAlign: "center", padding: "16px", background: "rgba(212,17,17,0.06)",
            borderRadius: 12, border: "1px solid rgba(212,17,17,0.15)", marginBottom: 16,
            animation: "fadeSlideUp 0.3s ease both",
          }}>
            <p style={{ fontSize: 13, color: "#d41111", fontWeight: 600, margin: 0 }}>
              Returning to dashboard in <strong>{countdown}s</strong>… Your financial health is now in critical state.
            </p>
          </div>
        )}
      </div>

      {/* CTA */}
      <div style={{
        position: "sticky", bottom: 0, padding: "12px 20px 32px",
        background: "rgba(248,246,246,0.95)", backdropFilter: "blur(12px)",
        borderTop: "1px solid #E2E8F0",
      }}>
        <button
          onClick={handleProceed}
          disabled={!checked || proceeded}
          style={{
            width: "100%", height: 56, borderRadius: 9999,
            background: checked && !proceeded ? "#0F172A" : "#94A3B8",
            border: "none", cursor: checked && !proceeded ? "pointer" : "not-allowed",
            color: "#fff", fontSize: 16, fontWeight: 700,
            opacity: checked && !proceeded ? 1 : 0.6,
            transition: "background 0.3s, opacity 0.3s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {proceeded
            ? <><span className="material-symbols-outlined" style={{ fontSize: 18, animation: "spin 0.9s linear infinite" }}>autorenew</span> Redirecting in {countdown}s…</>
            : "Proceed to Struggle"
          }
        </button>
      </div>
    </div>
  );
}

// ── Simulation: Main Form ──────────────────────────────────────────────────
function SimulationPage({ onBack, onPostpone, onProceed }) {
  const [itemName, setItemName]   = useState("MacBook Air M2");
  const [amount, setAmount]       = useState(1200);
  const [amountDisplay, setAmountDisplay] = useState("1,200.00");
  const [provider, setProvider]   = useState("grab");
  const [duration, setDuration]   = useState(6);
  const [durationRaw, setDurationRaw] = useState("6");
  const [interest, setInterest]   = useState(0);
  const [interestRaw, setInterestRaw] = useState("0");
  const [screen, setScreen]       = useState("form"); // "form" | "loading" | "result" | "proceed"
  const [progress, setProgress]   = useState(0);

  const SAFETY_BUFFER = 1240.50;
  const monthlyPay    = (amount / (duration || 1)) * (1 + (interest || 0) / 100);
  const bufferImpact  = Math.round((monthlyPay / SAFETY_BUFFER) * 100);
  const totalImpact   = Math.round((amount / SAFETY_BUFFER) * 100);
  const isHighRisk    = totalImpact >= 50;

  const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleAmountFocus = (e) => { e.target.value = String(amount); e.target.select(); };
  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/[^0-9.]/g, "");
    setAmountDisplay(raw);
    const v = parseFloat(raw);
    if (!isNaN(v) && v > 0) setAmount(v);
  };
  const handleAmountBlur = () => { setAmountDisplay(fmt(amount)); };

  const handleAnalyze = () => {
    if (!itemName.trim()) return;
    setScreen("loading");
    setProgress(0);
    // Animate progress bar: 0→65% quickly, then slow to 90%, then jump to 100 on done
    const steps = [
      { target: 30, delay: 0,   dur: 300 },
      { target: 65, delay: 300, dur: 400 },
      { target: 88, delay: 700, dur: 600 },
    ];
    steps.forEach(({ target, delay }) => {
      setTimeout(() => setProgress(target), delay);
    });
    setTimeout(() => {
      setProgress(100);
      setTimeout(() => setScreen("result"), 350);
    }, 1600);
  };

  const providers = [
    { id: "grab",   label: "Grab"   },
    { id: "shopee", label: "Shopee" },
    { id: "atome",  label: "Atome"  },
    { id: "lazada", label: "Lazada" },
  ];

  const providerLabel = providers.find(p => p.id === provider)?.label ?? provider;

  // ── Loading screen ──
  if (screen === "loading") {
    return <SimLoadingScreen progress={progress} />;
  }

  // ── Result screen ──
  if (screen === "result") {
    return (
      <SimResultScreen
        isHighRisk={isHighRisk}
        bufferImpact={bufferImpact}
        totalImpact={totalImpact}
        monthlyPay={monthlyPay}
        amount={amount}
        duration={duration}
        itemName={itemName}
        providerLabel={providerLabel}
        onBack={onBack}
        onRetry={() => setScreen("form")}
        onPostpone={() => onPostpone({ name: itemName, price: amount, provider: providerLabel, duration })}
        onProceed={() => setScreen("proceed")}
      />
    );
  }

  // ── Proceed Anyway screen ──
  if (screen === "proceed") {
    return (
      <ProceedAnywayScreen
        itemName={itemName}
        amount={amount}
        duration={duration}
        onDone={onProceed}
      />
    );
  }

  // ── Form screen ──
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "#fff", fontFamily: "Inter, sans-serif", position: "relative" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", padding: "48px 24px 16px", justifyContent: "space-between", background: "#fff" }}>
        <button
          onClick={onBack}
          style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 24, color: "#0F172A" }}>arrow_back</span>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: 0, flex: 1, textAlign: "center", paddingRight: 40, letterSpacing: "-0.02em" }}>
          New Purchase Simulation
        </h1>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 128px" }}>

        {/* What are you buying */}
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: "0 0 12px", letterSpacing: "-0.01em" }}>
            What are you buying?
          </h3>
          <div style={{ position: "relative" }}>
            <input
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              placeholder="e.g. MacBook Air M2"
              style={{
                width: "100%", height: 56, background: "#F8FAFC",
                border: "none", borderRadius: 12, padding: "0 16px",
                fontSize: 15, fontWeight: 500, color: "#0F172A",
                outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                transition: "box-shadow 0.2s",
              }}
              onFocus={e => e.target.style.boxShadow = "0 0 0 2px rgba(31,249,31,0.5)"}
              onBlur={e => e.target.style.boxShadow = "none"}
            />
          </div>
        </div>

        {/* ── Provider chips ── */}
        <div style={{ display: "flex", gap: 8, marginTop: 16, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
          {providers.map(p => {
            const isActive = provider === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                style={{
                  flexShrink: 0, height: 40, padding: "0 20px",
                  borderRadius: 9999, border: "none", cursor: "pointer",
                  fontSize: 14, fontWeight: isActive ? 600 : 500,
                  background: isActive ? "#1ff91f" : "#F1F5F9",
                  color: isActive ? "#0F172A" : "#64748B",
                  boxShadow: isActive ? "0 4px 14px rgba(31,249,31,0.3)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* ── Amount + Stats ── */}
        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Dark amount card */}
          <div style={{
            background: "#0F172A", borderRadius: 16, padding: "24px",
            display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
          }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.45)", margin: "0 0 4px", letterSpacing: "0.01em" }}>
              Total Purchase Value
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.55)", lineHeight: 1, marginBottom: 4, letterSpacing: "0.02em" }}>MYR</span>
              <input
                type="text" inputMode="decimal"
                value={amountDisplay}
                onFocus={handleAmountFocus}
                onChange={handleAmountChange}
                onBlur={handleAmountBlur}
                style={{
                  background: "transparent", border: "none", outline: "none",
                  fontSize: 36, fontWeight: 700, color: "#fff",
                  width: 180, textAlign: "center", fontFamily: "inherit",
                  letterSpacing: "-0.02em", caretColor: "#1ff91f",
                }}
              />
            </div>
          </div>

          {/* 3-col stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {/* Duration */}
            <div style={{ background: "#F8FAFC", borderRadius: 12, padding: "14px 8px", textAlign: "center" }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>Duration</span>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 3 }}>
                <input
                  type="text" inputMode="numeric" value={durationRaw}
                  onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ""); setDurationRaw(raw); const v = parseInt(raw, 10); if (!isNaN(v) && v > 0 && v <= 60) setDuration(v); }}
                  onFocus={e => e.target.select()}
                  onBlur={() => { if (!durationRaw || parseInt(durationRaw) < 1) { setDurationRaw("1"); setDuration(1); } }}
                  style={{ width: 36, background: "transparent", border: "none", outline: "none", fontSize: 16, fontWeight: 700, color: "#0F172A", textAlign: "center", fontFamily: "inherit", caretColor: "#1ff91f" }}
                />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>mo</span>
              </div>
            </div>

            {/* Monthly Pay */}
            <div style={{ background: "#F8FAFC", borderRadius: 12, padding: "14px 8px", textAlign: "center", borderBottom: "2px solid rgba(31,249,31,0.5)" }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>Monthly Pay</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{`MYR ${fmt(monthlyPay)}`}</span>
            </div>

            {/* Interest */}
            <div style={{ background: "#F8FAFC", borderRadius: 12, padding: "14px 8px", textAlign: "center" }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>Interest</span>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 1 }}>
                <input
                  type="text" inputMode="decimal" value={interestRaw}
                  onChange={e => { const raw = e.target.value.replace(/[^0-9.]/g, ""); setInterestRaw(raw); const v = parseFloat(raw); if (!isNaN(v) && v >= 0 && v <= 100) setInterest(v); }}
                  onFocus={e => e.target.select()}
                  onBlur={() => { if (interestRaw === "" || isNaN(parseFloat(interestRaw))) { setInterestRaw("0"); setInterest(0); } }}
                  style={{ width: 36, background: "transparent", border: "none", outline: "none", fontSize: 16, fontWeight: 700, color: "#0F172A", textAlign: "center", fontFamily: "inherit", caretColor: "#1ff91f" }}
                />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>%</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Guardian Tip — always visible ── */}
        <div style={{
          marginTop: 32,
          background: isHighRisk ? "rgba(239,68,68,0.07)" : "rgba(31,249,31,0.08)",
          border: `1px solid ${isHighRisk ? "rgba(239,68,68,0.25)" : "rgba(31,249,31,0.2)"}`,
          borderRadius: 16, padding: "20px",
          display: "flex", gap: 16,
          transition: "background 0.3s, border-color 0.3s",
        }}>
          <div style={{ paddingTop: 1, flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: isHighRisk ? "#EF4444" : "#1ff91f", fontVariationSettings: "'FILL' 1", transition: "color 0.3s" }}>
              shield_with_heart
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>Guardian Tip</p>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 999,
                background: isHighRisk ? "rgba(239,68,68,0.12)" : "rgba(31,249,31,0.15)",
                color: isHighRisk ? "#DC2626" : "#15803d",
                letterSpacing: "0.04em", textTransform: "capitalize",
              }}>
                {providerLabel}
              </span>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>Balance impact / month</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: isHighRisk ? "#EF4444" : "#0F172A" }}>
                  −MYR {fmt(monthlyPay)} <span style={{ fontSize: 10, fontWeight: 500, color: "#94A3B8" }}>({bufferImpact}%)</span>
                </span>
              </div>
              <div style={{ width: "100%", height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 999,
                  width: `${Math.min(bufferImpact, 100)}%`,
                  background: isHighRisk ? "linear-gradient(90deg,#F87171,#EF4444)" : "linear-gradient(90deg,#86efac,#1ff91f)",
                  transition: "width 0.5s cubic-bezier(.4,0,.2,1), background 0.3s",
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                <span style={{ fontSize: 9, color: "#94A3B8", fontWeight: 500 }}>MYR 0</span>
                <span style={{ fontSize: 9, color: "#94A3B8", fontWeight: 500 }}>MYR 1,240.50 balance</span>
              </div>
            </div>
            <p style={{ fontSize: 12, color: "#475569", margin: 0, lineHeight: 1.7 }}>
              Paying via <strong style={{ color: "#0F172A" }}>{providerLabel}</strong> over{" "}
              <strong style={{ color: "#0F172A" }}>{duration} months</strong> locks{" "}
              <strong style={{ color: isHighRisk ? "#EF4444" : "#1ff91f" }}>{bufferImpact}%</strong>{" "}
              of your balance each month.{" "}
              {isHighRisk
                ? "⚠️ Above 50% — this is a high-risk purchase."
                : "✓ This looks manageable within your current budget."}
            </p>
          </div>
        </div>

        {/* ── Analyse CTA ── */}
        <div style={{ marginTop: 32, display: "flex", justifyContent: "center" }}>
          <button
            onClick={handleAnalyze}
            disabled={!itemName.trim()}
            style={{
              width: "100%", maxWidth: 280, height: 56, borderRadius: 9999,
              background: "#1ff91f", border: "none",
              cursor: itemName.trim() ? "pointer" : "not-allowed",
              color: "#0a2a0a", fontSize: 16, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 8px 20px rgba(31,249,31,0.25)",
              transition: "transform 0.15s",
              letterSpacing: "-0.01em", fontFamily: "inherit",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.02)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
            onMouseDown={e => { e.currentTarget.style.transform = "scale(0.98)"; }}
            onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            <span>Analyse</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Wishlist Page ────────────────────────────────────────────────────────

const WISHLIST_INIT = [
  { id: 1, name: "MacBook Air M4",     price: 1599, saved: 320,  icon: "laptop_mac",    color: "#6366F1", bg: "#EEF2FF", target: "Dec 2025" },
  { id: 2, name: "Sony WH-1000XM6",   price: 380,  saved: 190,  icon: "headphones",    color: "#0EA5E9", bg: "#F0F9FF", target: "Sep 2025" },
  { id: 3, name: "Weekend Getaway",    price: 800,  saved: 50,   icon: "flight_takeoff",color: "#F59E0B", bg: "#FFFBEB", target: "Mar 2026" },
];

function WishlistPage({ onBack, externalItems, onExternalSetItems }) {
  const [internalItems, setInternalItems] = useState(WISHLIST_INIT);
  const items    = externalItems    ?? internalItems;
  const setItems = onExternalSetItems ?? setInternalItems;
  const [showAdd, setShowAdd]     = useState(false);
  const [newName, setNewName]     = useState("");
  const [newPrice, setNewPrice]   = useState("");
  const [newTarget, setNewTarget] = useState("");
  const LIQUIDITY = 1240.50;

  const addItem = () => {
    const price = parseFloat(newPrice);
    if (!newName.trim() || isNaN(price) || price <= 0) return;
    setItems(prev => [...prev, {
      id: Date.now(), name: newName.trim(), price,
      saved: 0, icon: "star", color: "#9333EA", bg: "#F5F3FF",
      target: newTarget.trim() || "—",
    }]);
    setNewName(""); setNewPrice(""); setNewTarget(""); setShowAdd(false);
  };

  const addSavings = (id, amt) => {
    setItems(prev => prev.map(it => it.id === id
      ? { ...it, saved: Math.min(it.saved + amt, it.price) }
      : it));
  };

  const removeItem = (id) => setItems(prev => prev.filter(it => it.id !== id));

  const totalGoal   = items.reduce((s, it) => s + it.price, 0);
  const totalSaved  = items.reduce((s, it) => s + it.saved, 0);
  const liquidityPct = Math.round((totalGoal / LIQUIDITY) * 100);

  const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "#f6f6f8", fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
        borderRadius: "0 0 2rem 2rem",
        padding: "52px 24px 28px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "white", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#9333EA", fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(88,28,135,0.6)" }}>Future Wishlist</span>
          </div>
          <button
            onClick={() => setShowAdd(s => !s)}
            style={{ width: 40, height: 40, borderRadius: "50%", background: "#9333EA", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(147,51,234,0.35)" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#fff" }}>{showAdd ? "close" : "add"}</span>
          </button>
        </div>

        {/* Summary */}
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.65)", borderRadius: 16, padding: "14px 16px", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.5)" }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(88,28,135,0.55)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total Goal</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: "#581C87", margin: 0, letterSpacing: "-0.02em" }}>MYR {fmt(totalGoal)}</p>
          </div>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.65)", borderRadius: 16, padding: "14px 16px", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.5)" }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(88,28,135,0.55)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total Saved</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: "#9333EA", margin: 0, letterSpacing: "-0.02em" }}>MYR {fmt(totalSaved)}</p>
          </div>
        </div>

        {/* Liquidity warning */}
        <div style={{ marginTop: 12, background: liquidityPct > 100 ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.55)", borderRadius: 12, padding: "10px 14px", border: `1px solid ${liquidityPct > 100 ? "rgba(239,68,68,0.25)" : "rgba(147,51,234,0.15)"}`, backdropFilter: "blur(8px)" }}>
          <p style={{ fontSize: 12, color: liquidityPct > 100 ? "#DC2626" : "#7C3AED", margin: 0, fontWeight: 500 }}>
            <span style={{ fontWeight: 700 }}>Guardian: </span>
            Your total wishlist is <strong>{liquidityPct}%</strong> of your current balance (MYR {fmt(LIQUIDITY)}).
            {liquidityPct > 100 ? " Consider spacing out purchases." : " You're on track — keep saving!"}
          </p>
        </div>
      </div>

      {/* Add item form */}
      {showAdd && (
        <div style={{ margin: "16px 16px 0", background: "#fff", borderRadius: 20, padding: 20, border: "1.5px solid #E9D5FF", boxShadow: "0 4px 20px rgba(147,51,234,0.1)", animation: "fadeSlideUp 0.25s ease both" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#581C87", margin: "0 0 14px" }}>Add Wish Item</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Item name (e.g. PS5)"
              style={{ height: 44, border: "1.5px solid #E2E8F0", borderRadius: 10, padding: "0 14px", fontSize: 14, outline: "none", fontFamily: "inherit", color: "#0F172A", background: "#F8FAFC" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <input value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="Price ($)" type="number"
                style={{ flex: 1, height: 44, border: "1.5px solid #E2E8F0", borderRadius: 10, padding: "0 14px", fontSize: 14, outline: "none", fontFamily: "inherit", color: "#0F172A", background: "#F8FAFC" }} />
              <input value={newTarget} onChange={e => setNewTarget(e.target.value)} placeholder="Target (e.g. Jun 2026)"
                style={{ flex: 1, height: 44, border: "1.5px solid #E2E8F0", borderRadius: 10, padding: "0 14px", fontSize: 14, outline: "none", fontFamily: "inherit", color: "#0F172A", background: "#F8FAFC" }} />
            </div>
            <button onClick={addItem} style={{ height: 44, background: "#9333EA", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(147,51,234,0.3)" }}>
              Add to Wishlist
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 112px" }}>
        {items.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 24px", color: "#94A3B8" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: "#DDD6FE", display: "block", marginBottom: 12 }}>auto_awesome</span>
            <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px", color: "#7C3AED" }}>Your wishlist is empty</p>
            <p style={{ fontSize: 13, margin: 0 }}>Tap + to add your first dream item.</p>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {items.map(item => {
            const pct = Math.round((item.saved / item.price) * 100);
            const remaining = item.price - item.saved;
            const monthsNeeded = Math.ceil(remaining / (LIQUIDITY * 0.1));
            return (
              <div key={item.id} style={{ background: "#fff", borderRadius: 20, padding: 20, border: "1px solid #F1F5F9", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 24, color: item.color, fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 2px" }}>{item.name}</p>
                    <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>🎯 Target: {item.target}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", margin: "0 0 2px" }}>MYR {fmt(item.price)}</p>
                    <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#CBD5E1" }}>delete</span>
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>Saved: MYR {fmt(item.saved)}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: item.color }}>{pct}%</span>
                  </div>
                  <div style={{ height: 8, background: "#F1F5F9", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${item.color}88, ${item.color})`, borderRadius: 999, transition: "width 0.5s cubic-bezier(.4,0,.2,1)" }} />
                  </div>
                  <p style={{ fontSize: 11, color: "#94A3B8", margin: "5px 0 0", textAlign: "right" }}>
                    MYR {fmt(remaining)} to go · ~{monthsNeeded} mo at 10% balance/mo
                  </p>
                </div>

                {/* Quick-add savings */}
                <div style={{ display: "flex", gap: 6 }}>
                  {[50, 100, 200].map(amt => (
                    <button key={amt} onClick={() => addSavings(item.id, amt)} disabled={item.saved >= item.price}
                      style={{
                        flex: 1, height: 34, borderRadius: 8, border: `1.5px solid ${item.color}33`,
                        background: item.saved >= item.price ? "#F8FAFC" : item.bg,
                        color: item.saved >= item.price ? "#CBD5E1" : item.color,
                        fontSize: 12, fontWeight: 700, cursor: item.saved >= item.price ? "not-allowed" : "pointer",
                      }}>
                      +MYR {amt}
                    </button>
                  ))}
                  <div style={{ flex: 1, height: 34, borderRadius: 8, background: pct >= 100 ? "#DCFCE7" : "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {pct >= 100
                      ? <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#22C55E", fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      : <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8" }}>{pct}% done</span>
                    }
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────

function BottomNav({ active, onSelect }) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-100 z-50">
      <div className="flex justify-between items-end px-6 pt-2 pb-5">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          const activeColor = item.id === "budget" ? "#2563EB" : item.id === "simulation" ? "#16A34A" : item.id === "wishlist" ? "#9333EA" : "#0f3c36";
          const activeBg    = item.id === "budget" ? "rgba(37,99,235,0.12)" : item.id === "simulation" ? "rgba(34,197,94,0.15)" : item.id === "wishlist" ? "rgba(147,51,234,0.12)" : "rgba(19,236,200,0.18)";
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className="flex flex-col items-center gap-1 flex-1 cursor-pointer border-none bg-transparent"
            >
              <div
                className="w-16 h-8 rounded-full flex items-center justify-center transition-colors"
                style={{ background: isActive ? activeBg : "transparent" }}
              >
                <span
                  className="material-symbols-outlined transition-colors"
                  style={{
                    fontSize: 22,
                    fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                    color: isActive ? activeColor : "#9ca3af",
                  }}
                >
                  {item.icon}
                </span>
              </div>
              <span
                className="text-xs transition-colors"
                style={{
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? activeColor : "#9ca3af",
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────


// ─── Profile Page ─────────────────────────────────────────────────────────

function ProfilePage({ onBack, danger }) {
  const [alertsOn, setAlertsOn] = useState(true);

  // Theme tokens — flips entirely when danger is true
  const P       = danger ? "#d41111" : "#2bee6c";   // primary colour
  const Pdark   = danger ? "#7f1d1d" : "#003918";   // dark variant
  const bgBlob  = danger ? "rgba(212,17,17,0.08)"  : "rgba(43,238,108,0.1)";
  const cardBorder = danger ? "rgba(212,17,17,0.15)" : "rgba(43,238,108,0.12)";
  const cardGrad   = danger ? "rgba(212,17,17,0.06)" : "rgba(43,238,108,0.08)";
  const statusText = danger ? "#d41111"  : "#059669";
  const statusIcon = danger ? "warning"  : "shield";
  const statusLabel = danger ? "Guardian Status: Critical" : "Guardian Status: Safe";
  const badgeBg    = danger ? "rgba(212,17,17,0.1)"  : "rgba(43,238,108,0.1)";

  const SwitchToggle = ({ checked, onChange }) => (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 52, height: 32, borderRadius: 999, cursor: "pointer",
        background: checked ? P : "#94A3B8",
        border: `2px solid ${checked ? P : "#94A3B8"}`,
        position: "relative", transition: "background 0.3s, border-color 0.3s", flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute",
        width: checked ? 24 : 16, height: checked ? 24 : 16,
        borderRadius: "50%",
        background: checked ? Pdark : "#e0e0e0",
        top: checked ? 2 : 6, left: checked ? 22 : 6,
        transition: "all 0.3s cubic-bezier(.4,0,.2,1)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill={P}>
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        )}
      </div>
    </div>
  );

  const SettingRow = ({ icon, iconBg, iconColor, title, subtitle, right, border = true }) => (
    <>
      <button style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
        transition: "background 0.15s",
      }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.02)"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: iconColor, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#0F172A", margin: 0 }}>{title}</p>
            {subtitle && <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>{subtitle}</p>}
          </div>
        </div>
        {right}
      </button>
      {border && <div style={{ height: 1, background: "#F1F5F9", marginLeft: 76 }} />}
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: danger ? "#fff5f5" : "#f6f8f6", fontFamily: "Inter, sans-serif", transition: "background 0.8s" }}>

      {/* ── Header bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "52px 16px 12px",
        background: danger ? "rgba(255,245,245,0.96)" : "rgba(246,248,246,0.96)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${danger ? "rgba(212,17,17,0.12)" : "#F1F5F9"}`,
        transition: "background 0.8s, border-color 0.8s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#0F172A" }}>arrow_back</span>
          </button>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: danger ? "#7f1d1d" : "#0F172A", margin: 0, letterSpacing: "-0.01em", transition: "color 0.8s" }}>Guardian Hub</h2>
        </div>
        <button style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: danger ? "rgba(212,17,17,0.08)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", transition: "background 0.8s" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: danger ? "#d41111" : "#0F172A", transition: "color 0.8s" }}>settings</span>
          {danger && <span style={{ position: "absolute", top: 8, right: 8, width: 7, height: 7, borderRadius: "50%", background: "#d41111", boxShadow: "0 0 0 2px #fff5f5", animation: "safe-pulse 1s ease-in-out infinite" }} />}
        </button>
      </div>

      {/* ── Scrollable content ── */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 112, position: "relative" }}>

        {/* Colour blob */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 280, background: `linear-gradient(to bottom, ${bgBlob}, transparent)`, pointerEvents: "none", zIndex: 0, transition: "background 0.8s" }} />

        {/* ── Critical alert banner (danger only) ── */}
        {danger && (
          <div style={{
            margin: "20px 16px 0", padding: "14px 18px",
            background: "rgba(212,17,17,0.08)", border: "1.5px solid rgba(212,17,17,0.2)",
            borderRadius: 14, display: "flex", alignItems: "center", gap: 12,
            animation: "fadeSlideUp 0.4s ease both", zIndex: 1, position: "relative",
          }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(212,17,17,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#d41111", fontVariationSettings: "'FILL' 1" }}>warning</span>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#d41111", margin: "0 0 2px" }}>Critical Financial State</p>
              <p style={{ fontSize: 12, color: "#7f1d1d", margin: 0, opacity: 0.8 }}>Your liquidity is critically low. Avoid new purchases.</p>
            </div>
          </div>
        )}

        {/* ── Avatar section ── */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: danger ? "20px 24px 20px" : "32px 24px 20px", position: "relative", zIndex: 1 }}>
          <div style={{ position: "relative", marginBottom: 16 }}>
            {/* Avatar ring pulses red in danger mode */}
            <div style={{
              width: 128, height: 128, borderRadius: "50%",
              border: `4px solid ${danger ? "#fca5a5" : "#fff"}`,
              boxShadow: danger ? "0 0 0 6px rgba(212,17,17,0.12), 0 4px 20px rgba(0,0,0,0.12)" : "0 4px 20px rgba(0,0,0,0.12)",
              overflow: "hidden",
              background: danger ? "#fee2e2" : "#e2f5ea",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "border-color 0.8s, background 0.8s, box-shadow 0.8s",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 80, color: P, fontVariationSettings: "'FILL' 1", transition: "color 0.8s" }}>account_circle</span>
            </div>
            {/* Badge */}
            <div style={{
              position: "absolute", bottom: 4, right: 4, width: 32, height: 32, borderRadius: "50%",
              background: P, border: "2px solid #fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 2px 8px ${danger ? "rgba(212,17,17,0.4)" : "rgba(43,238,108,0.4)"}`,
              transition: "background 0.8s, box-shadow 0.8s",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#fff", fontVariationSettings: "'FILL' 1" }}>
                {danger ? "warning" : "verified_user"}
              </span>
            </div>
          </div>

          <h1 style={{ fontSize: 32, fontWeight: 600, color: "#0F172A", margin: "0 0 6px", letterSpacing: "-0.02em" }}>Hakim</h1>

          {/* Status badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 14px", borderRadius: 999,
            background: badgeBg, border: `1px solid ${danger ? "rgba(212,17,17,0.2)" : "rgba(43,238,108,0.25)"}`,
            transition: "background 0.8s, border-color 0.8s",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: P, fontVariationSettings: "'FILL' 1", transition: "color 0.8s" }}>{statusIcon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: statusText, transition: "color 0.8s" }}>{statusLabel}</span>
            {danger && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#d41111", animation: "safe-pulse 1s ease-in-out infinite" }} />}
          </div>
        </div>

        {/* ── Liquidity card ── */}
        <div style={{ padding: "0 16px 24px", position: "relative", zIndex: 1 }}>
          <div style={{
            background: "#fff", borderRadius: 20, padding: "20px 24px",
            boxShadow: danger ? "0 1px 4px rgba(212,17,17,0.08), 0 4px 16px rgba(212,17,17,0.06)" : "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
            border: `1px solid ${cardBorder}`,
            position: "relative", overflow: "hidden",
            transition: "border-color 0.8s, box-shadow 0.8s",
          }}>
            <div style={{ position: "absolute", right: 0, top: 0, width: "40%", height: "100%", background: `linear-gradient(to left, ${cardGrad}, transparent)`, pointerEvents: "none", transition: "background 0.8s" }} />
            <p style={{ fontSize: 13, fontWeight: 500, color: "#64748B", margin: "0 0 6px" }}>Liquidity Remaining</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: danger ? "#7f1d1d" : "#0F172A", letterSpacing: "-0.03em", transition: "color 0.8s" }}>
                  {danger ? "MYR 85.00" : "MYR 1,240.50"}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: P, display: "flex", alignItems: "center", gap: 2, transition: "color 0.8s" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{danger ? "trending_down" : "trending_up"}</span>
                  {danger ? "-93.1%" : "+5.2%"}
                </span>
              </div>
              {/* Mini sparkline */}
              <svg width="80" height="36" viewBox="0 0 100 40" fill="none" style={{ flexShrink: 0 }}>
                {danger
                  ? <path d="M0,5 Q20,5 30,10 T50,30 T70,35 T100,38" stroke={P} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  : <path d="M0,35 Q10,35 20,25 T40,20 T60,30 T80,10 T100,5" stroke={P} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                }
                <circle cx="100" cy={danger ? "38" : "5"} r="3.5" fill={P}/>
              </svg>
            </div>
            <p style={{ fontSize: 11, color: danger ? "#d41111" : "#94A3B8", margin: "6px 0 0", fontWeight: danger ? 600 : 400, transition: "color 0.8s" }}>
              {danger ? "⚠️ Critical — avoid new spending" : "Updated just now"}
            </p>
          </div>
        </div>

        {/* ── Section label helper ── */}
        {["Account", "Financial Connections", "Preferences"].map((section, si) => {
          const isAccount = si === 0;
          const isFinancial = si === 1;
          const isPref = si === 2;
          return (
            <div key={section} style={{ padding: `0 16px ${isPref ? "8px" : "20px"}` }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: P, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px 4px", transition: "color 0.8s" }}>{section}</p>
              <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", border: `1px solid ${danger ? "rgba(212,17,17,0.08)" : "#F1F5F9"}`, transition: "border-color 0.8s" }}>
                {isAccount && <>
                  <SettingRow icon="person" iconBg="#EEF2FF" iconColor="#4F6EF7" title="Personal Info" subtitle="Name, email, phone" right={<span className="material-symbols-outlined" style={{ fontSize: 20, color: "#CBD5E1" }}>chevron_right</span>} />
                  <SettingRow icon="lock" iconBg="#F5F3FF" iconColor="#7C3AED" title="Security" subtitle="Password, 2FA, FaceID" right={<span className="material-symbols-outlined" style={{ fontSize: 20, color: "#CBD5E1" }}>chevron_right</span>} border={false} />
                </>}
                {isFinancial && <>
                  <SettingRow
                    icon="account_balance" iconBg="#ECFDF5" iconColor="#059669"
                    title="Bank Sync"
                    subtitle={<span style={{ display: "flex", alignItems: "center", gap: 4, color: "#059669", fontSize: 12, fontWeight: 600 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669", display: "inline-block" }} />Active</span>}
                    right={<span className="material-symbols-outlined" style={{ fontSize: 20, color: "#CBD5E1" }}>chevron_right</span>}
                  />
                  <SettingRow
                    icon="credit_score" iconBg={danger ? "#FEF2F2" : "#FFF7ED"} iconColor={danger ? "#d41111" : "#EA580C"}
                    title="BNPL Providers"
                    subtitle={<span style={{ color: danger ? "#d41111" : "#64748B", fontSize: 12, fontWeight: danger ? 600 : 400 }}>
                      {danger ? "⚠️ High utilisation detected" : "3 connected"}
                    </span>}
                    right={
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ display: "flex" }}>
                          {["G","S","+1"].map((l,i) => (
                            <div key={i} style={{ width: 24, height: 24, borderRadius: "50%", background: danger ? "#fecaca" : "#E2E8F0", border: "2px solid #fff", marginLeft: i > 0 ? -8 : 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: danger ? "#d41111" : "#475569" }}>{l}</div>
                          ))}
                        </div>
                        <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#CBD5E1" }}>chevron_right</span>
                      </div>
                    }
                    border={false}
                  />
                </>}
                {isPref && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#DC2626", fontVariationSettings: "'FILL' 1" }}>notification_important</span>
                      </div>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 600, color: "#0F172A", margin: 0 }}>High-Risk Alerts</p>
                        <p style={{ fontSize: 12, color: danger ? "#d41111" : "#64748B", margin: "2px 0 0", fontWeight: danger ? 600 : 400 }}>
                          {danger ? "Active — critical state detected" : "Notify when spending is risky"}
                        </p>
                      </div>
                    </div>
                    <SwitchToggle checked={alertsOn} onChange={setAlertsOn} />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* ── Footer ── */}
        <div style={{ padding: "16px 24px 32px", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: danger ? "#d41111" : "#94A3B8", margin: "0 0 10px", fontWeight: danger ? 600 : 400, transition: "color 0.8s" }}>
            {danger
              ? "⚠️ Your Guardian Angel is on high alert"
              : "Your Guardian Angel has your back since Jan 2024"}
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: danger ? "#fca5a5" : "#CBD5E1", transition: "background 0.8s" }} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [activeNav, setActiveNav] = useState("home");
  const [wishlistItems, setWishlistItems] = useState(WISHLIST_INIT);
  const [dangerMode, setDangerMode] = useState(false);

  const handleProceed = () => {
    setDangerMode(true);
    setActiveNav("home");
  };

  const handlePostpone = ({ name, price, provider, duration }) => {
    const PROVIDER_META = {
      Grab:   { icon: "local_shipping", color: "#00B14F", bg: "#00B14F1A" },
      Shopee: { icon: "shopping_bag",   color: "#EE4D2D", bg: "#EE4D2D1A" },
      Atome:  { icon: "credit_score",   color: "#EAB308", bg: "#FEF08A33" },
      Lazada: { icon: "storefront",     color: "#0F146D", bg: "#0F146D1A" },
    };
    const meta = PROVIDER_META[provider] || { icon: "star", color: "#9333EA", bg: "#F5F3FF" };
    const newItem = {
      id: Date.now(),
      name,
      price,
      saved: 0,
      icon: meta.icon,
      color: meta.color,
      bg: meta.bg,
      target: "Next Month",
    };
    setWishlistItems(prev => [...prev, newItem]);
    setActiveNav("wishlist");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Google+Sans+Display:wght@400;500;700&family=Google+Sans+Text:wght@400;500;700&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
        .font-google-display { font-family: 'Google Sans Display', 'Inter', sans-serif; }
        .font-google-text    { font-family: 'Google Sans Text',    'Inter', sans-serif; }
        body {
          font-family: 'Inter', sans-serif;
          background: #c8e8e3;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
        }
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-weight: normal; font-style: normal; font-size: 24px;
          line-height: 1; letter-spacing: normal; text-transform: none;
          display: inline-block; white-space: nowrap;
          direction: ltr; -webkit-font-smoothing: antialiased;
        }
        @keyframes safe-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.85); }
        }
        .safe-dot { animation: safe-pulse 2s ease-in-out infinite; }
        @keyframes notif-shake {
          0%,100% { transform: rotate(0deg); }
          20%      { transform: rotate(-12deg); }
          40%      { transform: rotate(12deg); }
          60%      { transform: rotate(-8deg); }
          80%      { transform: rotate(8deg); }
        }
        .notif-icon:hover { animation: notif-shake 0.5s ease; }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Phone shell */}
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          minHeight: 884,
          background: dangerMode ? "#fff5f5" : "#f6f8f8",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: "2.5rem",
          boxShadow: dangerMode ? "0 48px 120px rgba(212,17,17,0.25)" : "0 48px 120px rgba(0,0,0,0.22)",
          margin: "0 auto",
          position: "relative",
          transition: "background 1s, box-shadow 1s",
        }}
      >
        {/* ── Page Content ── */}
        {activeNav === "budget" ? (
          <BudgetPage onBack={() => setActiveNav("home")} />
        ) : activeNav === "simulation" ? (
          <SimulationPage onBack={() => setActiveNav("home")} onPostpone={handlePostpone} onProceed={handleProceed} />
        ) : activeNav === "wishlist" ? (
          <WishlistPage onBack={() => setActiveNav("home")} externalItems={wishlistItems} onExternalSetItems={setWishlistItems} />
        ) : activeNav === "profile" ? (
          <ProfilePage onBack={() => setActiveNav("home")} danger={dangerMode} />
        ) : (
          <>
        {/* ── Header ── */}
        <header
          style={{
            background: dangerMode
              ? "linear-gradient(155deg, #fecaca 0%, #fee2e2 60%, #fff5f5 100%)"
              : "linear-gradient(155deg, #cdfaf3 0%, #e2f9f5 60%, #edfcf9 100%)",
            borderRadius: "0 0 2.5rem 2.5rem",
            paddingTop: 48,
            paddingBottom: 32,
            paddingLeft: 24,
            paddingRight: 24,
            transition: "background 1s ease",
          }}
        >
          {/* Top bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 22, color: dangerMode ? "#d41111" : "#13ecc8", fontVariationSettings: "'FILL' 1", transition: "color 1s" }}
                >
                  {dangerMode ? "shield_with_heart" : "shield"}
                </span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: dangerMode ? "rgba(150,20,20,0.7)" : "rgba(15,60,54,0.6)", transition: "color 1s" }}>
                {dangerMode ? "Critical State" : "Guardian Mode"}
              </span>
            </div>
            <button
              className="notif-icon"
              style={{
                width: 40, height: 40, borderRadius: "50%",
                background: dangerMode ? "rgba(212,17,17,0.1)" : "transparent", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: dangerMode ? "#d41111" : "#0f3c36" }}>
                notifications
              </span>
              {dangerMode && (
                <span style={{
                  position: "absolute", top: 6, right: 6, width: 8, height: 8,
                  borderRadius: "50%", background: "#d41111",
                  boxShadow: "0 0 0 2px #fff",
                  animation: "safe-pulse 1s ease-in-out infinite",
                }} />
              )}
            </button>
          </div>

          {/* Balance */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            {dangerMode && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 14px", borderRadius: 999, marginBottom: 10,
                background: "rgba(212,17,17,0.1)", border: "1px solid rgba(212,17,17,0.2)",
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%", background: "#d41111",
                  display: "inline-block", animation: "safe-pulse 1s ease-in-out infinite",
                }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: "#d41111", letterSpacing: "0.1em", textTransform: "uppercase" }}>Critical Low</span>
              </div>
            )}
            <p className="font-google-text" style={{ color: dangerMode ? "rgba(150,20,20,0.6)" : "rgba(15,60,54,0.55)", fontSize: 16, fontWeight: 500, marginBottom: 4, marginTop: 0, letterSpacing: "0.01em", transition: "color 1s" }}>
              Your Balance
            </p>
            <p className="font-google-display" style={{ fontSize: 48, fontWeight: 700, color: dangerMode ? "#7f1d1d" : "#0f3c36", letterSpacing: "-0.02em", lineHeight: 1, margin: 0, marginBottom: 20, transition: "color 1s" }}>
              {dangerMode ? "MYR 85.00" : "MYR 1,240.50"}
            </p>

            {/* ── Animated ECG Canvas ── */}
            <div style={{ width: "100%", marginBottom: 16 }}>
              <EcgCanvas color={dangerMode ? "#ba1a1a" : "#13ecc8"} />
            </div>

            {/* Status badge */}
            <div
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "6px 16px",
                background: "rgba(255,255,255,0.65)",
                backdropFilter: "blur(8px)",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.5)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              <div className="safe-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: dangerMode ? "#d41111" : "#22c55e", transition: "background 1s" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: dangerMode ? "#d41111" : "#15803d", fontFamily: "'Inter', sans-serif", letterSpacing: "0.01em", transition: "color 1s" }}>
                {dangerMode ? "Critical State" : "Safe State"}
              </span>
            </div>
          </div>
        </header>

        {/* ── Main ── */}
        <main style={{ flex: 1, padding: "24px 16px 112px", overflowY: "auto" }}>

          {/* Shadow Debt Stack */}
          <section style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, padding: "0 4px" }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111", margin: 0 }}>
                {dangerMode ? "Credit Utilization" : "Shadow Debt Stack"}
              </h2>
              <button style={{ fontSize: 14, fontWeight: 600, color: dangerMode ? "#d41111" : "#13ecc8", background: "none", border: "none", cursor: "pointer" }}>
                View All
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {DEBT_STACK.map((item) => <DebtCard key={item.id} item={item} danger={dangerMode} />)}
            </div>
          </section>

          {/* Simulate CTA */}
          <button
            onClick={() => setActiveNav("simulation")}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 16,
              padding: "20px 20px",
              background: dangerMode
                ? "linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)"
                : "linear-gradient(135deg, #ccfbf4 0%, #d9fdf8 100%)",
              border: `1.5px solid ${dangerMode ? "rgba(212,17,17,0.2)" : "rgba(19,236,200,0.25)"}`,
              borderRadius: 20, cursor: "pointer",
              boxShadow: dangerMode ? "0 2px 12px rgba(212,17,17,0.1)" : "0 2px 12px rgba(19,236,200,0.12)",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.01)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            <div
              style={{
                width: 56, height: 56, borderRadius: "50%",
                background: dangerMode ? "#d41111" : "#13ecc8",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: dangerMode ? "0 4px 16px rgba(212,17,17,0.4)" : "0 4px 16px rgba(19,236,200,0.45)",
                flexShrink: 0,
                transition: "background 1s",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 30, color: "#fff", fontWeight: 700 }}>add</span>
            </div>
            <div style={{ textAlign: "left", flex: 1 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: dangerMode ? "#7f1d1d" : "#0f3c36", margin: 0, transition: "color 1s" }}>Simulate a new purchase</p>
              <p style={{ fontSize: 13, color: dangerMode ? "rgba(150,20,20,0.55)" : "rgba(15,60,54,0.55)", margin: "2px 0 0", transition: "color 1s" }}>Check impact on your liquidity</p>
            </div>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: dangerMode ? "rgba(150,20,20,0.35)" : "rgba(15,60,54,0.35)", transition: "color 1s" }}>arrow_forward</span>
          </button>
        </main>
          </>
        )}

        {/* ── Bottom Nav ── */}
        <BottomNav active={activeNav} onSelect={setActiveNav} />
      </div>
    </>
  );
}
