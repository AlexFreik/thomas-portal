import { AudioMixer, drawDbMeter } from './audio-mixer.js';
const mixer = new AudioMixer();
const player = document.getElementById('player');
mixer.attachMediaElement(player);
const cameraSelect = document.getElementById('camera');
const micSelect = document.getElementById('mic');
const masterSelect = document.getElementById('master');
const headphonesSelect = document.getElementById('headphones');
const cameraBtn = document.getElementById('cameraBtn');
const videoBtn = document.getElementById('videoBtn');
let currentCameraStream = null;
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
function fill(select, devices, addNone = false) {
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
headphonesSelect.onchange = () => setHeadphones(headphonesSelect.value);
async function setMic(id) {
    if (!id)
        return;
    await mixer.startMic(id);
    localStorage.setItem('selectedMic', id);
}
async function setMasterSpeaker(id) {
    if (!id)
        return;
    await mixer.setMasterSpeaker(id);
    localStorage.setItem('selectedMaster', id);
}
async function setHeadphones(id) {
    if (!id)
        return;
    await mixer.setHeadphones(id);
    localStorage.setItem('selectedHeadphones', id);
}
cameraBtn.onclick = async () => {
    if (currentCameraStream)
        currentCameraStream.getTracks().forEach((t) => t.stop());
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
    if (currentCameraStream)
        currentCameraStream.getTracks().forEach((t) => t.stop());
    player.srcObject = null;
    player.src = './video.mp4';
    await new Promise((resolve) => {
        player.onloadedmetadata = resolve;
    });
    player.play();
    mixer.muteMic();
};
function updateMeters() {
    const masterLevel = mixer.getMasterLevel();
    const canvas = document.querySelector('#master-meter');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 100, 100);
    drawDbMeter(ctx, 0, masterLevel, false);
    drawDbMeter(ctx, 52, masterLevel, false);
    const micLevel = mixer.getMicLevel();
    const micMeter = document.getElementById('micMeter');
    micMeter.value = Math.min(1, micLevel * 3);
    requestAnimationFrame(updateMeters);
}
document.body.addEventListener('click', () => {
    mixer.resume();
}, { once: true });
updateMeters();
loadDevices();
