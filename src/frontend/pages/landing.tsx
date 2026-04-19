import { Link } from "react-router"
import { useEffect, useState } from "react"

export const Landing = () => {
    const [asciiArt, setAsciiArt] = useState<string>("")

    useEffect(() => {
        fetch("/ascii-art.txt")
            .then(res => res.text())
            .then(text => setAsciiArt(text))
    }, [])

    return <main className="relative isolate flex min-h-screen overflow-hidden bg-background text-neutral-50">
        <pre
            aria-hidden="true"
            className="left-1/2 -translate-x-1/2 landing-mark pointer-events-none absolute -top-80 flex items-center justify-center overflow-hidden whitespace-pre font-mono text-[0.25rem] leading-none text-neutral-500 opacity-0 sm:text-[0.35rem] lg:text-[0.4rem]"
        >
            {asciiArt}
        </pre>
        <div className="absolute inset-0 bg-black/45" />
        <section className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center px-6 py-20 text-center">
            <h1 className="landing-title font-heading text-8xl font-medium leading-none opacity-0 sm:text-8xl lg:text-[12rem] lowercase">
                Shiryoku
            </h1>
            <Link
                className="landing-subtitle mt-5 font-mono text-lg font-medium opacity-0 transition-colors hover:text-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-neutral-50 sm:text-xl"
                to="/dashboard/"
            >
                index the chaos
            </Link>
        </section>
    </main>
}
