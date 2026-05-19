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
  { id: 'auth', label: 'ЯДРО АВТОРИЗАЦИИ', host: 'узел-авт-01', uptime: '99.1%', crashAt: 40, seed: 3 },
  { id: 'api', label: 'ШЛЮЗ ПРИЛОЖЕНИЙ', host: 'узел-прк-03', uptime: '98.9%', crashAt: 39, seed: 7 },
]

const POINTS = 48
const CHART_W = 400
const CHART_H = 110
const PAD = { t: 8, r: 8, b: 18, l: 32 }

const PANIC_TEMPLATES = [
  'ядро: СБОЙ: не удалось обработать страничный запрос ядра по адресу 0x{hex}',
  'systemd[1]: сервис auth-core: основной процесс завершён, код=выход, статус=1/СБОЙ',
  'sshd[{n}]: ошибка: превышено число попыток входа для суперпользователя',
  'iptables: БЛОК ВХ=eth0 ИСТ=185.{n}.{n}.{n} ПРОТ=TCP ПОРТ=22',
  'cryptomodule: КРИТИЧНО — сбой вывода ключа (код=EINVAL)',
  'nginx: [ошибка] вышестоящий сервер преждевременно закрыл соединение при чтении ответа',
  'audit: AVC отклонено {op} для pid={n} comm="злоумышленник"',
  'убийца-OOM: нехватка памяти: убит процесс {n} (python3) приоритет 900',
  'rsyslogd: imuxsock потеряно {n} сообщений от pid={n} из-за ограничения частоты',
  'узел-восст: ошибка сегментации по адресу 0x{hex} ip 00007f{n}',
  'межсетевой-экран: ОБНАРУЖЕНО ВТОРЖЕНИЕ — сектор 0x{hex} несовпадение контрольной суммы',
  'ядро-БД: пул соединений исчерпан — 0 доступных соединений',
  'tls-рукопожатие: проверка сертификата не пройдена (самоподписанный сертификат)',
  'init: цель Восстановление.target не достигнута',
  'сторож: СБОЙ: мягкая блокировка — CPU#0 зависла на 23 с!',
]

function randHex(len = 8) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

function randomPanicLine() {
  const tpl = PANIC_TEMPLATES[Math.floor(Math.random() * PANIC_TEMPLATES.length)]
  return tpl
    .replace(/\{hex\}/g, randHex())
    .replace(/\{n\}/g, () => String(Math.floor(Math.random() * 9000) + 1000))
    .replace(/\{op\}/g, ['чтение', 'запись', 'исполнение'][Math.floor(Math.random() * 3)])
}

function PanicConsole() {
  const [lines, setLines] = useState([
    { id: 0, text: '[ядро] ---[ конец паники ядра — не синхронизируется: фатальное исключение ]---', err: true },
    { id: 1, text: 'systemd-journald: пропущено 1847 сообщений ядра', err: false },
  ])
  const bodyRef = useRef(null)
  const idRef = useRef(2)

  useEffect(() => {
    const tick = () => {
      const burst = Math.random() > 0.7 ? 2 : 1
      const batch = Array.from({ length: burst }, () => {
        const id = idRef.current++
        const text = randomPanicLine()
        const err = /КРИТИЧНО|ошибк|сбой|отклон|сегментац|паник|БЛОК|убит|ВТОРЖЕНИ|не пройдена|не достигнута/i.test(text)
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
        <span className="panel-tag">ЯДРО</span>
        <span className="panic-console-title">Аварийный вывод системы</span>
        <span className="panic-console-badge">ПОТОК</span>
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
        <span className="chart-status">СБОЙ</span>
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
        <span>{uptime} / 24ч</span>
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
    '[ЗАГР] Аварийный терминал',
    '[ПРЕД] Вторжение обнаружено',
    '[ОШИБ] Целостность: 12%',
    '[ИНФО] Нужны 4 шарда',
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
      appendLog('ОШИБ', 'Введите все 4 шарда восстановления')
      return
    }

    setLoading(true)
    appendLog('ИНФО', 'Отправка шардов на верификацию…')

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
              ? 'Сервер не найден — проверьте деплой бэкенда на Vercel'
              : detail
          } else if (Array.isArray(detail)) msg = detail.map((e) => e.msg).join('; ')
        } catch {
          if (text) msg = `Ошибка сервера (${res.status})`
        }
        appendLog('ОШИБ', msg)
        return
      }

      appendLog('ОК  ', 'Целостность восстановлена')
      setSuccess(true)
    } catch {
      appendLog('ОШИБ', 'Нет связи с сервером восстановления')
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
          <span className="header-incident">ИНЦИДЕНТ АКТИВЕН</span>
        </div>
        <div className="header-right">
          <span className="header-integrity">Целостность {integrity}%</span>
          <span className="header-time">{new Date().toLocaleTimeString('ru-RU')}</span>
        </div>
      </header>

      <main className="main">
        <section className="charts-section">
          <div className="section-head">
            <span className="panel-tag">ДОСТУПНОСТЬ</span>
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
                <span className="panel-tag">ВОССТАНОВЛЕНИЕ</span>
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
                    placeholder="ключ в hex…"
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
                <span className="panel-tag">СИСЛОГ</span>
                <h2>Журнал</h2>
              </div>
            </div>
            <div className="log-body">
              {logLines.map((line, i) => (
                <div
                  key={i}
                  className={`log-line${
                    line.includes('[ОШИБ') ? ' log-line-err' :
                    line.includes('[ОК  ') ? ' log-line-ok' : ''
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

      <footer className="footer">УЗЕЛ-ВОССТ-07 // ОЖИДАНИЕ ВВОДА</footer>

      {success && <SuccessModal />}
    </div>
  )
}
