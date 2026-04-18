import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 32,
        height: 32,
        background: '#111111',
        borderRadius: 7,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: 8,
        paddingRight: 8,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3.5, width: '100%' }}>
        {/* Title line */}
        <div style={{ width: '100%', height: 2.5, background: '#ffffff', borderRadius: 2 }} />
        {/* Body lines */}
        <div style={{ width: '75%', height: 1.5, background: 'rgba(255,255,255,0.5)', borderRadius: 2 }} />
        <div style={{ width: '90%', height: 1.5, background: 'rgba(255,255,255,0.35)', borderRadius: 2 }} />
        {/* Accent / crit mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4a9eff' }} />
          <div style={{ flex: 1, height: 1.5, background: 'rgba(255,255,255,0.25)', borderRadius: 2 }} />
        </div>
      </div>
    </div>,
    { ...size },
  );
}
