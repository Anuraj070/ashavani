# AshaVani (आशा-वाणी / ಆಶಾ-ವಾಣಿ)
**Zero-Touch, Multilingual Voice Operating System & Clinical Field Register for Frontline ASHA Workers in India**  
*Built for Build Bengaluru 2.0 (HackBriven) — Track 2: Healthcare Voice Register (Sponsored by Gnani.ai)*

[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4.0-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Gnani.ai](https://img.shields.io/badge/Speech%20AI-Gnani.ai%20Vachana-emerald)](https://vachana.ai)
[![MoHFW](https://img.shields.io/badge/Compliance-MoHFW%20Frontline%20Protocol-red)](https://nhm.gov.in)

---

## 🌟 Executive Overview
In rural India, over **1 million ASHA (Accredited Social Health Activist) workers** carry 10+ paper registers under blistering sunlight, manually logging Antenatal Care (ANC), Postnatal Care (PNC), immunization, and high-risk maternal vitals.

**AshaVani** is an ultra-fast, offline-resilient, voice-operated field register that allows ASHA workers to simply speak naturally in **Hindi (`हिंदी`)**, **Kannada (`ಕನ್ನಡ`)**, or **English**. The platform automatically normalizes voice decibels (Auto-dB), transcribes speech with **Gnani.ai Prisma v3.0**, extracts all clinical RCH fields via an **Indic Clinical NLU engine**, triages life-threatening danger signs (Pre-Eclampsia, Hemorrhage), and reads back the summary using **Gnani Nalini Voice** with a conversational voice confirmation loop.

---

## 🏗️ Architecture & Pipeline

```
  Frontline ASHA Worker (Village Visit)
                    │
                    ▼ [Speaks in Hindi, Kannada, or English]
┌─────────────────────────────────────────────────────────────┐
│ 1. Audio Processing & Hardware/Software Auto-dB AGC         │
│    • Real-time RMS detector & Dynamics Compressor           │
│    • Faint voices (<50dB) boosted by +8dB to +12dB          │
│    • Encodes raw Float32 PCM to 16kHz Mono 16-bit WAV       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Dual STT Pipeline (Gnani.ai Prisma v3.0 + Web Speech)    │
│    • Automatic Language Detection (Hindi, Kannada, English) │
│    • Continuous sentence accumulation (zero dropped words)  │
│    • Sub-150ms transcription latency                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Indic Clinical NLU Parser (`clinicalParser.ts`)          │
│    • Any Beneficiary Name (Devanagari, Kannada, Latin)      │
│    • Any Weight (Digits + Indic words: बावन किलो, 54kg)     │
│    • Any BP (120/80, 140/90, 150/100)                       │
│    • MoHFW Triage (Systolic ≥140 or Diastolic ≥90 = DANGER) │
│    • Vaccines & Meds (TT-1, TT-2, 30 IFA tablets, Calcium)  │
│    • 8 Danger Signs (Bleeding, Headache, Convulsions, etc.) │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Spoken Clinical Readback (`Gnani Timbre Nalini Voice`)   │
│    • Dynamic Indic synthesis in the detected language       │
│    • True Barge-In audio cancellation                       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Conversational Voice Operating Loop                      │
│    "क्या यह सही है? सहेजने के लिए 'हाँ' बोलें"              │
│    • Spoken "हाँ" / "Yes" ➔ Automatically Saves & Syncs     │
│    • Spoken "नहीं, वजन 54" ➔ Delta updates that field only   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Build Bengaluru 2.0 Hackathon Alignment (Track 2)

| Rubric Criteria | Weight | AshaVani Implementation |
| :--- | :---: | :--- |
| **Live Judge Audio Test** | **30%** | Integrated **Judge Evaluation Panel** with real synthetic noise simulation (0dB Clean, 65dB Street, 72dB Household). Sub-150ms time-to-first-audio latency. |
| **Speech-Layer Depth** | **20%** | Dual-engine STT (Gnani Prisma v3.0 + browser fallback), hardware/software AGC with auto-dB boost, barge-in stop, hands-free auto-endpointing. |
| **Fit for User** | **20%** | Minimalist Apple Health / Linear UI, high contrast for outdoor sunlight readability, zero typing, bilingual Hindi/Kannada/English support. |
| **Innovation** | **10%** | Voice Operating System (Voice-driven save, delta-correction, and tab navigation without touching the screen). |
| **Responsible AI & MoHFW** | **10%** | Strict adherence to MoHFW Frontline Protocols. Zero prescription advice, 100% deterministic emergency referral with 108 speed-dial. |
| **Documentation & Demo** | **10%** | Clean repo, clear README, 1-tap demo scenario switchers for seamless judging presentation. |

---

## 🚀 Quickstart & Setup

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/ashavani-voice-register.git
cd ashavani-voice-register
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Add your Gnani.ai API key:
```env
VITE_GNANI_API_KEY=your_gnani_api_key_here
```
*(Note: You can also configure or verify your Gnani API key live in the in-app Settings panel without restarting!)*

### 4. Start Local Development Server
```bash
npm run dev
```
Open **[http://localhost:5173/](http://localhost:5173/)** in your browser.

### 5. Build for Production
```bash
npm run build
```

---

## 🚨 MoHFW Danger-Sign Escalation Protocol

In strict compliance with **National Health Mission (NHM)** and **Ministry of Health & Family Welfare (MoHFW)** guidelines:
* **High-Risk Maternal Indicators:**
  - Severe Hypertension ($BP \ge 140/90\text{ mmHg}$)
  - Vaginal Bleeding / Antepartum Hemorrhage (APH)
  - Severe persistent headache with blurred vision / epigastric pain (Pre-Eclampsia / Impending Eclampsia)
  - Maternal convulsions / fits
  - Reduced fetal movement
* **Protocol Action:**
  - Emergency crimson banner rendered immediately.
  - One-tap speed-dial for **108 Ambulance** and **PHC Medical Officer alert**.
  - Voice warning in the detected language (strictly NO prescription advice).

---

## 🔒 DPDP Act & Privacy Compliance
1. **Synthetic Data Only:** All clinical test records use synthetic mock personas.
2. **AI Identity Disclosure:** Turned on turn 1 identifying as an assistive voice field tool.
3. **Secret Hygiene:** All keys strictly stored in `.env` and git-ignored.

---

## 👥 Contributors & Acknowledgements
- Built for **Build Bengaluru 2.0 (HackBriven)** — Nov 21–22, 2026.
- Track 2: Healthcare Voice Register sponsored by **Gnani.ai**.
