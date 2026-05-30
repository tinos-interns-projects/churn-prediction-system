import { useState } from "react";
import {
  RadialBarChart, RadialBar, PolarAngleAxis,
  RadarChart, Radar, PolarGrid, PolarRadiusAxis,
  PieChart, Pie, Cell,
  Tooltip, ResponsiveContainer,
} from "recharts";

/* ─── Design tokens ─────────────────────────────────────────────────── */
const C = {
  bg:        "#080d18",
  surface:   "#0f1724",
  surfaceHi: "#141f33",
  border:    "#1c2b45",
  accent:    "#38bdf8",
  accentLo:  "#0ea5e9",
  indigo:    "#818cf8",
  warn:      "#fbbf24",
  danger:    "#f43f5e",
  safe:      "#34d399",
  text:      "#e2eeff",
  muted:     "#5a7298",
  label:     "#8ba3c7",
};

/* ─── Validation rules per field ─────────────────────────────────────
   Each numeric field has: required, min, max, and a message function.
   Range validation only fires if a value IS entered (not blank).       */
const VALIDATION = {
  tenure: {
    required: true,
    min: 0,
    label: "Tenure",
    rangeMsg: "Must be 0 or greater.",
  },

  MonthlyCharges: {
    required: true,
    min: 18.25,
    max: 118.75,
    label: "Monthly Charges",
    rangeMsg: "Must be between $18.25 and $118.75.",
  },

  TotalCharges: {
    required: true,
    min: 0,
    max: 9000,
    label: "Total Charges",
    rangeMsg: "Must be between $0 and $9,000.",
  },
};

/* ─── Field definitions ──────────────────────────────────────────────  */
const FIELDS = [
  {
  key: "tenure",
  label: "Tenure (months)",
  type: "number",
  placeholder: "Enter customer tenure",
  hint: "Typical dataset range: 0–72 months · Dataset avg: 32",
},
  {
    key: "MonthlyCharges",
    label: "Monthly Charges ($)",
    type: "number",
    placeholder: "18.25 – 118.75",
    hint: "Range: $18.25–$118.75 · Dataset avg: $64.76",
  },
  {
    key: "TotalCharges",
    label: "Total Charges ($)",
    type: "number",
    placeholder: "0 – 9000",
    hint: "Lifetime spend · Enter 0 for brand new customers",
  },
  {
    key: "Contract",
    label: "Contract Type",
    type: "select",
    options: ["Month-to-month", "One year", "Two year"],
  },
  {
    key: "InternetService",
    label: "Internet Service",
    type: "select",
    options: ["Fiber optic", "DSL", "No"],
  },
  {
    key: "OnlineSecurity",
    label: "Online Security",
    type: "select",
    options: ["No", "Yes", "No internet service"],
  },
  {
    key: "TechSupport",
    label: "Tech Support",
    type: "select",
    options: ["No", "Yes", "No internet service"],
  },
  {
    key: "PaymentMethod",
    label: "Payment Method",
    type: "select",
    options: [
      "Electronic check",
      "Mailed check",
      "Bank transfer (automatic)",
      "Credit card (automatic)",
    ],
  },
  {
    key: "Dependents",
    label: "Has Dependents",
    type: "select",
    options: ["No", "Yes"],
  },
];

const DEFAULTS = {
  tenure:          "",
  MonthlyCharges:  "",
  TotalCharges:    "",
  Contract:        "Month-to-month",
  InternetService: "Fiber optic",
  OnlineSecurity:  "No",
  TechSupport:     "No",
  PaymentMethod:   "Electronic check",
  Dependents:      "No",
};

/* ─── Validate all fields, return map of key → error string ───────── */
function validateForm(form) {
  const errors = {};

  Object.entries(VALIDATION).forEach(([key, rule]) => {
    const raw = form[key];

    // Empty check
    if (raw === "" || raw === null || raw === undefined) {
      errors[key] = `${rule.label} is required.`;
      return;
    }

    const num = Number(raw);

    // NaN
    if (isNaN(num)) {
      errors[key] = `${rule.label} must be a number.`;
      return;
    }

    // Range check
    if (num < rule.min) {
  errors[key] = rule.rangeMsg;
}

if (rule.max !== undefined && num > rule.max) {
  errors[key] = rule.rangeMsg;
}
  });

  return errors;
}

