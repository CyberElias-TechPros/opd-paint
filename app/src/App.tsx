import { Component, useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AppProvider } from './store/AppStore'
import { Header } from './components/layout/Header'
import { Footer } from './components/layout/Footer'
import { Toasts } from './components/layout/Toasts'
import { ProjectBoard } from './components/layout/ProjectBoard'
import { ConsentBar } from './components/layout/ConsentBar'
import { SearchPalette } from './components/search/SearchPalette'
import { track } from './lib/analytics'
import { reportBoundaryError } from './lib/telemetry'
import type { ErrorInfo as ReactErrorInfo } from 'react'
import { ButtonLink } from './components/ui/Button'

import { lazy, Suspense } from 'react'
import Home from './routes/Home'

// Routes are split so the homepage ships only what it needs. The heavy
// interactive routes (room preview with its canvas engine, the calculator)
// load on demand — they are the largest modules and the least likely to be the
// first page a visitor lands on.
const Colours = lazy(() => import('./routes/Colours'))
const ColourDetail = lazy(() => import('./routes/ColourDetail'))
const Products = lazy(() => import('./routes/Products'))
const ProductDetail = lazy(() => import('./routes/ProductDetail'))
const RoomPreview = lazy(() => import('./routes/RoomPreview'))
const CalculatorPage = lazy(() => import('./routes/Calculator'))
const Inspiration = lazy(() => import('./routes/Inspiration'))
const ProjectDetail = lazy(() => import('./routes/ProjectDetail'))
const Advice = lazy(() => import('./routes/Advice'))
const GuideDetail = lazy(() => import('./routes/GuideDetail'))
const Dealers = lazy(() => import('./routes/Dealers'))
const Quote = lazy(() => import('./routes/Quote'))
const About = lazy(() => import('./routes/About'))
const DataPage = lazy(() => import('./routes/DataPage'))
const StyleGuide = lazy(() => import('./routes/StyleGuide'))
const Legal = lazy(() => import('./routes/Legal'))
const NotFound = lazy(() => import('./routes/NotFound'))

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ReactErrorInfo) {
    // The boundary is the one place that knows a *page* failed, as distinct
    // from a request failing. It reports with the component stack, which is
    // what makes a production crash reproducible.
    reportBoundaryError(error, info.componentStack ?? error.stack)
    if (import.meta.env.DEV) console.error('[boundary]', error)
  }

  render() {
    if (this.state.error) {
      return (
        <main id="main" className="shell flex min-h-[70vh] flex-col justify-center py-24">
          <p className="kicker text-crimson">Something went wrong</p>
          <h1 className="display mt-4 max-w-2xl text-[clamp(2rem,5vw,3.5rem)]">
            This page hit a problem. Nothing you saved has been lost.
          </h1>
          <p className="mt-4 max-w-xl text-ink/65">
            Your project board is stored in this browser, so your colours are still there. Try reloading, or continue
            browsing.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink to="/">Back to the homepage</ButtonLink>
            <ButtonLink to="/colours" variant="outline">
              Colour library
            </ButtonLink>
          </div>
          {import.meta.env.DEV ? (
            <pre className="mt-8 max-w-full overflow-auto rounded-sm bg-ink p-4 text-[0.72rem] text-paper-2">
              {this.state.error.message}
            </pre>
          ) : null}
        </main>
      )
    }
    return this.props.children
  }
}

function RouteFallback() {
  return (
    <div className="shell flex min-h-[60vh] flex-col justify-center py-20" role="status" aria-live="polite">
      <p className="kicker text-moss">Loading</p>
      <p className="mt-3 max-w-md font-[var(--font-display)] text-[clamp(1.4rem,3vw,2rem)] text-ink/60">
        Mixing the colour…
      </p>
      <div className="mt-6 flex h-2 w-40 overflow-hidden rounded-full bg-ink/10">
        <span className="h-full w-1/3 rounded-full bg-green/60 animate-[shimmer_1.4s_ease-in-out_infinite]" />
      </div>
    </div>
  )
}

function ScrollAndTrack() {
  const { pathname, search, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      const target = document.querySelector(hash)
      if (target) {
        target.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'start' })
        return
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname, search, hash])

  useEffect(() => {
    track('page_view', { path: pathname })
  }, [pathname])

  return null
}

export function App() {
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <BrowserRouter>
      <AppProvider>
        <ScrollAndTrack />
        <Header onOpenSearch={() => setSearchOpen(true)} />
        <ErrorBoundary>
          <main id="main">
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/colours" element={<Colours />} />
              <Route path="/colours/:id" element={<ColourDetail />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:id" element={<ProductDetail />} />
              <Route path="/room-preview" element={<RoomPreview />} />
              <Route path="/calculator" element={<CalculatorPage />} />
              <Route path="/inspiration" element={<Inspiration />} />
              <Route path="/inspiration/:id" element={<ProjectDetail />} />
              <Route path="/advice" element={<Advice />} />
              <Route path="/advice/:id" element={<GuideDetail />} />
              <Route path="/dealers" element={<Dealers />} />
              <Route path="/quote" element={<Quote />} />
              <Route path="/about" element={<About />} />
              <Route path="/data" element={<DataPage />} />
              <Route path="/style-guide" element={<StyleGuide />} />
              <Route path="/legal/:slug" element={<Legal />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </main>
        </ErrorBoundary>
        <Footer />
        <Toasts />
        <ProjectBoard />
        <ConsentBar />
        <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      </AppProvider>
    </BrowserRouter>
  )
}
