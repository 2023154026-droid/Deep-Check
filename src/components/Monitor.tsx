import { useState } from "react";

type Props = {
  file: File | null;
  preview: string | null;
  busy: boolean;
  error: string | null;
  onPick: () => void;
  onFile: (file: File) => void;
};

export function Monitor({ file, preview, busy, error, onPick, onFile }: Props) {
  const [over, setOver] = useState(false);

  return (
    <div className="bg-[#14181d] p-3 shadow-[0_18px_40px_rgba(8,10,12,0.45)] md:p-4">
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] tracking-[0.16em] text-mute uppercase">
        <span>PGM 1</span>
        <span>{file ? file.name : "NO INPUT"}</span>
      </div>
      <button
        type="button"
        onClick={onPick}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          const next = event.dataTransfer.files[0];
          if (next) onFile(next);
        }}
        aria-label="영상 또는 사진 파일 선택"
        className={`relative flex min-h-[340px] aspect-[16/10] max-h-[min(72vh,680px)] w-full items-center justify-center overflow-hidden border text-left md:min-h-[520px] ${
          over || error
            ? "border-phosphor"
            : "border-rail"
        } ${busy ? "cursor-wait" : "cursor-pointer"}`}
      >
        {preview ? (
          file?.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(file?.name ?? "") ? (
            <img
              src={preview}
              alt="올린 사진 미리보기"
              className="absolute inset-0 h-full w-full object-contain bg-[#0b0e12]"
            />
          ) : (
            <video
              src={preview}
              className="absolute inset-0 h-full w-full object-contain bg-[#0b0e12]"
              muted
              playsInline
              loop
              autoPlay
            />
          )
        ) : (
          <span className="flex flex-col items-center gap-3 px-6 text-center">
            <span className="font-mono text-phosphor">REC</span>
            <span className="text-sm text-ink">영상이나 사진을 끌어오거나 클릭해서 선택</span>
          </span>
        )}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(transparent,rgba(10,12,14,0.72))] px-3 py-2 font-mono text-[11px] text-phosphor">
          {busy ? "SCANNING" : over ? "DROP" : "INPUT"}
        </span>
      </button>
    </div>
  );
}
