import { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://wtyxasyktwkktntsdffr.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0eXhhc3lrdHdra3RudHNkZmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1ODg3NDUsImV4cCI6MjA5MjE2NDc0NX0.F4PuJXU2rfLB-7rAHI-rbWhdCPYQaoVEB3OWp6O3bys";
const supabase = createClient(supabaseUrl, supabaseKey);

const SEVERITY_COLORS = {
  "1 - Mild": { bg: "#E8F5E9", text: "#2E7D32", dot: "#4CAF50" },
  "2 - Moderate": { bg: "#FFF8E1", text: "#F57F17", dot: "#FFC107" },
  "3 - Severe": { bg: "#FFEBEE", text: "#C62828", dot: "#F44336" },
  "4 - Emergency": { bg: "#FCE4EC", text: "#880E4F", dot: "#E91E63" },
};

const STRESS_LEVELS = ["Low", "Medium", "High", "Extreme"];
const SEVERITY_LEVELS = ["1 - Mild", "2 - Moderate", "3 - Severe", "4 - Emergency"];

const EMPTY_FORM = {
  "Event Name": "",
  "Date & Time": "",
  "Food/Drink": "",
  "Early Symptoms": "",
  "Mid Symptoms": "",
  "Severe Symptoms": "",
  "Suspected Allergen": "",
  "Severity Level": "",
  "Stress Level": "",
};

export default function App() {
  const [reactions, setReactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("list"); // list | charts | add
  const [filterAllergen, setFilterAllergen] = useState("All");
  const [filterSeverity, setFilterSeverity] = useState("All");
  const [filterSearch, setFilterSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reactions")
      .select("*")
      .order('"Date & Time"', { ascending: false });
    if (error) setError(error.message);
    else setReactions(data || []);
    setLoading(false);
  };

  const allergens = useMemo(() => {
    const all = reactions.map(r => r["Suspected Allergen"]).filter(Boolean);
    return ["All", ...Array.from(new Set(all))];
  }, [reactions]);

  const filtered = useMemo(() => {
    return reactions.filter(r => {
      if (filterAllergen !== "All" && r["Suspected Allergen"] !== filterAllergen) return false;
      if (filterSeverity !== "All" && r["Severity Level"] !== filterSeverity) return false;
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        return (
          (r["Event Name"] || "").toLowerCase().includes(q) ||
          (r["Food/Drink"] || "").toLowerCase().includes(q) ||
          (r["Early Symptoms"] || "").toLowerCase().includes(q) ||
          (r["Mid Symptoms"] || "").toLowerCase().includes(q) ||
          (r["Severe Symptoms"] || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reactions, filterAllergen, filterSeverity, filterSearch]);

  const chartData = useMemo(() => {
    const allergenCounts = {};
    const severityCounts = { "1 - Mild": 0, "2 - Moderate": 0, "3 - Severe": 0, "4 - Emergency": 0 };
    const monthlyMap = {};
    reactions.forEach(r => {
      if (r["Suspected Allergen"]) allergenCounts[r["Suspected Allergen"]] = (allergenCounts[r["Suspected Allergen"]] || 0) + 1;
      if (r["Severity Level"]) severityCounts[r["Severity Level"]] = (severityCounts[r["Severity Level"]] || 0) + 1;
      if (r["Date & Time"]) {
        const d = new Date(r["Date & Time"]);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthlyMap[key] = (monthlyMap[key] || 0) + 1;
      }
    });
    const topAllergens = Object.entries(allergenCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const months = Object.entries(monthlyMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
    return { topAllergens, severityCounts, months };
  }, [reactions]);

  const exportCSV = () => {
    const headers = ["Event Name", "Date & Time", "Food/Drink", "Early Symptoms", "Mid Symptoms", "Severe Symptoms", "Suspected Allergen", "Severity Level", "Stress Level"];
    const rows = filtered.map(r => headers.map(h => `"${(r[h] || "").replace(/"/g, '""')}"`).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mcas-reactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    if (!form["Event Name"] || !form["Date & Time"]) {
      setSaveMsg("Please fill in Event Name and Date & Time.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("reactions").insert([form]);
    if (error) {
      setSaveMsg("Error: " + error.message);
    } else {
      setSaveMsg("Reaction saved successfully!");
      setForm(EMPTY_FORM);
      await fetchData();
      setTimeout(() => { setView("list"); setSaveMsg(""); }, 1200);
    }
    setSaving(false);
  };

  const formatDate = (d) => {
    if (!d) return "—";
    const dt = new Date(d);
    return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
      " · " + dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const sevColor = (s) => SEVERITY_COLORS[s] || { bg: "#F5F5F5", text: "#616161", dot: "#9E9E9E" };
  const maxMonthly = Math.max(...chartData.months.map(m => m[1]), 1);
  const maxAllergen = Math.max(...chartData.topAllergens.map(a => a[1]), 1);

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerInner}>
          <div>
            <div style={s.headerLabel}>MCAS</div>
            <h1 style={s.headerTitle}>Reaction Tracker</h1>
          </div>
          <div style={s.headerStats}>
            <div style={s.statPill}><span style={s.statNum}>{reactions.length}</span><span style={s.statLabel}>total</span></div>
            <div style={{ ...s.statPill, background: "#FFF3E0" }}><span style={{ ...s.statNum, color: "#E65100" }}>{reactions.filter(r => (r["Severity Level"] || "").includes("3") || (r["Severity Level"] || "").includes("4")).length}</span><span style={s.statLabel}>severe</span></div>
          </div>
        </div>

        {/* Nav */}
        <div style={s.nav}>
          {["list", "charts", "add"].map(tab => (
            <button key={tab} onClick={() => setView(tab)} style={{ ...s.navBtn, ...(view === tab ? s.navBtnActive : {}) }}>
              {tab === "list" ? "📋 Log" : tab === "charts" ? "📊 Insights" : "＋ Add Reaction"}
            </button>
          ))}
        </div>
      </div>

      <div style={s.content}>
        {error && <div style={s.errorBanner}>⚠️ {error}</div>}
        {loading && <div style={s.loadingWrap}><div style={s.spinner} /><span>Loading your data…</span></div>}

        {/* LIST VIEW */}
        {!loading && view === "list" && (
          <div>
            {/* Filters */}
            <div style={s.filterBar}>
              <input
                placeholder="🔍  Search symptoms, food, events…"
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                style={s.searchInput}
              />
              <select value={filterAllergen} onChange={e => setFilterAllergen(e.target.value)} style={s.select}>
                {allergens.map(a => <option key={a}>{a}</option>)}
              </select>
              <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} style={s.select}>
                <option>All</option>
                {SEVERITY_LEVELS.map(s => <option key={s}>{s}</option>)}
              </select>
              <button onClick={exportCSV} style={s.exportBtn}>⬇ Export CSV</button>
            </div>

            <div style={s.resultCount}>{filtered.length} reaction{filtered.length !== 1 ? "s" : ""} {filterSearch || filterAllergen !== "All" || filterSeverity !== "All" ? "(filtered)" : ""}</div>

            {filtered.length === 0 && <div style={s.empty}>No reactions match your filters.</div>}

            {filtered.map(r => {
              const sc = sevColor(r["Severity Level"]);
              const isOpen = expanded === r.id;
              return (
                <div key={r.id} style={s.card} onClick={() => setExpanded(isOpen ? null : r.id)}>
                  <div style={s.cardTop}>
                    <div style={s.cardLeft}>
                      <div style={{ ...s.sevDot, background: sc.dot }} />
                      <div>
                        <div style={s.cardTitle}>{r["Event Name"] || "Untitled event"}</div>
                        <div style={s.cardDate}>{formatDate(r["Date & Time"])}</div>
                      </div>
                    </div>
                    <div style={s.cardRight}>
                      {r["Severity Level"] && (
                        <span style={{ ...s.badge, background: sc.bg, color: sc.text }}>{r["Severity Level"]}</span>
                      )}
                      <span style={s.chevron}>{isOpen ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {r["Food/Drink"] && (
                    <div style={s.foodRow}>🍽 {r["Food/Drink"]}</div>
                  )}

                  {isOpen && (
                    <div style={s.expandedSection}>
                      <div style={s.divider} />
                      {r["Early Symptoms"] && <div style={s.symptomRow}><span style={s.symLabel}>Early</span>{r["Early Symptoms"]}</div>}
                      {r["Mid Symptoms"] && <div style={s.symptomRow}><span style={{ ...s.symLabel, background: "#FFF8E1", color: "#F57F17" }}>Mid</span>{r["Mid Symptoms"]}</div>}
                      {r["Severe Symptoms"] && <div style={s.symptomRow}><span style={{ ...s.symLabel, background: "#FFEBEE", color: "#C62828" }}>Severe</span>{r["Severe Symptoms"]}</div>}
                      <div style={s.metaRow}>
                        {r["Suspected Allergen"] && <span style={s.allergenTag}>🧪 {r["Suspected Allergen"]}</span>}
                        {r["Stress Level"] && <span style={s.metaChip}>Stress: {r["Stress Level"]}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* CHARTS VIEW */}
        {!loading && view === "charts" && (
          <div>
            <div style={s.sectionTitle}>Reactions over time</div>
            <div style={s.chartCard}>
              {chartData.months.length === 0 && <div style={s.empty}>Not enough data yet.</div>}
              <div style={s.barChart}>
                {chartData.months.map(([month, count]) => (
                  <div key={month} style={s.barCol}>
                    <div style={s.barLabel}>{count}</div>
                    <div style={{ ...s.bar, height: `${Math.round((count / maxMonthly) * 120)}px` }} />
                    <div style={s.barMonth}>{month.slice(5)}/{month.slice(2, 4)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={s.sectionTitle}>Severity breakdown</div>
            <div style={s.chartCard}>
              {SEVERITY_LEVELS.map(sev => {
                const count = chartData.severityCounts[sev] || 0;
                const pct = reactions.length ? Math.round((count / reactions.length) * 100) : 0;
                const sc = sevColor(sev);
                return (
                  <div key={sev} style={s.sevRow}>
                    <div style={s.sevRowLabel}>{sev}</div>
                    <div style={s.sevBarWrap}>
                      <div style={{ ...s.sevBar, width: `${pct}%`, background: sc.dot }} />
                    </div>
                    <div style={s.sevCount}>{count}</div>
                  </div>
                );
              })}
            </div>

            <div style={s.sectionTitle}>Top suspected allergens</div>
            <div style={s.chartCard}>
              {chartData.topAllergens.length === 0 && <div style={s.empty}>No allergen data yet.</div>}
              {chartData.topAllergens.map(([allergen, count]) => (
                <div key={allergen} style={s.sevRow}>
                  <div style={s.sevRowLabel}>{allergen}</div>
                  <div style={s.sevBarWrap}>
                    <div style={{ ...s.sevBar, width: `${Math.round((count / maxAllergen) * 100)}%`, background: "#7C4DFF" }} />
                  </div>
                  <div style={s.sevCount}>{count}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ADD VIEW */}
        {view === "add" && (
          <div style={s.formCard}>
            <div style={s.sectionTitle}>Log a new reaction</div>

            <div style={s.formGroup}>
              <label style={s.formLabel}>Event name *</label>
              <input style={s.formInput} placeholder="e.g. Lunch at work, Evening walk…" value={form["Event Name"]} onChange={e => setForm({ ...form, "Event Name": e.target.value })} />
            </div>

            <div style={s.formGroup}>
              <label style={s.formLabel}>Date & Time *</label>
              <input type="datetime-local" style={s.formInput} value={form["Date & Time"]} onChange={e => setForm({ ...form, "Date & Time": e.target.value })} />
            </div>

            <div style={s.formGroup}>
              <label style={s.formLabel}>Food / Drink</label>
              <input style={s.formInput} placeholder="What did you eat or drink?" value={form["Food/Drink"]} onChange={e => setForm({ ...form, "Food/Drink": e.target.value })} />
            </div>

            <div style={s.formRow}>
              <div style={{ ...s.formGroup, flex: 1 }}>
                <label style={s.formLabel}>Early symptoms</label>
                <textarea style={s.formTextarea} placeholder="Itching, flushing, nausea…" value={form["Early Symptoms"]} onChange={e => setForm({ ...form, "Early Symptoms": e.target.value })} />
              </div>
              <div style={{ ...s.formGroup, flex: 1 }}>
                <label style={s.formLabel}>Mid symptoms</label>
                <textarea style={s.formTextarea} placeholder="Cramping, diarrhoea…" value={form["Mid Symptoms"]} onChange={e => setForm({ ...form, "Mid Symptoms": e.target.value })} />
              </div>
            </div>

            <div style={s.formGroup}>
              <label style={s.formLabel}>Severe symptoms</label>
              <textarea style={s.formTextarea} placeholder="Difficulty breathing, anaphylaxis…" value={form["Severe Symptoms"]} onChange={e => setForm({ ...form, "Severe Symptoms": e.target.value })} />
            </div>

            <div style={s.formRow}>
              <div style={{ ...s.formGroup, flex: 1 }}>
                <label style={s.formLabel}>Suspected allergen</label>
                <input style={s.formInput} placeholder="Dairy, salicylates…" value={form["Suspected Allergen"]} onChange={e => setForm({ ...form, "Suspected Allergen": e.target.value })} />
              </div>
              <div style={{ ...s.formGroup, flex: 1 }}>
                <label style={s.formLabel}>Severity level</label>
                <select style={s.formInput} value={form["Severity Level"]} onChange={e => setForm({ ...form, "Severity Level": e.target.value })}>
                  <option value="">Select…</option>
                  {SEVERITY_LEVELS.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div style={{ ...s.formGroup, flex: 1 }}>
                <label style={s.formLabel}>Stress level</label>
                <select style={s.formInput} value={form["Stress Level"]} onChange={e => setForm({ ...form, "Stress Level": e.target.value })}>
                  <option value="">Select…</option>
                  {STRESS_LEVELS.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>

            {saveMsg && <div style={{ ...s.saveMsgBox, background: saveMsg.startsWith("Error") ? "#FFEBEE" : "#E8F5E9", color: saveMsg.startsWith("Error") ? "#C62828" : "#2E7D32" }}>{saveMsg}</div>}

            <button style={s.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Reaction"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  root: {
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    minHeight: "100vh",
    background: "#F7F4FF",
    color: "#1A1A2E",
  },
  header: {
    background: "linear-gradient(135deg, #7C4DFF 0%, #448AFF 100%)",
    padding: "24px 20px 0",
    color: "white",
  },
  headerInner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.15em",
    opacity: 0.75,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headerTitle: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: "-0.5px",
  },
  headerStats: { display: "flex", gap: 8, alignItems: "center" },
  statPill: {
    background: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    padding: "6px 14px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    backdropFilter: "blur(4px)",
  },
  statNum: { fontSize: 18, fontWeight: 700, lineHeight: 1, color: "white" },
  statLabel: { fontSize: 10, opacity: 0.8, marginTop: 1 },
  nav: { display: "flex", gap: 4, marginTop: 8 },
  navBtn: {
    flex: 1,
    background: "rgba(255,255,255,0.15)",
    border: "none",
    color: "rgba(255,255,255,0.8)",
    padding: "10px 8px",
    borderRadius: "10px 10px 0 0",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    transition: "all 0.15s",
  },
  navBtnActive: {
    background: "white",
    color: "#7C4DFF",
    fontWeight: 700,
  },
  content: { padding: "16px 16px 32px" },
  errorBanner: { background: "#FFEBEE", color: "#C62828", padding: "10px 14px", borderRadius: 10, marginBottom: 12, fontSize: 14 },
  loadingWrap: { display: "flex", alignItems: "center", gap: 10, padding: 20, color: "#666" },
  spinner: {
    width: 20, height: 20, border: "2px solid #E0D7FF", borderTopColor: "#7C4DFF",
    borderRadius: "50%", animation: "spin 0.8s linear infinite",
  },
  filterBar: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 },
  searchInput: {
    flex: "1 1 200px", padding: "9px 14px", borderRadius: 10, border: "1.5px solid #E0D7FF",
    background: "white", fontSize: 13, outline: "none", color: "#1A1A2E",
  },
  select: {
    padding: "9px 10px", borderRadius: 10, border: "1.5px solid #E0D7FF",
    background: "white", fontSize: 13, color: "#1A1A2E", cursor: "pointer",
  },
  exportBtn: {
    padding: "9px 16px", borderRadius: 10, border: "1.5px solid #7C4DFF",
    background: "white", color: "#7C4DFF", fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  resultCount: { fontSize: 12, color: "#888", marginBottom: 10 },
  empty: { padding: "32px 0", textAlign: "center", color: "#aaa", fontSize: 14 },
  card: {
    background: "white",
    borderRadius: 14,
    padding: "14px 16px",
    marginBottom: 10,
    border: "1.5px solid #EDE9FF",
    cursor: "pointer",
    transition: "box-shadow 0.15s",
  },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  cardLeft: { display: "flex", alignItems: "flex-start", gap: 10 },
  sevDot: { width: 10, height: 10, borderRadius: "50%", marginTop: 5, flexShrink: 0 },
  cardTitle: { fontSize: 15, fontWeight: 600, color: "#1A1A2E", lineHeight: 1.3 },
  cardDate: { fontSize: 12, color: "#999", marginTop: 2 },
  cardRight: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 8 },
  badge: { fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20 },
  chevron: { fontSize: 10, color: "#ccc" },
  foodRow: { fontSize: 13, color: "#555", marginTop: 8, paddingLeft: 20 },
  expandedSection: { paddingLeft: 20, marginTop: 6 },
  divider: { height: 1, background: "#F3F0FF", margin: "10px 0" },
  symptomRow: { display: "flex", alignItems: "baseline", gap: 8, fontSize: 13, color: "#444", marginBottom: 6 },
  symLabel: { fontSize: 10, fontWeight: 700, background: "#E8F5E9", color: "#2E7D32", padding: "2px 7px", borderRadius: 20, flexShrink: 0 },
  metaRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 },
  allergenTag: { fontSize: 12, background: "#EDE9FF", color: "#7C4DFF", padding: "3px 10px", borderRadius: 20, fontWeight: 500 },
  metaChip: { fontSize: 12, background: "#F5F5F5", color: "#666", padding: "3px 10px", borderRadius: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#7C4DFF", marginBottom: 10, marginTop: 16 },
  chartCard: { background: "white", borderRadius: 14, padding: 16, marginBottom: 8, border: "1.5px solid #EDE9FF" },
  barChart: { display: "flex", alignItems: "flex-end", gap: 12, height: 160, paddingBottom: 24, position: "relative" },
  barCol: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" },
  bar: { width: "100%", background: "linear-gradient(180deg, #7C4DFF, #448AFF)", borderRadius: "6px 6px 0 0", minHeight: 4, transition: "height 0.3s" },
  barLabel: { fontSize: 11, fontWeight: 600, color: "#7C4DFF", marginBottom: 4 },
  barMonth: { fontSize: 10, color: "#aaa", marginTop: 4, position: "absolute", bottom: 0 },
  sevRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
  sevRowLabel: { fontSize: 13, color: "#444", width: 110, flexShrink: 0 },
  sevBarWrap: { flex: 1, height: 8, background: "#F3F0FF", borderRadius: 10, overflow: "hidden" },
  sevBar: { height: "100%", borderRadius: 10, transition: "width 0.5s" },
  sevCount: { fontSize: 13, fontWeight: 600, color: "#666", width: 24, textAlign: "right" },
  formCard: { background: "white", borderRadius: 16, padding: 20, border: "1.5px solid #EDE9FF" },
  formGroup: { marginBottom: 14 },
  formRow: { display: "flex", gap: 12 },
  formLabel: { display: "block", fontSize: 12, fontWeight: 600, color: "#7C4DFF", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" },
  formInput: {
    width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #E0D7FF",
    fontSize: 14, color: "#1A1A2E", background: "#FAFAFA", boxSizing: "border-box", outline: "none",
  },
  formTextarea: {
    width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #E0D7FF",
    fontSize: 14, color: "#1A1A2E", background: "#FAFAFA", resize: "vertical", minHeight: 70,
    boxSizing: "border-box", outline: "none", fontFamily: "inherit",
  },
  saveMsgBox: { padding: "10px 14px", borderRadius: 10, fontSize: 14, marginBottom: 12 },
  saveBtn: {
    width: "100%", padding: "13px", background: "linear-gradient(135deg, #7C4DFF, #448AFF)",
    color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
    cursor: "pointer", marginTop: 4,
  },
};