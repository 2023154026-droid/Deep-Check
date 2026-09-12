import { formatTimecode, type Analysis } from "../lib/analyze";

export function ResultSlip({ result }: { result: Analysis }) {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-16 md:px-8">
      <article className="bg-paper text-stamp shadow-[0_22px_50px_rgba(8,10,12,0.38)]">
        <div className="grid gap-0 md:grid-cols-[0.9fr_1.1fr]">
          <div className="border-b border-[#d4cfc3] p-6 md:border-r md:border-b-0 md:p-10">
            <p className="font-mono text-[11px] tracking-[0.16em] text-[#6a5340]">
              CALL SHEET
            </p>
            <p className="mt-3 font-display text-4xl tracking-[-0.04em]">
              {result.level}
            </p>
            <p className="mt-4 max-w-[36ch] text-base leading-relaxed text-[#3f433c]">
              {result.summary}
            </p>
            <dl className="mt-8 grid grid-cols-2 gap-6">
              <div>
                <dt className="text-sm text-[#5c6158]">실제 가능성</dt>
                <dd className="font-display text-4xl tracking-[-0.04em] tabular-nums">
                  {result.realChance}
                  <span className="text-lg">%</span>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-[#5c6158]">생성 가능성</dt>
                <dd className="font-display text-4xl tracking-[-0.04em] text-[#8a4d28] tabular-nums">
                  {result.aiChance}
                  <span className="text-lg">%</span>
                </dd>
              </div>
            </dl>
          </div>
          <div className="p-6 md:p-10">
            <p className="font-display text-2xl tracking-[-0.03em]">의심 구간</p>
            <ul className="mt-6 space-y-5">
              {result.marks.map((mark) => (
                <li key={`${mark.time}-${mark.label}`}>
                  <p className="font-mono text-sm text-[#6a5340]">
                    {formatTimecode(mark.time)}
                  </p>
                  <p className="mt-1 text-base font-medium">{mark.label}</p>
                  <p className="mt-1 max-w-[52ch] text-sm leading-relaxed text-[#4f544c]">
                    {mark.detail}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-8 font-mono text-xs text-[#5c6158]">
              {result.width}x{result.height} / {result.fileName}
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
