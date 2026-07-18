import { useState, useEffect, useRef, useCallback } from "react";
import { Plane, Radio, BookOpen, TrendingUp, Bell, BellOff, Send, Gauge, Fuel, Award, ChevronRight, Check, X, RotateCcw, Sparkles, GraduationCap, Lock } from "lucide-react";

/* ---------------------------------------------------------------
   Compatibilité double environnement :
   - À l'intérieur de Claude (artifact) : window.storage existe déjà
     et l'appel IA passe directement par l'API Anthropic proxifiée.
   - Une fois déployé en vrai (Vercel...) : on bascule automatiquement
     sur localStorage pour la sauvegarde, et sur /api/chat (fonction
     serverless fournie) pour l'IA, qui protège ta clé API.
--------------------------------------------------------------- */
const IS_CLAUDE_ARTIFACT = typeof window !== "undefined" && !!window.storage;

if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key) {
      const v = localStorage.getItem(key);
      return v !== null ? { key, value: v, shared: false } : null;
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      return { key, value, shared: false };
    },
    async delete(key) {
      localStorage.removeItem(key);
      return { key, deleted: true, shared: false };
    },
    async list(prefix = "") {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
      return { keys, prefix, shared: false };
    },
  };
}

/* ---------------------------------------------------------------
   FLIGHT READY — Aviation English cockpit trainer
   Palette: deep instrument-panel navy + amber glow + teal secondary
   Signature: circular flight-gauge dials on the dashboard
--------------------------------------------------------------- */

const COLORS = {
  bg: "#0A1220",
  panel: "#121C2E",
  panelLight: "#1A2740",
  amber: "#F2A93B",
  amberDim: "#8A662A",
  teal: "#4FD1C5",
  text: "#E8EDF4",
  muted: "#7C8AA5",
  danger: "#E5484D",
  good: "#5FBF7A",
};