/* ─── Helpers ────────────────────────────────────────────────────────  */
function riskColor(level) {
  if (level === "High Risk")   return C.danger;
  if (level === "Medium Risk") return C.warn;
  return C.safe;
}

function buildAnalytics(form, result) {
  const tenure  = Number(form.tenure)         || 0;
  const monthly = Number(form.MonthlyCharges) || 0;
  const total   = Number(form.TotalCharges)   || 0;
  const prob    = result.churn_probability;

  const contractScore = form.Contract        === "Month-to-month"    ? 90 : form.Contract        === "One year" ? 45 : 10;
  const internetScore = form.InternetService === "Fiber optic"       ? 75 : form.InternetService === "DSL"      ? 35 : 5;
  const securityScore = form.OnlineSecurity  === "No"                ? 70 : form.OnlineSecurity  === "No internet service" ? 5 : 20;
  const techScore     = form.TechSupport     === "No"                ? 65 : form.TechSupport     === "No internet service" ? 5 : 18;
  const paymentScore  = form.PaymentMethod   === "Electronic check"  ? 80 : form.PaymentMethod   === "Mailed check"        ? 50 : 20;
  const tenureScore =tenure <= 72? Math.max(0, 100 - (tenure / 72) * 100): 0;
  const chargeScore   = Math.min(100, (monthly / 118.75) * 100);
  const depScore      = form.Dependents === "Yes" ? 20 : 60;

  const radarData = [
    { subject: "Contract",     A: contractScore,           fullMark: 100 },
    { subject: "Internet",     A: internetScore,           fullMark: 100 },
    { subject: "Security",     A: securityScore,           fullMark: 100 },
    { subject: "Tech Support", A: techScore,               fullMark: 100 },
    { subject: "Payment",      A: paymentScore,            fullMark: 100 },
    { subject: "Tenure",       A: Math.round(tenureScore), fullMark: 100 },
    { subject: "Charges",      A: Math.round(chargeScore), fullMark: 100 },
    { subject: "Dependents",   A: depScore,                fullMark: 100 },
  ];

  const benchmarkData = [
    { name: "Tenure",      customer: tenure,  avg: 32,      prefix: "",  decimals: 0 },
    { name: "Monthly ($)", customer: +monthly.toFixed(2), avg: 64.76,   prefix: "$", decimals: 2 },
    { name: "Total ($)",   customer: +total.toFixed(2),   avg: 2283.30, prefix: "$", decimals: 2 },
  ];

  const rawFactors = [
    { name: "Contract Type",   impact: contractScore,           key: "contract" },
    { name: "Payment Method",  impact: paymentScore,            key: "payment"  },
    { name: "Tenure Length",   impact: Math.round(tenureScore), key: "tenure"   },
    { name: "Monthly Charges", impact: Math.round(chargeScore), key: "charges"  },
    { name: "Internet Service",impact: internetScore,           key: "internet" },
    { name: "Online Security", impact: securityScore,           key: "security" },
    { name: "Tech Support",    impact: techScore,               key: "tech"     },
    { name: "Dependents",      impact: depScore,                key: "dep"      },
  ].sort((a, b) => b.impact - a.impact);

  const segData = [
    { name: "High Risk (Churned)", value: 26.5, color: C.danger },
    { name: "Med Risk (Retained)", value: 28.0, color: C.warn   },
    { name: "Low Risk (Retained)", value: 29.5, color: C.accent },
    { name: "Very Low Risk",       value: 16.0, color: C.safe   },
  ];

  const customerSegment = prob >= 0.65 ? 0 : prob >= 0.35 ? 1 : prob >= 0.18 ? 2 : 3;

  return { radarData, benchmarkData, rawFactors, segData, customerSegment };
}

