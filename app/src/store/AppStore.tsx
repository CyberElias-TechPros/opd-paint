import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { getConsent, initAnalytics, setConsent as persistConsent, track, type ConsentState } from '../lib/analytics'

/**
 * Application state that must survive a page reload:
 *   • the project board (saved colours + saved products) — a visiting
 *     home-owner can build a scheme over several sessions and then send it to
 *     us as a quote request;
 *   • recently viewed colours, used for a "pick up where you left off" rail;
 *   • cookie/analytics consent.
 *
 * Everything is stored under a versioned key so a schema change cannot crash a
 * returning visitor's browser with malformed JSON.
 */

const STORAGE_KEY = 'opd.board.v1'
const CONSENT_KEY = 'opd.consent.v1'

export type Toast = { id: number; message: string; description?: string; tone: 'success' | 'error' | 'info' }

type BoardState = {
  savedColors: string[]
  savedProducts: string[]
  recentColors: string[]
  boardName: string
  updatedAt: number
}

const initialState: BoardState = {
  savedColors: [],
  savedProducts: [],
  recentColors: [],
  boardName: 'My project',
  updatedAt: 0,
}

type Action =
  | { type: 'hydrate'; state: BoardState }
  | { type: 'toggleColor'; id: string }
  | { type: 'saveColor'; id: string }
  | { type: 'removeColor'; id: string }
  | { type: 'toggleProduct'; id: string }
  | { type: 'saveProduct'; id: string }
  | { type: 'pushRecent'; id: string }
  | { type: 'rename'; name: string }
  | { type: 'clear' }
  | { type: 'import'; colours: string[]; products: string[] }

function reducer(state: BoardState, action: Action): BoardState {
  const stamp = Date.now()
  switch (action.type) {
    case 'hydrate':
      return action.state
    case 'toggleColor': {
      const has = state.savedColors.includes(action.id)
      return {
        ...state,
        savedColors: has ? state.savedColors.filter((c) => c !== action.id) : [action.id, ...state.savedColors],
        updatedAt: stamp,
      }
    }
    case 'saveColor':
      return state.savedColors.includes(action.id)
        ? state
        : { ...state, savedColors: [action.id, ...state.savedColors], updatedAt: stamp }
    case 'removeColor':
      return { ...state, savedColors: state.savedColors.filter((c) => c !== action.id), updatedAt: stamp }
    case 'toggleProduct': {
      const has = state.savedProducts.includes(action.id)
      return {
        ...state,
        savedProducts: has ? state.savedProducts.filter((p) => p !== action.id) : [action.id, ...state.savedProducts],
        updatedAt: stamp,
      }
    }
    case 'saveProduct':
      return state.savedProducts.includes(action.id)
        ? state
        : { ...state, savedProducts: [action.id, ...state.savedProducts], updatedAt: stamp }
    case 'pushRecent': {
      const recent = [action.id, ...state.recentColors.filter((c) => c !== action.id)].slice(0, 8)
      return { ...state, recentColors: recent }
    }
    case 'rename':
      return { ...state, boardName: action.name.slice(0, 60), updatedAt: stamp }
    case 'clear':
      return { ...initialState, recentColors: state.recentColors, updatedAt: stamp }
    // Merging a shared project link: union, never replace — a visitor who
    // receives someone else's scheme should not lose what they already saved.
    case 'import':
      return {
        ...state,
        savedColors: [...new Set([...state.savedColors, ...action.colours])],
        savedProducts: [...new Set([...state.savedProducts, ...action.products])],
        updatedAt: stamp,
      }
    default:
      return state
  }
}

type Ctx = {
  board: BoardState
  savedCount: number
  toggleColor: (id: string) => void
  saveColor: (id: string) => void
  removeColor: (id: string) => void
  toggleProduct: (id: string) => void
  saveProduct: (id: string) => void
  pushRecent: (id: string) => void
  renameBoard: (name: string) => void
  clearBoard: () => void
  importBoard: (colours: string[], products: string[]) => void
  isSaved: (id: string) => boolean
  isProductSaved: (id: string) => boolean
  toasts: Toast[]
  toast: (message: string, options?: { description?: string; tone?: Toast['tone'] }) => void
  dismissToast: (id: number) => void
  consent: ConsentState
  grantConsent: () => void
  denyConsent: () => void
  boardOpen: boolean
  setBoardOpen: (open: boolean) => void
}

const AppContext = createContext<Ctx | null>(null)

