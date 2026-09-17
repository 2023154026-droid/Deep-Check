export const MAX_BYTES = 80 * 1024 * 1024;
export const MAX_SECONDS = 90;
export const ACCEPT =
  "video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp,.mp4,.webm,.mov,.jpg,.jpeg,.png,.webp";

export function isImageFile(file) {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(file.name);
}

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
  const okVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.name);
  const okImage = isImageFile(file);
  if (!okVideo && !okImage) {
    return "영상(MP4, WebM, MOV) 또는 사진(JPG, PNG, WebP)만 올릴 수 있습니다.";
  }
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

function noiseLevel(data) {
  let acc = 0;
  let n = 0;
  for (let i = 4; i < data.length; i += 32) {
    acc += Math.abs(data[i] - data[i - 4]);
    n += 1;
  }
  return acc / n;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("사진을 읽을 수 없습니다."));
    img.src = url;
  });
}

const AI_SOFTWARE =
  /midjourney|dall-?e|stable diffusion|firefly|leonardo|novelai|chatgpt|openai|gemini|imagen|flux|bing image|nightcafe|ideogram/i;
const CAMERA_MAKE =
  /apple|samsung|google|xiaomi|huawei|sony|canon|nikon|fujifilm|panasonic|olympus|leica|oneplus|motorola|oppo|vivo|lg|pixel|dji/i;

function asciiFromView(view, offset, length) {
  let text = "";
  const max = Math.min(length, 128);
  for (let i = 0; i < max; i += 1) {
    const code = view.getUint8(offset + i);
    if (code === 0) break;
    if (code >= 32 && code < 127) text += String.fromCharCode(code);
  }
  return text.trim();
}

function readExifIfd(view, tiffStart, ifdOffset, little) {
  const u16 = (at) => view.getUint16(at, little);
  const u32 = (at) => view.getUint32(at, little);
  const start = tiffStart + ifdOffset;
  if (start + 2 > view.byteLength) return {};
  const count = u16(start);
  const found = {};
  for (let i = 0; i < count; i += 1) {
    const entry = start + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = u16(entry);
    const type = u16(entry + 2);
    const components = u32(entry + 4);
    if (type !== 2 || components < 2) continue;
    const valueOffset = components <= 4 ? entry + 8 : tiffStart + u32(entry + 8);
    if (valueOffset + 1 > view.byteLength) continue;
    const text = asciiFromView(view, valueOffset, components);
    if (tag === 0x010f) found.make = text;
    if (tag === 0x0110) found.model = text;
    if (tag === 0x0131) found.software = text;
    if (tag === 0x0132) found.datetime = text;
  }
  return found;
}

async function inspectJpeg(file) {
  const jpeg = file.type === "image/jpeg" || /\.(jpe?g)$/i.test(file.name);
  if (!jpeg) return null;
  const bytes = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const size = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker === 0xe1 && size > 8) {
      const start = i + 4;
      const header = asciiFromView(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), start, 4);
      if (header === "Exif") {
        const tiffStart = start + 6;
        const endian = String.fromCharCode(bytes[tiffStart], bytes[tiffStart + 1]);
        const little = endian === "II";
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const ifd0 = little ? view.getUint32(tiffStart + 4, true) : view.getUint32(tiffStart + 4, false);
        return readExifIfd(view, tiffStart, ifd0, little);
      }
    }
    i += 2 + size;
  }
  return null;
}

function finalizeScore(aiSignals, realSignals) {
  let ai = 8 + aiSignals.reduce((sum, item) => sum + item.weight, 0);
  ai -= realSignals.reduce((sum, item) => sum + item.weight, 0);
  if (aiSignals.length === 0) ai = Math.min(ai, 11);
  else if (aiSignals.length === 1) ai = Math.min(ai, 34);
  return clamp(Math.round(ai), 5, 86);
}