const LEXICON = [
  // Catégorie A - ATC
  { id: "a1", cat: "ATC", term: "Roger", pron: "RO-djeur", example: "Roger, descending to 3000 feet.", mnemo: "R = Roger dans l'ancien alphabet radio. Veut dire « bien reçu », pas « d'accord ».", fr: "Bien reçu" },
  { id: "a2", cat: "ATC", term: "Wilco", pron: "OUIL-cô", example: "Wilco, will report reaching.", mnemo: "Contraction de WILl COmply = « je vais le faire ».", fr: "Je vais le faire" },
  { id: "a3", cat: "ATC", term: "Negative", pron: "NÉ-ga-tiv", example: "Negative, unable to comply.", mnemo: "Jamais « no », trop faible dans le bruit radio.", fr: "Non" },
  { id: "a4", cat: "ATC", term: "Standby", pron: "STANE-baï", example: "Standby, I'm changing frequency.", mnemo: "« Reste en ligne » — patiente.", fr: "Attends" },
  { id: "a5", cat: "ATC", term: "Squawk", pron: "skwok", example: "Squawk 7000.", mnemo: "Le cri du canard = régler ton transpondeur.", fr: "Code transpondeur" },
  { id: "a6", cat: "ATC", term: "Cleared", pron: "klird", example: "Cleared for takeoff runway 27.", mnemo: "Sans ce mot, pas le droit d'agir.", fr: "Autorisé" },
  { id: "a7", cat: "ATC", term: "Taxi", pron: "TAK-si", example: "Taxi to holding point Alpha.", mnemo: "Roule au sol comme un taxi.", fr: "Rouler au sol" },
  { id: "a8", cat: "ATC", term: "Go around", pron: "gô a-RA-ounde", example: "Go around, traffic on runway.", mnemo: "Tu « fais un tour » au lieu d'atterrir.", fr: "Remise de gaz" },
  { id: "a9", cat: "ATC", term: "Final", pron: "FAÏ-neul", example: "Cessna GH, final runway 27.", mnemo: "Dernière ligne droite avant la piste.", fr: "Finale" },
  { id: "a10", cat: "ATC", term: "Traffic", pron: "TRA-fik", example: "Traffic in sight.", mnemo: "Jamais « plane » en phraséo stricte.", fr: "Trafic (autre avion)" },
  // Catégorie B - Météo
  { id: "b1", cat: "Météo", term: "METAR", pron: "MI-tar", example: "Latest METAR shows wind 270 at 10 knots.", mnemo: "MEteorological Aerodrome Report.", fr: "Bulletin météo" },
  { id: "b2", cat: "Météo", term: "Ceiling", pron: "SI-linngue", example: "Ceiling 2000 feet.", mnemo: "Le « plafond » nuageux.", fr: "Plafond nuageux" },
  { id: "b3", cat: "Météo", term: "Overcast", pron: "O-veur-KASTE", example: "Sky overcast at 1500 feet.", mnemo: "Ciel couvert comme un voile jeté.", fr: "Ciel couvert" },
  { id: "b4", cat: "Météo", term: "CAVOK", pron: "KA-vo-keye", example: "CAVOK.", mnemo: "Ceiling And Visibility OK.", fr: "Conditions parfaites" },
  { id: "b5", cat: "Météo", term: "Gusts", pron: "geusts", example: "Wind 280 at 15, gusting 25.", mnemo: "Rafales soudaines.", fr: "Rafales" },
  { id: "b6", cat: "Météo", term: "Turbulence", pron: "TEUR-bieu-leunce", example: "Moderate turbulence reported.", mnemo: "Secousses dues à l'air instable.", fr: "Turbulence" },
  { id: "b7", cat: "Météo", term: "Fog", pron: "fogue", example: "Fog reducing visibility to 200 meters.", mnemo: "Mot court à retenir vite.", fr: "Brouillard" },
  { id: "b8", cat: "Météo", term: "QNH", pron: "kiou-ène-étch", example: "QNH 1013.", mnemo: "Réglage altimétrique niveau mer.", fr: "Calage altimétrique" },
  { id: "b9", cat: "Météo", term: "Dew point", pron: "diou poïnte", example: "Temperature 15, dew point 12.", mnemo: "Écart faible = risque brouillard.", fr: "Point de rosée" },
  { id: "b10", cat: "Météo", term: "Wind shear", pron: "ouinde chir", example: "Wind shear reported on final.", mnemo: "Changement brutal de vent, dangereux à l'atterrissage.", fr: "Cisaillement de vent" },
  // Catégorie C - Urgences
  { id: "c1", cat: "Urgences", term: "Mayday", pron: "MÉÏ-déï", example: "Mayday, mayday, mayday, engine failure.", mnemo: "Du français « m'aider », répété 3 fois.", fr: "Détresse absolue" },
  { id: "c2", cat: "Urgences", term: "Pan-pan", pron: "PANNE-panne", example: "Pan-pan, pan-pan, pan-pan, minor fuel issue.", mnemo: "De « panne » en français.", fr: "Urgence sans danger immédiat" },
  { id: "c3", cat: "Urgences", term: "Engine failure", pron: "ÈNE-djine FÉÏ-lieur", example: "Engine failure, forced landing.", mnemo: "Les 2 mots les plus redoutés.", fr: "Panne moteur" },
  { id: "c4", cat: "Urgences", term: "Fire", pron: "faïeur", example: "Engine fire, shutting down.", mnemo: "Mot court, priorité absolue.", fr: "Feu" },
  { id: "c5", cat: "Urgences", term: "Evacuate", pron: "i-VA-kiou-éïte", example: "Evacuate the aircraft immediately.", mnemo: "Même racine qu'en français.", fr: "Évacuer" },
  { id: "c6", cat: "Urgences", term: "Brace position", pron: "bréïss po-ZI-cheune", example: "Brace, brace, brace!", mnemo: "Se cramponner avant impact.", fr: "Position de sécurité" },
  { id: "c7", cat: "Urgences", term: "Stall", pron: "stol", example: "Recovering from a stall.", mnemo: "L'avion « cale » comme un moteur.", fr: "Décrochage" },
  { id: "c8", cat: "Urgences", term: "Squawk 7700", pron: "skwok sèveune-sèveune-zi-ro-zi-ro", example: "Squawk 7700 for emergency.", mnemo: "Code universel de détresse.", fr: "Code transpondeur détresse" },
  { id: "c9", cat: "Urgences", term: "Checklist", pron: "TCHÈK-liste", example: "Running the emergency checklist.", mnemo: "Outil systématique en urgence.", fr: "Liste de vérification" },
  { id: "c10", cat: "Urgences", term: "Diversion", pron: "daï-VEUR-jeune", example: "Diverting to nearest airport.", mnemo: "Déroutement vers un autre terrain.", fr: "Déroutement" },
  // Catégorie D - Cockpit
  { id: "d1", cat: "Cockpit", term: "Yoke", pron: "yôke", example: "Pull back on the yoke.", mnemo: "« Joug », comme celui des bœufs.", fr: "Manche" },
  { id: "d2", cat: "Cockpit", term: "Throttle", pron: "THRO-teul", example: "Reduce throttle on final.", mnemo: "Évoque l'étranglement du débit d'air.", fr: "Manette des gaz" },
  { id: "d3", cat: "Cockpit", term: "Rudder", pron: "REU-deur", example: "Apply right rudder.", mnemo: "Contrôle le lacet de l'avion.", fr: "Palonnier" },
  { id: "d4", cat: "Cockpit", term: "Flaps", pron: "flapse", example: "Flaps 10 degrees.", mnemo: "« Flap » = battre, comme des ailes.", fr: "Volets" },
  { id: "d5", cat: "Cockpit", term: "Altimeter", pron: "al-TI-mi-teur", example: "Check the altimeter.", mnemo: "Préfixe « alti » évident.", fr: "Altimètre" },
  { id: "d6", cat: "Cockpit", term: "Landing gear", pron: "LANE-dinngue guir", example: "Landing gear down and locked.", mnemo: "Se dit facilement mot à mot.", fr: "Train d'atterrissage" },
  { id: "d7", cat: "Cockpit", term: "Autopilot", pron: "O-to-paï-leute", example: "Engage the autopilot.", mnemo: "Identique au français.", fr: "Pilote automatique" },
  { id: "d8", cat: "Cockpit", term: "Aileron", pron: "ÉÏ-leu-ronne", example: "Bank using ailerons.", mnemo: "Mot français d'origine, conservé tel quel.", fr: "Gouverne de gauchissement" },
  { id: "d9", cat: "Cockpit", term: "Fuselage", pron: "FIOU-zeu-laj", example: "Check the fuselage for damage.", mnemo: "Mot français conservé en anglais aéro.", fr: "Fuselage" },
  { id: "d10", cat: "Cockpit", term: "Preflight", pron: "PRI-flaïte", example: "Complete the preflight inspection.", mnemo: "Préfixe « avant » évident.", fr: "Avant-vol" },
  // Catégorie E - Cabin crew
  { id: "e1", cat: "Cabine", term: "Boarding", pron: "BOR-dinngue", example: "Boarding will begin shortly.", mnemo: "Monter « à bord ».", fr: "Embarquement" },
  { id: "e2", cat: "Cabine", term: "Overhead bin", pron: "O-veur-hèd binne", example: "Stow your bag in the overhead bin.", mnemo: "Compartiment au-dessus de la tête.", fr: "Coffre à bagages" },
  { id: "e3", cat: "Cabine", term: "Seatbelt sign", pron: "SITE-bèlte saïne", example: "The seatbelt sign is on.", mnemo: "Signal lumineux ceinture attachée.", fr: "Signal ceinture" },
  { id: "e4", cat: "Cabine", term: "Purser", pron: "PEUR-seur", example: "The purser will assist you.", mnemo: "Le chef de cabine.", fr: "Chef de cabine" },
  { id: "e5", cat: "Cabine", term: "Emergency exit", pron: "i-MEUR-djeune-si ÈG-zite", example: "Locate your nearest emergency exit.", mnemo: "Mots transparents à l'écrit.", fr: "Issue de secours" },
  { id: "e6", cat: "Cabine", term: "Fasten", pron: "FA-seune", example: "Fasten your seatbelt.", mnemo: "Mot clé des annonces cabine.", fr: "Attacher" },
  { id: "e7", cat: "Cabine", term: "Stow", pron: "stô", example: "Stow your tray table.", mnemo: "Ranger un objet.", fr: "Ranger" },
  { id: "e8", cat: "Cabine", term: "Disembark", pron: "di-sim-BARK", example: "Disembark via the front door.", mnemo: "Contraire de « embark ».", fr: "Débarquer" },
  { id: "e9", cat: "Cabine", term: "Lavatory", pron: "LA-va-to-ri", example: "The lavatory is occupied.", mnemo: "Terme formel, pas « toilet ».", fr: "Toilettes" },
  { id: "e10", cat: "Cabine", term: "Final call", pron: "FAÏ-neul kol", example: "Final call for flight AB123.", mnemo: "Dernier appel avant fermeture des portes.", fr: "Dernier appel" },
];

const CATEGORIES = ["ATC", "Météo", "Urgences", "Cockpit", "Cabine"];

