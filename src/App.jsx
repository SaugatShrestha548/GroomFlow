import { useState, useEffect, useRef } from "react";
import {
  CheckCircle2, Circle, Plus, Trash2, Edit3, X, Check,
  ChevronDown, ChevronUp, Scissors, Droplets, Wind, Sparkles,
  Calendar, LayoutDashboard, ListChecks, Bell, BellOff, BellRing, RefreshCw,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAY_FULL   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const ICON_MAP   = { droplets:Droplets, scissors:Scissors, wind:Wind, sparkles:Sparkles };
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

// ─── Recurrence types ─────────────────────────────────────────────────────────
// type: "weekly"    → days: [0-6]   (day-of-week indices)
// type: "interval"  → intervalDays: N, startDate: "YYYY-MM-DD"
// type: "monthly"   → monthDay: 1-31 (day of month)
const FREQ_TYPES = [
  { id:"weekly",   label:"Days of week",    desc:"e.g. every Mon & Thu" },
  { id:"interval", label:"Every N days",    desc:"e.g. every 15 days"   },
  { id:"monthly",  label:"Day of month",    desc:"e.g. 1st of every month" },
];

const DEFAULT_TASKS = [
  { id:"t1", name:"Wash Hair",          icon:"droplets", color:"indigo",  type:"weekly",   days:[1,4]                                    },
  { id:"t2", name:"Clean Nails & Ears", icon:"sparkles", color:"teal",    type:"weekly",   days:[2,5]                                    },
  { id:"t3", name:"Clean Body Hair",    icon:"scissors", color:"crimson", type:"weekly",   days:[6]                                      },
  { id:"t4", name:"Deep Hair Mask",     icon:"wind",     color:"amber",   type:"interval", intervalDays:15, startDate:"2025-06-01"       },
  { id:"t5", name:"Full Body Scrub",    icon:"sparkles", color:"violet",  type:"monthly",  monthDay:1                                    },
];

// ─── Storage ──────────────────────────────────────────────────────────────────
const ls = {
  get: (k,fb) => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):fb; } catch { return fb; } },
  set: (k,v)  => { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} },
};
const toDateStr = (d) => {
  // Use local date parts to avoid UTC offset issues
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
};
const parseDate = (s) => { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };

// ─── Core recurrence logic ────────────────────────────────────────────────────
//
// Three modes:
//  1. weekly   → task.days includes date.getDay()
//  2. interval → days elapsed since startDate is divisible by intervalDays
//  3. monthly  → date.getDate() === task.monthDay
//
function isDueOn(task, date) {
  const type = task.type || "weekly";

  if (type === "weekly") {
    return (task.days || []).includes(date.getDay());
  }

  if (type === "monthly") {
    const dom = task.monthDay || 1;
    // Handle months shorter than monthDay (e.g. monthDay=31 in February)
    // → use last day of month in that case
    const lastDay = new Date(date.getFullYear(), date.getMonth()+1, 0).getDate();
    return date.getDate() === Math.min(dom, lastDay);
  }

  if (type === "interval") {
    const start = parseDate(task.startDate || toDateStr(date));
    const msPerDay = 86400000;
    // Diff in whole days (both dates at midnight local time)
    const startMid = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const dateMid  = new Date(date.getFullYear(),  date.getMonth(),  date.getDate());
    const diffDays = Math.round((dateMid - startMid) / msPerDay);
    if (diffDays < 0) return false;
    return diffDays % (task.intervalDays || 1) === 0;
  }

  return false;
}

// Human-readable recurrence label for a task
function freqLabel(task) {
  const type = task.type || "weekly";
  if (type === "weekly") {
    if ((task.days||[]).length === 7) return "Daily";
    if ((task.days||[]).length === 1) return `Every ${DAY_FULL[task.days[0]]}`;
    return (task.days||[]).map(d=>DAY_NAMES[d]).join(", ");
  }
  if (type === "monthly") return `${ordinal(task.monthDay||1)} of month`;
  if (type === "interval") return `Every ${task.intervalDays||1} days`;
  return "";
}

function ordinal(n) {
  const s=["th","st","nd","rd"], v=n%100;
  return n+(s[(v-20)%10]||s[v]||s[0]);
}

// Next due date from today
function nextDue(task, fromDate) {
  const d = new Date(fromDate);
  for (let i=1; i<=400; i++) {
    d.setDate(d.getDate()+1);
    if (isDueOn(task, d)) return new Date(d);
  }
  return null;
}

// Days until next occurrence
function daysUntilNext(task, today) {
  const next = nextDue(task, today);
  if (!next) return null;
  const msPerDay = 86400000;
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const nextMid  = new Date(next.getFullYear(),  next.getMonth(),  next.getDate());
  return Math.round((nextMid - todayMid) / msPerDay);
}

// Get 14-day lookahead dates
function get14Days(ref) {
  return Array.from({length:14}, (_,i) => {
    const d = new Date(ref); d.setDate(ref.getDate()+i); return d;
  });
}

