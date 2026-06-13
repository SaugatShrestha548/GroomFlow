import { useState, useEffect, useRef } from "react";
import {
  CheckCircle2, Circle, Plus, Trash2, Edit3, X, Check,
  ChevronDown, ChevronUp, Scissors, Droplets, Wind, Sparkles,
  Calendar, LayoutDashboard, ListChecks, Bell, BellOff, BellRing,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAY_FULL   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const ICON_MAP   = { droplets: Droplets, scissors: Scissors, wind: Wind, sparkles: Sparkles };
const TASK_ICONS = [
  { id:"droplets", Icon:Droplets, label:"Water/Wash" },
  { id:"scissors", Icon:Scissors, label:"Trim/Cut"   },
  { id:"wind",     Icon:Wind,     label:"Air/Dry"    },
  { id:"sparkles", Icon:Sparkles, label:"Clean"      },
];
const ACCENT_COLORS = [
  { id:"crimson", bg:"#3d0a14", ring:"#c9273e", text:"#f87185" },
  { id:"indigo",  bg:"#0f1840", ring:"#4f63d2", text:"#818cf8" },
  { id:"teal",    bg:"#041f1e", ring:"#0d9488", text:"#2dd4bf" },
  { id:"amber",   bg:"#1f1505", ring:"#b45309", text:"#fbbf24" },
  { id:"violet",  bg:"#1a0a2e", ring:"#7c3aed", text:"#c084fc" },
];
const DEFAULT_TASKS = [
  { id:"t1", name:"Wash Hair",          icon:"droplets", color:"indigo",  days:[1,4] },
  { id:"t2", name:"Clean Nails & Ears", icon:"sparkles", color:"teal",    days:[2,5] },
  { id:"t3", name:"Clean Body Hair",    icon:"scissors", color:"crimson", days:[6]   },
];

// ─── Storage helpers ──────────────────────────────────────────────────────────

const ls = {
  get: (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } },
  set: (k, v)  => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const toDateStr = (d) => d.toISOString().split("T")[0];

// ─── Recurrence logic ─────────────────────────────────────────────────────────
// A task is due on `date` if date.getDay() (0=Sun…6=Sat) is in task.days array.
const isDueOn = (task, date) => task.days.includes(date.getDay());

function getWeekDates(ref) {
  const d = new Date(ref);
  d.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d); x.setDate(d.getDate() + i); return x;
  });
}

// ─── Notification helpers ─────────────────────────────────────────────────────

// Request permission from the user
async function requestNotifPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  return result;
}

// Fire a browser notification immediately
function fireNotification(title, body, icon = "/icon-192.png") {
  if (Notification.permission !== "granted") return;
  new Notification(title, { body, icon, badge: icon, vibrate: [200, 100, 200] });
}

