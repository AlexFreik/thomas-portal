import { AudioMixer } from './audio-mixer.js';

const mixer = new AudioMixer();

const player: any = document.getElementById('player');
mixer.attachMediaElement(player);

const cameraSelect: any = document.getElementById('camera');
const micSelect: any = document.getElementById('mic');
const masterSelect: any = document.getElementById('master');
const headphonesSelect: any = document.getElementById('headphones');

const cameraBtn: any = document.getElementById('cameraBtn');
const videoBtn: any = document.getElementById('videoBtn');

let currentCameraStream: MediaStream | null = null;

async function loadDevices() {
    await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

    const devices = await navigator.mediaDevices.enumerateDevices();

    const cams = devices.filter((d) => d.kind === 'videoinput');
    const mics = devices.filter((d) => d.kind === 'audioinput');
    const outs = devices.filter((d) => d.kind === 'audiooutput');

    fill(cameraSelect, cams);
    fill(micSelect, mics);
    fill(masterSelect, outs, true);
    fill(headphonesSelect, outs, true);

    const selectedMic = localStorage.getItem('selectedMic');
    if (selectedMic) {
        micSelect.value = selectedMic;
        setMic(selectedMic);
    }

    const selectedMaster = localStorage.getItem('selectedMaster');
    if (selectedMaster) {
        masterSelect.value = selectedMaster;
        setMasterSpeaker(selectedMaster);
    }

    const selectedHeadphones = localStorage.getItem('selectedHeadphones');
    if (selectedHeadphones) {
        headphonesSelect.value = selectedHeadphones;
        setHeadphones(selectedHeadphones);
    }
}

function fill(select: any, devices: any[], addNone = false) {
    select.innerHTML = '';

    if (addNone) {
        const opt = document.createElement('option');
        opt.value = 'none';
        opt.text = 'None';
        select.appendChild(opt);
    }

    devices.forEach((d) => {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.text = d.label || d.kind;

        select.appendChild(opt);
    });
}

micSelect.onchange = () => setMic(micSelect.value);
masterSelect.onchange = () => setMasterSpeaker(masterSelect.value);
headphonesSelect.onchange = setHeadphones(headphonesSelect.value);

async function setMic(id: string) {
    if (!id) return;
    await mixer.startMic(id);
    localStorage.setItem('selectedMic', id);
}

async function setMasterSpeaker(id: string) {
    if (!id) return;
    await mixer.setMasterSpeaker(id);
    localStorage.setItem('selectedMaster', id);
}

async function setHeadphones(id: string) {
    if (!id) return;
    await mixer.setHeadphones(id);
    localStorage.setItem('selectedHeadphones', id);
}

cameraBtn.onclick = async () => {
    if (currentCameraStream) currentCameraStream.getTracks().forEach((t) => t.stop());

    const camId = cameraSelect.value;

    const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: camId },
        audio: false,
    });

    currentCameraStream = stream;

    player.srcObject = stream;
    player.play();
    mixer.unmuteMic();
};

videoBtn.onclick = async () => {
    if (currentCameraStream) currentCameraStream.getTracks().forEach((t) => t.stop());

    player.srcObject = null;
    player.src = './video.mp4';

    await new Promise((resolve) => {
        player.onloadedmetadata = resolve;
    });

    player.play();
    mixer.muteMic();
};

function updateMeters() {
    const micLevel = mixer.getMicLevel();
    const masterLevel = mixer.getMasterLevel();

    (document.getElementById('micMeter') as HTMLMeterElement).value = micLevel;
    (document.getElementById('masterMeter') as HTMLMeterElement).value = masterLevel;

    requestAnimationFrame(updateMeters);
}

document.body.addEventListener(
    'click',
    () => {
        mixer.resume();
    },
    { once: true },
);

updateMeters();

loadDevices();
