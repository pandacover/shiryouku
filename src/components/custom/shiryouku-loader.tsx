import React from "react";

const ASCII = `
                    ###                #####  ####                           #####                  
                   #######             ##### #####                           #####                  
                   ##   ##             ## ## ##  ##                         ##  ########            
                  ##  ####   #####    ## ##   ## ##      ###########       ##       ####            
                  #  #  #   ### ##    ## ####### ##      ##     #####    ###  ######  ##            
                  ######  ###  ###    ##      ## ##      ##     #  ##    #  ###   ## ###            
                     #  ###  ####      ###### # ##       ### ## #  ##    ####   ### ###             
                   ######  ####        ####  #  ##       ##     #  ##        ####  ###              
                   ##   #####             ### ###        ##        ##      ####  ###                
                   #######                ######         ############      #  #####                 
                    ###                   ####             #########       #####                    
                                                                                                    
                                                                                                    
`;

function normalizeAscii(input: string) {
  const lines = input.split("\n").slice(1, -1);

  const left = Math.min(
    ...lines.map((l) => {
      const idx = l.search(/[^ ]/);
      return idx === -1 ? Infinity : idx;
    }),
  );

  const right = Math.max(...lines.map((l) => l.length - l.trimEnd().length));

  return lines.map((l) => l.slice(left, l.length - right));
}

function buildGrid(asciiLines: string[]) {
  const maxWidth = Math.max(...asciiLines.map((l) => l.length));

  return asciiLines.map((line) =>
    line
      .padEnd(maxWidth, " ")
      .split("")
      .map((ch) => (ch === "#" ? 1 : 0)),
  );
}

const CLEAN = normalizeAscii(ASCII);
const GRID = buildGrid(CLEAN);

const ROWS = GRID.length;
const COLS = GRID[0].length;

export function ShiryoukuLoader() {
  const pixelSize = 6;
  const gap = 1;
  const duration = 1.6;
  const color = "#111";

  return (
    <div style={{ padding: 20 }}>
      <style>{`
        @keyframes wave {
          0%,100% { opacity: 0.1; transform: translateY(0px); }
          45% { opacity: 1; transform: translateY(-4px); }
        }
      `}</style>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, ${pixelSize}px)`,
          gridTemplateRows: `repeat(${ROWS}, ${pixelSize}px)`,
          gap,
        }}
      >
        {GRID.map((row, r) =>
          row.map((on, c) => (
            <div
              key={`${r}-${c}`}
              style={{
                width: pixelSize,
                height: pixelSize,
                background: color,
                opacity: on ? 0.1 : 0,
                animation: on
                  ? `wave ${duration}s ease-in-out ${(c / COLS) * duration}s infinite`
                  : "none",
              }}
            />
          )),
        )}
      </div>
    </div>
  );
}
