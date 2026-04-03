const SIGNS=["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
const PLANETS=["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];
const STORAGE_KEY="d1d9LifePatternAnalyzer.history.v4";
const DRAFT_KEY="d1d9LifePatternAnalyzer.draft.v4";
const LAST_SESSION_KEY="d1d9LifePatternAnalyzer.lastSession.v4";

const HOUSE_LABELS={1:"Self / identity",2:"Wealth / family",3:"Effort / communication",4:"Home / emotional base",5:"Intelligence / children",6:"Obstacles / health strain",7:"Marriage / partnership",8:"Transformation / vulnerability",9:"Fortune / dharma",10:"Career / karma",11:"Gains / networks",12:"Loss / foreign / retreat"};

const referenceData=[
  {title:"12 Houses – Quick Reference",items:["1st house: self, body, temperament, vitality","2nd house: family, speech, stored wealth, values","3rd house: courage, effort, siblings, communication","4th house: home, peace, mother, comforts, property","5th house: intelligence, learning style, creativity, children","6th house: debt, disease, conflict, service","7th house: marriage, contracts, public interactions","8th house: shocks, vulnerability, secrecy, transformation","9th house: blessings, father, ethics, higher guidance","10th house: karma, profession, public standing","11th house: gains, fulfilment, networks","12th house: losses, sleep, foreign stay, spiritual withdrawal"]},
  {title:"Accepted Planet Names",items:["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"]},
  {title:"How to Enter Planets",items:["Type comma-separated names exactly, for example: Sun, Mercury","Leave the box blank when no planet is present in that house","Each planet should appear exactly once in D1 and exactly once in D9","Draft is auto-saved in your browser even if you close and reopen it on the same device/browser"]}
];

let lastResult=null;
let lastPayload=null;

document.addEventListener("DOMContentLoaded",()=>{
  buildLagnaOptions();
  buildHouseGrids();
  buildReferenceGuide();
  setupTabs();
  bindEvents();
  attachAutosave();
  restoreDraftOrLastSession();
  renderHistory();
});

function buildLagnaOptions(){
  const d1=document.getElementById("d1Lagna");
  const d9=document.getElementById("d9Lagna");
  const opts=SIGNS.map(sign=>`<option value="${sign}">${sign}</option>`).join("");
  d1.innerHTML=opts;
  d9.innerHTML=opts;
  d1.value="Aries";
  d9.value="Aries";
}

function buildHouseGrids(){
  document.getElementById("d1Grid").innerHTML=renderHouseBoxes("d1");
  document.getElementById("d9Grid").innerHTML=renderHouseBoxes("d9");
}
function renderHouseBoxes(prefix){
  return Array.from({length:12},(_,i)=>{
    const h=i+1;
    return `<div class="house-box"><label for="${prefix}House${h}">House ${h}</label><textarea id="${prefix}House${h}" placeholder="Example: Sun, Mercury"></textarea><div class="house-meta">${HOUSE_LABELS[h]}</div></div>`;
  }).join("");
}
function buildReferenceGuide(){
  const wrap=document.getElementById("referenceGuide");
  const tpl=document.getElementById("accordionTemplate");
  wrap.innerHTML="";
  referenceData.forEach(section=>{
    const node=tpl.content.firstElementChild.cloneNode(true);
    node.querySelector("summary").textContent=section.title;
    node.querySelector(".accordion-content").innerHTML=`<ul>${section.items.map(i=>`<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
    wrap.appendChild(node);
  });
}
function setupTabs(){
  const tabs=document.querySelectorAll(".tab");
  const panels=document.querySelectorAll(".tab-panel");
  tabs.forEach(tab=>{
    tab.addEventListener("click",()=>{
      tabs.forEach(t=>t.classList.remove("active"));
      panels.forEach(p=>p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
    });
  });
}
function bindEvents(){
  document.getElementById("analyzeBtn").addEventListener("click",analyzeCharts);
  document.getElementById("resetBtn").addEventListener("click",resetForm);
  document.getElementById("saveSessionBtn").addEventListener("click",saveCurrentSession);
  document.getElementById("downloadReportBtn").addEventListener("click",downloadWordReport);
}
function attachAutosave(){
  const ids=["nativeName","notes","d1Lagna","d9Lagna",...Array.from({length:12},(_,i)=>`d1House${i+1}`),...Array.from({length:12},(_,i)=>`d9House${i+1}`)];
  ids.forEach(id=>{
    const el=document.getElementById(id);
    if (!el) return;
    el.addEventListener("input",saveDraft);
    el.addEventListener("change",saveDraft);
  });
}
function saveDraft(){
  localStorage.setItem(DRAFT_KEY, JSON.stringify(collectPayload()));
}
function restoreDraftOrLastSession(){
  const lastSessionId=localStorage.getItem(LAST_SESSION_KEY);
  const history=getHistory();
  if (lastSessionId){
    const match=history.find(x=>x.id===lastSessionId);
    if (match){
      applyPayload(match.payload);
      if (match.result){
        lastPayload=match.payload;
        lastResult=match.result;
        renderInsights(match.result);
        document.getElementById("downloadReportBtn").disabled=false;
      }
      return;
    }
  }
  try{
    const draft=JSON.parse(localStorage.getItem(DRAFT_KEY)||"null");
    if (draft) applyPayload(draft);
  }catch{}
}
function normalizePlanetName(name){
  const v=String(name||"").trim().toLowerCase();
  const map={sun:"Sun",moon:"Moon",mars:"Mars",mercury:"Mercury",jupiter:"Jupiter",venus:"Venus",saturn:"Saturn",rahu:"Rahu",ketu:"Ketu"};
  return map[v]||null;
}
function parseHouseInput(prefix){
  const houses={};
  for(let h=1;h<=12;h++){
    const raw=document.getElementById(`${prefix}House${h}`).value.trim();
    houses[h]=raw?[...new Set(raw.split(",").map(p=>normalizePlanetName(p)).filter(Boolean))]:[];
  }
  return houses;
}
function collectPayload(){
  return {
    nativeName:document.getElementById("nativeName").value.trim()||"Untitled Native",
    notes:document.getElementById("notes").value.trim(),
    d1:{lagna:document.getElementById("d1Lagna").value,houses:parseHouseInput("d1")},
    d9:{lagna:document.getElementById("d9Lagna").value,houses:parseHouseInput("d9")}
  };
}
function applyPayload(payload){
  document.getElementById("nativeName").value=payload.nativeName||"";
  document.getElementById("notes").value=payload.notes||"";
  document.getElementById("d1Lagna").value=(payload.d1&&payload.d1.lagna)||"Aries";
  document.getElementById("d9Lagna").value=(payload.d9&&payload.d9.lagna)||"Aries";
  for(let h=1;h<=12;h++){
    document.getElementById(`d1House${h}`).value=((payload.d1&&payload.d1.houses&&payload.d1.houses[h])||[]).join(", ");
    document.getElementById(`d9House${h}`).value=((payload.d9&&payload.d9.houses&&payload.d9.houses[h])||[]).join(", ");
  }
}
function validatePayload(payload){
  const errors=[];
  ["d1","d9"].forEach(key=>{
    const seen=[];
    for(let i=1;i<=12;i++) seen.push(...(payload[key].houses[i]||[]));
    PLANETS.forEach(planet=>{
      const count=seen.filter(p=>p===planet).length;
      if(count===0) errors.push(`${key.toUpperCase()}: ${planet} is missing.`);
      if(count>1) errors.push(`${key.toUpperCase()}: ${planet} appears more than once.`);
    });
  });
  return {ok:errors.length===0,errors};
}
async function analyzeCharts(){
  const payload=collectPayload();
  lastPayload=payload;
  saveDraft();
  const validation=validatePayload(payload);
  const box=document.getElementById("validationBox");

  if(!validation.ok){
    box.innerHTML=`<div class="bad"><strong>Validation failed.</strong></div><ul class="bullet-list">${validation.errors.map(e=>`<li>${escapeHtml(e)}</li>`).join("")}</ul>`;
    return;
  }

  box.innerHTML=`<div class="good"><strong>Validation passed.</strong> Sending charts for analysis...</div>`;

  try{
    const response=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(payload)});
    const raw=await response.text();
    let result=null;
    try{ result=raw?JSON.parse(raw):null; }catch(e){ throw new Error(`Server did not return valid JSON. Raw response starts with: ${raw.slice(0,120)||"[empty]"}`); }
    if(!response.ok || !result || !result.ok) throw new Error((result&&result.error)||`Analysis failed with HTTP ${response.status}.`);
    lastResult=result;
    renderInsights(result);
    document.getElementById("downloadReportBtn").disabled=false;
    box.innerHTML=`<div class="good"><strong>Validation passed.</strong> Analysis completed successfully.</div>`;
    saveCurrentSession(true);
    activateTab("insightsTab");
  }catch(error){
    box.innerHTML=`<div class="bad"><strong>Analysis failed.</strong> ${escapeHtml(error.message)}</div>`;
  }
}

function renderInsights(result){
  renderQuickVerdict(result.quickVerdict||[]);
  document.getElementById("earlyLifeBox").innerHTML=`<pre>${escapeHtml(result.earlyLife||"")}</pre>`;
  document.getElementById("laterLifeBox").innerHTML=`<pre>${escapeHtml(result.laterLife||"")}</pre>`;
  document.getElementById("directionBox").innerHTML=`<pre>${escapeHtml(result.direction||"")}</pre>`;
  renderComparisonTable(result.comparison||[]);
  renderDomainCards(result.domainInsights||[]);
  renderWhyBox(result.why||[]);
  renderMahadasha(result.mahadashaWatch||[]);
}
function renderQuickVerdict(items){
  const grid=document.getElementById("quickVerdictGrid");
  if(!items.length){
    grid.innerHTML=`<div class="empty-state">Run analysis to view quick verdict.</div>`;
    return;
  }
  grid.innerHTML=items.map(item=>`
    <div class="verdict-card">
      <h3>${escapeHtml(item.factor)}</h3>
      <div class="status-badge ${statusClass(item.verdict)}">${escapeHtml(item.verdict)}</div>
      <div class="verdict-detail">${escapeHtml(item.meaning)}</div>
    </div>
  `).join("");
}
function renderComparisonTable(rows){
  const wrap=document.getElementById("comparisonTableWrap");
  if(!rows.length){
    wrap.innerHTML="Comparison table will appear here.";
    return;
  }
  wrap.innerHTML=`<div class="comparison-table-wrap">
    <table class="comparison-table">
      <thead>
        <tr><th>Domain</th><th>D1</th><th>D9</th><th>Trend</th><th>Final Verdict</th></tr>
      </thead>
      <tbody>
        ${rows.map(r=>`<tr><td>${escapeHtml(r.domain)}</td><td>${escapeHtml(r.d1)}</td><td>${escapeHtml(r.d9)}</td><td>${escapeHtml(r.trend)}</td><td>${escapeHtml(r.finalVerdict)}</td></tr>`).join("")}
      </tbody>
    </table>
    <div class="small-note">Mixed means one layer supports while the other layer delays, fluctuates, or needs maturity before stabilising.</div>
  </div>`;
}
function renderDomainCards(cards){
  const wrap=document.getElementById("domainCards");
  if(!cards.length){ wrap.innerHTML=""; return; }
  wrap.innerHTML=cards.map(card=>`
    <div class="domain-card">
      <div class="domain-group-tag">${escapeHtml(card.group)}</div>
      <div class="status-badge ${statusClass(card.status)}">${escapeHtml(card.status)}</div>
      <h3>${escapeHtml(card.title)}</h3>
      <h4>What this factor means</h4>
      <p>${escapeHtml(card.meaning)}</p>
      <h4>Insight</h4>
      <p>${escapeHtml(card.insight)}</p>
      <h4>Feedback</h4>
      <p>${escapeHtml(card.feedback)}</p>
      <h4>Watchpoints</h4>
      <ul class="inline-list">${(card.watchpoints||[]).map(p=>`<li>${escapeHtml(p)}</li>`).join("")}</ul>
    </div>
  `).join("");
}
function renderWhyBox(items){
  const wrap=document.getElementById("whyBox");
  wrap.innerHTML=items.length?`<ul class="bullet-list">${items.map(i=>`<li>${escapeHtml(i)}</li>`).join("")}</ul>`:"Reasoning narrative will appear here.";
}
function renderMahadasha(items){
  const box=document.getElementById("mahadashaBox");
  if(!items.length){
    box.innerHTML=`<div class="good">No major mahadasha caution signal was triggered by the current rule set.</div>`;
    return;
  }
  box.innerHTML=items.map(item=>`
    <div class="history-item">
      <div class="domain-group-tag">${escapeHtml(item.planet)} Mahadasha</div>
      <div class="status-badge ${statusClass(item.status)}">${escapeHtml(item.status)}</div>
      <h3>${escapeHtml(item.area)}</h3>
      <p>${escapeHtml(item.reason)}</p>
      <p><strong>Feedback:</strong> ${escapeHtml(item.feedback)}</p>
    </div>
  `).join("");
}
function statusClass(status){
  const s=String(status||"").toLowerCase();
  if(["strong","supportive"].includes(s)) return "status-strong";
  if(["medium","delayed","mixed","watch"].includes(s)) return "status-medium";
  if(["vulnerable","sensitive","early advantage"].includes(s)) return "status-vulnerable";
  return "status-medium";
}
function saveCurrentSession(silent=false){
  const payload=lastPayload||collectPayload();
  const result=lastResult||null;
  const history=getHistory();
  const id=(result&&findMatchingSessionId(payload,history))||String(Date.now());
  const item={id,savedAt:new Date().toISOString(),payload,result};
  const next=[item,...history.filter(x=>x.id!==id)].slice(0,30);
  localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
  localStorage.setItem(LAST_SESSION_KEY,id);
  renderHistory();
  if(!silent) alert("Session saved to browser history.");
}
function findMatchingSessionId(payload,history){
  const sig=JSON.stringify(payload);
  const found=history.find(x=>JSON.stringify(x.payload)===sig);
  return found?found.id:null;
}
function getHistory(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]"); }catch{ return []; }
}
function renderHistory(){
  const wrap=document.getElementById("historyList");
  const history=getHistory();
  if(!history.length){
    wrap.innerHTML=`<div class="empty-state">No saved sessions yet.</div>`;
    return;
  }
  wrap.innerHTML=history.map(item=>`
    <div class="history-item">
      <div class="history-row">
        <div>
          <h3>${escapeHtml(item.payload.nativeName||"Untitled Native")}</h3>
          <div class="muted">${new Date(item.savedAt).toLocaleString()}</div>
          <div class="muted">D1 Lagna: ${escapeHtml(item.payload.d1.lagna)} | D9 Lagna: ${escapeHtml(item.payload.d9.lagna)}</div>
        </div>
        <div class="history-actions">
          <button data-load="${item.id}">Load</button>
          <button class="danger" data-delete="${item.id}">Delete</button>
        </div>
      </div>
    </div>
  `).join("");
  wrap.querySelectorAll("[data-load]").forEach(btn=>btn.addEventListener("click",()=>loadSession(btn.dataset.load)));
  wrap.querySelectorAll("[data-delete]").forEach(btn=>btn.addEventListener("click",()=>deleteSession(btn.dataset.delete)));
}
function loadSession(id){
  const item=getHistory().find(x=>x.id===id);
  if(!item) return;
  applyPayload(item.payload);
  localStorage.setItem(DRAFT_KEY, JSON.stringify(item.payload));
  localStorage.setItem(LAST_SESSION_KEY, id);
  lastPayload=item.payload;
  lastResult=item.result||null;
  if(item.result){
    renderInsights(item.result);
    document.getElementById("downloadReportBtn").disabled=false;
  }
  activateTab("inputTab");
}
function deleteSession(id){
  const next=getHistory().filter(x=>x.id!==id);
  localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
  if(localStorage.getItem(LAST_SESSION_KEY)===id) localStorage.removeItem(LAST_SESSION_KEY);
  renderHistory();
}
function activateTab(tabId){
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.tab===tabId));
  document.querySelectorAll(".tab-panel").forEach(p=>p.classList.toggle("active",p.id===tabId));
}
function resetForm(){
  document.getElementById("nativeName").value="";
  document.getElementById("notes").value="";
  document.getElementById("d1Lagna").value="Aries";
  document.getElementById("d9Lagna").value="Aries";
  for(let h=1;h<=12;h++){
    document.getElementById(`d1House${h}`).value="";
    document.getElementById(`d9House${h}`).value="";
  }
  localStorage.removeItem(DRAFT_KEY);
  document.getElementById("validationBox").textContent="No validation run yet.";
  document.getElementById("quickVerdictGrid").innerHTML=`<div class="empty-state">Run analysis to view quick verdict.</div>`;
  document.getElementById("earlyLifeBox").innerHTML="Run analysis to view early-life leaning.";
  document.getElementById("laterLifeBox").innerHTML="Run analysis to view later-life leaning.";
  document.getElementById("directionBox").innerHTML="Overall journey interpretation will appear here.";
  document.getElementById("comparisonTableWrap").innerHTML="Comparison table will appear here.";
  document.getElementById("domainCards").innerHTML="";
  document.getElementById("whyBox").innerHTML="Reasoning narrative will appear here.";
  document.getElementById("mahadashaBox").innerHTML="Run analysis to view mahadasha watch signals.";
  document.getElementById("downloadReportBtn").disabled=true;
  lastResult=null;
  lastPayload=null;
}
function downloadWordReport(){
  if(!lastResult||!lastPayload) return;
  const html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>D1–D9 Report</title><style>body{font-family:Arial,sans-serif;color:#111;line-height:1.45;}h1,h2,h3{color:#111;}table{border-collapse:collapse;width:100%;margin:10px 0 18px;}th,td{border:1px solid #999;padding:8px;text-align:left;vertical-align:top;}ul{margin-top:6px;}</style></head><body>
  <h1>D1–D9 Life Pattern Analyzer Report</h1>
  <p><strong>Native Name:</strong> ${escapeHtml(lastPayload.nativeName)}</p>
  <p><strong>Notes:</strong> ${escapeHtml(lastPayload.notes||"-")}</p>
  <p><strong>D1 Lagna:</strong> ${escapeHtml(lastPayload.d1.lagna)} | <strong>D9 Lagna:</strong> ${escapeHtml(lastPayload.d9.lagna)}</p>
  <h2>Early Life Leaning</h2><p>${escapeHtml(lastResult.earlyLife||"")}</p>
  <h2>Later Life Leaning</h2><p>${escapeHtml(lastResult.laterLife||"")}</p>
  <h2>Overall Direction</h2><p>${escapeHtml(lastResult.direction||"")}</p>
  <h2>Quick Verdict</h2><ul>${(lastResult.quickVerdict||[]).map(v=>`<li><strong>${escapeHtml(v.factor)}:</strong> ${escapeHtml(v.verdict)} — ${escapeHtml(v.meaning)}</li>`).join("")}</ul>
  <h2>D1–D9 Life Pattern</h2><table><thead><tr><th>Domain</th><th>D1</th><th>D9</th><th>Trend</th><th>Final Verdict</th></tr></thead><tbody>${(lastResult.comparison||[]).map(r=>`<tr><td>${escapeHtml(r.domain)}</td><td>${escapeHtml(r.d1)}</td><td>${escapeHtml(r.d9)}</td><td>${escapeHtml(r.trend)}</td><td>${escapeHtml(r.finalVerdict)}</td></tr>`).join("")}</tbody></table>
  <h2>Life Factor Insights</h2>${(lastResult.domainInsights||[]).map(c=>`<h3>${escapeHtml(c.title)} (${escapeHtml(c.status)})</h3><p><strong>What this factor means:</strong> ${escapeHtml(c.meaning)}</p><p><strong>Insight:</strong> ${escapeHtml(c.insight)}</p><p><strong>Feedback:</strong> ${escapeHtml(c.feedback)}</p><ul>${(c.watchpoints||[]).map(p=>`<li>${escapeHtml(p)}</li>`).join("")}</ul>`).join("")}
  <h2>Why This Conclusion</h2><ul>${(lastResult.why||[]).map(i=>`<li>${escapeHtml(i)}</li>`).join("")}</ul>
  <h2>Mahadasha Watch Zone</h2>${(lastResult.mahadashaWatch||[]).length?(lastResult.mahadashaWatch||[]).map(i=>`<p><strong>${escapeHtml(i.planet)} Mahadasha:</strong> ${escapeHtml(i.area)} — ${escapeHtml(i.reason)} — ${escapeHtml(i.feedback)}</p>`).join(""):"<p>No major mahadasha caution signal was triggered by the current rule set.</p>"}
  </body></html>`;
  const blob=new Blob(["\ufeff",html],{type:"application/msword"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  const safe=(lastPayload.nativeName||"d1-d9-report").replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"");
  a.href=url;
  a.download=`${safe||"d1-d9-report"}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function escapeHtml(v){
  return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
