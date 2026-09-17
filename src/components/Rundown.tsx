import type { Analysis, Progress } from "../lib/analyze";

const STEPS = [
  { id: "ingest", title: "INGEST", copy: "파일 형식과 길이를 받습니다." },
  { id: "scan", title: "SCAN", copy: "프레임을 뽑아 신호를 비교합니다." },
  { id: "marks", title: "MARKS", copy: "튀는 구간이나 사진의 관찰 포인트를 남깁니다." },
  { id: "call", title: "CALL", copy: "점수와 결과지를 한 장에 적습니다." },
] as const;

function mark(done: boolean, current: boolean) {
  if (done) return "━━━━";
  if (current) return "━ ━ ━";
  return "····";
}

type Props = {
  progress: Progress | null;
  result: Analysis | null;
  fileName: string | null;
};

export function Rundown({ progress, result, fileName }: Props) {
  const order = STEPS.map((step) => step.id);
  const currentIndex = progress
    ? order.indexOf(progress.stage)
    : result
      ? order.length
      : -1;

  return (
    <aside className="border border-rail bg-[color-mix(in_srgb,var(--color-paper)_92%,#d8d3c6)] p-5 text-stamp shadow-[0_16px_34px_rgba(8,10,12,0.28)] md:mt-28 md:p-6">
      <p className="font-mono text-[11px] tracking-[0.16em] text-[#5c6158]">
        RUNDOWN
      </p>
      <p className="mt-2 font-display text-2xl tracking-[-0.03em]">
        {result ? "결과" : "큐시트"}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[#4f544c]">
        {result
          ? `${result.verdict} · 생성 ${result.aiChance}%`
          : (fileName ?? "클립이나 사진이 올라오면 항목이 닫힙니다.")}
      </p>
      <ol className="mt-6 space-y-4">
        {STEPS.map((step, index) => {
          const done = currentIndex > index || Boolean(result);
          const current = currentIndex === index && !result;
          return (
            <li key={step.id} className="grid grid-cols-[72px_1fr] gap-3">
              <span className="font-mono text-xs text-[#6a5340]">
                {mark(done, current)}
              </span>
              <div>
                <p className="font-mono text-xs tracking-[0.12em]">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[#4f544c]">
                  {step.copy}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
