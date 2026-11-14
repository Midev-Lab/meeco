
import { motion } from 'framer-motion'
import { BorderBeam } from '@/components/ui/border-beam'
import { ArrowRight, AudioLines, Sparkles } from 'lucide-react'
import { ShimmerButton } from '@/components/ui/shimmer-button'

const Hero = () => {
    return (
        <section className="relative overflow-hidden px-4 pb-24 pt-12 md:pb-32 md:pt-16">

       
            <div className="pointer-events-none absolute left-1/2 top-10 -z-10 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-[var(--color-primary)]/10 blur-[120px]" />

            <div className="mx-auto max-w-[1100px]">

             
                <motion.div
                    initial={{ opacity: 0, y: 35 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                        duration: 0.8,
                        ease: [0.22, 1, 0.36, 1],
                    }}
                    className="mx-auto max-w-3xl text-center"
                >

               
                    <div className="mb-8 inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-text-muted)]">
                        Your thoughts, made more productive
                    </div>

              
                    <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-[var(--color-text)] [font-family:var(--font-heading)] sm:text-5xl md:text-7xl">
                        Your voice.
                        <br />
                        Your thoughts.
                        <br />
                        <span className="text-[var(--color-primary)]">
                            Organized.
                        </span>
                    </h1>

                   
                    <p className="mx-auto mt-7 max-w-2xl text-base leading-8 text-[var(--color-text-muted)] md:text-lg">
                        Turn your spoken thoughts into clear transcripts, smart summaries,
                        and actionable notes. Focus on what matters while Meeco organizes
                        the rest.
                    </p>

                   
                    <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">

                        <ShimmerButton
                            shimmerColor="#ffffff"
                            background="#7C5CFF"
                            shimmerDuration="3s"
                            borderRadius="12px"
                            className="gap-2 px-7 py-4 text-sm font-semibold"
                        >
                            Start Recording
                            <ArrowRight size={17} />
                        </ShimmerButton>

                        <a
                            href="#how-it-works"
                            className="rounded-xl border border-[var(--color-border)] px-7 py-4 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-white/5"
                        >
                            See How It Works
                        </a>

                    </div>

                    <p className="mt-5 text-xs text-[var(--color-text-muted)]">
                        Capture ideas. Get clarity. Take action.
                    </p>

                </motion.div>

              
                <div className="mx-auto mt-20 max-w-3xl">

                    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl shadow-black/30 md:p-8">

                      
                        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-5">

                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
                                    <AudioLines size={21} />
                                </div>

                                <div className="text-left">
                                    <h3 className="text-sm font-semibold text-[var(--color-text)]">
                                        Meeting Notes
                                    </h3>
                                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                                        Voice recording preview
                                    </p>
                                </div>
                            </div>

                            <span className="flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400">
                                <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                                Recording
                            </span>

                        </div>

                     
                        <div className="flex h-24 items-center justify-center gap-1.5 border-b border-[var(--color-border)] py-5">
                            {Array.from({ length: 45 }).map((_, index) => (
                                <span
                                    key={index}
                                    className="w-1 rounded-full bg-[var(--color-primary)]"
                                    style={{
                                        height: `${15 + Math.abs(Math.sin(index * 0.7)) * 55}px`,
                                        opacity: 0.4 + Math.abs(Math.sin(index * 0.4)) * 0.6,
                                    }}
                                />
                            ))}
                        </div>

                      
                        <div className="pt-6 text-left">
                            <div className="mb-4 flex items-center gap-2">
                                <Sparkles size={15} className="text-[var(--color-primary)]" />
                                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                                    Live Transcript
                                </span>
                            </div>

                            <p className="text-sm leading-7 text-[var(--color-text-muted)] md:text-base">
                                Today, we discussed the upcoming project milestones and
                                identified the key tasks that need to be completed before
                                the next meeting...
                                <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-[var(--color-primary)] align-middle" />
                            </p>
                        </div>

                     
                        <BorderBeam
                            duration={8}
                            size={120}
                            colorFrom="#7C5CFF"
                            colorTo="#38BDF8"
                        />

                    </div>

                    <p className="mt-5 text-center text-xs text-[var(--color-text-muted)]">
                        A glimpse of how Meeco turns conversations into organized notes.
                    </p>

                </div>

            </div>
        </section>
    )
}

export default Hero
