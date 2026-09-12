type Props = {
  active: boolean;
  level: number;
};

export function Waveform({ active, level }: Props) {
  const bars = Array.from({ length: 42 }, (_, index) => {
    const wave = Math.abs(Math.sin(index * 0.55 + level * 8));
    const height = 12 + wave * 28 * (0.35 + level);
    return height;
  });

  return (
    <div
      className="mt-3 flex h-12 items-end gap-px bg-[#14181d] px-2 py-1"
      aria-hidden
    >
      {bars.map((height, index) => (
        <span
          key={index}
          className="w-full bg-phosphor"
          style={{
            height: `${height}px`,
            opacity: active ? 0.95 : 0.35,
          }}
        />
      ))}
    </div>
  );
}
