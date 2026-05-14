import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { apiUrl } from './api.js'
import './App.css'

const REDIRECT_URL = 'https://mosmolodezh.ru/'
const REDIRECT_DELAY_MS = 4000

const SHARD_LABELS = [
  'Шард α — ядро доступа',
  'Шард β — контрольная сумма',
  'Шард γ — ключ шифрования',
  'Шард δ — токен восстановления',
]

const UPTIME_SERVICES = [
  { id: 'auth', label: 'AUTH CORE', host: 'node-auth-01', uptime: '99.1%', crashAt: 40, seed: 3 },
  { id: 'api', label: 'API GATEWAY', host: 'node-api-03', uptime: '98.9%', crashAt: 39, seed: 7 },
]

const POINTS = 48
const CHART_W = 400
const CHART_H = 110
const PAD = { t: 8, r: 8, b: 18, l: 32 }

const PANIC_TEMPLATES = [
  'kernel: BUG: unable to handle kernel paging request at 0x{hex}',
  'systemd[1]: auth-core.service: Main process exited, code=exited, status=1/FAILURE',
  'sshd[{n}]: error: maximum authentication attempts exceeded for root',
  'iptables: DROP IN=eth0 SRC=185.{n}.{n}.{n} PROTO=TCP DPT=22',
  'cryptomodule: FATAL — key derivation failed (errno=EINVAL)',
  'nginx: [error] upstream prematurely closed connection while reading response',
  'audit: AVC denied { op } for pid={n} comm="intruder"',
  'OOM killer: Out of memory: Kill process {n} (python3) score 900',
  'rsyslogd: imuxsock lost {n} messages from pid={n} due to rate-limiting',
  'recovery-node: segmentation fault at 0x{hex} ip 00007f{n}',
  'firewall: INTRUSION DETECTED — sector 0x{hex} checksum mismatch',
  'db_core: connection pool exhausted — 0 available connections',
  'tls_handshake: certificate verify failed (self signed certificate)',
  'init: target Recovery.target failed',
  'watchdog: BUG: soft lockup - CPU#0 stuck for 23s!',
]

function randHex(len = 8) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

function randomPanicLine() {
  const tpl = PANIC_TEMPLATES[Math.floor(Math.random() * PANIC_TEMPLATES.length)]
  return tpl
    .replace(/\{hex\}/g, randHex())
    .replace(/\{n\}/g, () => String(Math.floor(Math.random() * 9000) + 1000))
    .replace(/\{op\}/g, ['read', 'write', 'exec'][Math.floor(Math.random() * 3)])
}

function PanicConsole() {
  const [lines, setLines] = useState([
    { id: 0, text: '[kernel] ---[ end Kernel panic - not syncing: Fatal exception ]---', err: true },
    { id: 1, text: 'systemd-journald: Missed {n} kernel messages'.replace('{n}', '1847'), err: false },
  ])
  const bodyRef = useRef(null)
  const idRef = useRef(2)

  useEffect(() => {
    const tick = () => {
      const burst = Math.random() > 0.7 ? 2 : 1
      const batch = Array.from({ length: burst }, () => {
        const id = idRef.current++
        const text = randomPanicLine()
        const err = /FATAL|error|failed|denied|fault|panic|DROP|KILL|INTRUSION/i.test(text)
        return { id, text, err }
      })
      setLines((prev) => [...prev, ...batch].slice(-40))
    }

    tick()
    const fast = setInterval(tick, 420)
    const burst = setInterval(() => {
      const batch = Array.from({ length: 4 }, () => {
        const id = idRef.current++
        return { id, text: randomPanicLine(), err: true }
      })
      setLines((prev) => [...prev, ...batch].slice(-40))
    }, 5000)

    return () => {
      clearInterval(fast)
      clearInterval(burst)
    }
  }, [])

  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  return (
    <section className="panic-console">
      <div className="panic-console-head">
        <span className="panel-tag">KERNEL</span>
        <span className="panic-console-title">Аварийный вывод системы</span>
        <span className="panic-console-badge">FLOOD</span>
      </div>
      <div className="panic-console-body" ref={bodyRef}>
        {lines.map((line) => (
          <div key={line.id} className={`panic-line${line.err ? ' panic-line-err' : ''}`}>
            <span className="panic-ts">{new Date().toLocaleTimeString('ru-RU')}</span>
            {line.text}
          </div>
        ))}
      </div>
    </section>
  )
}

