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
import type { SavedEstimate } from '../lib/advisor'
import type { SharedProject } from '../lib/share'

/**
 * Application state that must survive a page reload:
 *   • the project board (saved colours, products, quantities and the preparation
 *     situations the visitor identified) — a home-owner can build a scheme over
 *     several sessions, print it as a checklist, share it as a link, and then
 *     send the whole thing to us as one quote request;
 *   • recently viewed colours, used for a "pick up where you left off" rail;
 *   • cookie/analytics consent.
 *
 * Everything is stored under a versioned key. A schema change bumps the version
 * and migrates the previous one, so a returning visitor's board is upgraded
 * rather than discarded — and malformed JSON falls back to empty rather than
 * crashing the provider on mount.
 */

const STORAGE_KEY = 'opd.board.v2'
const LEGACY_KEYS = ['opd.board.v1']
const CONSENT_KEY = 'opd.consent.v1'

export type Toast = { id: number; message: string; description?: string | undefined; tone: 'success' | 'error' | 'info' }

export type BoardState = {
  savedColors: string[]
  savedProducts: string[]
  recentColors: string[]
  boardName: string
  /** Quantities saved from the calculator (roadmap 11.01.15). */
  estimates: SavedEstimate[]
  /** Preparation situations chosen for this project (roadmap 11.02.02). */
  prep: string[]
  updatedAt: number
}

const initialState: BoardState = {
  savedColors: [],
  savedProducts: [],
  recentColors: [],
  boardName: 'My project',
  estimates: [],
  prep: [],
  updatedAt: 0,
}

type Action =
  | { type: 'hydrate'; state: BoardState }
  | { type: 'toggleColor'; id: string }
  | { type: 'saveColor'; id: string }
  | { type: 'removeColor'; id: string }
  | { type: 'toggleProduct'; id: string }
  | { type: 'pushRecent'; id: string }
  | { type: 'rename'; name: string }
  | { type: 'clear' }
  | { type: 'saveEstimate'; estimate: SavedEstimate }
  | { type: 'removeEstimate'; id: string }
  | { type: 'togglePrep'; id: string }
  | { type: 'merge'; project: SharedProject }

const MAX_ESTIMATES = 12

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
    case 'pushRecent': {
      const recent = [action.id, ...state.recentColors.filter((c) => c !== action.id)].slice(0, 8)
      return { ...state, recentColors: recent }
    }
    case 'rename':
      return { ...state, boardName: action.name.slice(0, 60), updatedAt: stamp }
    case 'clear':
      return { ...initialState, recentColors: state.recentColors, updatedAt: stamp }
    case 'saveEstimate': {
      // Re-saving for the same product and label replaces the old figure: a
      // visitor who re-measures a room should not end up with two estimates.
      const same = state.estimates.filter(
        (estimate) => !(estimate.productId === action.estimate.productId && estimate.label === action.estimate.label),
      )
      return { ...state, estimates: [action.estimate, ...same].slice(0, MAX_ESTIMATES), updatedAt: stamp }
    }
    case 'removeEstimate':
      return { ...state, estimates: state.estimates.filter((estimate) => estimate.id !== action.id), updatedAt: stamp }
    case 'togglePrep': {
      const has = state.prep.includes(action.id)
      return {
        ...state,
        prep: has ? state.prep.filter((id) => id !== action.id) : [...state.prep, action.id],
        updatedAt: stamp,
      }
    }
    case 'merge': {
      const project = action.project
      const colours = [...new Set([...state.savedColors, ...project.colours])]
      const products = [...new Set([...state.savedProducts, ...project.products])]
      const prep = [...new Set([...state.prep, ...project.prep])]
      const byKey = new Map(state.estimates.map((estimate) => [`${estimate.productId}:${estimate.label}`, estimate]))
      for (const estimate of project.estimates) byKey.set(`${estimate.productId}:${estimate.label}`, estimate)
      return {
        ...state,
        savedColors: colours,
        savedProducts: products,
        prep,
        estimates: [...byKey.values()].slice(0, MAX_ESTIMATES),
        boardName: project.name || state.boardName,
        updatedAt: stamp,
      }
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
  pushRecent: (id: string) => void
  renameBoard: (name: string) => void
  clearBoard: () => void
  saveEstimate: (estimate: SavedEstimate) => void
  removeEstimate: (id: string) => void
  togglePrep: (id: string) => void
  mergeSharedProject: (project: SharedProject) => void
  isSaved: (id: string) => boolean
  isProductSaved: (id: string) => boolean
  toasts: Toast[]
  toast: (message: string, options?: { description?: string | undefined; tone?: Toast['tone'] | undefined }) => void
  dismissToast: (id: number) => void
  consent: ConsentState
  grantConsent: () => void
  denyConsent: () => void
  boardOpen: boolean
  setBoardOpen: (open: boolean) => void
}

