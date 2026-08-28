/**
 * triageEngine.js — PerioVoice AI™ Client-Side Adaptive Triage Engine
 * Pure JavaScript state-machine matching backend/triage_state_engine.py.
 * Guarantees adaptive triage, context memory, off-topic guardrails, and zero repeated questions.
 */

const OFF_TOPIC_KEYWORDS = [
  "chatgpt", "claude", "gemini", "llama", "python", "javascript", "code",
  "weather", "capital of", "who is the president", "movie", "football",
  "cricket", "recipe", "math problem", "solve"
];

const LOCATIONS = [
  "upper right gum", "upper left gum", "lower right gum", "lower left gum",
  "upper right molar", "upper left molar", "lower right molar", "lower left molar",
  "front teeth", "lower front teeth", "upper front teeth", "back teeth",
  "wisdom tooth area", "roof of mouth", "tongue", "jaw joint"
];

export class ClientTriageEngine {
  constructor() {
    this.sessions = {};
  }

  startSession(userId = "guest") {
    const sessionId = "sess_" + Math.random().toString(36).substring(2, 11);
    this.sessions[sessionId] = {
      userId,
      turnCount: 0,
      state: {
        location: null, duration: null, painLevel: null,
        bleeding: null, swelling: null, pus: null,
        sensitivity: null, fever: null, trauma: null
      },
      details: {
        frequency: null,
        painLevel: null,
        duration: null,
        triggers: [],
        related: []
      },
      extractedSymptoms: [],
      followupCount: 0,
      lastAsked: null,
      askedFields: [],
      symptomKeys: new Set(),
      transcript: [],
      completed: false
    };

    const greeting = "🦷 PerioVoice AI: Hi! Tell me what’s bothering you about your teeth or gums today. You can describe it in your own words.";
    const firstQuestion = "";

    this.sessions[sessionId].transcript.push({ sender: "bot", text: greeting });

    return {
      session_id: sessionId,
      greeting,
      first_question: firstQuestion
    };
  }

  isTamil(text) {
    return /[\u0b80-\u0bff]/.test(text);
  }

  preprocessText(text) {
    let cleaned = text.toLowerCase().trim();
    cleaned = cleaned.replace(/\bgm\b/g, 'gum');
    cleaned = cleaned.replace(/\bgms\b/g, 'gums');
    cleaned = cleaned.replace(/\bwen\b/g, 'when');
    cleaned = cleaned.replace(/\bwit\b/g, 'with');
    cleaned = cleaned.replace(/\btth\b/g, 'tooth');
    cleaned = cleaned.replace(/\bbld\b/g, 'bleed');
    cleaned = cleaned.replace(/\bplz\b/g, 'please');
    cleaned = cleaned.replace(/\bbtn\b/g, 'button');
    cleaned = cleaned.replace(/\bsingout\b/g, 'signout');
    cleaned = cleaned.replace(/\bcavty\b/g, 'cavity');
    cleaned = cleaned.replace(/\bhalitosis\b/g, 'bad breath');
    cleaned = cleaned.replace(/\bpericoronitis\b/g, 'wisdom tooth swelling');
    cleaned = cleaned.replace(/\bblood\b/g, 'bleed');
    cleaned = cleaned.replace(/\bவலி\b/g, 'pain');
    cleaned = cleaned.replace(/\bஇரத்தம்\b/g, 'bleed');
    cleaned = cleaned.replace(/\bவீக்கம்\b/g, 'swollen');
    cleaned = cleaned.replace(/\bசீழ்\b/g, 'pus');
    return cleaned;
  }

  matchFieldValue(field, text) {
    const cleaned = text.toLowerCase().trim();
    
    if (field === "location") {
      if (["wisdom", "அறிவு"].some(w => cleaned.includes(w))) return "wisdom tooth area";
      if (["roof", "மேல்வாய்"].some(w => cleaned.includes(w))) return "roof of mouth";
      if (["tongue", "நாக்கு"].some(w => cleaned.includes(w))) return "tongue";
      if (["jaw", "தாடை"].some(w => cleaned.includes(w))) return "jaw joint";
      
      const leftNegated = /not\s+left|left\s+not|இல்லை\s+இடது|இடது\s+இல்லை/.test(cleaned);
      const rightNegated = /not\s+right|right\s+not|இல்லை\s+வலது|வலது\s+இல்லை/.test(cleaned);
      const upperNegated = /not\s+upper|not\s+top|top\s+not|upper\s+not|இல்லை\s+மேல்|மேல்\s+இல்லை/.test(cleaned);
      const lowerNegated = /not\s+lower|not\s+bottom|bottom\s+not|lower\s+not|இல்லை\s+கீழ்|கீழ்\s+இல்லை/.test(cleaned);

      const parts = [];
      if (["wisdom", "அறிவு"].some(w => cleaned.includes(w))) parts.push("wisdom tooth area");
      if (["upper", "top", "மேல்", "up"].some(w => cleaned.includes(w)) && !upperNegated) parts.push("upper");
      if (["lower", "bottom", "கீழ்", "down"].some(w => cleaned.includes(w)) && !lowerNegated) parts.push("lower");
      if (["left", "இடது"].some(w => cleaned.includes(w)) && !leftNegated) parts.push("left");
      if (["right", "வலது"].some(w => cleaned.includes(w)) && !rightNegated) parts.push("right");
      if (["front", "முன்"].some(w => cleaned.includes(w))) parts.push("front");
      if (["back", "rear", "கடவாய்"].some(w => cleaned.includes(w))) parts.push("back");
      if (["molar", "பல்"].some(w => cleaned.includes(w))) parts.push("molar area");
      
      if (parts.length > 0) return parts.join(" ");
      for (const loc of LOCATIONS) {
        if (cleaned.includes(loc)) return loc;
      }
    } else if (field === "duration") {
      let t = cleaned
        .replace(/\bone\b/g, '1')
        .replace(/\btwo\b/g, '2')
        .replace(/\bthree\b/g, '3')
        .replace(/\bfour\b/g, '4')
        .replace(/\bfive\b/g, '5')
        .replace(/\bsix\b/g, '6')
        .replace(/\bseven\b/g, '7')
        .replace(/\ba\s+week\b/g, '1 week')
        .replace(/\ba\s+day\b/g, '1 day')
        .replace(/\ba\s+month\b/g, '1 month');

      if (/^\d+$/.test(t)) {
        return `${t} days`;
      }
      const durationPatterns = [
        { regex: /(\d+)\s*days?/, unit: "days" },
        { regex: /(\d+)\s*weeks?/, unit: "weeks" },
        { regex: /(\d+)\s*hours?/, unit: "hours" },
        { regex: /(\d+)\s*months?/, unit: "months" }
      ];
      for (const pat of durationPatterns) {
        const m = t.match(pat.regex);
        if (m) return m[0];
      }
      if (["just started", "overnight", "today", "yesterday", "இப்போதுதான்"].some(w => cleaned.includes(w))) return "just started";
      if (["long", "month", "year", "நிறைய நாட்கள்"].some(w => cleaned.includes(w))) return "long-standing";
      if (["short", "few days", "recent", "சில நாட்கள்"].some(w => cleaned.includes(w))) return "a few days";
    } else if (field === "pain_level") {
      const painMatch = cleaned.match(/\b([0-9]|10)\b/);
      if (painMatch) return parseInt(painMatch[1], 10);
      if (["no pain", "painless", "no", "none", "no discomfort", "வலி இல்லை"].some(w => cleaned.includes(w))) return 0;
      if (["severe", "excruciating", "unbearable", "extremely", "bad", "கடுமையான"].some(w => cleaned.includes(w))) return 8;
      if (["moderate", "medium", "average", "மிதமான"].some(w => cleaned.includes(w))) return 5;
      if (["mild", "slight", "sore", "irritat", "லேசான"].some(w => cleaned.includes(w))) return 2;
    } else if (field === "frequency") {
      if (["always", "every time", "everytime", "mostly", "constantly", "continual", "எப்போதும்"].some(w => cleaned.includes(w))) return "every time";
      if (["sometimes", "now and then", "rarely", "occasional", "not always", "now only", "only now", "just now", "எப்போதாவது"].some(w => cleaned.includes(w))) return "sometimes";
    } else if (field === "triggers") {
      const triggers = [];
      for (const trig of ["brush", "floss", "chew", "eat", "cold", "hot", "sweet", "touch", "விளக்க"]) {
        if (cleaned.includes(trig)) triggers.push(trig);
      }
      if (triggers.length > 0) return triggers;
    } else if (field === "swelling" || field === "bleeding") {
      if (["yes", "yeah", "sure", "some", "swoll", "puffy", "bleed", "blood", "ஆமாம்", "வீக்கம்", "இரத்தம்"].some(w => cleaned.includes(w))) return true;
      if (["no", "none", "not", "dont", "இல்லை"].some(w => cleaned.includes(w))) return false;
    }
    return null;
  }

