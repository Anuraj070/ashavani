/**
 * Clinical NLU Engine for AshaVani (Frontline ASHA Voice Register)
 * Extracts structured RCH (Reproductive and Child Health) clinical records
 * from arbitrary spoken sentences in Hindi, Kannada, and English.
 * Complies with MoHFW (Ministry of Health & Family Welfare) Frontline Guidelines.
 */

export interface FollowUpItem {
  id: string;
  text: string;
  dueDate: string;
  completed: boolean;
  priority: 'high' | 'normal';
}

export interface VisitData {
  beneficiaryName: string;
  rchId: string;
  visitType: string;
  weightKg: string;
  bloodPressure: string;
  vaccines: string[];
  supplements: string[];
  symptoms: string[];
  isDangerSign: boolean;
  dangerDetails: string;
  nextVisitDate: string;
  phcReferralNeeded: boolean;
  followUps: FollowUpItem[];
}

export interface ClinicalParseResult {
  isVoiceCommand: boolean;
  commandType?: 'CONFIRM_SAVE' | 'CORRECT_FIELD' | 'NAVIGATE' | 'CANCEL';
  targetTab?: 'visit' | 'tasks' | 'history';
  updatedVisitData: VisitData;
  readBackText: string;
  detectedChanges: string[];
}

// Spoken numbers dictionary in Hindi & Kannada to Arabic Numerals
const INDIC_NUMBER_MAP: Record<string, number> = {
  // Hindi numbers
  'चालीस': 40, 'इकतालीस': 41, 'बयालीस': 42, 'तैंतालीस': 43, 'चवालीस': 44, 'पैंतालीस': 45,
  'छियालीस': 46, 'सैंतालीस': 47, 'अड़तालीस': 48, 'उनचास': 49, 'पचास': 50, 'इक्यावन': 51,
  'बावन': 52, 'तिरेपन': 53, 'चौवन': 54, 'पचपन': 55, 'छप्पन': 56, 'सत्तावन': 57,
  'अट्ठावन': 58, 'उनसठ': 59, 'साठ': 60, 'इकसठ': 61, 'बासठ': 62, 'तिरेसठ': 63,
  'चौंसठ': 64, 'पैंसठ': 65, 'छियासठ': 66, 'सड़सठ': 67, 'अड़सठ': 68, 'उनहत्तर': 69,
  'सत्तर': 70, 'अस्सी': 80, 'नब्बे': 90, 'सौ': 100,
  // Kannada numbers
  'ನಲವತ್ತು': 40, 'ನಲವತ್ತೊಂದು': 41, 'ನಲವತ್ತೆರಡು': 42, 'ನಲವತ್ತೆಂಟು': 48, 'ಐವತ್ತು': 50,
  'ಐವತ್ತೊಂದು': 51, 'ಐವತ್ತೆರಡು': 52, 'ಐವತ್ತಮೂರು': 53, 'ಐವತ್ತನಾಲ್ಕು': 54, 'ಐವತ್ತೈದು': 55,
  'ಐವತ್ತಾರು': 56, 'ಅರವತ್ತು': 60, 'ಎಪ್ಪತ್ತು': 70, 'ಎಂಬತ್ತು': 80, 'ತೊಂಬತ್ತು': 90, 'ನೂರು': 100
};

/**
 * Automatically detects whether spoken text is in Hindi, Kannada, or English
 */
export function detectLanguage(text: string): 'hi' | 'kn' | 'en' {
  let hindiChars = 0;
  let kannadaChars = 0;
  let latinChars = 0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x0900 && code <= 0x097F) hindiChars++;
    else if (code >= 0x0C80 && code <= 0x0CFF) kannadaChars++;
    else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) latinChars++;
  }

  if (kannadaChars > 0 && kannadaChars >= hindiChars) return 'kn';
  if (hindiChars > 0 && hindiChars >= kannadaChars) return 'hi';
  if (latinChars > 0) return 'en';

  return 'hi';
}

/**
 * Parses any spoken weight string into a clean float string (e.g. "54.0")
 */
export function extractWeight(text: string): string | null {
  const lower = text.toLowerCase();

  // Pattern 1: Direct digits (e.g. 52, 54.5, 58 kg, 61.2 किलो, ತೂಕ 48)
  const digitMatch = lower.match(/(?:वजन|weight|ತೂಕ|kg|kilo|किलो|ಕೆಜಿ)?\s*(\d{2}(?:\.\d)?)\s*(?:kg|kilo|किलो|केजी|ಕೆಜಿ)?/);
  if (digitMatch && digitMatch[1]) {
    const val = parseFloat(digitMatch[1]);
    if (val >= 25 && val <= 130) {
      return val.toFixed(1);
    }
  }

  // Pattern 2: Indic spoken words
  for (const [word, num] of Object.entries(INDIC_NUMBER_MAP)) {
    if (lower.includes(word)) {
      return `${num}.0`;
    }
  }

  return null;
}