function buildCall(ai, _kind, aiSignals) {
  const realChance = 100 - ai;
  const level = ai >= 62 ? "높음" : ai >= 42 ? "주의" : "낮음";
  const verdict =
    level === "높음"
      ? "AI로 만들었을 가능성이 높습니다"
      : level === "주의"
        ? "AI인지 실제인지 판단이 갈립니다"
        : "실제 촬영에 가깝게 읽힙니다";
  const summary =
    level === "높음"
      ? "생성 신호가 여러 개 겹칩니다. 공유 전에 출처를 따로 확인하세요."
      : level === "주의"
        ? "생성 신호와 실제 촬영 신호가 섞여 있습니다. 점수보다 아래 근거를 보세요."
        : aiSignals.length === 0
          ? "뚜렷한 생성 신호는 없었습니다. 없는 의심을 점수로 채우지 않았습니다."
          : "생성 신호는 약합니다. 그래도 결과는 참고이며 진위 확정이 아닙니다.";
  return { realChance, level, verdict, summary };
}

function notesFor(kind) {
  return [
    kind === "image"
      ? "점수는 카메라 정보, 선명도, 색, 입자를 본 휴리스틱입니다. 신호가 없으면 낮게 나옵니다."
      : "점수는 프레임 움직임, 선명도, 색 분포를 본 휴리스틱입니다. 신호가 없으면 낮게 나옵니다.",
    "파일 크기 같은 무관한 값으로 점수를 흔들지 않습니다.",
    "메신저로 받은 사진은 카메라 정보가 빠질 수 있습니다. 가능하면 원본으로 다시 보세요.",
  ];
}

export async function analyzeMedia(file, onProgress) {
  if (isImageFile(file)) return analyzeImage(file, onProgress);
  return analyzeVideo(file, onProgress);
}