// ─── Notification helpers ─────────────────────────────────────────────────────
async function requestNotifPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission==="granted") return "granted";
  if (Notification.permission==="denied")  return "denied";
  return await Notification.requestPermission();
}
function fireNotification(title, body, icon="/icon-192.png") {
  if (Notification.permission!=="granted") return;
  new Notification(title, { body, icon, badge:icon, vibrate:[200,100,200] });
}
function scheduleDailyReminder(timeStr, tasks) {
  const [hh,mm] = timeStr.split(":").map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(hh,mm,0,0);
  if (target<=now) target.setDate(target.getDate()+1);
  return setTimeout(()=>{
    const today = new Date();
    const due = tasks.filter(t=>isDueOn(t,today));
    if (due.length>0) fireNotification(`GroomFlow — ${due.length} task${due.length>1?"s":""} today`, due.map(t=>`• ${t.name}`).join("\n"));
    else fireNotification("GroomFlow","No routines today — enjoy your rest day! 🎉");
    scheduleDailyReminder(timeStr, tasks);
  }, target-now);
}

// ─── UI Atoms ─────────────────────────────────────────────────────────────────
function ProgressRing({pct,size=88,stroke=7}) {
  const r=(size-stroke)/2, circ=2*Math.PI*r, dash=circ*(pct/100);
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#222" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#c9273e" strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{transition:"stroke-dasharray 0.5s ease"}}/>
    </svg>
  );
}
function TaskIcon({iconId,color,size=15}) {
  const Icon=ICON_MAP[iconId]||Sparkles;
  const c=ACCENT_COLORS.find(x=>x.id===color)||ACCENT_COLORS[0];
  const box=size+16;
  return (
    <span style={{display:"flex",alignItems:"center",justifyContent:"center",
      background:c.bg,width:box,height:box,minWidth:box,borderRadius:10}}>
      <Icon size={size} color={c.text} strokeWidth={1.8}/>
    </span>
  );
}
function ColorDot({color}) {
  const c=ACCENT_COLORS.find(x=>x.id===color)||ACCENT_COLORS[0];
  return <span style={{display:"inline-block",width:10,height:10,borderRadius:"50%",background:c.ring,flexShrink:0}}/>;
}
function Modal({title,onClose,children}) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:50,display:"flex",alignItems:"flex-end",
      justifyContent:"center",background:"rgba(0,0,0,.8)"}}>
      <div style={{width:"100%",maxWidth:460,borderRadius:"20px 20px 0 0",overflow:"hidden",
        background:"#141414",border:"1px solid #2a2a2a"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"16px 20px",borderBottom:"1px solid #222"}}>
          <span style={{fontWeight:600,color:"#fff",letterSpacing:"-0.02em"}}>{title}</span>
          <button onClick={onClose} style={{padding:6,borderRadius:8,background:"transparent",
            border:"none",cursor:"pointer",display:"flex"}}>
            <X size={16} color="#666"/>
          </button>
        </div>
        <div style={{padding:20,maxHeight:"85vh",overflowY:"auto"}}>{children}</div>
      </div>
    </div>
  );
}

