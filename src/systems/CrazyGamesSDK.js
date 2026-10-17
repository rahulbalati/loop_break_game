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
  }

  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      if (typeof window !== 'undefined' && window.CrazyGames && window.CrazyGames.SDK) {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('CrazyGames SDK init timeout fallback')), 1500)
          );
          await Promise.race([window.CrazyGames.SDK.init(), timeoutPromise]);
          this.hasSDK = true;
          this.isInitialized = true;
          console.log('[CrazyGames] SDK v3 initialized successfully');

          // Platform Master Audio Mute Settings Sync
          const initialMute = window.CrazyGames.SDK.game?.settings?.muteAudio;
          if (typeof initialMute === 'boolean') {
            audio.setSdkMute(initialMute);
          }

          window.CrazyGames.SDK.game?.addSettingsChangeListener?.((settings) => {
            if (typeof settings?.muteAudio === 'boolean') {
              audio.setSdkMute(settings.muteAudio);
            }
          });
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
      window.CrazyGames?.SDK?.game?.loadingStart();
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
      window.CrazyGames?.SDK?.game?.loadingStop();
    } catch (_) {}
  }

  gameplayStart() {
    // Safety requirement: loadingStop must precede gameplayStart
    if (!this.hasLoadingStopped) {
      this.loadingStop();
    }

    try {
      window.CrazyGames?.SDK?.game?.gameplayStart();
    } catch (e) {
      console.warn('[CrazyGames] gameplayStart error', e);
    }
  }

  gameplayStop() {
    try {
      window.CrazyGames?.SDK?.game?.gameplayStop();
    } catch (e) {
      console.warn('[CrazyGames] gameplayStop error', e);
    }
  }

  happytime() {
    try {
      window.CrazyGames?.SDK?.game?.happytime();
    } catch (e) {
      console.warn('[CrazyGames] happytime error', e);
    }
  }

  // --- Data Module (CrazyGames Cloud Save with LocalStorage Fallback) ---
  getItem(key) {
    if (this.isInitialized) {
      try {
        if (window.CrazyGames?.SDK?.data) {
          const val = window.CrazyGames.SDK.data.getItem(key);
          if (val !== null && val !== undefined) return val;
        }
      } catch (_) {}
    }
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  setItem(key, value) {
    if (this.isInitialized) {
      try {
        if (window.CrazyGames?.SDK?.data) {
          window.CrazyGames.SDK.data.setItem(key, value);
        }
      } catch (_) {}
    }
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  }

  // --- Midgame Interstitial Ad (SDK v3 format with complete audio muting) ---
  requestMidgameAd(onComplete) {
    if (this.isAdPlaying) {
      if (onComplete) onComplete();
      return;
    }
    this.isAdPlaying = true;
    let completed = false;

    const finish = () => {
      if (!completed) {
        completed = true;
        this.isAdPlaying = false;
        audio.setSdkMute(false);
        if (onComplete) onComplete();
      }
    };

    if (!this.hasSDK || !window.CrazyGames?.SDK?.ad?.requestAd) {
      // Mock ad delay for local/offline testing
      setTimeout(() => finish(), 250);
      return;
    }

    try {
      this.gameplayStop();
      window.CrazyGames.SDK.ad.requestAd('midgame', {
        adStarted: () => {
          audio.setSdkMute(true);
        },
        adFinished: () => {
          finish();
        },
        adError: (err) => {
          console.warn('[CrazyGames] Midgame ad notice / unfilled:', err);
          finish();
        }
      }).catch((e) => {
        console.warn('[CrazyGames] Midgame ad request caught error', e);
        finish();
      });
    } catch (err) {
      console.warn('[CrazyGames] Midgame ad error', err);
      finish();
    }
  }

  // Backward compatibility alias
  requestMidrollAd(onStart, onEnd) {
    if (onStart) onStart();
    this.requestMidgameAd(onEnd);
  }

  // --- Rewarded Video Ad (SDK v3 format with audio muting) ---
  requestRewardedAd(onReward, onFail) {
    if (this.isAdPlaying) return;
    this.isAdPlaying = true;
    let completed = false;
    let rewarded = false;

    const finish = () => {
      if (!completed) {
        completed = true;
        this.isAdPlaying = false;
        audio.setSdkMute(false);
        if (rewarded) {
          if (onReward) onReward();
        } else {
          if (onFail) onFail();
        }
      }
    };

    if (!this.hasSDK || !window.CrazyGames?.SDK?.ad?.requestAd) {
      // Mock reward immediately in standalone/dev mode
      rewarded = true;
      setTimeout(() => finish(), 300);
      return;
    }

    try {
      this.gameplayStop();
      window.CrazyGames.SDK.ad.requestAd('rewarded', {
        adStarted: () => {
          audio.setSdkMute(true);
        },
        adFinished: () => {
          rewarded = true;
          finish();
        },
        adError: (err) => {
          console.warn('[CrazyGames] Rewarded ad failed / unfilled:', err);
          rewarded = false;
          finish();
        }
      }).catch((e) => {
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
