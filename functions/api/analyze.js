export async function onRequest(context) {
  const { request } = context;
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
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

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept"
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders() }
  });
}

const SIGNS=["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
const PLANETS=["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];
const NATURAL_MALEFICS=new Set(["Sun","Mars","Saturn","Rahu","Ketu"]);
const NATURAL_BENEFICS=new Set(["Moon","Mercury","Jupiter","Venus"]);
const SIGN_LORDS={Aries:"Mars",Taurus:"Venus",Gemini:"Mercury",Cancer:"Moon",Leo:"Sun",Virgo:"Mercury",Libra:"Venus",Scorpio:"Mars",Sagittarius:"Jupiter",Capricorn:"Saturn",Aquarius:"Saturn",Pisces:"Jupiter"};
const DEBILITATION={Sun:"Libra",Moon:"Scorpio",Mars:"Cancer",Mercury:"Pisces",Jupiter:"Capricorn",Venus:"Virgo",Saturn:"Aries",Rahu:"Scorpio",Ketu:"Taurus"};

const DOMAINS = [
  { key:"identity", title:"Identity", group:"Foundation", houses:[1], karaka:"Sun", meaning:"This reflects self-confidence, direction, personal identity, and how steadily the native carries life decisions." },
  { key:"wealth", title:"Wealth", group:"Resources", houses:[2,11], karaka:"Jupiter", meaning:"This reflects earning support, ability to retain value, family-linked stability, and whether gains accumulate smoothly or irregularly." },
  { key:"marriage", title:"Marriage", group:"Relationships", houses:[7], karaka:"Venus", meaning:"This reflects partnership quality, cooperation, emotional reciprocity, and the ability to sustain one-to-one commitment." },
  { key:"career", title:"Career", group:"Work", houses:[10], karakaProvider:(p)=>getHouseLord(p.d1.lagna,10), meaning:"This reflects work direction, responsibility handling, public standing, and whether growth stabilises or keeps fluctuating." },
  { key:"restraint", title:"Restraint", group:"Stability", houses:[6,8,12], karaka:"Saturn", meaning:"This reflects pressure handling, damage control, discipline during setbacks, and whether the native reacts or responds under strain." },
  { key:"foreign", title:"Foreign Travel", group:"Movement", houses:[9,12], karaka:"Rahu", meaning:"This reflects long-distance movement, outside-place opportunity, and whether foreign connection remains temporary, useful, or durable." },
  { key:"health", title:"Health Sensitivity", group:"Care", houses:[1,6,8], karaka:"Sun", meaning:"This reflects how the body handles stress, recovery pattern, and whether imbalance shows as temporary strain or repeated sensitivity." }
];

function analyzePayload(payload){
  validatePayload(payload);

  const analyzed = DOMAINS.map(domain => {
    const karaka = domain.karakaProvider ? domain.karakaProvider(payload) : domain.karaka;
    const d1 = scoreLayer(payload.d1, domain.houses, karaka);
    const d9 = scoreLayer(payload.d9, domain.houses, karaka);
    const combined = combineLayers(domain, d1, d9);
    return { domain, karaka, d1, d9, ...combined };
  });

  const quickVerdict = analyzed.map(x => ({
    factor: x.domain.title,
    verdict: x.finalVerdict,
    meaning: x.quickMeaning
  }));

  const earlyLife = buildEarlyLife(analyzed);
  const laterLife = buildLaterLife(analyzed);
  const direction = buildDirection(analyzed);

  const comparison = analyzed.map(x => ({
    domain: x.domain.title,
    d1: labelWithShortMeaning(x.d1.label, x.domain.title, "early"),
    d9: labelWithShortMeaning(x.d9.label, x.domain.title, "later"),
    trend: x.trend,
    finalVerdict: x.finalVerdict
  }));

  const domainInsights = analyzed.map(x => ({
    group: x.domain.group,
    title: x.domain.title,
    status: x.finalVerdict,
    meaning: x.domain.meaning,
    insight: x.insight,
    feedback: x.feedback,
    watchpoints: x.watchpoints
  }));

  const why = analyzed.map(x => x.reasoning);

  const mahadashaWatch = buildMahadashaWatch(payload, analyzed);

  return { quickVerdict, earlyLife, laterLife, direction, comparison, domainInsights, why, mahadashaWatch };
}

function validatePayload(payload){
  if(!payload?.d1?.lagna || !payload?.d9?.lagna) throw new Error("Both D1 and D9 lagna signs are required.");
  ["d1","d9"].forEach(key => {
    const seen=[];
    for(let i=1;i<=12;i++) seen.push(...(payload[key].houses[i]||[]));
    PLANETS.forEach(planet => {
      const count = seen.filter(p=>p===planet).length;
      if(count !== 1) throw new Error(`${key.toUpperCase()} must contain ${planet} exactly once.`);
    });
  });
}

function scoreLayer(chart, houses, karaka){
  let score = 0;
  let support = 0;
  let pressure = 0;
  const notes = [];

  const karakaPos = locatePlanet(chart, karaka);
  if (karakaPos) {
    if ([1,4,5,7,9,10,11].includes(karakaPos.house)) { score += 1; support += 1; notes.push(`${karaka} sits in a usable house`); }
    if ([6,8,12].includes(karakaPos.house)) { score -= 1; pressure += 1; notes.push(`${karaka} sits in a pressure house`); }
    if (DEBILITATION[karaka] === karakaPos.sign) { score -= 1; pressure += 1; notes.push(`${karaka} is debilitated`); }
  }

  houses.forEach(house => {
    const occupants = chart.houses[house] || [];
    const lord = getHouseLord(chart.lagna, house);
    const lordPos = locatePlanet(chart, lord);
    const malefics = occupants.filter(p=>NATURAL_MALEFICS.has(p));
    const benefics = occupants.filter(p=>NATURAL_BENEFICS.has(p));
    if (benefics.length) { score += 1; support += 1; notes.push(`target house ${house} has helpful support`); }
    if (malefics.length >= 2) { score -= 1; pressure += 1; notes.push(`target house ${house} is under pressure`); }
    if (occupants.includes(karaka)) { score += 1; support += 1; notes.push(`${karaka} directly supports house ${house}`); }
    if (lordPos) {
      if (houses.includes(lordPos.house)) { score += 1; support += 1; notes.push(`house lord of ${house} supports its own domain`); }
      if ([6,8,12].includes(lordPos.house)) { score -= 1; pressure += 1; notes.push(`house lord of ${house} falls in a difficult zone`); }
    }
  });

  let label = "Medium";
  if (score >= 3) label = "Strong";
  else if (score <= -2) label = "Weak";
  else if (support > 0 && pressure > 0) label = "Mixed";

  return { score, label, support, pressure, notes };
}

function combineLayers(domain, d1, d9){
  let trend = "Stable";
  let finalVerdict = "Medium";

  if (d1.label === "Strong" && d9.label === "Strong") { trend = "Stable"; finalVerdict = "Strong"; }
  else if (d1.label === "Weak" && d9.label === "Strong") { trend = "Improves later"; finalVerdict = "Delayed"; }
  else if (d1.label === "Strong" && d9.label === "Weak") { trend = "Weakens later"; finalVerdict = "Early Advantage"; }
  else if (d1.label === "Weak" && d9.label === "Weak") { trend = "Strained"; finalVerdict = "Vulnerable"; }
  else if (d1.label === "Mixed" || d9.label === "Mixed") { trend = "Mixed progression"; finalVerdict = "Mixed"; }
  else if (d1.label === "Medium" && d9.label === "Strong") { trend = "Gradual improvement"; finalVerdict = "Medium"; }
  else if (d1.label === "Strong" && d9.label === "Medium") { trend = "Mostly stable"; finalVerdict = "Medium"; }
  else if (d1.label === "Medium" && d9.label === "Weak") { trend = "Loses support later"; finalVerdict = "Mixed"; }

  const insight = buildInsight(domain.title, d1.label, d9.label, trend);
  const feedback = buildFeedback(domain.key, finalVerdict, trend);
  const watchpoints = buildWatchpoints(domain.key, finalVerdict, trend);
  const quickMeaning = buildQuickMeaning(domain.title, finalVerdict, trend);
  const reasoning = buildReasoning(domain.title, d1.label, d9.label, trend);
  return { trend, finalVerdict, insight, feedback, watchpoints, quickMeaning, reasoning };
}

function buildQuickMeaning(title, verdict, trend){
  if (verdict === "Strong") return `${title} has support in both foundation and maturity, so this area is more likely to stay reliable rather than swing widely.`;
  if (verdict === "Delayed") return `${title} may not settle early, but it improves later when maturity, patience, or the right phase comes in.`;
  if (verdict === "Early Advantage") return `${title} can show early promise, but later phases need care so initial strength is not wasted by instability.`;
  if (verdict === "Vulnerable") return `${title} needs conscious handling because both early pattern and later durability show pressure.`;
  if (verdict === "Mixed") return `${title} is not denied, but one layer supports while the other layer delays or fluctuates, so results may come unevenly.`;
  return `${title} is workable, but it improves more through steady decisions than through speed or impulse.`;
}

function buildInsight(title, d1, d9, trend){
  if (trend === "Improves later") return `${title} starts with some unevenness or delay, but later life is more capable of carrying this area with stability.`;
  if (trend === "Weakens later") return `${title} may look easier or stronger early, but later life asks for better discipline to maintain what was gained.`;
  if (trend === "Mixed progression") return `${title} shows support in one layer and fluctuation in the other, so the native may experience both progress and inconsistency in phases.`;
  if (trend === "Strained") return `${title} carries pressure in both early and later layers, so this area needs deliberate care rather than casual handling.`;
  if (trend === "Stable") return `${title} shows support in both early and later pattern, making this one of the more reliable domains in the chart.`;
  return `${title} is not blocked, but it settles best when the native builds gradually instead of forcing quick outcomes.`;
}

function buildFeedback(key, verdict, trend){
  const map = {
    identity: {
      Strong: "Back decisions with consistency. Personal direction becomes stronger when you avoid second-guessing yourself after every setback.",
      Delayed: "Early confidence may build slowly. Do not compare your timeline with others; your steadiness matters more than fast self-projection.",
      "Early Advantage": "Avoid pride-based decisions. Early confidence needs grounding, otherwise later choices can become reactive.",
      Vulnerable: "Guard against self-doubt and impulsive identity shifts. Build a stable routine before taking major personal leaps.",
      Mixed: "Some phases will feel clear and some uncertain. Pause before major reinvention and let clarity build through repetition.",
      Medium: "You have usable direction, but it strengthens only when choices are followed through consistently."
    },
    wealth: {
      Strong: "Use discipline to convert earning support into retained value. Saving structure matters as much as income.",
      Delayed: "Wealth may accumulate later rather than early. Avoid frustration-based financial decisions and focus on gradual build-up.",
      "Early Advantage": "Early gains should not create overconfidence. Preserve and verify before expanding commitments.",
      Vulnerable: "Be conservative with risk, lending, and informal commitments. Weak retention matters more here than one-time gain.",
      Mixed: "Income or gains may come in phases. Protect what comes in during strong periods instead of spending as if the flow is permanent.",
      Medium: "Progress is workable, but money grows better through systems than through opportunistic decisions."
    },
    marriage: {
      Strong: "This area benefits from mutual respect and emotional consistency. Stable choices matter more than dramatic intensity.",
      Delayed: "Relationship stability may come later with maturity. Do not force commitment during confused emotional periods.",
      "Early Advantage": "Early connection can look promising, but later sustainability depends on better emotional discipline and communication.",
      Vulnerable: "Avoid rushing commitment under loneliness, pressure, or idealisation. Clarity is more important than speed.",
      Mixed: "Attraction or connection may come, but sustainability fluctuates. Choose partners who are steady, not merely exciting.",
      Medium: "Partnership is possible, but it works better with patience, realism, and clear expectations."
    },
    career: {
      Strong: "Build depth, not only visibility. This chart supports steady responsibility and long-term growth.",
      Delayed: "Career direction may become clearer later. Avoid frequent job changes made only out of frustration.",
      "Early Advantage": "A good start does not guarantee durable growth. Later progress depends on structure, patience, and role fit.",
      Vulnerable: "Do not make high-stakes career moves during emotionally charged phases. Build competence before escalation.",
      Mixed: "Career may show spurts of growth followed by pauses. Stay with roles that build substance, not only short-term excitement.",
      Medium: "Growth is workable, but it rewards persistence more than speed."
    },
    restraint: {
      Strong: "You can recover from pressure better than average when you stay disciplined. Calm response is a real strength here.",
      Delayed: "Pressure handling improves later. Early overreaction reduces progress, so give yourself time before acting under stress.",
      "Early Advantage": "Do not assume early recovery ability will always hold. Later phases need more conscious damage control.",
      Vulnerable: "This area needs the most maturity. Slow down before reacting during loss, conflict, or hidden stress.",
      Mixed: "Some stress phases are handled well; others can trigger overreaction. Build a pause pattern before major responses.",
      Medium: "You can manage setbacks, but not when acting instantly. Reflection before response matters here."
    },
    foreign: {
      Strong: "External movement or useful foreign linkage is well supported. Use it strategically, not as escapism.",
      Delayed: "Foreign or outside-place support may come later. Do not assume early lack of movement means the path is closed.",
      "Early Advantage": "Early travel or outside exposure may come, but durable settlement needs stronger planning later.",
      Vulnerable: "Do not base major relocation on impulse alone. External movement needs practical support, not only desire.",
      Mixed: "Travel or outside connection is possible, but its durability may vary. Separate excitement from realistic settlement planning.",
      Medium: "This area is workable, but movement becomes useful only when tied to purpose and structure."
    },
    health: {
      Strong: "General recovery improves when lifestyle remains consistent. Protect routine because routine is your multiplier.",
      Delayed: "Early sensitivity may be higher, but resilience improves later with discipline.",
      "Early Advantage": "Do not waste early vitality through neglect. Later health depends on habits formed now.",
      Vulnerable: "This area needs prevention, rhythm, and observation. Small neglect can become repeated strain.",
      Mixed: "Health can be fine in some phases and sensitive in others. Avoid treating temporary relief as full stability.",
      Medium: "The body is manageable, but it responds better to disciplined maintenance than to late correction."
    }
  };
  return (map[key] && map[key][verdict]) || "This area improves when decisions are calm, structured, and repeated consistently.";
}

function buildWatchpoints(key, verdict, trend){
  const generic = {
    identity:["Avoid identity shifts during emotional lows","Do not announce big personal moves before testing them","Repeat one routine until it becomes stable"],
    wealth:["Verify commitments before paying","Keep a cash buffer","Separate gain from spend impulse"],
    marriage:["Do not decide during emotional confusion","Watch for inconsistency, not only attraction","Clarify expectations early"],
    career:["Avoid impulse resignation","Check role clarity before joining","Build one core strength deeply"],
    restraint:["Pause before reacting to pressure","Do not escalate conflict on the same day","Let facts settle before response"],
    foreign:["Validate purpose before relocation","Check cost, visa, and support realistically","Do not confuse temporary excitement with durable settlement"],
    health:["Protect sleep and routine","Do not ignore recurring small signals","Consistency matters more than occasional correction"]
  };
  const items = [...(generic[key] || ["Stay consistent","Avoid haste","Check facts before acting"])];
  if (verdict === "Vulnerable") items.unshift("This area needs stricter discipline than average");
  if (verdict === "Delayed") items.unshift("Do not judge this area too early");
  if (verdict === "Early Advantage") items.unshift("Protect early gains from later instability");
  if (verdict === "Mixed") items.unshift("Expect uneven phases; plan for consistency");
  return items.slice(0,4);
}

function buildReasoning(title, d1Label, d9Label, trend){
  if (trend === "Improves later") return `${title} is not strongly settled in the early pattern, but the later-life layer carries better durability, so this area tends to improve with maturity.`;
  if (trend === "Weakens later") return `${title} shows better initial support than long-term durability, so early advantage needs disciplined follow-through to remain stable later.`;
  if (trend === "Mixed progression") return `${title} gets mixed because one layer helps while the other layer delays or fluctuates. This usually creates uneven progress rather than outright denial.`;
  if (trend === "Strained") return `${title} shows pressure in both early and later layers, so this domain needs deliberate care, not casual handling.`;
  if (trend === "Stable") return `${title} is supported in both the foundation and the maturity layer, which makes this area more dependable than average.`;
  return `${title} has some usable support, but it does not fully carry itself without steady choices and repeated effort.`;
}

function buildEarlyLife(analyzed){
  const lines = analyzed.map(x => {
    if (x.d1.label === "Strong") return `${x.domain.title}: early life shows a more usable starting base here.`;
    if (x.d1.label === "Weak") return `${x.domain.title}: early life may feel pressured, delayed, or inconsistent here.`;
    if (x.d1.label === "Mixed") return `${x.domain.title}: early life shows both support and fluctuation here.`;
    return `${x.domain.title}: early life is workable, but not effortless here.`;
  });
  return lines.join(" ");
}
function buildLaterLife(analyzed){
  const lines = analyzed.map(x => {
    if (x.d9.label === "Strong") return `${x.domain.title}: later life carries better durability and maturity here.`;
    if (x.d9.label === "Weak") return `${x.domain.title}: later life still needs care to keep this area stable.`;
    if (x.d9.label === "Mixed") return `${x.domain.title}: later life improves partly, but still fluctuates in phases.`;
    return `${x.domain.title}: later life is manageable here, provided decisions stay consistent.`;
  });
  return lines.join(" ");
}
function buildDirection(analyzed){
  const supportive = analyzed.filter(x => ["Strong","Delayed"].includes(x.finalVerdict)).length;
  const pressured = analyzed.filter(x => ["Vulnerable","Early Advantage"].includes(x.finalVerdict)).length;
  const cautionAreas = analyzed.filter(x => ["Vulnerable","Mixed","Early Advantage"].includes(x.finalVerdict)).map(x => x.domain.title);

  let ride = "Mixed ride";
  if (supportive >= 4 && pressured <= 1) ride = "Smoother ride";
  else if (pressured >= 3) ride = "Rougher ride";
  else if (analyzed.some(x=>x.finalVerdict==="Delayed")) ride = "Rough early, better later";

  const cautionText = cautionAreas.length ? `Key areas needing caution are ${cautionAreas.join(", ")}.` : `No major domain stands out as severely unstable.`;
  const impulseAreas = cautionAreas.length ? `Impulsiveness should be controlled especially in ${cautionAreas.slice(0,3).join(", ")}.` : `Impulsive choices should still be avoided, but no single area dominates the caution signal.`;

  return `${ride}. ${cautionText} ${impulseAreas} The chart becomes more usable when the native acts with discipline in weak domains and preserves gains in stronger ones.`;
}

function buildMahadashaWatch(payload, analyzed){
  const checks = [
    {planet:"Venus", area:"Marriage / partnership"},
    {planet:getHouseLord(payload.d1.lagna,10), area:"Career / karma"},
    {planet:"Moon", area:"Home / emotional steadiness"},
    {planet:"Sun", area:"Identity / vitality"},
    {planet:"Saturn", area:"Restraint / pressure handling"}
  ];
  const out = [];
  checks.forEach(item => {
    const pos = locatePlanet(payload.d1, item.planet);
    if (!pos) return;
    const reasons = [];
    if ([6,8,12].includes(pos.house)) reasons.push(`placed in house ${pos.house}`);
    if (DEBILITATION[item.planet] === pos.sign) reasons.push(`debilitated in ${pos.sign}`);
    const co = (payload.d1.houses[pos.house]||[]).filter(p => p!==item.planet && NATURAL_MALEFICS.has(p));
    if (co.length) reasons.push(`conjoined with ${co.join(", ")}`);
    if (reasons.length) {
      out.push({
        planet:item.planet,
        area:item.area,
        status:"Watch",
        reason:`${item.planet} becomes sensitive here because it is ${reasons.join("; ")}.`,
        feedback:`During ${item.planet} mahadasha, avoid impulsive decisions related to ${item.area.toLowerCase()}. Slow down, verify, and protect stability first.`
      });
    }
  });
  return out;
}

function labelWithShortMeaning(label, title, phase){
  const map = {
    Strong:`Strong — ${phase==="early"?"good starting support":"good durability later"}`,
    Weak:`Weak — ${phase==="early"?"uneven or pressured start":"continued pressure later"}`,
    Mixed:`Mixed — support with fluctuation`,
    Medium:`Medium — workable but effort-dependent`
  };
  return map[label] || `${label} — workable`;
}

function locatePlanet(chart, planet){
  for(let house=1; house<=12; house++){
    if((chart.houses[house]||[]).includes(planet)){
      return { house, sign: houseToSign(chart.lagna, house) };
    }
  }
  return null;
}
function getHouseLord(lagna, house){
  return SIGN_LORDS[houseToSign(lagna, house)];
}
function houseToSign(lagna, house){
  const i = SIGNS.indexOf(lagna);
  if (i < 0) throw new Error(`Unknown lagna sign: ${lagna}`);
  return SIGNS[(i + house - 1) % 12];
}

