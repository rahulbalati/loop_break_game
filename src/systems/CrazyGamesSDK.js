// LOOP//BREAK - CrazyGames v3 SDK Platform Adapter & Mock Bridge

export class CrazyGamesSDK {
  constructor() {
    this.isInitialized = false;
    this.hasSDK = false;
    this.isAdPlaying = false;
  }

  async init() {
    if (typeof window !== 'undefined' && window.CrazyGames && window.CrazyGames.SDK) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('CrazyGames SDK init timeout on localhost')), 1200)
        );
        await Promise.race([window.CrazyGames.SDK.init(), timeoutPromise]);
        this.hasSDK = true;
        this.isInitialized = true;
        console.log('[CrazyGames] SDK v3 initialized successfully');
      } catch (err) {
        console.warn('[CrazyGames] SDK init skipped (local/standalone mode)', err.message);
        this.hasSDK = false;
        this.isInitialized = true;
      }
    } else {
      console.log('[CrazyGames] Standalone/Local mode: Using mock SDK bridge');
      this.hasSDK = false;
      this.isInitialized = true;
    }
  }

  gameplayStart() {
    if (!this.hasSDK) return;
    try {
      window.CrazyGames.SDK.game.gameplayStart();
    } catch (e) {
      console.warn('[CrazyGames] gameplayStart error', e);
    }
  }

  gameplayStop() {
    if (!this.hasSDK) return;
    try {
      window.CrazyGames.SDK.game.gameplayStop();
    } catch (e) {
      console.warn('[CrazyGames] gameplayStop error', e);
    }
  }

  happytime() {
    if (!this.hasSDK) return;
    try {
      window.CrazyGames.SDK.game.happytime();
    } catch (e) {
      console.warn('[CrazyGames] happytime error', e);
    }
  }

  async requestMidrollAd(onStart, onEnd) {
    if (this.isAdPlaying) return;
    this.isAdPlaying = true;
    if (onStart) onStart();

    if (!this.hasSDK) {
      // Mock ad delay for local testing
      setTimeout(() => {
        this.isAdPlaying = false;
        if (onEnd) onEnd();
      }, 300);
      return;
    }

    try {
      this.gameplayStop();
      await window.CrazyGames.SDK.ad.requestAd('midroll');
    } catch (err) {
      console.warn('[CrazyGames] Midroll ad error or adblock', err);
    } finally {
      this.isAdPlaying = false;
      if (onEnd) onEnd();
      this.gameplayStart();
    }
  }

  async requestRewardedAd(onReward, onFail) {
    if (this.isAdPlaying) return;
    this.isAdPlaying = true;

    if (!this.hasSDK) {
      // In local mode, immediately award reward for testing
      console.log('[CrazyGames Mock] Rewarded ad completed, granting bonus!');
      this.isAdPlaying = false;
      if (onReward) onReward();
      return;
    }

    try {
      this.gameplayStop();
      await window.CrazyGames.SDK.ad.requestAd('rewarded');
      if (onReward) onReward();
    } catch (err) {
      console.warn('[CrazyGames] Rewarded ad failed or closed', err);
      if (onFail) onFail();
    } finally {
      this.isAdPlaying = false;
      this.gameplayStart();
    }
  }
}

export const platform = new CrazyGamesSDK();
