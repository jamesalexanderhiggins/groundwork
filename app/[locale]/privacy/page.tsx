import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="text-indigo-600 text-sm mb-6 inline-block">← Back</Link>

        <h1 className="font-bold text-3xl text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-8">Last updated: June 2026</p>

        <div className="prose prose-gray max-w-none text-sm leading-relaxed space-y-6">

          <section>
            <h2 className="font-semibold text-lg text-gray-800 mb-2">Who we are</h2>
            <p>Kempt is a family life management platform operated from Australia. We help families manage chores, savings, and life admin with the help of AI. Our contact email is <a href="mailto:hello@kempt.life" className="text-indigo-600 hover:underline">hello@kempt.life</a>.</p>
          </section>

          <section>
            <h2 className="font-semibold text-lg text-gray-800 mb-2">What we collect and why</h2>
            <ul className="list-disc pl-5 space-y-1 text-gray-600">
              <li><strong>Account information:</strong> email address and password (hashed) to create and secure your account.</li>
              <li><strong>Family profile data:</strong> display names, roles, and preferences you enter during setup.</li>
              <li><strong>Activity data:</strong> task completions, balance transactions, screen time sessions, and quest activity — to power the app&apos;s economy features.</li>
              <li><strong>Life admin items and drafts:</strong> items you add via the Kempt Core feature, used only to provide the service to you.</li>
              <li><strong>Payment information:</strong> handled entirely by Stripe. We never see or store card numbers.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-lg text-gray-800 mb-2">Children&apos;s data (COPPA &amp; GDPR-K)</h2>
            <p className="text-gray-600">Child profiles within Kempt are created and managed by a parent or guardian. We do not:</p>
            <ul className="list-disc pl-5 space-y-1 text-gray-600 mt-2">
              <li>Market to children or send them direct communications.</li>
              <li>Share child profile data with any third party for advertising.</li>
              <li>Allow children to create accounts independently — a parent account is always required.</li>
              <li>Collect more data from child profiles than is necessary to provide the task and economy features.</li>
            </ul>
            <p className="text-gray-600 mt-2">Parents can request deletion of all child data at any time by emailing us.</p>
          </section>

          <section>
            <h2 className="font-semibold text-lg text-gray-800 mb-2">AI features</h2>
            <p className="text-gray-600">Kempt uses the Anthropic Claude API to power nudges, draft writing, and quest descriptions. Prompts sent to Claude include only the minimum context needed — typically a task list or draft request. We do not use your data to train AI models. Anthropic&apos;s <a href="https://www.anthropic.com/privacy" className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a> governs their handling of API data.</p>
          </section>

          <section>
            <h2 className="font-semibold text-lg text-gray-800 mb-2">Data storage &amp; security</h2>
            <p className="text-gray-600">All data is stored in Supabase (hosted on AWS in Australia or the US depending on your region). Data in transit is encrypted via TLS. Data at rest is encrypted by the hosting provider. We use Row Level Security to ensure families can only access their own data.</p>
          </section>

          <section>
            <h2 className="font-semibold text-lg text-gray-800 mb-2">Your rights</h2>
            <p className="text-gray-600">Under GDPR and Australian Privacy Law, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 text-gray-600 mt-2">
              <li>Access the data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your account and all associated data.</li>
              <li>Object to or restrict processing in certain circumstances.</li>
              <li>Data portability — receive your data in a machine-readable format.</li>
            </ul>
            <p className="text-gray-600 mt-2">To exercise any of these rights, email <a href="mailto:hello@kempt.life" className="text-indigo-600 hover:underline">hello@kempt.life</a>. We will respond within 30 days.</p>
          </section>

          <section>
            <h2 className="font-semibold text-lg text-gray-800 mb-2">No advertising. Ever.</h2>
            <p className="text-gray-600">We do not run ads. We do not sell your data. We do not share your data with data brokers. Our only revenue is subscription fees paid directly by families.</p>
          </section>

          <section>
            <h2 className="font-semibold text-lg text-gray-800 mb-2">Cookies</h2>
            <p className="text-gray-600">We use one session cookie to keep you logged in, and one cookie to remember which child profile is active. We do not use third-party tracking cookies.</p>
          </section>

          <section>
            <h2 className="font-semibold text-lg text-gray-800 mb-2">Changes to this policy</h2>
            <p className="text-gray-600">We will notify users by email if we make material changes to this policy. The &quot;last updated&quot; date at the top will always reflect the current version.</p>
          </section>

          <section>
            <h2 className="font-semibold text-lg text-gray-800 mb-2">Contact</h2>
            <p className="text-gray-600">
              Kempt<br />
              Australia<br />
              <a href="mailto:hello@kempt.life" className="text-indigo-600 hover:underline">hello@kempt.life</a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
