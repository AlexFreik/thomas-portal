export class AudioMixer {
    constructor() {
        this.micMonitorEnabled = true;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 1;
        this.micGain = this.ctx.createGain();
        this.micGain.gain.value = 0;
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
        this.masterAudio.play().catch(() => { });
        this.headphoneAudio.play().catch(() => { });
        // master chain
        this.masterGain.connect(this.masterAnalyser);
        this.masterAnalyser.connect(this.masterDest);
    }
    attachMediaElement(el) {
        if (this.videoSource)
            return;
        this.videoSource = this.ctx.createMediaElementSource(el);
        // send video to headphones
        this.videoSource.connect(this.headphoneDest);
        // send video to master
        this.videoSource.connect(this.masterGain);
    }
    async startMic(deviceId) {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId },
        });
        this.micSource = this.ctx.createMediaStreamSource(stream);
        this.micSource.connect(this.micGain);
        this.micGain.connect(this.micAnalyser);
        this.micAnalyser.connect(this.masterGain);
        // optional preview in headphones
        if (this.micMonitorEnabled)
            this.micAnalyser.connect(this.headphoneDest);
    }
    muteMic() {
        this.micGain.gain.value = 0;
    }
    unmuteMic() {
        this.micGain.gain.value = 1;
    }
    setMicMonitor(enabled) {
        this.micMonitorEnabled = enabled;
        if (!this.micAnalyser)
            return;
        try {
            this.micAnalyser.disconnect(this.headphoneDest);
        }
        catch { }
        if (enabled) {
            this.micAnalyser.connect(this.headphoneDest);
        }
    }
    setMasterVolume(percent) {
        const gain = Math.min(percent / 100, 3);
        this.masterGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
    }
    async setMasterSpeaker(deviceId) {
        const audio = this.masterAudio;
        if (audio.setSinkId)
            await audio.setSinkId(deviceId);
    }
    async setHeadphones(deviceId) {
        const audio = this.headphoneAudio;
        if (audio.setSinkId)
            await audio.setSinkId(deviceId);
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
    getAudioLevel(analyser) {
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
    }
}
