// ============================================================
// AUDIO MANAGER — Web Audio API ambient synth + SFX
// Generates sounds procedurally (no audio files needed)
// ============================================================

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientNodes: AudioNode[] = [];
  private enabled = true;

  init(): void {
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.15;
      this.masterGain.connect(this.ctx.destination);
      this.startAmbient();
    } catch (e) {
      console.warn('Audio not available:', e);
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(enabled ? 0.15 : 0, this.ctx!.currentTime, 0.3);
    }
  }

  // ── Ambient synthwave drone ────────────────────────────

  private startAmbient(): void {
    if (!this.ctx || !this.masterGain) return;

    // Low bass drone
    this.createDrone(55, 0.06, 'sawtooth');   // A1
    this.createDrone(82.5, 0.04, 'sine');      // E2
    this.createDrone(110, 0.03, 'sine');       // A2

    // Pad layer with slow LFO
    this.createPad(220, 0.02); // A3
    this.createPad(277.2, 0.015); // C#4
    this.createPad(330, 0.01); // E4

    // Glitchy high-freq shimmer
    this.scheduleShimmer();
  }

  private createDrone(freq: number, vol: number, type: OscillatorType): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.value = freq;
    osc.frequency.setTargetAtTime(freq * 1.001, this.ctx.currentTime, 2); // slight detune drift

    filter.type = 'lowpass';
    filter.frequency.value = 400;

    gain.gain.value = vol;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start();

    this.ambientNodes.push(osc, gain, filter);
  }

  private createPad(freq: number, vol: number): void {
    if (!this.ctx || !this.masterGain) return;

    // LFO for slow pitch wobble
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.2 + Math.random() * 0.3;
    lfoGain.gain.value = freq * 0.002;
    lfo.connect(lfoGain);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const reverb = this.createReverb();

    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    lfoGain.connect(osc.frequency);

    gain.gain.value = 0;
    gain.gain.setTargetAtTime(vol, this.ctx.currentTime, 2); // slow fade in

    osc.connect(gain);
    gain.connect(reverb);
    reverb.connect(this.masterGain!);

    lfo.start();
    osc.start();

    this.ambientNodes.push(osc, gain, lfo, lfoGain);
  }

  private createReverb(): ConvolverNode {
    const ctx = this.ctx!;
    const convolver = ctx.createConvolver();
    const length = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }

    convolver.buffer = buffer;
    return convolver;
  }

  private scheduleShimmer(): void {
    if (!this.ctx || !this.masterGain) return;

    const shimmer = () => {
      if (!this.enabled || !this.ctx || !this.masterGain) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const freq = 880 + Math.random() * 2640;

      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.008, this.ctx.currentTime + 0.01);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.4);

      setTimeout(shimmer, 2000 + Math.random() * 5000);
    };

    setTimeout(shimmer, 3000);
  }

  // ── SFX ────────────────────────────────────────────────

  playPlant(): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(880, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playRemove(): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(110, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playMove(): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 660 + Math.random() * 220;
    gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playChat(): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1320;
    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  resume(): void {
    this.ctx?.resume();
  }
}

export const audio = new AudioManager();
