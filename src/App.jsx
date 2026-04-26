import { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://wtyxasyktwkktntsdffr.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0eXhhc3lrdHdra3RudHNkZmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1ODg3NDUsImV4cCI6MjA5MjE2NDc0NX0.F4PuJXU2rfLB-7rAHI-rbWhdCPYQaoVEB3OWp6O3bys";
const supabase = createClient(supabaseUrl, supabaseKey);

const SEVERITY_COLORS = {
  "1 - Mild":      { bg:"#E8F5E9", text:"#2E7D32", dot:"#4CAF50" },
  "2 - Moderate":  { bg:"#FFF8E1", text:"#F57F17", dot:"#FFC107" },
  "3 - Severe":    { bg:"#FFEBEE", text:"#C62828", dot:"#F44336" },
  "4 - Emergency": { bg:"#FCE4EC", text:"#880E4F", dot:"#E91E63" },
};
const SEVERITY_COLORS_DARK = {
  "1 - Mild":      { bg:"#1B3320", text:"#81C784", dot:"#4CAF50" },
  "2 - Moderate":  { bg:"#332900", text:"#FFD54F", dot:"#FFC107" },
  "3 - Severe":    { bg:"#3B1010", text:"#EF9A9A", dot:"#F44336" },
  "4 - Emergency": { bg:"#3B0A20", text:"#F48FB1", dot:"#E91E63" },
};
const SEVERITY_LEVELS = ["1 - Mild","2 - Moderate","3 - Severe","4 - Emergency"];
const STRESS_LEVELS   = ["Low","Medium","High","Extreme"];
const MED_TYPES = ["Daily / Preventative","Antihistamine (H1)","Antihistamine (H2)","Mast Cell Stabiliser","Rescue Medication","Steroid","Other"];
const BODY_REGIONS = [
  { id:"head",    label:"Head / Face"    },
  { id:"throat",  label:"Throat / Neck"  },
  { id:"chest",   label:"Chest"          },
  { id:"abdomen", label:"Abdomen"        },
  { id:"larm",    label:"Left Arm"       },
  { id:"rarm",    label:"Right Arm"      },
  { id:"pelvis",  label:"Pelvis / Groin" },
  { id:"lleg",    label:"Left Leg"       },
  { id:"rleg",    label:"Right Leg"      },
  { id:"skin",    label:"Skin (general)" },
];

const EMPTY_REACTION = {
  "Event Name":"","Date & Time":"","Food/Drink":"",
  "Early Symptoms":"","Mid Symptoms":"","Severe Symptoms":"",
  "Suspected Allergen":"","Severity Level":"","Stress Level":"",
  "Body Regions":[],"Medications Taken":"",
};
const EMPTY_MED = { name:"", type:"", dose:"", time:"", notes:"" };

const FLARE_TYPES = [
  { id:"gut",      label:"Gut-only",  desc:"cramps / diarrhoea" },
  { id:"spreading",label:"Spreading", desc:"itch / rash added"  },
  { id:"systemic", label:"Systemic",  desc:"throat / chest symptoms" },
];
const FLARE_SYMPTOMS = {
  "Gut":              ["Cramps","Diarrhoea","Nausea"],
  "Skin":             ["Itching","Rash"],
  "Airway / Systemic":["Lip tingling","Throat symptoms","Chest tightness","Breathlessness","Dizziness"],
};
const FLARE_DURATIONS = ["<2 hrs","2-6 hrs","Most of day"];
const EMPTY_FLARE = {
  date:"", flare_type:"", start_time:"", trigger:"",
  timeline:[{time:"",symptom:""},{time:"",symptom:""},{time:"",symptom:""}],
  foods:["","",""],
  meds_taken:["","",""],
  symptoms:[],
  severity:"",
  pattern:"",
  retriggered:"",
  duration:"",
};

export default function App() {
  const [reactions,   setReactions]   = useState([]);
  const [medications, setMedications] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [view,        setView]        = useState("list");
  const [error,       setError]       = useState("");
  const [expanded,    setExpanded]    = useState(null);
  const [filterAllergen, setFilterAllergen] = useState("All");
  const [filterSeverity, setFilterSeverity] = useState("All");
  const [filterSearch,   setFilterSearch]   = useState("");
  const [reactionForm,   setReactionForm]   = useState(EMPTY_REACTION);
  const [medForm,        setMedForm]        = useState(EMPTY_MED);
  const [saving,    setSaving]    = useState(false);
  const [saveMsg,   setSaveMsg]   = useState("");
  const [medSaveMsg,setMedSaveMsg]= useState("");
  const [reportRange,setReportRange]= useState(30);
  const [flareForm,  setFlareForm]  = useState(EMPTY_FLARE);
  const [flareSaveMsg,setFlareSaveMsg]= useState("");
  const [flares,     setFlares]     = useState([]);

  // NEW: dark mode, edit, delete, quick-log
  const [darkMode,      setDarkMode]      = useState(() => {
    try { return localStorage.getItem("mcas-dark") === "1"; } catch { return false; }
  });
  const [editingId,     setEditingId]     = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [quickLog,      setQuickLog]      = useState(false);
  const [quickForm,     setQuickForm]     = useState({
    "Event Name":"", "Date & Time": new Date().toISOString().slice(0,16),
    "Severity Level":"", "Early Symptoms":"",
  });
  const [quickSaveMsg,  setQuickSaveMsg]  = useState("");

  useEffect(() => {
    try { localStorage.setItem("mcas-dark", darkMode ? "1" : "0"); } catch {}
    document.body.style.background = darkMode ? "#0F0F1A" : "";
  }, [darkMode]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [r1, r2, r3] = await Promise.all([
      supabase.from("reactions").select("*").order('"Date & Time"', { ascending:false }),
      supabase.from("medications").select("*").order("created_at", { ascending:false }),
      supabase.from("flares").select("*").order("date", { ascending:false }),
    ]);
    if (r1.error) setError(r1.error.message); else setReactions(r1.data || []);
    if (!r2.error) setMedications(r2.data || []);
    if (!r3.error) setFlares(r3.data || []);
    setLoading(false);
  };

  const allergens = useMemo(() => {
    const all = reactions.map(r => r["Suspected Allergen"]).filter(Boolean);
    return ["All", ...Array.from(new Set(all))];
  }, [reactions]);

  const filtered = useMemo(() => reactions.filter(r => {
    if (filterAllergen !== "All" && r["Suspected Allergen"] !== filterAllergen) return false;
    if (filterSeverity !== "All" && r["Severity Level"]    !== filterSeverity)  return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      return ["Event Name","Food/Drink","Early Symptoms","Mid Symptoms","Severe Symptoms"]
        .some(k => (r[k]||"").toLowerCase().includes(q));
    }
    return true;
  }), [reactions, filterAllergen, filterSeverity, filterSearch]);

  const chartData = useMemo(() => {
    const allergenCounts = {}, severityCounts = {"1 - Mild":0,"2 - Moderate":0,"3 - Severe":0,"4 - Emergency":0}, monthlyMap = {}, bodyMap = {};
    reactions.forEach(r => {
      if (r["Suspected Allergen"]) allergenCounts[r["Suspected Allergen"]] = (allergenCounts[r["Suspected Allergen"]]||0)+1;
      if (r["Severity Level"])     severityCounts[r["Severity Level"]] = (severityCounts[r["Severity Level"]]||0)+1;
      if (r["Date & Time"]) {
        const d = new Date(r["Date & Time"]);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
        monthlyMap[key] = (monthlyMap[key]||0)+1;
      }
      (r["Body Regions"]||[]).forEach(region => { bodyMap[region] = (bodyMap[region]||0)+1; });
    });
    return {
      topAllergens: Object.entries(allergenCounts).sort((a,b)=>b[1]-a[1]).slice(0,6),
      severityCounts,
      months: Object.entries(monthlyMap).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6),
      bodyMap,
    };
  }, [reactions]);

  const reportData = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - reportRange);
    const inRange = reactions.filter(r => r["Date & Time"] && new Date(r["Date & Time"]) >= cutoff);
    const allergenMap={}, severityMap={}, medMap={};
    inRange.forEach(r => {
      if (r["Suspected Allergen"]) allergenMap[r["Suspected Allergen"]] = (allergenMap[r["Suspected Allergen"]]||0)+1;
      if (r["Severity Level"])     severityMap[r["Severity Level"]]     = (severityMap[r["Severity Level"]]||0)+1;
      if (r["Medications Taken"])  r["Medications Taken"].split(",").forEach(m => { const t=m.trim(); if(t) medMap[t]=(medMap[t]||0)+1; });
    });
    const flaresInRange = flares.filter(f => f.date && new Date(f.date) >= cutoff);
    return { inRange, allergenMap, severityMap, medMap, flaresInRange };
  }, [reactions, flares, reportRange]);

  const toggleBodyRegion = id => {
    const curr = reactionForm["Body Regions"]||[];
    setReactionForm({...reactionForm, "Body Regions": curr.includes(id) ? curr.filter(r=>r!==id) : [...curr,id]});
  };

  // UPDATED: handles both insert and update
  const saveReaction = async () => {
    if (!reactionForm["Event Name"]||!reactionForm["Date & Time"]) { setSaveMsg("Please fill in Event Name and Date & Time."); return; }
    setSaving(true);
    if (editingId) {
      const { id: _id, created_at: _ca, ...fields } = reactionForm;
      const { error } = await supabase.from("reactions").update(fields).eq("id", editingId);
      if (error) setSaveMsg("Error: "+error.message);
      else { setSaveMsg("Updated!"); setReactionForm(EMPTY_REACTION); setEditingId(null); await fetchAll(); setTimeout(()=>{ setView("list"); setSaveMsg(""); },1000); }
    } else {
      const { error } = await supabase.from("reactions").insert([reactionForm]);
      if (error) setSaveMsg("Error: "+error.message);
      else { setSaveMsg("Saved!"); setReactionForm(EMPTY_REACTION); await fetchAll(); setTimeout(()=>{ setView("list"); setSaveMsg(""); },1000); }
    }
    setSaving(false);
  };

  const startEditReaction = (r, e) => {
    e.stopPropagation();
    const { id, created_at, ...fields } = r;
    setReactionForm({ ...EMPTY_REACTION, ...fields });
    setEditingId(id);
    setSaveMsg("");
    setView("add");
  };

  const confirmDelete = (id, e) => {
    e.stopPropagation();
    setDeleteConfirm(id);
  };

  const doDelete = async () => {
    await supabase.from("reactions").delete().eq("id", deleteConfirm);
    setReactions(reactions.filter(r => r.id !== deleteConfirm));
    if (expanded === deleteConfirm) setExpanded(null);
    setDeleteConfirm(null);
  };

  const saveMed = async () => {
    if (!medForm.name) { setMedSaveMsg("Please enter a medication name."); return; }
    setSaving(true);
    const { error } = await supabase.from("medications").insert([medForm]);
    if (error) setMedSaveMsg("Error: "+error.message);
    else { setMedSaveMsg("Saved!"); setMedForm(EMPTY_MED); await fetchAll(); setTimeout(()=>setMedSaveMsg(""),2000); }
    setSaving(false);
  };

  const deleteMed = async id => {
    await supabase.from("medications").delete().eq("id",id);
    setMedications(medications.filter(m=>m.id!==id));
  };

  const saveFlare = async () => {
    if (!flareForm.date) { setFlareSaveMsg("Please enter a date."); return; }
    setSaving(true);
    const payload = { ...flareForm, timeline: JSON.stringify(flareForm.timeline), foods: JSON.stringify(flareForm.foods), meds_taken: JSON.stringify(flareForm.meds_taken), symptoms: JSON.stringify(flareForm.symptoms) };
    const { error } = await supabase.from("flares").insert([payload]);
    if (error) setFlareSaveMsg("Error: "+error.message);
    else { setFlareSaveMsg("Flare diary saved!"); setFlareForm(EMPTY_FLARE); await fetchAll(); setTimeout(()=>{ setView("flares"); setFlareSaveMsg(""); },1000); }
    setSaving(false);
  };

  const toggleFlareSymptom = sym => {
    const curr = flareForm.symptoms||[];
    setFlareForm({...flareForm, symptoms: curr.includes(sym) ? curr.filter(s=>s!==sym) : [...curr,sym]});
  };

  const openQuickLog = () => {
    setQuickForm({ "Event Name":"", "Date & Time": new Date().toISOString().slice(0,16), "Severity Level":"", "Early Symptoms":"" });
    setQuickSaveMsg("");
    setQuickLog(true);
  };

  const saveQuickLog = async () => {
    if (!quickForm["Event Name"] && !quickForm["Early Symptoms"]) {
      setQuickSaveMsg("Add at least a name or symptom.");
      return;
    }
    setSaving(true);
    const payload = { ...EMPTY_REACTION, "Event Name": quickForm["Event Name"] || "Quick log", "Date & Time": quickForm["Date & Time"], "Severity Level": quickForm["Severity Level"], "Early Symptoms": quickForm["Early Symptoms"] };
    const { error } = await supabase.from("reactions").insert([payload]);
    if (error) setQuickSaveMsg("Error: "+error.message);
    else { setQuickSaveMsg("Logged!"); await fetchAll(); setTimeout(() => { setQuickLog(false); setQuickSaveMsg(""); }, 900); }
    setSaving(false);
  };

  const exportCSV = () => {
    const headers = ["Event Name","Date & Time","Food/Drink","Early Symptoms","Mid Symptoms","Severe Symptoms","Suspected Allergen","Severity Level","Stress Level","Body Regions","Medications Taken"];
    const rows = filtered.map(r => headers.map(h=>`"${(Array.isArray(r[h])?r[h].join("; "):r[h]||"").replace(/"/g,'""')}"`).join(","));
    const blob = new Blob([[headers.join(","),...rows].join("\n")],{type:"text/csv"});
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`mcas-reactions-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  const formatDate = d => !d ? "—" :
    new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})+" · "+
    new Date(d).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});

  const dm = darkMode;
  const sc = sev => (dm ? SEVERITY_COLORS_DARK : SEVERITY_COLORS)[sev] || (dm ? {bg:"#1E1E2E",text:"#aaa",dot:"#555"} : {bg:"#F5F5F5",text:"#616161",dot:"#9E9E9E"});
  const maxBar      = Math.max(...chartData.months.map(m=>m[1]),1);
  const maxAllergen = Math.max(...chartData.topAllergens.map(a=>a[1]),1);

  // Theme tokens
  const t = dm ? {
    root:"#0F0F1A", surface:"#1A1A2E", surfaceAlt:"#22223A", border:"#2E2E4A",
    text:"#E8E6F0", textMuted:"#888", textSub:"#666",
    accent:"#9D6FFF", accentBtn:"linear-gradient(135deg,#7C4DFF,#448AFF)",
    inputBg:"#12121F", chipBg:"#23233A", chipText:"#aaa",
    headerBg:"linear-gradient(135deg,#3D1FA0 0%,#1A3A7A 100%)",
    navActive:"#0F0F1A", navText:"rgba(255,255,255,0.7)",
    emptyText:"#444", reportBg:"#1A1A2E", sevBarBg:"#2A2A40",
    cardHover:"0 4px 20px rgba(124,77,255,0.20)",
  } : {
    root:"#F7F4FF", surface:"#FFFFFF", surfaceAlt:"#F7F4FF", border:"#EDE9FF",
    text:"#1A1A2E", textMuted:"#888", textSub:"#999",
    accent:"#7C4DFF", accentBtn:"linear-gradient(135deg,#7C4DFF,#448AFF)",
    inputBg:"#FAFAFA", chipBg:"#F5F5F5", chipText:"#666",
    headerBg:"linear-gradient(135deg,#7C4DFF 0%,#448AFF 100%)",
    navActive:"#FFFFFF", navText:"rgba(255,255,255,0.85)",
    emptyText:"#bbb", reportBg:"#FFFFFF", sevBarBg:"#F3F0FF",
    cardHover:"0 4px 20px rgba(124,77,255,0.10)",
  };

  const inp = { background: t.inputBg, border:`1.5px solid ${t.border}`, color: t.text };
  const fLbl = { ...s.formLabel, color: t.accent };

  return (
    <div style={{...s.root, background: t.root, color: t.text}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes spin    { to { transform:rotate(360deg); } }
        @keyframes fadeIn  { from { opacity:0;transform:translateY(6px); } to { opacity:1;transform:translateY(0); } }
        @keyframes slideUp { from { opacity:0;transform:translateY(24px) scale(0.97); } to { opacity:1;transform:translateY(0) scale(1); } }
        @keyframes overlayIn { from { opacity:0; } to { opacity:1; } }
        *{box-sizing:border-box;}
        input,select,textarea,button{font-family:'DM Sans','Segoe UI',sans-serif;}
        .reaction-card:hover{box-shadow:${t.cardHover};}
        .icon-btn:hover{opacity:0.65 !important;}
        @media print{.no-print{display:none!important;} body{background:white!important;}}
      `}</style>

      {/* DELETE CONFIRM */}
      {deleteConfirm && (
        <div style={s.overlay} onClick={()=>setDeleteConfirm(null)}>
          <div style={{...s.modal, background:t.surface, border:`1.5px solid ${t.border}`}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:28,marginBottom:8}}>🗑️</div>
            <div style={{fontSize:16,fontWeight:700,color:t.text,marginBottom:6}}>Delete this reaction?</div>
            <div style={{fontSize:13,color:t.textMuted,marginBottom:20}}>This cannot be undone.</div>
            <div style={{display:"flex",gap:10}}>
              <button style={{...s.modalBtn,background:t.chipBg,color:t.textMuted}} onClick={()=>setDeleteConfirm(null)}>Cancel</button>
              <button style={{...s.modalBtn,background:"#F44336",color:"white"}} onClick={doDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK LOG */}
      {quickLog && (
        <div style={s.overlay} onClick={()=>setQuickLog(false)}>
          <div style={{...s.quickPanel,background:t.surface,border:`1.5px solid ${t.border}`}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:t.accent,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3}}>Emergency Log</div>
                <div style={{fontSize:20,fontWeight:700,color:t.text}}>Quick Reaction Log</div>
              </div>
              <button onClick={()=>setQuickLog(false)} style={{background:"none",border:"none",fontSize:22,color:t.textMuted,cursor:"pointer",padding:"2px 6px",lineHeight:1}}>✕</button>
            </div>

            <div style={s.formGroup}>
              <label style={fLbl}>What happened?</label>
              <input style={{...s.formInput,...inp}} placeholder="e.g. Lunch reaction…" autoFocus
                value={quickForm["Event Name"]} onChange={e=>setQuickForm({...quickForm,"Event Name":e.target.value})}/>
            </div>

            <div style={s.formGroup}>
              <label style={fLbl}>Main symptom(s)</label>
              <input style={{...s.formInput,...inp}} placeholder="e.g. itching, flushing, cramps…"
                value={quickForm["Early Symptoms"]} onChange={e=>setQuickForm({...quickForm,"Early Symptoms":e.target.value})}/>
            </div>

            <div style={s.formGroup}>
              <label style={fLbl}>Severity</label>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {SEVERITY_LEVELS.map(sev => {
                  const c=sc(sev); const sel=quickForm["Severity Level"]===sev;
                  return <button key={sev} onClick={()=>setQuickForm({...quickForm,"Severity Level":sev})}
                    style={{...s.bodyBtn,fontSize:12,background:sel?c.bg:t.inputBg,color:sel?c.text:t.textMuted,border:sel?`1.5px solid ${c.dot}`:`1.5px solid ${t.border}`,fontWeight:sel?700:400}}>{sev}</button>;
                })}
              </div>
            </div>

            <div style={{...s.formGroup,marginBottom:0}}>
              <label style={fLbl}>Date & time</label>
              <input type="datetime-local" style={{...s.formInput,...inp}}
                value={quickForm["Date & Time"]} onChange={e=>setQuickForm({...quickForm,"Date & Time":e.target.value})}/>
            </div>

            {quickSaveMsg && <div style={{...s.saveMsgBox,marginTop:12,
              background:quickSaveMsg.startsWith("Error")?(dm?"#3B1010":"#FFEBEE"):(dm?"#1B3320":"#E8F5E9"),
              color:quickSaveMsg.startsWith("Error")?(dm?"#EF9A9A":"#C62828"):(dm?"#81C784":"#2E7D32")}}>{quickSaveMsg}</div>}

            <button style={{...s.saveBtn,marginTop:16,background:"linear-gradient(135deg,#FF4444,#FF8800)"}} onClick={saveQuickLog} disabled={saving}>
              {saving?"Saving…":"⚡ Log Reaction"}
            </button>
            <div style={{textAlign:"center",marginTop:10}}>
              <button onClick={()=>{setQuickLog(false);setView("add");}} style={{background:"none",border:"none",color:t.accent,fontSize:12,cursor:"pointer",textDecoration:"underline"}}>
                Open full form instead →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{...s.header,background:t.headerBg}} className="no-print">
        <div style={s.headerInner}>
          <div>
            <div style={s.headerLabel}>MCAS</div>
            <h1 style={s.headerTitle}>Reaction Tracker</h1>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={s.headerStats}>
              <div style={s.statPill}><span style={s.statNum}>{reactions.length}</span><span style={s.statLabel}>total</span></div>
              <div style={{...s.statPill,background:"rgba(255,255,255,0.25)"}}>
                <span style={s.statNum}>{reactions.filter(r=>(r["Severity Level"]||"").match(/3|4/)).length}</span>
                <span style={s.statLabel}>severe</span>
              </div>
            </div>
            <button onClick={()=>setDarkMode(!dm)}
              title={dm?"Light mode":"Dark mode"}
              style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:20,padding:"7px 12px",cursor:"pointer",fontSize:15,color:"white",flexShrink:0}}>
              {dm?"☀️":"🌙"}
            </button>
          </div>
        </div>
        <div style={s.nav}>
          {[{id:"list",label:"📋 Log"},{id:"charts",label:"📊 Insights"},{id:"meds",label:"💊 Meds"},{id:"flares",label:"🧾 Flares"},{id:"report",label:"🖨 Report"},{id:"add",label:"＋ Add"}].map(tab=>(
            <button key={tab.id} onClick={()=>{
              if(tab.id==="add"){ setEditingId(null); setReactionForm(EMPTY_REACTION); setSaveMsg(""); }
              setView(tab.id);
            }} style={{...s.navBtn,color:view===tab.id?t.accent:t.navText,background:view===tab.id?t.navActive:"rgba(255,255,255,0.15)"}}>{tab.label}</button>
          ))}
        </div>
      </div>

      {/* QUICK LOG FAB */}
      <button onClick={openQuickLog} className="no-print"
        style={{position:"fixed",bottom:24,right:20,zIndex:100,background:"linear-gradient(135deg,#FF4444,#FF8800)",
          border:"none",borderRadius:28,padding:"13px 20px",color:"white",fontWeight:700,fontSize:14,
          cursor:"pointer",boxShadow:"0 4px 20px rgba(255,68,68,0.4)",display:"flex",alignItems:"center",gap:8,
          fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
        ⚡ Quick Log
      </button>

      <div style={{...s.content,background:t.root}}>
        {error   && <div style={{...s.errorBanner,background:dm?"#3B1010":"#FFEBEE",color:dm?"#EF9A9A":"#C62828"}}>⚠️ {error}</div>}
        {loading && <div style={{...s.loadingWrap,color:t.textMuted}}><div style={s.spinner}/><span>Loading…</span></div>}

        {/* LIST */}
        {!loading && view==="list" && (
          <div style={{animation:"fadeIn 0.2s ease"}}>
            <div style={s.filterBar}>
              <input placeholder="🔍  Search…" value={filterSearch} onChange={e=>setFilterSearch(e.target.value)} style={{...s.searchInput,...inp}}/>
              <select value={filterAllergen} onChange={e=>setFilterAllergen(e.target.value)} style={{...s.select,...inp}}>
                {allergens.map(a=><option key={a}>{a}</option>)}
              </select>
              <select value={filterSeverity} onChange={e=>setFilterSeverity(e.target.value)} style={{...s.select,...inp}}>
                <option>All</option>{SEVERITY_LEVELS.map(l=><option key={l}>{l}</option>)}
              </select>
              <button onClick={exportCSV} style={{...s.exportBtn,border:`1.5px solid ${t.accent}`,color:t.accent,background:t.surface}}>⬇ CSV</button>
            </div>
            <div style={{...s.resultCount,color:t.textMuted}}>{filtered.length} reaction{filtered.length!==1?"s":""}</div>
            {filtered.length===0 && <div style={{...s.empty,color:t.emptyText}}>No reactions match your filters.</div>}
            {filtered.map(r => {
              const c=sc(r["Severity Level"]); const isOpen=expanded===r.id;
              return (
                <div key={r.id} className="reaction-card" style={{...s.card,background:t.surface,border:`1.5px solid ${t.border}`,color:t.text}} onClick={()=>setExpanded(isOpen?null:r.id)}>
                  <div style={s.cardTop}>
                    <div style={s.cardLeft}>
                      <div style={{...s.sevDot,background:c.dot}}/>
                      <div>
                        <div style={{...s.cardTitle,color:t.text}}>{r["Event Name"]||"Untitled event"}</div>
                        <div style={{...s.cardDate,color:t.textSub}}>{formatDate(r["Date & Time"])}</div>
                      </div>
                    </div>
                    <div style={s.cardRight}>
                      {r["Severity Level"]&&<span style={{...s.badge,background:c.bg,color:c.text}}>{r["Severity Level"]}</span>}
                      <button className="icon-btn" title="Edit" onClick={e=>startEditReaction(r,e)}
                        style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:t.textMuted,padding:"2px 4px",opacity:0.7}}>✏️</button>
                      <button className="icon-btn" title="Delete" onClick={e=>confirmDelete(r.id,e)}
                        style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:t.textMuted,padding:"2px 4px",opacity:0.7}}>🗑️</button>
                      <span style={{...s.chevron,color:t.textSub}}>{isOpen?"▲":"▼"}</span>
                    </div>
                  </div>
                  {r["Food/Drink"]&&<div style={{...s.foodRow,color:t.textMuted}}>🍽 {r["Food/Drink"]}</div>}
                  {isOpen&&(
                    <div style={s.expandedSection}>
                      <div style={{...s.divider,background:t.border}}/>
                      {r["Early Symptoms"]  &&<div style={{...s.symptomRow,color:t.text}}><span style={s.symLabel}>Early</span>{r["Early Symptoms"]}</div>}
                      {r["Mid Symptoms"]    &&<div style={{...s.symptomRow,color:t.text}}><span style={{...s.symLabel,background:dm?"#332900":"#FFF8E1",color:dm?"#FFD54F":"#F57F17"}}>Mid</span>{r["Mid Symptoms"]}</div>}
                      {r["Severe Symptoms"] &&<div style={{...s.symptomRow,color:t.text}}><span style={{...s.symLabel,background:dm?"#3B1010":"#FFEBEE",color:dm?"#EF9A9A":"#C62828"}}>Severe</span>{r["Severe Symptoms"]}</div>}
                      {r["Body Regions"]?.length>0&&<div style={{...s.symptomRow,color:t.text}}><span style={{...s.symLabel,background:dm?"#0D2540":"#E3F2FD",color:dm?"#90CAF9":"#1565C0"}}>Body</span>{r["Body Regions"].map(id=>BODY_REGIONS.find(b=>b.id===id)?.label||id).join(", ")}</div>}
                      {r["Medications Taken"]&&<div style={{...s.symptomRow,color:t.text}}><span style={{...s.symLabel,background:dm?"#2A1040":"#F3E5F5",color:dm?"#CE93D8":"#6A1B9A"}}>Meds</span>{r["Medications Taken"]}</div>}
                      <div style={s.metaRow}>
                        {r["Suspected Allergen"]&&<span style={{...s.allergenTag,background:dm?"#2A1A50":"#EDE9FF",color:t.accent}}>🧪 {r["Suspected Allergen"]}</span>}
                        {r["Stress Level"]&&<span style={{...s.metaChip,background:t.chipBg,color:t.chipText}}>Stress: {r["Stress Level"]}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* CHARTS */}
        {!loading && view==="charts" && (
          <div style={{animation:"fadeIn 0.2s ease"}}>
            {[
              {title:"Reactions per month", content:(
                <div style={{...s.chartCard,background:t.surface,border:`1.5px solid ${t.border}`}}>
                  {chartData.months.length===0&&<div style={{...s.empty,color:t.emptyText}}>Not enough data yet.</div>}
                  <div style={s.barChart}>
                    {chartData.months.map(([month,count])=>(
                      <div key={month} style={s.barCol}>
                        <div style={{...s.barLabel,color:t.accent}}>{count}</div>
                        <div style={{...s.bar,height:`${Math.round((count/maxBar)*120)}px`}}/>
                        <div style={{...s.barMonth,color:t.textMuted}}>{month.slice(5)}/{month.slice(2,4)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )},
              {title:"Severity breakdown", content:(
                <div style={{...s.chartCard,background:t.surface,border:`1.5px solid ${t.border}`}}>
                  {SEVERITY_LEVELS.map(sev=>{const count=chartData.severityCounts[sev]||0;const pct=reactions.length?Math.round((count/reactions.length)*100):0;const c=sc(sev);return(
                    <div key={sev} style={s.sevRow}>
                      <div style={{...s.sevRowLabel,color:t.text}}>{sev}</div>
                      <div style={{...s.sevBarWrap,background:t.sevBarBg}}><div style={{...s.sevBar,width:`${pct}%`,background:c.dot}}/></div>
                      <div style={{...s.sevCount,color:t.textMuted}}>{count}</div>
                    </div>
                  );})}
                </div>
              )},
              {title:"Top suspected triggers", content:(
                <div style={{...s.chartCard,background:t.surface,border:`1.5px solid ${t.border}`}}>
                  {chartData.topAllergens.length===0&&<div style={{...s.empty,color:t.emptyText}}>No trigger data yet.</div>}
                  {chartData.topAllergens.map(([allergen,count])=>(
                    <div key={allergen} style={s.sevRow}>
                      <div style={{...s.sevRowLabel,color:t.text}}>{allergen}</div>
                      <div style={{...s.sevBarWrap,background:t.sevBarBg}}><div style={{...s.sevBar,width:`${Math.round((count/maxAllergen)*100)}%`,background:"#7C4DFF"}}/></div>
                      <div style={{...s.sevCount,color:t.textMuted}}>{count}</div>
                    </div>
                  ))}
                </div>
              )},
              {title:"Body regions affected", content:(
                <div style={{...s.chartCard,background:t.surface,border:`1.5px solid ${t.border}`}}>
                  {BODY_REGIONS.map(region=>{const count=chartData.bodyMap[region.id]||0;const pct=reactions.length?Math.round((count/reactions.length)*100):0;return(
                    <div key={region.id} style={s.sevRow}>
                      <div style={{...s.sevRowLabel,color:t.text}}>{region.label}</div>
                      <div style={{...s.sevBarWrap,background:t.sevBarBg}}><div style={{...s.sevBar,width:`${pct}%`,background:"#448AFF"}}/></div>
                      <div style={{...s.sevCount,color:t.textMuted}}>{count}</div>
                    </div>
                  );})}
                </div>
              )},
            ].map(({title,content})=>(
              <div key={title}>
                <div style={{...s.sectionTitle,color:t.accent}}>{title}</div>
                {content}
              </div>
            ))}
          </div>
        )}

        {/* MEDS */}
        {!loading && view==="meds" && (
          <div style={{animation:"fadeIn 0.2s ease"}}>
            <div style={{...s.sectionTitle,color:t.accent}}>Add medication</div>
            <div style={{...s.formCard,background:t.surface,border:`1.5px solid ${t.border}`}}>
              <div style={s.formRow}>
                <div style={{...s.formGroup,flex:2}}><label style={fLbl}>Medication name *</label><input style={{...s.formInput,...inp}} placeholder="e.g. Cetirizine…" value={medForm.name} onChange={e=>setMedForm({...medForm,name:e.target.value})}/></div>
                <div style={{...s.formGroup,flex:1}}><label style={fLbl}>Type</label><select style={{...s.formInput,...inp}} value={medForm.type} onChange={e=>setMedForm({...medForm,type:e.target.value})}><option value="">Select…</option>{MED_TYPES.map(tp=><option key={tp}>{tp}</option>)}</select></div>
              </div>
              <div style={s.formRow}>
                <div style={{...s.formGroup,flex:1}}><label style={fLbl}>Dose</label><input style={{...s.formInput,...inp}} placeholder="e.g. 10mg" value={medForm.dose} onChange={e=>setMedForm({...medForm,dose:e.target.value})}/></div>
                <div style={{...s.formGroup,flex:1}}><label style={fLbl}>Time / frequency</label><input style={{...s.formInput,...inp}} placeholder="e.g. Morning, twice daily" value={medForm.time} onChange={e=>setMedForm({...medForm,time:e.target.value})}/></div>
              </div>
              <div style={s.formGroup}><label style={fLbl}>Notes</label><input style={{...s.formInput,...inp}} placeholder="e.g. with food" value={medForm.notes} onChange={e=>setMedForm({...medForm,notes:e.target.value})}/></div>
              {medSaveMsg&&<div style={{...s.saveMsgBox,background:medSaveMsg.startsWith("Error")?(dm?"#3B1010":"#FFEBEE"):(dm?"#1B3320":"#E8F5E9"),color:medSaveMsg.startsWith("Error")?(dm?"#EF9A9A":"#C62828"):(dm?"#81C784":"#2E7D32")}}>{medSaveMsg}</div>}
              <button style={{...s.saveBtn,background:t.accentBtn}} onClick={saveMed} disabled={saving}>{saving?"Saving…":"Save Medication"}</button>
            </div>
            <div style={{...s.sectionTitle,color:t.accent}}>Current medications</div>
            {medications.length===0&&<div style={{...s.empty,color:t.emptyText}}>No medications logged yet.</div>}
            {MED_TYPES.map(type=>{
              const group=medications.filter(m=>m.type===type);
              if(!group.length) return null;
              return <div key={type}>
                <div style={{...s.medGroupLabel,color:t.accent}}>{type}</div>
                {group.map(med=>(
                  <div key={med.id} style={{...s.medCard,background:t.surface,border:`1.5px solid ${t.border}`}}>
                    <div style={{flex:1}}>
                      <div style={{...s.medName,color:t.text}}>{med.name}{med.dose&&<span style={{...s.medDose,background:dm?"#2A1A50":"#EDE9FF",color:t.accent}}>{med.dose}</span>}</div>
                      {med.time&&<div style={{...s.medMeta,color:t.textMuted}}>{med.time}</div>}
                      {med.notes&&<div style={{...s.medNotes,color:t.textSub}}>{med.notes}</div>}
                    </div>
                    <button onClick={()=>deleteMed(med.id)} style={{...s.deleteBtn,color:t.textSub}}>✕</button>
                  </div>
                ))}
              </div>;
            })}
            {medications.filter(m=>!m.type).map(med=>(
              <div key={med.id} style={{...s.medCard,background:t.surface,border:`1.5px solid ${t.border}`}}>
                <div style={{flex:1}}>
                  <div style={{...s.medName,color:t.text}}>{med.name}{med.dose&&<span style={{...s.medDose,background:dm?"#2A1A50":"#EDE9FF",color:t.accent}}>{med.dose}</span>}</div>
                  {med.time&&<div style={{...s.medMeta,color:t.textMuted}}>{med.time}</div>}
                  {med.notes&&<div style={{...s.medNotes,color:t.textSub}}>{med.notes}</div>}
                </div>
                <button onClick={()=>deleteMed(med.id)} style={{...s.deleteBtn,color:t.textSub}}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* REPORT */}
        {!loading && view==="report" && (
          <div style={{animation:"fadeIn 0.2s ease"}}>
            <div className="no-print" style={{...s.filterBar,marginBottom:16}}>
              <select value={reportRange} onChange={e=>setReportRange(Number(e.target.value))} style={{...s.select,...inp}}>
                <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option>
                <option value={60}>Last 60 days</option><option value={90}>Last 90 days</option>
              </select>
              <button onClick={()=>window.print()} style={{...s.saveBtn,background:t.accentBtn,width:"auto",padding:"10px 20px"}}>🖨 Print / Save as PDF</button>
            </div>
            <div style={{...s.reportWrap,background:t.reportBg,border:`1.5px solid ${t.border}`}}>
              <div style={{...s.reportHeader,borderBottomColor:"#7C4DFF"}}>
                <div style={{...s.reportTitle,color:t.text}}>MCAS Reaction Report</div>
                <div style={{...s.reportMeta,color:t.textMuted}}>Period: Last {reportRange} days · Generated: {new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</div>
              </div>
              <div style={s.reportSection}>
                <div style={{...s.reportSectionTitle,color:t.accent,borderBottomColor:t.border}}>Summary</div>
                <div style={s.reportGrid}>
                  {[
                    {n:reportData.inRange.length,l:"Total reactions"},
                    {n:reportData.inRange.filter(r=>(r["Severity Level"]||"").match(/3|4/)).length,l:"Severe / emergency"},
                    {n:Object.keys(reportData.allergenMap).length,l:"Triggers identified"},
                    {n:medications.length,l:"Medications on record"},
                  ].map(({n,l})=>(
                    <div key={l} style={{...s.reportStat,background:dm?"#22223A":"#F7F4FF"}}>
                      <div style={{...s.reportStatNum,color:t.accent}}>{n}</div>
                      <div style={{...s.reportStatLabel,color:t.textMuted}}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={s.reportSection}>
                <div style={{...s.reportSectionTitle,color:t.accent,borderBottomColor:t.border}}>Severity breakdown</div>
                {SEVERITY_LEVELS.map(sev=>{const count=reportData.severityMap[sev]||0;const pct=reportData.inRange.length?Math.round((count/reportData.inRange.length)*100):0;const c=sc(sev);return(
                  <div key={sev} style={s.sevRow}>
                    <div style={{...s.sevRowLabel,width:130,color:t.text}}>{sev}</div>
                    <div style={{...s.sevBarWrap,background:t.sevBarBg}}><div style={{...s.sevBar,width:`${pct}%`,background:c.dot}}/></div>
                    <div style={{...s.sevCount,color:t.textMuted}}>{count} ({pct}%)</div>
                  </div>
                );})}
              </div>
              {[
                {title:"Top suspected triggers",entries:Object.entries(reportData.allergenMap).sort((a,b)=>b[1]-a[1]),renderItem:([allergen,count])=><div key={allergen} style={{...s.reportRow,borderBottomColor:t.border}}><span style={{...s.allergenTag,background:dm?"#2A1A50":"#EDE9FF",color:t.accent}}>🧪 {allergen}</span><span style={{fontSize:13,color:t.textMuted}}>{count} reaction{count!==1?"s":""}</span></div>,empty:"No trigger data in this period."},
                {title:"Medications used during reactions",entries:Object.entries(reportData.medMap).sort((a,b)=>b[1]-a[1]),renderItem:([med,count])=><div key={med} style={{...s.reportRow,borderBottomColor:t.border}}><span style={{...s.allergenTag,background:dm?"#2A1040":"#F3E5F5",color:dm?"#CE93D8":"#6A1B9A"}}>💊 {med}</span><span style={{fontSize:13,color:t.textMuted}}>{count}×</span></div>,empty:"No medication data in this period."},
              ].map(({title,entries,renderItem,empty})=>(
                <div key={title} style={s.reportSection}>
                  <div style={{...s.reportSectionTitle,color:t.accent,borderBottomColor:t.border}}>{title}</div>
                  {entries.map(renderItem)}
                  {entries.length===0&&<div style={{...s.empty,color:t.emptyText}}>{empty}</div>}
                </div>
              ))}
              <div style={s.reportSection}>
                <div style={{...s.reportSectionTitle,color:t.accent,borderBottomColor:t.border}}>Current medication regimen</div>
                {medications.length===0&&<div style={{...s.empty,color:t.emptyText}}>No medications on record.</div>}
                {medications.length>0&&<table style={s.reportTable}>
                  <thead><tr>{["Medication","Type","Dose","Frequency","Notes"].map(h=><th key={h} style={{...s.reportTh,background:dm?"#22223A":"#F7F4FF",color:t.accent}}>{h}</th>)}</tr></thead>
                  <tbody>{medications.map(med=><tr key={med.id}>{["name","type","dose","time","notes"].map(k=><td key={k} style={{...s.reportTd,borderBottomColor:t.border,color:t.text}}>{med[k]||"—"}</td>)}</tr>)}</tbody>
                </table>}
              </div>
              <div style={s.reportSection}>
                <div style={{...s.reportSectionTitle,color:t.accent,borderBottomColor:t.border}}>Reaction log ({reportData.inRange.length} entries)</div>
                {reportData.inRange.length===0&&<div style={{...s.empty,color:t.emptyText}}>No reactions in this period.</div>}
                {reportData.inRange.length>0&&<table style={s.reportTable}>
                  <thead><tr>{["Date","Event","Food/Drink","Symptoms","Allergen","Severity","Meds Taken"].map(h=><th key={h} style={{...s.reportTh,background:dm?"#22223A":"#F7F4FF",color:t.accent}}>{h}</th>)}</tr></thead>
                  <tbody>{reportData.inRange.map(r=>(
                    <tr key={r.id}>
                      <td style={{...s.reportTd,borderBottomColor:t.border,color:t.text}}>{r["Date & Time"]?new Date(r["Date & Time"]).toLocaleDateString("en-GB"):"—"}</td>
                      <td style={{...s.reportTd,borderBottomColor:t.border,color:t.text}}>{r["Event Name"]||"—"}</td>
                      <td style={{...s.reportTd,borderBottomColor:t.border,color:t.text}}>{r["Food/Drink"]||"—"}</td>
                      <td style={{...s.reportTd,borderBottomColor:t.border,color:t.text}}>{[r["Early Symptoms"],r["Mid Symptoms"],r["Severe Symptoms"]].filter(Boolean).join("; ")||"—"}</td>
                      <td style={{...s.reportTd,borderBottomColor:t.border,color:t.text}}>{r["Suspected Allergen"]||"—"}</td>
                      <td style={{...s.reportTd,borderBottomColor:t.border,color:t.text}}>{r["Severity Level"]||"—"}</td>
                      <td style={{...s.reportTd,borderBottomColor:t.border,color:t.text}}>{r["Medications Taken"]||"—"}</td>
                    </tr>
                  ))}</tbody>
                </table>}
              </div>
              <div style={{...s.reportFooter,borderTopColor:t.border,color:t.textSub}}>Generated by MCAS Reaction Tracker · {new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</div>
            </div>
          </div>
        )}

        {/* FLARE LOG */}
        {!loading && view==="flares" && (
          <div style={{animation:"fadeIn 0.2s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{...s.sectionTitle,color:t.accent,marginTop:0}}>Flare day diaries</div>
              <button onClick={()=>setView("addflare")} style={{...s.exportBtn,background:"linear-gradient(135deg,#7C4DFF,#448AFF)",color:"white",border:"none"}}>＋ New Flare</button>
            </div>
            {flares.length===0&&<div style={{...s.empty,color:t.emptyText}}>No flare diaries yet.</div>}
            {flares.map(f=>(
              <div key={f.id} style={{...s.card,cursor:"default",background:t.surface,border:`1.5px solid ${t.border}`}}>
                <div style={s.cardTop}>
                  <div style={s.cardLeft}>
                    <div style={{...s.sevDot,background:f.flare_type==="systemic"?"#E91E63":f.flare_type==="spreading"?"#FFC107":"#4CAF50"}}/>
                    <div>
                      <div style={{...s.cardTitle,color:t.text}}>{f.date} — {FLARE_TYPES.find(ft=>ft.id===f.flare_type)?.label||"Flare"}</div>
                      <div style={{...s.cardDate,color:t.textSub}}>{f.start_time&&`Started ${f.start_time}`}{f.trigger&&` · Trigger: ${f.trigger}`}</div>
                    </div>
                  </div>
                  {f.severity&&<span style={{...s.badge,background:dm?"#2A1A50":"#EDE9FF",color:t.accent}}>Severity {f.severity}</span>}
                </div>
                {f.symptoms&&(()=>{try{const syms=JSON.parse(f.symptoms);return syms.length>0&&<div style={{...s.foodRow,paddingLeft:20,color:t.textMuted}}>{syms.join(" · ")}</div>}catch{return null}})()}
                {f.pattern&&<div style={{fontSize:13,color:t.textSub,marginTop:6,paddingLeft:20,fontStyle:"italic"}}>"{f.pattern}"</div>}
                <div style={{display:"flex",gap:8,marginTop:8,paddingLeft:20,flexWrap:"wrap"}}>
                  {f.duration&&<span style={{...s.metaChip,background:t.chipBg,color:t.chipText}}>⏳ {f.duration}</span>}
                  {f.retriggered&&<span style={{...s.metaChip,background:t.chipBg,color:t.chipText}}>🔁 Re-triggered: {f.retriggered}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ADD FLARE */}
        {view==="addflare" && (
          <div style={{animation:"fadeIn 0.2s ease"}}>
            <div style={{...s.formCard,background:t.surface,border:`1.5px solid ${t.border}`}}>
              <div style={{...s.sectionTitle,color:t.accent}}>🧾 Flare Day Diary</div>
              <div style={s.formRow}>
                <div style={{...s.formGroup,flex:1}}><label style={fLbl}>📅 Date *</label><input type="date" style={{...s.formInput,...inp}} value={flareForm.date} onChange={e=>setFlareForm({...flareForm,date:e.target.value})}/></div>
                <div style={{...s.formGroup,flex:1}}><label style={fLbl}>⏰ Start time</label><input type="time" style={{...s.formInput,...inp}} value={flareForm.start_time} onChange={e=>setFlareForm({...flareForm,start_time:e.target.value})}/></div>
              </div>
              <div style={s.formGroup}>
                <label style={fLbl}>⚡ Flare type</label>
                <div style={s.bodyGrid}>
                  {FLARE_TYPES.map(ft=>{const sel=flareForm.flare_type===ft.id;return(
                    <button key={ft.id} onClick={()=>setFlareForm({...flareForm,flare_type:ft.id})}
                      style={{...s.bodyBtn,textAlign:"left",background:sel?(dm?"#2A1A50":"#EDE9FF"):t.inputBg,color:sel?t.accent:t.textMuted,border:sel?`1.5px solid ${t.accent}`:`1.5px solid ${t.border}`,fontWeight:sel?600:400}}>
                      <div style={{fontWeight:600}}>{ft.label}</div><div style={{fontSize:11,opacity:0.7}}>{ft.desc}</div>
                    </button>
                  );})}
                </div>
              </div>
              <div style={s.formGroup}><label style={fLbl}>🚨 Likely trigger</label><input style={{...s.formInput,...inp}} placeholder="e.g. coffee, oats, stress, unknown" value={flareForm.trigger} onChange={e=>setFlareForm({...flareForm,trigger:e.target.value})}/></div>
              <div style={s.formGroup}>
                <label style={fLbl}>🔁 Timeline (key moments)</label>
                {flareForm.timeline.map((entry,i)=>(
                  <div key={i} style={{display:"flex",gap:8,marginBottom:8}}>
                    <input type="time" style={{...s.formInput,...inp,flex:"0 0 110px"}} value={entry.time} onChange={e=>{const tl=[...flareForm.timeline];tl[i]={...tl[i],time:e.target.value};setFlareForm({...flareForm,timeline:tl});}}/>
                    <input style={{...s.formInput,...inp,flex:1}} placeholder={`Symptom ${i+1}`} value={entry.symptom} onChange={e=>{const tl=[...flareForm.timeline];tl[i]={...tl[i],symptom:e.target.value};setFlareForm({...flareForm,timeline:tl});}}/>
                  </div>
                ))}
                <button onClick={()=>setFlareForm({...flareForm,timeline:[...flareForm.timeline,{time:"",symptom:""}]})} style={{...s.bodyBtn,fontSize:12,background:t.inputBg,border:`1.5px solid ${t.border}`,color:t.textMuted}}>＋ Add moment</button>
              </div>
              <div style={s.formGroup}>
                <label style={fLbl}>🍽 Food during flare</label>
                {flareForm.foods.map((f2,i)=><input key={i} style={{...s.formInput,...inp,marginBottom:6}} placeholder={`Food item ${i+1}`} value={f2} onChange={e=>{const arr=[...flareForm.foods];arr[i]=e.target.value;setFlareForm({...flareForm,foods:arr});}}/>)}
                <button onClick={()=>setFlareForm({...flareForm,foods:[...flareForm.foods,""]})} style={{...s.bodyBtn,fontSize:12,background:t.inputBg,border:`1.5px solid ${t.border}`,color:t.textMuted}}>＋ Add food</button>
              </div>
              <div style={s.formGroup}>
                <label style={fLbl}>💊 Meds taken</label>
                {flareForm.meds_taken.map((m2,i)=><input key={i} style={{...s.formInput,...inp,marginBottom:6}} placeholder="e.g. Cetirizine 10mg at 9am" value={m2} onChange={e=>{const arr=[...flareForm.meds_taken];arr[i]=e.target.value;setFlareForm({...flareForm,meds_taken:arr});}}/>)}
                <button onClick={()=>setFlareForm({...flareForm,meds_taken:[...flareForm.meds_taken,""]})} style={{...s.bodyBtn,fontSize:12,background:t.inputBg,border:`1.5px solid ${t.border}`,color:t.textMuted}}>＋ Add med</button>
              </div>
              <div style={s.formGroup}>
                <label style={fLbl}>🔍 Symptoms</label>
                {Object.entries(FLARE_SYMPTOMS).map(([group,syms])=>(
                  <div key={group} style={{marginBottom:10}}>
                    <div style={{fontSize:11,fontWeight:600,color:t.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>{group}</div>
                    <div style={s.bodyGrid}>
                      {syms.map(sym=>{const sel=(flareForm.symptoms||[]).includes(sym);return(
                        <button key={sym} onClick={()=>toggleFlareSymptom(sym)}
                          style={{...s.bodyBtn,background:sel?(dm?"#2A1A50":"#EDE9FF"):t.inputBg,color:sel?t.accent:t.textMuted,border:sel?`1.5px solid ${t.accent}`:`1.5px solid ${t.border}`,fontWeight:sel?700:400}}>
                          {sel?"✓ ":""}{sym}
                        </button>
                      );})}
                    </div>
                  </div>
                ))}
              </div>
              <div style={s.formGroup}>
                <label style={fLbl}>📊 Severity</label>
                <div style={s.bodyGrid}>
                  {["1 - Mild","2 - Moderate","3 - Severe"].map(sev=>{const c=sc(sev);const sel=flareForm.severity===sev;return(
                    <button key={sev} onClick={()=>setFlareForm({...flareForm,severity:sev})}
                      style={{...s.bodyBtn,background:sel?c.bg:t.inputBg,color:sel?c.text:t.textMuted,border:sel?`1.5px solid ${c.dot}`:`1.5px solid ${t.border}`,fontWeight:sel?700:400}}>{sev}</button>
                  );})}
                </div>
              </div>
              <div style={s.formGroup}><label style={fLbl}>🧠 Pattern noticed</label><input style={{...s.formInput,...inp}} placeholder='"e.g. everything triggered after coffee"' value={flareForm.pattern} onChange={e=>setFlareForm({...flareForm,pattern:e.target.value})}/></div>
              <div style={s.formRow}>
                <div style={{...s.formGroup,flex:1}}>
                  <label style={fLbl}>🔁 Re-triggered with food?</label>
                  <div style={s.bodyGrid}>{["Yes","No"].map(v=>{const sel=flareForm.retriggered===v;return <button key={v} onClick={()=>setFlareForm({...flareForm,retriggered:v})} style={{...s.bodyBtn,background:sel?(dm?"#2A1A50":"#EDE9FF"):t.inputBg,color:sel?t.accent:t.textMuted,border:sel?`1.5px solid ${t.accent}`:`1.5px solid ${t.border}`,fontWeight:sel?700:400}}>{v}</button>;})}</div>
                </div>
                <div style={{...s.formGroup,flex:1}}>
                  <label style={fLbl}>⏳ Duration</label>
                  <div style={s.bodyGrid}>{FLARE_DURATIONS.map(d=>{const sel=flareForm.duration===d;return <button key={d} onClick={()=>setFlareForm({...flareForm,duration:d})} style={{...s.bodyBtn,background:sel?(dm?"#2A1A50":"#EDE9FF"):t.inputBg,color:sel?t.accent:t.textMuted,border:sel?`1.5px solid ${t.accent}`:`1.5px solid ${t.border}`,fontWeight:sel?700:400}}>{d}</button>;})}</div>
                </div>
              </div>
              {flareSaveMsg&&<div style={{...s.saveMsgBox,background:flareSaveMsg.startsWith("Error")?(dm?"#3B1010":"#FFEBEE"):(dm?"#1B3320":"#E8F5E9"),color:flareSaveMsg.startsWith("Error")?(dm?"#EF9A9A":"#C62828"):(dm?"#81C784":"#2E7D32")}}>{flareSaveMsg}</div>}
              <div style={{display:"flex",gap:10}}>
                <button style={{...s.saveBtn,background:t.chipBg,color:t.textMuted,flex:"0 0 80px"}} onClick={()=>setView("flares")}>Cancel</button>
                <button style={{...s.saveBtn,flex:1,background:t.accentBtn}} onClick={saveFlare} disabled={saving}>{saving?"Saving…":"Save Flare Diary"}</button>
              </div>
            </div>
          </div>
        )}

        {/* ADD / EDIT REACTION */}
        {view==="add" && (
          <div style={{animation:"fadeIn 0.2s ease"}}>
            <div style={{...s.formCard,background:t.surface,border:`1.5px solid ${t.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div style={{...s.sectionTitle,color:t.accent,margin:0}}>{editingId?"✏️ Edit reaction":"Log a new reaction"}</div>
                {editingId&&<button onClick={()=>{setEditingId(null);setReactionForm(EMPTY_REACTION);setSaveMsg("");setView("list");}} style={{background:"none",border:"none",color:t.textMuted,cursor:"pointer",fontSize:13}}>✕ Cancel edit</button>}
              </div>
              <div style={s.formGroup}><label style={fLbl}>Event name *</label><input style={{...s.formInput,...inp}} placeholder="e.g. Lunch at work…" value={reactionForm["Event Name"]} onChange={e=>setReactionForm({...reactionForm,"Event Name":e.target.value})}/></div>
              <div style={s.formGroup}><label style={fLbl}>Date & Time *</label><input type="datetime-local" style={{...s.formInput,...inp}} value={reactionForm["Date & Time"]} onChange={e=>setReactionForm({...reactionForm,"Date & Time":e.target.value})}/></div>
              <div style={s.formGroup}><label style={fLbl}>Food / Drink</label><input style={{...s.formInput,...inp}} placeholder="What did you eat or drink?" value={reactionForm["Food/Drink"]} onChange={e=>setReactionForm({...reactionForm,"Food/Drink":e.target.value})}/></div>
              <div style={s.formRow}>
                <div style={{...s.formGroup,flex:1}}><label style={fLbl}>Early symptoms</label><textarea style={{...s.formTextarea,...inp}} placeholder="Itching, flushing…" value={reactionForm["Early Symptoms"]} onChange={e=>setReactionForm({...reactionForm,"Early Symptoms":e.target.value})}/></div>
                <div style={{...s.formGroup,flex:1}}><label style={fLbl}>Mid symptoms</label><textarea style={{...s.formTextarea,...inp}} placeholder="Cramping, diarrhoea…" value={reactionForm["Mid Symptoms"]} onChange={e=>setReactionForm({...reactionForm,"Mid Symptoms":e.target.value})}/></div>
              </div>
              <div style={s.formGroup}><label style={fLbl}>Severe symptoms</label><textarea style={{...s.formTextarea,...inp}} placeholder="Difficulty breathing, anaphylaxis…" value={reactionForm["Severe Symptoms"]} onChange={e=>setReactionForm({...reactionForm,"Severe Symptoms":e.target.value})}/></div>
              <div style={s.formGroup}>
                <label style={fLbl}>Body regions affected</label>
                <div style={s.bodyGrid}>
                  {BODY_REGIONS.map(region=>{const sel=(reactionForm["Body Regions"]||[]).includes(region.id);return(
                    <button key={region.id} onClick={()=>toggleBodyRegion(region.id)}
                      style={{...s.bodyBtn,background:sel?(dm?"#2A1A50":"#EDE9FF"):t.inputBg,color:sel?t.accent:t.textMuted,border:sel?`1.5px solid ${t.accent}`:`1.5px solid ${t.border}`,fontWeight:sel?700:400}}>
                      {region.label}
                    </button>
                  );})}
                </div>
              </div>
              <div style={s.formGroup}><label style={fLbl}>Medications taken during reaction</label><input style={{...s.formInput,...inp}} placeholder="e.g. Cetirizine 10mg, Epipen" value={reactionForm["Medications Taken"]} onChange={e=>setReactionForm({...reactionForm,"Medications Taken":e.target.value})}/></div>
              <div style={s.formRow}>
                <div style={{...s.formGroup,flex:1}}><label style={fLbl}>Suspected allergen</label><input style={{...s.formInput,...inp}} placeholder="Dairy, salicylates…" value={reactionForm["Suspected Allergen"]} onChange={e=>setReactionForm({...reactionForm,"Suspected Allergen":e.target.value})}/></div>
                <div style={{...s.formGroup,flex:1}}><label style={fLbl}>Severity</label><select style={{...s.formInput,...inp}} value={reactionForm["Severity Level"]} onChange={e=>setReactionForm({...reactionForm,"Severity Level":e.target.value})}><option value="">Select…</option>{SEVERITY_LEVELS.map(l=><option key={l}>{l}</option>)}</select></div>
                <div style={{...s.formGroup,flex:1}}><label style={fLbl}>Stress level</label><select style={{...s.formInput,...inp}} value={reactionForm["Stress Level"]} onChange={e=>setReactionForm({...reactionForm,"Stress Level":e.target.value})}><option value="">Select…</option>{STRESS_LEVELS.map(l=><option key={l}>{l}</option>)}</select></div>
              </div>
              {saveMsg&&<div style={{...s.saveMsgBox,background:saveMsg.startsWith("Error")?(dm?"#3B1010":"#FFEBEE"):(dm?"#1B3320":"#E8F5E9"),color:saveMsg.startsWith("Error")?(dm?"#EF9A9A":"#C62828"):(dm?"#81C784":"#2E7D32")}}>{saveMsg}</div>}
              <button style={{...s.saveBtn,background:t.accentBtn}} onClick={saveReaction} disabled={saving}>
                {saving?"Saving…":editingId?"💾 Save Changes":"Save Reaction"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  root:         { fontFamily:"'DM Sans','Segoe UI',sans-serif", minHeight:"100vh" },
  header:       { padding:"24px 20px 0", color:"white" },
  headerInner:  { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 },
  headerLabel:  { fontSize:11, fontWeight:600, letterSpacing:"0.15em", opacity:0.75, textTransform:"uppercase", marginBottom:2 },
  headerTitle:  { margin:0, fontSize:26, fontWeight:700, letterSpacing:"-0.5px" },
  headerStats:  { display:"flex", gap:8 },
  statPill:     { background:"rgba(255,255,255,0.2)", borderRadius:20, padding:"6px 14px", display:"flex", flexDirection:"column", alignItems:"center" },
  statNum:      { fontSize:18, fontWeight:700, lineHeight:1, color:"white" },
  statLabel:    { fontSize:10, opacity:0.8, marginTop:1 },
  nav:          { display:"flex", gap:3, overflowX:"auto" },
  navBtn:       { flex:1, minWidth:52, border:"none", padding:"10px 6px", borderRadius:"10px 10px 0 0", cursor:"pointer", fontSize:12, fontWeight:500, whiteSpace:"nowrap" },
  content:      { padding:"16px 16px 80px" },
  errorBanner:  { padding:"10px 14px", borderRadius:10, marginBottom:12, fontSize:14 },
  loadingWrap:  { display:"flex", alignItems:"center", gap:10, padding:20 },
  spinner:      { width:20, height:20, border:"2px solid #E0D7FF", borderTopColor:"#7C4DFF", borderRadius:"50%", animation:"spin 0.8s linear infinite" },
  filterBar:    { display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 },
  searchInput:  { flex:"1 1 160px", padding:"9px 14px", borderRadius:10, fontSize:13, outline:"none" },
  select:       { padding:"9px 10px", borderRadius:10, fontSize:13, cursor:"pointer" },
  exportBtn:    { padding:"9px 14px", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer" },
  resultCount:  { fontSize:12, marginBottom:10 },
  empty:        { padding:"24px 0", textAlign:"center", fontSize:14 },
  card:         { borderRadius:14, padding:"14px 16px", marginBottom:10, cursor:"pointer", transition:"box-shadow 0.15s" },
  cardTop:      { display:"flex", justifyContent:"space-between", alignItems:"flex-start" },
  cardLeft:     { display:"flex", alignItems:"flex-start", gap:10 },
  sevDot:       { width:10, height:10, borderRadius:"50%", marginTop:5, flexShrink:0 },
  cardTitle:    { fontSize:15, fontWeight:600, lineHeight:1.3 },
  cardDate:     { fontSize:12, marginTop:2 },
  cardRight:    { display:"flex", alignItems:"center", gap:4, flexShrink:0, marginLeft:8 },
  badge:        { fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:20 },
  chevron:      { fontSize:10, marginLeft:2 },
  foodRow:      { fontSize:13, marginTop:8, paddingLeft:20 },
  expandedSection: { paddingLeft:20, marginTop:6 },
  divider:      { height:1, margin:"10px 0" },
  symptomRow:   { display:"flex", alignItems:"baseline", gap:8, fontSize:13, marginBottom:6 },
  symLabel:     { fontSize:10, fontWeight:700, background:"#E8F5E9", color:"#2E7D32", padding:"2px 7px", borderRadius:20, flexShrink:0 },
  metaRow:      { display:"flex", gap:8, flexWrap:"wrap", marginTop:8 },
  allergenTag:  { fontSize:12, padding:"3px 10px", borderRadius:20, fontWeight:500 },
  metaChip:     { fontSize:12, padding:"3px 10px", borderRadius:20 },
  sectionTitle: { fontSize:12, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10, marginTop:16 },
  chartCard:    { borderRadius:14, padding:16, marginBottom:8 },
  barChart:     { display:"flex", alignItems:"flex-end", gap:10, height:160, paddingBottom:28, position:"relative" },
  barCol:       { flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end", height:"100%", position:"relative" },
  bar:          { width:"100%", background:"linear-gradient(180deg,#7C4DFF,#448AFF)", borderRadius:"5px 5px 0 0", minHeight:4 },
  barLabel:     { fontSize:11, fontWeight:600, marginBottom:4 },
  barMonth:     { fontSize:10, marginTop:4, position:"absolute", bottom:0 },
  sevRow:       { display:"flex", alignItems:"center", gap:10, marginBottom:10 },
  sevRowLabel:  { fontSize:13, width:110, flexShrink:0 },
  sevBarWrap:   { flex:1, height:8, borderRadius:10, overflow:"hidden" },
  sevBar:       { height:"100%", borderRadius:10 },
  sevCount:     { fontSize:13, fontWeight:600, width:50, textAlign:"right" },
  medGroupLabel:{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginTop:12, marginBottom:6 },
  medCard:      { borderRadius:12, padding:"12px 14px", marginBottom:8, display:"flex", alignItems:"flex-start", gap:10 },
  medName:      { fontSize:14, fontWeight:600 },
  medDose:      { fontSize:12, fontWeight:400, padding:"1px 7px", borderRadius:20, marginLeft:6 },
  medMeta:      { fontSize:12, marginTop:2 },
  medNotes:     { fontSize:12, marginTop:2, fontStyle:"italic" },
  deleteBtn:    { background:"none", border:"none", cursor:"pointer", fontSize:14, padding:"2px 4px", flexShrink:0 },
  formCard:     { borderRadius:16, padding:20 },
  formGroup:    { marginBottom:14 },
  formRow:      { display:"flex", gap:12, flexWrap:"wrap" },
  formLabel:    { display:"block", fontSize:11, fontWeight:700, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" },
  formInput:    { width:"100%", padding:"9px 12px", borderRadius:10, fontSize:14, boxSizing:"border-box", outline:"none" },
  formTextarea: { width:"100%", padding:"9px 12px", borderRadius:10, fontSize:14, resize:"vertical", minHeight:70, boxSizing:"border-box", outline:"none", fontFamily:"inherit" },
  bodyGrid:     { display:"flex", flexWrap:"wrap", gap:8 },
  bodyBtn:      { padding:"6px 12px", borderRadius:20, fontSize:12, cursor:"pointer" },
  saveMsgBox:   { padding:"10px 14px", borderRadius:10, fontSize:14, marginBottom:12 },
  saveBtn:      { width:"100%", padding:13, color:"white", border:"none", borderRadius:12, fontSize:15, fontWeight:700, cursor:"pointer", marginTop:4 },
  reportWrap:   { borderRadius:16, padding:"24px 20px" },
  reportHeader: { borderBottomWidth:2, borderBottomStyle:"solid", paddingBottom:16, marginBottom:20 },
  reportTitle:  { fontSize:22, fontWeight:700 },
  reportMeta:   { fontSize:13, marginTop:4 },
  reportSection:{ marginBottom:24 },
  reportSectionTitle: { fontSize:13, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12, paddingBottom:6, borderBottomWidth:1, borderBottomStyle:"solid" },
  reportGrid:   { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:12 },
  reportStat:   { borderRadius:12, padding:"14px 16px", textAlign:"center" },
  reportStatNum:{ fontSize:28, fontWeight:700 },
  reportStatLabel:{ fontSize:11, marginTop:4 },
  reportRow:    { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottomWidth:1, borderBottomStyle:"solid" },
  reportTable:  { width:"100%", borderCollapse:"collapse", fontSize:12 },
  reportTh:     { textAlign:"left", padding:"8px 10px", fontWeight:600, fontSize:11, textTransform:"uppercase", letterSpacing:"0.05em" },
  reportTd:     { padding:"8px 10px", borderBottomWidth:1, borderBottomStyle:"solid", verticalAlign:"top" },
  reportFooter: { marginTop:24, paddingTop:12, borderTopWidth:1, borderTopStyle:"solid", fontSize:11, textAlign:"center" },
  overlay:      { position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", animation:"overlayIn 0.15s ease" },
  modal:        { borderRadius:18, padding:"28px 24px", width:"min(320px,90vw)", textAlign:"center", animation:"slideUp 0.2s ease" },
  modalBtn:     { flex:1, padding:"11px 0", borderRadius:10, border:"none", fontSize:14, fontWeight:600, cursor:"pointer" },
  quickPanel:   { borderRadius:20, padding:"24px 20px", width:"min(420px,95vw)", maxHeight:"90vh", overflowY:"auto", animation:"slideUp 0.2s ease" },
};