/* ─── Gauge ──────────────────────────────────────────────────────────  */
function ProbGauge({ prob, color }) {
  const pct  = Math.round(prob * 100);
  const data = [{ value: pct, fill: color }];
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <RadialBarChart width={200} height={200} innerRadius="68%" outerRadius="100%"
        data={data} startAngle={210} endAngle={-30}>
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "#1c2b45" }} />
      </RadialBarChart>
      <div style={{ position: "absolute", textAlign: "center", pointerEvents: "none" }}>
        <div style={{ fontSize: 38, fontWeight: 800, color, fontFamily: "'Space Mono',monospace", lineHeight: 1 }}>
          {pct}%
        </div>
        <div style={{ fontSize: 10, color: C.muted, marginTop: 5, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          churn risk
        </div>
      </div>
    </div>
  );
}

/* ─── Field ──────────────────────────────────────────────────────────
   Shows:
   • Red border + error text  →  empty required or out-of-range
   • Orange border + warning  →  value is valid but near the edge
   • Normal hint text         →  no issues                           */
function Field({ def, value, onChange, error }) {
  const hasError   = !!error;
  const borderColor = hasError ? C.danger : C.border;

  const base = {
    width: "100%", background: "#0a1020",
    border: `1.5px solid ${borderColor}`, borderRadius: 9,
    color: C.text, padding: "10px 13px", fontSize: 14,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
    transition: "border-color .18s",
  };

  const focus = (e) => (e.target.style.borderColor = C.accent);
  const blur  = (e) => (e.target.style.borderColor = hasError ? C.danger : C.border);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{
        fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
        textTransform: "uppercase",
        color: hasError ? C.danger : C.label,
      }}>
        {def.label}
        {def.type === "number" && (
          <span style={{ color: C.danger, marginLeft: 2 }}>*</span>
        )}
      </label>

      {def.type === "select" ? (
        <select value={value} onChange={e => onChange(def.key, e.target.value)}
          style={{ ...base, cursor: "pointer" }} onFocus={focus} onBlur={blur}>
          {def.options.map(o => (
            <option key={o} value={o} style={{ background: C.surface }}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          type="number"
          placeholder={def.placeholder}
          value={value}
          onChange={e => onChange(def.key, e.target.value)}
          style={base}
          onFocus={focus}
          onBlur={blur}
        />
      )}

      {/* Error message takes priority over hint */}
      {hasError ? (
        <span style={{ fontSize: 11, color: C.danger, lineHeight: 1.4, display: "flex", alignItems: "center", gap: 4 }}>
          ⚠ {error}
        </span>
      ) : (
        def.hint && (
          <span style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{def.hint}</span>
        )
      )}
    </div>
  );
}

/* ─── Stat chip ──────────────────────────────────────────────────────  */
function Chip({ label, value, color }) {
  return (
    <div style={{
      background: "#0a1020", border: `1px solid ${color}30`,
      borderRadius: 10, padding: "11px 15px",
      display: "flex", flexDirection: "column", gap: 3, minWidth: 105,
    }}>
      <span style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
      <span style={{ fontSize: 17, fontWeight: 700, color, fontFamily: "'Space Mono',monospace" }}>{value}</span>
    </div>
  );
}

/* ─── Info bar ───────────────────────────────────────────────────────  */
function InfoBar({ result }) {
  const rc  = riskColor(result.risk_level);
  const msg = result.risk_level === "High Risk"
    ? "⚡ Immediate retention action recommended — loyalty discount or personal outreach."
    : result.risk_level === "Medium Risk"
    ? "📊 Monitor closely. Proactive engagement campaigns may reduce churn likelihood."
    : "✅ Customer appears stable. Continue current strategy.";
  return (
    <div style={{
      width: "100%", padding: "13px 16px",
      background: `${rc}0d`, border: `1px solid ${rc}33`,
      borderRadius: 10, fontSize: 13, color: C.label, lineHeight: 1.65,
    }}>
      {msg}
    </div>
  );
}

/* ─── Dataset note ───────────────────────────────────────────────────  */
function DatasetNote() {
  return (
    <div style={{
      background: C.surfaceHi, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: "14px 18px", fontSize: 12,
      color: C.muted, lineHeight: 1.7,
    }}>
      <span style={{ color: C.label, fontWeight: 600 }}>Dataset facts · </span>
      7,043 Telco customers &nbsp;·&nbsp; 26.5% churn rate &nbsp;·&nbsp;
      scale_pos_weight ≈ 2.77 &nbsp;·&nbsp; 11 blank TotalCharges rows (median-imputed)
    </div>
  );
}

/* ─── Dash card wrapper ──────────────────────────────────────────────  */
function DashCard({ title, subtitle, children, style = {} }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: "20px 22px",
      display: "flex", flexDirection: "column", gap: 14,
      ...style,
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.label, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {title}
        </div>
        {subtitle && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

/* ─── Custom tooltip ─────────────────────────────────────────────────  */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0f1e33", border: `1px solid ${C.border}`,
      borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.text,
    }}>
      <div style={{ color: C.label, marginBottom: 5 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || C.accent, fontWeight: 600 }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
        </div>
      ))}
    </div>
  );
}

