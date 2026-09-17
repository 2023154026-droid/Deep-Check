export const MAX_BYTES = 80 * 1024 * 1024;
export const MAX_SECONDS = 90;
export const ACCEPT =
  "video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp,.mp4,.webm,.mov,.jpg,.jpeg,.png,.webp";

export type Mark = {
  time: number;
  label: string;
  detail: string;
  tone?: "ai" | "real";
};

export type Analysis = {
  kind: "video" | "image";
  fileName: string;
  duration: number;
  width: number;
  height: number;
  realChance: number;
  aiChance: number;
  aiSignals: number;
  level: "낮음" | "주의" | "높음";
  verdict: string;
  summary: string;
  marks: Mark[];
  notes: string[];
};

export type Progress = {
  stage: "ingest" | "scan" | "marks" | "call";
  ratio: number;
  message: string;
};

export function isImageFile(file: File) {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(file.name);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function meanAbsDiff(a: Uint8ClampedArray, b: Uint8ClampedArray) {
  let total = 0;
  const step = 16;
  for (let i = 0; i < a.length; i += step) total += Math.abs(a[i] - b[i]);
  return total / (a.length / step);
}

function sharpness(data: Uint8ClampedArray, width: number, height: number) {
  let acc = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const i = (y * width + x) * 4;
      const c = data[i];
      const lap =
        data[i - width * 4] +
        data[i + width * 4] +
        data[i - 4] +
        data[i + 4] -
        4 * c;
      acc += lap * lap;
      count += 1;
    }
  }
  return acc / count;
}

function chromaSpread(data: Uint8ClampedArray) {
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let i = 0; i < data.length; i += 32) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n += 1;
  }
  return Math.abs(r / n - g / n) + Math.abs(g / n - b / n) + Math.abs(b / n - r / n);
}

function noiseLevel(data: Uint8ClampedArray) {
  let acc = 0;
  let n = 0;
  for (let i = 4; i < data.length; i += 32) {
    acc += Math.abs(data[i] - data[i - 4]);
    n += 1;
  }
  return acc / n;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitSeek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
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

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("사진을 읽을 수 없습니다."));
    img.src = url;
  });
}

function buildCall(ai: number, kind: "video" | "image") {
  const realChance = 100 - ai;
  const level: Analysis["level"] = ai >= 62 ? "높음" : ai >= 42 ? "주의" : "낮음";
  const verdict =
    level === "높음"
      ? "AI로 만들었을 가능성이 높습니다"
      : level === "주의"
        ? "AI인지 실제인지 판단이 갈립니다"
        : "실제 촬영에 가깝게 읽힙니다";
  const summary =
    level === "높음"
      ? kind === "image"
        ? "사진 신호에서 생성물에서 자주 보이는 매끈함이나 균일함이 읽혔습니다. 공유 전에 출처를 확인하세요."
        : "생성 또는 조작 가능성이 높게 읽힙니다. 공유 전에 출처를 따로 확인하세요."
      : level === "주의"
        ? "신호가 섞여 있습니다. 점수를 확정으로 읽지 말고 아래 근거를 함께 보세요."
        : "강한 생성 신호는 적었습니다. 그래도 결과는 참고이며 진위 확정이 아닙니다.";
  return { realChance, level, verdict, summary };
}

function notesFor(kind: "video" | "image") {
  return [
    kind === "image"
      ? "이 점수는 브라우저에서 읽은 선명도, 색 분포, 입자 정도를 본 휴리스틱입니다."
      : "이 점수는 브라우저에서 뽑은 프레임의 움직임, 선명도, 색 분포를 본 휴리스틱입니다.",
    "최신 생성 모델은 이 신호를 피해 갈 수 있고, 거친 실사도 의심으로 잡힐 수 있습니다.",
    "공유 전 원출처와 다른 각도 자료를 한 번 더 확인하세요.",
  ];
}

export function formatTimecode(seconds: number) {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const f = Math.floor((safe % 1) * 24);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}

export function validateFile(file: File) {
  const okVideo =
    file.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.name);
  const okImage = isImageFile(file);
  if (!okVideo && !okImage) {
    return "영상(MP4, WebM, MOV) 또는 사진(JPG, PNG, WebP)만 올릴 수 있습니다.";
  }
  if (file.size > MAX_BYTES) return "파일은 80MB 이하여야 합니다.";
  return null;
}

export async function analyzeMedia(
  file: File,
  onProgress: (progress: Progress) => void,
): Promise<Analysis> {
  if (isImageFile(file)) return analyzeImage(file, onProgress);
  return analyzeVideo(file, onProgress);
}

