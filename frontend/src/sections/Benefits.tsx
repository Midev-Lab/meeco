
import {
    Clock3,
    FolderCheck,
    Brain,
    ListChecks,
} from 'lucide-react'

const benefits = [
    {
        number: '01',
        title: 'Save Time',
        description:
            'Spend less time typing and organizing notes. Simply speak your thoughts and let Meeco handle the transcription.',
        Icon: Clock3,
    },
    {
        number: '02',
        title: 'Stay Organized',
        description:
            'Keep your recordings, transcripts, and important information together in one organized workspace.',
        Icon: FolderCheck,
    },
    {
        number: '03',
        title: 'Never Miss Details',
        description:
            'Capture important information from your meetings, conversations, and everyday thoughts.',
        Icon: Brain,
    },
    {
        number: '04',
        title: 'Work Smarter with AI',
        description:
            'Turn lengthy conversations into useful summaries and actionable tasks with AI-powered assistance.',
        Icon: ListChecks,
    },
]

const Benefits = () => {
    return (
        <section className="relative overflow-hidden px-4 py-24 md:py-32">

           
            <div className="pointer-events-none absolute -right-40 top-1/4 -z-10 h-[350px] w-[350px] rounded-full bg-[var(--color-primary)]/10 blur-[120px]" />

            <div className="mx-auto max-w-[1100px]">

              
                <div className="mx-auto mb-16 max-w-2xl text-center">

                    <span className="mb-4 inline-block text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">
                        Why Choose Meeco
                    </span>

                    <h2 className="text-3xl font-bold leading-tight text-[var(--color-text)] [font-family:var(--font-heading)] sm:text-4xl md:text-5xl">
                        Less typing.
                        <span className="text-[var(--color-primary)]">
                            {' '}More doing.
                        </span>
                    </h2>

                    <p className="mt-5 text-base leading-8 text-[var(--color-text-muted)] md:text-lg">
                        Meeco helps you spend less time managing information
                        and more time focusing on what matters.
                    </p>

                </div>

         
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

                    {benefits.map((benefit) => {
                        const Icon = benefit.Icon

                        return (
                            <div
                                key={benefit.number}
                                className="group relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7 transition-all duration-300 hover:-translate-y-2 hover:border-[var(--color-primary)]/50">

                              
                                <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[var(--color-primary)]/10 blur-3xl transition-opacity duration-300 group-hover:bg-[var(--color-primary)]/20" />

                             
                                <span className="relative text-xs font-bold tracking-[0.2em] text-[var(--color-primary)]">
                                    {benefit.number}
                                </span>

                   
                                <div className="relative my-8 flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/10 text-[var(--color-primary)] transition-all duration-300 group-hover:bg-[var(--color-primary)] group-hover:text-white">
                                    <Icon size={27} strokeWidth={1.7} />
                                </div>

                          
                                <h3 className="relative text-lg font-semibold text-[var(--color-text)] [font-family:var(--font-heading)]">
                                    {benefit.title}
                                </h3>

                              
                                <p className="relative mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
                                    {benefit.description}
                                </p>

                            </div>
                        )
                    })}

                </div>

            </div>
        </section>
    )
}

export default Benefits
