import { useState, useEffect, useRef, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from "recharts";

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const COLORS = ["#00D4AA", "#7B61FF", "#FF6B6B", "#FFB020", "#00B4D8", "#F72585"];
const DARK = {
  bg: "#080C14",
  surface: "#0E1421",
  card: "#131B2E",
  border: "#1E2D45",
  accent: "#00D4AA",
  purple: "#7B61FF",
  text: "#E8F0FE",
  muted: "#64748B",
  danger: "#FF6B6B",
};

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const DEMO_DATASETS = {
  sales: {
    name: "sales_data_2024.csv",
    rows: 1240,
    columns: ["date", "product", "region", "revenue", "units", "category"],
    preview: [
      { date: "2024-01-15", product: "Pro Suite", region: "North", revenue: 12400, units: 31, category: "Software" },
      { date: "2024-01-16", product: "Analytics+", region: "South", revenue: 8900, units: 22, category: "Software" },
      { date: "2024-01-17", product: "Cloud Base", region: "West", revenue: 15600, units: 48, category: "Cloud" },
      { date: "2024-01-18", product: "DataVault", region: "East", revenue: 6700, units: 17, category: "Storage" },
      { date: "2024-01-19", product: "Pro Suite", region: "West", revenue: 9800, units: 25, category: "Software" },
    ],
    stats: { totalRevenue: 2847300, avgOrderValue: 2296, topProduct: "Pro Suite", topRegion: "North" }
  }
};

const SAMPLE_QUESTIONS = [
  "What are the top 5 selling products by revenue?",
  "Show sales trends for the last 6 months",
  "Which region generated the most revenue?",
  "What is the revenue breakdown by category?",
  "Identify any anomalies or drops in sales",
  "Give me business recommendations based on this data",
];

// ─── AI RESPONSE ENGINE ───────────────────────────────────────────────────────
async function callClaudeAPI(question, datasetContext, chatHistory) {
  const systemPrompt = `You are an expert business analytics AI agent. You analyze business datasets and provide actionable insights.

Dataset context: ${JSON.stringify(datasetContext)}

You MUST respond with valid JSON only. No markdown, no backticks, no extra text. Return exactly this structure:
{
  "sql": "SELECT ... FROM dataset ...",
  "summary": "2-3 sentence business insight summary",
  "chartType": "bar|line|pie|area",
  "chartData": [{"name": "...", "value": 0, "label": "..."}],
  "insights": ["insight 1", "insight 2", "insight 3"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "kpis": [{"label": "KPI Name", "value": "formatted value", "trend": "+X%", "up": true}]
}

Rules:
- chartData must have 4-8 data points
- For bar/line/area charts: use {"name": "label", "value": number, "secondary": number (optional)}
- For pie charts: use {"name": "label", "value": number}
- kpis: 2-4 key metrics relevant to the question
- insights: exactly 3 specific insights
- recommendations: exactly 2 actionable recommendations
- Make data realistic and varied based on the question asked
- SQL should reference the actual columns: ${datasetContext?.columns?.join(", ")}`;

  const messages = [
    ...chatHistory.slice(-4).map(m => ({ role: m.role, content: m.content })),
    { role: "user", content: question }
  ];

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages
      })
    });
    const data = await response.json();
    const text = data.content?.map(b => b.text || "").join("") || "";
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (e) {
    // Fallback mock data
    return generateMockResponse(question);
  }
}

