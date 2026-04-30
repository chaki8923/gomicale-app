export default function MaintenancePage() {
  const period = process.env.MAINTENANCE_PERIOD ?? '今しばらくお待ちください'

  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>メンテナンス中 | ゴミカレ</title>
        <meta name="robots" content="noindex, nofollow" />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f0c29;
            min-height: 100dvh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }

          /* ---- gradient background ---- */
          .bg-gradient {
            position: fixed;
            inset: 0;
            background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
            z-index: 0;
          }

          /* ---- floating blobs ---- */
          .blob {
            position: fixed;
            border-radius: 50%;
            filter: blur(80px);
            opacity: 0.25;
            z-index: 0;
            animation: blobFloat 8s ease-in-out infinite alternate;
          }
          .blob-1 { width: 500px; height: 500px; background: #6c63ff; top: -150px; left: -150px; animation-delay: 0s; }
          .blob-2 { width: 400px; height: 400px; background: #f64f59; bottom: -100px; right: -100px; animation-delay: -3s; }
          .blob-3 { width: 300px; height: 300px; background: #43e97b; top: 40%; left: 40%; animation-delay: -5s; }

          @keyframes blobFloat {
            from { transform: translate(0, 0) scale(1); }
            to   { transform: translate(30px, -40px) scale(1.1); }
          }

          /* ---- card ---- */
          .card {
            position: relative;
            z-index: 1;
            background: rgba(255,255,255,0.05);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 24px;
            padding: 56px 48px;
            max-width: 520px;
            width: 90%;
            text-align: center;
            box-shadow: 0 25px 60px rgba(0,0,0,0.4);
            animation: cardIn 0.8s cubic-bezier(0.22,1,0.36,1) both;
          }

          @keyframes cardIn {
            from { opacity: 0; transform: translateY(32px) scale(0.96); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }

          /* ---- gear icon ---- */
          .gear-wrapper {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            margin-bottom: 32px;
            height: 72px;
          }

          .gear {
            fill: none;
            stroke: rgba(255,255,255,0.8);
            stroke-width: 2;
            transform-origin: center;
          }
          .gear-large  { animation: spin 6s linear infinite; }
          .gear-small  { animation: spin 4s linear infinite reverse; }

          @keyframes spin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }

          /* ---- pulse ring ---- */
          .pulse-ring {
            position: absolute;
            width: 100px;
            height: 100px;
            border-radius: 50%;
            border: 2px solid rgba(108,99,255,0.5);
            animation: pulseRing 2.4s ease-out infinite;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
          }
          .pulse-ring:nth-child(2) { animation-delay: 0.8s; }
          .pulse-ring:nth-child(3) { animation-delay: 1.6s; }

          @keyframes pulseRing {
            0%   { transform: translate(-50%,-50%) scale(0.6); opacity: 0.8; }
            100% { transform: translate(-50%,-50%) scale(2);   opacity: 0; }
          }

          /* ---- dots loading ---- */
          .dots { display: flex; justify-content: center; gap: 8px; margin-top: 32px; }
          .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: rgba(255,255,255,0.5);
            animation: dotBounce 1.4s ease-in-out infinite;
          }
          .dot:nth-child(1) { animation-delay: 0s; }
          .dot:nth-child(2) { animation-delay: 0.2s; }
          .dot:nth-child(3) { animation-delay: 0.4s; }

          @keyframes dotBounce {
            0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
            40%            { transform: scale(1.2); opacity: 1; }
          }

          /* ---- typography ---- */
          h1 {
            font-size: clamp(1.4rem, 4vw, 1.75rem);
            font-weight: 700;
            color: #fff;
            letter-spacing: -0.02em;
            margin-bottom: 16px;
            animation: fadeUp 0.8s 0.3s both;
          }

          .period-label {
            font-size: 0.78rem;
            font-weight: 600;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: rgba(108,99,255,1);
            background: rgba(108,99,255,0.15);
            border: 1px solid rgba(108,99,255,0.3);
            border-radius: 6px;
            padding: 4px 12px;
            display: inline-block;
            margin-bottom: 8px;
            animation: fadeUp 0.8s 0.45s both;
          }

          .period {
            font-size: clamp(0.95rem, 2.5vw, 1.1rem);
            color: rgba(255,255,255,0.9);
            font-weight: 600;
            animation: fadeUp 0.8s 0.5s both;
            margin-bottom: 20px;
          }

          .apology {
            font-size: clamp(0.82rem, 2vw, 0.92rem);
            color: rgba(255,255,255,0.5);
            line-height: 1.7;
            animation: fadeUp 0.8s 0.6s both;
          }

          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }

          /* ---- divider ---- */
          .divider {
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
            margin: 24px 0;
          }

          /* ---- logo ---- */
          .logo {
            font-size: 0.85rem;
            color: rgba(255,255,255,0.3);
            margin-top: 8px;
            animation: fadeUp 0.8s 0.7s both;
            font-weight: 500;
            letter-spacing: 0.05em;
          }
        `}</style>
      </head>
      <body>
        <div className="bg-gradient" />
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />

        <div className="card">
          {/* Gear icons with pulse rings */}
          <div className="gear-wrapper" style={{ position: 'relative' }}>
            <div className="pulse-ring" />
            <div className="pulse-ring" />
            <div className="pulse-ring" />

            {/* Large gear */}
            <svg width="52" height="52" viewBox="0 0 52 52" className="gear gear-large">
              <path d="M26 16a10 10 0 1 1 0 20 10 10 0 0 1 0-20z" />
              <path strokeLinecap="round" d="M26 6v4M26 42v4M6 26h4M42 26h4M10.1 10.1l2.83 2.83M39.07 39.07l2.83 2.83M41.9 10.1l-2.83 2.83M12.93 39.07l-2.83 2.83" />
            </svg>

            {/* Small gear */}
            <svg width="30" height="30" viewBox="0 0 30 30" className="gear gear-small" style={{ marginTop: 16 }}>
              <path d="M15 9a6 6 0 1 1 0 12A6 6 0 0 1 15 9z" />
              <path strokeLinecap="round" d="M15 3v2M15 25v2M3 15h2M25 15h2M6.22 6.22l1.41 1.41M22.37 22.37l1.41 1.41M23.78 6.22l-1.41 1.41M7.63 22.37l-1.41 1.41" />
            </svg>
          </div>

          <h1>ただいまメンテナンス中です</h1>

          <div className="divider" />

          <p className="period-label">復旧予定</p>
          <p className="period">{period}</p>

          <p className="apology">
            ご迷惑おかけして申し訳ございません。<br />
            メンテナンス終了後に改めてご利用ください。
          </p>

          <div className="dots">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>

          <p className="logo">GomiCale / ゴミカレ</p>
        </div>
      </body>
    </html>
  )
}