function generateSeries(crashAt, seed) {
  return Array.from({ length: POINTS }, (_, i) => {
    const noise = ((seed * (i + 1) * 7) % 11) / 11
    if (i < crashAt) return 97.5 + noise * 2.5
    if (i === crashAt) return 38 + noise * 8
    return Math.max(0, 4 - (i - crashAt) * 1.2)
  })
}

function UptimeChart({ label, host, uptime, crashAt, seed }) {
  const data = useMemo(() => generateSeries(crashAt, seed), [crashAt, seed])
  const plotW = CHART_W - PAD.l - PAD.r
  const plotH = CHART_H - PAD.t - PAD.b

  const gradId = `grad-${label}`
  const toX = (i) => PAD.l + (i / (POINTS - 1)) * plotW
  const toY = (v) => PAD.t + plotH - (v / 100) * plotH

  const pathSegment = (from, to) =>
    data
      .slice(from, to + 1)
      .map((v, i) => {
        const idx = from + i
        return `${i === 0 ? 'M' : 'L'}${toX(idx).toFixed(1)},${toY(v).toFixed(1)}`
      })
      .join(' ')

  const areaPath = `${pathSegment(0, POINTS - 1)} L${toX(POINTS - 1).toFixed(1)},${toY(0).toFixed(1)} L${toX(0).toFixed(1)},${toY(0).toFixed(1)} Z`
  const crashX = toX(crashAt)

  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <div className="chart-card-title">
          <span className="chart-label">{label}</span>
          <span className="chart-host">{host}</span>
        </div>
        <span className="chart-status">DOWN</span>
      </div>
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="chart-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#39ff14" stopOpacity="0.25" />
            <stop offset={`${(crashAt / (POINTS - 1)) * 100}%`} stopColor="#39ff14" stopOpacity="0.2" />
            <stop offset={`${((crashAt + 1) / (POINTS - 1)) * 100}%`} stopColor="#ff3131" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ff3131" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={PAD.l} y1={toY(v)} x2={CHART_W - PAD.r} y2={toY(v)} className="chart-grid" />
            <text x={2} y={toY(v) + 3} className="chart-axis-y">{v}%</text>
          </g>
        ))}
        <text x={PAD.l} y={CHART_H - 2} className="chart-axis-x">−24ч</text>
        <text x={CHART_W - PAD.r - 18} y={CHART_H - 2} className="chart-axis-x">сейчас</text>
        <line x1={crashX} y1={PAD.t} x2={crashX} y2={PAD.t + plotH} className="chart-crash-line" />
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={pathSegment(0, crashAt)} className="chart-line-up" />
        <path d={pathSegment(crashAt, POINTS - 1)} className="chart-line-down" />
        <circle cx={toX(POINTS - 1)} cy={toY(data[POINTS - 1])} r="2.5" className="chart-dot" />
      </svg>
      <div className="chart-foot">
        <span>{uptime} / 24h</span>
        <span className="chart-crash-label">↓ сбой</span>
      </div>
    </div>
  )
}