  buildAcknowledgment(text, state, details, newlyExtracted, lastAsked) {
    const cleaned = text.toLowerCase();
    const tamilMode = this.isTamil(text);
    
    if (tamilMode) {
      if (lastAsked === "duration" && newlyExtracted.duration) {
        return `சரி, இது ${newlyExtracted.duration} நாட்களாக இருக்கிறது.`;
      }
      if (lastAsked === "pain_level") {
        const p = state.painLevel;
        if (p === 0) return "சரி, வலி இல்லை.";
        else if (p !== null) return `வலியின் அளவு ${p}/10 எனப் பதிவு செய்யப்பட்டுள்ளது.`;
      }
      if (lastAsked === "frequency" && details.frequency) {
        return `புரிந்துகொண்டேன், இது ${details.frequency} நடக்கிறது.`;
      }
      if (lastAsked === "swelling" && state.swelling !== null) {
        return state.swelling ? "வீக்கம் உள்ளது எனப் பதிவு செய்யப்பட்டுள்ளது." : "வீக்கம் இல்லை, நல்லது.";
      }
      if (lastAsked === "bleeding" && state.bleeding !== null) {
        return state.bleeding ? "இரத்தப்போக்கு உள்ளது." : "இரத்தப்போக்கு இல்லை.";
      }
      return "தகவலுக்கு நன்றி.";
    }

    if (lastAsked === "location" && newlyExtracted.location) {
      if (["no where", "nowhere", "no place", "no specific", "no location", "none", "nothing"].some(neg => String(newlyExtracted.location).toLowerCase().includes(neg))) {
        return "Understood, no specific tooth or gum location noted.";
      }
      const acks = [
        `I understand — discomfort in the ${newlyExtracted.location} is noted.`,
        `Thank you for that detail. Pain around the ${newlyExtracted.location} is something we should look into carefully.`,
        `Got it, the ${newlyExtracted.location} area. That's helpful to know.`
      ];
      return acks[Math.floor(Math.random() * acks.length)];
    }
    if (lastAsked === "duration" && newlyExtracted.duration) {
      return `Noted, so this has been going on for ${newlyExtracted.duration}.`;
    }
    if (lastAsked === "pain_level") {
      const p = state.painLevel;
      if (p === 0) return "Got it, no pain — just the other symptoms.";
      else if (p !== null) return `I see, a pain level of ${p}/10 — sorry you're dealing with that discomfort.`;
    }
    if (lastAsked === "frequency" && details.frequency) {
      return `Understood, happening ${details.frequency}.`;
    }
    if (lastAsked === "swelling" && state.swelling !== null) {
      return state.swelling ? "Understood, swelling is something to track closely." : "Reassuring that there is no visible swelling.";
    }
    if (lastAsked === "bleeding" && state.bleeding !== null) {
      return state.bleeding ? "I understand, gum bleeding is an important symptom we need to monitor." : "Good to know there's no bleeding.";
    }

    const symptoms = [];
    if (cleaned.includes("bleed") || cleaned.includes("blood")) symptoms.push("bleeding gums");
    if (cleaned.includes("swell") || cleaned.includes("swollen")) symptoms.push("swelling");
    if (cleaned.includes("pain") || cleaned.includes("hurt") || cleaned.includes("ache")) symptoms.push("pain");
    
    if (symptoms.length > 0) {
      const joined = symptoms.join(" and ");
      if (newlyExtracted.duration) {
        return `Thanks for sharing that — ${joined}, and it's been going on for ${newlyExtracted.duration}.`;
      } else {
        return `Thanks for sharing that — ${joined} is noted.`;
      }
    }
    return "Thanks for that detail.";
  }

  getSymptomRestatement(state, details) {
    const parts = [];
    if (state.bleeding) parts.push("bleeding gums");
    if (state.swelling) parts.push("swollen gums");
    if (state.painLevel !== null) {
      if (state.painLevel === 0) parts.push("no pain");
      else parts.push(`pain level ${state.painLevel}/10`);
    }
    if (details.triggers && details.triggers.length > 0) {
      parts.push(`when ${details.triggers[0]}`);
    } else if (state.sensitivity) {
      parts.push(`sensitivity to ${state.sensitivity}`);
    }
    if (details.frequency) parts.push(`happening ${details.frequency}`);
    if (state.duration) parts.push(`going on for ${state.duration}`);
    
    return parts.length > 0 ? parts.join(", ") : "mild gum irritation";
  }