async function analyzeImage(
  file: File,
  onProgress: (progress: Progress) => void,
): Promise<Analysis> {
  onProgress({ stage: "ingest", ratio: 0.08, message: "사진을 콘솔에 올리는 중" });
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    await wait(180);
    onProgress({ stage: "ingest", ratio: 0.22, message: "인제스트 완료" });

    const canvas = document.createElement("canvas");
    const width = 240;
    const height = Math.max(
      160,
      Math.round((img.naturalHeight / img.naturalWidth) * width) || 160,
    );
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("캔버스를 만들 수 없습니다.");
    ctx.drawImage(img, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height).data;

    onProgress({ stage: "scan", ratio: 0.55, message: "픽셀 신호를 비교하는 중" });
    await wait(220);

    const sharp = sharpness(pixels, width, height);
    const chroma = chromaSpread(pixels);
    const noise = noiseLevel(pixels);
    const tiles: number[] = [];
    const tileW = Math.floor(width / 2);
    const tileH = Math.floor(height / 2);
    for (const [tx, ty] of [
      [0, 0],
      [tileW, 0],
      [0, tileH],
      [tileW, tileH],
    ] as const) {
      const tile = ctx.getImageData(tx, ty, tileW, tileH).data;
      tiles.push(sharpness(tile, tileW, tileH));
    }
    const tileMean = tiles.reduce((s, n) => s + n, 0) / tiles.length;
    const tileSwing =
      tiles.reduce((s, n) => s + Math.abs(n - tileMean), 0) / tiles.length;

    onProgress({ stage: "marks", ratio: 0.82, message: "관찰 포인트를 적는 중" });
    await wait(160);

    let ai = 8;
    let aiSignals = 0;
    if (sharp > 1400 && noise < 2.2) {
      ai += 16;
      aiSignals += 1;
    }
    if (noise < 1.6) {
      ai += 10;
      aiSignals += 1;
    }
    if (tileSwing < tileMean * 0.05 && sharp > 500) {
      ai += 10;
      aiSignals += 1;
    }
    if (aiSignals === 0) ai = Math.min(ai, 11);
    else if (aiSignals === 1) ai = Math.min(ai, 34);
    ai = clamp(Math.round(ai), 5, 86);

    const { realChance, level, verdict, summary } = buildCall(ai, "image");
    const marks: Mark[] = [];
    if (noise < 3.5) {
      marks.push({
        time: 0,
        label: "입자가 거의 없음",
        detail: "실사 사진보다 표면이 매끈합니다. 생성 이미지에서 자주 보이는 패턴입니다.",
      });
    }
    if (tileSwing < tileMean * 0.12) {
      marks.push({
        time: 0,
        label: "영역별 선명도가 비슷함",
        detail:
          "사진 네 구역의 선명도 차이가 작습니다. 실제 촬영은 보통 초점이 한쪽에 더 몰립니다.",
      });
    }
    if (chroma < 14 || chroma > 90) {
      marks.push({
        time: 0,
        label: chroma < 14 ? "색이 지나치게 고름" : "채도가 강하게 읽힘",
        detail:
          chroma < 14
            ? "색 편차가 작아 보정된 생성물처럼 읽힐 수 있습니다."
            : "색이 강하게 벌어져 있습니다. 생성 이미지의 과장된 색과도 겹칩니다.",
      });
    }
    if (marks.length === 0) {
      marks.push({
        time: 0,
        label: "두드러진 생성 신호 약함",
        detail: "선명도와 색 분포가 한쪽으로 치우치지 않았습니다. 점수만으로 판단하지 마세요.",
      });
    }

    onProgress({ stage: "call", ratio: 1, message: "결과지 작성" });
    return {
      kind: "image",
      fileName: file.name,
      duration: 0,
      width: img.naturalWidth,
      height: img.naturalHeight,
      realChance,
      aiChance: ai,
      aiSignals,
      level,
      verdict,
      summary,
      marks,
      notes: notesFor("image"),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function analyzeVideo(
  file: File,
  onProgress: (progress: Progress) => void,
): Promise<Analysis> {
  onProgress({ stage: "ingest", ratio: 0.08, message: "파일을 콘솔에 올리는 중" });
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
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
    const height = Math.max(
      90,
      Math.round((video.videoHeight / video.videoWidth) * width) || 90,
    );
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("캔버스를 만들 수 없습니다.");

    const diffs: number[] = [];
    const sharps: number[] = [];
    const chromas: number[] = [];
    let prev: Uint8ClampedArray | null = null;

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
    const avg = (arr: number[]) => arr.reduce((s, n) => s + n, 0) / (arr.length || 1);
    const meanDiff = avg(diffs);
    const meanSharp = avg(sharps);
    const meanChroma = avg(chromas);
    const jitter = avg(diffs.map((d) => Math.abs(d - meanDiff)));
    const sharpSwing = avg(sharps.map((s) => Math.abs(s - meanSharp)));

    let ai = 8;
    if (meanDiff < 2.4) ai += 16;
    if (jitter > meanDiff * 1.15 && meanDiff > 8) ai += 12;
    if (meanSharp < 70 && meanDiff < 3) ai += 10;
    const videoSignals = Number(meanDiff < 2.4) + Number(jitter > meanDiff * 1.15 && meanDiff > 8) + Number(meanSharp < 70 && meanDiff < 3);
    if (videoSignals === 0) ai = Math.min(ai, 11);
    else if (videoSignals === 1) ai = Math.min(ai, 34);
    ai = clamp(Math.round(ai), 5, 86);
    const aiSignals = videoSignals;

    const { realChance, level, verdict, summary } = buildCall(ai, "video");
    const marks: Mark[] = [];
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

    onProgress({ stage: "call", ratio: 1, message: "결과지 작성" });
    return {
      kind: "video",
      fileName: file.name,
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      realChance,
      aiChance: ai,
      aiSignals,
      level,
      verdict,
      summary,
      marks,
      notes: notesFor("video"),
    };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}
