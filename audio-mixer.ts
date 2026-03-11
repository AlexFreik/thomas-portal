export class AudioMixer {
    private ctx: AudioContext;

    private videoSource?: MediaElementAudioSourceNode;
    private micSource?: MediaStreamAudioSourceNode;

    private masterDest: MediaStreamAudioDestinationNode;
    private headphoneDest: MediaStreamAudioDestinationNode;

    private masterGain: GainNode;
    private micGain: GainNode;
    private headphoneGain: GainNode;

    private micAnalyser: AnalyserNode;
    private masterAnalyser: AnalyserNode;

    private masterAudio: HTMLAudioElement;
    private headphoneAudio: HTMLAudioElement;

    private micMonitorEnabled = false;

    constructor() {
        this.ctx = new AudioContext();

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 1;

        this.micGain = this.ctx.createGain();
        this.micGain.gain.value = 0;

        this.headphoneGain = this.ctx.createGain();
        this.headphoneGain.gain.value = 1;

        this.micAnalyser = this.ctx.createAnalyser();
        this.masterAnalyser = this.ctx.createAnalyser();

        this.micAnalyser.fftSize = 256;
        this.masterAnalyser.fftSize = 256;

        this.masterDest = this.ctx.createMediaStreamDestination();
        this.headphoneDest = this.ctx.createMediaStreamDestination();

        this.masterAudio = new Audio();
        this.headphoneAudio = new Audio();

        this.masterAudio.srcObject = this.masterDest.stream;
        this.headphoneAudio.srcObject = this.headphoneDest.stream;

        this.masterAudio.autoplay = true;
        this.headphoneAudio.autoplay = true;

        this.masterAudio.muted = false;
        this.headphoneAudio.muted = false;

        this.masterAudio.play().catch(() => {});
        this.headphoneAudio.play().catch(() => {});

        // master chain
        this.masterGain.connect(this.masterAnalyser);
        this.masterAnalyser.connect(this.masterDest);
        this.headphoneGain.connect(this.headphoneDest);
    }

    attachMediaElement(el: HTMLMediaElement) {
        if (this.videoSource) return;

        this.videoSource = this.ctx.createMediaElementSource(el);

        // send video to headphones
        this.videoSource.connect(this.headphoneGain);

        // send video to master
        this.videoSource.connect(this.masterGain);
    }

    async startMic(deviceId: string) {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId },
        });

        this.micSource = this.ctx.createMediaStreamSource(stream);

        this.micSource.connect(this.micGain);
        this.micGain.connect(this.micAnalyser);
        this.micAnalyser.connect(this.masterGain);
    }

    muteMic() {
        this.micGain.gain.value = 0;
    }

    unmuteMic() {
        this.micGain.gain.value = 1;
    }

    setMicMonitor(enabled: boolean) {
        this.micMonitorEnabled = enabled;

        if (!this.micAnalyser) return;

        try {
            this.micAnalyser.disconnect(this.headphoneGain);
        } catch {}

        if (enabled) {
            this.micAnalyser.connect(this.headphoneGain);
        }
    }

    setMasterVolume(percent: number) {
        const gain = Math.min(percent / 100, 3);

        this.masterGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
    }

    async setMasterSpeaker(deviceId: string) {
        const audio = this.masterAudio as any;

        if (deviceId == 'none') this.masterGain.gain.value = 0;
        else this.masterGain.gain.value = 1;

        if (audio.setSinkId) await audio.setSinkId(deviceId);
    }

    async setHeadphones(deviceId: string) {
        const audio = this.headphoneAudio as any;

        if (deviceId == 'none') this.masterGain.gain.value = 0;
        else this.masterGain.gain.value = 1;

        if (audio.setSinkId && deviceId !== 'none') await audio.setSinkId(deviceId);
    }

    getMicAnalyser() {
        return this.micAnalyser;
    }

    getMasterAnalyser() {
        return this.masterAnalyser;
    }

    async listDevices() {
        const devices = await navigator.mediaDevices.enumerateDevices();

        return {
            cameras: devices.filter((d) => d.kind === 'videoinput'),
            mics: devices.filter((d) => d.kind === 'audioinput'),
            speakers: devices.filter((d) => d.kind === 'audiooutput'),
        };
    }

    getAudioLevel(analyser: AnalyserNode): number {
        const data = new Uint8Array(analyser.fftSize);

        analyser.getByteTimeDomainData(data);

        let sum = 0;

        for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
        }

        const rms = Math.sqrt(sum / data.length);

        return rms;
    }

    async resume() {
        if (this.ctx.state !== 'running') {
            await this.ctx.resume();
        }

        if (this.masterAudio.paused) {
            try {
                await this.masterAudio.play();
            } catch {}
        }

        if (this.headphoneAudio.paused) {
            try {
                await this.headphoneAudio.play();
            } catch {}
        }
    }
}
