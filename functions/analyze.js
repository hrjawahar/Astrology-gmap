export async function onRequest(context) {
  const { request } = context;
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  if (method === "GET") {
    return json({ ok: true, message: "D1–D9 analysis endpoint is ready." });
  }

  if (method !== "POST") {
    return json({ ok: false, error: `Method ${method} not allowed.` }, 405);
  }

  try {
    const payload = await request.json();
    return json({ ok: true, ...analyzePayload(payload) });
  } catch (error) {
    return json({ ok: false, error: error.message || "Analysis failed." }, 400);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders()
    }
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept"
  };
}

const SIGNS=["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
const PLANETS=["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];
const NATURAL_MALEFICS=new Set(["Sun","Mars","Saturn","Rahu","Ketu"]);
const SIGN_LORDS={Aries:"Mars",Taurus:"Venus",Gemini:"Mercury",Cancer:"Moon",Leo:"Sun",Virgo:"Mercury",Libra:"Venus",Scorpio:"Mars",Sagittarius:"Jupiter",Capricorn:"Saturn",Aquarius:"Saturn",Pisces:"Jupiter"};
const DEBILITATION={Sun:"Libra",Moon:"Scorpio",Mars:"Cancer",Mercury:"Pisces",Jupiter:"Capricorn",Venus:"Virgo",Saturn:"Aries",Rahu:"Scorpio",Ketu:"Taurus"};

function analyzePayload(payload){
  validatePayload(payload);
  const factors=[
    buildFactor("Identity",payload,[1],"Sun","Foundation"),
    buildFactor("Wealth",payload,[2,11],"Jupiter","Resources"),
    buildFactor("Marriage",payload,[7],"Venus","Relationships"),
    buildFactor("Career",payload,[10],getHouseLord(payload.d1.lagna,10),"Work"),
    buildFactor("Restraint",payload,[6,8,12],"Saturn","Stability"),
    buildFactor("Foreign Travel",payload,[9,12],"Rahu","Movement"),
    buildFactor("Health Sensitivity",payload,[1,6,8],"Sun","Care")
  ];
  const quickVerdict=factors.map(f=>({factor:f.title,verdict:f.status,short:f.short,tone:f.tone}));
  const comparison=factors.map(f=>({factor:f.title,d1:f.d1Line,d9:f.d9Line,feedback:f.feedback}));
  const domainInsights=factors.map(f=>({group:f.group,status:f.status,title:f.title,insight:f.insight,feedback:f.feedback,watchpoints:f.watchpoints}));
  const why=factors.flatMap(f=>f.why);
  const supportive=factors.filter(f=>f.tone==="good").length;
  const sensitive=factors.filter(f=>f.tone==="bad").length;
  let summary="The chart shows a mixed pattern with some areas needing maturity and some areas holding usable strength.";
  if (supportive >= 4) summary="The chart shows several usable strengths, but the stronger results are likely to emerge when the native acts with consistency and timing awareness.";
  else if (sensitive >= 3) summary="The chart carries meaningful sensitivity zones, so outcomes improve when the native acts with restraint, patience, and better phase selection.";
  const direction=supportive>sensitive
    ? "Overall direction is constructive. The chart improves when discipline and clear choices convert latent strength into visible movement."
    : "Overall direction is cautious but workable. The chart asks for better pacing, tighter decisions, and fewer impulsive reactions in key life areas.";
  return { quickVerdict, summary, direction, comparison, domainInsights, why, mahadashaWatch: buildMahadashaWatch(payload) };
}

function validatePayload(payload){
  if(!payload?.d1?.lagna||!payload?.d9?.lagna) throw new Error("Both D1 and D9 lagna signs are required.");
  ["d1","d9"].forEach(key=>{
    const seen=[]; for(let i=1;i<=12;i++) seen.push(...(payload[key].houses[i]||[]));
    PLANETS.forEach(planet=>{ const c=seen.filter(p=>p===planet).length; if(c!==1) throw new Error(`${key.toUpperCase()} must contain ${planet} exactly once.`); });
  });
}

function buildFactor(title,payload,houses,karaka,group){
  const d1=readChartFactor(payload.d1,houses,karaka), d9=readChartFactor(payload.d9,houses,karaka), total=d1.score+d9.score;
  let status="Mixed", tone="warn";
  if(total>=2){status="Supportive"; tone="good";}
  if(total<=-1){status="Sensitive"; tone="bad";}
  const short=total>=2 ? "Supportive combinations are visible." : total<=-1 ? "This area needs caution and maturity." : "This area can improve with timing and steadiness.";
  const insight=`${title} is read from the D1 foundation and then checked for durability in D9. D1 shows ${d1.text.toLowerCase()}, while D9 shows ${d9.text.toLowerCase()}.`;
  const feedback=total>=2
    ? `${title} has workable strength. Progress becomes stronger when the native uses discipline instead of waiting for luck alone.`
    : total<=-1
      ? `${title} needs restraint and better timing. The chart does not deny results, but it asks for maturity before stability.`
      : `${title} is neither blocked nor fully settled. Steady effort and phase selection matter more than speed here.`;
  return {
    group,title,status,tone,short,insight,feedback,
    watchpoints:[`Karaka tracked: ${karaka}.`,...d1.watch,...d9.watch].slice(0,4),
    why:[`${title}: D1 ${d1.text}.`,`${title}: D9 ${d9.text}.`],
    d1Line:d1.text,d9Line:d9.text
  };
}

function readChartFactor(chart,houses,karaka){
  let score=0; const watch=[]; const text=houses.map(h=>describeHouse(chart,h)).join(" ");
  if(houses.some(h=>(chart.houses[h]||[]).includes(karaka))){score+=1; watch.push(`${karaka} directly links to one of the target houses.`);}
  const pos=locatePlanet(chart,karaka);
  if(pos){
    if([1,4,5,7,9,10,11].includes(pos.house)) score+=1;
    if([6,8,12].includes(pos.house)){score-=1; watch.push(`${karaka} is placed in house ${pos.house}, so this factor needs better timing.`);}
    if(DEBILITATION[karaka]===pos.sign){score-=1; watch.push(`${karaka} is debilitated in ${pos.sign}.`);}
  }
  houses.map(h=>getHouseLord(chart.lagna,h)).forEach(lord=>{
    const p=locatePlanet(chart,lord);
    if(p && houses.includes(p.house)) score+=1;
    if(p && [6,8,12].includes(p.house)){score-=1; watch.push(`${lord}, a target house lord, falls in house ${p.house}.`);}
  });
  for(const h of houses){
    const mal=(chart.houses[h]||[]).filter(p=>NATURAL_MALEFICS.has(p));
    if(mal.length>=2){score-=1; watch.push(`House ${h} carries clustered pressure from ${mal.join(", ")}.`);}
  }
  return { score, text, watch };
}

function describeHouse(chart,house){
  const occ=chart.houses[house]||[], sign=houseToSign(chart.lagna,house), lord=getHouseLord(chart.lagna,house), lordPos=locatePlanet(chart,lord);
  const occText=occ.length?`house ${house} in ${sign} contains ${occ.join(", ")}`:`house ${house} in ${sign} is unoccupied`;
  const lordText=lordPos?`and its lord ${lord} goes to house ${lordPos.house} (${lordPos.sign})`:`and its lord ${lord} could not be located`;
  return `${occText}, ${lordText}`;
}

function buildMahadashaWatch(payload){
  const checks=[{planet:"Venus",area:"Marriage / partnership"},{planet:getHouseLord(payload.d1.lagna,10),area:"Career / karma"},{planet:"Moon",area:"Home / emotional steadiness"},{planet:"Sun",area:"Identity / vitality"},{planet:"Saturn",area:"Restraint / pressure handling"}];
  const out=[];
  checks.forEach(item=>{
    const pos=locatePlanet(payload.d1,item.planet); if(!pos) return;
    const reasons=[]; if([6,8,12].includes(pos.house)) reasons.push(`placed in house ${pos.house}`); if(DEBILITATION[item.planet]===pos.sign) reasons.push(`debilitated in ${pos.sign}`);
    const co=(payload.d1.houses[pos.house]||[]).filter(p=>p!==item.planet && NATURAL_MALEFICS.has(p)); if(co.length) reasons.push(`conjoined with ${co.join(", ")}`);
    if(reasons.length) out.push({planet:item.planet,area:item.area,status:"Watch",reason:`${item.planet} shows sensitivity because it is ${reasons.join("; ")}.`,feedback:`${item.planet} mahadasha should be handled carefully for ${item.area.toLowerCase()}. The native should avoid impulsive decisions in this domain during such periods.`});
  });
  return out;
}

function locatePlanet(chart,planet){ for(let h=1;h<=12;h++) if((chart.houses[h]||[]).includes(planet)) return { house:h, sign:houseToSign(chart.lagna,h) }; return null; }
function getHouseLord(lagna,house){ return SIGN_LORDS[houseToSign(lagna,house)]; }
function houseToSign(lagna,house){ const i=SIGNS.indexOf(lagna); if(i<0) throw new Error(`Unknown lagna sign: ${lagna}`); return SIGNS[(i+house-1)%12]; }
