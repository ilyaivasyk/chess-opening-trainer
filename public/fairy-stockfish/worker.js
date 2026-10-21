const pending = []
let engine
const reportError = (error) => self.postMessage({ error: String(error) })

self.onmessage = ({ data }) => {
  if (typeof data !== 'string') return
  if (engine) engine.command(data)
  else pending.push(data)
}

try {
  importScripts('./fairy-stockfish.js')
  FairyStockfish({
    locateFile: (name) => new URL(name, self.location.href).href,
    print: (line) => self.postMessage(line),
    printErr: reportError,
  }).then((module) => {
    module.initialize()
    engine = module
    for (const command of pending) engine.command(command)
    pending.length = 0
  }).catch(reportError)
} catch (error) {
  reportError(error)
}