// Schedule a daily notification using setTimeout.
// Called once on mount and whenever the reminder time changes.
// Stores the scheduled time so we don't double-fire.
function scheduleDailyReminder(timeStr, tasks) {
  const [hh, mm] = timeStr.split(":").map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(hh, mm, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1); // already passed → tomorrow

  const msUntil = target - now;
  return setTimeout(() => {
    const today = new Date();
    const due = tasks.filter(t => isDueOn(t, today));
    if (due.length > 0) {
      fireNotification(
        `GroomFlow — ${due.length} task${due.length > 1 ? "s" : ""} today`,
        due.map(t => `• ${t.name}`).join("\n"),
      );
    } else {
      fireNotification("GroomFlow", "No routines today — enjoy your rest day! 🎉");
    }
    // Re-schedule for next day after firing
    scheduleDailyReminder(timeStr, tasks);
  }, msUntil);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressRing({ pct, size = 88, stroke = 7 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#222" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#c9273e" strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.5s ease" }} />
    </svg>
  );
}

function TaskIcon({ iconId, color, size = 15 }) {
  const Icon = ICON_MAP[iconId] || Sparkles;
  const c = ACCENT_COLORS.find(x => x.id === color) || ACCENT_COLORS[0];
  const box = size + 16;
  return (
    <span style={{ display:"flex", alignItems:"center", justifyContent:"center",
      background:c.bg, width:box, height:box, minWidth:box, borderRadius:10 }}>
      <Icon size={size} color={c.text} strokeWidth={1.8} />
    </span>
  );
}

function ColorDot({ color }) {
  const c = ACCENT_COLORS.find(x => x.id === color) || ACCENT_COLORS[0];
  return <span style={{ display:"inline-block", width:10, height:10,
    borderRadius:"50%", background:c.ring, flexShrink:0 }} />;
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:50,
      display:"flex", alignItems:"flex-end", justifyContent:"center",
      background:"rgba(0,0,0,.8)" }}>
      <div style={{ width:"100%", maxWidth:460, borderRadius:"20px 20px 0 0",
        overflow:"hidden", background:"#141414", border:"1px solid #2a2a2a" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"16px 20px", borderBottom:"1px solid #222" }}>
          <span style={{ fontWeight:600, color:"#fff", letterSpacing:"-0.02em" }}>{title}</span>
          <button onClick={onClose} style={{ padding:6, borderRadius:8, background:"transparent",
            border:"none", cursor:"pointer", display:"flex" }}>
            <X size={16} color="#666" />
          </button>
        </div>
        <div style={{ padding:20, maxHeight:"80vh", overflowY:"auto" }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Task Form ────────────────────────────────────────────────────────────────

function TaskForm({ initial, onSave, onClose }) {
  const [name,  setName]  = useState(initial?.name  || "");
  const [icon,  setIcon]  = useState(initial?.icon  || "sparkles");
  const [color, setColor] = useState(initial?.color || "crimson");
  const [days,  setDays]  = useState(initial?.days  || []);

  const toggleDay = (d) => setDays(p => p.includes(d) ? p.filter(x=>x!==d) : [...p,d].sort((a,b)=>a-b));
  const handleSave = () => { if (!name.trim() || days.length === 0) return; onSave({ name:name.trim(), icon, color, days }); };

  const inputStyle = { width:"100%", padding:"10px 12px", borderRadius:12, background:"#1f1f1f",
    border:"1px solid #333", color:"#fff", fontSize:14, outline:"none", fontFamily:"inherit" };
  const label = (t) => <label style={{ display:"block", fontSize:11, color:"#666", marginBottom:6,
    textTransform:"uppercase", letterSpacing:"0.08em" }}>{t}</label>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <div>{label("Task name")}
        <input style={inputStyle} placeholder="e.g. Moisturise Face"
          value={name} onChange={e=>setName(e.target.value)} /></div>

      <div>{label("Icon")}
        <div style={{ display:"flex", gap:8 }}>
          {TASK_ICONS.map(({ id, Icon, label: lbl }) => (
            <button key={id} title={lbl} onClick={()=>setIcon(id)} style={{
              flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:10,
              borderRadius:12, cursor:"pointer", fontFamily:"inherit",
              background:icon===id?"#2a2a2a":"#1a1a1a", border:`1px solid ${icon===id?"#444":"#222"}` }}>
              <Icon size={16} color={icon===id?"#fff":"#555"} strokeWidth={1.8} />
            </button>
          ))}
        </div>
      </div>

      <div>{label("Accent color")}
        <div style={{ display:"flex", gap:8 }}>
          {ACCENT_COLORS.map(c => (
            <button key={c.id} onClick={()=>setColor(c.id)} style={{
              width:32, height:32, borderRadius:"50%", cursor:"pointer", background:c.ring, border:"none",
              outline:color===c.id?`2px solid ${c.ring}`:"none", outlineOffset:2,
              opacity:color===c.id?1:0.45, display:"flex", alignItems:"center", justifyContent:"center" }}>
              {color===c.id && <Check size={12} color="#fff" />}
            </button>
          ))}
        </div>
      </div>

      <div>{label("Repeat on")}
        <div style={{ display:"flex", gap:6 }}>
          {DAY_NAMES.map((dn, i) => {
            const sel = days.includes(i);
            return (
              <button key={i} onClick={()=>toggleDay(i)} style={{
                flex:1, padding:"8px 0", fontSize:11, fontWeight:500, borderRadius:10,
                cursor:"pointer", fontFamily:"inherit",
                background:sel?"#3d0a14":"#1a1a1a", border:`1px solid ${sel?"#c9273e":"#222"}`,
                color:sel?"#f87185":"#555" }}>{dn}</button>
            );
          })}
        </div>
        {days.length === 0 && <p style={{ fontSize:11, color:"#c9273e", marginTop:6 }}>Select at least one day</p>}
      </div>

      <div style={{ display:"flex", gap:12, paddingTop:4 }}>
        <button onClick={onClose} style={{ flex:1, padding:10, borderRadius:12, background:"transparent",
          border:"1px solid #2a2a2a", color:"#666", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
          Cancel
        </button>
        <button onClick={handleSave} disabled={!name.trim()||days.length===0} style={{
          flex:1, padding:10, borderRadius:12, fontWeight:600, fontSize:13, cursor:"pointer",
          fontFamily:"inherit", color:"#fff", border:"none",
          background:name.trim()&&days.length>0?"#c9273e":"#2a2a2a" }}>
          {initial ? "Save changes" : "Add task"}
        </button>
      </div>
    </div>
  );
}

// ─── Today View ───────────────────────────────────────────────────────────────

function TodayView({ tasks, today, checked, onToggle }) {
  // Filter to tasks whose days[] contains today's weekday index
  const dueTasks  = tasks.filter(t => isDueOn(t, today));
  const doneCount = dueTasks.filter(t => checked[t.id]).length;
  const pct       = dueTasks.length > 0 ? Math.round(doneCount / dueTasks.length * 100) : 100;
  const card      = { background:"#141414", border:"1px solid #222", borderRadius:18 };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {/* Header */}
      <div style={{ ...card, padding:18, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <p style={{ fontSize:10, color:"#555", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:2 }}>Today</p>
          <p style={{ fontSize:26, fontWeight:700, color:"#fff", letterSpacing:"-0.03em", lineHeight:1.1 }}>
            {DAY_FULL[today.getDay()]}
          </p>
          <p style={{ fontSize:12, color:"#555", marginTop:4 }}>
            {today.toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" })}
          </p>
        </div>
        <div style={{ position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <ProgressRing pct={pct} />
          <div style={{ position:"absolute", textAlign:"center" }}>
            <span style={{ fontSize:18, fontWeight:700, color:"#fff" }}>{pct}%</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
        {[["Due Today",dueTasks.length],["Completed",doneCount],["Remaining",dueTasks.length-doneCount]].map(([lbl,val]) => (
          <div key={lbl} style={{ ...card, padding:12, textAlign:"center" }}>
            <p style={{ fontSize:20, fontWeight:700, color:"#fff" }}>{val}</p>
            <p style={{ fontSize:10, color:"#555", marginTop:2 }}>{lbl}</p>
          </div>
        ))}
      </div>

      {/* Checklist */}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        <p style={{ fontSize:10, color:"#555", textTransform:"uppercase", letterSpacing:"0.1em", paddingLeft:2 }}>Checklist</p>
        {dueTasks.length === 0
          ? (
            <div style={{ ...card, padding:32, textAlign:"center" }}>
              <Sparkles size={28} color="#2a2a2a" style={{ display:"block", margin:"0 auto 12px" }} />
              <p style={{ color:"#555", fontSize:14 }}>Nothing scheduled today</p>
              <p style={{ color:"#444", fontSize:12, marginTop:4 }}>Enjoy your rest day ✦</p>
            </div>
          )
          : dueTasks.map(task => {
              const done = !!checked[task.id];
              const c = ACCENT_COLORS.find(x => x.id === task.color) || ACCENT_COLORS[0];
              return (
                <button key={task.id} onClick={() => onToggle(task.id)} style={{
                  width:"100%", display:"flex", alignItems:"center", gap:14, padding:14,
                  borderRadius:18, cursor:"pointer", textAlign:"left", fontFamily:"inherit",
                  background:done?"#0f0f0f":"#141414", border:`1px solid ${done?"#1a1a1a":"#222"}`,
                  opacity:done?0.6:1, transition:"all .2s" }}>
                  {done
                    ? <CheckCircle2 size={22} color={c.ring} strokeWidth={1.8} style={{ flexShrink:0 }} />
                    : <Circle      size={22} color="#2a2a2a" strokeWidth={1.8} style={{ flexShrink:0 }} />}
                  <TaskIcon iconId={task.icon} color={task.color} size={14} />
                  <span style={{ flex:1, fontSize:14, fontWeight:500,
                    color:done?"#444":"#fff", textDecoration:done?"line-through":"none" }}>
                    {task.name}
                  </span>
                  <span style={{ fontSize:10, padding:"3px 8px", borderRadius:20,
                    background:c.bg, color:c.text, border:`1px solid ${c.ring}25`, whiteSpace:"nowrap" }}>
                    {task.days.map(d => DAY_NAMES[d]).join(", ")}
                  </span>
                </button>
              );
            })
        }
      </div>

      {doneCount === dueTasks.length && dueTasks.length > 0 && (
        <div style={{ borderRadius:16, padding:16, textAlign:"center", background:"#0a1a10", border:"1px solid #1a4028" }}>
          <p style={{ color:"#4ade80", fontSize:14, fontWeight:500 }}>✦ All done for today!</p>
          <p style={{ color:"#166534", fontSize:12, marginTop:4 }}>Your routine is complete.</p>
        </div>
      )}
    </div>
  );
}

// ─── Rules Manager ────────────────────────────────────────────────────────────

function RulesManager({ tasks, onAdd, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(null);
  const card = { background:"#141414", border:"1px solid #222", borderRadius:18, overflow:"hidden" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <p style={{ fontSize:10, color:"#555", textTransform:"uppercase", letterSpacing:"0.1em", paddingLeft:2 }}>Your routines</p>

      {tasks.length === 0 && (
        <div style={{ ...card, padding:32, textAlign:"center" }}>
          <ListChecks size={28} color="#2a2a2a" style={{ display:"block", margin:"0 auto 12px" }} />
          <p style={{ color:"#555", fontSize:14 }}>No routines yet</p>
        </div>
      )}

      {tasks.map(task => {
        const isOpen = expanded === task.id;
        const c = ACCENT_COLORS.find(x => x.id === task.color) || ACCENT_COLORS[0];
        const freq = task.days.length === 7 ? "Daily" : task.days.length > 1 ? `${task.days.length}× weekly` : "Weekly";

        return (
          <div key={task.id} style={card}>
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:14 }}>
              <TaskIcon iconId={task.icon} color={task.color} size={14} />
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:14, fontWeight:500, color:"#fff",
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{task.name}</p>
                <p style={{ fontSize:11, color:"#555", marginTop:2 }}>{task.days.map(d=>DAY_NAMES[d]).join(", ")}</p>
              </div>
              <span style={{ fontSize:10, padding:"3px 8px", borderRadius:20,
                background:c.bg, color:c.text, marginRight:6, whiteSpace:"nowrap" }}>{freq}</span>
              <button onClick={() => setExpanded(isOpen ? null : task.id)} style={{
                padding:6, borderRadius:8, background:"transparent", border:"none", cursor:"pointer", display:"flex" }}>
                {isOpen ? <ChevronUp size={14} color="#555" /> : <ChevronDown size={14} color="#555" />}
              </button>
            </div>
            {isOpen && (
              <div style={{ padding:"0 14px 14px", borderTop:"1px solid #1e1e1e" }}>
                <div style={{ display:"flex", gap:8, paddingTop:12 }}>
                  <button onClick={() => onEdit(task)} style={{
                    flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                    padding:9, borderRadius:12, background:"transparent", border:"1px solid #2a2a2a",
                    color:"#888", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
                    <Edit3 size={12} /> Edit
                  </button>
                  <button onClick={() => { onDelete(task.id); setExpanded(null); }} style={{
                    flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                    padding:9, borderRadius:12, background:"#1a0505", border:"1px solid #3d1010",
                    color:"#c9273e", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button onClick={onAdd} style={{
        display:"flex", alignItems:"center", justifyContent:"center", gap:8,
        padding:14, borderRadius:18, cursor:"pointer", fontFamily:"inherit", fontWeight:500,
        background:"#1a0a0e", border:"1px dashed #3d1010", color:"#c9273e", fontSize:14 }}>
        <Plus size={16} /> Add new routine
      </button>
    </div>
  );
}

// ─── Weekly Calendar ──────────────────────────────────────────────────────────

function WeeklyCalendar({ tasks, today }) {
  const weekDates = getWeekDates(today);
  const todayStr  = toDateStr(today);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <p style={{ fontSize:10, color:"#555", textTransform:"uppercase", letterSpacing:"0.1em", paddingLeft:2 }}>This week</p>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6 }}>
        {weekDates.map((date, i) => {
          const isToday  = toDateStr(date) === todayStr;
          const dueTasks = tasks.filter(t => isDueOn(t, date));
          return (
            <div key={i} style={{ borderRadius:14, overflow:"hidden", display:"flex",
              flexDirection:"column", minHeight:110,
              background:isToday?"#1e0810":"#111",
              border:`1px solid ${isToday?"#c9273e40":"#1e1e1e"}` }}>
              <div style={{ padding:"8px 4px 4px" }}>
                <p style={{ fontSize:9, fontWeight:500, textAlign:"center", color:isToday?"#f87185":"#444" }}>
                  {DAY_NAMES[date.getDay()]}
                </p>
                <p style={{ fontSize:13, fontWeight:700, textAlign:"center", color:isToday?"#fff":"#333" }}>
                  {date.getDate()}
                </p>
              </div>
              <div style={{ flex:1, padding:"0 3px 6px", display:"flex", flexDirection:"column", gap:3 }}>
                {dueTasks.length === 0
                  ? <p style={{ fontSize:9, color:"#2a2a2a", textAlign:"center", marginTop:4 }}>—</p>
                  : dueTasks.slice(0,3).map(task => {
                      const c    = ACCENT_COLORS.find(x => x.id === task.color) || ACCENT_COLORS[0];
                      const Icon = ICON_MAP[task.icon] || Sparkles;
                      return (
                        <div key={task.id} title={task.name} style={{
                          display:"flex", alignItems:"center", gap:3, padding:"3px 4px",
                          borderRadius:6, background:c.bg, border:`1px solid ${c.ring}25` }}>
                          <Icon size={8} color={c.text} strokeWidth={2} style={{ flexShrink:0 }} />
                          <span style={{ fontSize:8, color:c.text,
                            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:1.3 }}>
                            {task.name}
                          </span>
                        </div>
                      );
                    })
                }
                {dueTasks.length > 3 && <p style={{ fontSize:8, color:"#555", paddingLeft:4 }}>+{dueTasks.length-3}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ background:"#141414", border:"1px solid #222", borderRadius:18, padding:16 }}>
        <p style={{ fontSize:10, color:"#555", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:12 }}>Schedule overview</p>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {tasks.map(task => {
            const c = ACCENT_COLORS.find(x => x.id === task.color) || ACCENT_COLORS[0];
            return (
              <div key={task.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <ColorDot color={task.color} />
                <span style={{ fontSize:12, color:"#ccc", flex:1,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{task.name}</span>
                <div style={{ display:"flex", gap:3 }}>
                  {[0,1,2,3,4,5,6].map(d => (
                    <div key={d} style={{ width:20, height:20, borderRadius:6,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      background:task.days.includes(d)?c.bg:"#1a1a1a",
                      border:`1px solid ${task.days.includes(d)?c.ring+"60":"#222"}` }}>
                      <span style={{ fontSize:8, color:task.days.includes(d)?c.text:"#333" }}>
                        {DAY_NAMES[d][0]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Notification Settings Panel ─────────────────────────────────────────────

function NotifSettings({ reminderTime, setReminderTime, notifStatus, onRequestPermission, tasks }) {
  const card = { background:"#141414", border:"1px solid #222", borderRadius:18, padding:18 };

  const statusInfo = {
    granted:     { icon: BellRing, color:"#4ade80", label:"Notifications enabled" },
    denied:      { icon: BellOff,  color:"#c9273e", label:"Blocked — enable in Android settings" },
    default:     { icon: Bell,     color:"#fbbf24", label:"Permission not yet given" },
    unsupported: { icon: BellOff,  color:"#555",    label:"Not supported in this browser" },
  }[notifStatus] || { icon:Bell, color:"#555", label:"Unknown" };

  const StatusIcon = statusInfo.icon;

  function sendTestNotif() {
    const today = new Date();
    const due = tasks.filter(t => isDueOn(t, today));
    if (due.length > 0) {
      fireNotification(`GroomFlow — ${due.length} task${due.length>1?"s":""} today`,
        due.map(t => `• ${t.name}`).join("\n"));
    } else {
      fireNotification("GroomFlow", "No routines today — enjoy your rest! 🎉");
    }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <p style={{ fontSize:10, color:"#555", textTransform:"uppercase", letterSpacing:"0.1em", paddingLeft:2 }}>Notifications</p>

      {/* Status card */}
      <div style={{ ...card, display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ width:40, height:40, borderRadius:12, background:"#1e1e1e",
          display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <StatusIcon size={20} color={statusInfo.color} />
        </div>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:13, fontWeight:500, color:"#fff" }}>Status</p>
          <p style={{ fontSize:11, color:statusInfo.color, marginTop:2 }}>{statusInfo.label}</p>
        </div>
        {notifStatus !== "granted" && notifStatus !== "unsupported" && (
          <button onClick={onRequestPermission} style={{
            padding:"8px 14px", borderRadius:12, background:"#c9273e", border:"none",
            color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
            whiteSpace:"nowrap" }}>
            Enable
          </button>
        )}
      </div>

      {/* Reminder time */}
      <div style={card}>
        <p style={{ fontSize:11, color:"#666", textTransform:"uppercase",
          letterSpacing:"0.08em", marginBottom:12 }}>Daily reminder time</p>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <input type="time" value={reminderTime}
            onChange={e => setReminderTime(e.target.value)}
            disabled={notifStatus !== "granted"}
            style={{ flex:1, padding:"10px 14px", borderRadius:12, background:"#1f1f1f",
              border:"1px solid #333", color:notifStatus==="granted"?"#fff":"#444",
              fontSize:16, outline:"none", fontFamily:"inherit", cursor:"pointer" }} />
          <span style={{ fontSize:12, color:"#555" }}>
            {notifStatus === "granted" ? "✓ set" : "—"}
          </span>
        </div>
        <p style={{ fontSize:11, color:"#555", marginTop:8 }}>
          GroomFlow will notify you at this time every day with your tasks.
        </p>
      </div>

      {/* Test button */}
      {notifStatus === "granted" && (
        <button onClick={sendTestNotif} style={{
          display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          padding:14, borderRadius:18, cursor:"pointer", fontFamily:"inherit", fontWeight:500,
          background:"#1a0a0e", border:"1px solid #3d1010", color:"#f87185", fontSize:14 }}>
          <BellRing size={16} /> Send test notification
        </button>
      )}

      {/* Info box */}
      <div style={{ borderRadius:16, padding:14, background:"#111", border:"1px solid #1e1e1e" }}>
        <p style={{ fontSize:11, color:"#666", lineHeight:1.7 }}>
          <span style={{ color:"#888", fontWeight:600 }}>How it works: </span>
          Each morning when you open GroomFlow, it schedules a notification for your set time.
          The reminder shows exactly which tasks are due that day.
          Works best on Android Chrome — keep the app open at least once per day.
        </p>
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const today    = new Date();
  const todayStr = toDateStr(today);

  const [tab,          setTab]          = useState("today");
  const [tasks,        setTasks]        = useState(() => ls.get("gf_tasks", DEFAULT_TASKS));
  const [checked,      setChecked]      = useState(() => ls.get(`gf_c_${todayStr}`, {}));
  const [modal,        setModal]        = useState(null);
  const [notifStatus,  setNotifStatus]  = useState(() =>
    "Notification" in window ? Notification.permission : "unsupported");
  const [reminderTime, setReminderTime] = useState(() => ls.get("gf_reminder_time", "07:30"));

  const timerRef = useRef(null);

  // Persist data
  useEffect(() => { ls.set("gf_tasks", tasks); }, [tasks]);
  useEffect(() => { ls.set(`gf_c_${todayStr}`, checked); }, [checked, todayStr]);
  useEffect(() => { ls.set("gf_reminder_time", reminderTime); }, [reminderTime]);

  // Schedule/reschedule daily notification whenever time or tasks change
  useEffect(() => {
    if (notifStatus !== "granted") return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = scheduleDailyReminder(reminderTime, tasks);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [notifStatus, reminderTime, tasks]);

  async function handleRequestPermission() {
    const result = await requestNotifPermission();
    setNotifStatus(result);
  }

  const handleToggle = (id) => setChecked(p => ({ ...p, [id]: !p[id] }));
  const handleAdd    = (data) => { setTasks(p => [...p, { ...data, id:`t_${Date.now()}` }]); setModal(null); };
  const handleEdit   = (data) => { setTasks(p => p.map(t => t.id===modal.task.id ? {...t,...data} : t)); setModal(null); };
  const handleDelete = (id)   => setTasks(p => p.filter(t => t.id !== id));

  const tabs = [
    { id:"today",    label:"Today",     Icon:LayoutDashboard },
    { id:"routines", label:"Routines",  Icon:ListChecks      },
    { id:"week",     label:"Week",      Icon:Calendar        },
    { id:"notifs",   label:"Alerts",    Icon:Bell            },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#0f0f0f",
      fontFamily:"'DM Sans',sans-serif", paddingBottom:40 }}>

      {/* Top bar */}
      <div style={{ position:"sticky", top:0, zIndex:40,
        background:"#0f0f0f", borderBottom:"1px solid #1a1a1a" }}>
        <div style={{ maxWidth:460, margin:"0 auto", padding:"16px 16px 0",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:"#c9273e",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Scissors size={13} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={{ fontWeight:700, color:"#fff", fontSize:15, letterSpacing:"-0.03em" }}>GroomFlow</span>
          </div>
          <span style={{ fontSize:11, color:"#555", padding:"3px 10px", borderRadius:20, background:"#1a1a1a" }}>
            {today.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" })}
          </span>
        </div>

        {/* Tabs */}
        <div style={{ maxWidth:460, margin:"0 auto", display:"flex",
          borderBottom:"1px solid #1a1a1a", marginTop:12 }}>
          {tabs.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)} style={{
              flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5,
              padding:"12px 0", fontSize:11, fontWeight:500, cursor:"pointer",
              background:"transparent", border:"none", fontFamily:"inherit",
              color:tab===id?"#f87185":"#555", position:"relative" }}>
              <Icon size={12} />
              {label}
              {tab===id && <span style={{ position:"absolute", bottom:0,
                left:"25%", right:"25%", height:2, borderRadius:2, background:"#c9273e" }} />}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:460, margin:"0 auto", padding:"20px 16px" }}>
        {tab==="today"    && <TodayView tasks={tasks} today={today} checked={checked} onToggle={handleToggle} />}
        {tab==="routines" && <RulesManager tasks={tasks} onAdd={()=>setModal("add")}
          onEdit={t=>setModal({task:t})} onDelete={handleDelete} />}
        {tab==="week"     && <WeeklyCalendar tasks={tasks} today={today} />}
        {tab==="notifs"   && <NotifSettings reminderTime={reminderTime} setReminderTime={setReminderTime}
          notifStatus={notifStatus} onRequestPermission={handleRequestPermission} tasks={tasks} />}
      </div>

      {/* Modals */}
      {modal==="add" && (
        <Modal title="New routine" onClose={() => setModal(null)}>
          <TaskForm onSave={handleAdd} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.task && (
        <Modal title="Edit routine" onClose={() => setModal(null)}>
          <TaskForm initial={modal.task} onSave={handleEdit} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
