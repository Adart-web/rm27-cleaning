export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#FBFCFF] px-8 py-16 flex justify-center">
      <div className="max-w-2xl flex flex-col gap-6 text-[#233041]">
        <h1 className="font-[family-name:var(--font-fraunces)] text-3xl">
          Privacy Policy
        </h1>
        <p className="text-sm text-[#6B7480]">Last updated: October 2026</p>

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-lg">Information we collect</h2>
          <p className="text-[#6B7480] leading-relaxed">
            When you request a quote, we collect your name, phone number, email,
            city, the details of the service you request (such as home size or
            items to be cleaned), the date and time period you choose, and,
            optionally, who referred you.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-lg">How we use it</h2>
          <p className="text-[#6B7480] leading-relaxed">
            We use this information to prepare your quote, schedule your
            appointment, and contact you, including by WhatsApp, about your
            request, payment, and appointment reminders.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-lg">Google Calendar</h2>
          <p className="text-[#6B7480] leading-relaxed">
            RM27 Cleaning uses the Google Calendar API only to access the
            business calendar, in order to check availability and create
            appointment events. We do not access the Google accounts or
            calendars of our customers.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-lg">Sharing</h2>
          <p className="text-[#6B7480] leading-relaxed">
            We do not sell your personal information. We rely on service
            providers, such as hosting, database, and messaging services, only
            to operate our website and deliver our service to you.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-lg">Your requests</h2>
          <p className="text-[#6B7480] leading-relaxed">
            You can ask us to correct or delete your information at any time by
            contacting us.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-lg">Contact</h2>
          <p className="text-[#6B7480] leading-relaxed">
            rm27solutions@gmail.com
          </p>
        </section>
      </div>
    </div>
  );
}