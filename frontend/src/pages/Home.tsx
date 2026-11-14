
import Features from '@/sections/Features'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Hero from '../sections/Hero'
import HowItWorks from '@/sections/HowItWorks'
import Benefits from '@/sections/Benefits'
import CTA from '@/sections/CTA'

const Home = () => {
  return (
    <>
      <Navbar />

      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Benefits />
        <CTA/>
      </main>

      <Footer />
    </>
  )
}

export default Home
