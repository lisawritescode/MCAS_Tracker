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
  "photo_urls": [],
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

  // dark mode, edit, delete, quick-log
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

  // photo upload state
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploadMsg, setPhotoUploadMsg] = useState("");

  // bottom nav menu
  const [menuOpen, setMenuOpen] = useState(false);

  // ── OFFLINE SUPPORT ──────────────────────────────────────────────────────────
  const [isOnline,     setIsOnline]     = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mcas-queue")||"[]"); } catch { return []; }
  });
  const [syncMsg,      setSyncMsg]      = useState("");
  const [syncing,      setSyncing]      = useState(false);

  // ── GP LETTER STATE ──────────────────────────────────────────────────────────
  const [gpLetter, setGpLetter] = useState({
    patientName:"", dob:"", nhsNumber:"", gpName:"", gpPractice:"",
    consultantName:"", consultantHospital:"", diagnosisDate:"",
    additionalNotes:"",
  });

  // ── EMERGENCY CARD ───────────────────────────────────────────────────────────
  const [emergencyCard, setEmergencyCard] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mcas-emergency-card")||"{}"); } catch { return {}; }
  });

  // ── FOOD JOURNAL ─────────────────────────────────────────────────────────────
  const [foodJournal,    setFoodJournal]    = useState([]);
  const [foodForm,       setFoodForm]       = useState({
    date: new Date().toISOString().slice(0,10), meal: "Breakfast", items: "", notes: "",
  });
  const [foodSaveMsg,    setFoodSaveMsg]    = useState("");
  const MEAL_TYPES = ["Breakfast","Morning snack","Lunch","Afternoon snack","Dinner","Evening snack","Other"];

  // ── NOTES / FREE JOURNAL ─────────────────────────────────────────────────────
  const [notes,       setNotes]       = useState([]);
  const [noteForm,    setNoteForm]    = useState({ title:"", body:"", mood:"", energy:"", tags:"" });
  const [noteSaveMsg, setNoteSaveMsg] = useState("");
  const [noteSearch,  setNoteSearch]  = useState("");
  const [expandedNote,setExpandedNote]= useState(null);
  const MOOD_OPTIONS   = ["😊 Good","😐 Okay","😔 Low","😰 Anxious","😤 Frustrated","😴 Exhausted"];
  const ENERGY_OPTIONS = ["⚡ High","🔋 Normal","🪫 Low","💤 Depleted"];

  // ── MEDICATION EFFECTIVENESS ─────────────────────────────────────────────────
  const [medLogs,    setMedLogs]    = useState([]);
  const [medLogForm, setMedLogForm] = useState({ med_name:"", rating:0, relief_time:"", side_effects:"", notes:"", logged_at: new Date().toISOString().slice(0,16) });
  const [medLogMsg,  setMedLogMsg]  = useState("");

  // ── APPOINTMENT PREP ─────────────────────────────────────────────────────────
  const [apptPrep, setApptPrep] = useState({ appointmentDate:"", consultantType:"Immunologist", questions:"", concerns:"", prepRange:90 });

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [notifSettings, setNotifSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mcas-notif")||"{}"); } catch { return {}; }
  });

  // ── PDF ───────────────────────────────────────────────────────────────────────
  const [pdfGenerating, setPdfGenerating] = useState(false);

  useEffect(() => {
    try { localStorage.setItem("mcas-dark", darkMode ? "1" : "0"); } catch {}
    document.body.style.background = darkMode ? "#0F0F1A" : "";
  }, [darkMode]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [r1, r2, r3, r4, r5, r6] = await Promise.all([
      supabase.from("reactions").select("*").order('"Date & Time"', { ascending:false }),
      supabase.from("medications").select("*").order("created_at", { ascending:false }),
      supabase.from("flares").select("*").order("date", { ascending:false }),
      supabase.from("food_journal").select("*").order("date", { ascending:false }).order("created_at", { ascending:false }),
      supabase.from("notes").select("*").order("created_at", { ascending:false }),
      supabase.from("med_logs").select("*").order("logged_at", { ascending:false }),
    ]);
    if (r1.error) setError(r1.error.message); else setReactions(r1.data || []);
    if (!r2.error) setMedications(r2.data || []);
    if (!r3.error) setFlares(r3.data || []);
    if (!r4.error) setFoodJournal(r4.data || []);
    if (!r5.error) setNotes(r5.data || []);
    if (!r6.error) setMedLogs(r6.data || []);
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


  // ── NOTIFICATIONS ────────────────────────────────────────────────────────────
  const requestNotifPermission = async () => {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  };

  // ── FOOD JOURNAL ─────────────────────────────────────────────────────────────
  const saveFoodEntry = async () => {
    if (!foodForm.items.trim()) { setFoodSaveMsg("Please enter what you ate."); return; }
    setSaving(true);
    const { error } = await supabase.from("food_journal").insert([foodForm]);
    if (error) setFoodSaveMsg("Error: "+error.message);
    else { setFoodSaveMsg("Saved!"); setFoodForm({ date: new Date().toISOString().slice(0,10), meal:"Breakfast", items:"", notes:"" }); await fetchAll(); setTimeout(()=>setFoodSaveMsg(""), 2000); }
    setSaving(false);
  };

  const deleteFoodEntry = async id => {
    await supabase.from("food_journal").delete().eq("id", id);
    setFoodJournal(prev => prev.filter(f => f.id !== id));
  };

  // ── NOTES ────────────────────────────────────────────────────────────────────
  const saveNote = async () => {
    if (!noteForm.body.trim()) { setNoteSaveMsg("Please write something first."); return; }
    setSaving(true);
    const payload = { ...noteForm, created_at: new Date().toISOString() };
    const { error } = await supabase.from("notes").insert([payload]);
    if (error) setNoteSaveMsg("Error: "+error.message);
    else { setNoteSaveMsg("Saved!"); setNoteForm({ title:"", body:"", mood:"", energy:"", tags:"" }); await fetchAll(); setTimeout(()=>setNoteSaveMsg(""), 2000); }
    setSaving(false);
  };

  const deleteNote = async id => {
    await supabase.from("notes").delete().eq("id", id);
    setNotes(prev => prev.filter(n => n.id !== id));
    if (expandedNote === id) setExpandedNote(null);
  };

  const filteredNotes = useMemo(() => {
    if (!noteSearch) return notes;
    const q = noteSearch.toLowerCase();
    return notes.filter(n => (n.title||"").toLowerCase().includes(q)||(n.body||"").toLowerCase().includes(q)||(n.tags||"").toLowerCase().includes(q));
  }, [notes, noteSearch]);

  // ── MED EFFECTIVENESS ────────────────────────────────────────────────────────
  const saveMedLog = async () => {
    if (!medLogForm.med_name) { setMedLogMsg("Select a medication."); return; }
    if (!medLogForm.rating)   { setMedLogMsg("Please give a rating."); return; }
    setSaving(true);
    const { error } = await supabase.from("med_logs").insert([medLogForm]);
    if (error) setMedLogMsg("Error: "+error.message);
    else { setMedLogMsg("Logged!"); setMedLogForm({ med_name:"", rating:0, relief_time:"", side_effects:"", notes:"", logged_at: new Date().toISOString().slice(0,16) }); await fetchAll(); setTimeout(()=>setMedLogMsg(""), 2000); }
    setSaving(false);
  };

  const medEffectiveness = useMemo(() => {
    const map = {};
    medLogs.forEach(l => {
      if (!map[l.med_name]) map[l.med_name] = { ratings:[], reliefTimes:[], sideEffects:[], logs:[] };
      map[l.med_name].ratings.push(l.rating);
      if (l.relief_time) map[l.med_name].reliefTimes.push(l.relief_time);
      if (l.side_effects) map[l.med_name].sideEffects.push(l.side_effects);
      map[l.med_name].logs.push(l);
    });
    return Object.entries(map).map(([name, data]) => ({
      name,
      avgRating: Math.round((data.ratings.reduce((a,b)=>a+b,0)/data.ratings.length)*10)/10,
      logCount:  data.ratings.length,
      reliefTimes: data.reliefTimes,
      sideEffects: [...new Set(data.sideEffects)],
      recentLogs: data.logs.slice(0,5),
      trend: data.ratings.length >= 3
        ? data.ratings.slice(-3).reduce((a,b)=>a+b,0)/3 > data.ratings.slice(0,3).reduce((a,b)=>a+b,0)/3 ? "improving" : "declining"
        : "insufficient data",
    })).sort((a,b) => b.avgRating - a.avgRating);
  }, [medLogs]);

  // ── APPOINTMENT PREP DATA ─────────────────────────────────────────────────────
  const appointmentData = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - apptPrep.prepRange);
    const inRange = reactions.filter(r => r["Date & Time"] && new Date(r["Date & Time"]) >= cutoff);
    const severe  = inRange.filter(r => (r["Severity Level"]||"").match(/3|4/));
    const allergenMap = inRange.reduce((acc,r) => { if (r["Suspected Allergen"]) acc[r["Suspected Allergen"]] = (acc[r["Suspected Allergen"]]||0)+1; return acc; }, {});
    const symCounts = {};
    inRange.forEach(r => {
      [r["Early Symptoms"]||"", r["Mid Symptoms"]||"", r["Severe Symptoms"]||""].join(", ")
        .split(/[,;/]+|and/i).map(s=>s.trim().toLowerCase().replace(/[^a-z\s-]/g,"")).filter(s=>s.length>=3)
        .forEach(s => { symCounts[s] = (symCounts[s]||0)+1; });
    });
    const topSymptoms = Object.entries(symCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const topTriggers = Object.entries(allergenMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const flaresInRange = flares.filter(f => f.date && new Date(f.date+"T12:00") >= cutoff);
    const weeklyMap = {};
    inRange.forEach(r => {
      const d = new Date(r["Date & Time"]);
      const week = `${d.getFullYear()}-W${String(Math.ceil((d.getDate())/7)).padStart(2,"0")}`;
      weeklyMap[week] = (weeklyMap[week]||0)+1;
    });
    const weeks = Object.entries(weeklyMap).sort((a,b)=>a[0].localeCompare(b[0]));
    const firstHalf  = weeks.slice(0, Math.floor(weeks.length/2)).reduce((a,b)=>a+b[1],0);
    const secondHalf = weeks.slice(Math.floor(weeks.length/2)).reduce((a,b)=>a+b[1],0);
    const trend = weeks.length < 2 ? "not enough data" : secondHalf > firstHalf ? "worsening" : secondHalf < firstHalf ? "improving" : "stable";
    return { inRange, severe, topSymptoms, topTriggers, flaresInRange, trend, weeks };
  }, [reactions, flares, apptPrep.prepRange]);

  // ── FOOD CORRELATION ─────────────────────────────────────────────────────────
  const foodByDate = useMemo(() => {
    const map = {};
    foodJournal.forEach(f => { if (!map[f.date]) map[f.date] = []; map[f.date].push(f); });
    return map;
  }, [foodJournal]);

  const foodReactionCorrelation = useMemo(() => {
    return reactions.slice(0,20).map(r => {
      if (!r["Date & Time"]) return null;
      const reactionTime = new Date(r["Date & Time"]);
      const windowStart  = new Date(reactionTime - 24*60*60*1000);
      const eaten = foodJournal.filter(f => { const fd = new Date(f.date + "T12:00:00"); return fd >= windowStart && fd <= reactionTime; });
      return { reaction: r, eaten };
    }).filter(Boolean);
  }, [reactions, foodJournal]);

  // ── PDF EXPORT ───────────────────────────────────────────────────────────────
  const exportPDF = async () => {
    setPdfGenerating(true);
    window.print();
    setPdfGenerating(false);
  };

  // ─── PHOTO UPLOAD ────────────────────────────────────────────────────────────
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setPhotoUploading(true);
    setPhotoUploadMsg("Uploading…");
    const urls = [];
    for (const file of files) {
      const fileName = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
      const { error: upErr } = await supabase.storage
        .from("reaction-photos")
        .upload(fileName, file, { upsert: true });
      if (upErr) {
        setPhotoUploadMsg(`Upload failed: ${upErr.message}`);
        setPhotoUploading(false);
        return;
      }
      const { data } = supabase.storage.from("reaction-photos").getPublicUrl(fileName);
      urls.push(data.publicUrl);
    }
    setReactionForm(f => ({ ...f, photo_urls: [...(f.photo_urls || []), ...urls] }));
    setPhotoUploadMsg(`${urls.length} photo${urls.length !== 1 ? "s" : ""} uploaded ✓`);
    setPhotoUploading(false);
    setTimeout(() => setPhotoUploadMsg(""), 2500);
  };

  const removePhoto = (url) => {
    setReactionForm(f => ({ ...f, photo_urls: (f.photo_urls || []).filter(u => u !== url) }));
  };
  // ─────────────────────────────────────────────────────────────────────────────

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
    setReactionForm({ ...EMPTY_REACTION, ...fields, photo_urls: fields.photo_urls || [] });
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
        @keyframes slideInRight { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }
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

      {/* HEADER — no tab row */}
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
      </div>

      {/* SLIDE-OUT MENU */}
      {menuOpen && (
        <div style={{position:"fixed",inset:0,zIndex:300,display:"flex"}} onClick={()=>setMenuOpen(false)}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.55)"}}/>
          <div style={{
            position:"absolute",right:0,top:0,bottom:0,width:"80vw",maxWidth:340,
            background:dm?"#12121F":"#ffffff",
            boxShadow:"-8px 0 40px rgba(0,0,0,0.4)",
            display:"flex",flexDirection:"column",overflowY:"auto",
          }} onClick={e=>e.stopPropagation()}>
            <div style={{
              padding:"20px 20px 14px",
              borderBottom:`1px solid ${t.border}`,
              display:"flex",justifyContent:"space-between",alignItems:"center",
            }}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:t.accent}}>All Sections</div>
              <button onClick={()=>setMenuOpen(false)} style={{background:"none",border:"none",fontSize:20,color:t.textMuted,cursor:"pointer",lineHeight:1,padding:"2px 4px"}}>✕</button>
            </div>
            {[
              {id:"list",      icon:"📋", label:"Reaction Log"},
              {id:"add",       icon:"➕", label:"Log New Reaction"},
              {id:"charts",    icon:"📊", label:"Insights"},
              {id:"food",      icon:"🍽️",  label:"Food Journal"},
              {id:"meds",      icon:"💊", label:"Medications"},
              {id:"medeffect", icon:"🧬", label:"Med Effectiveness"},
              {id:"flares",    icon:"🧾", label:"Flare Diaries"},
              {id:"notes",     icon:"💬", label:"Journal Notes"},
              {id:"appt",      icon:"🏥", label:"Appointment Prep"},
              {id:"report",    icon:"🖨️",  label:"Report"},
              {id:"gpletter",  icon:"✉️",  label:"GP Letter"},
              {id:"emergency", icon:"🪪", label:"Emergency Card"},
              {id:"notifs",    icon:"🔔", label:"Alerts & Reminders"},
            ].map(item=>{
              const active = view===item.id;
              return (
                <button key={item.id} onClick={()=>{
                  if(item.id==="add"){ setEditingId(null); setReactionForm(EMPTY_REACTION); setSaveMsg(""); setPhotoUploadMsg(""); }
                  setView(item.id);
                  setMenuOpen(false);
                }} style={{
                  display:"flex",alignItems:"center",gap:16,
                  padding:"16px 20px",
                  background:active?(dm?"#2A1A50":"#F0EBFF"):"transparent",
                  border:"none",borderBottom:`1px solid ${t.border}`,
                  cursor:"pointer",textAlign:"left",width:"100%",
                }}>
                  <span style={{fontSize:22,width:32,textAlign:"center",flexShrink:0}}>{item.icon}</span>
                  <span style={{fontSize:15,fontWeight:active?700:400,color:active?t.accent:t.text}}>{item.label}</span>
                </button>
              );
            })}
            <div style={{padding:20,marginTop:"auto"}}>
              <button onClick={()=>{setMenuOpen(false);openQuickLog();}} style={{
                width:"100%",padding:"13px 0",
                background:"linear-gradient(135deg,#FF4444,#FF8800)",
                color:"white",border:"none",borderRadius:12,
                fontSize:14,fontWeight:700,cursor:"pointer",
              }}>⚡ Quick Log</button>
            </div>
          </div>
        </div>
      )}

      {/* FIXED BOTTOM NAV */}
      <div className="no-print" style={{
        position:"fixed",bottom:0,left:0,right:0,zIndex:200,
        background:dm?"#1A1A2E":"#ffffff",
        borderTop:`1.5px solid ${t.border}`,
        display:"flex",alignItems:"stretch",
        paddingBottom:"env(safe-area-inset-bottom)",
        boxShadow:"0 -4px 20px rgba(0,0,0,0.10)",
      }}>
        {[
          {id:"list",   icon:"📋", label:"Log"},
          {id:"charts", icon:"📊", label:"Insights"},
          {id:"add",    icon:"➕", label:"Add"},
        ].map(tab=>{
          const active = view===tab.id;
          return (
            <button key={tab.id} onClick={()=>{
              if(tab.id==="add"){ setEditingId(null); setReactionForm(EMPTY_REACTION); setSaveMsg(""); setPhotoUploadMsg(""); }
              setView(tab.id);
            }} style={{
              flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              padding:"10px 0 8px",border:"none",background:"transparent",cursor:"pointer",
              color:active?t.accent:t.textMuted,
            }}>
              <span style={{fontSize:20,lineHeight:1}}>{tab.icon}</span>
              <span style={{fontSize:10,fontWeight:active?700:500,marginTop:3}}>{tab.label}</span>
              {active&&<div style={{width:20,height:2.5,borderRadius:2,background:t.accent,marginTop:3}}/>}
            </button>
          );
        })}
        <button onClick={()=>setMenuOpen(true)} style={{
          flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
          padding:"10px 0 8px",border:"none",background:"transparent",cursor:"pointer",
          color:t.textMuted,
        }}>
          <span style={{fontSize:20,lineHeight:1}}>☰</span>
          <span style={{fontSize:10,fontWeight:500,marginTop:3}}>More</span>
        </button>
      </div>

      <div style={{...s.content,background:t.root,paddingBottom:90}}>
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
                      {(r.photo_urls||[]).length>0&&<span style={{fontSize:12,color:t.textMuted}} title={`${r.photo_urls.length} photo(s)`}>📷 {r.photo_urls.length}</span>}
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
                      {/* PHOTO THUMBNAILS */}
                      {(r.photo_urls||[]).length>0&&(
                        <div style={{marginTop:10}}>
                          <div style={{fontSize:11,fontWeight:700,color:t.accent,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Photos</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                            {r.photo_urls.map((url,i)=>(
                              <a key={i} href={url} target="_blank" rel="noreferrer" title="Open full image">
                                <img src={url} alt={`reaction photo ${i+1}`}
                                  style={{width:72,height:72,objectFit:"cover",borderRadius:10,border:`1.5px solid ${t.border}`,display:"block"}}/>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
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

              {/* ── PHOTO UPLOAD SECTION ── */}
              <div style={s.formGroup}>
                <label style={fLbl}>📷 Photos (rashes / reactions)</label>
                <div style={{...s.photoUploadBox, background: dm?"#12121F":"#FAFAFA", border:`1.5px dashed ${t.border}`}}>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    disabled={photoUploading}
                    style={{fontSize:13, color:t.text, cursor:"pointer", width:"100%"}}
                  />
                  <div style={{fontSize:12,color:t.textMuted,marginTop:6}}>
                    Select one or more photos — they'll upload straight to your tracker
                  </div>
                </div>
                {photoUploading && (
                  <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
                    <div style={s.spinner}/>
                    <span style={{fontSize:13,color:t.textMuted}}>Uploading photos…</span>
                  </div>
                )}
                {photoUploadMsg && !photoUploading && (
                  <div style={{fontSize:13,marginTop:6,color:photoUploadMsg.startsWith("Upload failed")?( dm?"#EF9A9A":"#C62828"):(dm?"#81C784":"#2E7D32")}}>
                    {photoUploadMsg}
                  </div>
                )}
                {(reactionForm.photo_urls||[]).length>0&&(
                  <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:12}}>
                    {reactionForm.photo_urls.map((url,i)=>(
                      <div key={i} style={{position:"relative"}}>
                        <img src={url} alt={`photo ${i+1}`}
                          style={{width:80,height:80,objectFit:"cover",borderRadius:10,border:`1.5px solid ${t.border}`,display:"block"}}/>
                        <button onClick={()=>removePhoto(url)}
                          style={{position:"absolute",top:-7,right:-7,background:"#F44336",color:"white",
                            border:"none",borderRadius:"50%",width:22,height:22,fontSize:13,cursor:"pointer",
                            lineHeight:"22px",textAlign:"center",fontWeight:700,padding:0}}>
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* ─────────────────────────── */}

              {saveMsg&&<div style={{...s.saveMsgBox,background:saveMsg.startsWith("Error")?(dm?"#3B1010":"#FFEBEE"):(dm?"#1B3320":"#E8F5E9"),color:saveMsg.startsWith("Error")?(dm?"#EF9A9A":"#C62828"):(dm?"#81C784":"#2E7D32")}}>{saveMsg}</div>}
              <button style={{...s.saveBtn,background:t.accentBtn}} onClick={saveReaction} disabled={saving||photoUploading}>
                {saving?"Saving…":editingId?"💾 Save Changes":"Save Reaction"}
              </button>
            </div>
          </div>
        )}
        {view==="emergency" && (
          <div style={{animation:"fadeIn 0.2s ease"}}>
            {/* Edit form */}
            <div style={{...s.formCard,background:t.surface,border:`1.5px solid ${t.border}`,marginBottom:12}} className="no-print">
              <div style={{...s.sectionTitle,color:t.accent,marginTop:0}}>🪪 Emergency Card</div>
              <div style={{fontSize:13,color:t.textMuted,marginBottom:14,lineHeight:1.5}}>Fill in your details — the card below updates live. Print it wallet-sized (use browser print → scale to fit) and keep it in your bag.</div>
              <div style={s.formRow}>
                <div style={{...s.formGroup,flex:2}}><label style={fLbl}>Full name</label><input style={{...s.formInput,...inp}} placeholder="Your name" value={emergencyCard.name||""} onChange={e=>setEmergencyCard({...emergencyCard,name:e.target.value})}/></div>
                <div style={{...s.formGroup,flex:1}}><label style={fLbl}>DOB</label><input type="date" style={{...s.formInput,...inp}} value={emergencyCard.dob||""} onChange={e=>setEmergencyCard({...emergencyCard,dob:e.target.value})}/></div>
                <div style={{...s.formGroup,flex:1}}><label style={fLbl}>NHS number</label><input style={{...s.formInput,...inp}} placeholder="000 000 0000" value={emergencyCard.nhsNumber||""} onChange={e=>setEmergencyCard({...emergencyCard,nhsNumber:e.target.value})}/></div>
              </div>
              <div style={s.formRow}>
                <div style={{...s.formGroup,flex:2}}><label style={fLbl}>Diagnosis</label><input style={{...s.formInput,...inp}} placeholder="e.g. Mast Cell Activation Syndrome (MCAS)" value={emergencyCard.diagnosis||""} onChange={e=>setEmergencyCard({...emergencyCard,diagnosis:e.target.value})}/></div>
                <div style={{...s.formGroup,flex:2}}><label style={fLbl}>Known allergies / triggers</label><input style={{...s.formInput,...inp}} placeholder="e.g. NSAIDs, high-salicylate foods" value={emergencyCard.allergies||""} onChange={e=>setEmergencyCard({...emergencyCard,allergies:e.target.value})}/></div>
              </div>
              <div style={s.formGroup}><label style={fLbl}>Rescue medications (carried)</label><input style={{...s.formInput,...inp}} placeholder="e.g. Epipen 0.3mg, Cetirizine 10mg, Ranitidine 150mg" value={emergencyCard.rescueMeds||""} onChange={e=>setEmergencyCard({...emergencyCard,rescueMeds:e.target.value})}/></div>
              <div style={s.formRow}>
                <div style={{...s.formGroup,flex:2}}><label style={fLbl}>Emergency contact name</label><input style={{...s.formInput,...inp}} placeholder="e.g. Jane Smith (partner)" value={emergencyCard.emergencyContact||""} onChange={e=>setEmergencyCard({...emergencyCard,emergencyContact:e.target.value})}/></div>
                <div style={{...s.formGroup,flex:1}}><label style={fLbl}>Phone</label><input style={{...s.formInput,...inp}} placeholder="07700 000000" value={emergencyCard.emergencyPhone||""} onChange={e=>setEmergencyCard({...emergencyCard,emergencyPhone:e.target.value})}/></div>
              </div>
              <div style={s.formGroup}><label style={fLbl}>Additional notes for first responders</label><textarea style={{...s.formTextarea,...inp,minHeight:60}} placeholder="e.g. Do NOT give NSAIDs or morphine. Avoid latex gloves." value={emergencyCard.notes||""} onChange={e=>setEmergencyCard({...emergencyCard,notes:e.target.value})}/></div>
              <button onClick={()=>window.print()} style={{...s.saveBtn,background:t.accentBtn}}>🖨 Print wallet card</button>
            </div>

            {/* THE CARD — print target */}
            <div style={{background:"white",borderRadius:16,border:"2px solid #7C4DFF",padding:"20px 22px",maxWidth:420,margin:"0 auto",fontFamily:"'DM Sans','Segoe UI',sans-serif",color:"#1A1A2E",boxShadow:"0 4px 24px rgba(124,77,255,0.15)"}}>
              {/* Card header */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,paddingBottom:10,borderBottom:"2px solid #7C4DFF"}}>
                <div>
                  <div style={{fontSize:9,fontWeight:700,color:"#7C4DFF",textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:2}}>Medical Alert Card</div>
                  <div style={{fontSize:17,fontWeight:700,color:"#1A1A2E",lineHeight:1.2}}>{emergencyCard.name||"[Your name]"}</div>
                  {emergencyCard.dob&&<div style={{fontSize:11,color:"#666",marginTop:1}}>DOB: {new Date(emergencyCard.dob).toLocaleDateString("en-GB")}</div>}
                  {emergencyCard.nhsNumber&&<div style={{fontSize:11,color:"#666"}}>NHS: {emergencyCard.nhsNumber}</div>}
                </div>
                <div style={{background:"#EDE9FF",borderRadius:8,padding:"6px 10px",textAlign:"center",flexShrink:0}}>
                  <div style={{fontSize:20}}>⚠️</div>
                  <div style={{fontSize:8,fontWeight:700,color:"#7C4DFF",textTransform:"uppercase",letterSpacing:"0.05em",marginTop:2}}>MCAS</div>
                </div>
              </div>

              {/* Diagnosis */}
              {emergencyCard.diagnosis&&(
                <div style={{marginBottom:8,padding:"6px 10px",background:"#EDE9FF",borderRadius:8}}>
                  <div style={{fontSize:9,fontWeight:700,color:"#7C4DFF",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2}}>Diagnosis</div>
                  <div style={{fontSize:12,color:"#1A1A2E",fontWeight:500}}>{emergencyCard.diagnosis}</div>
                </div>
              )}

              {/* Allergies */}
              {emergencyCard.allergies&&(
                <div style={{marginBottom:8,padding:"6px 10px",background:"#FFEBEE",borderRadius:8,border:"1px solid #FFCDD2"}}>
                  <div style={{fontSize:9,fontWeight:700,color:"#C62828",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2}}>⛔ Do NOT give / Triggers</div>
                  <div style={{fontSize:12,color:"#1A1A2E",fontWeight:500}}>{emergencyCard.allergies}</div>
                </div>
              )}

              {/* Rescue meds */}
              {emergencyCard.rescueMeds&&(
                <div style={{marginBottom:8,padding:"6px 10px",background:"#E8F5E9",borderRadius:8}}>
                  <div style={{fontSize:9,fontWeight:700,color:"#2E7D32",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2}}>✅ Rescue medications (in bag)</div>
                  <div style={{fontSize:12,color:"#1A1A2E"}}>{emergencyCard.rescueMeds}</div>
                </div>
              )}

              {/* Notes */}
              {emergencyCard.notes&&(
                <div style={{marginBottom:8,padding:"6px 10px",background:"#FFF8E1",borderRadius:8}}>
                  <div style={{fontSize:9,fontWeight:700,color:"#F57F17",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2}}>First responder notes</div>
                  <div style={{fontSize:11,color:"#1A1A2E"}}>{emergencyCard.notes}</div>
                </div>
              )}

              {/* Emergency contact */}
              {(emergencyCard.emergencyContact||emergencyCard.emergencyPhone)&&(
                <div style={{marginTop:10,paddingTop:8,borderTop:"1px solid #EDE9FF",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:9,fontWeight:700,color:"#7C4DFF",textTransform:"uppercase",letterSpacing:"0.08em"}}>Emergency contact</div>
                    <div style={{fontSize:12,color:"#1A1A2E",fontWeight:500}}>{emergencyCard.emergencyContact}</div>
                  </div>
                  {emergencyCard.emergencyPhone&&(
                    <div style={{background:"#7C4DFF",borderRadius:8,padding:"5px 12px"}}>
                      <div style={{fontSize:13,fontWeight:700,color:"white"}}>📞 {emergencyCard.emergencyPhone}</div>
                    </div>
                  )}
                </div>
              )}

              <div style={{marginTop:10,paddingTop:6,borderTop:"1px solid #EDE9FF",fontSize:8,color:"#aaa",textAlign:"center"}}>
                MCAS Reaction Tracker · If found please call the emergency contact above
              </div>
            </div>
          </div>
        )}

        {/* ── FOOD JOURNAL ── */}
        {view==="food" && (
          <div style={{animation:"fadeIn 0.2s ease"}}>

            {/* Location / weather setup banner */}
            {!userLocation && (
              <div style={{background:dm?"#1A1A2E":"#EDE9FF",border:`1.5px solid ${t.border}`,borderRadius:12,padding:"12px 14px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:t.text}}>🌤 Enable weather correlation</div>
                  <div style={{fontSize:12,color:t.textMuted,marginTop:2}}>Allow location access to automatically log weather & pollen conditions at the time of each reaction.</div>
                </div>
                <button onClick={requestLocation} style={{...s.exportBtn,background:t.accentBtn,color:"white",border:"none",flexShrink:0}}>Allow location</button>
              </div>
            )}
            {userLocation && (
              <div style={{background:dm?"#1B3320":"#E8F5E9",border:`1.5px solid ${dm?"#2E4A2E":"#C8E6C9"}`,borderRadius:10,padding:"8px 12px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                <span style={{fontSize:12,color:dm?"#81C784":"#2E7D32"}}>🌍 Weather data for <strong>{userLocation.name}</strong> · shown in expanded reaction cards</span>
                <button onClick={()=>setUserLocation(null)} style={{background:"none",border:"none",fontSize:11,color:t.textMuted,cursor:"pointer"}}>Change</button>
              </div>
            )}

            {/* Add entry form */}
            <div style={{...s.formCard,background:t.surface,border:`1.5px solid ${t.border}`,marginBottom:12}}>
              <div style={{...s.sectionTitle,color:t.accent,marginTop:0}}>🍽 Log food</div>
              <div style={s.formRow}>
                <div style={{...s.formGroup,flex:1}}><label style={fLbl}>Date</label><input type="date" style={{...s.formInput,...inp}} value={foodForm.date} onChange={e=>setFoodForm({...foodForm,date:e.target.value})}/></div>
                <div style={{...s.formGroup,flex:1}}><label style={fLbl}>Meal</label>
                  <select style={{...s.formInput,...inp}} value={foodForm.meal} onChange={e=>setFoodForm({...foodForm,meal:e.target.value})}>
                    {MEAL_TYPES.map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div style={s.formGroup}><label style={fLbl}>What did you eat / drink? *</label><textarea style={{...s.formTextarea,...inp,minHeight:60}} placeholder="e.g. porridge with oat milk, banana, coffee…" value={foodForm.items} onChange={e=>setFoodForm({...foodForm,items:e.target.value})}/></div>
              <div style={s.formGroup}><label style={fLbl}>Notes <span style={{fontWeight:400,textTransform:"none",fontSize:11,color:t.textMuted}}>(optional — e.g. ate quickly, restaurant meal, new food)</span></label><input style={{...s.formInput,...inp}} placeholder="Any relevant context…" value={foodForm.notes} onChange={e=>setFoodForm({...foodForm,notes:e.target.value})}/></div>
              {foodSaveMsg&&<div style={{...s.saveMsgBox,background:foodSaveMsg.startsWith("Error")?(dm?"#3B1010":"#FFEBEE"):(dm?"#1B3320":"#E8F5E9"),color:foodSaveMsg.startsWith("Error")?(dm?"#EF9A9A":"#C62828"):(dm?"#81C784":"#2E7D32")}}>{foodSaveMsg}</div>}
              <button style={{...s.saveBtn,background:t.accentBtn}} onClick={saveFoodEntry} disabled={saving}>{saving?"Saving…":"Save entry"}</button>
            </div>

            {/* Food-reaction correlation panel */}
            {foodReactionCorrelation.filter(c=>c.eaten.length>0).length>0&&(
              <div style={{...s.chartCard,background:t.surface,border:`1.5px solid ${t.border}`,marginBottom:12}}>
                <div style={{...s.sectionTitle,color:"#E91E63",marginTop:0}}>⚠️ Food eaten before reactions (24h window)</div>
                <div style={{fontSize:12,color:t.textMuted,marginBottom:10}}>Foods logged in the 24 hours before each reaction — useful for identifying delayed triggers.</div>
                {foodReactionCorrelation.filter(c=>c.eaten.length>0).slice(0,8).map(({reaction:r,eaten},i)=>(
                  <div key={i} style={{borderTop:i>0?`1px solid ${t.border}`:"none",paddingTop:i>0?10:0,marginTop:i>0?10:0}}>
                    <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:6}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:sc(r["Severity Level"]).dot,flexShrink:0,marginTop:3}}/>
                      <div>
                        <span style={{fontSize:13,fontWeight:600,color:t.text}}>{r["Event Name"]||"Reaction"}</span>
                        <span style={{fontSize:11,color:t.textMuted,marginLeft:8}}>{r["Date & Time"]?new Date(r["Date & Time"]).toLocaleDateString("en-GB",{day:"numeric",month:"short"}):""}</span>
                        {r["Severity Level"]&&<span style={{...s.badge,background:sc(r["Severity Level"]).bg,color:sc(r["Severity Level"]).text,marginLeft:6}}>{r["Severity Level"]}</span>}
                      </div>
                    </div>
                    <div style={{paddingLeft:16}}>
                      {eaten.map((f,j)=>(
                        <div key={j} style={{fontSize:12,color:t.textMuted,marginBottom:3}}>
                          <span style={{...s.metaChip,background:t.chipBg,color:t.chipText,fontSize:11,marginRight:6}}>{f.meal}</span>
                          {f.items}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Daily food log */}
            <div style={{...s.sectionTitle,color:t.accent}}>Food diary</div>
            {Object.keys(foodByDate).length===0&&<div style={{...s.empty,color:t.emptyText}}>No food logged yet. Start adding entries above.</div>}
            {Object.entries(foodByDate).sort((a,b)=>b[0].localeCompare(a[0])).map(([date,entries])=>{
              const dateObj = new Date(date+"T12:00:00");
              const w = weatherCache[date];
              // Find any reactions on this date
              const dayReactions = reactions.filter(r=>r["Date & Time"]?.slice(0,10)===date);
              return (
                <div key={date} style={{...s.card,background:t.surface,border:`1.5px solid ${t.border}`,cursor:"default",marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:t.text}}>{dateObj.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}</div>
                      <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                        {w&&<span style={{...s.metaChip,background:t.chipBg,color:t.chipText,fontSize:11}}>{weatherIcon(w.tempMax,w.precip)} {w.tempMax!==null?`${Math.round(w.tempMax)}°C`:""}{w.humidity!==null?` · 💧${w.humidity}%`:""}</span>}
                        {w?.pollen&&(()=>{const maxP=Math.max(w.pollen.grass??0,w.pollen.birch??0,w.pollen.alder??0);const pl=pollenLevel(maxP);return pl?<span style={{...s.metaChip,background:t.chipBg,color:pl.color,fontSize:11,fontWeight:600}}>🌿 {pl.label} pollen</span>:null;})()}
                        {dayReactions.length>0&&<span style={{...s.badge,background:dm?"#3B1010":"#FFEBEE",color:dm?"#EF9A9A":"#C62828",fontSize:11}}>⚠️ {dayReactions.length} reaction{dayReactions.length!==1?"s":""} this day</span>}
                      </div>
                    </div>
                  </div>
                  {entries.map((f,i)=>(
                    <div key={f.id||i} style={{display:"flex",alignItems:"flex-start",gap:8,paddingTop:i>0?8:0,marginTop:i>0?8:0,borderTop:i>0?`1px solid ${t.border}`:"none"}}>
                      <div style={{...s.metaChip,background:t.chipBg,color:t.accent,fontSize:11,fontWeight:600,flexShrink:0}}>{f.meal}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,color:t.text}}>{f.items}</div>
                        {f.notes&&<div style={{fontSize:11,color:t.textMuted,marginTop:2,fontStyle:"italic"}}>{f.notes}</div>}
                      </div>
                      <button onClick={()=>deleteFoodEntry(f.id)} style={{...s.deleteBtn,color:t.textSub,flexShrink:0}}>✕</button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* ── NOTES / FREE JOURNAL ── */}
        {view==="notes" && (
          <div style={{animation:"fadeIn 0.2s ease"}}>
            {/* Entry form */}
            <div style={{...s.formCard,background:t.surface,border:`1.5px solid ${t.border}`,marginBottom:12}}>
              <div style={{...s.sectionTitle,color:t.accent,marginTop:0}}>💬 New journal entry</div>
              <div style={s.formGroup}>
                <label style={fLbl}>Title <span style={{fontWeight:400,textTransform:"none",fontSize:11,color:t.textMuted}}>(optional)</span></label>
                <input style={{...s.formInput,...inp}} placeholder="e.g. Bad day, thought about patterns, feeling hopeful…" value={noteForm.title} onChange={e=>setNoteForm({...noteForm,title:e.target.value})}/>
              </div>
              <div style={s.formGroup}>
                <label style={fLbl}>Entry *</label>
                <textarea style={{...s.formTextarea,...inp,minHeight:120}} placeholder="Write freely — how you're feeling, patterns you've noticed, things to mention at your next appointment, anything…" value={noteForm.body} onChange={e=>setNoteForm({...noteForm,body:e.target.value})}/>
              </div>
              <div style={s.formRow}>
                <div style={{...s.formGroup,flex:1}}>
                  <label style={fLbl}>Mood</label>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {MOOD_OPTIONS.map(m=>{const sel=noteForm.mood===m; return <button key={m} onClick={()=>setNoteForm({...noteForm,mood:sel?"":m})} style={{...s.bodyBtn,background:sel?(dm?"#2A1A50":"#EDE9FF"):t.inputBg,color:sel?t.accent:t.textMuted,border:sel?`1.5px solid ${t.accent}`:`1.5px solid ${t.border}`,fontWeight:sel?700:400,fontSize:12}}>{m}</button>;})}
                  </div>
                </div>
                <div style={{...s.formGroup,flex:1}}>
                  <label style={fLbl}>Energy</label>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {ENERGY_OPTIONS.map(e2=>{const sel=noteForm.energy===e2; return <button key={e2} onClick={()=>setNoteForm({...noteForm,energy:sel?"":e2})} style={{...s.bodyBtn,background:sel?(dm?"#2A1A50":"#EDE9FF"):t.inputBg,color:sel?t.accent:t.textMuted,border:sel?`1.5px solid ${t.accent}`:`1.5px solid ${t.border}`,fontWeight:sel?700:400,fontSize:12}}>{e2}</button>;})}
                  </div>
                </div>
              </div>
              <div style={s.formGroup}>
                <label style={fLbl}>Tags <span style={{fontWeight:400,textTransform:"none",fontSize:11,color:t.textMuted}}>(comma-separated)</span></label>
                <input style={{...s.formInput,...inp}} placeholder="e.g. fatigue, good day, diet, stress, appointment" value={noteForm.tags} onChange={e=>setNoteForm({...noteForm,tags:e.target.value})}/>
              </div>
              {noteSaveMsg&&<div style={{...s.saveMsgBox,background:noteSaveMsg.startsWith("Error")?(dm?"#3B1010":"#FFEBEE"):(dm?"#1B3320":"#E8F5E9"),color:noteSaveMsg.startsWith("Error")?(dm?"#EF9A9A":"#C62828"):(dm?"#81C784":"#2E7D32")}}>{noteSaveMsg}</div>}
              <button style={{...s.saveBtn,background:t.accentBtn}} onClick={saveNote} disabled={saving}>{saving?"Saving…":"Save entry"}</button>
            </div>

            {/* Search + list */}
            <input placeholder="🔍 Search notes…" value={noteSearch} onChange={e=>setNoteSearch(e.target.value)} style={{...s.searchInput,...inp,width:"100%",marginBottom:10}}/>
            {filteredNotes.length===0&&<div style={{...s.empty,color:t.emptyText}}>{notes.length===0?"No entries yet — write your first one above.":"No entries match your search."}</div>}
            {filteredNotes.map(n=>{
              const isOpen = expandedNote === n.id;
              const tags = (n.tags||"").split(",").map(t2=>t2.trim()).filter(Boolean);
              const preview = (n.body||"").slice(0,120)+(n.body?.length>120?"…":"");
              return (
                <div key={n.id} style={{...s.card,background:t.surface,border:`1.5px solid ${t.border}`,cursor:"pointer"}} onClick={()=>setExpandedNote(isOpen?null:n.id)}>
                  <div style={s.cardTop}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
                        {n.mood&&<span style={{fontSize:13}}>{n.mood}</span>}
                        {n.energy&&<span style={{...s.metaChip,background:t.chipBg,color:t.chipText,fontSize:11}}>{n.energy}</span>}
                        <span style={{...s.cardDate,color:t.textSub,marginLeft:"auto"}}>
                          {new Date(n.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})} · {new Date(n.created_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
                        </span>
                      </div>
                      {n.title&&<div style={{...s.cardTitle,color:t.text,marginBottom:4}}>{n.title}</div>}
                      {!isOpen&&<div style={{fontSize:13,color:t.textMuted,lineHeight:1.5}}>{preview}</div>}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:4,marginLeft:8,flexShrink:0}}>
                      <button onClick={e=>{e.stopPropagation();deleteNote(n.id);}} style={{...s.deleteBtn,color:t.textSub,fontSize:13}}>🗑️</button>
                      <span style={{...s.chevron,color:t.textSub}}>{isOpen?"▲":"▼"}</span>
                    </div>
                  </div>
                  {isOpen&&(
                    <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${t.border}`}}>
                      <div style={{fontSize:14,color:t.text,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{n.body}</div>
                      {tags.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
                        {tags.map(tag=><span key={tag} style={{...s.allergenTag,background:dm?"#2A1A50":"#EDE9FF",color:t.accent,fontSize:11}}>#{tag}</span>)}
                      </div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── MEDICATION EFFECTIVENESS ── */}
        {view==="medeffect" && (
          <div style={{animation:"fadeIn 0.2s ease"}}>
            {/* Log form */}
            <div style={{...s.formCard,background:t.surface,border:`1.5px solid ${t.border}`,marginBottom:12}}>
              <div style={{...s.sectionTitle,color:t.accent,marginTop:0}}>🧬 Log medication effectiveness</div>
              <div style={{fontSize:13,color:t.textMuted,marginBottom:14,lineHeight:1.5}}>After a reaction, log how well each rescue or daily medication worked. Over time this builds an evidence base to share with your prescriber.</div>
              <div style={s.formRow}>
                <div style={{...s.formGroup,flex:2}}>
                  <label style={fLbl}>Medication *</label>
                  <select style={{...s.formInput,...inp}} value={medLogForm.med_name} onChange={e=>setMedLogForm({...medLogForm,med_name:e.target.value})}>
                    <option value="">Select…</option>
                    {medications.map(m=><option key={m.id} value={m.name}>{m.name}{m.dose?` (${m.dose})`:""}</option>)}
                    <option value="__other__">Other (type below)</option>
                  </select>
                  {medLogForm.med_name==="__other__"&&<input style={{...s.formInput,...inp,marginTop:6}} placeholder="Medication name" onChange={e=>setMedLogForm({...medLogForm,med_name:e.target.value})}/>}
                </div>
                <div style={{...s.formGroup,flex:1}}>
                  <label style={fLbl}>When taken</label>
                  <input type="datetime-local" style={{...s.formInput,...inp}} value={medLogForm.logged_at} onChange={e=>setMedLogForm({...medLogForm,logged_at:e.target.value})}/>
                </div>
              </div>

              <div style={s.formGroup}>
                <label style={fLbl}>Effectiveness rating *</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {[
                    {v:1,label:"1 — No effect",    color:"#F44336"},
                    {v:2,label:"2 — Minimal",       color:"#FF9800"},
                    {v:3,label:"3 — Moderate",      color:"#FFC107"},
                    {v:4,label:"4 — Good relief",   color:"#8BC34A"},
                    {v:5,label:"5 — Full relief",   color:"#4CAF50"},
                  ].map(({v,label,color})=>{
                    const sel = medLogForm.rating===v;
                    return <button key={v} onClick={()=>setMedLogForm({...medLogForm,rating:v})}
                      style={{...s.bodyBtn,background:sel?color:t.inputBg,color:sel?"white":t.textMuted,border:sel?`1.5px solid ${color}`:`1.5px solid ${t.border}`,fontWeight:sel?700:400,fontSize:12}}>
                      {label}
                    </button>;
                  })}
                </div>
              </div>

              <div style={s.formRow}>
                <div style={{...s.formGroup,flex:1}}>
                  <label style={fLbl}>Time to relief</label>
                  <select style={{...s.formInput,...inp}} value={medLogForm.relief_time} onChange={e=>setMedLogForm({...medLogForm,relief_time:e.target.value})}>
                    <option value="">Select…</option>
                    {["<15 min","15–30 min","30–60 min","1–2 hrs","2–4 hrs",">4 hrs","No relief"].map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
                <div style={{...s.formGroup,flex:1}}>
                  <label style={fLbl}>Side effects noticed</label>
                  <input style={{...s.formInput,...inp}} placeholder="e.g. drowsiness, dry mouth, none" value={medLogForm.side_effects} onChange={e=>setMedLogForm({...medLogForm,side_effects:e.target.value})}/>
                </div>
              </div>

              <div style={s.formGroup}>
                <label style={fLbl}>Notes</label>
                <input style={{...s.formInput,...inp}} placeholder="Any additional observations…" value={medLogForm.notes} onChange={e=>setMedLogForm({...medLogForm,notes:e.target.value})}/>
              </div>

              {medLogMsg&&<div style={{...s.saveMsgBox,background:medLogMsg.startsWith("Error")?(dm?"#3B1010":"#FFEBEE"):(dm?"#1B3320":"#E8F5E9"),color:medLogMsg.startsWith("Error")?(dm?"#EF9A9A":"#C62828"):(dm?"#81C784":"#2E7D32")}}>{medLogMsg}</div>}
              <button style={{...s.saveBtn,background:t.accentBtn}} onClick={saveMedLog} disabled={saving}>{saving?"Saving…":"Log effectiveness"}</button>
            </div>

            {/* Effectiveness summary cards */}
            <div style={{...s.sectionTitle,color:t.accent}}>Effectiveness summary</div>
            {medEffectiveness.length===0&&<div style={{...s.empty,color:t.emptyText}}>No effectiveness data yet. Log some entries above after your next reaction.</div>}
            {medEffectiveness.map(med=>{
              const stars = "★".repeat(Math.round(med.avgRating))+"☆".repeat(5-Math.round(med.avgRating));
              const trendColor = med.trend==="improving"?(dm?"#81C784":"#2E7D32"):med.trend==="declining"?(dm?"#EF9A9A":"#C62828"):t.textMuted;
              const trendIcon  = med.trend==="improving"?"📈":med.trend==="declining"?"📉":"➡️";
              const ratingColors = {1:"#F44336",2:"#FF9800",3:"#FFC107",4:"#8BC34A",5:"#4CAF50"};
              const barColor = ratingColors[Math.round(med.avgRating)]||t.accent;
              return (
                <div key={med.name} style={{...s.card,background:t.surface,border:`1.5px solid ${t.border}`,cursor:"default",marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <div>
                      <div style={{fontSize:15,fontWeight:700,color:t.text}}>{med.name}</div>
                      <div style={{fontSize:13,color:t.textMuted,marginTop:2}}>{med.logCount} log{med.logCount!==1?"s":""} recorded</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:18,color:barColor,letterSpacing:1}}>{stars}</div>
                      <div style={{fontSize:13,fontWeight:700,color:barColor}}>{med.avgRating}/5</div>
                    </div>
                  </div>

                  {/* Rating bar */}
                  <div style={{...s.sevBarWrap,background:t.sevBarBg,height:10,marginBottom:10}}>
                    <div style={{...s.sevBar,width:`${(med.avgRating/5)*100}%`,background:barColor,height:10}}/>
                  </div>

                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
                    <span style={{...s.metaChip,background:t.chipBg,color:trendColor,fontSize:12,fontWeight:600}}>{trendIcon} {med.trend}</span>
                    {med.reliefTimes.length>0&&(()=>{
                      const most = med.reliefTimes.sort((a,b)=>med.reliefTimes.filter(x=>x===b).length-med.reliefTimes.filter(x=>x===a).length)[0];
                      return <span style={{...s.metaChip,background:t.chipBg,color:t.chipText,fontSize:12}}>⏱ Usually {most}</span>;
                    })()}
                    {med.sideEffects.filter(s2=>s2.toLowerCase()!=="none").slice(0,2).map(se=>
                      <span key={se} style={{...s.metaChip,background:dm?"#332900":"#FFF8E1",color:dm?"#FFD54F":"#F57F17",fontSize:11}}>⚠️ {se}</span>
                    )}
                  </div>

                  {/* Recent log sparkline */}
                  {med.recentLogs.length>1&&(
                    <div>
                      <div style={{fontSize:10,color:t.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:700}}>Recent ratings</div>
                      <div style={{display:"flex",gap:4,alignItems:"flex-end",height:32}}>
                        {[...med.recentLogs].reverse().map((l,i)=>{
                          const c = ratingColors[l.rating]||t.accent;
                          return <div key={i} title={`${l.rating}/5 — ${new Date(l.logged_at).toLocaleDateString("en-GB")}`}
                            style={{flex:1,background:c,borderRadius:"3px 3px 0 0",height:`${(l.rating/5)*32}px`,opacity:0.85,cursor:"default"}}/>;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── APPOINTMENT PREP ── */}
        {view==="appt" && (
          <div style={{animation:"fadeIn 0.2s ease"}}>
            {/* Config */}
            <div style={{...s.formCard,background:t.surface,border:`1.5px solid ${t.border}`,marginBottom:12}} className="no-print">
              <div style={{...s.sectionTitle,color:t.accent,marginTop:0}}>🏥 Appointment preparation</div>
              <div style={{fontSize:13,color:t.textMuted,marginBottom:14}}>Auto-generates a one-page briefing from your data — ready to hand to your consultant at the start of the appointment.</div>
              <div style={s.formRow}>
                <div style={{...s.formGroup,flex:1}}>
                  <label style={fLbl}>Appointment date</label>
                  <input type="date" style={{...s.formInput,...inp}} value={apptPrep.appointmentDate} onChange={e=>setApptPrep({...apptPrep,appointmentDate:e.target.value})}/>
                </div>
                <div style={{...s.formGroup,flex:1}}>
                  <label style={fLbl}>Consultant type</label>
                  <select style={{...s.formInput,...inp}} value={apptPrep.consultantType} onChange={e=>setApptPrep({...apptPrep,consultantType:e.target.value})}>
                    {["Immunologist","Allergist","Gastroenterologist","Gynaecologist","GP","Cardiologist","Neurologist","Other"].map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
                <div style={{...s.formGroup,flex:1}}>
                  <label style={fLbl}>Data window</label>
                  <select style={{...s.formInput,...inp}} value={apptPrep.prepRange} onChange={e=>setApptPrep({...apptPrep,prepRange:Number(e.target.value)})}>
                    {[{v:30,l:"Last 30 days"},{v:60,l:"Last 60 days"},{v:90,l:"Last 90 days"},{v:180,l:"Last 6 months"}].map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
              </div>
              <div style={s.formGroup}>
                <label style={fLbl}>Questions I want to ask</label>
                <textarea style={{...s.formTextarea,...inp,minHeight:80}} placeholder={"e.g. Can we trial a higher dose of cetirizine?\nShould I be tested for hereditary alpha tryptasemia?\nIs my current protocol optimal?"} value={apptPrep.questions} onChange={e=>setApptPrep({...apptPrep,questions:e.target.value})}/>
              </div>
              <div style={s.formGroup}>
                <label style={fLbl}>Concerns to raise</label>
                <textarea style={{...s.formTextarea,...inp,minHeight:60}} placeholder="e.g. Reactions worsening around menstruation, sleep severely disrupted…" value={apptPrep.concerns} onChange={e=>setApptPrep({...apptPrep,concerns:e.target.value})}/>
              </div>
              <button onClick={()=>window.print()} style={{...s.saveBtn,background:t.accentBtn}}>🖨 Print this briefing</button>
            </div>

            {/* ── THE BRIEFING DOCUMENT ── */}
            <div style={{...s.reportWrap,background:t.reportBg,border:`1.5px solid ${t.border}`}}>
              {/* Header */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,paddingBottom:14,borderBottom:`2px solid #7C4DFF`}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#7C4DFF",textTransform:"uppercase",letterSpacing:"0.14em",marginBottom:3}}>Appointment Briefing</div>
                  <div style={{fontSize:20,fontWeight:700,color:t.text}}>MCAS — Pre-Appointment Summary</div>
                  <div style={{fontSize:13,color:t.textMuted,marginTop:2}}>
                    {apptPrep.consultantType} appointment{apptPrep.appointmentDate ? ` · ${new Date(apptPrep.appointmentDate+"T12:00").toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}` : ""}
                    {" · "}Data covers last {apptPrep.prepRange} days
                  </div>
                </div>
                {gpLetter.patientName&&(
                  <div style={{textAlign:"right",fontSize:12,color:t.textMuted,lineHeight:1.8}}>
                    <div style={{fontWeight:600,color:t.text}}>{gpLetter.patientName}</div>
                    {gpLetter.dob&&<div>DOB: {new Date(gpLetter.dob).toLocaleDateString("en-GB")}</div>}
                    {gpLetter.nhsNumber&&<div>NHS: {gpLetter.nhsNumber}</div>}
                  </div>
                )}
              </div>

              {/* At-a-glance stats */}
              <div style={s.reportSection}>
                <div style={{...s.reportSectionTitle,color:t.accent,borderBottomColor:t.border}}>At a glance</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:10,marginBottom:12}}>
                  {[
                    {n:appointmentData.inRange.length, l:"Reactions", sub:`last ${apptPrep.prepRange} days`},
                    {n:appointmentData.severe.length,  l:"Severe / emergency", sub:"severity 3–4"},
                    {n:appointmentData.flaresInRange.length, l:"Flare days", sub:"logged"},
                    {n:medications.length, l:"Medications", sub:"current regimen"},
                  ].map(({n,l,sub})=>(
                    <div key={l} style={{background:dm?"#22223A":"#F7F4FF",borderRadius:10,padding:"12px 14px",textAlign:"center"}}>
                      <div style={{fontSize:26,fontWeight:700,color:t.accent}}>{n}</div>
                      <div style={{fontSize:12,color:t.text,fontWeight:600,marginTop:2}}>{l}</div>
                      <div style={{fontSize:10,color:t.textMuted,marginTop:1}}>{sub}</div>
                    </div>
                  ))}
                </div>
                {/* Trend */}
                <div style={{background:appointmentData.trend==="worsening"?(dm?"#3B1010":"#FFEBEE"):appointmentData.trend==="improving"?(dm?"#1B3320":"#E8F5E9"):(dm?"#22223A":"#F7F4FF"),borderRadius:10,padding:"10px 14px",fontSize:13,color:t.text}}>
                  <strong>Trend over period: </strong>
                  <span style={{color:appointmentData.trend==="worsening"?(dm?"#EF9A9A":"#C62828"):appointmentData.trend==="improving"?(dm?"#81C784":"#2E7D32"):t.textMuted,fontWeight:700}}>
                    {appointmentData.trend==="worsening"?"📈 Worsening":appointmentData.trend==="improving"?"📉 Improving":"➡️ Stable"}
                  </span>
                  <span style={{color:t.textMuted}}> — based on reaction frequency week-on-week</span>
                </div>
              </div>

              {/* Top symptoms */}
              {appointmentData.topSymptoms.length>0&&(
                <div style={s.reportSection}>
                  <div style={{...s.reportSectionTitle,color:t.accent,borderBottomColor:t.border}}>Most frequent symptoms (this period)</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {appointmentData.topSymptoms.map(([sym,count],i)=>(
                      <span key={sym} style={{...s.allergenTag,background:i===0?(dm?"#2A1A50":"#EDE9FF"):t.chipBg,color:i===0?t.accent:t.chipText,fontSize:13,fontWeight:i===0?700:400,padding:"5px 12px"}}>
                        {i===0?"🥇":i===1?"🥈":i===2?"🥉":"•"} {sym} <span style={{opacity:0.7}}>({count}×)</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Top triggers */}
              {appointmentData.topTriggers.length>0&&(
                <div style={s.reportSection}>
                  <div style={{...s.reportSectionTitle,color:t.accent,borderBottomColor:t.border}}>Suspected triggers (this period)</div>
                  {appointmentData.topTriggers.map(([allergen,count])=>(
                    <div key={allergen} style={{...s.reportRow,borderBottomColor:t.border}}>
                      <span style={{...s.allergenTag,background:dm?"#2A1A50":"#EDE9FF",color:t.accent}}>🧪 {allergen}</span>
                      <span style={{fontSize:13,color:t.textMuted}}>{count} reaction{count!==1?"s":""}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Medication effectiveness summary */}
              {medEffectiveness.length>0&&(
                <div style={s.reportSection}>
                  <div style={{...s.reportSectionTitle,color:t.accent,borderBottomColor:t.border}}>Medication effectiveness</div>
                  {medEffectiveness.map(med=>{
                    const ratingColors = {"1":"#F44336","2":"#FF9800","3":"#FFC107","4":"#8BC34A","5":"#4CAF50"};
                    const c = ratingColors[String(Math.round(med.avgRating))]||t.accent;
                    return (
                      <div key={med.name} style={{...s.reportRow,borderBottomColor:t.border,alignItems:"center"}}>
                        <div>
                          <span style={{fontWeight:600,color:t.text,fontSize:13}}>{med.name}</span>
                          <span style={{fontSize:11,color:t.textMuted,marginLeft:8}}>{med.logCount} log{med.logCount!==1?"s":""}</span>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:80,height:6,background:t.sevBarBg,borderRadius:6,overflow:"hidden"}}>
                            <div style={{width:`${(med.avgRating/5)*100}%`,height:"100%",background:c,borderRadius:6}}/>
                          </div>
                          <span style={{fontSize:13,fontWeight:700,color:c,minWidth:30}}>{med.avgRating}/5</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Current medications */}
              {medications.length>0&&(
                <div style={s.reportSection}>
                  <div style={{...s.reportSectionTitle,color:t.accent,borderBottomColor:t.border}}>Current regimen</div>
                  <table style={s.reportTable}>
                    <thead><tr>{["Medication","Type","Dose","Frequency"].map(h=><th key={h} style={{...s.reportTh,background:dm?"#22223A":"#F7F4FF",color:t.accent}}>{h}</th>)}</tr></thead>
                    <tbody>{medications.map(med=>(
                      <tr key={med.id}>{["name","type","dose","time"].map(k=><td key={k} style={{...s.reportTd,borderBottomColor:t.border,color:t.text}}>{med[k]||"—"}</td>)}</tr>
                    ))}</tbody>
                  </table>
                </div>
              )}

              {/* Questions & concerns */}
              {(apptPrep.questions||apptPrep.concerns)&&(
                <div style={s.reportSection}>
                  <div style={{...s.reportSectionTitle,color:t.accent,borderBottomColor:t.border}}>Questions & concerns for this appointment</div>
                  {apptPrep.questions&&(
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:11,fontWeight:700,color:t.accent,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Questions</div>
                      {apptPrep.questions.split("\n").filter(Boolean).map((q,i)=>(
                        <div key={i} style={{fontSize:13,color:t.text,marginBottom:5,display:"flex",gap:8}}>
                          <span style={{color:t.accent,flexShrink:0}}>?</span><span>{q}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {apptPrep.concerns&&(
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:"#E91E63",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Concerns</div>
                      {apptPrep.concerns.split("\n").filter(Boolean).map((c2,i)=>(
                        <div key={i} style={{fontSize:13,color:t.text,marginBottom:5,display:"flex",gap:8}}>
                          <span style={{color:"#E91E63",flexShrink:0}}>!</span><span>{c2}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Recent severe reactions */}
              {appointmentData.severe.length>0&&(
                <div style={s.reportSection}>
                  <div style={{...s.reportSectionTitle,color:t.accent,borderBottomColor:t.border}}>Severe / emergency episodes this period</div>
                  {appointmentData.severe.slice(0,10).map(r=>(
                    <div key={r.id} style={{...s.reportRow,borderBottomColor:t.border,flexDirection:"column",alignItems:"flex-start",gap:3,padding:"8px 0"}}>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <span style={{...s.badge,background:sc(r["Severity Level"]).bg,color:sc(r["Severity Level"]).text}}>{r["Severity Level"]}</span>
                        <span style={{fontSize:13,fontWeight:600,color:t.text}}>{r["Event Name"]||"Untitled"}</span>
                        <span style={{fontSize:11,color:t.textMuted}}>{r["Date & Time"]?new Date(r["Date & Time"]).toLocaleDateString("en-GB",{day:"numeric",month:"short"}):""}</span>
                      </div>
                      {[r["Early Symptoms"],r["Mid Symptoms"],r["Severe Symptoms"]].filter(Boolean).join("; ")&&(
                        <div style={{fontSize:12,color:t.textMuted,paddingLeft:4}}>{[r["Early Symptoms"],r["Mid Symptoms"],r["Severe Symptoms"]].filter(Boolean).join("; ")}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div style={{...s.reportFooter,borderTopColor:t.border,color:t.textSub}}>
                MCAS Reaction Tracker · Prepared {new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})} · Data is patient-recorded
              </div>
            </div>
          </div>
        )}

        {/* ── NOTIFICATIONS / ALERTS ── */}
        {view==="notifs" && (
          <div style={{animation:"fadeIn 0.2s ease"}}>
            <div style={{...s.formCard,background:t.surface,border:`1.5px solid ${t.border}`}}>
              <div style={{...s.sectionTitle,color:t.accent,marginTop:0}}>🔔 Alerts & Reminders</div>

              {/* Permission status */}
              <div style={{background:notifPermission==="granted"?(dm?"#1B3320":"#E8F5E9"):notifPermission==="denied"?(dm?"#3B1010":"#FFEBEE"):(dm?"#22223A":"#F7F4FF"),borderRadius:12,padding:"12px 14px",marginBottom:18,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:notifPermission==="granted"?(dm?"#81C784":"#2E7D32"):notifPermission==="denied"?(dm?"#EF9A9A":"#C62828"):t.text}}>
                    {notifPermission==="granted"?"✓ Notifications enabled":notifPermission==="denied"?"✕ Notifications blocked — enable in browser settings":"Notifications not yet enabled"}
                  </div>
                  <div style={{fontSize:12,color:t.textMuted,marginTop:2}}>
                    {notifPermission==="granted"?"Your browser will show alerts even when the app is in the background.":notifPermission==="denied"?"You'll need to allow notifications in your browser or OS settings.":"Tap below to allow notifications from this app."}
                  </div>
                </div>
                {notifPermission!=="granted"&&notifPermission!=="denied"&&(
                  <button onClick={requestNotifPermission} style={{...s.saveBtn,width:"auto",padding:"9px 16px",marginTop:0,background:t.accentBtn,flexShrink:0}}>Enable</button>
                )}
              </div>

              {/* Daily log reminder */}
              <div style={{...s.medCard,background:t.surfaceAlt,border:`1.5px solid ${t.border}`,marginBottom:10,display:"flex",alignItems:"center",gap:14}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:600,color:t.text}}>Daily log reminder</div>
                  <div style={{fontSize:12,color:t.textMuted,marginTop:2}}>Reminds you to log if you haven't recorded anything today</div>
                  {notifSettings.logReminder&&(
                    <div style={{marginTop:8,display:"flex",alignItems:"center",gap:8}}>
                      <label style={{...s.formLabel,color:t.accent,margin:0}}>Time</label>
                      <input type="time" style={{...s.formInput,...inp,width:"auto",padding:"5px 10px"}}
                        value={notifSettings.logReminderHour||"20:00"}
                        onChange={e=>setNotifSettings({...notifSettings,logReminderHour:e.target.value})}/>
                    </div>
                  )}
                </div>
                <button
                  onClick={()=>setNotifSettings({...notifSettings,logReminder:!notifSettings.logReminder})}
                  disabled={notifPermission!=="granted"}
                  style={{flexShrink:0,width:48,height:26,borderRadius:13,border:"none",cursor:notifPermission==="granted"?"pointer":"not-allowed",
                    background:notifSettings.logReminder?"#7C4DFF":"#ccc",position:"relative",transition:"background 0.2s"}}>
                  <div style={{position:"absolute",top:3,left:notifSettings.logReminder?24:3,width:20,height:20,borderRadius:"50%",background:"white",transition:"left 0.2s"}}/>
                </button>
              </div>

              {/* Medication reminders */}
              <div style={{...s.sectionTitle,color:t.accent}}>Medication reminders</div>
              <div style={{fontSize:12,color:t.textMuted,marginBottom:10}}>Get a notification at the time each medication is due. Uses the time you logged on the Meds tab.</div>
              {medications.length===0&&<div style={{...s.empty,color:t.emptyText}}>No medications logged yet.</div>}
              {medications.map(med=>{
                const existing = notifSettings.medReminders?.find(r=>r.medId===med.id);
                return (
                  <div key={med.id} style={{...s.medCard,background:t.surfaceAlt,border:`1.5px solid ${t.border}`,marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:t.text}}>{med.name}{med.dose&&<span style={{...s.medDose,background:dm?"#2A1A50":"#EDE9FF",color:t.accent}}>{med.dose}</span>}</div>
                      {med.time&&<div style={{fontSize:11,color:t.textMuted,marginTop:2}}>Logged frequency: {med.time}</div>}
                      {existing&&(
                        <div style={{marginTop:6,display:"flex",alignItems:"center",gap:8}}>
                          <label style={{...s.formLabel,color:t.accent,margin:0,fontSize:10}}>Reminder time</label>
                          <input type="time" style={{...s.formInput,...inp,width:"auto",padding:"4px 8px",fontSize:12}}
                            value={existing.time||"08:00"}
                            onChange={e=>{
                              const updated = (notifSettings.medReminders||[]).map(r=>r.medId===med.id?{...r,time:e.target.value}:r);
                              setNotifSettings({...notifSettings,medReminders:updated});
                            }}/>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={()=>{
                        const current = notifSettings.medReminders||[];
                        const has = current.find(r=>r.medId===med.id);
                        setNotifSettings({...notifSettings, medReminders: has ? current.filter(r=>r.medId!==med.id) : [...current,{medId:med.id,name:med.name,time:med.time||"08:00"}]});
                      }}
                      disabled={notifPermission!=="granted"}
                      style={{flexShrink:0,width:48,height:26,borderRadius:13,border:"none",cursor:notifPermission==="granted"?"pointer":"not-allowed",
                        background:existing?"#7C4DFF":"#ccc",position:"relative",transition:"background 0.2s"}}>
                      <div style={{position:"absolute",top:3,left:existing?24:3,width:20,height:20,borderRadius:"50%",background:"white",transition:"left 0.2s"}}/>
                    </button>
                  </div>
                );
              })}

              <div style={{marginTop:16,fontSize:12,color:t.textMuted,background:t.surfaceAlt,borderRadius:8,padding:"10px 12px",lineHeight:1.6}}>
                💡 <strong>Note:</strong> Notifications fire while the app is open or in a background tab. For reliable reminders when the app is closed, add this app to your home screen (Share → Add to Home Screen on iOS, or install as PWA on Android/Chrome).
              </div>
            </div>
          </div>
        )}

        {/* ── GP LETTER ── */}
        {view==="gpletter" && (
          <div style={{animation:"fadeIn 0.2s ease"}}>
            {/* Patient & GP details form */}
            <div style={{...s.formCard,background:t.surface,border:`1.5px solid ${t.border}`,marginBottom:12}}>
              <div style={{...s.sectionTitle,color:t.accent,marginTop:0}}>✉️ GP / Consultant Letter</div>
              <div style={{fontSize:13,color:t.textMuted,marginBottom:16,lineHeight:1.5}}>
                Generates a formal letter summarising your reaction history for your GP or specialist. Fill in the fields below, then print or save as PDF.
              </div>

              <div style={{...s.sectionTitle,color:t.accent,fontSize:11}}>Patient details</div>
              <div style={s.formRow}>
                <div style={{...s.formGroup,flex:2}}><label style={fLbl}>Full name</label><input style={{...s.formInput,...inp}} placeholder="Your full name" value={gpLetter.patientName} onChange={e=>setGpLetter({...gpLetter,patientName:e.target.value})}/></div>
                <div style={{...s.formGroup,flex:1}}><label style={fLbl}>Date of birth</label><input type="date" style={{...s.formInput,...inp}} value={gpLetter.dob} onChange={e=>setGpLetter({...gpLetter,dob:e.target.value})}/></div>
                <div style={{...s.formGroup,flex:1}}><label style={fLbl}>NHS number</label><input style={{...s.formInput,...inp}} placeholder="000 000 0000" value={gpLetter.nhsNumber} onChange={e=>setGpLetter({...gpLetter,nhsNumber:e.target.value})}/></div>
              </div>

              <div style={{...s.sectionTitle,color:t.accent,fontSize:11}}>GP / Practice</div>
              <div style={s.formRow}>
                <div style={{...s.formGroup,flex:1}}><label style={fLbl}>GP name</label><input style={{...s.formInput,...inp}} placeholder="Dr Smith" value={gpLetter.gpName} onChange={e=>setGpLetter({...gpLetter,gpName:e.target.value})}/></div>
                <div style={{...s.formGroup,flex:2}}><label style={fLbl}>Practice name & address</label><input style={{...s.formInput,...inp}} placeholder="The Surgery, 1 High Street…" value={gpLetter.gpPractice} onChange={e=>setGpLetter({...gpLetter,gpPractice:e.target.value})}/></div>
              </div>

              <div style={{...s.sectionTitle,color:t.accent,fontSize:11}}>Specialist (if applicable)</div>
              <div style={s.formRow}>
                <div style={{...s.formGroup,flex:1}}><label style={fLbl}>Consultant name</label><input style={{...s.formInput,...inp}} placeholder="Dr Jones" value={gpLetter.consultantName} onChange={e=>setGpLetter({...gpLetter,consultantName:e.target.value})}/></div>
                <div style={{...s.formGroup,flex:1}}><label style={fLbl}>Hospital / clinic</label><input style={{...s.formInput,...inp}} placeholder="City Hospital Allergy Clinic" value={gpLetter.consultantHospital} onChange={e=>setGpLetter({...gpLetter,consultantHospital:e.target.value})}/></div>
                <div style={{...s.formGroup,flex:1}}><label style={fLbl}>Diagnosis / referral date</label><input type="date" style={{...s.formInput,...inp}} value={gpLetter.diagnosisDate} onChange={e=>setGpLetter({...gpLetter,diagnosisDate:e.target.value})}/></div>
              </div>

              <div style={s.formGroup}>
                <label style={fLbl}>Additional notes <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:11,color:t.textMuted}}>(optional — added to letter body)</span></label>
                <textarea style={{...s.formTextarea,...inp,minHeight:80}} placeholder="e.g. I am writing to request a referral to immunology / I have been experiencing worsening symptoms since…" value={gpLetter.additionalNotes} onChange={e=>setGpLetter({...gpLetter,additionalNotes:e.target.value})}/>
              </div>

              <button onClick={()=>window.print()} style={{...s.saveBtn,background:t.accentBtn}}>🖨 Print / Save as PDF</button>
              <button onClick={exportPDF} disabled={pdfGenerating} style={{...s.saveBtn,background:"linear-gradient(135deg,#E91E63,#9C27B0)",marginTop:8}}>
                {pdfGenerating?"Generating…":"📄 Export PDF"}
              </button>
            </div>

            {/* ── THE LETTER ITSELF (print target) ── */}
            <div style={{...s.reportWrap,background:t.reportBg,border:`1.5px solid ${t.border}`,fontFamily:"Georgia,'Times New Roman',serif"}} id="gp-letter-body">
              {/* Letterhead */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,paddingBottom:16,borderBottom:`2px solid ${t.border}`}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:t.accent,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:4,fontFamily:"'DM Sans',sans-serif"}}>Patient Medical Record</div>
                  <div style={{fontSize:22,fontWeight:700,color:t.text,marginBottom:2}}>MCAS Reaction Summary</div>
                  <div style={{fontSize:13,color:t.textMuted}}>Mast Cell Activation Syndrome — Clinical Log</div>
                </div>
                <div style={{textAlign:"right",fontSize:12,color:t.textMuted,lineHeight:1.8}}>
                  <div>{new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</div>
                  {gpLetter.patientName&&<div style={{fontWeight:600,color:t.text}}>{gpLetter.patientName}</div>}
                  {gpLetter.dob&&<div>DOB: {new Date(gpLetter.dob).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</div>}
                  {gpLetter.nhsNumber&&<div>NHS: {gpLetter.nhsNumber}</div>}
                </div>
              </div>

              {/* Addressee */}
              {(gpLetter.gpName||gpLetter.gpPractice) && (
                <div style={{marginBottom:20,fontSize:13,color:t.text,lineHeight:1.8}}>
                  {gpLetter.gpName&&<div><strong>{gpLetter.gpName}</strong></div>}
                  {gpLetter.gpPractice&&<div style={{whiteSpace:"pre-line"}}>{gpLetter.gpPractice}</div>}
                </div>
              )}

              {/* Salutation */}
              <div style={{marginBottom:16,fontSize:14,color:t.text}}>
                Dear {gpLetter.gpName||"Doctor"},
              </div>

              {/* Opening paragraph */}
              <div style={{marginBottom:16,fontSize:13,color:t.text,lineHeight:1.8}}>
                {gpLetter.additionalNotes
                  ? <p style={{margin:"0 0 12px"}}>{gpLetter.additionalNotes}</p>
                  : null}
                <p style={{margin:0}}>
                  I am writing to provide a structured summary of my reaction history relating to Mast Cell Activation Syndrome (MCAS)
                  {gpLetter.diagnosisDate ? `, first recorded ${new Date(gpLetter.diagnosisDate).toLocaleDateString("en-GB",{month:"long",year:"numeric"})}` : ""}
                  {gpLetter.consultantName ? `, under the care of ${gpLetter.consultantName}${gpLetter.consultantHospital?` at ${gpLetter.consultantHospital}`:""}` : ""}.
                  {" "}This document has been generated from a digital reaction diary and represents an accurate, timestamped record of clinical episodes.
                </p>
              </div>

              {/* Summary statistics */}
              {(() => {
                const total = reactions.length;
                const severe = reactions.filter(r=>(r["Severity Level"]||"").match(/3|4/)).length;
                const last90cutoff = new Date(); last90cutoff.setDate(last90cutoff.getDate()-90);
                const last90 = reactions.filter(r=>r["Date & Time"]&&new Date(r["Date & Time"])>=last90cutoff).length;
                const topAllergens = Object.entries(
                  reactions.reduce((acc,r)=>{ if(r["Suspected Allergen"]){acc[r["Suspected Allergen"]]=(acc[r["Suspected Allergen"]]||0)+1;} return acc; },{})
                ).sort((a,b)=>b[1]-a[1]).slice(0,3);
                return (
                  <div style={{marginBottom:20}}>
                    <div style={{fontSize:12,fontWeight:700,color:t.accent,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${t.border}`,fontFamily:"'DM Sans',sans-serif"}}>Summary Statistics</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10,marginBottom:14}}>
                      {[
                        {n:total,           l:"Total reactions logged"},
                        {n:severe,          l:"Severe / emergency episodes"},
                        {n:last90,          l:"Reactions in last 90 days"},
                        {n:medications.length,l:"Medications on record"},
                      ].map(({n,l})=>(
                        <div key={l} style={{background:dm?"#22223A":"#F7F4FF",borderRadius:8,padding:"10px 12px",textAlign:"center"}}>
                          <div style={{fontSize:24,fontWeight:700,color:t.accent,fontFamily:"'DM Sans',sans-serif"}}>{n}</div>
                          <div style={{fontSize:10,color:t.textMuted,marginTop:3,fontFamily:"'DM Sans',sans-serif"}}>{l}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{fontSize:13,color:t.text,lineHeight:1.8}}>
                      Of the {total} recorded reactions, <strong>{severe}</strong> were classified as severe or emergency (Severity Level 3–4), and <strong>{last90}</strong> occurred within the past 90 days.
                      {topAllergens.length>0&&<> The most frequently suspected triggers are: <strong>{topAllergens.map(([a])=>a).join(", ")}</strong>.</>}
                    </div>
                  </div>
                );
              })()}

              {/* Severity breakdown */}
              <div style={{marginBottom:20}}>
                <div style={{fontSize:12,fontWeight:700,color:t.accent,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${t.border}`,fontFamily:"'DM Sans',sans-serif"}}>Severity Distribution</div>
                {SEVERITY_LEVELS.map(sev=>{
                  const c=sc(sev);
                  const count = reactions.filter(r=>r["Severity Level"]===sev).length;
                  const pct = reactions.length ? Math.round((count/reactions.length)*100) : 0;
                  return count>0 ? (
                    <div key={sev} style={{display:"flex",alignItems:"center",gap:10,marginBottom:7}}>
                      <div style={{width:120,fontSize:12,color:t.text,flexShrink:0}}>{sev}</div>
                      <div style={{flex:1,height:7,background:t.sevBarBg,borderRadius:6,overflow:"hidden"}}>
                        <div style={{width:`${pct}%`,height:"100%",background:c.dot,borderRadius:6}}/>
                      </div>
                      <div style={{fontSize:12,color:t.textMuted,width:70,textAlign:"right",flexShrink:0,fontFamily:"'DM Sans',sans-serif"}}>{count} ({pct}%)</div>
                    </div>
                  ) : null;
                })}
              </div>

              {/* Current medications */}
              {medications.length>0&&(
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:12,fontWeight:700,color:t.accent,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${t.border}`,fontFamily:"'DM Sans',sans-serif"}}>Current Medication Regimen</div>
                  <table style={{...s.reportTable,fontSize:12}}>
                    <thead><tr style={{background:dm?"#22223A":"#F7F4FF"}}>
                      {["Medication","Type","Dose","Frequency","Notes"].map(h=><th key={h} style={{...s.reportTh,color:t.accent,fontFamily:"'DM Sans',sans-serif"}}>{h}</th>)}
                    </tr></thead>
                    <tbody>{medications.map(med=>(
                      <tr key={med.id}>
                        {["name","type","dose","time","notes"].map(k=><td key={k} style={{...s.reportTd,borderBottomColor:t.border,color:t.text}}>{med[k]||"—"}</td>)}
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}

              {/* Recent reaction log — last 20 */}
              {reactions.length>0&&(
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:12,fontWeight:700,color:t.accent,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${t.border}`,fontFamily:"'DM Sans',sans-serif"}}>
                    Recent Reaction Log {reactions.length>20?`(most recent 20 of ${reactions.length} total)`:"(all entries)"}
                  </div>
                  <table style={{...s.reportTable,fontSize:11}}>
                    <thead><tr style={{background:dm?"#22223A":"#F7F4FF"}}>
                      {["Date","Event","Symptoms","Trigger","Severity","Meds Used"].map(h=><th key={h} style={{...s.reportTh,fontSize:10,color:t.accent,fontFamily:"'DM Sans',sans-serif"}}>{h}</th>)}
                    </tr></thead>
                    <tbody>{reactions.slice(0,20).map(r=>(
                      <tr key={r.id||r._id}>
                        <td style={{...s.reportTd,borderBottomColor:t.border,color:t.text,whiteSpace:"nowrap"}}>{r["Date & Time"]?new Date(r["Date & Time"]).toLocaleDateString("en-GB"):"—"}</td>
                        <td style={{...s.reportTd,borderBottomColor:t.border,color:t.text}}>{r["Event Name"]||"—"}</td>
                        <td style={{...s.reportTd,borderBottomColor:t.border,color:t.text}}>{[r["Early Symptoms"],r["Mid Symptoms"],r["Severe Symptoms"]].filter(Boolean).join("; ")||"—"}</td>
                        <td style={{...s.reportTd,borderBottomColor:t.border,color:t.text}}>{r["Suspected Allergen"]||"—"}</td>
                        <td style={{...s.reportTd,borderBottomColor:t.border,color:t.text}}>{r["Severity Level"]||"—"}</td>
                        <td style={{...s.reportTd,borderBottomColor:t.border,color:t.text}}>{r["Medications Taken"]||"—"}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                  {reactions.length>20&&<div style={{fontSize:11,color:t.textMuted,marginTop:6,fontStyle:"italic"}}>Full reaction log ({reactions.length} entries) available on request or via CSV export.</div>}
                </div>
              )}

              {/* Closing */}
              <div style={{fontSize:13,color:t.text,lineHeight:1.9,marginBottom:24}}>
                <p style={{margin:"0 0 12px"}}>
                  I would be grateful if you could take this information into account when reviewing my treatment plan. I am happy to provide additional detail, raw data exports, or attend an appointment to discuss further.
                </p>
                <p style={{margin:0}}>Yours sincerely,</p>
              </div>
              <div style={{marginBottom:40}}>
                <div style={{borderBottom:`1px solid ${t.border}`,width:200,marginBottom:4}}/>
                <div style={{fontSize:13,color:t.text,fontWeight:600}}>{gpLetter.patientName||"[Patient name]"}</div>
                {gpLetter.dob&&<div style={{fontSize:12,color:t.textMuted}}>DOB: {new Date(gpLetter.dob).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</div>}
                {gpLetter.nhsNumber&&<div style={{fontSize:12,color:t.textMuted}}>NHS Number: {gpLetter.nhsNumber}</div>}
              </div>

              <div style={{...s.reportFooter,borderTopColor:t.border,color:t.textSub,fontFamily:"'DM Sans',sans-serif"}}>
                Generated by MCAS Reaction Tracker · {new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})} · Data is patient-recorded and accurate to the best of the patient's knowledge.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  root:         { fontFamily:"'DM Sans','Segoe UI',sans-serif", minHeight:"100vh" },
  header:       { padding:"24px 20px 16px", color:"white" },
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
  photoUploadBox: { borderRadius:10, padding:"12px 14px", marginTop:6 },
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
