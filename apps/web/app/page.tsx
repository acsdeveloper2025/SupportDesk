import { Button } from "@supportdesk/ui/button";

export default function HomePage() {
  return (
    <main className="bg-brand-panel flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-3xl text-center">
        <p className="text-brand-accent text-sm font-semibold uppercase tracking-wide">
          Enterprise Ticketing Platform
        </p>
        <h1 className="text-brand-ink mt-4 text-5xl font-bold tracking-normal sm:text-6xl">
          SupportDesk
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          Project Successfully Bootstrapped
        </p>
        <div className="mt-10 flex justify-center">
          <Button type="button">Foundation Ready</Button>
        </div>
      </section>
    </main>
  );
}