// ─── Task Form ────────────────────────────────────────────────────────────────
function TaskForm({initial,onSave,onClose}) {
  const [name,        setName]        = useState(initial?.name        || "");
  const [icon,        setIcon]        = useState(initial?.icon        || "sparkles");
  const [color,       setColor]       = useState(initial?.color       || "crimson");
  const [freqType,    setFreqType]    = useState(initial?.type        || "weekly");
  const [days,        setDays]        = useState(initial?.days        || []);
  const [intervalN,   setIntervalN]   = useState(initial?.intervalDays|| 15);
  const [startDate,   setStartDate]   = useState(initial?.startDate   || toDateStr(new Date()));
  const [monthDay,    setMonthDay]    = useState(initial?.monthDay    || 1);

  const toggleDay = (d) => setDays(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d].sort((a,b)=>a-b));

  function handleSave() {
    if (!name.trim()) return;
    if (freqType==="weekly" && days.length===0) return;
    const base = {name:name.trim(),icon,color,type:freqType};
    if (freqType==="weekly")   onSave({...base,days});
    if (freqType==="interval") onSave({...base,intervalDays:Math.max(1,Number(intervalN)),startDate});
    if (freqType==="monthly")  onSave({...base,monthDay:Math.min(31,Math.max(1,Number(monthDay)))});
  }

  const lbl  = (t) => <label style={{display:"block",fontSize:11,color:"#666",marginBottom:6,
    textTransform:"uppercase",letterSpacing:"0.08em"}}>{t}</label>;
  const inp  = {width:"100%",padding:"10px 12px",borderRadius:12,background:"#1f1f1f",
    border:"1px solid #333",color:"#fff",fontSize:14,outline:"none",fontFamily:"inherit"};
  const numInp = {...inp,width:80,textAlign:"center"};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      {/* Name */}
      <div>{lbl("Task name")}
        <input style={inp} placeholder="e.g. Moisturise Face" value={name} onChange={e=>setName(e.target.value)}/>
      </div>

      {/* Icon */}
      <div>{lbl("Icon")}
        <div style={{display:"flex",gap:8}}>
          {TASK_ICONS.map(({id,Icon,label})=>(
            <button key={id} title={label} onClick={()=>setIcon(id)} style={{
              flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:10,
              borderRadius:12,cursor:"pointer",fontFamily:"inherit",
              background:icon===id?"#2a2a2a":"#1a1a1a",border:`1px solid ${icon===id?"#444":"#222"}`}}>
              <Icon size={16} color={icon===id?"#fff":"#555"} strokeWidth={1.8}/>
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div>{lbl("Accent color")}
        <div style={{display:"flex",gap:8}}>
          {ACCENT_COLORS.map(c=>(
            <button key={c.id} onClick={()=>setColor(c.id)} style={{
              width:32,height:32,borderRadius:"50%",cursor:"pointer",background:c.ring,border:"none",
              outline:color===c.id?`2px solid ${c.ring}`:"none",outlineOffset:2,
              opacity:color===c.id?1:0.45,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {color===c.id&&<Check size={12} color="#fff"/>}
            </button>
          ))}
        </div>
      </div>

      {/* Frequency type selector */}
      <div>{lbl("Repeat schedule")}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {FREQ_TYPES.map(ft=>(
            <button key={ft.id} onClick={()=>setFreqType(ft.id)} style={{
              display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:14,
              cursor:"pointer",fontFamily:"inherit",textAlign:"left",
              background:freqType===ft.id?"#1e0810":"#1a1a1a",
              border:`1px solid ${freqType===ft.id?"#c9273e":"#222"}`}}>
              <div style={{width:18,height:18,borderRadius:"50%",flexShrink:0,
                border:`2px solid ${freqType===ft.id?"#c9273e":"#444"}`,
                display:"flex",alignItems:"center",justifyContent:"center"}}>
                {freqType===ft.id&&<div style={{width:8,height:8,borderRadius:"50%",background:"#c9273e"}}/>}
              </div>
              <div>
                <p style={{fontSize:13,fontWeight:500,color:freqType===ft.id?"#fff":"#888"}}>{ft.label}</p>
                <p style={{fontSize:11,color:"#555",marginTop:1}}>{ft.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Weekly: day picker */}
      {freqType==="weekly" && (
        <div>{lbl("Repeat on")}
          <div style={{display:"flex",gap:6}}>
            {DAY_NAMES.map((dn,i)=>{
              const sel=days.includes(i);
              return (
                <button key={i} onClick={()=>toggleDay(i)} style={{
                  flex:1,padding:"8px 0",fontSize:11,fontWeight:500,borderRadius:10,
                  cursor:"pointer",fontFamily:"inherit",
                  background:sel?"#3d0a14":"#1a1a1a",
                  border:`1px solid ${sel?"#c9273e":"#222"}`,
                  color:sel?"#f87185":"#555"}}>{dn}</button>
              );
            })}
          </div>
          {days.length===0&&<p style={{fontSize:11,color:"#c9273e",marginTop:6}}>Select at least one day</p>}
        </div>
      )}

      {/* Interval: every N days + start date */}
      {freqType==="interval" && (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div>{lbl("Every how many days?")}
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <button onClick={()=>setIntervalN(n=>Math.max(1,Number(n)-1))} style={{
                width:36,height:36,borderRadius:10,background:"#1f1f1f",border:"1px solid #333",
                color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
              <input type="number" value={intervalN} min={1} max={365}
                onChange={e=>setIntervalN(e.target.value)} style={numInp}/>
              <button onClick={()=>setIntervalN(n=>Number(n)+1)} style={{
                width:36,height:36,borderRadius:10,background:"#1f1f1f",border:"1px solid #333",
                color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
              <span style={{fontSize:13,color:"#666"}}>days</span>
            </div>
            {/* Quick presets */}
            <div style={{display:"flex",gap:6,marginTop:8}}>
              {[7,10,14,15,21,30].map(n=>(
                <button key={n} onClick={()=>setIntervalN(n)} style={{
                  padding:"5px 10px",borderRadius:8,fontSize:11,cursor:"pointer",fontFamily:"inherit",
                  background:Number(intervalN)===n?"#3d0a14":"#1a1a1a",
                  border:`1px solid ${Number(intervalN)===n?"#c9273e":"#222"}`,
                  color:Number(intervalN)===n?"#f87185":"#666"}}>{n}d</button>
              ))}
            </div>
          </div>
          <div>{lbl("Starting from")}
            <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} style={inp}/>
            <p style={{fontSize:11,color:"#555",marginTop:6}}>
              The app counts intervals from this date forward.
            </p>
          </div>
        </div>
      )}

      {/* Monthly: day of month */}
      {freqType==="monthly" && (
        <div>{lbl("Day of month")}
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>setMonthDay(n=>Math.max(1,Number(n)-1))} style={{
              width:36,height:36,borderRadius:10,background:"#1f1f1f",border:"1px solid #333",
              color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
            <input type="number" value={monthDay} min={1} max={31}
              onChange={e=>setMonthDay(e.target.value)} style={numInp}/>
            <button onClick={()=>setMonthDay(n=>Math.min(31,Number(n)+1))} style={{
              width:36,height:36,borderRadius:10,background:"#1f1f1f",border:"1px solid #333",
              color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
            <span style={{fontSize:13,color:"#666"}}>{ordinal(Number(monthDay))} of every month</span>
          </div>
          {/* Quick presets */}
          <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
            {[1,5,10,15,20,25,28].map(n=>(
              <button key={n} onClick={()=>setMonthDay(n)} style={{
                padding:"5px 10px",borderRadius:8,fontSize:11,cursor:"pointer",fontFamily:"inherit",
                background:Number(monthDay)===n?"#3d0a14":"#1a1a1a",
                border:`1px solid ${Number(monthDay)===n?"#c9273e":"#222"}`,
                color:Number(monthDay)===n?"#f87185":"#666"}}>{ordinal(n)}</button>
            ))}
          </div>
          <p style={{fontSize:11,color:"#555",marginTop:8}}>
            If a month is shorter (e.g. Feb), it'll use the last available day.
          </p>
        </div>
      )}

      {/* Actions */}
      <div style={{display:"flex",gap:12,paddingTop:4}}>
        <button onClick={onClose} style={{flex:1,padding:10,borderRadius:12,background:"transparent",
          border:"1px solid #2a2a2a",color:"#666",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
          Cancel
        </button>
        <button onClick={handleSave}
          disabled={!name.trim()||(freqType==="weekly"&&days.length===0)}
          style={{flex:1,padding:10,borderRadius:12,fontWeight:600,fontSize:13,cursor:"pointer",
            fontFamily:"inherit",color:"#fff",border:"none",
            background:name.trim()&&(freqType!=="weekly"||days.length>0)?"#c9273e":"#2a2a2a"}}>
          {initial?"Save changes":"Add task"}
        </button>
      </div>
    </div>
  );
}

// ─── Today View ───────────────────────────────────────────────────────────────
function TodayView({tasks,today,checked,onToggle}) {
  const dueTasks  = tasks.filter(t=>isDueOn(t,today));
  const doneCount = dueTasks.filter(t=>checked[t.id]).length;
  const pct       = dueTasks.length>0?Math.round(doneCount/dueTasks.length*100):100;
  const card      = {background:"#141414",border:"1px solid #222",borderRadius:18};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      {/* Header */}
      <div style={{...card,padding:18,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <p style={{fontSize:10,color:"#555",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:2}}>Today</p>
          <p style={{fontSize:26,fontWeight:700,color:"#fff",letterSpacing:"-0.03em",lineHeight:1.1}}>
            {DAY_FULL[today.getDay()]}
          </p>
          <p style={{fontSize:12,color:"#555",marginTop:4}}>
            {today.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}
          </p>
        </div>
        <div style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <ProgressRing pct={pct}/>
          <div style={{position:"absolute",textAlign:"center"}}>
            <span style={{fontSize:18,fontWeight:700,color:"#fff"}}>{pct}%</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
        {[["Due Today",dueTasks.length],["Completed",doneCount],["Remaining",dueTasks.length-doneCount]].map(([l,v])=>(
          <div key={l} style={{...card,padding:12,textAlign:"center"}}>
            <p style={{fontSize:20,fontWeight:700,color:"#fff"}}>{v}</p>
            <p style={{fontSize:10,color:"#555",marginTop:2}}>{l}</p>
          </div>
        ))}
      </div>

      {/* Checklist */}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <p style={{fontSize:10,color:"#555",textTransform:"uppercase",letterSpacing:"0.1em",paddingLeft:2}}>Checklist</p>
        {dueTasks.length===0
          ? (
            <div style={{...card,padding:32,textAlign:"center"}}>
              <Sparkles size={28} color="#2a2a2a" style={{display:"block",margin:"0 auto 12px"}}/>
              <p style={{color:"#555",fontSize:14}}>Nothing scheduled today</p>
              <p style={{color:"#444",fontSize:12,marginTop:4}}>Enjoy your rest day ✦</p>
            </div>
          )
          : dueTasks.map(task=>{
              const done=!!checked[task.id];
              const c=ACCENT_COLORS.find(x=>x.id===task.color)||ACCENT_COLORS[0];
              return (
                <button key={task.id} onClick={()=>onToggle(task.id)} style={{
                  width:"100%",display:"flex",alignItems:"center",gap:14,padding:14,
                  borderRadius:18,cursor:"pointer",textAlign:"left",fontFamily:"inherit",
                  background:done?"#0f0f0f":"#141414",border:`1px solid ${done?"#1a1a1a":"#222"}`,
                  opacity:done?0.6:1,transition:"all .2s"}}>
                  {done
                    ? <CheckCircle2 size={22} color={c.ring} strokeWidth={1.8} style={{flexShrink:0}}/>
                    : <Circle size={22} color="#2a2a2a" strokeWidth={1.8} style={{flexShrink:0}}/>}
                  <TaskIcon iconId={task.icon} color={task.color} size={14}/>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:14,fontWeight:500,
                      color:done?"#444":"#fff",textDecoration:done?"line-through":"none"}}>
                      {task.name}
                    </p>
                    <p style={{fontSize:10,color:"#555",marginTop:2}}>{freqLabel(task)}</p>
                  </div>
                  <span style={{fontSize:10,padding:"3px 8px",borderRadius:20,
                    background:c.bg,color:c.text,border:`1px solid ${c.ring}25`,whiteSpace:"nowrap",flexShrink:0}}>
                    {task.type==="monthly"?"Monthly":task.type==="interval"?`${task.intervalDays}d`:"Weekly"}
                  </span>
                </button>
              );
            })
        }
      </div>

      {doneCount===dueTasks.length&&dueTasks.length>0&&(
        <div style={{borderRadius:16,padding:16,textAlign:"center",background:"#0a1a10",border:"1px solid #1a4028"}}>
          <p style={{color:"#4ade80",fontSize:14,fontWeight:500}}>✦ All done for today!</p>
          <p style={{color:"#166534",fontSize:12,marginTop:4}}>Your routine is complete.</p>
        </div>
      )}

      {/* Upcoming reminders */}
      <UpcomingStrip tasks={tasks} today={today}/>
    </div>
  );
}

// Shows the next 3 upcoming tasks that aren't due today
function UpcomingStrip({tasks,today}) {
  const todayStr = toDateStr(today);
  // For each task, find its next occurrence after today
  const upcoming = tasks
    .filter(t=>!isDueOn(t,today))
    .map(t=>({task:t, days:daysUntilNext(t,today)}))
    .filter(x=>x.days!==null&&x.days<=30)
    .sort((a,b)=>a.days-b.days)
    .slice(0,4);

  if (upcoming.length===0) return null;

  return (
    <div>
      <p style={{fontSize:10,color:"#555",textTransform:"uppercase",letterSpacing:"0.1em",paddingLeft:2,marginBottom:8}}>
        Coming up
      </p>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {upcoming.map(({task,days})=>{
          const c=ACCENT_COLORS.find(x=>x.id===task.color)||ACCENT_COLORS[0];
          const label = days===1?"Tomorrow":`In ${days} days`;
          return (
            <div key={task.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",
              borderRadius:14,background:"#111",border:"1px solid #1a1a1a"}}>
              <TaskIcon iconId={task.icon} color={task.color} size={13}/>
              <span style={{flex:1,fontSize:13,color:"#888"}}>{task.name}</span>
              <span style={{fontSize:11,color:c.text,padding:"2px 8px",borderRadius:20,background:c.bg}}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Rules Manager ────────────────────────────────────────────────────────────
function RulesManager({tasks,onAdd,onEdit,onDelete}) {
  const [expanded,setExpanded]=useState(null);
  const card={background:"#141414",border:"1px solid #222",borderRadius:18,overflow:"hidden"};
  const today=new Date();

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <p style={{fontSize:10,color:"#555",textTransform:"uppercase",letterSpacing:"0.1em",paddingLeft:2}}>Your routines</p>
      {tasks.length===0&&(
        <div style={{...card,padding:32,textAlign:"center"}}>
          <ListChecks size={28} color="#2a2a2a" style={{display:"block",margin:"0 auto 12px"}}/>
          <p style={{color:"#555",fontSize:14}}>No routines yet</p>
        </div>
      )}
      {tasks.map(task=>{
        const isOpen=expanded===task.id;
        const c=ACCENT_COLORS.find(x=>x.id===task.color)||ACCENT_COLORS[0];
        const nextDays=daysUntilNext(task,today);
        const dueToday=isDueOn(task,today);
        return (
          <div key={task.id} style={card}>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:14}}>
              <TaskIcon iconId={task.icon} color={task.color} size={14}/>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:14,fontWeight:500,color:"#fff",
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.name}</p>
                <p style={{fontSize:11,color:"#555",marginTop:2}}>{freqLabel(task)}</p>
              </div>
              <span style={{fontSize:10,padding:"3px 8px",borderRadius:20,
                background:dueToday?"#0a1a10":c.bg,
                color:dueToday?"#4ade80":c.text,
                border:`1px solid ${dueToday?"#1a4028":c.ring+"30"}`,
                marginRight:6,whiteSpace:"nowrap"}}>
                {dueToday?"Due today":nextDays===1?"Tomorrow":nextDays?`In ${nextDays}d`:"—"}
              </span>
              <button onClick={()=>setExpanded(isOpen?null:task.id)} style={{
                padding:6,borderRadius:8,background:"transparent",border:"none",cursor:"pointer",display:"flex"}}>
                {isOpen?<ChevronUp size={14} color="#555"/>:<ChevronDown size={14} color="#555"/>}
              </button>
            </div>
            {isOpen&&(
              <div style={{padding:"0 14px 14px",borderTop:"1px solid #1e1e1e"}}>
                <div style={{display:"flex",gap:8,paddingTop:12}}>
                  <button onClick={()=>onEdit(task)} style={{
                    flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                    padding:9,borderRadius:12,background:"transparent",border:"1px solid #2a2a2a",
                    color:"#888",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                    <Edit3 size={12}/> Edit
                  </button>
                  <button onClick={()=>{onDelete(task.id);setExpanded(null);}} style={{
                    flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                    padding:9,borderRadius:12,background:"#1a0505",border:"1px solid #3d1010",
                    color:"#c9273e",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                    <Trash2 size={12}/> Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <button onClick={onAdd} style={{
        display:"flex",alignItems:"center",justifyContent:"center",gap:8,
        padding:14,borderRadius:18,cursor:"pointer",fontFamily:"inherit",fontWeight:500,
        background:"#1a0a0e",border:"1px dashed #3d1010",color:"#c9273e",fontSize:14}}>
        <Plus size={16}/> Add new routine
      </button>
    </div>
  );
}

// ─── 14-Day Calendar ──────────────────────────────────────────────────────────
function WeeklyCalendar({tasks,today}) {
  const [offset,setOffset]=useState(0); // 0=this week, 1=next week
  const baseDate=new Date(today);
  baseDate.setDate(today.getDate()+offset*7);
  // Start from current day-of-week Sunday
  const startDate=new Date(baseDate);
  startDate.setDate(baseDate.getDate()-baseDate.getDay());

  const weekDates=Array.from({length:7},(_,i)=>{
    const d=new Date(startDate);d.setDate(startDate.getDate()+i);return d;
  });
  const todayStr=toDateStr(today);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Week nav */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <p style={{fontSize:10,color:"#555",textTransform:"uppercase",letterSpacing:"0.1em"}}>
          {offset===0?"This week":offset===1?"Next week":`Week +${offset}`}
        </p>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setOffset(o=>Math.max(0,o-1))} disabled={offset===0} style={{
            padding:"5px 12px",borderRadius:10,background:"#1a1a1a",border:"1px solid #222",
            color:offset===0?"#333":"#888",fontSize:12,cursor:offset===0?"default":"pointer",fontFamily:"inherit"}}>
            ← Prev
          </button>
          <button onClick={()=>setOffset(o=>o+1)} style={{
            padding:"5px 12px",borderRadius:10,background:"#1a1a1a",border:"1px solid #222",
            color:"#888",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
            Next →
          </button>
        </div>
      </div>

      {/* Grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
        {weekDates.map((date,i)=>{
          const isToday=toDateStr(date)===todayStr;
          const dueTasks=tasks.filter(t=>isDueOn(t,date));
          return (
            <div key={i} style={{borderRadius:14,overflow:"hidden",display:"flex",flexDirection:"column",minHeight:110,
              background:isToday?"#1e0810":"#111",
              border:`1px solid ${isToday?"#c9273e40":"#1e1e1e"}`}}>
              <div style={{padding:"8px 4px 4px"}}>
                <p style={{fontSize:9,fontWeight:500,textAlign:"center",color:isToday?"#f87185":"#444"}}>
                  {DAY_NAMES[date.getDay()]}
                </p>
                <p style={{fontSize:13,fontWeight:700,textAlign:"center",color:isToday?"#fff":"#333"}}>
                  {date.getDate()}
                </p>
              </div>
              <div style={{flex:1,padding:"0 3px 6px",display:"flex",flexDirection:"column",gap:3}}>
                {dueTasks.length===0
                  ? <p style={{fontSize:9,color:"#2a2a2a",textAlign:"center",marginTop:4}}>—</p>
                  : dueTasks.slice(0,3).map(task=>{
                      const c=ACCENT_COLORS.find(x=>x.id===task.color)||ACCENT_COLORS[0];
                      const Icon=ICON_MAP[task.icon]||Sparkles;
                      return (
                        <div key={task.id} title={task.name} style={{
                          display:"flex",alignItems:"center",gap:3,padding:"3px 4px",
                          borderRadius:6,background:c.bg,border:`1px solid ${c.ring}25`}}>
                          <Icon size={8} color={c.text} strokeWidth={2} style={{flexShrink:0}}/>
                          <span style={{fontSize:8,color:c.text,
                            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",lineHeight:1.3}}>
                            {task.name}
                          </span>
                        </div>
                      );
                    })
                }
                {dueTasks.length>3&&<p style={{fontSize:8,color:"#555",paddingLeft:4}}>+{dueTasks.length-3}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend / all routines */}
      <div style={{background:"#141414",border:"1px solid #222",borderRadius:18,padding:16}}>
        <p style={{fontSize:10,color:"#555",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>All routines</p>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {tasks.map(task=>{
            const c=ACCENT_COLORS.find(x=>x.id===task.color)||ACCENT_COLORS[0];
            const type=task.type||"weekly";
            return (
              <div key={task.id} style={{display:"flex",alignItems:"center",gap:10}}>
                <ColorDot color={task.color}/>
                <span style={{fontSize:12,color:"#ccc",flex:1,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.name}</span>
                {type==="weekly"
                  ? (
                    <div style={{display:"flex",gap:3}}>
                      {[0,1,2,3,4,5,6].map(d=>(
                        <div key={d} style={{width:20,height:20,borderRadius:6,
                          display:"flex",alignItems:"center",justifyContent:"center",
                          background:task.days.includes(d)?c.bg:"#1a1a1a",
                          border:`1px solid ${task.days.includes(d)?c.ring+"60":"#222"}`}}>
                          <span style={{fontSize:8,color:task.days.includes(d)?c.text:"#333"}}>
                            {DAY_NAMES[d][0]}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{fontSize:10,padding:"2px 8px",borderRadius:20,
                      background:c.bg,color:c.text}}>{freqLabel(task)}</span>
                  )
                }
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Notification Settings ────────────────────────────────────────────────────
function NotifSettings({reminderTime,setReminderTime,notifStatus,onRequestPermission,tasks}) {
  const card={background:"#141414",border:"1px solid #222",borderRadius:18,padding:18};
  const statusInfo={
    granted:     {icon:BellRing,color:"#4ade80",label:"Notifications enabled"},
    denied:      {icon:BellOff, color:"#c9273e",label:"Blocked — enable in Android settings > Apps > Chrome > Notifications"},
    default:     {icon:Bell,    color:"#fbbf24",label:"Permission not yet given"},
    unsupported: {icon:BellOff, color:"#555",   label:"Not supported in this browser"},
  }[notifStatus]||{icon:Bell,color:"#555",label:"Unknown"};
  const StatusIcon=statusInfo.icon;

  function sendTestNotif() {
    const today=new Date();
    const due=tasks.filter(t=>isDueOn(t,today));
    if (due.length>0) fireNotification(`GroomFlow — ${due.length} task${due.length>1?"s":""} today`,due.map(t=>`• ${t.name}`).join("\n"));
    else fireNotification("GroomFlow","No routines today — enjoy your rest! 🎉");
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <p style={{fontSize:10,color:"#555",textTransform:"uppercase",letterSpacing:"0.1em",paddingLeft:2}}>Notifications</p>
      <div style={{...card,display:"flex",alignItems:"center",gap:14}}>
        <div style={{width:40,height:40,borderRadius:12,background:"#1e1e1e",
          display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <StatusIcon size={20} color={statusInfo.color}/>
        </div>
        <div style={{flex:1}}>
          <p style={{fontSize:13,fontWeight:500,color:"#fff"}}>Status</p>
          <p style={{fontSize:11,color:statusInfo.color,marginTop:2}}>{statusInfo.label}</p>
        </div>
        {notifStatus!=="granted"&&notifStatus!=="unsupported"&&(
          <button onClick={onRequestPermission} style={{
            padding:"8px 14px",borderRadius:12,background:"#c9273e",border:"none",
            color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
            Enable
          </button>
        )}
      </div>
      <div style={card}>
        <p style={{fontSize:11,color:"#666",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>Daily reminder time</p>
        <input type="time" value={reminderTime} onChange={e=>setReminderTime(e.target.value)}
          disabled={notifStatus!=="granted"}
          style={{width:"100%",padding:"10px 14px",borderRadius:12,background:"#1f1f1f",
            border:"1px solid #333",color:notifStatus==="granted"?"#fff":"#444",
            fontSize:16,outline:"none",fontFamily:"inherit"}}/>
        <p style={{fontSize:11,color:"#555",marginTop:8}}>GroomFlow will notify you at this time every day.</p>
      </div>
      {notifStatus==="granted"&&(
        <button onClick={sendTestNotif} style={{
          display:"flex",alignItems:"center",justifyContent:"center",gap:8,
          padding:14,borderRadius:18,cursor:"pointer",fontFamily:"inherit",fontWeight:500,
          background:"#1a0a0e",border:"1px solid #3d1010",color:"#f87185",fontSize:14}}>
          <BellRing size={16}/> Send test notification
        </button>
      )}
      <div style={{borderRadius:16,padding:14,background:"#111",border:"1px solid #1e1e1e"}}>
        <p style={{fontSize:11,color:"#666",lineHeight:1.7}}>
          <span style={{color:"#888",fontWeight:600}}>How it works: </span>
          Open GroomFlow once each morning and it schedules your reminder for the day.
          Works on Android Chrome. Keep the tab open or add to home screen for best results.
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
  const [tasks,        setTasks]        = useState(()=>ls.get("gf_tasks", DEFAULT_TASKS));
  const [checked,      setChecked]      = useState(()=>ls.get(`gf_c_${todayStr}`, {}));
  const [modal,        setModal]        = useState(null);
  const [notifStatus,  setNotifStatus]  = useState(()=>"Notification" in window?Notification.permission:"unsupported");
  const [reminderTime, setReminderTime] = useState(()=>ls.get("gf_reminder_time","07:30"));
  const timerRef = useRef(null);

  useEffect(()=>{ls.set("gf_tasks",tasks);},[tasks]);
  useEffect(()=>{ls.set(`gf_c_${todayStr}`,checked);},[checked,todayStr]);
  useEffect(()=>{ls.set("gf_reminder_time",reminderTime);},[reminderTime]);

  useEffect(()=>{
    if (notifStatus!=="granted") return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current=scheduleDailyReminder(reminderTime,tasks);
    return ()=>{ if(timerRef.current) clearTimeout(timerRef.current); };
  },[notifStatus,reminderTime,tasks]);

  async function handleRequestPermission() {
    const r=await requestNotifPermission(); setNotifStatus(r);
  }

  const handleToggle = (id)   => setChecked(p=>({...p,[id]:!p[id]}));
  const handleAdd    = (data) => { setTasks(p=>[...p,{...data,id:`t_${Date.now()}`}]); setModal(null); };
  const handleEdit   = (data) => { setTasks(p=>p.map(t=>t.id===modal.task.id?{...t,...data}:t)); setModal(null); };
  const handleDelete = (id)   => setTasks(p=>p.filter(t=>t.id!==id));

  const tabs=[
    {id:"today",    label:"Today",    Icon:LayoutDashboard},
    {id:"routines", label:"Routines", Icon:ListChecks},
    {id:"week",     label:"Week",     Icon:Calendar},
    {id:"notifs",   label:"Alerts",   Icon:Bell},
  ];

  return (
    <div style={{minHeight:"100vh",background:"#0f0f0f",fontFamily:"'DM Sans',sans-serif",paddingBottom:40}}>
      {/* Top bar */}
      <div style={{position:"sticky",top:0,zIndex:40,background:"#0f0f0f",borderBottom:"1px solid #1a1a1a"}}>
        <div style={{maxWidth:460,margin:"0 auto",padding:"16px 16px 0",
          display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:8,background:"#c9273e",
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Scissors size={13} color="#fff" strokeWidth={2.5}/>
            </div>
            <span style={{fontWeight:700,color:"#fff",fontSize:15,letterSpacing:"-0.03em"}}>GroomFlow</span>
          </div>
          <span style={{fontSize:11,color:"#555",padding:"3px 10px",borderRadius:20,background:"#1a1a1a"}}>
            {today.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}
          </span>
        </div>
        <div style={{maxWidth:460,margin:"0 auto",display:"flex",borderBottom:"1px solid #1a1a1a",marginTop:12}}>
          {tabs.map(({id,label,Icon})=>(
            <button key={id} onClick={()=>setTab(id)} style={{
              flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,
              padding:"12px 0",fontSize:11,fontWeight:500,cursor:"pointer",
              background:"transparent",border:"none",fontFamily:"inherit",
              color:tab===id?"#f87185":"#555",position:"relative"}}>
              <Icon size={12}/>{label}
              {tab===id&&<span style={{position:"absolute",bottom:0,left:"25%",right:"25%",
                height:2,borderRadius:2,background:"#c9273e"}}/>}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{maxWidth:460,margin:"0 auto",padding:"20px 16px"}}>
        {tab==="today"    && <TodayView tasks={tasks} today={today} checked={checked} onToggle={handleToggle}/>}
        {tab==="routines" && <RulesManager tasks={tasks} onAdd={()=>setModal("add")}
          onEdit={t=>setModal({task:t})} onDelete={handleDelete}/>}
        {tab==="week"     && <WeeklyCalendar tasks={tasks} today={today}/>}
        {tab==="notifs"   && <NotifSettings reminderTime={reminderTime} setReminderTime={setReminderTime}
          notifStatus={notifStatus} onRequestPermission={handleRequestPermission} tasks={tasks}/>}
      </div>

      {modal==="add"&&(
        <Modal title="New routine" onClose={()=>setModal(null)}>
          <TaskForm onSave={handleAdd} onClose={()=>setModal(null)}/>
        </Modal>
      )}
      {modal?.task&&(
        <Modal title="Edit routine" onClose={()=>setModal(null)}>
          <TaskForm initial={modal.task} onSave={handleEdit} onClose={()=>setModal(null)}/>
        </Modal>
      )}
    </div>
  );
}
