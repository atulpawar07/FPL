export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-16 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
        <p className="text-slate-400 text-sm">Last updated: September 2026</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-emerald-400">1. Information We Collect</h2>
          <p className="text-slate-300 leading-relaxed">
            We collect information you provide when registering for tournaments, including your name,
            email address, phone number, date of birth, and cricket-related details such as batting
            style, bowling style, and jersey size.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-emerald-400">2. How We Use Your Information</h2>
          <p className="text-slate-300 leading-relaxed">
            Your information is used solely for the purpose of player registration and tournament
            management. We do not sell or share your personal data with third parties.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-emerald-400">3. Google Sign-In</h2>
          <p className="text-slate-300 leading-relaxed">
            If you choose to sign in with Google, we receive your name and email address from
            Google. We do not access any other Google account data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-emerald-400">4. Data Security</h2>
          <p className="text-slate-300 leading-relaxed">
            Your data is stored securely using Supabase. Payment screenshots are stored privately
            and are only accessible to administrators.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-emerald-400">5. Contact</h2>
          <p className="text-slate-300 leading-relaxed">
            For any privacy-related questions, contact us at: atulpawar07@gmail.com
          </p>
        </section>
      </div>
    </div>
  );
}