/**
 * Parses any spoken Blood Pressure format (e.g. 120/80, 140 by 90, 150 over 100)
 */
export function extractBloodPressure(text: string): { bp: string; isHigh: boolean } | null {
  const lower = text.toLowerCase();

  // Pattern: 120/80, 140 90, 130 by 85, 150 over 100, 140 बटा 90
  const bpMatch = lower.match(/(\d{2,3})\s*(?:\/|\s+by\s+|\s+over\s+|\s+बटा\s+|\s+ಮತ್ತು\s+|\s+)\s*(\d{2,3})/);
  if (bpMatch) {
    const sys = parseInt(bpMatch[1], 10);
    const dia = parseInt(bpMatch[2], 10);
    if (sys >= 70 && sys <= 250 && dia >= 40 && dia <= 160) {
      const isHigh = sys >= 140 || dia >= 90;
      return {
        bp: `${sys}/${dia}${isHigh ? ' (HIGH)' : ''}`,
        isHigh
      };
    }
  }

  return null;
}

/**
 * Extracts Beneficiary Name from Indic or English speech
 */
export function extractBeneficiaryName(text: string, currentName: string): string {
  const clean = text.trim();

  // Honorific/Suffixes in Hindi/Kannada/English:
  // e.g. "सुनीता देवी", "अनीता शर्मा", "Kavitha Gowda", "Pooja Kumari", "Rekha Bai"
  const namePatterns = [
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:came|visit|ANC|weight|BP|is)/i,
    /([^\s,।]+(?:\s+(?:देवी|बाई|शर्मा|कुमारी|कौर|बेगम|अम्मा|ಗೌಡ|ದೇವಿ)))\b/,
    /(?:श्रीमती|नाम|beneficiary|patient|ಫಲಾನುಭವಿ)\s+([^\s,।]+(?:\s+[^\s,।]+)?)/i
  ];

  for (const pat of namePatterns) {
    const match = clean.match(pat);
    if (match && match[1] && match[1].length >= 3) {
      const candidate = match[1].trim();
      // Exclude common medical words
      if (!['वजन', 'ब्लड', 'प्रसव', 'जांच', 'दौरा', 'लसಿಕೆ', 'ತೂಕ', 'weight', 'blood'].some(w => candidate.toLowerCase().includes(w))) {
        return candidate;
      }
    }
  }

  return currentName;
}

/**
 * Danger Signs Detection adhering to MoHFW Frontline Protocols
 */
