export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-16 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
        <p className="text-slate-400 text-sm">Last updated: September 2026</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-emerald-400">1. Acceptance of Terms</h2>
          <p className="text-slate-300 leading-relaxed">
            By registering on this platform, you agree to these Terms of Service. If you do not
            agree, please do not use the platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-emerald-400">2. Player Registration</h2>
          <p className="text-slate-300 leading-relaxed">
            All information provided during registration must be accurate. False information may
            result in disqualification. One email account may register multiple players.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-emerald-400">3. Payment</h2>
          <p className="text-slate-300 leading-relaxed">
            Tournament registration fees are non-refundable once payment is confirmed. Payment
            must be made via UPI and a valid screenshot must be uploaded as proof.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-emerald-400">4. Admin Approval</h2>
          <p className="text-slate-300 leading-relaxed">
            All registrations are subject to admin approval. The admin reserves the right to
            reject any registration at their discretion.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-emerald-400">5. Code of Conduct</h2>
          <p className="text-slate-300 leading-relaxed">
            All registered players are expected to maintain sportsmanship and respect fellow
            players. Misconduct may result in disqualification.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-emerald-400">6. Contact</h2>
          <p className="text-slate-300 leading-relaxed">
            For any queries, contact us at: atulpawar07@gmail.com
          </p>
        </section>
      </div>
    </div>
  );
}
