import { renderToString } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppProvider } from '../src/store/AppStore'
import Home from '../src/routes/Home'
import Colours from '../src/routes/Colours'
import ColourDetail from '../src/routes/ColourDetail'
import Products from '../src/routes/Products'
import ProductDetail from '../src/routes/ProductDetail'
import RoomPreview from '../src/routes/RoomPreview'
import Calculator from '../src/routes/Calculator'
import Inspiration from '../src/routes/Inspiration'
import ProjectDetail from '../src/routes/ProjectDetail'
import Advice from '../src/routes/Advice'
import GuideDetail from '../src/routes/GuideDetail'
import Dealers from '../src/routes/Dealers'
import Quote from '../src/routes/Quote'
import About from '../src/routes/About'
import DataPage from '../src/routes/DataPage'
import StyleGuide from '../src/routes/StyleGuide'
import Legal from '../src/routes/Legal'
import NotFound from '../src/routes/NotFound'

const routes: Array<[string, string, any]> = [
  ['/', '/', Home],
  ['/colours', '/colours', Colours],
  ['/colours/:id', '/colours/lilac-room', ColourDetail],
  ['/products', '/products', Products],
  ['/products/:id', '/products/matt', ProductDetail],
  ['/room-preview', '/room-preview', RoomPreview],
  ['/calculator', '/calculator', Calculator],
  ['/inspiration', '/inspiration', Inspiration],
  ['/inspiration/:id', '/inspiration/arched-villa-gra', ProjectDetail],
  ['/advice', '/advice', Advice],
  ['/advice/:id', '/advice/how-much-paint', GuideDetail],
  ['/dealers', '/dealers', Dealers],
  ['/quote', '/quote', Quote],
  ['/about', '/about', About],
  ['/data', '/data', DataPage],
  ['/style-guide', '/style-guide', StyleGuide],
  ['/legal/:slug', '/legal/privacy', Legal],
  ['/*', '/missing-page', NotFound],
]

let failures = 0
for (const [pattern, path, Component] of routes) {
  try {
    const html = renderToString(
      <MemoryRouter initialEntries={[path]}>
        <AppProvider>
          <Routes>
            <Route path={pattern} element={<Component />} />
          </Routes>
        </AppProvider>
      </MemoryRouter>,
    )
    if (html.length < 200) throw new Error('suspiciously short output: ' + html.length)
    // Catch the classic server-render leaks before a human has to spot them.
    for (const bad of ['undefined', 'NaN', '[object Object]', 'null</']) {
      if (html.includes(bad)) throw new Error(`rendered output contains "${bad}"`)
    }
    console.log(`ok   ${path.padEnd(34)} ${html.length} chars`)
  } catch (error) {
    failures += 1
    console.log(`FAIL ${path}`)
    console.log(error instanceof Error ? error.stack : error)
  }
}
console.log(failures ? `\n${failures} route(s) failed` : '\nall routes rendered')