/* ─── Analytics Dashboard ────────────────────────────────────────────  */
function AnalyticsDashboard({ form, result }) {
  const rc = riskColor(result.risk_level);
  const { radarData, benchmarkData, rawFactors, segData, customerSegment } =
    buildAnalytics(form, result);

  const topFactors = rawFactors.slice(0, 5);

  function impactColor(val) {
    if (val >= 70) return C.danger;
    if (val >= 45) return C.warn;
    return C.safe;
  }

  return (
    <div style={{ marginTop: 28 }}>
      {/* Section header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, marginBottom: 18,
        paddingBottom: 14, borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `linear-gradient(135deg, ${C.indigo}, ${C.accent})`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
        }}>📊</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}>
            Analytics Dashboard
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            Power BI-style insights · Based on Telco dataset heuristics
          </div>
        </div>
        <div style={{
          marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
          padding: "5px 12px", borderRadius: 999,
          background: `${rc}15`, border: `1px solid ${rc}40`,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%", background: rc,
            animation: "pulse 1.5s ease-in-out infinite",
          }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: rc, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            {result.risk_level}
          </span>
        </div>
      </div>

      {/* Row 1: Radar + Risk Drivers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
        <DashCard title="Risk Profile Radar" subtitle="Higher score = higher churn contribution per factor">
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid stroke={C.border} />
              <PolarAngleAxis dataKey="subject" tick={{ fill: C.label, fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Risk Score" dataKey="A" stroke={rc} fill={rc} fillOpacity={0.18} strokeWidth={2} />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </DashCard>

        <DashCard title="Top Risk Drivers" subtitle="Ranked by churn contribution (higher = more risk)">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
            {topFactors.map((f) => {
              const col = impactColor(f.impact);
              return (
                <div key={f.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: C.label }}>{f.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: col, fontFamily: "'Space Mono',monospace" }}>
                      {f.impact}
                    </span>
                  </div>
                  <div style={{ height: 8, background: C.border, borderRadius: 99, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${f.impact}%`,
                      background: `linear-gradient(90deg, ${col}99, ${col})`,
                      borderRadius: 99, transition: "width 0.8s cubic-bezier(.4,0,.2,1)",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
            {[["High", C.danger], ["Medium", C.warn], ["Low", C.safe]].map(([lbl, col]) => (
              <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: col }} />
                <span style={{ fontSize: 10, color: C.muted }}>{lbl}</span>
              </div>
            ))}
          </div>
        </DashCard>
      </div>

      {/* Row 2: Benchmark + Donut */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18 }}>
        <DashCard title="Customer vs. Dataset Benchmark" subtitle="Blue = this customer · Grey = dataset average">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {benchmarkData.map((metric) => {
              const isAbove  = metric.customer >= metric.avg;
              const pctDiff  = Math.round((metric.customer / metric.avg - 1) * 100);
              const maxVal   = Math.max(metric.customer, metric.avg, 0.01);
              const youPct   = metric.customer > 0 ? Math.max((metric.customer / maxVal) * 100, 10) : 4;
              const avgPct   = Math.max((metric.avg / maxVal) * 100, 10);
              return (
                <div key={metric.name} style={{
                  background: "#0a1020", borderRadius: 10,
                  border: `1px solid ${C.border}`, padding: "12px 10px",
                  display: "flex", flexDirection: "column", gap: 8,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: C.label, fontWeight: 600 }}>{metric.name}</span>
                    {metric.customer > 0 && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, fontFamily: "'Space Mono',monospace",
                        color: isAbove ? C.warn : C.safe,
                        background: isAbove ? `${C.warn}18` : `${C.safe}18`,
                        padding: "2px 6px", borderRadius: 99,
                      }}>
                        {isAbove ? "+" : ""}{pctDiff}%
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 90, padding: "0 14px" }}>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, height: "100%", justifyContent: "flex-end" }}>
                      <div style={{
                        width: "100%", height: `${youPct}%`,
                        background: `linear-gradient(180deg, ${C.accent}, ${C.accentLo})`,
                        borderRadius: "5px 5px 2px 2px",
                      }} />
                      <span style={{ fontSize: 10, color: C.label }}>You</span>
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, height: "100%", justifyContent: "flex-end" }}>
                      <div style={{
                        width: "100%", height: `${avgPct}%`,
                        background: C.muted + "66",
                        borderRadius: "5px 5px 2px 2px",
                      }} />
                      <span style={{ fontSize: 10, color: C.muted }}>Avg</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 2 }}>
                    <div style={{ textAlign: "center", flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.accent, fontFamily: "'Space Mono',monospace" }}>
                        {metric.prefix}{metric.customer.toFixed(metric.decimals)}
                      </div>
                      <div style={{ fontSize: 9, color: C.muted }}>You</div>
                    </div>
                    <div style={{ width: 1, background: C.border }} />
                    <div style={{ textAlign: "center", flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, fontFamily: "'Space Mono',monospace" }}>
                        {metric.prefix}{metric.avg.toFixed(metric.decimals)}
                      </div>
                      <div style={{ fontSize: 9, color: C.muted }}>Avg</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DashCard>

        <DashCard title="Population Segment" subtitle="Where this customer sits in the Telco dataset">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={segData} cx="50%" cy="50%" innerRadius={52} outerRadius={80}
                paddingAngle={3} dataKey="value" strokeWidth={0}>
                {segData.map((entry, i) => (
                  <Cell key={i} fill={entry.color}
                    opacity={i === customerSegment ? 1 : 0.28}
                    stroke={i === customerSegment ? entry.color : "none"}
                    strokeWidth={i === customerSegment ? 2 : 0}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, n) => [`${v}%`, n]}
                contentStyle={{ background: "#0f1e33", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.text }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {segData.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, opacity: i === customerSegment ? 1 : 0.45 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0,
                  boxShadow: i === customerSegment ? `0 0 6px ${s.color}` : "none",
                }} />
                <span style={{ fontSize: 10, color: i === customerSegment ? C.text : C.muted, flex: 1 }}>{s.name}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: i === customerSegment ? s.color : C.muted, fontFamily: "'Space Mono',monospace" }}>
                  {s.value}%
                </span>
                {i === customerSegment && (
                  <span style={{ fontSize: 9, fontWeight: 700, color: s.color, background: `${s.color}20`, padding: "2px 6px", borderRadius: 99, letterSpacing: "0.06em" }}>
                    YOU
                  </span>
                )}
              </div>
            ))}
          </div>
        </DashCard>
      </div>

      {/* Row 3: KPI bar */}
      <div style={{
        marginTop: 18, background: C.surfaceHi, border: `1px solid ${C.border}`,
        borderRadius: 14, padding: "16px 22px",
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0,
      }}>
        {[
          { label: "Churn Probability",  value: `${(result.churn_probability * 100).toFixed(1)}%`, color: rc,      icon: "🎯" },
          { label: "Decision Threshold", value: `${(result.threshold_used * 100).toFixed(1)}%`,    color: C.muted, icon: "⚖️" },
          {
            label: "Margin vs Threshold",
            value: (() => {
              const m = ((result.churn_probability - result.threshold_used) * 100).toFixed(1);
              return m > 0 ? `+${m}%` : `${m}%`;
            })(),
            color: result.churn_probability > result.threshold_used ? C.danger : C.safe,
            icon: "📐",
          },
          { label: "Risk Classification", value: result.risk_level, color: rc, icon: "🔖" },
        ].map((kpi, i, arr) => (
          <div key={i} style={{
            display: "flex", flexDirection: "column", gap: 4, padding: "6px 18px",
            borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : "none",
          }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
              {kpi.icon} {kpi.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: kpi.color, fontFamily: "'Space Mono',monospace" }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────  */
export default function ChurnPredictor() {
  const [form,        setForm]        = useState(DEFAULTS);
  const [result,      setResult]      = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitted,   setSubmitted]   = useState(false); // tracks first submit attempt

  function handleChange(key, val) {
    setForm(f => ({ ...f, [key]: val }));
    setResult(null);
    setError(null);

    // Re-validate this specific field live after first submit attempt
    if (submitted) {
      const rule = VALIDATION[key];
      if (!rule) return;
      const newErrors = { ...fieldErrors };
      if (val === "" || val === null) {
        newErrors[key] = `${rule.label} is required.`;
      } else {
        const num = Number(val);
        if (isNaN(num)) {
          newErrors[key] = `${rule.label} must be a number.`;
        } else if (num < rule.min || num > rule.max) {
          newErrors[key] = rule.rangeMsg;
        } else {
          delete newErrors[key];
        }
      }
      setFieldErrors(newErrors);
    }
  }

  async function handlePredict() {
    setSubmitted(true);
    const errors = validateForm(form);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Please fix the highlighted fields before predicting.");
      return;
    }

    setFieldErrors({});
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tenure:         Number(form.tenure),
          MonthlyCharges: Number(form.MonthlyCharges),
          TotalCharges:   Number(form.TotalCharges),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err.message || "Prediction failed — is the Flask backend running on port 5000?");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setForm(DEFAULTS);
    setResult(null);
    setError(null);
    setFieldErrors({});
    setSubmitted(false);
  }

  const rc           = result ? riskColor(result.risk_level) : C.accent;
  const errorCount   = Object.keys(fieldErrors).length;

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.text,
      fontFamily: "'DM Sans','Segoe UI',sans-serif",
      padding: "36px 20px", boxSizing: "border-box",
    }}>
      <link rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" />

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 32, borderBottom: `1px solid ${C.border}`, paddingBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: `linear-gradient(135deg, ${C.accent}, #818cf8)`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            }}>⚡</div>
            <h1 style={{
              margin: 0, fontSize: 27, fontWeight: 800, letterSpacing: "-0.025em",
              background: `linear-gradient(100deg, ${C.accent} 0%, #818cf8 100%)`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>Churn Intelligence</h1>
          </div>
          <p style={{ margin: 0, color: C.muted, fontSize: 13 }}>
            XGBoost classifier · Youden's J threshold · Telco dataset · Power BI Analytics
          </p>
        </div>

        {/* ── Form + Result ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: result ? "1fr 340px" : "1fr",
          gap: 22, alignItems: "start",
        }}>
          {/* Form panel */}
          <div style={{
            background: C.surface, border: `1px solid ${errorCount > 0 ? C.danger + "55" : C.border}`,
            borderRadius: 16, padding: 26,
            transition: "border-color .2s",
          }}>
            {/* Form header row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>
                Customer Profile
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {errorCount > 0 && (
                  <span style={{
                    fontSize: 11, color: C.danger, fontWeight: 600,
                    background: `${C.danger}12`, border: `1px solid ${C.danger}33`,
                    padding: "3px 10px", borderRadius: 999,
                  }}>
                    {errorCount} field{errorCount > 1 ? "s" : ""} need attention
                  </span>
                )}
                <span style={{ fontSize: 11, color: C.muted }}>
                  <span style={{ color: C.danger }}>*</span> Required
                </span>
              </div>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "16px 22px", marginBottom: 24,
            }}>
              {FIELDS.map(f => (
                <Field
                  key={f.key}
                  def={f}
                  value={form[f.key]}
                  onChange={handleChange}
                  error={fieldErrors[f.key]}
                />
              ))}
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 11 }}>
              <button onClick={handlePredict} disabled={loading} style={{
                flex: 1, padding: "13px 20px",
                background: loading ? C.accentLo : `linear-gradient(135deg, ${C.accent}, ${C.accentLo})`,
                border: "none", borderRadius: 10,
                color: "#000d1a", fontSize: 14, fontWeight: 800,
                cursor: loading ? "not-allowed" : "pointer",
                letterSpacing: "0.02em", fontFamily: "inherit",
                transition: "opacity .2s",
              }}>
                {loading ? "Predicting…" : "Predict Churn"}
              </button>
              <button onClick={handleReset} style={{
                padding: "13px 20px",
                background: "transparent", border: `1.5px solid ${C.border}`,
                borderRadius: 10, color: C.muted, fontSize: 14,
                fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                transition: "border-color .18s, color .18s",
              }}
                onMouseEnter={e => { e.target.style.borderColor = C.accent; e.target.style.color = C.accent; }}
                onMouseLeave={e => { e.target.style.borderColor = C.border; e.target.style.color = C.muted; }}>
                Reset
              </button>
            </div>

            {/* Global error banner */}
            {error && (
              <div style={{
                marginTop: 14, padding: "12px 16px",
                background: "#f43f5e12", border: `1px solid ${C.danger}44`,
                borderRadius: 9, color: C.danger, fontSize: 13, lineHeight: 1.5,
                display: "flex", alignItems: "flex-start", gap: 8,
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>⚠</span>
                <span>{error}</span>
              </div>
            )}

            <div style={{ marginTop: 20 }}>
              <DatasetNote />
            </div>
          </div>

          {/* Result panel */}
          {result && (
            <div style={{
              background: C.surface, border: `1.5px solid ${rc}33`,
              borderRadius: 16, padding: 26,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 18,
              animation: "fadeIn .38s ease",
            }}>
              <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Prediction Result
              </h2>
              <ProbGauge prob={result.churn_probability} color={rc} />
              <div style={{
                padding: "8px 22px", borderRadius: 999,
                background: `${rc}18`, border: `1px solid ${rc}55`,
                color: rc, fontWeight: 700, fontSize: 14, letterSpacing: "0.05em",
              }}>
                {result.risk_level}
              </div>
              <div style={{
                fontSize: 21, fontWeight: 800, letterSpacing: "-0.01em",
                color: result.churn_prediction === "Churn" ? C.danger : C.safe,
                fontFamily: "'Space Mono',monospace",
              }}>
                {result.churn_prediction === "Churn" ? "🔴 Will Churn" : "🟢 Will Retain"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 9, justifyContent: "center" }}>
                <Chip label="Probability"    value={`${(result.churn_probability * 100).toFixed(1)}%`} color={rc} />
                <Chip label="Threshold used" value={`${(result.threshold_used * 100).toFixed(1)}%`}   color={C.muted} />
              </div>
              <InfoBar result={result} />
              <div style={{ fontSize: 11, color: C.muted, textAlign: "center", lineHeight: 1.6 }}>
                Threshold computed via Youden's J (max TPR−FPR) on the held-out test set.
              </div>
            </div>
          )}
        </div>

        {/* Analytics Dashboard — only shown after a successful prediction */}
        {result && <AnalyticsDashboard form={form} result={result} />}

        <div style={{ marginTop: 36, textAlign: "center", color: C.muted, fontSize: 11 }}>
          Model: XGBoost · Dataset: WA_Fn-UseC_-Telco-Customer-Churn.csv · Threshold: Youden's J statistic
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #080d18; }
        select option { background: #0f1724; color: #e2eeff; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}