async function analyzeImage(file, onProgress) {
  onProgress({ stage: "ingest", ratio: 0.08, message: "사진을 콘솔에 올리는 중" });
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    await wait(180);
    onProgress({ stage: "ingest", ratio: 0.22, message: "인제스트 완료" });

    const canvas = document.createElement("canvas");
    const width = 240;
    const height = Math.max(160, Math.round((img.naturalHeight / img.naturalWidth) * width) || 160);
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
    const tiles = [];
    const tileW = Math.floor(width / 2);
    const tileH = Math.floor(height / 2);
    for (const [tx, ty] of [
      [0, 0],
      [tileW, 0],
      [0, tileH],
      [tileW, tileH],
    ]) {
      const tile = ctx.getImageData(tx, ty, tileW, tileH).data;
      tiles.push(sharpness(tile, tileW, tileH));
    }
    const tileMean = tiles.reduce((s, n) => s + n, 0) / tiles.length;
    const tileSwing = tiles.reduce((s, n) => s + Math.abs(n - tileMean), 0) / tiles.length;

    onProgress({ stage: "marks", ratio: 0.82, message: "관찰 포인트를 적는 중" });
    await wait(160);

    const exif = await inspectJpeg(file);
    const aiSignals = [];
    const realSignals = [];
    const cameraLabel = [exif?.make, exif?.model].filter(Boolean).join(" ");

    if (exif?.software && AI_SOFTWARE.test(exif.software)) {
      aiSignals.push({
        time: 0,
        tone: "ai",
        weight: 34,
        label: "생성 도구 흔적",
        detail: `소프트웨어 정보에 생성 도구로 보이는 이름이 있습니다. (${exif.software})`,
      });
    }
    if (cameraLabel && CAMERA_MAKE.test(cameraLabel)) {
      realSignals.push({
        time: 0,
        tone: "real",
        weight: 22,
        label: "카메라 정보가 남아 있음",
        detail: `촬영 기기 정보가 파일에 있습니다. (${cameraLabel}) 생성 이미지는 이 값이 없는 경우가 많습니다.`,
      });
    } else if (exif?.datetime) {
      realSignals.push({
        time: 0,
        tone: "real",
        weight: 8,
        label: "촬영 시각이 기록됨",
        detail: `파일에 촬영 시각(${exif.datetime})이 남아 있습니다.`,
      });
    }
    if (sharp > 1400 && noise < 2.2) {
      aiSignals.push({
        time: 0,
        tone: "ai",
        weight: 16,
        label: "너무 매끈하고 선명함",
        detail: "입자 없이 전면이 과도하게 선명합니다. 생성 이미지에서 가끔 보이는 패턴입니다.",
      });
    }
    if (noise < 1.6) {
      aiSignals.push({
        time: 0,
        tone: "ai",
        weight: 10,
        label: "입자가 거의 없음",
        detail: "실사 단체 사진보다 표면이 비정상적으로 매끈합니다.",
      });
    } else if (noise > 4) {
      realSignals.push({
        time: 0,
        tone: "real",
        weight: 8,
        label: "사진 입자가 남아 있음",
        detail: "폰 카메라에서 흔히 보이는 미세 입자가 읽혔습니다.",
      });
    }
    if (tileSwing < tileMean * 0.05 && sharp > 500) {
      aiSignals.push({
        time: 0,
        tone: "ai",
        weight: 10,
        label: "구역별 선명도가 거의 같음",
        detail: "네 구역의 초점이 거의 같습니다. 실제 단체 사진은 앞뒤 인물 선명도가 다른 경우가 많습니다.",
      });
    } else if (tileSwing > tileMean * 0.18) {
      realSignals.push({
        time: 0,
        tone: "real",
        weight: 7,
        label: "구역마다 선명도가 다름",
        detail: "초점이 한쪽에 더 몰려 있습니다. 여러 사람이 나온 실사에서 자주 보입니다.",
      });
    }

    const ai = finalizeScore(aiSignals, realSignals);
    const { realChance, level, verdict, summary } = buildCall(ai, "image", aiSignals);
    const marks = [...realSignals, ...aiSignals];
    if (marks.length === 0) {
      marks.push({
        time: 0,
        tone: "real",
        label: "뚜렷한 생성 신호 없음",
        detail: "선명도, 색, 입자에서 생성물로 단정할 만한 값은 없었습니다.",
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
      aiSignals: aiSignals.length,
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
    const jitter = avg(diffs.map((d) => Math.abs(d - meanDiff)));

    const aiSignals = [];
    const realSignals = [];
    if (meanDiff < 2.4) {
      aiSignals.push({
        time: video.duration * 0.2,
        tone: "ai",
        weight: 16,
        label: "움직임이 거의 없음",
        detail: "프레임 사이 변화가 비정상적으로 작습니다. 생성 클립의 정체와 겹칩니다.",
      });
    } else if (meanDiff > 5) {
      realSignals.push({
        time: video.duration * 0.2,
        tone: "real",
        weight: 8,
        label: "프레임 움직임이 있음",
        detail: "장면 안에 실제 촬영에서 흔한 미세 움직임이 읽혔습니다.",
      });
    }
    if (jitter > meanDiff * 1.15 && meanDiff > 8) {
      aiSignals.push({
        time: video.duration * 0.45,
        tone: "ai",
        weight: 12,
        label: "장면 점프",
        detail: "인접 프레임 차이가 평균보다 크게 출렁입니다.",
      });
    }
    if (meanSharp < 70 && meanDiff < 3) {
      aiSignals.push({
        time: video.duration * 0.6,
        tone: "ai",
        weight: 10,
        label: "흐리고 정체됨",
        detail: "선명도와 움직임이 함께 낮습니다.",
      });
    }
    diffs.forEach((diff, index) => {
      const unusual = Math.abs(diff - meanDiff) > meanDiff * 1.2 + 5;
      if (unusual && aiSignals.length < 4) {
        const time = (video.duration * (index + 1)) / sampleCount;
        aiSignals.push({
          time,
          tone: "ai",
          weight: 8,
          label: diff > meanDiff ? "급격한 장면 전환" : "일시 정체",
          detail:
            diff > meanDiff
              ? "이 구간에서 프레임 차이가 갑자기 벌어졌습니다."
              : "이 구간에서 움직임이 갑자기 줄었습니다.",
        });
      }
    });

    const ai = finalizeScore(aiSignals, realSignals);
    const { realChance, level, verdict, summary } = buildCall(ai, "video", aiSignals);
    const marks = [...realSignals, ...aiSignals].slice(0, 4);
    if (marks.length === 0) {
      marks.push({
        time: video.duration * 0.35,
        tone: "real",
        label: "뚜렷한 생성 신호 없음",
        detail: "샘플 구간에서 생성물로 단정할 만한 점프나 정체는 약했습니다.",
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
      aiSignals: aiSignals.length,
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