const AppContext = createContext<Ctx | null>(null)

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [])

/**
 * Read the board from storage, migrating an older schema forward.
 *
 * Migration is one-way and additive: v1 had colours, products and a name, so a
 * v1 board becomes a v2 board with no estimates. Anything that cannot be parsed
 * becomes an empty board — never a crash on mount.
 */
function loadBoard(): BoardState {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      for (const key of LEGACY_KEYS) {
        raw = localStorage.getItem(key)
        if (raw) break
      }
    }
  } catch {
    return initialState
  }
  if (!raw) return initialState
  try {
    const parsed = JSON.parse(raw) as Partial<BoardState>
    const estimates = Array.isArray(parsed.estimates)
      ? parsed.estimates
          .filter((estimate): estimate is SavedEstimate => Boolean(estimate) && typeof estimate === 'object')
          .map((estimate): SavedEstimate => ({
            id: typeof estimate.id === 'string' ? estimate.id : `estimate-${Math.random().toString(36).slice(2, 8)}`,
            productId: typeof estimate.productId === 'string' ? estimate.productId : '',
            label: typeof estimate.label === 'string' ? estimate.label : 'Room',
            packs: typeof estimate.packs === 'string' ? estimate.packs : '',
            litres: Number.isFinite(estimate.litres) ? Number(estimate.litres) : 0,
            unit: estimate.unit === 'kg' ? 'kg' : 'L',
            area: Number.isFinite(estimate.area) ? Number(estimate.area) : 0,
            coats: Number.isFinite(estimate.coats) ? Math.round(Number(estimate.coats)) : 2,
            savedAt: Number.isFinite(estimate.savedAt) ? Number(estimate.savedAt) : 0,
          }))
          .filter((estimate) => estimate.productId)
          .slice(0, MAX_ESTIMATES)
      : []
    return {
      savedColors: strings(parsed.savedColors),
      savedProducts: strings(parsed.savedProducts),
      recentColors: strings(parsed.recentColors),
      boardName: typeof parsed.boardName === 'string' && parsed.boardName ? parsed.boardName : 'My project',
      estimates,
      prep: strings(parsed.prep),
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
    (message: string, options?: { description?: string | undefined; tone?: Toast['tone'] | undefined }) => {
      const id = ++toastId.current
      setToasts((current) => [...current.slice(-2), { id, message, description: options?.description, tone: options?.tone ?? 'success' }])
      window.setTimeout(() => dismissToast(id), 5200)
    },
    [dismissToast],
  )

  const toggleColor = useCallback(
    (id: string) => {
      const wasSaved = board.savedColors.includes(id)
      dispatch({ type: 'toggleColor', id })
      track('colour_saved', { colourId: id, action: wasSaved ? 'remove' : 'add' })
      toast(wasSaved ? 'Removed from your project' : 'Saved to your project', {
        description: wasSaved ? undefined : 'Open your project board to compare, share or request a quote.',
        tone: wasSaved ? 'info' : 'success',
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
  const pushRecent = useCallback((id: string) => dispatch({ type: 'pushRecent', id }), [])
  const renameBoard = useCallback((name: string) => dispatch({ type: 'rename', name }), [])
  const clearBoard = useCallback(() => {
    dispatch({ type: 'clear' })
    toast('Project board cleared', { tone: 'info' })
  }, [toast])

  const saveEstimate = useCallback(
    (estimate: SavedEstimate) => {
      dispatch({ type: 'saveEstimate', estimate })
      if (!board.savedProducts.includes(estimate.productId)) dispatch({ type: 'toggleProduct', id: estimate.productId })
      track('calculator_saved', { product: estimate.productId, litres: estimate.litres })
    },
    [board.savedProducts],
  )

  const removeEstimate = useCallback((id: string) => dispatch({ type: 'removeEstimate', id }), [])
  const togglePrep = useCallback((id: string) => dispatch({ type: 'togglePrep', id }), [])

  const mergeSharedProject = useCallback(
    (project: SharedProject) => {
      dispatch({ type: 'merge', project })
      track('project_shared_opened', {
        colours: project.colours.length,
        products: project.products.length,
        estimates: project.estimates.length,
      })
    },
    [],
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
      pushRecent,
      renameBoard,
      clearBoard,
      saveEstimate,
      removeEstimate,
      togglePrep,
      mergeSharedProject,
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
      pushRecent,
      renameBoard,
      clearBoard,
      saveEstimate,
      removeEstimate,
      togglePrep,
      mergeSharedProject,
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
