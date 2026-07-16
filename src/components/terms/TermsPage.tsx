import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TermsPage() {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mb-8">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-white mb-3">{title}</h2>
      <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-2">{children}</div>
    </section>
  );

  const P = ({ children }: { children: React.ReactNode }) => (
    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{children}</p>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white mb-8 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs">Back</span>
        </button>

        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Terms of Service</h1>
        <P>Last updated: July 2026</P>

        <div className="mt-8">
          <Section title="1. Introduction">
            <P>
              Welcome to Wachsen ("we," "our," or "us"). By accessing or using our platform, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.
            </P>
            <P>
              Wachsen is an AI-powered exam preparation platform that helps you create, practice, and revise exam content. We provide tools for generating questions, concept cards, cheat cards, and tracking your learning progress.
            </P>
          </Section>

          <Section title="2. Account & Registration">
            <P>
              To use Wachsen, you must create an account using your email address or Google OAuth. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.
            </P>
            <P>
              You must provide accurate and complete information during registration. We reserve the right to suspend or terminate accounts that violate these terms or engage in fraudulent activity.
            </P>
          </Section>

          <Section title="3. Data We Collect">
            <P>
              To provide and improve our services, we collect the following types of data:
            </P>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li><strong>Account Information:</strong> Email address, name, username, date of birth, gender, and country — used to personalize your experience and enable account features.</li>
              <li><strong>Profile Data:</strong> Profile picture and preferences — used for your public profile and personalization.</li>
              <li><strong>Academic Data:</strong> Academic level, subjects, exam types you create — used to generate relevant exam content and track your progress.</li>
              <li><strong>Learning Activity:</strong> Exam attempts, answers, results, revision logs, and time spent per question — used to analyze your performance and improve AI-generated recommendations.</li>
              <li><strong>Social Features:</strong> Friend connections, challenges, and shared exam data — used to enable collaborative learning features.</li>
              <li><strong>Usage Data:</strong> Active days, last opened timestamps, and app interaction patterns — used to maintain streaks, improve user experience, and prevent abuse.</li>
              <li><strong>Payment Information:</strong> Transaction records including plan type, amount, currency, and payment method — processed securely via Razorpay. We do not store your full card or banking details on our servers.</li>
              <li><strong>Device Data:</strong> Browser type and device information collected automatically — used for security and compatibility purposes.</li>
            </ul>
          </Section>

          <Section title="4. How We Use Your Data">
            <P>We use the collected data for the following purposes:</P>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>To create and manage your account.</li>
              <li>To generate personalized exam content, concept cards, and cheat cards using AI.</li>
              <li>To track your learning progress, performance analytics, and revision needs.</li>
              <li>To enable social features such as friend connections, challenges, and shared exam rooms.</li>
              <li>To process subscription payments and manage your plan benefits.</li>
              <li>To enforce usage limits per your subscription tier.</li>
              <li>To detect and prevent fraudulent activity, abuse, or violations of our terms.</li>
              <li>To communicate important service updates, feature announcements, or account-related notices.</li>
              <li>To improve our platform, AI models, and user experience through aggregated, anonymized data analysis.</li>
            </ul>
          </Section>

          <Section title="5. Data Storage & Security">
            <P>
              Your data is stored on secure cloud infrastructure provided by Supabase. We implement industry-standard security measures including encryption in transit (HTTPS/TLS) and encryption at rest. Access to personal data is strictly limited to authorized systems and personnel.
            </P>
            <P>
              While we take reasonable precautions to protect your data, no method of electronic storage or transmission is 100% secure. You use our platform at your own risk.
            </P>
          </Section>

          <Section title="6. Data Sharing & Third Parties">
            <P>
              We do not sell, rent, or trade your personal data to third parties. We may share your data only in the following circumstances:
            </P>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li><strong>Service Providers:</strong> We use Supabase (database/hosting), Razorpay (payment processing), and Google OAuth (authentication). These providers process data solely to deliver their respective services.</li>
              <li><strong>Legal Compliance:</strong> We may disclose data if required by law, court order, or governmental regulation.</li>
              <li><strong>With Your Consent:</strong> We may share data with your explicit permission for any other purpose.</li>
            </ul>
          </Section>

          <Section title="7. Subscription & Payments">
            <P>
              Wachsen offers both free and paid subscription plans (Glix Lite, Glix Rise, Glix Peak) on a monthly or yearly basis. Key terms regarding subscriptions:
            </P>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li><strong>No Auto-Renewal:</strong> Subscriptions are one-time purchases. They do not auto-renew. You must manually subscribe again when your current plan expires.</li>
              <li><strong>One Active Subscription:</strong> You may only have one active paid subscription at a time.</li>
              <li><strong>Immediate Activation:</strong> When you purchase a new subscription while an existing subscription is still active, the new plan starts immediately and replaces the previous one. There is no waiting period.</li>
              <li><strong>Pricing:</strong> Prices are displayed in your selected local currency, converted from USD base prices. For Indian users (INR), fixed pricing applies: Glix Lite at ₹299/month or ₹2,990/year, Glix Rise at ₹599/month or ₹5,990/year, Glix Peak at ₹999/month or ₹9,990/year.</li>
              <li><strong>Yearly Plans:</strong> Yearly subscriptions are billed as a single upfront payment covering 12 months (10 months paid + 2 months free).</li>
              <li><strong>Payment Processing:</strong> All payments are processed securely through Razorpay. We do not store your credit card, debit card, UPI, or net banking credentials on our servers.</li>
              <li><strong>Refunds:</strong> All subscription payments are final and non-refundable unless otherwise required by applicable law. Please review plan details carefully before purchasing.</li>
              <li><strong>Free Plan:</strong> The free plan provides 20 credits per day with limited features. You may upgrade at any time.</li>
            </ul>
          </Section>

          <Section title="8. User-Generated Content">
            <P>
              You retain ownership of the exam content, questions, and study materials you create on Wachsen. By uploading or creating content, you grant us a limited license to store, display, and process that content solely for the purpose of providing our services to you.
            </P>
            <P>
              You are solely responsible for the content you create or upload. You agree not to upload content that is illegal, infringes on intellectual property rights, or violates any applicable laws.
            </P>
          </Section>

          <Section title="9. Acceptable Use">
            <P>When using Wachsen, you agree not to:</P>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Use the platform for any illegal or unauthorized purpose.</li>
              <li>Attempt to bypass subscription limits, credit systems, or other platform restrictions.</li>
              <li>Upload malicious content, spam, or content that harasses other users.</li>
              <li>Reverse engineer, decompile, or extract the source code of our platform.</li>
              <li>Use automated tools (bots, scrapers) to access or extract data from the platform.</li>
              <li>Share your account credentials or allow others to use your account.</li>
              <li>Create multiple accounts to circumvent free tier limits or bans.</li>
            </ul>
          </Section>

          <Section title="10. Account Termination">
            <P>
              We reserve the right to suspend or terminate your account at any time for violations of these terms, fraudulent activity, or any conduct we deem harmful to the platform or other users. Upon termination, your access to the platform will be revoked and any remaining subscription period may be forfeited without refund.
            </P>
          </Section>

          <Section title="11. Intellectual Property">
            <P>
              The Wachsen platform, including its name, logo, design, codebase, AI models, and overall user interface, is the intellectual property of Wachsen. You may not copy, modify, distribute, or create derivative works based on our platform without explicit permission.
            </P>
          </Section>

          <Section title="12. Limitation of Liability">
            <P>
              Wachsen is provided "as is" without warranties of any kind, either express or implied. We do not guarantee that the platform will be error-free, uninterrupted, or that AI-generated content will always be accurate. You use the platform and its AI-generated content at your own discretion and risk.
            </P>
            <P>
              To the maximum extent permitted by law, Wachsen shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the platform.
            </P>
          </Section>

          <Section title="13. Changes to These Terms">
            <P>
              We may update these Terms of Service from time to time. We will notify users of significant changes via email or through the platform. Continued use of Wachsen after changes take effect constitutes acceptance of the updated terms.
            </P>
          </Section>

          <Section title="14. Contact Us">
            <P>
              If you have questions about these Terms, please contact us at:
            </P>
            <P>
              Email: support@wachsen.app
            </P>
          </Section>

          <hr className="my-10 border-zinc-200 dark:border-zinc-800" />

          <div id="privacy">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Privacy Policy</h1>
            <P>Last updated: July 2026</P>

            <div className="mt-8">
              <Section title="1. Information We Collect">
                <P>
                  We collect information you provide directly (name, email, academic data, profile details) and information generated through your use of the platform (exam results, revision logs, activity data). For a full list, see Section 3 of our Terms of Service above.
                </P>
              </Section>

              <Section title="2. Cookies & Local Storage">
                <P>
                  Wachsen uses browser local storage to cache your preferences, exam data, and query state for faster loading. We do not use third-party tracking cookies. You can clear your browser storage at any time, though this will reset your cached preferences.
                </P>
              </Section>

              <Section title="3. Data Retention">
                <P>
                  We retain your account data and learning history for as long as your account remains active. If you delete your account, we will remove your personal data within 30 days. Anonymized, aggregated data may be retained for analytical purposes indefinitely.
                </P>
              </Section>

              <Section title="4. Your Rights">
                <P>Depending on your jurisdiction, you may have the right to:</P>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>Access the personal data we hold about you.</li>
                  <li>Request correction of inaccurate data.</li>
                  <li>Request deletion of your account and associated data.</li>
                  <li>Object to or restrict certain processing of your data.</li>
                  <li>Export your data in a portable format.</li>
                </ul>
                <P>To exercise any of these rights, contact us at support@wachsen.app.</P>
              </Section>

              <Section title="5. Children's Privacy">
                <P>
                  Wachsen is intended for users aged 13 and above. We do not knowingly collect data from children under 13. If we become aware that a child under 13 has provided personal data, we will delete it promptly.
                </P>
              </Section>

              <Section title="6. International Data Transfers">
                <P>
                  Your data may be processed and stored on servers located in various jurisdictions. By using Wachsen, you consent to the transfer of your data to these locations, which may have different data protection laws than your country of residence.
                </P>
              </Section>

              <Section title="7. Changes to Privacy Policy">
                <P>
                  We may update this Privacy Policy periodically. Significant changes will be communicated via email or in-app notification. Your continued use after changes take effect indicates acceptance.
                </P>
              </Section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
