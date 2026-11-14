
import {
    AudioLines,
    WandSparkles,
    ListChecks,
    FolderOpen,
} from 'lucide-react'

import { BentoCard, BentoGrid } from '@/components/ui/bento-grid'

const features = [
    {
        name: 'Voice-to-Text',
        description:
            'Turn your spoken thoughts and conversations into clear, readable transcripts without the stress of manual typing.',
        Icon: AudioLines,
        className: 'col-span-3 lg:col-span-2',
        background: (
            <div className="absolute inset-0 bg-gradient-to-br from-[#7C5CFF]/20 via-transparent to-transparent">
                <div className="absolute right-8 top-8 flex h-28 items-center gap-1">
                    {Array.from({ length: 24 }).map((_, index) => (
                        <span
                            key={index}
                            className="w-1 rounded-full bg-[#7C5CFF]/60"
                            style={{
                                height: `${15 + Math.abs(Math.sin(index * 0.7)) * 65}px`,
                            }}
                        />
                    ))}
                </div>
            </div>
        ),
    },
    {
        name: 'AI-Powered Summaries',
        description:
            'Get concise summaries of your recordings and understand the important points quickly.',
        Icon: WandSparkles,
        className: 'col-span-3 lg:col-span-1',
        background: (
            <div className="absolute inset-0 bg-gradient-to-br from-[#38BDF8]/15 to-transparent" />
        ),
    },
    {
        name: 'Smart Action Items',
        description:
            'Identify important tasks, decisions, and next steps from your conversations.',
        Icon: ListChecks,
        className: 'col-span-3 lg:col-span-1',
        background: (
            <div className="absolute inset-0 bg-gradient-to-br from-[#34D399]/15 to-transparent" />
        ),
    },
    {
        name: 'Saved Sessions',
        description:
            'Keep your recordings and transcripts organized in one place and revisit them whenever you need.',
        Icon: FolderOpen,
        className: 'col-span-3 lg:col-span-2',
        background: (
            <div className="absolute inset-0 bg-gradient-to-br from-[#A78BFA]/20 to-transparent" />
        ),
    },
]

const Features = () => {
    return (
        <section
            id="features"
            className="relative px-4 py-24 md:py-32"
        >
            <div className="mx-auto max-w-[1100px]">

              
                <div className="mx-auto mb-16 max-w-2xl text-center">

                    <span className="mb-4 inline-block text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">
                        What Meeco Offers
                    </span>

                    <h2 className="text-3xl font-bold leading-tight text-[var(--color-text)] [font-family:var(--font-heading)] sm:text-4xl md:text-5xl">
                        Everything you need to
                        <span className="text-[var(--color-primary)]">
                            {' '}stay organized.
                        </span>
                    </h2>

                    <p className="mt-5 text-base leading-8 text-[var(--color-text-muted)] md:text-lg">
                        From capturing your thoughts to organizing your ideas,
                        Meeco gives you the tools to turn conversations into meaningful work.
                    </p>

                </div>

               
                <BentoGrid className="auto-rows-[22rem] lg:grid-cols-3">

                    {features.map((feature) => (
                        <BentoCard
                            key={feature.name}
                            {...feature}
                        />
                    ))}

                </BentoGrid>

            </div>
        </section>
    )
}

export default Features
