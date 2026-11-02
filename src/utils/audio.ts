/**
 * Procedural Web Audio API Sound Engine for Gemstone Dice on Walnut Tabletop
 * Zero external file dependencies. Simulates wood resonance, crystalline clinks,
 * and critical roll chimes.
 */
class DiceAudioEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private lastImpactTime: number = 0;

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Plays an initial hand-release / cup-shake sound when dice are thrown
   */
  public playThrowSound(diceCount: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const clinks = Math.min(diceCount + 1, 6);

    for (let i = 0; i < clinks; i++) {
      const delay = i * 0.032 + Math.random() * 0.015;
      this.triggerCrystalTick(ctx, now + delay, 0.18 + Math.random() * 0.12, 2200 + Math.random() * 1400);
    }
  }

  /**
   * Plays physical collision sound when a gemstone die hits the wooden table or brass rim,
   * or collides with another gemstone die.
   */
  public playCollision(impactVelocity: number, isGemOnGem: boolean = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = performance.now();
    // Rate-limit dense simultaneous collisions slightly to avoid audio clipping
    if (now - this.lastImpactTime < 18) return;
    this.lastImpactTime = now;

    const strength = Math.min(Math.max((impactVelocity - 0.4) / 14, 0.04), 1.0);
    if (strength <= 0.04) return;

    const t = ctx.currentTime;

    if (isGemOnGem) {
      // Sharp crystalline gemstone-to-gemstone clink
      const baseFreq = 2600 + Math.random() * 1100;
      this.triggerCrystalTick(ctx, t, strength * 0.45, baseFreq);
      this.triggerCrystalTick(ctx, t + 0.004, strength * 0.25, baseFreq * 1.48);
    } else {
      // Hardwood walnut table thud + gemstone click transient
      this.triggerWoodTableThud(ctx, t, strength * 0.65);
      this.triggerCrystalTick(ctx, t, strength * 0.32, 1850 + Math.random() * 750);
    }
  }

  /**
   * Plays a subtle resonant chord when all dice settle and results are tallied
   */
  public playSettleChime(hasCrit: boolean, hasFumble: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = hasCrit
      ? [523.25, 659.25, 783.99, 1046.5] // C5 major triumphant fanfare
      : hasFumble
      ? [293.66, 277.18, 246.94] // Low muted minor descent
      : [440, 554.37, 659.25]; // Warm A-major triad

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = hasCrit ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      const peak = hasCrit ? 0.11 : 0.06;
      gain.gain.setValueAtTime(0.0001, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(peak, now + idx * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.48);
    });
  }

  private triggerWoodTableThud(ctx: AudioContext, startTime: number, gainAmount: number) {
    // Filtered noise burst + low wood body resonance
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const pitch = 115 + Math.random() * 45;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch * 1.6, startTime);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.55, startTime + 0.065);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(gainAmount, startTime + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.075);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.08);
  }

  private triggerCrystalTick(ctx: AudioContext, startTime: number, gainAmount: number, freq: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.82, startTime + 0.038);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(gainAmount, startTime + 0.0015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.042);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.045);
  }
}

export const diceAudio = new DiceAudioEngine();
