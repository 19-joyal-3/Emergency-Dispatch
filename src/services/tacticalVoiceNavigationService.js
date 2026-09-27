/**
 * Tactical Spoken Voice & Audio Navigation Engine
 * Dual-Language: English & Malayalam (മലയാളം)
 * Powered by Web Speech API & Web Audio Synthesizer
 * 
 * Features:
 * 1. Prioritized audio dispatch queue (Hazards > Dam Floods > Weather Alerts > Turn Maneuvers)
 * 2. Pre-chime tactical alerts for critical warnings
 * 3. Malayalam voice synthesis with resilient phonetic fallback
 * 4. Anti-spam repetition cooldown timer
 */

import { playTacticalChime, playEvacuationSiren } from '../audio.js';

// Priority Enums
export const VOICE_PRIORITY = {
  CRITICAL_HAZARD: 1,
  DAM_ALERT: 2,
  WEATHER_WARNING: 3,
  MANEUVER: 4,
  STATUS_INFO: 5
};

class TacticalVoiceNavigationService {
  constructor() {
    this.isEnabled = true;
    this.currentLanguage = 'en'; // 'en' | 'ml'
    this.volume = 0.9;
    this.rate = 1.0;
    this.pitch = 1.0;
    this.availableVoices = [];
    this.recentSpokenCache = new Map(); // key -> timestamp
    this.cooldownSeconds = 30; // Min seconds before repeating identical warning

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.initVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.initVoices();
      }
    } else {
      this.synth = null;
    }
  }

  initVoices() {
    if (!this.synth) return;
    try {
      this.availableVoices = this.synth.getVoices() || [];
    } catch (_err) {
      this.availableVoices = [];
    }
  }

  setEnabled(enabled) {
    this.isEnabled = Boolean(enabled);
    if (!this.isEnabled && this.synth) {
      this.synth.cancel();
    }
  }

  setLanguage(lang) {
    if (lang === 'ml' || lang === 'en') {
      this.currentLanguage = lang;
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  getBestVoice(langCode) {
    if (!this.availableVoices || this.availableVoices.length === 0) {
      this.initVoices();
    }

    if (langCode === 'ml') {
      // Look for Malayalam voice (ml-IN, Malayalam, etc.)
      const mlVoice = this.availableVoices.find(v => 
        v.lang?.toLowerCase().includes('ml') || 
        v.name?.toLowerCase().includes('malayalam')
      );
      if (mlVoice) return mlVoice;
      
      // Fallback: Indian English voice with natural Indian accent
      const inVoice = this.availableVoices.find(v => 
        v.lang?.toLowerCase().includes('en-in') || 
        v.name?.toLowerCase().includes('india')
      );
      if (inVoice) return inVoice;
    }

    // Default English / system voice
    const enVoice = this.availableVoices.find(v => 
      v.lang?.toLowerCase().startsWith('en')
    );
    return enVoice || this.availableVoices[0] || null;
  }

  /**
   * Check if speech utterance can be spoken without repetition spam
   */
  shouldSpeak(key) {
    if (!this.isEnabled) return false;
    const now = Date.now();
    const lastSpoken = this.recentSpokenCache.get(key);
    if (lastSpoken && (now - lastSpoken) < (this.cooldownSeconds * 1000)) {
      return false;
    }
    this.recentSpokenCache.set(key, now);
    return true;
  }

  /**
   * Speak a voice prompt with priority handling and optional pre-alert chime
   */
  speak({
    textEn,
    textMl,
    priority = VOICE_PRIORITY.MANEUVER,
    preChime = false,
    cacheKey = null
  }) {
    if (!this.isEnabled || !this.synth) return;

    const key = cacheKey || (this.currentLanguage === 'ml' ? textMl : textEn);
    if (!this.shouldSpeak(key)) return;

    // Trigger pre-chimes for high-priority alerts
    if (preChime || priority <= VOICE_PRIORITY.DAM_ALERT) {
      if (priority === VOICE_PRIORITY.CRITICAL_HAZARD) {
        playEvacuationSiren(1.2, 0.25);
      } else {
        playTacticalChime(0.3);
      }
    }

    // Delay slightly if siren is playing
    const delayMs = priority === VOICE_PRIORITY.CRITICAL_HAZARD ? 650 : (preChime ? 350 : 0);

    setTimeout(() => {
      try {
        const textToSpeak = this.currentLanguage === 'ml' && textMl ? textMl : textEn;
        if (!textToSpeak) return;

        // If high priority, cancel lower priority ongoing utterances
        if (priority <= VOICE_PRIORITY.DAM_ALERT && this.synth.speaking) {
          this.synth.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        const voice = this.getBestVoice(this.currentLanguage);
        if (voice) {
          utterance.voice = voice;
        }

        utterance.lang = this.currentLanguage === 'ml' ? 'ml-IN' : 'en-US';
        utterance.volume = this.volume;
        utterance.rate = this.currentLanguage === 'ml' ? 0.95 : this.rate;
        utterance.pitch = this.pitch;

        this.synth.speak(utterance);
      } catch (err) {
        console.warn('[VOICE NAV] Failed to synthesize speech:', err);
      }
    }, delayMs);
  }

  /**
   * Speak Turn Maneuver (Turn left, continue straight, etc.)
   */
  announceManeuver(instructionEn, distanceMeters = null) {
    if (!instructionEn) return;

    let textEn = instructionEn;
    let textMl = instructionEn;

    const lower = instructionEn.toLowerCase();
    const distTextEn = distanceMeters ? `In ${Math.round(distanceMeters)} meters, ` : '';
    const distTextMl = distanceMeters ? `${Math.round(distanceMeters)} മീറ്ററിൽ ` : '';

    if (lower.includes('turn left')) {
      textEn = `${distTextEn}turn left.`;
      textMl = `${distTextMl}ഇടത്തോട്ട് തിരിയുക.`;
    } else if (lower.includes('turn right')) {
      textEn = `${distTextEn}turn right.`;
      textMl = `${distTextMl}വലത്തോട്ട് തിരിയുക.`;
    } else if (lower.includes('slight left')) {
      textEn = `${distTextEn}keep slight left.`;
      textMl = `${distTextMl}നേരിയ ഇടത്തോട്ട് പോകുക.`;
    } else if (lower.includes('slight right')) {
      textEn = `${distTextEn}keep slight right.`;
      textMl = `${distTextMl}നേരിയ വലത്തോട്ട് പോകുക.`;
    } else if (lower.includes('u-turn') || lower.includes('uturn')) {
      textEn = `${distTextEn}make a legal U-turn.`;
      textMl = `${distTextMl}യു-ടേൺ എടുക്കുക.`;
    } else if (lower.includes('continue') || lower.includes('straight') || lower.includes('head')) {
      textEn = `${distTextEn}continue straight along current corridor.`;
      textMl = `${distTextMl}നേരെ മുന്നോട്ട് തുടരുക.`;
    } else if (lower.includes('destination') || lower.includes('arrive')) {
      textEn = `You have arrived at your emergency destination.`;
      textMl = `നിങ്ങൾ ലക്ഷ്യസ്ഥാനത്ത് എത്തിച്ചേർന്നു.`;
    }

    this.speak({
      textEn,
      textMl,
      priority: VOICE_PRIORITY.MANEUVER,
      preChime: false,
      cacheKey: `maneuver_${instructionEn}_${Math.round((distanceMeters || 0) / 100)}`
    });
  }

  /**
   * Announce Critical Hazard Warning (Landslide, bridge collapse, road blockage)
   */
  announceHazardAlert(hazardType, distanceKm, locationName = '') {
    const dStr = distanceKm < 1 ? `${Math.round(distanceKm * 1000)} meters` : `${distanceKm.toFixed(1)} kilometers`;
    const dStrMl = distanceKm < 1 ? `${Math.round(distanceKm * 1000)} മീറ്റർ` : `${distanceKm.toFixed(1)} കിലോമീറ്റർ`;

    const textEn = `Emergency Warning! Active ${hazardType} detected ${dStr} ahead${locationName ? ` near ${locationName}` : ''}. Automated detour recommended.`;
    const textMl = `അടിയന്തര മുന്നറിയിപ്പ്! മുന്നിൽ ${dStrMl} അകലെ ${hazardType} റിപ്പോർട്ട് ചെയ്തിരിക്കുന്നു. സുരക്ഷിത വഴി സ്വീകരിക്കുക.`;

    this.speak({
      textEn,
      textMl,
      priority: VOICE_PRIORITY.CRITICAL_HAZARD,
      preChime: true,
      cacheKey: `hazard_${hazardType}_${Math.round(distanceKm)}`
    });
  }

  /**
   * Announce KSDMA Dam Spillway Alert
   */
  announceDamAlert(damName, alertLevel, district, basin) {
    const textEn = `KSDMA Alert! You are entering downstream flood zone of ${damName}, in ${district}. ${alertLevel} alert active for ${basin} basin.`;
    const textMl = `കെ.എസ്.ഡി.എം.എ മുന്നറിയിപ്പ്! ${damName} അണക്കെട്ടിന്റെ താഴ്വരയിലേക്ക് പ്രവേശിക്കുന്നു. ${alertLevel} അലർട്ട് നിലവിലുണ്ട്.`;

    this.speak({
      textEn,
      textMl,
      priority: VOICE_PRIORITY.DAM_ALERT,
      preChime: true,
      cacheKey: `dam_${damName}_${alertLevel}`
    });
  }

  /**
   * Announce KSDMA District Weather Warning
   */
  announceWeatherDistrictAlert(districtName, alertLevel, threat) {
    const textEn = `Weather Alert: Entering ${districtName} district under official KSDMA ${alertLevel} alert for ${threat}.`;
    const textMl = `കാലാവസ്ഥാ മുന്നറിയിപ്പ്: ${districtName} ജില്ലയിൽ ${alertLevel} അലർട്ട് നിലവിലുണ്ട്. ജാഗ്രത പാലിക്കുക.`;

    this.speak({
      textEn,
      textMl,
      priority: VOICE_PRIORITY.WEATHER_WARNING,
      preChime: true,
      cacheKey: `weather_${districtName}_${alertLevel}`
    });
  }

  /**
   * Stop ongoing audio speech
   */
  stop() {
    if (this.synth) {
      this.synth.cancel();
    }
  }
}

// Export Singleton Instance
export const tacticalVoiceNav = new TacticalVoiceNavigationService();
export default tacticalVoiceNav;
