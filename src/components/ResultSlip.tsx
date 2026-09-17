import { formatTimecode, type Analysis } from "../lib/analyze";

export function ResultSlip({ result }: { result: Analysis }) {
  const evidenceTitle = result.kind === "image" ? "관찰 포인트" : "의심 구간";

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-16 md:px-8">
      <article
        aria-live="polite"
        className="bg-paper text-stamp shadow-[0_22px_50px_rgba(8,10,12,0.38)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d4cfc3] bg-[color-mix(in_srgb,var(--color-paper)_70%,#ddd6c6)] px-6 py-4 md:px-10">
          <p className="font-mono text-[11px] tracking-[0.16em] text-[#6a5340]">
            RESULT SLIP · 결과지
          </p>
          <p className="font-mono text-[11px] tracking-[0.12em] text-[#8a4d28] uppercase">
            참고용 · 진위 확정 아님
          </p>
        </div>
        <div className="grid gap-0 md:grid-cols-[0.9fr_1.1fr]">
          <div className="border-b border-[#d4cfc3] p-6 md:border-r md:border-b-0 md:p-10">
            <p className="font-mono text-[11px] tracking-[0.16em] text-[#6a5340]">
              {result.kind === "image" ? "STILL" : "CLIP"} · {result.level}
            </p>
            <p className="mt-3 font-display text-4xl tracking-[-0.04em]">
              {result.verdict}
            </p>
            <p className="mt-4 max-w-[36ch] text-base leading-relaxed text-[#3f433c]">
              {result.summary}
            </p>
            <div className="mt-8 space-y-4">
              <div>
                <div className="flex items-baseline justify-between gap-4 text-sm text-[#5c6158]">
                  <span>AI로 만들었을 가능성</span>
                  <strong className="font-display text-[1.7rem] tracking-[-0.04em] text-[#8a4d28] tabular-nums">
                    {result.aiChance}%
                  </strong>
                </div>
                <div className="mt-1.5 h-2 bg-[#d8d3c6]" aria-hidden>
                  <div
                    className="h-full bg-[#8a4d28]"
                    style={{ width: `${result.aiChance}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-baseline justify-between gap-4 text-sm text-[#5c6158]">
                  <span>실제 촬영 가능성</span>
                  <strong className="font-display text-[1.7rem] tracking-[-0.04em] tabular-nums">
                    {result.realChance}%
                  </strong>
                </div>
                <div className="mt-1.5 h-2 bg-[#d8d3c6]" aria-hidden>
                  <div
                    className="h-full bg-[#3f4a3c]"
                    style={{ width: `${result.realChance}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="p-6 md:p-10">
            <p className="font-display text-2xl tracking-[-0.03em]">{evidenceTitle}</p>
            <ul className="mt-6 space-y-5">
              {result.marks.map((mark) => (
                <li key={`${mark.time}-${mark.label}`}>
                  <p className="font-mono text-sm text-[#6a5340]">
                    {result.kind === "image" ? "PHOTO" : formatTimecode(mark.time)}
                  </p>
                  <p className="mt-1 text-base font-medium">{mark.label}</p>
                  <p className="mt-1 max-w-[52ch] text-sm leading-relaxed text-[#4f544c]">
                    {mark.detail}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-8 font-mono text-xs text-[#5c6158]">
              {result.width}×{result.height} / {result.fileName}
            </p>
          </div>
        </div>
        <div className="border-t border-[#d4cfc3] px-6 py-5 md:px-10">
          <ul className="max-w-[70ch] space-y-2 text-sm leading-relaxed text-[#4f544c]">
            {result.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </article>
    </div>
  );
}
