import { useMemo, useRef, useState } from "react";
import {
  ACCEPT,
  analyzeMedia,
  formatTimecode,
  validateFile,
  type Analysis,
  type Progress,
} from "./lib/analyze";
import { Monitor } from "./components/Monitor";
import { ResultSlip } from "./components/ResultSlip";
import { Rundown } from "./components/Rundown";
import { Waveform } from "./components/Waveform";

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const clock = useMemo(
    () => formatTimecode(result?.duration ?? 0),
    [result],
  );

  function resetPreview(next: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(next ? URL.createObjectURL(next) : null);
  }

  function takeFile(next: File | null) {
    if (!next) return;
    const message = validateFile(next);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setResult(null);
    setProgress(null);
    setFile(next);
    resetPreview(next);
  }

  async function startAnalysis() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const analysis = await analyzeMedia(file, setProgress);
      setResult(analysis);
      requestAnimationFrame(() => {
        document.getElementById("result-slip")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function clearAll() {
    setFile(null);
    setResult(null);
    setProgress(null);
    setError(null);
    resetPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="min-h-[100dvh] bg-console text-ink">
      <header className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 md:px-8">
        <a href="#booth" className="flex items-baseline gap-3 no-underline">
          <span className="font-display text-[1.35rem] font-semibold tracking-[-0.03em]">
            딥체크
          </span>
          <span className="font-mono text-[11px] tracking-[0.14em] text-mute uppercase">
            Deep Check
          </span>
        </a>
        <div className="flex items-center gap-5 font-mono text-[11px] text-mute">
          <span className="hidden sm:inline">
            {result?.kind === "image" ? "STILL" : clock}
          </span>
          <span className="inline-flex items-center gap-2 text-phosphor">
            <span className="size-1.5 rounded-full bg-phosphor" aria-hidden />
            {busy ? "SCAN" : result ? "HOLD" : "READY"}
          </span>
        </div>
      </header>

      <main>
        <section
          id="booth"
          className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-[1400px] grid-cols-1 items-start gap-6 px-4 pb-16 pt-6 md:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)] md:gap-8 md:px-8 md:pt-8"
        >
          <div>
            <h1 className="max-w-[16ch] font-display text-[2.15rem] leading-[1.12] font-semibold tracking-[-0.035em] md:text-5xl">
              의심 영상이나 사진을 모니터에 올리세요
            </h1>
            <p className="mt-4 max-w-[38ch] text-base leading-relaxed text-mute">
              분석이 끝나면 점수와 한 장짜리 결과지로 AI 생성 가능성을 보여 줍니다.
            </p>
            <div className="mt-8">
              <Monitor
                file={file}
                preview={preview}
                busy={busy}
                error={error}
                onPick={() => inputRef.current?.click()}
                onFile={takeFile}
              />
            </div>
            <Waveform active={busy} level={progress?.ratio ?? (result ? 0.35 : 0.12)} />
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={startAnalysis}
                disabled={!file || busy}
                className="bg-phosphor px-5 py-2.5 text-sm font-semibold text-stamp transition enabled:hover:brightness-95 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-rail disabled:text-mute"
              >
                {busy ? "스캔 중" : "분석 시작"}
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="border border-rail px-5 py-2.5 text-sm text-ink transition hover:border-mute active:scale-[0.98]"
              >
                비우기
              </button>
              <p className="text-sm text-mute">MP4, MOV, JPG, PNG, WebP / 80MB / 영상 90초</p>
            </div>
            {error ? (
              <p className="mt-4 text-sm text-warn" role="alert">
                {error}
              </p>
            ) : null}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={(event) => takeFile(event.target.files?.[0] ?? null)}
            />
          </div>

          <Rundown progress={progress} result={result} fileName={file?.name ?? null} />
        </section>

        {result ? (
          <section
            id="result-slip"
            className="bg-[color-mix(in_srgb,var(--color-console)_88%,black)]"
          >
            <ResultSlip result={result} />
          </section>
        ) : null}

        <section className="mx-auto max-w-[1400px] px-4 py-20 md:px-8">
          <h2 className="font-display text-3xl tracking-[-0.03em] md:text-4xl">
            점수는 가능성이고, 결과지가 근거입니다
          </h2>
          <div className="mt-10 grid gap-10 md:grid-cols-[1.1fr_0.9fr]">
            <ol className="space-y-8">
              <li>
                <p className="font-mono text-phosphor">INGEST</p>
                <p className="mt-2 max-w-[52ch] text-base leading-relaxed text-mute">
                  영상 또는 사진을 모니터에 올리면 형식과 크기를 확인합니다. 링크는 받지 않습니다.
                </p>
              </li>
              <li>
                <p className="font-mono text-phosphor">SCAN</p>
                <p className="mt-2 max-w-[52ch] text-base leading-relaxed text-mute">
                  브라우저에서 프레임을 뽑아 움직임, 선명도, 색 분포를 비교합니다.
                </p>
              </li>
              <li>
                <p className="font-mono text-phosphor">CALL</p>
                <p className="mt-2 max-w-[52ch] text-base leading-relaxed text-mute">
                  AI로 만들었을 가능성과 실제 촬영 가능성을 나누고, 근거를 결과지에 적습니다.
                </p>
              </li>
            </ol>
            <aside className="border border-rail bg-face p-6 md:p-8">
              <p className="font-display text-xl tracking-[-0.02em]">한계를 먼저 읽으세요</p>
              <p className="mt-4 max-w-[46ch] text-sm leading-relaxed text-mute">
                딥체크는 연구소 탐지기가 아닙니다. 휴리스틱 신호이며 오탐과 미탐이 있습니다.
                결과를 진짜 또는 가짜의 확정으로 쓰지 마세요.
              </p>
            </aside>
          </div>
        </section>
      </main>

      <footer className="border-t border-rail">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-8 text-sm text-mute md:flex-row md:items-center md:justify-between md:px-8">
          <p>딥체크. 결과는 참고용이며 추가 확인이 필요합니다.</p>
          <p>suna024 / Deep-Check</p>
        </div>
      </footer>
    </div>
  );
}
