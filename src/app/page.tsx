export default function Home() {
  return (
    <div className="flex flex-col w-full bg-[#FDFBF8] text-[#22333B]">
      {/* Header */}
      <header className="flex items-center justify-between px-8 md:px-24 py-6">
        <div className="flex items-baseline gap-2">
          <span className="font-[family-name:var(--font-fraunces)] font-semibold text-2xl text-[#0F6B7C]">
            RM27
          </span>
          <span className="text-sm text-[#5B6B73]">Cleaning</span>
        </div>
        <nav className="hidden md:flex items-center gap-10">
          <a href="#about" className="text-sm font-medium">About</a>
          <a href="#services" className="text-sm font-medium">Services</a>
          <a href="#how" className="text-sm font-medium">How it works</a>
          <a href="#reviews" className="text-sm font-medium">Reviews</a>
          <a href="#quote" className="bg-[#0F6B7C] text-[#FDFBF8] rounded-full px-6 py-3 text-sm font-semibold hover:bg-[#0C5765] transition-colors">Get a free quote</a>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0F6B7C] via-[#2C8B87] to-[#E8837C] py-24 px-8 md:px-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_20%,rgba(232,131,124,0.55),transparent_55%),radial-gradient(circle_at_12%_85%,rgba(143,191,160,0.5),transparent_50%)]" />
        <div className="relative z-10 max-w-xl flex flex-col gap-6">
          <span className="self-start bg-white/15 backdrop-blur-sm text-white text-xs font-semibold tracking-wide px-4 py-2 rounded-full border border-white/30">Serving homes across the Orlando area</span>
          <h1 className="font-[family-name:var(--font-fraunces)] font-medium text-4xl md:text-6xl leading-tight text-white">A cleaner home, a lighter life.</h1>
          <p className="text-lg leading-relaxed text-white/90 max-w-md">RM27 Cleaning takes the weekly to-do off your plate — one-time deep cleans or a regular visit you never have to think about.</p>
          <div className="flex gap-4 items-center flex-wrap">
            <a href="#quote" className="bg-[#E8837C] text-white rounded-full px-8 py-4 text-base font-semibold hover:bg-[#DD6F67] transition-colors">Get your free quote</a>
            <a href="#how" className="border border-white/70 text-white rounded-full px-7 py-4 text-base font-semibold">See how it works</a>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="flex flex-col md:flex-row items-center gap-16 px-8 md:px-24 py-24">
        <div className="flex-1 h-[360px] w-full rounded-3xl bg-gradient-to-br from-[#DCEDE6] via-[#8FBFA0] to-[#0F6B7C]" />
        <div className="flex-1 flex flex-col gap-5">
          <span className="text-xs font-bold tracking-wide text-[#E8837C] uppercase">About RM27 Cleaning</span>
          <h2 className="font-[family-name:var(--font-fraunces)] font-medium text-3xl md:text-4xl text-[#1B2A31] leading-snug">Part of the RM27 family, built on the same care and reliability.</h2>
          <p className="text-base leading-relaxed text-[#5B6B73]">RM27 Cleaning is the newest branch of RM27, bringing the same attention to detail our clients already trust to every home we clean.</p>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="px-8 md:px-24 py-24 flex flex-col gap-12">
        <div className="max-w-xl">
          <span className="text-xs font-bold tracking-wide text-[#0F6B7C] uppercase">Services</span>
          <h2 className="font-[family-name:var(--font-fraunces)] font-medium text-3xl md:text-4xl text-[#1B2A31] mt-3 mb-3">Services built around your home</h2>
          <p className="text-base text-[#5B6B73]">Pick a one-time clean or set up a plan that keeps your home consistently spotless.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { title: "Standard Cleaning", desc: "Dusting, floors, kitchen and bathrooms — the essentials, done right." },
            { title: "Deep Cleaning", desc: "Baseboards, inside appliances, grout — a thorough reset for your home." },
            { title: "Move In / Move Out", desc: "A spotless handoff for the home you're leaving or stepping into." },
            { title: "Recurring Plans", desc: "Weekly, biweekly or monthly — set it once, we take it from there." },
          ].map((s) => (
            <div key={s.title} className="bg-white border border-[#ECE6DA] rounded-2xl overflow-hidden flex flex-col">
              <div className="h-32 bg-gradient-to-br from-[#DCEDE6] to-[#8FBFA0]" />
              <div className="p-6 flex flex-col gap-2">
                <div className="font-semibold text-lg text-[#1B2A31]">{s.title}</div>
                <div className="text-sm text-[#5B6B73] leading-relaxed">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-[#EAF3F2] px-8 md:px-24 py-24 flex flex-col gap-14">
        <h2 className="font-[family-name:var(--font-fraunces)] font-medium text-3xl md:text-4xl text-[#1B2A31] text-center">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {[
            { n: "01", title: "Request your quote", desc: "Tell us about your home and the service you need.", color: "#0F6B7C" },
            { n: "02", title: "Confirm your appointment", desc: "We check the schedule and send a WhatsApp confirmation.", color: "#E8837C" },
            { n: "03", title: "We show up and clean", desc: "You get a reminder before we arrive.", color: "#8FBFA0" },
          ].map((step) => (
            <div key={step.n} className="flex flex-col gap-3">
              <div className="font-[family-name:var(--font-fraunces)] text-4xl font-medium" style={{ color: step.color }}>{step.n}</div>
              <div className="font-semibold text-lg text-[#1B2A31]">{step.title}</div>
              <div className="text-sm text-[#5B6B73] leading-relaxed">{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section id="reviews" className="px-8 md:px-24 py-24 flex flex-col gap-12">
        <h2 className="font-[family-name:var(--font-fraunces)] font-medium text-3xl md:text-4xl text-[#1B2A31] text-center">What clients say</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
          <div className="bg-white border border-[#ECE6DA] rounded-2xl p-7 flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-[#3A4B53]">&quot;They&apos;ve been coming every other week for a year now. I never worry about it.&quot;</p>
            <div className="font-semibold text-sm text-[#1B2A31]">Karen M. — Orlando, FL</div>
          </div>
          <div className="bg-[#E8837C] rounded-2xl p-7 flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-white">&quot;Booked a move-out clean two days before closing. Left the place better than promised.&quot;</p>
            <div className="font-semibold text-sm text-white">Derek T. — Kissimmee, FL</div>
          </div>
          <div className="bg-white border border-[#ECE6DA] rounded-2xl p-7 flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-[#3A4B53]">&quot;Easiest part of my week. Never have to think about scheduling.&quot;</p>
            <div className="font-semibold text-sm text-[#1B2A31]">Priya S. — Winter Park, FL</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="quote" className="px-8 md:px-24 py-24 bg-gradient-to-br from-[#0F6B7C] to-[#E8837C] flex flex-col items-center gap-6 text-center">
        <h2 className="font-[family-name:var(--font-fraunces)] font-medium text-3xl md:text-4xl text-white max-w-xl">Ready for a home that takes care of itself?</h2>
        <a href="#" className="bg-white text-[#0F6B7C] rounded-full px-9 py-4 text-base font-semibold">Get your free quote</a>
      </section>

      {/* Footer */}
      <footer className="px-8 md:px-24 py-10 flex items-center justify-between border-t border-[#ECE6DA]">
        <div className="flex items-baseline gap-2">
          <span className="font-[family-name:var(--font-fraunces)] font-semibold text-lg text-[#0F6B7C]">RM27</span>
          <span className="text-xs text-[#5B6B73]">Cleaning — part of RM27</span>
        </div>
        <div className="text-xs text-[#5B6B73]">© 2026 RM27 Cleaning. All rights reserved.</div>
      </footer>
    </div>
  );
}