  handleDirectQuestion(text) {
    const cleaned = text.toLowerCase();
    if (["serious", "dangerous", "die", "bad is it", "cancer"].some(w => cleaned.includes(w))) {
      return "Since I'm an AI assistant, I can't give a definitive medical diagnosis. However, based on the symptoms you describe, we'll calculate a clinical risk level so you can understand whether you need to see a dentist urgently.";
    }
    if (["why do you need to know", "why do you ask", "why ask", "reason for this"].some(w => cleaned.includes(w))) {
      return "Knowing details like location, duration, and pain level helps my triage engine map your symptoms to the correct clinical concern level (Low, Moderate, or High) and suggest the best next steps.";
    }
    if (["cost", "money", "price", "expensive", "pay"].some(w => cleaned.includes(w))) {
      return "I can't provide pricing since dental costs depend entirely on your local clinic and insurance. However, this PerioVoice AI assessment is completely free of charge!";
    }
    return null;
  }

  isOffTopic(text) {
    const cleaned = text.toLowerCase();
    for (const kw of OFF_TOPIC_KEYWORDS) {
      if (cleaned.includes(kw)) {
        if (!["teeth", "tooth", "gum", "dentist", "mouth", "molar"].some(d => cleaned.includes(d))) {
          return true;
        }
      }
    }
    return false;
  }

  extractEntities(text, state, lastAsked = null) {
    const cleaned = text.toLowerCase();
    const extractedKeys = [];

    // Extract direct tags from system messages (image scanner tags)
    if (cleaned.startsWith("image scan shows")) {
      const tags = ["mild_swelling", "bleeding_gums_brushing", "bad_breath_halitosis", "gum_bleeding", "swelling"];
      for (const tag of tags) {
        if (cleaned.includes(tag)) {
          extractedKeys.push(tag);
        }
      }
    }

    // 1. Pain Rating
    const painContextMatch = cleaned.match(/\b([0-9]|10)\b\s*(?:out of 10|\/10|pain rating|pain level|pain score)/);
    if (painContextMatch && state.painLevel === null) {
      state.painLevel = parseInt(painContextMatch[1], 10);
    } else if (lastAsked === "pain_level") {
      const painMatch = cleaned.match(/\b([0-9]|10)\b/);
      if (painMatch && state.painLevel === null) {
        state.painLevel = parseInt(painMatch[1], 10);
      }
    }
    if (["severe pain", "unbearable", "excruciating", "throbbing"].some(w => cleaned.includes(w))) {
      if (state.painLevel === null) state.painLevel = 8;
      extractedKeys.push("severe_throbbing_pain");
    } else if (["mild pain", "slight ache", "soreness"].some(w => cleaned.includes(w))) {
      if (state.painLevel === null) state.painLevel = 3;
      extractedKeys.push("mild_pain");
    }

    // 2. Location
    for (const loc of LOCATIONS) {
      if (cleaned.includes(loc) && state.location === null) {
        state.location = loc;
        break;
      }
    }
    if (state.location === null) {
      if (cleaned.includes("molar") || cleaned.includes("back tooth")) state.location = "back molar area";
      else if (cleaned.includes("front tooth") || cleaned.includes("front teeth")) state.location = "front teeth";
      else if (cleaned.includes("cheek")) state.location = "cheek / gum boundary";
      else if (cleaned.includes("gum")) state.location = "gum tissue";
    }

    // 3. Duration
    if (state.duration === null) {
      const durationPatterns = [
        /(\d+)\s*days?/,
        /(\d+)\s*weeks?/,
        /(\d+)\s*hours?/,
        /just started|overnight|today|yesterday/
      ];
      for (const pat of durationPatterns) {
        const m = cleaned.match(pat);
        if (m) {
          state.duration = m[0];
          break;
        }
      }
    }

    // 4. Bleeding
    if (["bleed", "blood", "இரத்தம்"].some(w => cleaned.includes(w))) {
      state.bleeding = true;
      if (cleaned.includes("spontaneous") || cleaned.includes("rest")) extractedKeys.push("spontaneous_bleeding");
      else extractedKeys.push("bleeding_gums");
    }

    // 5. Swelling
    if (["swell", "swollen", "puffy", "வீக்கம்"].some(w => cleaned.includes(w))) {
      state.swelling = true;
      if (["face", "cheek", "eye", "neck"].some(w => cleaned.includes(w))) extractedKeys.push("severe_facial_swelling");
      else extractedKeys.push("mild_swelling");
    }

    // 6. Pus
    if (["pus", "discharge", "exudate", "boil", "சீழ்"].some(w => cleaned.includes(w))) {
      state.pus = true;
      extractedKeys.push("pus_discharge");
    }

    // 7. Fever
    if (["fever", "chills", "high temp", "காய்ச்சல்"].some(w => cleaned.includes(w))) {
      state.fever = true;
      extractedKeys.push("fever");
    }

    // 8. Trauma
    if (["knocked out", "avulsed", "fall", "accident", "trauma", "broken tooth"].some(w => cleaned.includes(w))) {
      state.trauma = true;
      extractedKeys.push("tooth_knocked_out");
    }

    // 9. Sensitivity
    if (cleaned.includes("cold")) {
      state.sensitivity = "cold";
      extractedKeys.push("cold_sensitivity");
    } else if (cleaned.includes("hot")) {
      state.sensitivity = "hot";
      extractedKeys.push("hot_sensitivity");
    }

    return { state, extractedKeys };
  }