const THEORY_CHAPTERS = [
  {
    id: "airlaw",
    num: 1,
    title: "Air Law",
    subtitle: "Réglementation aérienne",
    mappedCat: null,
    points: [
      "Airspace is divided into classes from A (most controlled) to G (uncontrolled) — as a PPL pilot you'll mostly fly in classes D, E and G.",
      "VFR (Visual Flight Rules) requires minimum visibility and cloud clearance depending on the airspace class.",
      "Every pilot must carry a valid licence, a medical certificate, and the aircraft's certificate of airworthiness.",
      "ATC clearance is mandatory in controlled airspace; in uncontrolled airspace you self-announce your position on the radio.",
      "NOTAMs (Notices to Airmen) warn pilots of temporary hazards or changes along their route.",
    ],
    quiz: [
      { q: "What does VFR stand for?", options: ["Visual Flight Rules", "Vertical Flight Route", "Variable Flight Radar", "Verified Flight Registration"], answer: "Visual Flight Rules" },
      { q: "Which document must every pilot carry along with their licence?", options: ["A medical certificate", "A hotel reservation", "A fuel receipt", "A weather report"], answer: "A medical certificate" },
      { q: "What is a NOTAM used for?", options: ["Warning of temporary hazards or changes", "Booking a runway slot", "Filing a tax return", "Ordering fuel"], answer: "Warning of temporary hazards or changes" },
    ],
  },
  {
    id: "meteo",
    num: 2,
    title: "Meteorology",
    subtitle: "Météorologie",
    mappedCat: "Météo",
    points: [
      "A METAR reports current conditions at an airfield; a TAF forecasts future conditions.",
      "Warm fronts bring gradual, layered clouds; cold fronts bring sudden, cumulus-type weather.",
      "Unstable air produces cumulus clouds and showers; stable air produces layered stratus clouds.",
      "QNH lets you read altitude above sea level; QFE gives height above the airfield.",
      "Icing risk increases near 0°C in visible moisture such as cloud or rain.",
    ],
    quiz: [
      { q: "Which one is a forecast, METAR or TAF?", options: ["TAF", "METAR", "Both", "Neither"], answer: "TAF" },
      { q: "What kind of weather does a cold front typically bring?", options: ["Sudden, cumulus-type weather", "Slow, layered clouds only", "Always clear skies", "Only fog"], answer: "Sudden, cumulus-type weather" },
      { q: "What does QNH allow you to read?", options: ["Altitude above sea level", "Height above the airfield only", "Wind speed", "Fuel remaining"], answer: "Altitude above sea level" },
    ],
  },
  {
    id: "nav",
    num: 3,
    title: "Navigation",
    subtitle: "Navigation aérienne",
    mappedCat: null,
    points: [
      "Heading is the direction the nose points; track is the actual path flown over the ground.",
      "Wind correction angle compensates for the drift caused by wind.",
      "A VOR ground station gives you a radial — a specific direction from the station.",
      "Dead reckoning estimates position using heading, speed and elapsed time.",
      "Always plan a diversion airfield in case of unexpected weather or fuel concerns.",
    ],
    quiz: [
      { q: "What is the difference between heading and track?", options: ["Heading is nose direction, track is path over ground", "They are always identical", "Heading is speed, track is altitude", "Track only exists in controlled airspace"], answer: "Heading is nose direction, track is path over ground" },
      { q: "What does a VOR station provide?", options: ["A radial (direction) from the station", "Fuel prices", "Cloud coverage", "Runway length"], answer: "A radial (direction) from the station" },
      { q: "Dead reckoning is based on which three elements?", options: ["Heading, speed and time", "Altitude, weight and fuel", "Wind, pressure and temperature", "Radio, transponder and GPS"], answer: "Heading, speed and time" },
    ],
  },
  {
    id: "aircraft",
    num: 4,
    title: "Aircraft General Knowledge",
    subtitle: "Cellule, moteur, systèmes",
    mappedCat: "Cockpit",
    points: [
      "A four-stroke piston engine cycle: intake, compression, power, exhaust.",
      "The magneto provides ignition independent of the aircraft's electrical system, as a safety backup.",
      "Flaps increase both lift and drag, allowing slower, steeper approaches.",
      "The pitot-static system feeds the airspeed indicator, altimeter and vertical speed indicator.",
      "Carburetor icing can occur even in warm, humid weather — not only near freezing.",
    ],
    quiz: [
      { q: "What are the four strokes of a piston engine cycle?", options: ["Intake, compression, power, exhaust", "Start, climb, cruise, land", "Fuel, air, spark, exhaust only", "Idle, taxi, takeoff, cruise"], answer: "Intake, compression, power, exhaust" },
      { q: "Why do light aircraft have magnetos?", options: ["Independent ignition backup from the electrical system", "To cool the engine", "To measure altitude", "To reduce weight"], answer: "Independent ignition backup from the electrical system" },
      { q: "Which instruments rely on the pitot-static system?", options: ["Airspeed indicator, altimeter, VSI", "Compass and clock only", "Fuel gauge and tachometer", "Radio and transponder"], answer: "Airspeed indicator, altimeter, VSI" },
    ],
  },
  {
    id: "human",
    num: 5,
    title: "Human Performance & Limitations",
    subtitle: "Facteurs humains",
    mappedCat: null,
    points: [
      "Hypoxia (lack of oxygen) impairs judgment before you even notice the symptoms.",
      "Fatigue can reduce reaction time and decision-making as much as alcohol.",
      "Spatial disorientation happens when your inner ear misleads you about your real attitude.",
      "The IMSAFE checklist (Illness, Medication, Stress, Alcohol, Fatigue, Emotion) helps assess fitness to fly.",
      "Even mild dehydration can subtly reduce concentration during long flights.",
    ],
    quiz: [
      { q: "What does the 'I' in IMSAFE stand for?", options: ["Illness", "Ice", "Instrument", "Intersection"], answer: "Illness" },
      { q: "What is hypoxia?", options: ["Lack of oxygen affecting judgment", "Fear of flying", "Excess fuel weight", "Loud engine noise"], answer: "Lack of oxygen affecting judgment" },
      { q: "What typically causes spatial disorientation?", options: ["Conflicting signals from your inner ear", "Low fuel", "High airspeed", "Bright sunlight only"], answer: "Conflicting signals from your inner ear" },
    ],
  },
  {
    id: "perf",
    num: 6,
    title: "Flight Performance & Planning",
    subtitle: "Performances et préparation du vol",
    mappedCat: null,
    points: [
      "Density altitude increases with heat, humidity and altitude, reducing engine and wing performance.",
      "Always calculate takeoff and landing distances with a safety margin.",
      "Weight and balance must stay within limits throughout the whole flight, including fuel burn.",
      "A fuel plan should always include reserves for diversion and unexpected delays.",
      "Performance charts assume standard conditions — always correct them for the real conditions of the day.",
    ],
    quiz: [
      { q: "What happens to performance as density altitude increases?", options: ["It decreases", "It increases", "It stays the same", "It only affects landing"], answer: "It decreases" },
      { q: "Why check weight and balance for the whole flight, not just departure?", options: ["Fuel burn changes the weight and balance over time", "It's only a legal formality", "The aircraft gets lighter and it doesn't matter", "Weight never changes in flight"], answer: "Fuel burn changes the weight and balance over time" },
      { q: "What should a fuel plan always include?", options: ["Reserves for diversion and delays", "Only enough fuel for the direct route", "No reserve, to save weight", "Fuel for the return flight only"], answer: "Reserves for diversion and delays" },
    ],
  },
  {
    id: "ops",
    num: 7,
    title: "Operational Procedures",
    subtitle: "Procédures opérationnelles",
    mappedCat: "Urgences",
    points: [
      "Always brief passengers on seatbelts, exits and emergency procedures before flight.",
      "Standard emergency radio calls are Mayday (distress) and Pan-pan (urgency).",
      "Checklists should be used for every phase: before start, before takeoff, before landing.",
      "After an engine failure, the priority order is: fly the aircraft, pick the best field, run the checklist, communicate.",
      "Always know your nearest suitable airfield during cruise flight, in case of a diversion.",
    ],
    quiz: [
      { q: "After engine failure, what is the FIRST priority?", options: ["Fly the aircraft (maintain control)", "Call Mayday immediately", "Run the checklist", "Contact your passengers"], answer: "Fly the aircraft (maintain control)" },
      { q: "Which call indicates a genuine distress situation?", options: ["Mayday", "Pan-pan", "Roger", "Standby"], answer: "Mayday" },
      { q: "When should checklists be used?", options: ["During every phase of flight", "Only during emergencies", "Only before takeoff", "Only after landing"], answer: "During every phase of flight" },
    ],
  },
  {
    id: "principles",
    num: 8,
    title: "Principles of Flight",
    subtitle: "Principes du vol",
    mappedCat: null,
    points: [
      "Lift is mainly generated by the pressure difference created by the wing's shape and angle of attack.",
      "Increasing angle of attack increases lift until the critical angle, where a stall occurs.",
      "The four forces acting on an aircraft are lift, weight, thrust and drag.",
      "Adverse yaw during a turn is corrected with coordinated rudder input.",
      "Load factor increases in turns, which raises the stall speed.",
    ],
    quiz: [
      { q: "What are the four forces acting on an aircraft in flight?", options: ["Lift, weight, thrust, drag", "Speed, altitude, heading, fuel", "Power, drag, wind, gravity only", "Thrust, drag, roll, pitch"], answer: "Lift, weight, thrust, drag" },
      { q: "What happens at the critical angle of attack?", options: ["A stall occurs", "The aircraft accelerates", "Flaps deploy automatically", "The engine stops"], answer: "A stall occurs" },
      { q: "Why does stall speed increase during a turn?", options: ["Increased load factor", "Decreased weight", "Increased altitude", "Reduced drag"], answer: "Increased load factor" },
    ],
  },
  {
    id: "comms",
    num: 9,
    title: "Communications & Aviation English",
    subtitle: "Communications et théorie de l'Aviation English",
    mappedCat: "ATC",
    points: [
      "ICAO language proficiency has 6 levels; Level 4 (Operational) is the minimum required for international flying.",
      "Standard phraseology avoids ambiguity: 'Affirm' and 'Negative' replace 'yes' and 'no'.",
      "Numbers are pronounced individually on the radio (e.g. 'three zero' for 30, not 'thirty').",
      "The phonetic alphabet (Alpha, Bravo, Charlie…) prevents letter confusion over noisy radios.",
      "A read-back is mandatory for runway, altitude and frequency instructions, to confirm understanding.",
    ],
    quiz: [
      { q: "What is the minimum ICAO language level required for international operations?", options: ["Level 4", "Level 1", "Level 6", "There is no minimum"], answer: "Level 4" },
      { q: "How should the number 30 be said on the radio?", options: ["Three zero", "Thirty", "Tree-zero-zero", "Thirteen"], answer: "Three zero" },
      { q: "Why is a phonetic alphabet used in radio communications?", options: ["To avoid confusion between similar-sounding letters", "To sound more professional only", "Because regular letters are forbidden", "To save time"], answer: "To avoid confusion between similar-sounding letters" },
    ],
  },
];