export function detectDangerSigns(text: string, isBpHigh: boolean, lang: 'hi' | 'kn' | 'en'): {
  isDanger: boolean;
  details: string;
} {
  const lower = text.toLowerCase();

  const bleeding = lower.includes('bleeding') || lower.includes('रक्त') || lower.includes('खून') || lower.includes('ರಕ್ತಸ್ರಾವ');
  const headache = lower.includes('headache') || lower.includes('सिरदर्द') || lower.includes('सर दर्द') || lower.includes('ತಲೆನೋವು');
  const convulsions = lower.includes('convulsion') || lower.includes('fits') || lower.includes('दौरा') || lower.includes('झटके') || lower.includes('ಫಿಟ್ಸ್');
  const blurredVision = lower.includes('blur') || lower.includes('vision') || lower.includes('धुंधला') || lower.includes('ಕಣ್ಣು ಮಬ್ಬು');
  const fever = lower.includes('fever') || lower.includes('बुखार') || lower.includes('ताप') || lower.includes('ಜ್ವರ');
  const abdominalPain = lower.includes('abdominal pain') || lower.includes('stomach pain') || lower.includes('पेट दर्द') || lower.includes('ಹೊಟ್ಟೆ ನೋವು');
  const swelling = lower.includes('swelling') || lower.includes('edema') || lower.includes('सूजन') || lower.includes('ಊತ');
  const reducedMovement = lower.includes('fetal movement') || lower.includes('हलचल कम') || lower.includes('ಚಲನೆ ಕಡಿಮೆ');

  const triggers: string[] = [];
  if (isBpHigh) triggers.push(lang === 'kn' ? 'ತೀವ್ರ ರಕ್ತದೊತ್ತಡ (BP ≥140/90)' : lang === 'en' ? 'Severe Hypertension (BP ≥140/90)' : 'अत्यधिक उच्च रक्तचाप (BP ≥140/90)');
  if (bleeding) triggers.push(lang === 'kn' ? 'ರಕ್ತಸ್ರಾವ (Bleeding Risk)' : lang === 'en' ? 'Vaginal Bleeding (Hemorrhage)' : 'रक्तस्राव (Hemorrhage Risk)');
  if (headache || blurredVision) triggers.push(lang === 'kn' ? 'ತೀವ್ರ ತಲೆನೋವು / ದೃಷ್ಟಿ ಮಬ್ಬು (Eclampsia Risk)' : lang === 'en' ? 'Severe Headache / Blurred Vision' : 'तेज सिरदर्द व चक्कर (प्री-एक्लेमप्सिया)');
  if (convulsions) triggers.push(lang === 'kn' ? 'ಫಿಟ್ಸ್ / ಸೆಳವು (Eclampsia)' : lang === 'en' ? 'Convulsions / Fits' : 'दौरे / झटके (Eclampsia)');
  if (fever) triggers.push(lang === 'kn' ? 'ತೀವ್ರ ಜ್ವರ (High Fever/Sepsis)' : lang === 'en' ? 'High Maternal Fever' : 'तेज बुखार');
  if (abdominalPain) triggers.push(lang === 'kn' ? 'ತೀವ್ರ ಹೊಟ್ಟೆ ನೋವು' : lang === 'en' ? 'Severe Epigastric Pain' : 'तीव्र पेट दर्द');
  if (swelling) triggers.push(lang === 'kn' ? 'ಮುಖ ಮತ್ತು ಕೈಕಾಲು ಊತ' : lang === 'en' ? 'Facial / Pedal Edema' : 'चेहरे व पैरों में सूजन');
  if (reducedMovement) triggers.push(lang === 'kn' ? 'ಮಗುವಿನ ಚಲನೆ ಕೊರತೆ' : lang === 'en' ? 'Reduced Fetal Movements' : 'गर्भस्थ शिशु की कम हलचल');

  if (triggers.length > 0) {
    return {
      isDanger: true,
      details: triggers.join(' • ')
    };
  }

  return { isDanger: false, details: '' };
}

/**
 * Master Clinical Parser Function
 */
