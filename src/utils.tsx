import React from 'react';

export const money = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');
export const num = (n: number) => Number(n).toLocaleString('es-MX');

export function generateBarcode(code: string, height = 58, color = '#16181a'): React.ReactElement {
  let s = 7;
  for (let i = 0; i < code.length; i++) s = (s * 131 + code.charCodeAt(i)) % 99991;
  const bars: React.ReactElement[] = [];
  for (let i = 0; i < 58; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const w = 1 + ((s >> 7) % 3);
    bars.push(
      <div key={i} style={{ width: `${w}px`, height: `${height}px`, background: i % 2 === 0 ? color : 'transparent', flex: '0 0 auto' }} />
    );
  }
  return <div style={{ display: 'flex', alignItems: 'stretch', gap: '1px', height: `${height}px` }}>{bars}</div>;
}

export function ValueChart(): React.ReactElement {
  const data = [820, 905, 872, 1010, 1068, 1147];
  const max = 1250, min = 750;
  const W = 320, H = 96;
  const n = data.length;
  const x = (i: number) => 10 + i * ((W - 20) / (n - 1));
  const y = (v: number) => H - 12 - ((v - min) / (max - min)) * (H - 28);
  let line = '';
  data.forEach((v, i) => { line += (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1) + ' '; });
  const area = line + `L ${x(n - 1).toFixed(1)} ${H - 8} L ${x(0).toFixed(1)} ${H - 8} Z`;
  const dots = data.map((v, i) => (
    <circle key={i} cx={x(i)} cy={y(v)} r={i === n - 1 ? 3.5 : 2.5}
      fill={i === n - 1 ? 'var(--c-primary)' : 'var(--c-surface)'}
      stroke="var(--c-primary)" strokeWidth={1.5} />
  ));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id="sv-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--c-primary)" stopOpacity={0.18} />
          <stop offset="100%" stopColor="var(--c-primary)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sv-g)" />
      <path d={line} fill="none" stroke="var(--c-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {dots}
    </svg>
  );
}
