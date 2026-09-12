import { ACCEPT, analyzeVideo, formatTimecode, validateFile } from "./analyze.js";

const fileInput = document.querySelector("#file");
const screen = document.querySelector("#screen");
const preview = document.querySelector("#preview");
const empty = document.querySelector("#empty");
const fileLabel = document.querySelector("#file-label");
const scanTag = document.querySelector("#scan-tag");
const clock = document.querySelector("#clock");
const status = document.querySelector("#status");
const startBtn = document.querySelector("#start");
const clearBtn = document.querySelector("#clear");
const errorBox = document.querySelector("#error");
const resultRoot = document.querySelector("#result");
const wave = document.querySelector("#wave");
const rundown = document.querySelector("#rundown");

const STEPS = ["ingest", "scan", "marks", "call"];
let file = null;
let previewUrl = null;
let busy = false;

for (let i = 0; i < 42; i += 1) {
  const bar = document.createElement("span");
  bar.style.height = `${12 + Math.abs(Math.sin(i * 0.55)) * 10}px`;
  bar.style.opacity = "0.35";
  wave.append(bar);
}

function setError(message) {
  errorBox.hidden = !message;
  errorBox.textContent = message ?? "";
}

function setFile(next) {
  const message = validateFile(next);
  if (message) {
    setError(message);
    return;
  }
  file = next;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(next);
  preview.src = previewUrl;
  preview.hidden = false;
  empty.hidden = true;
  fileLabel.textContent = next.name;
  startBtn.disabled = false;
  resultRoot.hidden = true;
  setError(null);
  paintRundown(null, false);
}

function paintRundown(progress, done) {
  const current = progress ? STEPS.indexOf(progress.stage) : done ? STEPS.length : -1;
  rundown.querySelectorAll("li").forEach((item, index) => {
    const mark = item.querySelector(".mark");
    mark.textContent = current > index || done ? "━━━━" : current === index ? "━ ━ ━" : "····";
  });
}

function paintWave(level, active) {
  [...wave.children].forEach((bar, index) => {
    const height = 12 + Math.abs(Math.sin(index * 0.55 + level * 8)) * 28 * (0.35 + level);
    bar.style.height = `${height}px`;
    bar.style.opacity = active ? "0.95" : "0.35";
  });
}

function renderResult(result) {
  clock.textContent = formatTimecode(result.duration);
  resultRoot.hidden = false;
  resultRoot.innerHTML = `
    <div class="wrap">
      <article class="sheet">
        <div class="sheet-grid">
          <div class="sheet-left">
            <p class="mono">CALL SHEET</p>
            <h2>${result.level}</h2>
            <p>${result.summary}</p>
            <dl class="scores">
              <div>
                <dt>실제 가능성</dt>
                <dd>${result.realChance}<span style="font-size:1.1rem">%</span></dd>
              </div>
              <div>
                <dt>생성 가능성</dt>
                <dd class="ai">${result.aiChance}<span style="font-size:1.1rem">%</span></dd>
              </div>
            </dl>
          </div>
          <div class="sheet-right">
            <h3>의심 구간</h3>
            <ul class="marks">
              ${result.marks
                .map(
                  (mark) => `
                <li>
                  <p class="mono">${formatTimecode(mark.time)}</p>
                  <strong>${mark.label}</strong>
                  <p>${mark.detail}</p>
                </li>`,
                )
                .join("")}
            </ul>
            <p class="mono" style="margin-top:1.6rem">${result.width}x${result.height} / ${result.fileName}</p>
          </div>
        </div>
        <div class="notes">
          <ul>${result.notes.map((note) => `<li>${note}</li>`).join("")}</ul>
        </div>
      </article>
    </div>
  `;
}

screen.addEventListener("click", () => fileInput.click());
screen.addEventListener("dragover", (event) => {
  event.preventDefault();
  screen.classList.add("is-hot");
});
screen.addEventListener("dragleave", () => screen.classList.remove("is-hot"));
screen.addEventListener("drop", (event) => {
  event.preventDefault();
  screen.classList.remove("is-hot");
  if (event.dataTransfer.files[0]) setFile(event.dataTransfer.files[0]);
});
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

startBtn.addEventListener("click", async () => {
  if (!file || busy) return;
  busy = true;
  startBtn.disabled = true;
  startBtn.textContent = "스캔 중";
  status.textContent = "SCAN";
  scanTag.textContent = "SCANNING";
  setError(null);
  try {
    const result = await analyzeVideo(file, (progress) => {
      paintRundown(progress, false);
      paintWave(progress.ratio, true);
    });
    paintRundown(null, true);
    paintWave(0.35, false);
    status.textContent = "HOLD";
    scanTag.textContent = "HOLD";
    renderResult(result);
    resultRoot.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    setError(err instanceof Error ? err.message : "분석에 실패했습니다.");
    status.textContent = "READY";
    scanTag.textContent = "INPUT";
  } finally {
    busy = false;
    startBtn.disabled = !file;
    startBtn.textContent = "분석 시작";
  }
});

clearBtn.addEventListener("click", () => {
  file = null;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  preview.removeAttribute("src");
  preview.hidden = true;
  empty.hidden = false;
  fileLabel.textContent = "NO CLIP";
  startBtn.disabled = true;
  resultRoot.hidden = true;
  resultRoot.innerHTML = "";
  setError(null);
  status.textContent = "READY";
  scanTag.textContent = "INPUT";
  clock.textContent = "00:00:00:00";
  fileInput.value = "";
  paintRundown(null, false);
  paintWave(0.12, false);
});

fileInput.setAttribute("accept", ACCEPT);