export function parseClinicalSpeech(
  transcript: string,
  current: VisitData,
  lang: 'hi' | 'kn' | 'en'
): ClinicalParseResult {
  const lower = transcript.toLowerCase().trim();
  const detectedChanges: string[] = [];

  // 1. Voice Operating System Commands (Zero-Touch Voice Control)
  if (
    lower.includes('हाँ') || lower.includes('haan') || lower.includes('yes') ||
    lower.includes('save') || lower.includes('सहेजें') || lower.includes('हौदु') ||
    lower.includes('ಹೌದು') || lower.includes('ಸೇವ್') || lower.includes('ದಾಖಲಿಸು')
  ) {
    return {
      isVoiceCommand: true,
      commandType: 'CONFIRM_SAVE',
      updatedVisitData: current,
      readBackText: lang === 'kn' ? 'ದಾಖಲೆ ಉಳಿಸಲಾಗಿದೆ.' : lang === 'en' ? 'Record saved successfully.' : 'रिकॉर्ड सुरक्षित कर लिया गया है।',
      detectedChanges: ['Confirmed by voice']
    };
  }

  if (lower.includes('टास्क') || lower.includes('कार्य') || lower.includes('task') || lower.includes('ಕಾರ್ಯ')) {
    return {
      isVoiceCommand: true,
      commandType: 'NAVIGATE',
      targetTab: 'tasks',
      updatedVisitData: current,
      readBackText: lang === 'kn' ? 'ಕಾರ್ಯಗಳ ಪಟ್ಟಿ ತೆರೆಯಲಾಗಿದೆ.' : 'कार्य सूची खोली गई।',
      detectedChanges: ['Navigated to tasks']
    };
  }

  if (lower.includes('इतिहास') || lower.includes('history') || lower.includes('ಇತಿಹಾಸ') || lower.includes('ಹಿಂದಿನ')) {
    return {
      isVoiceCommand: true,
      commandType: 'NAVIGATE',
      targetTab: 'history',
      updatedVisitData: current,
      readBackText: lang === 'kn' ? 'ಹಿಂದಿನ ದಾಖಲೆಗಳು.' : 'पिछला इतिहास।',
      detectedChanges: ['Navigated to history']
    };
  }

  if (lower.includes('विज़िट') || lower.includes('visit') || lower.includes('ಭೇಟಿ')) {
    return {
      isVoiceCommand: true,
      commandType: 'NAVIGATE',
      targetTab: 'visit',
      updatedVisitData: current,
      readBackText: lang === 'kn' ? 'ಭೇಟಿ ವಿವರಗಳು.' : 'विज़िट विवरण।',
      detectedChanges: ['Navigated to visit']
    };
  }

  // 2. Clinical Extraction
  const updated = { ...current };

  // Beneficiary Name
  const newName = extractBeneficiaryName(transcript, current.beneficiaryName);
  if (newName !== current.beneficiaryName) {
    updated.beneficiaryName = newName;
    updated.rchId = `RCH-${Math.floor(10000 + Math.random() * 89999)}`;
    detectedChanges.push(`Beneficiary: ${newName}`);
  }

  // Weight
  const newWeight = extractWeight(transcript);
  if (newWeight && newWeight !== current.weightKg) {
    updated.weightKg = newWeight;
    detectedChanges.push(`Weight: ${newWeight} kg`);
  }

  // Blood Pressure
  const newBp = extractBloodPressure(transcript);
  let isBpHigh = false;
  if (newBp) {
    updated.bloodPressure = newBp.bp;
    isBpHigh = newBp.isHigh;
    detectedChanges.push(`BP: ${newBp.bp}`);
  }

  // Visit Stage (ANC 1-4, PNC)
  if (lower.includes('anc 1') || lower.includes('anc-1') || lower.includes('पहला') || lower.includes('ಮೊದಲ')) {
    updated.visitType = lang === 'kn' ? 'ANC-1 (ಮೊದಲ ಭೇಟಿ)' : lang === 'en' ? 'ANC-1 (1st Prenatal)' : 'ANC-1 (प्रथम प्रसव पूर्व)';
    detectedChanges.push('Visit: ANC-1');
  } else if (lower.includes('anc 2') || lower.includes('anc-2') || lower.includes('दूसरा') || lower.includes('ಎರಡನೇ')) {
    updated.visitType = lang === 'kn' ? 'ANC-2 (ದ್ವಿತೀಯ ಭೇಟಿ)' : lang === 'en' ? 'ANC-2 (2nd Prenatal)' : 'ANC-2 (द्वितीय प्रसव पूर्व)';
    detectedChanges.push('Visit: ANC-2');
  } else if (lower.includes('anc 3') || lower.includes('anc-3') || lower.includes('तीसरा') || lower.includes('ತೃತೀಯ')) {
    updated.visitType = lang === 'kn' ? 'ANC-3 (ತೃತೀಯ ಭೇಟಿ)' : lang === 'en' ? 'ANC-3 (3rd Prenatal)' : 'ANC-3 (तृतीय प्रसव पूर्व)';
    detectedChanges.push('Visit: ANC-3');
  } else if (lower.includes('anc 4') || lower.includes('anc-4') || lower.includes('चौथा') || lower.includes('ನಾಲ್ಕನೇ')) {
    updated.visitType = lang === 'kn' ? 'ANC-4 (ಚತುರ್ಥ ಭೇಟಿ)' : lang === 'en' ? 'ANC-4 (4th Prenatal)' : 'ANC-4 (चतुर्थ प्रसव पूर्व)';
    detectedChanges.push('Visit: ANC-4');
  } else if (lower.includes('pnc') || lower.includes('प्रसव पश्चात') || lower.includes('ಹೆರಿಗೆ ನಂತರ')) {
    updated.visitType = lang === 'kn' ? 'PNC-1 (ಹೆರಿಗೆ ನಂತರ)' : lang === 'en' ? 'PNC-1 (Postnatal)' : 'PNC-1 (प्रसव पश्चात)';
    detectedChanges.push('Visit: PNC-1');
  }

  // Vaccines & Supplements
  if (lower.includes('tt-1') || lower.includes('tt 1') || lower.includes('पहला टीटी')) {
    updated.vaccines = ['TT-1 टीका'];
    detectedChanges.push('Vaccine: TT-1');
  } else if (lower.includes('tt-2') || lower.includes('tt 2') || lower.includes('दूसरा टीटी') || lower.includes('tt')) {
    updated.vaccines = ['TT-2 टीका'];
    detectedChanges.push('Vaccine: TT-2');
  } else if (lower.includes('booster') || lower.includes('बूस्टर')) {
    updated.vaccines = ['TT Booster टीका'];
    detectedChanges.push('Vaccine: TT Booster');
  }

  if (lower.includes('ifa') || lower.includes('iron') || lower.includes('आयरन') || lower.includes('ಐರನ್')) {
    updated.supplements = ['30 IFA गोलियां'];
  }
  if (lower.includes('calcium') || lower.includes('कैल्शियम') || lower.includes('ಕ್ಯಾಲ್ಸಿಯಂ')) {
    updated.supplements = [...updated.supplements, 'Calcium गोलियां'];
  }

  // Danger Signs
  const danger = detectDangerSigns(transcript, isBpHigh, lang);
  if (danger.isDanger) {
    updated.isDangerSign = true;
    updated.dangerDetails = danger.details;
    updated.phcReferralNeeded = true;
    updated.nextVisitDate = lang === 'kn' ? 'ತಕ್ಷಣ PHC ಆಸ್ಪತ್ರೆ' : lang === 'en' ? 'IMMEDIATE PHC REFERRAL' : 'तत्काल PHC रेफरल';
    updated.followUps = [
      {
        id: `d-${Date.now()}-1`,
        text: lang === 'kn' ? '108 ಆಂಬ್ಯುಲೆನ್ಸ್ ಮೂಲಕ ತಕ್ಷಣ PHC ವರ್ಗಾವಣೆ' : lang === 'en' ? 'Immediate 108 Ambulance Transfer to PHC' : '108 एम्बुलेंस द्वारा PHC अस्पताल तुरंत रेफरल',
        dueDate: 'IMMEDIATE',
        completed: false,
        priority: 'high'
      },
      {
        id: `d-${Date.now()}-2`,
        text: lang === 'kn' ? 'PHC ವೈದ್ಯರಿಗೆ ತುರ್ತು ಎಚ್ಚರಿಕೆ ರವಾನೆ' : lang === 'en' ? 'Emergency Alert to PHC Medical Officer' : 'पीएचसी चिकित्सा अधिकारी को इमरजेंसी अलर्ट',
        dueDate: 'TODAY',
        completed: true,
        priority: 'high'
      }
    ];
    detectedChanges.push(`DANGER FLAG: ${danger.details}`);
  } else if (lower.includes('normal') || lower.includes('सामान्य') || lower.includes('ठीक')) {
    updated.isDangerSign = false;
    updated.dangerDetails = '';
    updated.phcReferralNeeded = false;
    updated.nextVisitDate = '28 Nov 2026';
  }

  // 3. Dynamic Read-Back Generation in the Active Indic Language
  let readBack = '';
  if (updated.isDangerSign) {
    if (lang === 'kn') {
      readBack = `ಎಚ್ಚರಿಕೆ! ${updated.beneficiaryName}: ರಕ್ತದೊತ್ತಡ ${updated.bloodPressure}. ${updated.dangerDetails}. ರೋಗಿಯನ್ನು ತಕ್ಷಣವೇ PHC ಆಸ್ಪತ್ರೆಗೆ ಕಳುಹಿಸಿ!`;
    } else if (lang === 'en') {
      readBack = `Warning! ${updated.beneficiaryName}: Blood pressure ${updated.bloodPressure}. ${updated.dangerDetails}. Immediate PHC hospital referral required!`;
    } else {
      readBack = `सावधानी! ${updated.beneficiaryName}: रक्तचाप ${updated.bloodPressure}। ${updated.dangerDetails}। मरीज को तुरंत PHC अस्पताल रेफर करें!`;
    }
  } else {
    if (lang === 'kn') {
      readBack = `${updated.beneficiaryName}: ತೂಕ ${updated.weightKg} ಕೆಜಿ, BP ${updated.bloodPressure}, ${updated.vaccines.join(' ')}. ಮುಂದಿನ ಭೇಟಿ ${updated.nextVisitDate}.`;
    } else if (lang === 'en') {
      readBack = `${updated.beneficiaryName}: Weight ${updated.weightKg} kg, BP ${updated.bloodPressure}, ${updated.vaccines.join(' ')}. Next visit ${updated.nextVisitDate}.`;
    } else {
      readBack = `${updated.beneficiaryName}: वजन ${updated.weightKg} किलो, BP ${updated.bloodPressure}, ${updated.vaccines.join(' ')}। अगला दौरा ${updated.nextVisitDate}।`;
    }
  }

  return {
    isVoiceCommand: false,
    commandType: 'CORRECT_FIELD',
    updatedVisitData: updated,
    readBackText: readBack,
    detectedChanges
  };
}
