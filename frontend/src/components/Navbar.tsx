
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AudioLines, ArrowUpRight, Menu, X } from 'lucide-react'
import { ShimmerButton } from '@/components/ui/shimmer-button'

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const closeMenu = () => setIsMenuOpen(false)

  return (
    <header className="sticky top-0 z-50 px-4 pt-4">
      <nav className="mx-auto max-w-[1200px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 px-5 shadow-lg shadow-black/10 backdrop-blur-xl md:px-7">

        <div className="flex h-[76px] items-center justify-between">

          {/* Brand */}
          <Link
            to="/"
            onClick={closeMenu}
            className="group flex items-center gap-3"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white transition-transform duration-300 group-hover:rotate-6">
              <AudioLines size={23} strokeWidth={2.2} />
            </span>

            <span className="[font-family:var(--font-heading)] text-2xl font-extrabold tracking-tight text-[var(--color-text)]">
              meeco
            </span>
          </Link>

          
          <div className="hidden items-center gap-9 md:flex">
            <a
              href="#features"
              className="text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              Features
            </a>

            <a
              href="#how-it-works"
              className="text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              How it works
            </a>

            <a
              href="#benefits"
              className="text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              Benefits
            </a>
          </div>

          {/* Desktop Actions */}
          <div className="hidden items-center gap-6 md:flex">
            <Link
              to="/login"
              className="text-sm font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              Log in
            </Link>

            <Link to="/register" className="no-underline">
              <ShimmerButton
                shimmerColor="#ffffff"
                background="#7C5CFF"
                shimmerDuration="3s"
                borderRadius="12px"
                className="gap-2 px-5 py-3 text-sm font-semibold"
              >
                Get Started
                <ArrowUpRight size={17} />
              </ShimmerButton>
            </Link>
          </div>

        
          <button
            type="button"
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-text)] transition-colors hover:bg-white/5 md:hidden"
          >
            {isMenuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>

        
        {isMenuOpen && (
          <div className="border-t border-[var(--color-border)] py-5 md:hidden">
            <div className="flex flex-col gap-1">
              <a
                href="#features"
                onClick={closeMenu}
                className="rounded-lg px-3 py-3 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:bg-white/5 hover:text-[var(--color-text)]"
              >
                Features
              </a>

              <a
                href="#how-it-works"
                onClick={closeMenu}
                className="rounded-lg px-3 py-3 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:bg-white/5 hover:text-[var(--color-text)]"
              >
                How it works
              </a>

              <a
                href="#benefits"
                onClick={closeMenu}
                className="rounded-lg px-3 py-3 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:bg-white/5 hover:text-[var(--color-text)]"
              >
                Benefits
              </a>
            </div>

            <div className="mt-4 flex items-center gap-3 border-t border-[var(--color-border)] pt-5">
              <Link
                to="/login"
                onClick={closeMenu}
                className="flex-1 rounded-xl border border-[var(--color-border)] py-3 text-center text-sm font-semibold text-[var(--color-text)]"
              >
                Log in
              </Link>

              <Link
                to="/register"
                onClick={closeMenu}
                className="flex-1"
              >
                <ShimmerButton
                  shimmerColor="#ffffff"
                  background="#7C5CFF"
                  shimmerDuration="3s"
                  borderRadius="12px"
                  className="w-full gap-2 px-3 py-3 text-sm font-semibold"
                >
                  Get Started
                  <ArrowUpRight size={16} />
                </ShimmerButton>
              </Link>
            </div>
          </div>
        )}

      </nav>
    </header>
  )
}

export default Navbar