function SuccessModal() {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = REDIRECT_URL
    }, REDIRECT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-icon">✓</div>
        <h2 className="modal-title">Всё круто! Система восстановлена</h2>
        <p className="modal-sub">
          Перенаправление через {REDIRECT_DELAY_MS / 1000} сек…
        </p>
        <div className="modal-bar">
          <div className="modal-bar-fill" />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [keys, setKeys] = useState(['', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [logLines, setLogLines] = useState([
    '[BOOT] Аварийный терминал',
    '[WARN] Вторжение обнаружено',
    '[ERR ] Целостность: 12%',
    '[INFO] Нужны 4 шарда',
  ])
  const [tick, setTick] = useState(0)

  const appendLog = useCallback((level, message) => {
    const time = new Date().toLocaleTimeString('ru-RU')
    setLogLines((prev) => [...prev, `[${level}] ${time} — ${message}`])
  }, [])

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const handleKeyChange = (index, value) => {
    setKeys((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const handleRestore = useCallback(async () => {
    if (keys.some((k) => !k.trim())) {
      appendLog('ERR ', 'Введите все 4 шарда восстановления')
      return
    }

    setLoading(true)
    appendLog('INFO', 'Отправка шардов на верификацию…')

    try {
      const res = await fetch(apiUrl('/restore'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys }),
      })

      if (!res.ok) {
        const text = await res.text()
        let msg = 'Ключи отклонены'
        try {
          const data = JSON.parse(text)
          const detail = data.detail
          if (typeof detail === 'string') {
            msg = detail === 'Not Found'
              ? 'API не найден — проверьте деплой бэкенда на Vercel'
              : detail
          } else if (Array.isArray(detail)) msg = detail.map((e) => e.msg).join('; ')
        } catch {
          if (text) msg = `Ошибка сервера (${res.status})`
        }
        appendLog('ERR ', msg)
        return
      }

      appendLog('OK  ', 'Целостность восстановлена')
      setSuccess(true)
    } catch {
      appendLog('ERR ', 'Нет связи с сервером восстановления')
    } finally {
      setLoading(false)
    }
  }, [keys, appendLog])

  const filledCount = keys.filter((k) => k.trim()).length
  const integrity = success ? 100 : Math.min(88, 12 + filledCount * 18 + (tick % 3))

  return (
    <div className="app">
      <div className="scanlines" />
      <div className="grid-bg" />

      <div className="warning-ticker">
        <div className="warning-ticker-track">
          <span>⚠ СИСТЕМА СКОМПРОМЕТИРОВАНА — ВВЕДИТЕ КЛЮЧИ ВОССТАНОВЛЕНИЯ — </span>
          <span>⚠ СИСТЕМА СКОМПРОМЕТИРОВАНА — ВВЕДИТЕ КЛЮЧИ ВОССТАНОВЛЕНИЯ — </span>
        </div>
      </div>

      <header className="header">
        <div className="header-left">
          <span className="status-dot" />
          <span className="header-status">КРИТИЧЕСКИЙ СБОЙ</span>
          <span className="header-incident">INCIDENT ACTIVE</span>
        </div>
        <div className="header-right">
          <span className="header-integrity">Целостность {integrity}%</span>
          <span className="header-time">{new Date().toLocaleTimeString('ru-RU')}</span>
        </div>
      </header>

      <main className="main">
        <section className="charts-section">
          <div className="section-head">
            <span className="panel-tag">UPTIME</span>
            <span className="section-sub">последние 24ч — критические узлы упали недавно</span>
          </div>
          <div className="charts-grid">
            {UPTIME_SERVICES.map((svc) => (
              <UptimeChart key={svc.id} {...svc} />
            ))}
          </div>
        </section>

        <PanicConsole />

        <div className="bottom-grid">
          <section className="panel keys-panel">
            <div className="panel-head-row">
              <div>
                <span className="panel-tag">RECOVERY</span>
                <h2>Шарды восстановления</h2>
              </div>
              <span className="shard-count">{filledCount}/4</span>
            </div>

            <div className="keys-grid">
              {SHARD_LABELS.map((label, i) => (
                <label key={i} className="key-field">
                  <span className="key-label">{label}</span>
                  <input
                    type="text"
                    className="key-input"
                    placeholder="hex-ключ…"
                    value={keys[i]}
                    onChange={(e) => handleKeyChange(i, e.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                  />
                </label>
              ))}
            </div>

            <button className="restore-btn" onClick={handleRestore} disabled={loading}>
              {loading ? 'Верификация…' : '▶ ВОССТАНОВИТЬ СИСТЕМУ'}
            </button>
          </section>

          <section className="panel log-panel">
            <div className="panel-head-row">
              <div>
                <span className="panel-tag">SYSLOG</span>
                <h2>Журнал</h2>
              </div>
            </div>
            <div className="log-body">
              {logLines.map((line, i) => (
                <div
                  key={i}
                  className={`log-line${
                    line.includes('[ERR ') ? ' log-line-err' :
                    line.includes('[OK  ') ? ' log-line-ok' : ''
                  }`}
                >
                  {line}
                </div>
              ))}
              <span className="log-cursor">_</span>
            </div>
          </section>
        </div>
      </main>

      <footer className="footer">NODE-RECOVERY-07 // AWAITING INPUT</footer>

      {success && <SuccessModal />}
    </div>
  )
}