const GRADES = [
  { min: 0, name: "Student Pilot" },
  { min: 120, name: "Solo Pilot" },
  { min: 360, name: "PPL Holder" },
  { min: 900, name: "Commercial Pilot" },
  { min: 1800, name: "Captain" },
];

function gradeFor(minutes) {
  let g = GRADES[0].name;
  for (const step of GRADES) if (minutes >= step.min) g = step.name;
  return g;
}

function levelLabel(score) {
  if (score < 0.4) return "A1 — Débutant";
  if (score < 0.6) return "A2 — Élémentaire";
  if (score < 0.75) return "B1 — Intermédiaire";
  if (score < 0.9) return "B2 — Intermédiaire+";
  return "C1 — Avancé";
}

const defaultProfile = () => ({
  flightMinutes: 0,
  streak: 0,
  fuel: 100,
  lastActiveDay: null,
  badges: [],
  answers: [], // {correct: bool, cat, ts}
  knownWords: {}, // id -> {seen, correct}
  theoryCompleted: [],
  reminderHour: 19,
  reminderEnabled: false,
});

async function loadJSON(key, fallback) {
  try {
    const res = await window.storage.get(key);
    return res ? JSON.parse(res.value) : fallback;
  } catch {
    return fallback;
  }
}
async function saveJSON(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value));
  } catch (e) {
    console.error("storage error", e);
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/* ---------------- Gauge component (signature element) ---------------- */
function Gauge3({ value, max, label, unit, color, icon: Icon }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const angle = -120 + pct * 240;
  const r = 46;
  const cx = 60, cy = 60;
  const arc = (a1, a2) => {
    const toXY = (a) => [cx + r * Math.cos((Math.PI * a) / 180), cy + r * Math.sin((Math.PI * a) / 180)];
    const [x1, y1] = toXY(a1);
    const [x2, y2] = toXY(a2);
    const large = a2 - a1 > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width="120" height="110" viewBox="0 0 120 110">
        <path d={arc(150, 30)} stroke={COLORS.panelLight} strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d={arc(150, 150 + pct * 240)} stroke={color} strokeWidth="8" fill="none" strokeLinecap="round" />
        <line
          x1={cx}
          y1={cy}
          x2={cx + 34 * Math.cos((Math.PI * angle) / 180)}
          y2={cy + 34 * Math.sin((Math.PI * angle) / 180)}
          stroke={COLORS.text}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="4" fill={COLORS.text} />
        <text x={cx} y={cy + 30} textAnchor="middle" fill={COLORS.text} fontSize="14" fontFamily="ui-monospace, monospace" fontWeight="600">
          {Math.round(value)}{unit}
        </text>
      </svg>
      <div style={{ display: "flex", alignItems: "center", gap: 4, color: COLORS.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
        <Icon size={13} />
        {label}
      </div>
    </div>
  );
}

/* ---------------- Flashcard ---------------- */
function Flashcard({ item, onResult }) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => setFlipped(false), [item.id]);
  return (
    <div style={{ maxWidth: 420, margin: "0 auto" }}>
      <div
        onClick={() => setFlipped((f) => !f)}
        style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.panelLight}`,
          borderRadius: 16,
          padding: 28,
          minHeight: 180,
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 10,
          userSelect: "none",
        }}
      >
        <div style={{ fontSize: 11, color: COLORS.amber, textTransform: "uppercase", letterSpacing: 1.5 }}>{item.cat}</div>
        {!flipped ? (
          <>
            <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.text }}>{item.term}</div>
            <div style={{ color: COLORS.muted, fontFamily: "ui-monospace, monospace", fontSize: 14 }}>/{item.pron}/</div>
            <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 8 }}>Touche la carte pour voir la traduction et l'exemple ↴</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.teal }}>{item.fr}</div>
            <div style={{ color: COLORS.text, fontSize: 14, fontStyle: "italic" }}>"{item.example}"</div>
            <div style={{ color: COLORS.muted, fontSize: 13, marginTop: 6 }}>💡 {item.mnemo}</div>
          </>
        )}
      </div>
      {flipped && (
        <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "center" }}>
          <button onClick={() => onResult(false)} style={btnStyle(COLORS.danger)}>
            <X size={16} /> À revoir
          </button>
          <button onClick={() => onResult(true)} style={btnStyle(COLORS.good)}>
            <Check size={16} /> Je savais
          </button>
        </div>
      )}
    </div>
  );
}

function btnStyle(color) {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "transparent",
    border: `1.5px solid ${color}`,
    color,
    padding: "9px 18px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  };
}

/* ---------------- Daily quiz ---------------- */
function buildQuiz(profile) {
  const shuffled = [...LEXICON].sort(() => Math.random() - 0.5).slice(0, 5);
  return shuffled.map((item) => {
    const distractors = LEXICON.filter((w) => w.id !== item.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((w) => w.fr);
    const options = [...distractors, item.fr].sort(() => Math.random() - 0.5);
    return { item, options };
  });
}

/* =================================================================== */
export default function FlightReadyApp() {
  const [tab, setTab] = useState("dashboard");
  const [profile, setProfile] = useState(defaultProfile());
  const [loaded, setLoaded] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [chapterQuiz, setChapterQuiz] = useState(null);
  const [chapterQuizIndex, setChapterQuizIndex] = useState(0);
  const [chapterQuizFeedback, setChapterQuizFeedback] = useState(null);
  const [flashIndex, setFlashIndex] = useState(0);
  const [activeCat, setActiveCat] = useState("Tout");
  const [chatMode, setChatMode] = useState("auto");
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [notifStatus, setNotifStatus] = useState("default");
  const chatEndRef = useRef(null);

  // load persisted profile
  useEffect(() => {
    (async () => {
      const raw = await loadJSON("profile", defaultProfile());
      const p = { ...defaultProfile(), ...raw, answers: raw.answers || [], badges: raw.badges || [], theoryCompleted: raw.theoryCompleted || [], knownWords: raw.knownWords || {} };
      // decay fuel if a day was missed
      if (p.lastActiveDay && p.lastActiveDay !== todayStr()) {
        const last = new Date(p.lastActiveDay);
        const diffDays = Math.round((new Date(todayStr()) - last) / 86400000);
        if (diffDays > 1) {
          p.fuel = Math.max(0, p.fuel - (diffDays - 1) * 30);
          p.streak = 0;
        }
      }
      setProfile(p);
      setLoaded(true);
      if (typeof Notification !== "undefined") setNotifStatus(Notification.permission);
    })();
  }, []);

  const persist = useCallback((next) => {
    setProfile(next);
    saveJSON("profile", next);
  }, []);

  const registerActivity = useCallback(
    (minutesEarned) => {
      const next = { ...profile };
      const t = todayStr();
      if (next.lastActiveDay !== t) {
        next.streak = next.lastActiveDay ? next.streak + 1 : 1;
        next.fuel = Math.min(100, next.fuel + 15);
        next.lastActiveDay = t;
      }
      next.flightMinutes += minutesEarned;
      const newGrade = gradeFor(next.flightMinutes);
      if (!next.badges.includes(newGrade)) next.badges = [...next.badges, newGrade];
      persist(next);
    },
    [profile, persist]
  );

  const recordAnswer = useCallback(
    (correct, cat) => {
      const next = { ...profile, answers: [...profile.answers.slice(-99), { correct, cat, ts: Date.now() }] };
      persist(next);
    },
    [profile, persist]
  );

  const overallAccuracy = () => {
    if (!profile.answers.length) return 0.5;
    const recent = profile.answers.slice(-30);
    return recent.filter((a) => a.correct).length / recent.length;
  };

  const catAccuracy = (cat) => {
    const relevant = profile.answers.filter((a) => a.cat === cat);
    if (!relevant.length) return null;
    return relevant.filter((a) => a.correct).length / relevant.length;
  };

  // ---------- Notifications ----------
  const enableNotifications = async () => {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotifStatus(perm);
    const next = { ...profile, reminderEnabled: perm === "granted" };
    persist(next);
    if (perm === "granted") {
      new Notification("✈️ Flight Ready", { body: "Rappels activés. Ton créneau quotidien sera signalé pendant que l'onglet est ouvert." });
    }
  };

  useEffect(() => {
    if (!profile.reminderEnabled || typeof Notification === "undefined") return;
    const check = setInterval(() => {
      const now = new Date();
      if (now.getHours() === profile.reminderHour && now.getMinutes() === 0) {
        new Notification("✈️ Ton créneau de vol quotidien t'attend, Captain !", {
          body: profile.fuel < 40 ? "⛽ Carburant faible — un défi de 5 min avant minuit pour garder ta série." : "Un défi rapide pour progresser aujourd'hui.",
        });
      }
    }, 60000);
    return () => clearInterval(check);
  }, [profile.reminderEnabled, profile.reminderHour, profile.fuel]);

  // ---------- Quiz ----------
  const startQuiz = () => {
    setQuiz(buildQuiz(profile));
    setQuizIndex(0);
    setQuizFeedback(null);
    setTab("defis");
  };

  const answerQuiz = (opt) => {
    const q = quiz[quizIndex];
    const correct = opt === q.item.fr;
    setQuizFeedback({ correct, correctAnswer: q.item.fr });
    recordAnswer(correct, q.item.cat);
  };

  const nextQuizQuestion = () => {
    if (quizIndex + 1 >= quiz.length) {
      registerActivity(8);
      setQuiz(null);
      setQuizFeedback(null);
    } else {
      setQuizIndex((i) => i + 1);
      setQuizFeedback(null);
    }
  };

  // ---------- Theory chapters ----------
  const startChapterQuiz = (chapter) => {
    setChapterQuiz(chapter.quiz.map((q) => ({ ...q, options: [...q.options].sort(() => Math.random() - 0.5) })));
    setChapterQuizIndex(0);
    setChapterQuizFeedback(null);
  };

  const answerChapterQuiz = (opt) => {
    const q = chapterQuiz[chapterQuizIndex];
    const correct = opt === q.answer;
    setChapterQuizFeedback({ correct, correctAnswer: q.answer });
    recordAnswer(correct, selectedChapter.mappedCat || "Théorie");
  };

  const nextChapterQuestion = () => {
    if (chapterQuizIndex + 1 >= chapterQuiz.length) {
      const next = { ...profile };
      if (!next.theoryCompleted.includes(selectedChapter.id)) next.theoryCompleted = [...next.theoryCompleted, selectedChapter.id];
      persist(next);
      registerActivity(12);
      setChapterQuiz(null);
      setChapterQuizFeedback(null);
      setSelectedChapter(null);
    } else {
      setChapterQuizIndex((i) => i + 1);
      setChapterQuizFeedback(null);
    }
  };

  // ---------- Flashcards ----------
  const filteredLex = activeCat === "Tout" ? LEXICON : LEXICON.filter((w) => w.cat === activeCat);
  const currentCard = filteredLex[flashIndex % filteredLex.length];
  const onFlashResult = (known) => {
    recordAnswer(known, currentCard.cat);
    if (known) registerActivity(2);
    setFlashIndex((i) => i + 1);
  };

  // ---------- AI Cockpit chat ----------
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  const detectedLevel = levelLabel(overallAccuracy());

  const buildSystemContext = () => {
    const weak = CATEGORIES.filter((c) => {
      const acc = catAccuracy(c);
      return acc !== null && acc < 0.6;
    });
    const roleInstruction =
      chatMode === "atc"
        ? "Tu joues STRICTEMENT le rôle d'un contrôleur aérien (ATC) qui communique en phraséologie OACI standard avec un élève pilote."
        : chatMode === "instructor"
        ? "Tu joues le rôle d'un instructeur de vol bienveillant qui explique, corrige et encourage en anglais simple."
        : "Tu adaptes ton rôle automatiquement selon le contexte de la conversation : contrôleur ATC pour les communications radio, instructeur pédagogue pour les explications.";
    return `Tu es le module IA de l'app "Flight Ready", un simulateur d'anglais aéronautique pour un élève pilote PPL francophone débutant. ${roleInstruction}
Niveau détecté de l'élève (basé sur son historique de quiz) : ${detectedLevel}.
${weak.length ? `Catégories à renforcer en priorité : ${weak.join(", ")}.` : ""}
Règles impératives :
- Reste toujours en anglais dans ton rôle de simulation, mais tu peux ajouter de courtes explications en français entre crochets [comme ceci] si l'élève semble perdu ou fait une erreur.
- Adapte la difficulté de ton vocabulaire et la vitesse du scénario au niveau détecté : phrases courtes et vocabulaire simple pour A1-A2, plus fluide pour B1+.
- Corrige immédiatement toute erreur de phraséologie ou de syntaxe, explique la règle en une phrase, puis donne l'expression standard exacte.
- Sois concis : 2 à 5 phrases maximum par réponse, jamais un pavé.
- Ne sors jamais de ton rôle sauf si l'élève demande explicitement de l'aide hors-scénario.`;
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = { role: "user", content: chatInput.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setChatInput("");
    setChatLoading(true);
    try {
      const apiMessages = [
        { role: "user", content: buildSystemContext() },
        { role: "assistant", content: "Compris, je suis prêt à commencer la simulation dans ces conditions." },
        ...newMessages,
      ];
      const response = await fetch(IS_CLAUDE_ARTIFACT ? "https://api.anthropic.com/v1/messages" : "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: apiMessages,
        }),
      });
      const data = await response.json();
      const textBlocks = (data.content || []).filter((b) => b.type === "text").map((b) => b.text);
      const reply = textBlocks.join("\n") || "…";
      setMessages([...newMessages, { role: "assistant", content: reply }]);
      registerActivity(5);
    } catch (e) {
      setMessages([...newMessages, { role: "assistant", content: "⚠️ Erreur de connexion au module IA. Réessaie dans un instant." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const startScenario = (label, prompt) => {
    setMessages([{ role: "assistant", content: prompt }]);
  };

  if (!loaded) {
    return (
      <div style={{ background: COLORS.bg, height: 400, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.muted, fontFamily: "sans-serif" }}>
        Chargement du cockpit…
      </div>
    );
  }

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: Gauge },
    { id: "defis", label: "Défis du jour", icon: Award },
    { id: "lexique", label: "Lexique", icon: BookOpen },
    { id: "theorie", label: "Théorie", icon: GraduationCap },
    { id: "cockpit", label: "Cockpit IA", icon: Radio },
    { id: "progression", label: "Progression", icon: TrendingUp },
  ];

  return (
    <div
      style={{
        background: `radial-gradient(ellipse at top, ${COLORS.panel} 0%, ${COLORS.bg} 60%)`,
        minHeight: 600,
        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
        color: COLORS.text,
        borderRadius: 20,
        overflow: "hidden",
        border: `1px solid ${COLORS.panelLight}`,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: `1px solid ${COLORS.panelLight}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ background: COLORS.amber, borderRadius: 10, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Plane size={18} color={COLORS.bg} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: 0.3 }}>FLIGHT READY</div>
            <div style={{ fontSize: 11, color: COLORS.muted }}>{gradeFor(profile.flightMinutes)}</div>
          </div>
        </div>
        <button
          onClick={enableNotifications}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: profile.reminderEnabled ? "rgba(95,191,122,0.12)" : "transparent",
            border: `1px solid ${profile.reminderEnabled ? COLORS.good : COLORS.panelLight}`,
            color: profile.reminderEnabled ? COLORS.good : COLORS.muted,
            padding: "8px 14px",
            borderRadius: 999,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          {profile.reminderEnabled ? <Bell size={14} /> : <BellOff size={14} />}
          {profile.reminderEnabled ? "Rappels actifs (19h)" : "Activer les rappels"}
        </button>
      </div>

      {/* Nav */}
      <div style={{ display: "flex", gap: 4, padding: "10px 16px", overflowX: "auto", borderBottom: `1px solid ${COLORS.panelLight}` }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 10,
              border: "none",
              background: tab === t.id ? COLORS.panelLight : "transparent",
              color: tab === t.id ? COLORS.amber : COLORS.muted,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 24 }}>
        {/* -------- DASHBOARD -------- */}
        {tab === "dashboard" && (
          <div>
            <div style={{ display: "flex", gap: 28, justifyContent: "center", flexWrap: "wrap", padding: "12px 0 24px" }}>
              <Gauge3 value={profile.fuel} max={100} label="Carburant (régularité)" unit="%" color={COLORS.amber} icon={Fuel} />
              <Gauge3 value={profile.flightMinutes} max={1800} label="Heures de vol" unit="m" color={COLORS.teal} icon={Gauge} />
              <Gauge3 value={overallAccuracy() * 100} max={100} label="Précision récente" unit="%" color={COLORS.good} icon={TrendingUp} />
            </div>
            <div style={{ textAlign: "center", color: COLORS.muted, fontSize: 13, marginBottom: 20 }}>
              Niveau détecté par l'IA : <span style={{ color: COLORS.text, fontWeight: 700 }}>{detectedLevel}</span> · Série actuelle : {profile.streak} jour(s)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, maxWidth: 640, margin: "0 auto" }}>
              <ActionCard title="Défi du jour" desc="5 questions basées sur ton niveau réel" onClick={startQuiz} />
              <ActionCard title="Réviser le lexique" desc="Flashcards avec répétition espacée" onClick={() => setTab("lexique")} />
              <ActionCard title="Étudier la théorie" desc={`${profile.theoryCompleted.length}/${THEORY_CHAPTERS.length} chapitres validés`} onClick={() => setTab("theorie")} />
              <ActionCard title="Entrer dans le cockpit" desc="Discute avec l'IA (ATC / instructeur)" onClick={() => setTab("cockpit")} />
              <ActionCard title="Voir ma progression" desc="Stats par catégorie et badges" onClick={() => setTab("progression")} />
            </div>
            {profile.badges.length > 0 && (
              <div style={{ marginTop: 28, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Grades débloqués</div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                  {profile.badges.map((b) => (
                    <span key={b} style={{ background: COLORS.panelLight, color: COLORS.amber, padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                      🎖️ {b}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------- DÉFIS -------- */}
        {tab === "defis" && (
          <div>
            {!quiz && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <Sparkles size={28} color={COLORS.amber} style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 16, marginBottom: 16 }}>Prêt pour ton défi du jour ?</div>
                <button onClick={startQuiz} style={{ ...btnStyle(COLORS.amber), padding: "12px 28px", fontSize: 14 }}>
                  Lancer le défi <ChevronRight size={16} />
                </button>
              </div>
            )}
            {quiz && (
              <div style={{ maxWidth: 460, margin: "0 auto" }}>
                <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10 }}>Question {quizIndex + 1} / {quiz.length}</div>
                <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelLight}`, borderRadius: 16, padding: 24 }}>
                  <div style={{ fontSize: 11, color: COLORS.amber, textTransform: "uppercase", marginBottom: 8 }}>{quiz[quizIndex].item.cat}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{quiz[quizIndex].item.term}</div>
                  <div style={{ color: COLORS.muted, fontSize: 13, marginBottom: 18 }}>Que signifie ce mot ?</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {quiz[quizIndex].options.map((opt) => {
                      const showResult = !!quizFeedback;
                      const isCorrectOpt = opt === quiz[quizIndex].item.fr;
                      let bg = COLORS.panelLight;
                      if (showResult && isCorrectOpt) bg = "rgba(95,191,122,0.2)";
                      if (showResult && quizFeedback && !quizFeedback.correct && !isCorrectOpt) bg = COLORS.panelLight;
                      return (
                        <button
                          key={opt}
                          disabled={showResult}
                          onClick={() => answerQuiz(opt)}
                          style={{
                            textAlign: "left",
                            padding: "12px 16px",
                            borderRadius: 10,
                            border: `1px solid ${COLORS.panelLight}`,
                            background: bg,
                            color: COLORS.text,
                            cursor: showResult ? "default" : "pointer",
                            fontSize: 14,
                          }}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {quizFeedback && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ color: quizFeedback.correct ? COLORS.good : COLORS.danger, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
                        {quizFeedback.correct ? "✓ Correct !" : `✗ La bonne réponse était : ${quizFeedback.correctAnswer}`}
                      </div>
                      <button onClick={nextQuizQuestion} style={{ ...btnStyle(COLORS.amber), width: "100%", justifyContent: "center" }}>
                        {quizIndex + 1 >= quiz.length ? "Terminer le défi" : "Question suivante"} <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------- THÉORIE -------- */}
        {tab === "theorie" && (
          <div>
            {!selectedChapter && (
              <div style={{ maxWidth: 640, margin: "0 auto" }}>
                <div style={{ textAlign: "center", color: COLORS.muted, fontSize: 13, marginBottom: 20 }}>
                  Programme théorique complet, structuré comme le syllabus PPL officiel — {profile.theoryCompleted.length}/{THEORY_CHAPTERS.length} chapitres validés
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {THEORY_CHAPTERS.map((ch) => {
                    const done = profile.theoryCompleted.includes(ch.id);
                    return (
                      <button
                        key={ch.id}
                        onClick={() => setSelectedChapter(ch)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          background: COLORS.panel,
                          border: `1px solid ${done ? COLORS.good : COLORS.panelLight}`,
                          borderRadius: 14,
                          padding: "16px 20px",
                          cursor: "pointer",
                          textAlign: "left",
                          color: COLORS.text,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background: done ? "rgba(95,191,122,0.15)" : COLORS.panelLight,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: 13,
                              color: done ? COLORS.good : COLORS.muted,
                            }}
                          >
                            {done ? <Check size={16} /> : ch.num}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{ch.title}</div>
                            <div style={{ color: COLORS.muted, fontSize: 12 }}>{ch.subtitle}</div>
                          </div>
                        </div>
                        <ChevronRight size={16} color={COLORS.muted} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedChapter && !chapterQuiz && (
              <div style={{ maxWidth: 560, margin: "0 auto" }}>
                <button onClick={() => setSelectedChapter(null)} style={{ ...btnStyle(COLORS.muted), marginBottom: 16, fontSize: 12 }}>
                  ← Retour aux chapitres
                </button>
                <div style={{ fontSize: 11, color: COLORS.amber, textTransform: "uppercase", letterSpacing: 1.5 }}>
                  Chapitre {selectedChapter.num} · {selectedChapter.subtitle}
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 18 }}>{selectedChapter.title}</div>
                <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelLight}`, borderRadius: 16, padding: 22, display: "grid", gap: 14 }}>
                  {selectedChapter.points.map((p, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, fontSize: 14, lineHeight: 1.5 }}>
                      <span style={{ color: COLORS.teal, flexShrink: 0 }}>0{i + 1}</span>
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => startChapterQuiz(selectedChapter)}
                  style={{ ...btnStyle(COLORS.amber), width: "100%", justifyContent: "center", marginTop: 18, padding: "12px 0" }}
                >
                  Passer le skill test du chapitre <ChevronRight size={14} />
                </button>
              </div>
            )}

            {selectedChapter && chapterQuiz && (
              <div style={{ maxWidth: 460, margin: "0 auto" }}>
                <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10 }}>
                  Skill test · {selectedChapter.title} · Question {chapterQuizIndex + 1}/{chapterQuiz.length}
                </div>
                <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelLight}`, borderRadius: 16, padding: 24 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>{chapterQuiz[chapterQuizIndex].q}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {chapterQuiz[chapterQuizIndex].options.map((opt) => {
                      const showResult = !!chapterQuizFeedback;
                      const isCorrectOpt = opt === chapterQuiz[chapterQuizIndex].answer;
                      let bg = COLORS.panelLight;
                      if (showResult && isCorrectOpt) bg = "rgba(95,191,122,0.2)";
                      return (
                        <button
                          key={opt}
                          disabled={showResult}
                          onClick={() => answerChapterQuiz(opt)}
                          style={{
                            textAlign: "left",
                            padding: "12px 16px",
                            borderRadius: 10,
                            border: `1px solid ${COLORS.panelLight}`,
                            background: bg,
                            color: COLORS.text,
                            cursor: showResult ? "default" : "pointer",
                            fontSize: 13.5,
                          }}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {chapterQuizFeedback && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ color: chapterQuizFeedback.correct ? COLORS.good : COLORS.danger, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
                        {chapterQuizFeedback.correct ? "✓ Correct !" : `✗ Réponse correcte : ${chapterQuizFeedback.correctAnswer}`}
                      </div>
                      <button onClick={nextChapterQuestion} style={{ ...btnStyle(COLORS.amber), width: "100%", justifyContent: "center" }}>
                        {chapterQuizIndex + 1 >= chapterQuiz.length ? "Valider le chapitre" : "Question suivante"} <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------- LEXIQUE -------- */}
        {tab === "lexique" && (
          <div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
              {["Tout", ...CATEGORIES].map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setActiveCat(c);
                    setFlashIndex(0);
                  }}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 999,
                    border: `1px solid ${activeCat === c ? COLORS.amber : COLORS.panelLight}`,
                    background: activeCat === c ? "rgba(242,169,59,0.12)" : "transparent",
                    color: activeCat === c ? COLORS.amber : COLORS.muted,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
            <Flashcard item={currentCard} onResult={onFlashResult} />
            <div style={{ textAlign: "center", marginTop: 14, color: COLORS.muted, fontSize: 12 }}>
              Carte {(flashIndex % filteredLex.length) + 1} / {filteredLex.length}
            </div>
          </div>
        )}

        {/* -------- COCKPIT IA -------- */}
        {tab === "cockpit" && (
          <div style={{ display: "flex", flexDirection: "column", height: 480 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {[
                { id: "auto", label: "Auto (ATC + Instructeur)" },
                { id: "atc", label: "Contrôleur ATC" },
                { id: "instructor", label: "Instructeur" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setChatMode(m.id)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: `1px solid ${chatMode === m.id ? COLORS.teal : COLORS.panelLight}`,
                    background: chatMode === m.id ? "rgba(79,209,197,0.12)" : "transparent",
                    color: chatMode === m.id ? COLORS.teal : COLORS.muted,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {messages.length === 0 && (
              <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 4 }}>Choisis un scénario pour démarrer :</div>
                {[
                  ["🟢 Taxi & décollage simple", "You are a student pilot ready to start your engine at a small non-towered airfield. I'll be your instructor and the tower. Start by calling ground for taxi clearance."],
                  ["🟡 Tour de piste complet", "You are flying a full circuit at a non-towered airfield. I'll play ATC and your instructor. Report ready for departure when you are."],
                  ["🟠 Lecture d'un METAR", "I'll give you a real METAR to decode. Ready? Here it is: METAR EGLL 181250Z 24012KT 9999 FEW030 18/12 Q1015 NOSIG. Tell me what it means, in your own words."],
                  ["🔴 Petite urgence en vol", "You're cruising at 3000ft when you notice a rough-running engine. I'll play your instructor coaching you through a pan-pan call. Tell me what you'd say first."],
                ].map(([label, prompt]) => (
                  <button key={label} onClick={() => startScenario(label, prompt)} style={{ ...btnStyle(COLORS.amber), justifyContent: "flex-start" }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div style={{ flex: 1, overflowY: "auto", background: COLORS.panel, border: `1px solid ${COLORS.panelLight}`, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    background: m.role === "user" ? COLORS.teal : COLORS.panelLight,
                    color: m.role === "user" ? COLORS.bg : COLORS.text,
                    padding: "10px 14px",
                    borderRadius: 12,
                    maxWidth: "80%",
                    fontSize: 14,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.content}
                </div>
              ))}
              {chatLoading && <div style={{ color: COLORS.muted, fontSize: 13 }}>L'IA rédige sa réponse…</div>}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Réponds en anglais…"
                style={{
                  flex: 1,
                  background: COLORS.panelLight,
                  border: `1px solid ${COLORS.panelLight}`,
                  borderRadius: 999,
                  padding: "12px 16px",
                  color: COLORS.text,
                  fontSize: 14,
                  outline: "none",
                }}
              />
              <button onClick={sendMessage} disabled={chatLoading} style={{ ...btnStyle(COLORS.amber), borderRadius: 999, padding: "10px 16px" }}>
                <Send size={16} />
              </button>
            </div>
          </div>
        )}

        {/* -------- PROGRESSION -------- */}
        {tab === "progression" && (
          <div style={{ maxWidth: 520, margin: "0 auto" }}>
            <div style={{ fontSize: 14, color: COLORS.muted, marginBottom: 16, textAlign: "center" }}>
              Niveau détecté global : <span style={{ color: COLORS.text, fontWeight: 700 }}>{detectedLevel}</span>
            </div>
            {CATEGORIES.map((c) => {
              const acc = catAccuracy(c);
              return (
                <div key={c} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span>{c}</span>
                    <span style={{ color: COLORS.muted }}>{acc === null ? "Pas encore de données" : `${Math.round(acc * 100)}%`}</span>
                  </div>
                  <div style={{ background: COLORS.panelLight, borderRadius: 999, height: 8, overflow: "hidden" }}>
                    <div style={{ width: `${(acc ?? 0) * 100}%`, height: "100%", background: acc && acc > 0.7 ? COLORS.good : COLORS.amber }} />
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 24, textAlign: "center", color: COLORS.muted, fontSize: 13 }}>
              <RotateCcw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
              {profile.answers.length} réponses enregistrées au total
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionCard({ title, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.panelLight}`,
        borderRadius: 14,
        padding: 18,
        textAlign: "left",
        cursor: "pointer",
        color: COLORS.text,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{title}</div>
      <div style={{ color: COLORS.muted, fontSize: 12 }}>{desc}</div>
    </button>
  );
}