function generateMockResponse(question) {
  const q = question.toLowerCase();
  if (q.includes("top") || q.includes("product")) {
    return {
      sql: "SELECT product, SUM(revenue) as total_revenue FROM dataset GROUP BY product ORDER BY total_revenue DESC LIMIT 5",
      summary: "Pro Suite leads revenue generation with $847K, followed by Cloud Base at $623K. Software category dominates with 68% of total revenue.",
      chartType: "bar",
      chartData: [
        { name: "Pro Suite", value: 847300 }, { name: "Cloud Base", value: 623100 },
        { name: "Analytics+", value: 489200 }, { name: "DataVault", value: 312400 }, { name: "Starter", value: 198700 }
      ],
      insights: ["Pro Suite generates 29.8% of total revenue", "Top 2 products account for 51.6% of revenue", "Software category outperforms Cloud 2:1"],
      recommendations: ["Increase Pro Suite marketing budget by 20%", "Bundle Analytics+ with Cloud Base to boost mid-tier sales"],
      kpis: [{ label: "Top Product Revenue", value: "$847K", trend: "+18%", up: true }, { label: "Products Tracked", value: "5", trend: "stable", up: true }]
    };
  }
  if (q.includes("trend") || q.includes("month")) {
    return {
      sql: "SELECT DATE_TRUNC('month', date) as month, SUM(revenue) as revenue FROM dataset GROUP BY month ORDER BY month",
      summary: "Sales show a strong upward trend with 34% growth over 6 months. Q4 acceleration indicates successful product launches.",
      chartType: "area",
      chartData: [
        { name: "Jan", value: 320000 }, { name: "Feb", value: 298000 }, { name: "Mar", value: 385000 },
        { name: "Apr", value: 412000 }, { name: "May", value: 398000 }, { name: "Jun", value: 429000 }
      ],
      insights: ["34% revenue growth over 6 months", "February dip correlates with seasonal slowdown", "June reached all-time monthly high"],
      recommendations: ["Replicate Q2 promotional strategy in Q3", "Address February seasonality with targeted campaigns"],
      kpis: [{ label: "6-Month Growth", value: "+34%", trend: "+34%", up: true }, { label: "Best Month", value: "Jun $429K", trend: "+7.8%", up: true }]
    };
  }
  if (q.includes("region")) {
    return {
      sql: "SELECT region, SUM(revenue) as revenue, COUNT(*) as transactions FROM dataset GROUP BY region ORDER BY revenue DESC",
      summary: "North region leads with $892K revenue (31% of total). Significant opportunity exists in South region which underperforms by 45%.",
      chartType: "pie",
      chartData: [
        { name: "North", value: 892300 }, { name: "West", value: 743200 },
        { name: "East", value: 621400 }, { name: "South", value: 490400 }
      ],
      insights: ["North dominates with 31% revenue share", "West shows fastest growth at +22% QoQ", "South underperforms by 45% vs North"],
      recommendations: ["Expand sales team in South region by 3 reps", "Replicate North's channel strategy in underperforming regions"],
      kpis: [{ label: "Top Region", value: "North $892K", trend: "+12%", up: true }, { label: "Region Gap", value: "45%", trend: "needs work", up: false }]
    };
  }
  return {
    sql: "SELECT category, SUM(revenue) as revenue, AVG(revenue) as avg_deal FROM dataset GROUP BY category",
    summary: "Software dominates with 68% revenue share. Cloud services show strongest growth trajectory at +28% QoQ.",
    chartType: "bar",
    chartData: [
      { name: "Software", value: 1942200 }, { name: "Cloud", value: 623100 }, { name: "Storage", value: 281400 }
    ],
    insights: ["Software represents 68% of total revenue", "Cloud services growing 28% quarter-over-quarter", "Storage is stable but low-growth segment"],
    recommendations: ["Invest in Cloud infrastructure to capitalize on growth", "Consider premium tiers for Software to increase ARPU"],
    kpis: [{ label: "Total Revenue", value: "$2.85M", trend: "+22%", up: true }, { label: "Avg Deal Size", value: "$2,296", trend: "+8%", up: true }]
  };
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Space Grotesk', sans-serif; background: #080C14; color: #E8F0FE; }
  ::-webkit-scrollbar { width: 6px; } 
  ::-webkit-scrollbar-track { background: #0E1421; }
  ::-webkit-scrollbar-thumb { background: #1E2D45; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #00D4AA; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  .fade-in { animation: fadeIn 0.4s ease forwards; }
  .slide-in { animation: slideIn 0.3s ease forwards; }
  .typing-dot { display: inline-block; animation: pulse 1.2s ease infinite; }
  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-dot:nth-child(3) { animation-delay: 0.4s; }
`;

function Spinner() {
  return <div style={{ width: 18, height: 18, border: `2px solid ${DARK.border}`, borderTopColor: DARK.accent, borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />;
}

function KPICard({ label, value, trend, up, delay = 0 }) {
  return (
    <div className="fade-in" style={{ animationDelay: `${delay}ms`, background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 12, padding: "16px 20px", flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 11, color: DARK.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: DARK.text, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: up ? DARK.accent : DARK.danger, fontWeight: 500 }}>{up ? "↑" : "↓"} {trend}</div>
    </div>
  );
}

function SQLBlock({ sql }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ background: "#060A10", border: `1px solid ${DARK.border}`, borderRadius: 8, overflow: "hidden", marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderBottom: `1px solid ${DARK.border}`, background: "#0A1020" }}>
        <span style={{ fontSize: 11, color: DARK.muted, fontFamily: "JetBrains Mono", textTransform: "uppercase" }}>Generated SQL</span>
        <button onClick={() => { navigator.clipboard?.writeText(sql); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          style={{ fontSize: 11, color: copied ? DARK.accent : DARK.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <pre style={{ padding: "12px 14px", fontFamily: "JetBrains Mono", fontSize: 12, color: "#A8D8FF", overflowX: "auto", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{sql}</pre>
    </div>
  );
}

function ChartRenderer({ chartType, chartData }) {
  if (!chartData?.length) return null;
  const h = 240;
  if (chartType === "pie") return (
    <ResponsiveContainer width="100%" height={h}>
      <PieChart><Pie data={chartData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
        {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
      </Pie><Tooltip formatter={v => `$${v.toLocaleString()}`} contentStyle={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 8, color: DARK.text }} /></PieChart>
    </ResponsiveContainer>
  );
  if (chartType === "area") return (
    <ResponsiveContainer width="100%" height={h}>
      <AreaChart data={chartData}><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={DARK.accent} stopOpacity={0.3} /><stop offset="95%" stopColor={DARK.accent} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 3" stroke={DARK.border} /><XAxis dataKey="name" tick={{ fill: DARK.muted, fontSize: 11 }} /><YAxis tick={{ fill: DARK.muted, fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
        <Tooltip formatter={v => `$${v.toLocaleString()}`} contentStyle={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 8, color: DARK.text }} />
        <Area type="monotone" dataKey="value" stroke={DARK.accent} fill="url(#ag)" strokeWidth={2} /></AreaChart>
    </ResponsiveContainer>
  );
  if (chartType === "line") return (
    <ResponsiveContainer width="100%" height={h}>
      <LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke={DARK.border} /><XAxis dataKey="name" tick={{ fill: DARK.muted, fontSize: 11 }} /><YAxis tick={{ fill: DARK.muted, fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
        <Tooltip formatter={v => `$${v.toLocaleString()}`} contentStyle={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 8, color: DARK.text }} />
        <Line type="monotone" dataKey="value" stroke={DARK.accent} strokeWidth={2} dot={{ fill: DARK.accent, r: 4 }} /></LineChart>
    </ResponsiveContainer>
  );
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke={DARK.border} /><XAxis dataKey="name" tick={{ fill: DARK.muted, fontSize: 11 }} /><YAxis tick={{ fill: DARK.muted, fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
        <Tooltip formatter={v => `$${v.toLocaleString()}`} contentStyle={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 8, color: DARK.text }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>{chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar></BarChart>
    </ResponsiveContainer>
  );
}

function ChatMessage({ msg, isLast }) {
  const isUser = msg.role === "user";
  const [showSQL, setShowSQL] = useState(false);

  return (
    <div className={isLast ? "fade-in" : ""} style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {!isUser && <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg, ${DARK.accent}, ${DARK.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>⚡</div>}
        <span style={{ fontSize: 12, color: DARK.muted }}>{isUser ? "You" : "Analytics Agent"}</span>
        {isUser && <div style={{ width: 28, height: 28, borderRadius: "50%", background: DARK.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>👤</div>}
      </div>

      {isUser ? (
        <div style={{ background: `linear-gradient(135deg, ${DARK.purple}22, ${DARK.purple}11)`, border: `1px solid ${DARK.purple}44`, borderRadius: "12px 12px 2px 12px", padding: "12px 16px", maxWidth: "70%", fontSize: 14, lineHeight: 1.6 }}>
          {msg.content}
        </div>
      ) : msg.loading ? (
        <div style={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: "12px 12px 12px 2px", padding: "14px 18px", fontSize: 14 }}>
          <span className="typing-dot" style={{ color: DARK.accent, fontSize: 20 }}>●</span>
          <span className="typing-dot" style={{ color: DARK.accent, fontSize: 20, marginLeft: 4 }}>●</span>
          <span className="typing-dot" style={{ color: DARK.accent, fontSize: 20, marginLeft: 4 }}>●</span>
        </div>
      ) : msg.data ? (
        <div style={{ width: "100%", maxWidth: 720 }}>
          {/* KPIs */}
          {msg.data.kpis?.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              {msg.data.kpis.map((k, i) => <KPICard key={i} {...k} delay={i * 80} />)}
            </div>
          )}
          {/* Summary */}
          <div style={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 12 }}>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: DARK.text }}>{msg.data.summary}</p>
          </div>
          {/* Chart */}
          {msg.data.chartData?.length > 0 && (
            <div style={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: DARK.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Visualization</div>
              <ChartRenderer chartType={msg.data.chartType} chartData={msg.data.chartData} />
            </div>
          )}
          {/* Insights + Recommendations */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div style={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ fontSize: 12, color: DARK.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Key Insights</div>
              {msg.data.insights?.map((ins, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: 13, lineHeight: 1.5, color: DARK.text }}>
                  <span style={{ color: DARK.accent, flexShrink: 0, marginTop: 1 }}>◆</span>{ins}
                </div>
              ))}
            </div>
            <div style={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ fontSize: 12, color: DARK.purple, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Recommendations</div>
              {msg.data.recommendations?.map((rec, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: 13, lineHeight: 1.5, color: DARK.text }}>
                  <span style={{ color: DARK.purple, flexShrink: 0, marginTop: 1 }}>→</span>{rec}
                </div>
              ))}
            </div>
          </div>
          {/* SQL Toggle */}
          <button onClick={() => setShowSQL(!showSQL)} style={{ background: "none", border: `1px solid ${DARK.border}`, color: DARK.muted, padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
            {showSQL ? "Hide SQL" : "View Generated SQL"}
          </button>
          {showSQL && msg.data.sql && <SQLBlock sql={msg.data.sql} />}
        </div>
      ) : (
        <div style={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: "12px 12px 12px 2px", padding: "12px 16px", maxWidth: "80%", fontSize: 14, lineHeight: 1.6 }}>
          {msg.content}
        </div>
      )}
    </div>
  );
}

// ─── PAGES ────────────────────────────────────────────────────────────────────

function LoginPage({ onLogin }) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!email || !password) { setError("Please fill in all fields"); return; }
    setLoading(true); setError("");
    setTimeout(() => {
      setLoading(false);
      onLogin({ email, name: name || email.split("@")[0] });
    }, 900);
  };

  const inp = { width: "100%", background: DARK.surface, border: `1px solid ${DARK.border}`, borderRadius: 8, padding: "12px 16px", color: DARK.text, fontSize: 14, fontFamily: "inherit", outline: "none" };

  return (
    <div style={{ minHeight: "100vh", background: DARK.bg, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
      {/* bg decoration */}
      <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, ${DARK.accent}08 0%, transparent 70%)`, top: "-200px", right: "-200px", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, ${DARK.purple}08 0%, transparent 70%)`, bottom: "-100px", left: "-100px", pointerEvents: "none" }} />

      <div className="fade-in" style={{ width: "100%", maxWidth: 420, padding: 24 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${DARK.accent}, ${DARK.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto 16px" }}>⚡</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: DARK.text }}>DataPulse AI</h1>
          <p style={{ color: DARK.muted, fontSize: 14, marginTop: 6 }}>Business Analytics Agent</p>
        </div>

        <div style={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 16, padding: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24, color: DARK.text }}>{isSignup ? "Create account" : "Welcome back"}</h2>
          {isSignup && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: DARK.muted, display: "block", marginBottom: 6 }}>Full Name</label>
              <input style={inp} placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} />
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: DARK.muted, display: "block", marginBottom: 6 }}>Email</label>
            <input style={inp} type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div style={{ marginBottom: error ? 12 : 20 }}>
            <label style={{ fontSize: 13, color: DARK.muted, display: "block", marginBottom: 6 }}>Password</label>
            <input style={inp} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
          {error && <div style={{ color: DARK.danger, fontSize: 13, marginBottom: 16 }}>{error}</div>}
          <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: "13px", background: `linear-gradient(135deg, ${DARK.accent}, ${DARK.purple})`, border: "none", borderRadius: 8, color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading ? <><Spinner /> Processing...</> : (isSignup ? "Create Account" : "Sign In")}
          </button>
          <div style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: DARK.muted }}>
            {isSignup ? "Already have an account? " : "Don't have an account? "}
            <button onClick={() => setIsSignup(!isSignup)} style={{ color: DARK.accent, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
              {isSignup ? "Sign in" : "Sign up"}
            </button>
          </div>
          <div style={{ marginTop: 16, padding: "10px 14px", background: `${DARK.accent}11`, borderRadius: 8, fontSize: 12, color: DARK.muted, textAlign: "center" }}>
            Demo: any email + password works ✓
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadPage({ onUpload, dataset }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    setUploading(true);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 18;
      if (p >= 100) { clearInterval(iv); setUploading(false); setProgress(0); onUpload(DEMO_DATASETS.sales); return; }
      setProgress(Math.min(p, 95));
    }, 120);
  };

  const onDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); };

  return (
    <div style={{ padding: "32px 40px", maxWidth: 900, margin: "0 auto" }}>
      <div className="fade-in">
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Upload Dataset</h1>
        <p style={{ color: DARK.muted, marginBottom: 32 }}>Upload CSV or Excel files to begin AI-powered analysis</p>

        {!dataset ? (
          <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}
            style={{ border: `2px dashed ${dragging ? DARK.accent : DARK.border}`, borderRadius: 16, padding: "60px 40px", textAlign: "center", cursor: "pointer", transition: "all 0.2s", background: dragging ? `${DARK.accent}08` : "transparent" }}
            onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
            <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Drop your dataset here</h3>
            <p style={{ color: DARK.muted, marginBottom: 20 }}>Supports CSV, Excel (.xlsx, .xls) — up to 50MB</p>
            <button onClick={e => { e.stopPropagation(); handleFile({ name: "demo_sales.csv" }); }}
              style={{ padding: "10px 24px", background: `linear-gradient(135deg, ${DARK.accent}, ${DARK.purple})`, border: "none", borderRadius: 8, color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Load Demo Dataset
            </button>
            {uploading && (
              <div style={{ marginTop: 24 }}>
                <div style={{ height: 4, background: DARK.border, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg, ${DARK.accent}, ${DARK.purple})`, transition: "width 0.1s", borderRadius: 2 }} />
                </div>
                <p style={{ color: DARK.muted, fontSize: 13, marginTop: 8 }}>Processing dataset... {Math.round(progress)}%</p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ background: DARK.card, border: `1px solid ${DARK.accent}44`, borderRadius: 12, padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 24 }}>✅</span>
              <div>
                <div style={{ fontWeight: 600 }}>{dataset.name}</div>
                <div style={{ color: DARK.muted, fontSize: 13 }}>{dataset.rows.toLocaleString()} rows · {dataset.columns.length} columns · Loaded successfully</div>
              </div>
              <button onClick={() => onUpload(null)} style={{ marginLeft: "auto", background: "none", border: `1px solid ${DARK.border}`, color: DARK.muted, padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Replace</button>
            </div>

            {/* Column info */}
            <div style={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 12, padding: "20px", marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, color: DARK.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Schema</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {dataset.columns.map(c => (
                  <span key={c} style={{ background: `${DARK.accent}15`, border: `1px solid ${DARK.accent}33`, color: DARK.accent, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontFamily: "JetBrains Mono" }}>{c}</span>
                ))}
              </div>
            </div>

            {/* Preview table */}
            <div style={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${DARK.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: 14, color: DARK.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Data Preview</h3>
                <span style={{ fontSize: 12, color: DARK.muted }}>Showing 5 of {dataset.rows.toLocaleString()} rows</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#0A1020" }}>
                      {dataset.columns.map(c => (
                        <th key={c} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, color: DARK.muted, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${DARK.border}`, fontFamily: "JetBrains Mono" }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataset.preview.map((row, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${DARK.border}20` }}>
                        {dataset.columns.map(c => (
                          <td key={c} style={{ padding: "10px 16px", fontSize: 13, color: typeof row[c] === "number" ? DARK.accent : DARK.text, fontFamily: typeof row[c] === "number" ? "JetBrains Mono" : "inherit" }}>
                            {typeof row[c] === "number" ? row[c].toLocaleString() : row[c]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardPage({ dataset, chatHistory }) {
  const revenueData = [
    { name: "Jan", value: 320000, prev: 280000 }, { name: "Feb", value: 298000, prev: 295000 },
    { name: "Mar", value: 385000, prev: 310000 }, { name: "Apr", value: 412000, prev: 350000 },
    { name: "May", value: 398000, prev: 370000 }, { name: "Jun", value: 429000, prev: 390000 },
  ];
  const regionData = [{ name: "North", value: 892300 }, { name: "West", value: 743200 }, { name: "East", value: 621400 }, { name: "South", value: 490400 }];
  const catData = [{ name: "Software", value: 1942200 }, { name: "Cloud", value: 623100 }, { name: "Storage", value: 281400 }];

  const kpis = [
    { label: "Total Revenue", value: "$2.85M", trend: "+22%", up: true },
    { label: "Transactions", value: "1,240", trend: "+14%", up: true },
    { label: "Avg Deal Size", value: "$2,296", trend: "+8%", up: true },
    { label: "Top Region", value: "North", trend: "31% share", up: true },
  ];

  return (
    <div style={{ padding: "32px 40px" }}>
      <div className="fade-in">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700 }}>Analytics Dashboard</h1>
            <p style={{ color: DARK.muted, marginTop: 4 }}>{dataset ? `${dataset.name} · ${dataset.rows.toLocaleString()} records` : "No dataset loaded"}</p>
          </div>
          <div style={{ fontSize: 12, color: DARK.muted, background: DARK.card, border: `1px solid ${DARK.border}`, padding: "6px 14px", borderRadius: 20 }}>
            Last updated: just now
          </div>
        </div>

        {!dataset ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: DARK.muted }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <p>Upload a dataset to see your dashboard</p>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24, marginTop: 24 }}>
              {kpis.map((k, i) => <KPICard key={i} {...k} delay={i * 80} />)}
            </div>

            {/* Charts row */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 12, padding: "20px" }}>
                <h3 style={{ fontSize: 13, color: DARK.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Revenue Trend (6 months)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={revenueData}><defs>
                    <linearGradient id="r1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={DARK.accent} stopOpacity={0.3} /><stop offset="95%" stopColor={DARK.accent} stopOpacity={0} /></linearGradient>
                    <linearGradient id="r2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={DARK.purple} stopOpacity={0.2} /><stop offset="95%" stopColor={DARK.purple} stopOpacity={0} /></linearGradient>
                  </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={DARK.border} />
                    <XAxis dataKey="name" tick={{ fill: DARK.muted, fontSize: 11 }} />
                    <YAxis tick={{ fill: DARK.muted, fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={v => `$${v.toLocaleString()}`} contentStyle={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 8, color: DARK.text }} />
                    <Legend />
                    <Area type="monotone" dataKey="value" name="2024" stroke={DARK.accent} fill="url(#r1)" strokeWidth={2} />
                    <Area type="monotone" dataKey="prev" name="2023" stroke={DARK.purple} fill="url(#r2)" strokeWidth={2} strokeDasharray="4 2" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div style={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 12, padding: "20px" }}>
                <h3 style={{ fontSize: 13, color: DARK.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Revenue by Region</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart><Pie data={regionData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                    {regionData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                    <Tooltip formatter={v => `$${v.toLocaleString()}`} contentStyle={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 8, color: DARK.text }} />
                    <Legend formatter={v => <span style={{ fontSize: 12, color: DARK.muted }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bottom row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 12, padding: "20px" }}>
                <h3 style={{ fontSize: 13, color: DARK.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Revenue by Category</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={catData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={DARK.border} />
                    <XAxis type="number" tick={{ fill: DARK.muted, fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                    <YAxis dataKey="name" type="category" tick={{ fill: DARK.muted, fontSize: 12 }} width={70} />
                    <Tooltip formatter={v => `$${v.toLocaleString()}`} contentStyle={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 8, color: DARK.text }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>{catData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 12, padding: "20px" }}>
                <h3 style={{ fontSize: 13, color: DARK.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Recent AI Queries</h3>
                {chatHistory.filter(m => m.role === "user").slice(-5).length === 0 ? (
                  <div style={{ color: DARK.muted, fontSize: 13, textAlign: "center", padding: "30px 0" }}>No queries yet — start chatting!</div>
                ) : (
                  chatHistory.filter(m => m.role === "user").slice(-5).map((m, i) => (
                    <div key={i} style={{ padding: "8px 12px", background: `${DARK.purple}10`, border: `1px solid ${DARK.purple}22`, borderRadius: 8, marginBottom: 8, fontSize: 13, color: DARK.text }}>
                      {m.content.length > 60 ? m.content.slice(0, 60) + "…" : m.content}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ChatPage({ dataset, chatHistory, setChatHistory }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory]);

  const sendMessage = useCallback(async (question) => {
    if (!question.trim() || loading) return;
    const q = question.trim();
    setInput("");
    setLoading(true);

    const userMsg = { role: "user", content: q, id: Date.now() };
    const loadingMsg = { role: "assistant", loading: true, id: Date.now() + 1 };
    setChatHistory(prev => [...prev, userMsg, loadingMsg]);

    const result = await callClaudeAPI(q, dataset, chatHistory);
    setChatHistory(prev => prev.map(m => m.loading ? { role: "assistant", data: result, content: result.summary, id: m.id } : m));
    setLoading(false);
  }, [loading, dataset, chatHistory, setChatHistory]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)" }}>
      {/* Header */}
      <div style={{ padding: "16px 40px", borderBottom: `1px solid ${DARK.border}`, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${DARK.accent}, ${DARK.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚡</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Analytics Agent</div>
          <div style={{ fontSize: 12, color: dataset ? DARK.accent : DARK.muted }}>{dataset ? `${dataset.name} ready · ${dataset.rows.toLocaleString()} rows` : "No dataset — load one first"}</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 40px" }}>
        {chatHistory.length === 0 && (
          <div className="fade-in" style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Ask anything about your data</h2>
            <p style={{ color: DARK.muted, marginBottom: 32 }}>The AI agent converts your questions into SQL, runs analysis, and generates charts + insights</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
              {SAMPLE_QUESTIONS.map((q, i) => (
                <button key={i} onClick={() => sendMessage(q)} style={{ background: DARK.card, border: `1px solid ${DARK.border}`, color: DARK.text, padding: "8px 16px", borderRadius: 20, cursor: "pointer", fontSize: 13, fontFamily: "inherit", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.target.style.borderColor = DARK.accent; e.target.style.color = DARK.accent; }}
                  onMouseLeave={e => { e.target.style.borderColor = DARK.border; e.target.style.color = DARK.text; }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {chatHistory.map((msg, i) => <ChatMessage key={msg.id || i} msg={msg} isLast={i === chatHistory.length - 1} />)}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "16px 40px", borderTop: `1px solid ${DARK.border}`, background: DARK.surface }}>
        <div style={{ display: "flex", gap: 12, maxWidth: 900, margin: "0 auto" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
              placeholder={dataset ? "Ask a question about your data..." : "Upload a dataset first to start querying"}
              disabled={!dataset || loading}
              style={{ width: "100%", background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 10, padding: "13px 50px 13px 16px", color: DARK.text, fontSize: 14, fontFamily: "inherit", outline: "none" }} />
            {loading && <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }}><Spinner /></div>}
          </div>
          <button onClick={() => sendMessage(input)} disabled={!dataset || loading || !input.trim()}
            style={{ padding: "13px 22px", background: `linear-gradient(135deg, ${DARK.accent}, ${DARK.purple})`, border: "none", borderRadius: 10, color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 14, opacity: (!dataset || loading || !input.trim()) ? 0.5 : 1 }}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function InsightsPage({ dataset, chatHistory }) {
  const allInsights = chatHistory.filter(m => m.data?.insights).flatMap(m => m.data.insights.map(i => ({ text: i, source: m.content?.slice(0, 50) + "…" })));
  const allRecs = chatHistory.filter(m => m.data?.recommendations).flatMap(m => m.data.recommendations.map(r => ({ text: r, source: m.content?.slice(0, 50) + "…" })));

  const edaItems = dataset ? [
    { label: "Total Records", value: dataset.rows.toLocaleString(), status: "ok" },
    { label: "Columns", value: dataset.columns.length, status: "ok" },
    { label: "Missing Values", value: "23 cells (1.8%)", status: "warn" },
    { label: "Duplicate Rows", value: "0", status: "ok" },
    { label: "Date Range", value: "Jan–Jun 2024", status: "ok" },
    { label: "Numeric Columns", value: "2 (revenue, units)", status: "ok" },
    { label: "Data Quality Score", value: "94/100", status: "ok" },
  ] : [];

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto" }}>
      <div className="fade-in">
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Insights Hub</h1>
        <p style={{ color: DARK.muted, marginBottom: 32 }}>EDA results, accumulated insights, and AI recommendations</p>

        {!dataset ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: DARK.muted }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <p>Upload a dataset to see automated analysis</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* EDA */}
            <div style={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 12, padding: "20px 24px" }}>
              <h3 style={{ fontSize: 14, color: DARK.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 20 }}>Exploratory Data Analysis</h3>
              {edaItems.map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < edaItems.length - 1 ? `1px solid ${DARK.border}20` : "none" }}>
                  <span style={{ fontSize: 13, color: DARK.muted }}>{item.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: DARK.text }}>{item.value}</span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: item.status === "ok" ? `${DARK.accent}20` : `${DARK.danger}20`, color: item.status === "ok" ? DARK.accent : DARK.danger }}>{item.status === "ok" ? "✓" : "!"}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Insights */}
            <div style={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 12, padding: "20px 24px" }}>
              <h3 style={{ fontSize: 14, color: DARK.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 20 }}>Accumulated Insights ({allInsights.length})</h3>
              {allInsights.length === 0 ? (
                <div style={{ color: DARK.muted, fontSize: 13, textAlign: "center", padding: "30px 0" }}>Ask questions in the Chat to generate insights</div>
              ) : (
                allInsights.slice(-9).map((ins, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12, fontSize: 13, lineHeight: 1.5 }}>
                    <span style={{ color: DARK.accent, flexShrink: 0 }}>◆</span>
                    <span style={{ color: DARK.text }}>{ins.text}</span>
                  </div>
                ))
              )}
            </div>

            {/* Recommendations */}
            <div style={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 12, padding: "20px 24px" }}>
              <h3 style={{ fontSize: 14, color: DARK.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 20 }}>Business Recommendations ({allRecs.length})</h3>
              {allRecs.length === 0 ? (
                <div style={{ color: DARK.muted, fontSize: 13, textAlign: "center", padding: "30px 0" }}>Recommendations appear after AI analysis</div>
              ) : (
                allRecs.slice(-6).map((rec, i) => (
                  <div key={i} style={{ padding: "12px 16px", background: `${DARK.purple}10`, border: `1px solid ${DARK.purple}22`, borderRadius: 8, marginBottom: 10, fontSize: 13, lineHeight: 1.5, display: "flex", gap: 10 }}>
                    <span style={{ color: DARK.purple }}>→</span><span>{rec.text}</span>
                  </div>
                ))
              )}
            </div>

            {/* Column stats */}
            <div style={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderRadius: 12, padding: "20px 24px" }}>
              <h3 style={{ fontSize: 14, color: DARK.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 20 }}>Column Statistics</h3>
              {[
                { col: "revenue", min: "$1,200", max: "$48,300", avg: "$2,296", type: "numeric" },
                { col: "units", min: "1", max: "148", avg: "31.2", type: "numeric" },
                { col: "product", unique: "12 values", type: "categorical" },
                { col: "region", unique: "4 values (N/S/E/W)", type: "categorical" },
                { col: "category", unique: "3 values", type: "categorical" },
              ].map((s, i) => (
                <div key={i} style={{ padding: "10px 0", borderBottom: i < 4 ? `1px solid ${DARK.border}20` : "none", fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontFamily: "JetBrains Mono", color: DARK.accent, fontSize: 12 }}>{s.col}</span>
                    <span style={{ color: DARK.muted, fontSize: 11 }}>{s.type}</span>
                  </div>
                  <div style={{ color: DARK.muted, fontSize: 12 }}>
                    {s.type === "numeric" ? `Min: ${s.min} · Max: ${s.max} · Avg: ${s.avg}` : s.unique}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [dataset, setDataset] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);

  if (!user) return (
    <>
      <style>{styles}</style>
      <LoginPage onLogin={setUser} />
    </>
  );

  const navItems = [
    { id: "dashboard", icon: "⊞", label: "Dashboard" },
    { id: "upload", icon: "↑", label: "Upload" },
    { id: "chat", icon: "💬", label: "AI Chat" },
    { id: "insights", icon: "💡", label: "Insights" },
  ];

  return (
    <>
      <style>{styles}</style>
      <div style={{ display: "flex", height: "100vh", background: DARK.bg, overflow: "hidden" }}>
        {/* Sidebar */}
        <div style={{ width: 220, background: DARK.surface, borderRight: `1px solid ${DARK.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {/* Logo */}
          <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${DARK.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${DARK.accent}, ${DARK.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚡</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>DataPulse</div>
                <div style={{ fontSize: 11, color: DARK.muted }}>AI Analytics</div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ padding: "12px 10px", flex: 1 }}>
            {navItems.map(item => (
              <button key={item.id} onClick={() => setPage(item.id)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "none", background: page === item.id ? `${DARK.accent}15` : "transparent", color: page === item.id ? DARK.accent : DARK.muted, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: page === item.id ? 600 : 400, marginBottom: 2, transition: "all 0.15s", textAlign: "left" }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
                {item.id === "chat" && chatHistory.filter(m => m.role === "user").length > 0 && (
                  <span style={{ marginLeft: "auto", fontSize: 10, background: DARK.accent, color: "#000", borderRadius: 10, padding: "2px 7px", fontWeight: 700 }}>{chatHistory.filter(m => m.role === "user").length}</span>
                )}
              </button>
            ))}
          </nav>

          {/* Dataset status */}
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${DARK.border}` }}>
            {dataset ? (
              <div style={{ fontSize: 12 }}>
                <div style={{ color: DARK.accent, marginBottom: 2 }}>✓ Dataset loaded</div>
                <div style={{ color: DARK.muted, fontSize: 11 }}>{dataset.name}</div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: DARK.muted }}>No dataset loaded</div>
            )}
          </div>

          {/* User */}
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${DARK.border}`, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: `${DARK.purple}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: DARK.purple }}>
              {user.name[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
              <div style={{ fontSize: 11, color: DARK.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
            </div>
            <button onClick={() => setUser(null)} style={{ background: "none", border: "none", color: DARK.muted, cursor: "pointer", fontSize: 14 }} title="Sign out">⏻</button>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {page === "dashboard" && <DashboardPage dataset={dataset} chatHistory={chatHistory} />}
          {page === "upload" && <UploadPage dataset={dataset} onUpload={setDataset} />}
          {page === "chat" && <ChatPage dataset={dataset} chatHistory={chatHistory} setChatHistory={setChatHistory} />}
          {page === "insights" && <InsightsPage dataset={dataset} chatHistory={chatHistory} />}
        </div>
      </div>
    </>
  );
}
