import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | Spark Distributors',
  description:
    'Privacy policy for Spark Distributors WhatsApp automation, including Meta and WhatsApp Business API integration.',
}

const LAST_UPDATED = 'June 13, 2026'

export default function PrivacyPage() {
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
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-ink-500 mt-2">Last updated: {LAST_UPDATED}</p>
        </header>

        <div className="px-6 sm:px-10 py-8 space-y-8 text-sm text-ink-600 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-ink-900 mb-2">1. Who we are</h2>
            <p>
              This privacy policy applies to <strong>Spark Distributors</strong> and our WhatsApp
              customer service and ordering automation (the &quot;Service&quot;). The Service helps
              customers browse products, place orders, and receive support through WhatsApp.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900 mb-2">
              2. Meta &amp; WhatsApp integration
            </h2>
            <p className="mb-3">
              Our Service uses the <strong>WhatsApp Business Platform</strong> and related{' '}
              <strong>Meta</strong> (Facebook) technologies to send and receive messages. When you
              message us on WhatsApp, your communications are processed through Meta&apos;s
              infrastructure in accordance with:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <a
                  href="https://www.whatsapp.com/legal/privacy-policy-eea"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  WhatsApp Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="https://www.facebook.com/privacy/policy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  Meta Privacy Policy
                </a>
              </li>
            </ul>
            <p className="mt-3">
              We do not control Meta&apos;s processing of your WhatsApp account data. Meta may
              collect technical and usage information as described in their policies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900 mb-2">3. Information we collect</h2>
            <p className="mb-3">When you use our WhatsApp Service, we may collect:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>WhatsApp phone number</strong> — to identify your conversation and session
              </li>
              <li>
                <strong>Messages you send</strong> — text, menu selections, product links, and
                interactive replies
              </li>
              <li>
                <strong>Order details</strong> — product choices, quantity, delivery district,
                address, and customer name when you place an order
              </li>
              <li>
                <strong>Conversation state</strong> — temporary session data so the bot can continue
                your order or support flow
              </li>
              <li>
                <strong>Technical logs</strong> — timestamps, message IDs, and error logs needed to
                operate and secure the Service
              </li>
            </ul>
            <p className="mt-3">
              Our internal admin dashboard (for authorised staff only) may also process business
              account credentials such as email addresses used to sign in. Customer WhatsApp data is
              not exposed through the public website login.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900 mb-2">4. How we use your information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Respond to your messages and automate customer support</li>
              <li>Process product enquiries and orders</li>
              <li>Confirm delivery details and order references</li>
              <li>Maintain conversation continuity during an active session</li>
              <li>Improve reliability, security, and quality of the Service</li>
              <li>Comply with applicable law and Meta/WhatsApp platform requirements</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900 mb-2">5. Legal basis</h2>
            <p>
              We process your information to perform the Service you request (for example, handling
              an order), based on our legitimate interest in operating customer communications, and
              where required to meet legal obligations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900 mb-2">6. Third-party services</h2>
            <p className="mb-3">We use trusted providers to run the Service:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Meta / WhatsApp</strong> — messaging delivery and webhook notifications
              </li>
              <li>
                <strong>Supabase</strong> — secure storage of orders, sessions, and product
                catalogue data
              </li>
              <li>
                <strong>Hosting providers</strong> — to run our application and API endpoints
              </li>
            </ul>
            <p className="mt-3">
              These providers process data only as needed to deliver the Service and under
              appropriate contractual and security safeguards.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900 mb-2">7. Data retention</h2>
            <p>
              Conversation session data is kept only as long as needed to complete your request or
              maintain an active chat flow. Order records are retained for as long as necessary to
              fulfil orders, handle support, and meet accounting or legal requirements. Technical
              logs are retained for a limited period for security and troubleshooting.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900 mb-2">8. Security</h2>
            <p>
              We use HTTPS, access controls, and server-side secrets for WhatsApp API credentials.
              Only authorised administrators can access the internal dashboard. No system is fully
              secure; we work to protect your data using reasonable technical and organisational
              measures.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900 mb-2">9. Your choices &amp; rights</h2>
            <p className="mb-3">You may:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Stop messaging us on WhatsApp at any time</li>
              <li>Request access to, correction of, or deletion of personal data we hold about you</li>
              <li>Object to certain processing where applicable under local law</li>
            </ul>
            <p className="mt-3">
              To make a privacy request, contact us using the details below. We may need to verify
              your identity before responding. See our{' '}
              <Link href="/data-deletion" className="text-brand-600 hover:underline font-medium">
                Data Deletion Instructions
              </Link>{' '}
              for step-by-step deletion requests.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900 mb-2">10. Children</h2>
            <p>
              The Service is intended for general customers and is not directed at children under 16.
              We do not knowingly collect personal data from children.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900 mb-2">11. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. The &quot;Last updated&quot; date at the
              top of this page will reflect the latest version. Continued use of the Service after
              changes means you accept the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900 mb-2">12. Contact us</h2>
            <p>
              For privacy questions or data requests, contact:
            </p>
            <p className="mt-2 font-medium text-ink-900">
              Spark Distributors
              <br />
              Email:{' '}
              <a href="mailto:privacy@sparkdistributors.mu" className="text-brand-600 hover:underline">
                privacy@sparkdistributors.mu
              </a>
              <br />
              WhatsApp: message our official business number shown in WhatsApp Manager
            </p>
          </section>
        </div>

        <footer className="px-6 sm:px-10 py-6 border-t border-ink-100 bg-ink-50/80 text-xs text-ink-500 flex flex-wrap items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} Spark Distributors</span>
          <div className="flex items-center gap-4">
            <Link href="/data-deletion" className="text-brand-600 hover:underline font-medium">
              Data deletion
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