function loadBoard(): BoardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState
    const parsed = JSON.parse(raw) as Partial<BoardState>
    return {
      savedColors: Array.isArray(parsed.savedColors) ? parsed.savedColors.filter((v) => typeof v === 'string') : [],
      savedProducts: Array.isArray(parsed.savedProducts) ? parsed.savedProducts.filter((v) => typeof v === 'string') : [],
      recentColors: Array.isArray(parsed.recentColors) ? parsed.recentColors.filter((v) => typeof v === 'string') : [],
      boardName: typeof parsed.boardName === 'string' ? parsed.boardName : 'My project',
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    }
  } catch {
    return initialState
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [board, dispatch] = useReducer(reducer, initialState)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [consent, setConsent] = useState<ConsentState>('unknown')
  const [boardOpen, setBoardOpen] = useState(false)
  const hydrated = useRef(false)
  const toastId = useRef(0)

  useEffect(() => {
    dispatch({ type: 'hydrate', state: loadBoard() })
    setConsent(initAnalytics())
    hydrated.current = true
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(board))
    } catch {
      /* private mode / quota — state still works for this session */
    }
  }, [board])

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, options?: { description?: string; tone?: Toast['tone'] }) => {
      const id = ++toastId.current
      setToasts((current) => [...current.slice(-2), { id, message, description: options?.description, tone: options?.tone ?? 'success' }])
      window.setTimeout(() => dismissToast(id), 5200)
    },
    [dismissToast],
  )

  const toggleColor = useCallback(
    (id: string) => {
      const saved = board.savedColors.includes(id)
      dispatch({ type: 'toggleColor', id })
      track(saved ? 'colour_saved' : 'colour_saved', { colourId: id, action: saved ? 'remove' : 'add' })
      toast(saved ? 'Removed from your project' : 'Saved to your project', {
        description: saved ? undefined : 'Open your project board to compare, share or request a quote.',
        tone: saved ? 'info' : 'success',
      })
    },
    [board.savedColors, toast],
  )

  const saveColor = useCallback(
    (id: string) => {
      if (!board.savedColors.includes(id)) {
        dispatch({ type: 'saveColor', id })
        track('colour_saved', { colourId: id, action: 'add' })
      }
    },
    [board.savedColors],
  )

  const removeColor = useCallback((id: string) => dispatch({ type: 'removeColor', id }), [])
  const toggleProduct = useCallback((id: string) => dispatch({ type: 'toggleProduct', id }), [])
  const saveProduct = useCallback(
    (id: string) => {
      if (!board.savedProducts.includes(id)) {
        dispatch({ type: 'saveProduct', id })
        track('cta_click', { target: 'product-saved', productId: id })
      }
    },
    [board.savedProducts],
  )
  const pushRecent = useCallback((id: string) => dispatch({ type: 'pushRecent', id }), [])
  const renameBoard = useCallback((name: string) => dispatch({ type: 'rename', name }), [])
  const clearBoard = useCallback(() => {
    dispatch({ type: 'clear' })
    toast('Project board cleared', { tone: 'info' })
  }, [toast])
  const importBoard = useCallback(
    (colours: string[], products: string[]) => {
      dispatch({ type: 'import', colours, products })
      track('cta_click', { target: 'project-import', colours: colours.length, products: products.length })
      toast('Added to your project', { description: 'Open your project board to review it.', tone: 'success' })
    },
    [toast],
  )

  const grantConsent = useCallback(() => {
    persistConsent('granted')
    setConsent('granted')
    track('page_view', { path: window.location.pathname, reason: 'consent-granted' })
  }, [])

  const denyConsent = useCallback(() => {
    persistConsent('denied')
    setConsent('denied')
  }, [])

  const value = useMemo<Ctx>(
    () => ({
      board,
      savedCount: board.savedColors.length,
      toggleColor,
      saveColor,
      removeColor,
      toggleProduct,
      saveProduct,
      pushRecent,
      renameBoard,
      clearBoard,
      importBoard,
      isSaved: (id: string) => board.savedColors.includes(id),
      isProductSaved: (id: string) => board.savedProducts.includes(id),
      toasts,
      toast,
      dismissToast,
      consent,
      grantConsent,
      denyConsent,
      boardOpen,
      setBoardOpen,
    }),
    [
      board,
      toggleColor,
      saveColor,
      removeColor,
      toggleProduct,
      saveProduct,
      pushRecent,
      renameBoard,
      clearBoard,
      importBoard,
      toasts,
      toast,
      dismissToast,
      consent,
      grantConsent,
      denyConsent,
      boardOpen,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}

export function readConsent(): ConsentState {
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (raw === 'granted' || raw === 'denied') return raw
  } catch {
    /* noop */
  }
  return getConsent()
}
