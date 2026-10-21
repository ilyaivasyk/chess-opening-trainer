import { useEffect, useRef, useState } from 'react'
import type { Locale } from './i18n/locale'
import { historyUi } from './history-copy'

export function PgnExport({ pgn, locale }: { pgn: string; locale: Locale }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const currentPgn = useRef(pgn)
  currentPgn.current = pgn
  useEffect(() => setStatus('idle'), [pgn])
  const t = (key: keyof typeof historyUi) => historyUi[key][locale]

  async function copyPgn() {
    const value = pgn
    setStatus('idle')
    try {
      await navigator.clipboard.writeText(value)
      if (currentPgn.current === value) setStatus('copied')
    } catch {
      if (currentPgn.current === value) setStatus('failed')
    }
  }

  return <div className="pgn-export">
    <button className="secondary" onClick={() => void copyPgn()} disabled={!pgn.trim()}>{t('copyPgn')}</button>
    <p className="pgn-feedback" role="status">{status === 'copied' ? t('pgnCopied') : status === 'failed' ? t('pgnCopyFailed') : ''}</p>
    {status === 'failed' && <label className="pgn-manual">{t('manualPgn')}
      <textarea value={pgn} readOnly rows={6} spellCheck={false} onFocus={(event) => event.currentTarget.select()} />
    </label>}
  </div>
}
