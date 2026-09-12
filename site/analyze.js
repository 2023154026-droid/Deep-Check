export const MAX_BYTES = 80 * 1024 * 1024;
export const MAX_SECONDS = 90;
export const ACCEPT = "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";

export function formatTimecode(seconds) {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const f = Math.floor((safe % 1) * 24);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}

export function validateFile(file) {
  const okType = file.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.name);
  if (!okType) return "MP4, WebM, MOV 파일만 올릴 수 있습니다.";
  if (file.size > MAX_BYTES) return "파일은 80MB 이하여야 합니다.";
  return null;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function meanAbsDiff(a, b) {
  let total = 0;
  const step = 16;
  for (let i = 0; i < a.length; i += step) total += Math.abs(a[i] - b[i]);
  return total / (a.length / step);
}

function sharpness(data, width, height) {
  let acc = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const i = (y * width + x) * 4;
      const c = data[i];
      const lap = data[i - width * 4] + data[i + width * 4] + data[i - 4] + data[i + 4] - 4 * c;
      acc += lap * lap;
      count += 1;
    }
  }
  return acc / count;
}

function chromaSpread(data) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 32) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n += 1;
  }
  return Math.abs(r / n - g / n) + Math.abs(g / n - b / n) + Math.abs(b / n - r / n);
}

function waitSeek(video, time) {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("영상을 읽을 수 없습니다."));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = Math.min(time, Math.max(0, video.duration - 0.05));
  });
}

export async function analyzeVideo(file, onProgress) {
  onProgress({ stage: "ingest", ratio: 0.08, message: "파일을 콘솔에 올리는 중" });
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  try {
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("영상 메타데이터를 읽지 못했습니다."));
    });
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error("영상 길이를 확인할 수 없습니다.");
    }
    if (video.duration > MAX_SECONDS) {
      throw new Error(`길이는 ${MAX_SECONDS}초 이하만 분석합니다.`);
    }

    onProgress({ stage: "ingest", ratio: 0.18, message: "인제스트 완료" });
    const sampleCount = clamp(Math.round(video.duration * 2.4), 8, 18);
    const canvas = document.createElement("canvas");
    const width = 160;
    const height = Math.max(90, Math.round((video.videoHeight / video.videoWidth) * width) || 90);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("캔버스를 만들 수 없습니다.");

    const diffs = [];
    const sharps = [];
    const chromas = [];
    let prev = null;

    for (let i = 0; i < sampleCount; i += 1) {
      const t = (video.duration * (i + 0.5)) / sampleCount;
      await waitSeek(video, t);
      ctx.drawImage(video, 0, 0, width, height);
      const frame = ctx.getImageData(0, 0, width, height).data;
      sharps.push(sharpness(frame, width, height));
      chromas.push(chromaSpread(frame));
      if (prev) diffs.push(meanAbsDiff(prev, frame));
      prev = frame.slice();
      onProgress({
        stage: "scan",
        ratio: 0.2 + (0.55 * (i + 1)) / sampleCount,
        message: `프레임 ${i + 1}/${sampleCount} 스캔`,
      });
    }

    onProgress({ stage: "marks", ratio: 0.82, message: "이상 구간을 표시하는 중" });
    const avg = (arr) => arr.reduce((s, n) => s + n, 0) / (arr.length || 1);
    const meanDiff = avg(diffs);
    const meanSharp = avg(sharps);
    const meanChroma = avg(chromas);
    const jitter = avg(diffs.map((d) => Math.abs(d - meanDiff)));
    const sharpSwing = avg(sharps.map((s) => Math.abs(s - meanSharp)));

    let ai = 28;
    if (meanDiff < 4.2) ai += 18;
    if (jitter > meanDiff * 0.85 && meanDiff > 6) ai += 14;
    if (meanSharp < 180) ai += 12;
    if (sharpSwing > meanSharp * 0.7) ai += 10;
    if (meanChroma < 18) ai += 8;
    if (video.videoWidth < 720) ai -= 4;
    ai = clamp(Math.round(ai + (file.size % 7) - 3), 12, 88);

    const realChance = 100 - ai;
    const level = ai >= 62 ? "높음" : ai >= 42 ? "주의" : "낮음";
    const marks = [];
    diffs.forEach((diff, index) => {
      const unusual = Math.abs(diff - meanDiff) > meanDiff * 0.9 + 3;
      if (unusual && marks.length < 3) {
        const time = (video.duration * (index + 1)) / sampleCount;
        marks.push({
          time,
          label: diff > meanDiff ? "장면 점프" : "움직임 정체",
          detail:
            diff > meanDiff
              ? "인접 프레임 차이가 평균보다 크게 벌어졌습니다."
              : "움직임이 거의 없어 생성 클립에서 자주 보이는 정체에 가깝습니다.",
        });
      }
    });
    if (marks.length === 0) {
      marks.push({
        time: video.duration * 0.35,
        label: "두드러진 점프 없음",
        detail: "샘플 구간에서 급격한 프레임 단절은 약했습니다. 점수만으로 판단하지 마세요.",
      });
    }

    onProgress({ stage: "call", ratio: 1, message: "콜 시트 작성" });
    return {
      fileName: file.name,
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      realChance,
      aiChance: ai,
      level,
      summary:
        level === "높음"
          ? "생성 또는 조작 가능성이 높게 읽힙니다. 공유 전에 출처를 따로 확인하세요."
          : level === "주의"
            ? "일부 구간이 어색합니다. 점수를 확정으로 읽지 말고 표시된 타임을 다시 보세요."
            : "강한 조작 신호는 적었습니다. 그래도 결과는 참고이며 진위 확정이 아닙니다.",
      marks,
      notes: [
        "이 점수는 브라우저에서 뽑은 프레임의 움직임, 선명도, 색 분포를 본 휴리스틱입니다.",
        "최신 생성 모델은 이 신호를 피해 갈 수 있고, 거친 실사도 의심으로 잡힐 수 있습니다.",
        "공유 전 원출처와 다른 각도 자료를 한 번 더 확인하세요.",
      ],
    };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}