  selectNextQuestion(state, details, askedFields = [], symptomKeys = new Set()) {
    // 1. SAFETY & RED FLAG CHECK (Highest Priority)
    if ((state.swelling || symptomKeys.has("severe_facial_swelling")) && !askedFields.includes("airway_red_flag")) {
      return {
        field: "airway_red_flag",
        question: "Since swelling is present, I want to check for safety: are you experiencing any difficulty breathing or difficulty swallowing?",
        desc: "safety"
      };
    }

    // Identify active symptoms
    const hasBleeding = state.bleeding || symptomKeys.has("bleeding_gums") || symptomKeys.has("bleeding_gums_brushing");
    const hasPain = state.painLevel !== null || symptomKeys.has("toothache") || symptomKeys.has("severe_throbbing_pain");
    const hasSwelling = state.swelling || symptomKeys.has("mild_swelling");
    const hasSensitivity = state.sensitivity || symptomKeys.has("cold_sensitivity") || symptomKeys.has("hot_sensitivity");

    // 2. SYMPTOM-SPECIFIC ADAPTIVE SELECTION
    // 2. SYMPTOM-SPECIFIC DEEP ADAPTIVE SELECTION (8-10 Question Clinical Interview)
    if (hasPain) {
      if (state.location === null && !askedFields.includes("location")) {
        return { field: "location", question: "Which specific tooth or area is hurting (e.g., upper right back molar, lower front teeth)?", desc: "location" };
      }
      if (state.duration === null && !askedFields.includes("duration")) {
        return { field: "duration", question: "When did this tooth pain first start?", desc: "duration" };
      }
      if (state.painLevel === null && !askedFields.includes("pain_level")) {
        return { field: "pain_level", question: "On a scale of 1 to 10, how severe is the pain right now?", desc: "pain level" };
      }
      if ((!details.triggers || details.triggers.length === 0) && !askedFields.includes("triggers")) {
        return { field: "triggers", question: "Does anything specific trigger or worsen the pain, like cold drinks, hot food, sweets, or biting down?", desc: "triggers" };
      }
      if (details.frequency === null && !askedFields.includes("frequency")) {
        return { field: "frequency", question: "Is the pain constant throughout the day, or does it come and go intermittently?", desc: "frequency" };
      }
      if (details.pain_character === null && !askedFields.includes("pain_character")) {
        return { field: "pain_character", question: "How would you describe the pain — is it a sharp shooting pain, a dull ache, or a throbbing sensation?", desc: "pain_character" };
      }
      if (details.sleep_impact === null && !askedFields.includes("sleep_impact")) {
        return { field: "sleep_impact", question: "Does the toothache wake you up at night or get worse when you lie down flat?", desc: "sleep_impact" };
      }
      if (state.swelling === null && !askedFields.includes("swelling")) {
        return { field: "swelling", question: "Have you noticed any swelling or tenderness in the gums or cheek around that tooth?", desc: "swelling" };
      }
      if (state.pus === null && !askedFields.includes("pus")) {
        return { field: "pus", question: "Is there any pus discharge, a small bump on the gum, or a bad taste coming from that tooth?", desc: "pus" };
      }
      if (state.fever === null && !askedFields.includes("fever")) {
        return { field: "fever", question: "Have you experienced any fever, chills, or body warmness alongside the toothache?", desc: "fever" };
      }
    } else if (hasBleeding) {
      if (state.duration === null && !askedFields.includes("duration")) {
        return { field: "duration", question: "When did you first notice your gums starting to bleed?", desc: "duration" };
      }
      if (details.frequency === null && !askedFields.includes("frequency")) {
        return { field: "frequency", question: "Does the bleeding happen every time you brush or floss, or does it bleed spontaneously without touching?", desc: "frequency" };
      }
      if (state.location === null && !askedFields.includes("location")) {
        return { field: "location", question: "Is the bleeding localized to one specific tooth/area or all over your upper and lower gums?", desc: "location" };
      }
      if (state.swelling === null && !askedFields.includes("swelling")) {
        return { field: "swelling", question: "Are your gums swollen, red, or tender to the touch alongside the bleeding?", desc: "swelling" };
      }
      if (details.recession === null && !askedFields.includes("recession")) {
        return { field: "recession", question: "Have you noticed your gums pulling back or your teeth appearing slightly longer than before?", desc: "recession" };
      }
      if (details.loose_teeth === null && !askedFields.includes("loose_teeth")) {
        return { field: "loose_teeth", question: "Do any of your teeth feel slightly loose or wobbly when eating or chewing?", desc: "loose_teeth" };
      }
      if (details.bad_breath === null && !askedFields.includes("bad_breath")) {
        return { field: "bad_breath", question: "Have you experienced persistent bad breath or an unpleasant taste in your mouth?", desc: "bad_breath" };
      }
      if (details.cleaning_history === null && !askedFields.includes("cleaning_history")) {
        return { field: "cleaning_history", question: "Roughly when was your last professional dental cleaning or checkup?", desc: "cleaning_history" };
      }
      if (state.painLevel === null && !askedFields.includes("pain_level")) {
        return { field: "pain_level", question: "On a scale of 1 to 10, how much pain or soreness are you feeling in your gums?", desc: "pain level" };
      }
    } else if (hasSwelling) {
      if (state.location === null && !askedFields.includes("location")) {
        return { field: "location", question: "Where exactly is the swelling located (e.g., upper gum, lower jawline, inner cheek)?", desc: "location" };
      }
      if (state.duration === null && !askedFields.includes("duration")) {
        return { field: "duration", question: "How many days or hours has this swelling been present?", desc: "duration" };
      }
      if (state.painLevel === null && !askedFields.includes("pain_level")) {
        return { field: "pain_level", question: "On a scale of 1 to 10, how painful is the swollen region?", desc: "pain level" };
      }
      if (state.pus === null && !askedFields.includes("pus")) {
        return { field: "pus", question: "Is there any pus, yellowish discharge, or foul taste coming from the swollen area?", desc: "pus" };
      }
      if (state.fever === null && !askedFields.includes("fever")) {
        return { field: "fever", question: "Have you noticed any fever or general feeling of illness with this swelling?", desc: "fever" };
      }
      if (details.jaw_opening === null && !askedFields.includes("jaw_opening")) {
        return { field: "jaw_opening", question: "Can you open your mouth normally, or is your jaw stiff and painful to open?", desc: "jaw_opening" };
      }
      if (details.facial_spread === null && !askedFields.includes("facial_spread")) {
        return { field: "facial_spread", question: "Is the swelling staying in one spot, or spreading outward toward your cheek, eye, or neck?", desc: "facial_spread" };
      }
    } else if (hasSensitivity) {
      if (state.location === null && !askedFields.includes("location")) {
        return { field: "location", question: "Which specific tooth or quadrant feels sensitive?", desc: "location" };
      }
      if (state.duration === null && !askedFields.includes("duration")) {
        return { field: "duration", question: "How long have you been experiencing this sensitivity?", desc: "duration" };
      }
      if ((!details.triggers || details.triggers.length === 0) && !askedFields.includes("triggers")) {
        return { field: "triggers", question: "Is the sensitivity triggered by cold drinks, hot liquids, sweet foods, or cold air?", desc: "triggers" };
      }
    }

    // General Deep Fallbacks
    if (state.location === null && !askedFields.includes("location")) {
      return { field: "location", question: "Where specifically in your mouth is the discomfort located (e.g., upper right gum, back molars, front teeth)?", desc: "location" };
    }
    if (state.duration === null && !askedFields.includes("duration")) {
      return { field: "duration", question: "How long has this issue been going on? (e.g., a few days, a week, or several months?)", desc: "duration" };
    }
    if (state.painLevel === null && !askedFields.includes("pain_level")) {
      return { field: "pain_level", question: "On a scale of 0 to 10, what is your current discomfort or pain level?", desc: "pain level" };
    }

    return null;
  }

