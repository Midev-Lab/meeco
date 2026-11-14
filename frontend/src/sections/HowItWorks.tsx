
import { useRef } from 'react'

import {
    Mic,
    FileText,
    WandSparkles,
} from 'lucide-react'

import { AnimatedBeam } from '@/components/ui/animated-beam'

const steps = [
    {
        number: '01',
        title: 'Record Your Voice',
        description:
            'Start recording your thoughts, meetings, or conversations directly from your browser using your microphone.',
        Icon: Mic,
    },
    {
        number: '02',
        title: 'Get Your Transcript',
        description:
            'Meeco converts your spoken words into readable text, helping you capture every important detail.',
        Icon: FileText,
    },
    {
        number: '03',
        title: 'Organize with AI',
        description:
            'Get AI-generated summaries and action items that help you understand your recordings and take action.',
        Icon: WandSparkles,
    },
]

const HowItWorks = () => {
    const containerRef = useRef<HTMLDivElement>(null)

    const firstStepRef = useRef<HTMLDivElement>(null)
    const secondStepRef = useRef<HTMLDivElement>(null)
    const thirdStepRef = useRef<HTMLDivElement>(null)

    return (
        <section
            id="how-it-works"
            className="relative overflow-hidden px-4 py-24 md:py-32"
        >
       
            <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-primary)]/5 blur-[120px]" />

            <div className="mx-auto max-w-[1100px]">

                {/* Section Heading */}
                <div className="mx-auto mb-20 max-w-2xl text-center">

                    <span className="mb-4 inline-block text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">
                        Simple Process
                    </span>

                    <h2 className="text-3xl font-bold leading-tight text-[var(--color-text)] [font-family:var(--font-heading)] sm:text-4xl md:text-5xl">
                        How Meeco
                        <span className="text-[var(--color-primary)]">
                            {' '}works.
                        </span>
                    </h2>

                    <p className="mt-5 text-base leading-8 text-[var(--color-text-muted)] md:text-lg">
                        Turn your voice into organized information in three simple steps.
                        No complicated process, just speak and let Meeco do the work.
                    </p>

                </div>

              
                <div
                    ref={containerRef}
                    className="relative grid gap-12 md:grid-cols-3 md:gap-8"
                >

                    {/* Animated Beam: Step 1 to Step 2 */}
                    <AnimatedBeam
                        containerRef={containerRef}
                        fromRef={firstStepRef}
                        toRef={secondStepRef}
                        curvature={0}
                        pathColor="#7C5CFF"
                        pathWidth={2}
                        pathOpacity={0.2}
                        gradientStartColor="#7C5CFF"
                        gradientStopColor="#A78BFA"
                        duration={3}
                        className="hidden md:block"
                    />

                   
                    <AnimatedBeam
                        containerRef={containerRef}
                        fromRef={secondStepRef}
                        toRef={thirdStepRef}
                        curvature={0}
                        pathColor="#7C5CFF"
                        pathWidth={2}
                        pathOpacity={0.2}
                        gradientStartColor="#7C5CFF"
                        gradientStopColor="#A78BFA"
                        duration={3}
                        delay={1}
                        className="hidden md:block"
                    />

                    {steps.map((step, index) => {
                        const Icon = step.Icon

                        const stepRefs = [
                            firstStepRef,
                            secondStepRef,
                            thirdStepRef,
                        ]

                        return (
                            <div
                                key={step.number}
                                className="relative z-10 flex flex-col items-center text-center"
                            >

                                {/* Step Icon */}
                                <div
                                    ref={stepRefs[index]}
                                    className="relative z-10 mb-7 flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-surface)] text-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/10"
                                >
                                    <Icon size={30} strokeWidth={1.7} />
                                </div>

                                {/* Step Number */}
                                <span className="mb-3 text-xs font-bold tracking-[0.2em] text-[var(--color-primary)]">
                                    STEP {step.number}
                                </span>

                                {/* Title */}
                                <h3 className="text-xl font-semibold text-[var(--color-text)] [font-family:var(--font-heading)]">
                                    {step.title}
                                </h3>

                                {/* Description */}
                                <p className="mt-4 max-w-sm text-sm leading-7 text-[var(--color-text-muted)]">
                                    {step.description}
                                </p>

                            </div>
                        )
                    })}

                </div>

            </div>
        </section>
    )
}

export default HowItWorks
