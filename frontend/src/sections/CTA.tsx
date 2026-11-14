
import { ArrowRight, WandSparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ShimmerButton } from '@/components/ui/shimmer-button'

const CTA = () => {
    return (
        <section className="relative overflow-hidden px-4 py-24 md:py-32">

            
            <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[450px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-primary)]/10 blur-[130px]" />

            <div className="mx-auto max-w-[900px]">

            
                <div className="relative overflow-hidden rounded-3xl border border-[var(--color-primary)]/30 bg-[var(--color-surface)] px-6 py-16 text-center shadow-2xl shadow-[var(--color-primary)]/5 sm:px-12 md:py-20">

                 
                    <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--color-primary)]/15 blur-[100px]" />

                    <div className="relative z-10">

                   
                        <div className="mx-auto mb-7 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                            <WandSparkles size={27} />
                        </div>

                 
                        <h2 className="mx-auto max-w-2xl text-3xl font-bold leading-tight text-[var(--color-text)] [font-family:var(--font-heading)] sm:text-4xl md:text-5xl">
                            Your thoughts deserve
                            <span className="text-[var(--color-primary)]">
                                {' '}better organization.
                            </span>
                        </h2>

                     
                        <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-[var(--color-text-muted)] md:text-lg">
                            Stop worrying about taking notes. Start capturing
                            your thoughts, organizing your conversations, and
                            getting more done with Meeco.
                        </p>

                        
                        <div className="mt-9 flex justify-center">
                            <Link to="/register" className="no-underline">
                                <ShimmerButton
                                    shimmerColor="#ffffff"
                                    background="#7C5CFF"
                                    shimmerDuration="3s"
                                    borderRadius="12px"
                                    className="gap-3 px-7 py-4 text-sm font-semibold"
                                >
                                    Get Started with Meeco
                                    <ArrowRight size={18} />
                                </ShimmerButton>
                            </Link>
                        </div>

                    
                        <p className="mt-5 text-xs text-[var(--color-text-muted)]">
                            Your voice. Your ideas. One organized workspace.
                        </p>

                    </div>

                </div>

            </div>
        </section>
    )
}

export default CTA
