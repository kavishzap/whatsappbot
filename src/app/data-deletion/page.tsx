import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Data Deletion Instructions | Spark Distributors',
  description:
    'How to request deletion of your personal data from Spark Distributors WhatsApp automation.',
}

const LAST_UPDATED = 'June 13, 2026'
const PRIVACY_EMAIL = 'privacy@sparkdistributors.mu'

export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-auth-canvas py-10 px-4 sm:px-6">
      <article className="max-w-3xl mx-auto panel shadow-card overflow-hidden">
        <header className="px-6 sm:px-10 py-8 border-b border-ink-100 bg-gradient-to-br from-brand-50 via-white to-sky-50/40">
          <Link href="/" className="inline-block mb-6">
            <Image
              src="/_C9BFF9E0-617F-45DD-91B5-57549414608C_-removebg-preview.png"
              alt="Spark Distributors"
              width={140}
              height={60}
              className="object-contain"
            />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900">Data Deletion Instructions</h1>
          <p className="text-sm text-ink-500 mt-2">Last updated: {LAST_UPDATED}</p>
        </header>

        <div className="px-6 sm:px-10 py-8 space-y-8 text-sm text-ink-600 leading-relaxed">
          <section className="rounded-2xl border border-brand-100 bg-brand-50/60 px-5 py-4">
            <p>
              <strong>Spark Distributors</strong> provides this page so users can request deletion of
              personal data collected through our WhatsApp customer service and ordering automation,
              including data received via the Meta / WhatsApp Business Platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900 mb-2">How to request deletion</h2>
            <p className="mb-4">
              To request that we delete your personal data, send us a message using one of the
              methods below. Include the WhatsApp phone number associated with your conversations
              with us.
            </p>
            <ol className="list-decimal pl-5 space-y-3">
              <li>
                <strong>Email</strong> — send a deletion request to{' '}
                <a href={`mailto:${PRIVACY_EMAIL}`} className="text-brand-600 hover:underline">
                  {PRIVACY_EMAIL}
                </a>
                <br />
                <span className="text-ink-500">
                  Subject line suggestion: &quot;Data deletion request — WhatsApp&quot;
                </span>
              </li>
              <li>
                <strong>WhatsApp</strong> — message our official Spark Distributors business number
                and write: <em>&quot;Please delete my data&quot;</em>
              </li>
            </ol>
            <p className="mt-4">Please include in your request:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Your full name (if provided during an order)</li>
              <li>The WhatsApp phone number you used to contact us</li>
              <li>A brief description of your request (delete all data / delete session only)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900 mb-2">What we will delete</h2>
            <p className="mb-3">After verifying your request, we will delete or anonymise:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Active WhatsApp conversation session data tied to your phone number</li>
              <li>Stored customer name and delivery address from bot interactions, where applicable</li>
              <li>Other personal identifiers we hold that are not required to be retained by law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900 mb-2">What we may retain</h2>
            <p className="mb-3">
              Some information may be kept where we have a lawful reason to do so, for example:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Completed order records</strong> — retained as needed for fulfilment,
                accounting, tax, fraud prevention, or legal compliance
              </li>
              <li>
                <strong>Security and audit logs</strong> — retained for a limited period to protect
                the Service
              </li>
              <li>
                <strong>Data held by Meta / WhatsApp</strong> — deletion requests to us do not remove
                data stored by Meta. Manage Meta-held data through Meta and WhatsApp settings and
                policies.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900 mb-2">Processing time</h2>
            <p>
              We aim to confirm receipt of your request within <strong>7 business days</strong> and
              complete eligible deletions within <strong>30 days</strong>, unless a longer period is
              required by law or for legitimate business purposes (such as resolving an open order
              dispute).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900 mb-2">Identity verification</h2>
            <p>
              To protect your privacy, we may ask you to confirm ownership of the WhatsApp number or
              provide additional details before deleting data. We will only delete data when we are
              reasonably satisfied the request is legitimate.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900 mb-2">Stop further data collection</h2>
            <p>
              You can stop our Service from collecting new personal data at any time by ceasing to
              message our WhatsApp business account. Existing stored data will remain until you
              submit a deletion request or until it is removed under our retention schedule.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900 mb-2">Related information</h2>
            <p>
              For full details on what we collect and how we use it, see our{' '}
              <Link href="/privacy" className="text-brand-600 hover:underline font-medium">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900 mb-2">Contact</h2>
            <p className="font-medium text-ink-900">
              Spark Distributors
              <br />
              Email:{' '}
              <a href={`mailto:${PRIVACY_EMAIL}`} className="text-brand-600 hover:underline">
                {PRIVACY_EMAIL}
              </a>
            </p>
          </section>
        </div>

        <footer className="px-6 sm:px-10 py-6 border-t border-ink-100 bg-ink-50/80 text-xs text-ink-500 flex flex-wrap items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} Spark Distributors</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-brand-600 hover:underline font-medium">
              Privacy Policy
            </Link>
            <Link href="/" className="text-brand-600 hover:underline font-medium">
              Back to sign in
            </Link>
          </div>
        </footer>
      </article>
    </main>
  )
}
