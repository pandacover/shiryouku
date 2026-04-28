const PIXELS = [
  [1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 1, 0],
  [0, 0, 0, 0, 0, 1, 0],
  [0, 0, 0, 0, 1, 0, 0],
  [0, 0, 0, 0, 1, 0, 0],
  [0, 0, 0, 1, 0, 0, 0],
  [0, 0, 1, 0, 0, 0, 0],
  [0, 1, 0, 0, 0, 0, 0],
  [1, 0, 0, 0, 0, 0, 0],
] as const;

const COLS = PIXELS[0].length;

interface RePixelLoaderProps {
  pixelSize?: number;
  gap?: number;
  duration?: number;
  color?: string;
}

export function RePixelLoader({
  pixelSize = 8,
  gap = 2,
  duration = 1.4,
  color = "currentColor",
}: RePixelLoaderProps) {
  return (
    <>
      <style>{`
        @keyframes re-pixel-wave {
          0%, 100% { opacity: 0.12; transform: translateY(0px); }
          45%       { opacity: 1;    transform: translateY(-${Math.round(pixelSize * 0.7)}px); }
        }
      `}</style>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, ${pixelSize}px)`,
          gap,
          width: "fit-content",
        }}
      >
        {PIXELS.map((row, r) =>
          row.map((on, c) => (
            <div
              key={`${r}-${c}`}
              style={{
                width: pixelSize,
                height: pixelSize,
                borderRadius: 1,
                background: color,
                opacity: on ? 0.12 : 0,
                animation: on
                  ? `re-pixel-wave ${duration}s ease-in-out ${(c * duration * 0.13).toFixed(3)}s infinite`
                  : undefined,
              }}
            />
          )),
        )}
      </div>
    </>
  );
}
