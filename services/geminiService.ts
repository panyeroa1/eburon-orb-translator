
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { decode, decodeAudioData } from "./audioUtils";
import { DEFAULT_LIVE_API_MODEL, SYSTEM_INSTRUCTION } from "../constants";

export interface LiveServiceCallbacks {
  onTranscription: (text: string) => void;
  onAudioStarted: () => void;
  onAudioEnded: () => void;
  onTurnComplete: () => void;
  onError: (err: any) => void;
  onConnected: () => void;
}

export class GeminiLiveService {
  private ai: GoogleGenAI | null = null;
  private audioContext: AudioContext;
  private nextStartTime: number = 0;
  private sources: Set<AudioBufferSourceNode> = new Set();
  private outputNode: GainNode;
  private sessionPromise: Promise<any> | null = null;
  private currentVoice: string = "Charon";
  
  constructor(orbitToken?: string) {
    if (orbitToken) {
      this.ai = new GoogleGenAI({ apiKey: orbitToken });
    }
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    this.outputNode = this.audioContext.createGain();
    this.outputNode.connect(this.audioContext.destination);
  }

  public updateOrbitToken(token: string) {
    console.log("[ORBIT]: Rotating Token...");
    this.ai = new GoogleGenAI({ apiKey: token });
  }

  private async resumeContext() {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  public getAnalyser() {
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    this.outputNode.connect(analyser);
    return analyser;
  }

  /**
   * Establishes a persistent Live Session (WebSocket)
   */
  public async connect(
    targetLanguage: string, 
    voice: string, 
    callbacks: LiveServiceCallbacks
  ) {
    if (!this.ai) {
      console.warn("[ORBIT]: System Offline - Missing Token.");
      return;
    }
    
    this.currentVoice = voice;
    await this.resumeContext();

    console.log("[ORBIT]: Initiating Matrix Link...");
    
    try {
      this.sessionPromise = this.ai.live.connect({
        model: DEFAULT_LIVE_API_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: this.currentVoice } },
          },
          systemInstruction: `${SYSTEM_INSTRUCTION} TARGET LANGUAGE: ${targetLanguage}`,
        },
        callbacks: {
          onopen: () => {
            console.log("[ORBIT]: Matrix Link Established.");
            callbacks.onConnected();
          },
          onmessage: async (message: LiveServerMessage) => {
            // Audio output from model
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              this.playAudioChunk(base64Audio, callbacks);
            }

            // End of turn (translation complete)
            if (message.serverContent?.turnComplete) {
              callbacks.onTurnComplete();
            }
          },
          onerror: (e) => {
            console.error("[ORBIT]: Matrix Disruption.", e);
            callbacks.onError(e);
          },
          onclose: () => {
            console.log("[ORBIT]: Matrix Link Severed.");
          }
        }
      });
    } catch (err) {
      callbacks.onError(err);
    }
  }

  private async playAudioChunk(base64: string, callbacks: LiveServiceCallbacks) {
    try {
      callbacks.onAudioStarted();
      const audioBytes = decode(base64);
      const audioBuffer = await decodeAudioData(audioBytes, this.audioContext);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputNode);
      
      this.nextStartTime = Math.max(this.nextStartTime, this.audioContext.currentTime);
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;

      source.onended = () => {
        this.sources.delete(source);
        if (this.sources.size === 0) {
          callbacks.onAudioEnded();
        }
      };
      this.sources.add(source);
    } catch (e) {
      console.error("[ORBIT]: Synthesis Failure.", e);
    }
  }

  /**
   * Sends text via the clientContent channel to trigger translation
   */
  public async sendText(text: string) {
    if (!this.sessionPromise) return;

    try {
      const session = await this.sessionPromise;
      // For low-latency Live API, we send the text as a completed turn
      // to ensure the model immediately translates and speaks.
      session.sendRealtimeInput({
        clientContent: {
          turns: [{ parts: [{ text: text }] }],
          turnComplete: true
        }
      });
    } catch (e) {
      console.error("[ORBIT]: Signal Transmission Failure.", e);
    }
  }

  public disconnect() {
    this.stopAllAudio();
    if (this.sessionPromise) {
      this.sessionPromise.then(s => s.close());
      this.sessionPromise = null;
    }
  }

  private stopAllAudio() {
    for (const source of this.sources) {
      try { source.stop(); } catch(e) {}
    }
    this.sources.clear();
    this.nextStartTime = 0;
  }
}