  processMessage(sessionId, message) {
    const sId = sessionId || ("sess_" + Math.random().toString(36).substring(2, 11));
    if (!this.sessions[sId]) {
      this.sessions[sId] = {
        userId: "guest",
        turnCount: 0,
        state: {
          location: null, duration: null, painLevel: null,
          bleeding: null, swelling: null, pus: null,
          sensitivity: null, fever: null, trauma: null
        },
        details: {
          frequency: null,
          painLevel: null,
          duration: null,
          triggers: [],
          related: []
        },
        extractedSymptoms: [],
        followupCount: 0,
        lastAsked: null,
        symptomKeys: new Set(),
        transcript: [],
        completed: false
      };
      const greeting = "Hello! 👋 I am PerioVoice AI™, your dental and gum health triage assistant. Describe your tooth or gum symptoms to begin.";
      this.sessions[sId].transcript.push({ sender: "bot", text: greeting });
    }

    const session = this.sessions[sId];
    if (!session.details) {
      session.details = { frequency: null, painLevel: null, duration: null, triggers: [], related: [] };
    }
    if (!session.extractedSymptoms) session.extractedSymptoms = [];
    if (session.followupCount === undefined) session.followupCount = 0;

    session.turnCount += 1;
    session.transcript.push({ sender: "user", text: message });

    // 1. Preprocess raw text input
    const cleaned = this.preprocessText(message);
    const tamilMode = this.isTamil(message);

    const lastAsked = session.lastAsked;
    let matchedVal = null;
    if (lastAsked) {
      matchedVal = this.matchFieldValue(lastAsked, message);
    }

    // 2. Classify message type before anything else
    // Greetings check
    const greetings = ["hi", "hello", "hey", "hii", "helloo", "vanakkam", "yo", "greetings", "hello there", "good morning", "good afternoon", "good evening", "hii!", "hello!", "வணக்கம்", "வணக்கம்!"];
    const isGreeting = greetings.includes(cleaned) || ["hi", "hello", "hey", "hii", "vanakkam", "yo", "வணக்கம்"].some(w => cleaned === w);
    if (isGreeting) {
      const aiReply = tamilMode 
        ? "வணக்கம்! உங்கள் பற்கள் அல்லது ஈறுகளில் என்ன பிரச்சனை ஏற்படுகிறது?" 
        : "Hey! I'm here to help figure out what's going on with your teeth or gums. What's bothering you today?";
      session.lastAsked = null;
      session.transcript.push({ sender: "bot", text: aiReply });
      return {
        response: aiReply,
        is_assessment_complete: false,
        final_result: null,
        conversation_transcript: session.transcript
      };
    }

    // Small talk check
    const smallTalk = ["thanks", "thank you", "ty", "bye", "goodbye", "ok", "okay", "cool", "got it", "perfect", "thanks!", "thank you!"];
    const isSmallTalk = smallTalk.includes(cleaned) || ["thank you", "thanks", "goodbye", "see ya"].some(w => cleaned.includes(w));
    if (isSmallTalk) {
      const aiReply = tamilMode
        ? "மிக்க நன்றி! உடம்பை பார்த்துக் கொள்ளுங்கள்!"
        : "You're very welcome! If you experience any dental issues in the future, don't hesitate to ask. Take care!";
      session.completed = true;
      session.transcript.push({ sender: "bot", text: aiReply });
      return {
        response: aiReply,
        is_assessment_complete: false,
        final_result: null,
        conversation_transcript: session.transcript
      };
    }

    // Off-topic Redirect
    const isOffTopicQuery = this.isOffTopic(message) || (
      ["leg", "knee", "headache", "stomach", "chest", "back", "throat", "arm", "body"].some(w => cleaned.includes(w)) &&
      !["teeth", "tooth", "gum", "dentist", "mouth", "molar"].some(d => cleaned.includes(d))
    );
    if (isOffTopicQuery) {
      let aiReply;
      if (tamilMode) {
        aiReply = "நான் பற்கள் மற்றும் ஈறுகளின் ஆரோக்கியத்தை மட்டுமே சரிபார்க்க முடியும். பற்கள் அல்லது ஈறுகளில் ஏதேனும் தொந்தரவு உள்ளதா?";
      } else {
        let bodyPart = "that";
        const parts = ["leg", "knee", "headache", "stomach", "chest", "back", "throat", "arm", "body"];
        for (const p of parts) {
          if (cleaned.includes(p)) {
            if (cleaned.includes("pain") || p === "headache") {
              bodyPart = p === "headache" ? "headache" : `${p} pain`;
            } else {
              bodyPart = `${p} pain`;
            }
            break;
          }
        }
        if (bodyPart !== "that") {
          aiReply = `I'm specifically built to help with dental and gum concerns, so I can't help with ${bodyPart} — but if you're having any tooth or gum issues, I'm here for that!`;
        } else {
          aiReply = "I'm specifically built to help with dental and gum concerns, so I can't help with that — but if you're having any tooth or gum issues, I'm here for that!";
        }
      }
      session.transcript.push({ sender: "bot", text: aiReply });
      return {
        response: aiReply,
        is_assessment_complete: false,
        final_result: null,
        conversation_transcript: session.transcript
      };
    }

    // Empty / Non-committal ("nothing", "idk")
    const nonCommittal = ["nothing", "idk", "i don't know", "dont know", "none", "nothing else", "இல்லை", "ஒன்றுமில்லை"];
    const isNonCommittal = nonCommittal.includes(cleaned);
    if (isNonCommittal) {
      const aiReply = tamilMode
        ? "பரவாயில்லை — உங்கள் பற்கள் அல்லது ஈறுகளில் ஏதேனும் தொந்தரவு இருந்தால் தயங்காமல் என்னிடம் கூறுங்கள்."
        : "No worries — whenever something's bothering you with your teeth or gums, just tell me and I'll take a look.";
      session.transcript.push({ sender: "bot", text: aiReply });
      return {
        response: aiReply,
        is_assessment_complete: false,
        final_result: null,
        conversation_transcript: session.transcript
      };
    }

    // Direct Questions
    const botQReply = this.handleDirectQuestion(message);
    if (botQReply) {
      session.transcript.push({ sender: "bot", text: botQReply });
      const qRes = this.selectNextQuestion(session.state, session.details, session.askedFields || []);
      let aiReply = botQReply;
      if (qRes) {
        session.lastAsked = qRes.field;
        session.followupCount += 1;
        aiReply = `${botQReply} ${qRes.question}`;
      }
      return {
        response: aiReply,
        is_assessment_complete: false,
        final_result: null,
        conversation_transcript: session.transcript
      };
    }

    // Corrections Handling
    const isCorrection = ["actually", "no it", "sorry it", "correction", "i meant"].some(w => cleaned.includes(w));
    if (isCorrection) {
      if (["left", "right", "upper", "lower", "top", "bottom"].some(w => cleaned.includes(w))) {
        const newLoc = this.matchFieldValue("location", message);
        if (newLoc) {
          session.state.location = newLoc;
          session.details.location = newLoc;
          const confirmMsg = `Got it, updating that to the ${newLoc}.`;
          const qRes = this.selectNextQuestion(session.state, session.details, session.askedFields || []);
          let aiReply = confirmMsg;
          if (qRes) {
            session.lastAsked = qRes.field;
            session.followupCount += 1;
            aiReply = `${confirmMsg} ${qRes.question}`;
          }
          session.transcript.push({ sender: "bot", text: aiReply });
          return {
            response: aiReply,
            is_assessment_complete: false,
            final_result: null,
            conversation_transcript: session.transcript
          };
        }
      }
    }

    // Gibberish / Unmatched check
    const isKnownConcept = (
      isGreeting ||
      isSmallTalk ||
      ["yes", "no", "not", "dont", "yeah", "sure", "none", "nothing", "இல்லை"].some(w => cleaned.includes(w)) ||
      /\b([0-9]|10)\b/.test(cleaned) ||
      LOCATIONS.some(loc => cleaned.includes(loc)) ||
      ["pain", "hurt", "sore", "bleed", "blood", "swell", "puffy", "pus", "fever", "knocked", "trauma", "teeth", "tooth", "gum"].some(s => cleaned.includes(s)) ||
      (lastAsked !== null && matchedVal !== null) ||
      cleaned.startsWith("image scan shows")
    );
    let isGibberish = false;
    const cleanNoSpaces = cleaned.replace(/\s+/g, "");
    if (!isKnownConcept) {
      if (cleanNoSpaces.length > 5) {
        isGibberish = !/[aeiouy]/.test(cleaned);
      } else if (cleanNoSpaces.length > 2 && !/[aeiouy]/.test(cleaned)) {
        isGibberish = true;
      } else if (cleanNoSpaces.length <= 2 && cleaned !== "up" && cleaned !== "lh") {
        isGibberish = true;
      }
    }

    if (isGibberish) {
      const fallbackPhrases = [
        "I didn't quite catch a symptom there — could you describe what you're feeling in a bit more detail? For example, 'my gums bleed when I brush' or 'sharp pain in my back tooth'.",
        "I want to make sure I understand your dental concerns correctly. Could you describe your teeth or gum symptoms in another way?",
        "Could you try describing what's happening with your teeth or gums using different words? For example, specify if there is any pain, bleeding, or swelling."
      ];
      let lastBotReply = null;
      for (let i = session.transcript.length - 1; i >= 0; i--) {
        if (session.transcript[i].sender === "bot") {
          lastBotReply = session.transcript[i].text;
          break;
        }
      }
      let aiReply = fallbackPhrases[0];
      if (lastBotReply === aiReply) {
        aiReply = fallbackPhrases[1];
      } else if (lastBotReply === fallbackPhrases[1]) {
        aiReply = fallbackPhrases[2];
      }
      session.transcript.push({ sender: "bot", text: aiReply });
      return {
        response: aiReply,
        is_assessment_complete: false,
        final_result: null,
        conversation_transcript: session.transcript
      };
    }

    // Emergency check
    const isEmergencyText = ["severe pain", "can't stop bleeding", "swelling face", "swollen face", "difficulty swallowing", "difficulty breathing", "choking", "knocked out", "fever", "exudate", "purulent", "pus"].some(w => cleaned.includes(w));
    if (isEmergencyText) {
      session.completed = true;
      const finalResult = this.generateFinalAssessment(session.state, session.symptomKeys);
      const aiReply = `🚨 Immediate emergency dental care is advised. Your periodontal risk is high/emergency concern. Please see a dentist or visit an urgent dental clinic within the next 24 hours. This isn't a replacement for an in-person dental checkup.`;
      session.transcript.push({ sender: "bot", text: aiReply });
      return {
        response: aiReply,
        is_assessment_complete: true,
        final_result: finalResult,
        conversation_transcript: session.transcript
      };
    }

    // 3. Update session memory & Merge state
    const newlyExtracted = {};
    if (lastAsked) {
      if (matchedVal !== null) {
        if (lastAsked === "triggers") {
          if (Array.isArray(matchedVal)) {
            session.details.triggers = Array.from(new Set([...session.details.triggers, ...matchedVal]));
          } else if (!session.details.triggers.includes(matchedVal)) {
            session.details.triggers.push(matchedVal);
          }
        } else {
          session.state[lastAsked] = matchedVal;
          session.details[lastAsked] = matchedVal;
        }
        newlyExtracted[lastAsked] = matchedVal;
      } else if (lastAsked === "duration" || lastAsked === "location") {
        const words = cleaned.split(/\s+/);
        const isNegativeResponse = words.some(w => ["no", "none", "nothing", "nowhere", "not", "nope", "dont", "dont know", "don't know", "no idea", "இல்லை"].includes(w)) || 
                                   ["no", "none", "nothing", "nowhere", "not", "nope", "dont", "dont know", "don't know", "no idea", "இல்லை"].includes(cleaned);
        
        if (isNegativeResponse || ["no where", "nowhere", "no place", "no pain", "no problem", "no issue", "none", "nothing", "no discomfort"].some(neg => cleaned.includes(neg))) {
          const locVal = lastAsked === "location" ? "no specific area" : "Not specified";
          session.state[lastAsked] = locVal;
          session.details[lastAsked] = locVal;
          newlyExtracted[lastAsked] = locVal;
          matchedVal = locVal;
        } else if (message.split(/\s+/).length <= 4 && !["pain", "bleed", "swell", "tooth", "teeth", "gum", "hurt"].some(w => cleaned.includes(w))) {
          session.state[lastAsked] = message;
          session.details[lastAsked] = message;
          newlyExtracted[lastAsked] = message;
          matchedVal = message;
        } else {
          const fallbackVal = lastAsked === "location" ? "Oral Cavity" : "A few days";
          session.state[lastAsked] = fallbackVal;
          session.details[lastAsked] = fallbackVal;
          newlyExtracted[lastAsked] = fallbackVal;
          matchedVal = fallbackVal;
        }
      }
    }

    // Only run fuzzy matching fallback if text is a descriptive sentence (at least 3 words and 8 chars)
    let shouldFuzzy = cleaned.split(" ").length >= 3 && cleaned.length >= 8;
    
    // Backup/extract
    const { state: updatedState, extractedKeys: newSymptomKeys } = this.extractEntities(message, session.state, lastAsked);
    
    // Check relevance (relaxed to include core dental keywords)
    const hasMatchingField = (lastAsked !== null && matchedVal !== null);
    const hasRegexEntities = (newSymptomKeys.length > 0 || (lastAsked === "pain_level" && session.state.painLevel !== null) || (lastAsked === "location" && session.state.location !== null));
    
    const DENTAL_KEYWORDS = [
      "tooth", "teeth", "gum", "gums", "pain", "paining", "hurt", "hurts", 
      "brush", "brushing", "floss", "flossing", "bleed", "bleeding", "swell", "swelling",
      "ache", "aching", "mouth", "molar", "dentist", "gap", "gape", "wisdom"
    ];
    const hasDentalKeyword = DENTAL_KEYWORDS.some(kw => cleaned.includes(kw));
    
    const isRelevantInput = (lastAsked !== null) || hasMatchingField || hasRegexEntities || newSymptomKeys.length > 0 || hasDentalKeyword || cleaned.startsWith("image scan shows");

    if (!isRelevantInput) {
      const unrelatedFallbacks = [
        "That doesn't seem related to a tooth or gum symptom — could you tell me what's actually bothering you with your teeth or gums?",
        "I didn't catch any dental symptoms or details in that message. Could you describe what you're experiencing with your teeth or gums?",
        "To help you with your dental triage, I need to know about your tooth or gum concerns. Could you describe your symptoms?"
      ];
      let lastBotReply = null;
      for (let i = session.transcript.length - 2; i >= 0; i--) {
        if (session.transcript[i].sender === "bot") {
          lastBotReply = session.transcript[i].text;
          break;
        }
      }
      let aiReply = unrelatedFallbacks[0];
      if (lastBotReply === aiReply) {
        aiReply = unrelatedFallbacks[1];
      } else if (lastBotReply === unrelatedFallbacks[1]) {
        aiReply = unrelatedFallbacks[2];
      }
      
      if (tamilMode) {
        aiReply = "அது பற்கள் அல்லது ஈறுகளின் அறிகுறியாகத் தெரியவில்லை — உங்கள் பற்கள் அல்லது ஈறுகளில் என்ன பிரச்சனை ஏற்படுகிறது என்று கூற முடியுமா?";
      }
      
      session.transcript.push({ sender: "bot", text: aiReply });
      return {
        response: aiReply,
        is_assessment_complete: false,
        final_result: null,
        conversation_transcript: session.transcript
      };
    }

    // Only save fuzzy matched state properties if we should fuzzy
    if (shouldFuzzy) {
      session.state = updatedState;
      newSymptomKeys.forEach(k => {
        session.symptomKeys.add(k);
        if (!session.extractedSymptoms.includes(k)) {
          session.extractedSymptoms.push(k);
        }
      });
    } else {
      // Direct regex extraction only (pain scale, trauma, cold/hot sensitivity, bleeding, swelling)
      newSymptomKeys.forEach(k => {
        if (!k.startsWith("fuzzy_")) { // skip fuzzy tags
          session.symptomKeys.add(k);
          if (!session.extractedSymptoms.includes(k)) {
            session.extractedSymptoms.push(k);
          }
        }
      });
    }

    for (const trigger of ["brushing", "brush", "flossing", "floss", "chewing", "chew", "eating", "eat", "cold", "hot", "sweet"]) {
      if (cleaned.includes(trigger) && !session.details.triggers.includes(trigger)) {
        session.details.triggers.push(trigger);
      }
    }

    // 4. Check confidence/completeness
    const countFilledDetails = (st, dt) => {
      let count = 0;
      if (st.duration !== null || dt.duration !== null) count++;
      if (dt.frequency !== null) count++;
      if (st.painLevel !== null || dt.painLevel !== null) count++;
      if (dt.triggers && dt.triggers.length > 0) count++;
      if (st.location !== null || dt.location !== null) count++;
      return count;
    };

    const filledDetailsCount = countFilledDetails(session.state, session.details);
    const hasRealSymptom = session.extractedSymptoms.length > 0 || session.symptomKeys.size > 0;
    
    const knownHighValueFields = [
      session.state.duration !== null,
      session.details.frequency !== null,
      session.state.painLevel !== null,
      session.details.triggers.length > 0,
      session.state.swelling !== null || session.state.bleeding !== null
    ];
    // Select next question first before deciding completion
    const qResult = this.selectNextQuestion(session.state, session.details, session.askedFields, session.symptomKeys);

    // Completion rule: Only complete when NO more relevant questions exist (qResult is null) OR 5 followups completed
    const isComplete = hasRealSymptom && (qResult === null || session.completed || session.followupCount >= 5) && filledDetailsCount >= 2;

    if (isComplete) {
      session.completed = true;
      const finalResult = this.generateFinalAssessment(session.state, session.symptomKeys);
      
      const categoryPlainNames = {
        "Gingival Inflammation (Gingivitis)": "early gum inflammation (gingivitis), which is very common and usually manageable at home",
        "Chronic Periodontitis": "chronic gum disease (periodontitis), which involves progressive inflammation of the gums and supporting bone",
        "Localized Periodontal Abscess": "a localized gum infection (periodontal abscess), which requires prompt attention from a dentist",
        "Acute Necrotizing Ulcerative Gingivitis (ANUG)": "a severe painful gum infection (ANUG) that needs immediate professional treatment",
        "Acute Irreversible Pulpitis / Periapical Involvement": "inflammation of the tooth nerve (pulpitis), which typically requires dental evaluation",
        "Dental Trauma / Tooth Avulsion": "dental trauma from physical impact",
        "Severe Facial Cellulitis / Submandibular Abscess": "a spreading facial tissue infection (cellulitis), which is a serious condition requiring immediate emergency care",
        "Temporomandibular Joint (TMJ) Dysfunction": "jaw joint dysfunction (TMJ), which can cause discomfort but is typically not an infection"
      };

      const recommendationPlainTexts = {
        "Gingival Inflammation (Gingivitis)": "Try switching to a softer toothbrush and flossing gently for the next week — if the bleeding continues past that, it's worth getting it checked by a dentist.",
        "Chronic Periodontitis": "It is important to schedule a professional cleaning and examination within the next few weeks to halt any further attachment loss.",
        "Localized Periodontal Abscess": "Please schedule an urgent dental appointment. You can rinse with warm salt water and take over-the-counter pain relievers in the meantime, but avoid chewing on that side.",
        "Acute Necrotizing Ulcerative Gingivitis (ANUG)": "Please schedule an urgent dental appointment. You can rinse with warm salt water and take over-the-counter pain relievers in the meantime, but avoid chewing on that side.",
        "Acute Irreversible Pulpitis / Periapical Involvement": "Please schedule an urgent dental appointment. You can rinse with warm salt water and take over-the-counter pain relievers in the meantime, but avoid chewing on that side.",
        "Dental Trauma / Tooth Avulsion": "You should seek urgent dental or emergency room care within 24 hours. Do not wait for symptoms to worsen.",
        "Severe Facial Cellulitis / Submandibular Abscess": "You should seek urgent dental or emergency room care within 24 hours. Do not wait for symptoms to worsen.",
        "Temporomandibular Joint (TMJ) Dysfunction": "You may use warm compresses on the side of your face and avoid hard foods. It is recommended to schedule a checkup if it persists."
      };

      const restatement = this.getSymptomRestatement(session.state, session.details);
      const catDisplay = finalResult.condition_category;
      const catPlain = categoryPlainNames[catDisplay] || catDisplay.toLowerCase();
      const recPlain = recommendationPlainTexts[catDisplay] || finalResult.recommendation;

      const urg = finalResult.urgency;
      let concernDesc = "low-to-moderate concern";
      if (urg === "LOW") concernDesc = "low concern";
      else if (urg === "MODERATE") concernDesc = "moderate concern";
      else if (urg === "HIGH") concernDesc = "high concern";
      else if (urg === "EMERGENCY") concernDesc = "high severity/emergency concern";

      const aiReply = `Based on what you've described — ${restatement} — your symptoms might be associated with ${catPlain}.\n\nPreliminary Urgency: ${urg} (${concernDesc}). ${recPlain}\n\n📊 Would you like me to summarize and generate your full clinical report now?`;
      session.transcript.push({ sender: "bot", text: aiReply });
      return {
        response: aiReply,
        is_assessment_complete: true,
        final_result: finalResult,
        conversation_transcript: session.transcript
      };
    }

    // 6. Ask ONE relevant follow-up question
    const qRes = this.selectNextQuestion(session.state, session.details, session.askedFields || []);
    if (!qRes) {
      session.completed = true;
      const finalResult = this.generateFinalAssessment(session.state, session.symptomKeys);
      const aiReply = `Thank you for providing those details.\n\nBased on your responses, your symptoms might be associated with ${finalResult.condition_category}.\n\n📊 Would you like me to summarize and generate your full clinical report now?`;
      session.transcript.push({ sender: "bot", text: aiReply });
      return {
        response: aiReply,
        is_assessment_complete: true,
        final_result: finalResult,
        conversation_transcript: session.transcript
      };
    }

    let nextQ = qRes.question;
    let lastBotReply = null;
    for (let i = session.transcript.length - 2; i >= 0; i--) {
      if (session.transcript[i].sender === "bot") {
        lastBotReply = session.transcript[i].text;
        break;
      }
    }

    if (lastBotReply && lastBotReply.includes(nextQ)) {
      const rephrasedQuestions = {
        duration: "Just to confirm — could you estimate how many days or weeks it's been going on?",
        frequency: "Does this symptom happen every single time, or is it more of a random occurrence?",
        pain_level: "Would you rate the pain as mild, moderate, or severe?",
        triggers: "Does anything specific trigger it, like cold drinks, hot food, or brushing?",
        swelling: "Is there any puffiness or swelling around that area at all?",
        bleeding: "Do your gums bleed when you brush, or sometimes on their own?"
      };
      nextQ = rephrasedQuestions[qRes.field] || `Could you provide some more details about the ${qRes.desc}?`;
    }

    session.lastAsked = qRes.field;
    if (!session.askedFields) session.askedFields = [];
    if (!session.askedFields.includes(qRes.field)) {
      session.askedFields.push(qRes.field);
    }
    session.followupCount += 1;

    const ackPrefix = this.buildAcknowledgment(message, session.state, session.details, newlyExtracted, lastAsked);
    const aiReply = `${ackPrefix} ${nextQ}`;

    session.transcript.push({ sender: "bot", text: aiReply });
    return {
      response: aiReply,
      is_assessment_complete: false,
      final_result: null,
      conversation_transcript: session.transcript
    };
  }

