import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PROFILES } from "@/lib/engine";
import { START } from "@/config/start";
import { Wordmark } from "@/components/base/Wordmark";
import { Funki } from "@/components/funki/Funki";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: START.title },
      { name: "description", content: START.metaDescription },
      { property: "og:title", content: START.title },
      { property: "og:description", content: START.metaDescription },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="theme-portal min-h-screen">
      <div className="mx-auto max-w-[1120px] px-4 py-8 md:px-8 md:py-12">
        <Wordmark />
        <div className="mt-12 flex items-start gap-6 md:mt-20">
          <div className="max-w-2xl">
            <h1 className="type-headline">{START.title}</h1>
            <p className="mt-3 text-mg-muted">{START.intro}</p>
          </div>
          <Funki mood="idle" size={88} className="ml-auto hidden md:block" />
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {START.entries.map((e) => (
            <Link key={e.to} to={e.to} className="group rounded-[24px] bg-mg-surface p-6 transition-colors duration-150 ease-out hover:bg-[#e3ebf7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mg-blue">
              <h2 className="type-section">{e.title}</h2>
              <p className="mt-2 text-mg-muted">{e.text}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 font-semibold text-mg-blue">
                {e.cta} <ArrowRight className="size-5 stroke-[1.75] transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-10 type-small text-mg-muted">
          <span className="tabular-nums">{PROFILES.length}</span> {START.customersLabel} · {START.footnote}
        </p>
      </div>
    </div>
  );
}
