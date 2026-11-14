
import { AudioLines, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

const Footer = () => {
    return (
        <footer className="border-t border-[var(--color-border)] bg-[var(--color-background)] px-4">

            <div className="mx-auto max-w-7xl py-14 md:py-16">

                <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">

                 
                    <div className="lg:col-span-2">
                        <Link
                            to="/"
                            className="mb-5 inline-flex items-center gap-2 no-underline"
                        >
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white">
                                <AudioLines size={22} />
                            </div>

                            <span className="text-2xl font-bold text-[var(--color-text)] [font-family:var(--font-heading)]">
                                meeco
                            </span>
                        </Link>

                        <p className="max-w-sm text-sm leading-7 text-[var(--color-text-muted)]">
                            Capture your thoughts, turn conversations into
                            meaningful transcripts, and stay organized with
                            AI-powered insights.
                        </p>
                    </div>

       
                    <div>
                        <h3 className="mb-5 text-sm font-semibold text-[var(--color-text)]">
                            Explore
                        </h3>

                        <ul className="space-y-4">
                            <li>
                                <a href="/#features" className="text-sm text-[var(--color-text-muted)] transition hover:text-[var(--color-primary)]">
                                    Features
                                </a>
                            </li>

                            <li>
                                <a href="/#how-it-works" className="text-sm text-[var(--color-text-muted)] transition hover:text-[var(--color-primary)]">
                                    How It Works
                                </a>
                            </li>

                            <li>
                                <a href="/#benefits" className="text-sm text-[var(--color-text-muted)] transition hover:text-[var(--color-primary)]">
                                    Benefits
                                </a>
                            </li>
                        </ul>
                    </div>

               
                    <div>
                        <h3 className="mb-5 text-sm font-semibold text-[var(--color-text)]">
                            Account
                        </h3>

                        <ul className="space-y-4">
                            <li>
                                <Link to="/login" className="text-sm text-[var(--color-text-muted)] transition hover:text-[var(--color-primary)]">
                                    Login
                                </Link>
                            </li>

                            <li>
                                <Link to="/register" className="text-sm text-[var(--color-text-muted)] transition hover:text-[var(--color-primary)]">
                                    Get Started
                                </Link>
                            </li>
                        </ul>
                    </div>

                </div>

           
                <div className="mt-14 flex flex-col items-center justify-between gap-5 border-t border-[var(--color-border)] pt-7 text-center sm:flex-row sm:text-left">

                    <p className="text-xs text-[var(--color-text-muted)]">
                        © {new Date().getFullYear()} Meeco. All rights reserved.
                    </p>

                    <a
                        href="https://www.midev.ng"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] no-underline transition hover:text-[var(--color-primary)]"
                    >
                        Built by
                        <span className="font-semibold text-[var(--color-text)]">
                            Midev Labs
                        </span>
                        <ArrowUpRight size={13} />
                    </a>

                </div>

            </div>

        </footer>
    )
}

export default Footer
