import { useMemo } from 'react';

export default function AnimeBackground() {
  const petals = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 8 + Math.random() * 14,
        duration: 8 + Math.random() * 12,
        delay: Math.random() * 10,
        drift: (Math.random() - 0.5) * 200,
        hue: Math.random() > 0.5 ? '#f9a8d4' : '#fbcfe8',
      })),
    []
  );

  return (
    <>
      <div
        className="glow-orb"
        style={{
          width: 400,
          height: 400,
          top: '10%',
          left: '5%',
          background: 'radial-gradient(circle, rgba(236,72,153,0.15) 0%, transparent 70%)',
        }}
      />
      <div
        className="glow-orb"
        style={{
          width: 350,
          height: 350,
          bottom: '10%',
          right: '5%',
          background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)',
          animationDelay: '5s',
        }}
      />
      <div
        className="glow-orb"
        style={{
          width: 300,
          height: 300,
          top: '40%',
          right: '30%',
          background: 'radial-gradient(circle, rgba(168,85,247,0.1) 0%, transparent 70%)',
          animationDelay: '10s',
        }}
      />

      {petals.map((p) => (
        <div
          key={p.id}
          className="sakura-petal"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            ['--drift' as any]: `${p.drift}px`,
          }}
        >
          <svg viewBox="0 0 24 24" width={p.size} height={p.size}>
            <path
              d="M12 2C14 6 18 8 22 10C18 12 14 14 12 22C10 14 6 12 2 10C6 8 10 6 12 2Z"
              fill={p.hue}
              opacity={0.7}
            />
          </svg>
        </div>
      ))}
    </>
  );
}
