import Header from './components/Header'
import Hero from './components/Hero'
import Why from './components/Why'
import Pillars from './components/Pillars'
import MoreFeatures from './components/MoreFeatures'
import HowItWorks from './components/HowItWorks'
import Exercises from './components/Exercises'
import Hardware from './components/Hardware'
import Dashboard from './components/Dashboard'
import Funding from './components/Funding'
import FAQ from './components/FAQ'
import Contact from './components/Contact'
import Footer from './components/Footer'

export default function App() {
  return (
    <>
      <Header />
      <main id="main">
        <Hero />
        <Why />
        <Pillars />
        <MoreFeatures />
        <HowItWorks />
        <Exercises />
        <Hardware />
        <Dashboard />
        <Funding />
        <FAQ />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