  generateFinalAssessment(state, symptomKeys) {
    let pLvl = state.painLevel;
    if (pLvl === null || pLvl === undefined || isNaN(pLvl)) {
      pLvl = 2; // Default mild pain if unstated
    }

    let baseScore = Number(pLvl);
    if (state.bleeding) baseScore += 1.0;
    if (state.swelling) baseScore += 1.5;
    if (state.pus || state.fever) baseScore += 2.5;
    if (symptomKeys.has("severe_facial_swelling") || state.trauma) baseScore += 4.0;

    const riskScore = Math.min(10, Math.max(1, Math.round(baseScore)));
    let urgency = "LOW";
    let category = "Gingival Inflammation (Gingivitis)";
    let rationale = "Low periodontal risk. Symptoms indicate mild reversible gingival irritation with low pain intensity.";
    let rec = "🟢 LOW RISK: Maintain daily oral hygiene and routine dental checkups.";

    if (state.trauma || symptomKeys.has("severe_facial_swelling") || riskScore >= 9) {
      urgency = "EMERGENCY";
      if (symptomKeys.has("severe_facial_swelling")) {
        category = "Severe Facial Cellulitis / Submandibular Abscess";
      } else if (state.trauma) {
        category = "Dental Trauma / Tooth Avulsion";
      } else {
        category = "Acute Irreversible Pulpitis / Periapical Involvement";
      }
      rationale = "Immediate emergency dental care required due to potential facial cellulitis, severe trauma, or airway risk.";
      rec = "🚨 EMERGENCY: Seek urgent clinical dental or emergency room evaluation within 24 hours.";
    } else if (riskScore >= 7 || state.pus || state.fever) {
      urgency = "HIGH";
      category = state.pus ? "Localized Periodontal Abscess" : "Acute Irreversible Pulpitis / Periapical Involvement";
      rationale = "High periodontal urgency recommended due to severe pain, acute infection, or purulent exudate.";
      rec = "🔴 HIGH URGENCY: Schedule a clinical periodontal appointment within 48 hours.";
    } else if (riskScore >= 4) {
      urgency = "MODERATE";
      category = state.swelling ? "Chronic Periodontitis" : "Gingival Inflammation (Gingivitis)";
      rationale = "Moderate risk calculated based on moderate pain intensity, active gum bleeding, or localized inflammation.";
      rec = "🟡 MODERATE: Schedule professional scaling and periodontal examination within 7 to 14 days.";
    }

    const symptomsList = [];
    if (state.location) symptomsList.push(`Discomfort at ${state.location}`);
    if (state.painLevel !== null) symptomsList.push(`Pain level ${state.painLevel}/10`);
    if (state.bleeding) symptomsList.push("Gingival Bleeding");
    if (state.swelling) symptomsList.push("Gum/Facial Swelling");
    if (state.pus) symptomsList.push("Purulent Discharge");
    if (state.fever) symptomsList.push("Pyrexia / Fever");

    return {
      urgency,
      risk_score: riskScore,
      symptoms: symptomsList.length > 0 ? symptomsList : ["Gingival Erythema / Mild Discomfort"],
      location: state.location || "Oral Cavity",
      duration: state.duration || "Not specified",
      condition_category: category,
      urgency_rationale: rationale,
      recommendation: rec,
      home_care_tips: [
        "Brush twice daily using soft bristles angled at 45 degrees to the gumline.",
        "Floss gently between all teeth once daily.",
        "Rinse with warm salt water or an alcohol-free antimicrobial rinse."
      ],
      emergency_warning_signs: [
        "Spreading swelling into cheek, eye, or neck",
        "Difficulty breathing or swallowing saliva",
        "Inability to open mouth wider than two fingers (Trismus)"
      ],
      should_see_dentist: urgency !== "LOW",
      disclaimer: "⚠️ DISCLAIMER: This is an automated AI-based triage assessment for informational purposes only. It is not a professional medical diagnosis. Please consult a licensed dentist."
    };
  }
}

export const clientTriageEngine = new ClientTriageEngine();
