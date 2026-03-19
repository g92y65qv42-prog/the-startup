import { app, BrowserWindow, nativeTheme } from 'electron'
import { join } from 'path'
import { registerLayoutIpc } from './services/ipc/layout'
import { registerTasksIpc } from './services/ipc/tasks'
import { registerGradesIpc } from './services/ipc/grades'
import { registerPomodoroIpc } from './services/ipc/pomodoro'
import { registerShellIpc } from './services/ipc/shell'
import { registerNewsIpc } from './services/ipc/news'
import { registerTranscriptionIpc } from './services/ipc/transcription'

nativeTheme.themeSource = 'dark'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1C1C1E',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    vibrancy: undefined,
    transparent: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false // needed for preload to access Node APIs
    }
  })

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  try {
    registerLayoutIpc()
    registerTasksIpc()
    registerGradesIpc()
    registerPomodoroIpc()
    registerShellIpc()
    registerNewsIpc()
    registerTranscriptionIpc()
  } catch (err) {
    console.error('[startup] IPC registration failed — native module may need rebuilding:', err)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
