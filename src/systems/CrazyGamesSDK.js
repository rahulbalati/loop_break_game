// LOOP//BREAK - Official CrazyGames SDK v3 Integration Adapter & Platform Bridge
import { audio } from '../audio/AudioSynthesizer.js';

export class CrazyGamesSDK {
  constructor() {
    this.isInitialized = false;
    this.hasSDK = false;
    this.hasLoadingStarted = false;
    this.hasLoadingStopped = false;
    this.pendingLoadingStop = false;
    this.isAdPlaying = false;
    this.initPromise = null;
    this.isGameplayActive = false;
    this.lastMidgameAdAt = 0;
    this.locale = 'en-US';
  }

  get sdk() {
    return typeof window !== 'undefined' ? window.CrazyGames?.SDK : undefined;
  }

  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      if (this.sdk) {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('CrazyGames SDK init timeout fallback')), 1500)
          );
          await Promise.race([this.sdk.init(), timeoutPromise]);
          this.hasSDK = true;
          this.isInitialized = true;
          console.log('[CrazyGames] SDK v3 initialized successfully');

          // Platform master audio mute sync
          const initialMute = this.sdk.game?.settings?.muteAudio;
          if (typeof initialMute === 'boolean') {
            audio.setSdkMute(initialMute);
          }
          this.sdk.game?.addSettingsChangeListener?.((settings) => {
            if (typeof settings?.muteAudio === 'boolean') {
              audio.setSdkMute(settings.muteAudio);
            }
          });

          const sdkLocale = this.sdk.user?.systemInfo?.locale;
          if (typeof sdkLocale === 'string' && sdkLocale) this.locale = sdkLocale;
        } catch (err) {
          console.warn('[CrazyGames] SDK init skipped (local/standalone fallback)', err.message);
          this.hasSDK = false;
          this.isInitialized = true;
        }
      } else {
        console.log('[CrazyGames] Standalone/Local mode: Using mock SDK bridge');
        this.hasSDK = false;
        this.isInitialized = true;
      }
    })();

    return this.initPromise;
  }

  loadingStart() {
    if (this.hasLoadingStarted) return;
    this.hasLoadingStarted = true;
    try {
      this.sdk?.game?.loadingStart();
    } catch (_) {}

    if (this.pendingLoadingStop) {
      this.pendingLoadingStop = false;
      this.loadingStop();
    }
  }

  loadingStop() {
    if (this.hasLoadingStopped) return;
    if (!this.hasLoadingStarted) {
      this.pendingLoadingStop = true;
      return;
    }
    this.hasLoadingStopped = true;
    try {
      this.sdk?.game?.loadingStop();
    } catch (_) {}
  }

  gameplayStart() {
    // Safety requirement: loadingStop must precede gameplayStart
    if (!this.hasLoadingStopped) this.loadingStop();
    if (this.isGameplayActive) return;
    this.isGameplayActive = true;
    try {
      this.sdk?.game?.gameplayStart();
    } catch (e) {
      console.warn('[CrazyGames] gameplayStart error', e);
    }
  }

  gameplayStop() {
    if (!this.isGameplayActive) return;
    this.isGameplayActive = false;
    try {
      this.sdk?.game?.gameplayStop();
    } catch (e) {
      console.warn('[CrazyGames] gameplayStop error', e);
    }
  }

  happytime() {
    try {
      this.sdk?.game?.happytime();
    } catch (e) {
      console.warn('[CrazyGames] happytime error', e);
    }
  }

  // --- Data Module (CrazyGames cloud save). Only meaningful after init(). ---
  getCloudItem(key) {
    if (!this.hasSDK) return null;
    try {
      const val = this.sdk?.data?.getItem(key);
      return val === undefined ? null : val;
    } catch (_) {
      return null;
    }
  }

  getLocalItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  setItem(key, value) {
    if (this.hasSDK) {
      try {
        this.sdk?.data?.setItem(key, value);
      } catch (_) {}
    }
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  }

  // --- Midgame ad: only at natural breaks (run end). Skips silently if one played recently. ---
  requestMidgameAd(onComplete, minSecondsBetween = 0) {
    const now = Date.now();
    if (this.isAdPlaying || (this.lastMidgameAdAt && now - this.lastMidgameAdAt < minSecondsBetween * 1000)) {
      if (onComplete) onComplete();
      return;
    }
    this.lastMidgameAdAt = now;
    this.isAdPlaying = true;
    let completed = false;

    const finish = () => {
      if (completed) return;
      completed = true;
      this.isAdPlaying = false;
      audio.setSdkMute(false);
      if (onComplete) onComplete();
    };

    if (!this.hasSDK || !this.sdk?.ad?.requestAd) {
      setTimeout(finish, 150);
      return;
    }

    try {
      this.gameplayStop();
      this.sdk.ad.requestAd('midgame', {
        adStarted: () => audio.setSdkMute(true),
        adFinished: finish,
        adError: (err) => {
          console.warn('[CrazyGames] Midgame ad notice / unfilled:', err);
          finish();
        },
      })?.catch?.((e) => {
        console.warn('[CrazyGames] Midgame ad request caught error', e);
        finish();
      });
    } catch (err) {
      console.warn('[CrazyGames] Midgame ad error', err);
      finish();
    }
  }

  // --- Rewarded ad. onFail fires on adblock / no fill so the game never soft-locks. ---
  requestRewardedAd(onReward, onFail) {
    if (this.isAdPlaying) {
      if (onFail) onFail();
      return;
    }
    this.isAdPlaying = true;
    let completed = false;
    let rewarded = false;

    const finish = () => {
      if (completed) return;
      completed = true;
      this.isAdPlaying = false;
      audio.setSdkMute(false);
      if (rewarded) {
        if (onReward) onReward();
      } else if (onFail) {
        onFail();
      }
    };

    if (!this.hasSDK || !this.sdk?.ad?.requestAd) {
      // Local/dev mode: grant the reward so the flow can be tested
      rewarded = true;
      setTimeout(finish, 300);
      return;
    }

    try {
      this.gameplayStop();
      this.sdk.ad.requestAd('rewarded', {
        adStarted: () => audio.setSdkMute(true),
        adFinished: () => {
          rewarded = true;
          finish();
        },
        adError: (err) => {
          console.warn('[CrazyGames] Rewarded ad failed / unfilled:', err);
          finish();
        },
      })?.catch?.((e) => {
        console.warn('[CrazyGames] Rewarded ad catch error', e);
        finish();
      });
    } catch (err) {
      console.warn('[CrazyGames] Rewarded ad error', err);
      finish();
    }
  }
}

export const platform = new CrazyGamesSDK();
