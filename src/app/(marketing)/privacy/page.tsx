export default function PrivacyPage() {
  return (
    <div className="bg-white min-h-screen">
      <section className="pt-24 pb-20 max-w-3xl mx-auto px-5">
        <h1
          className="text-[32px] font-semibold text-[#0a0a0a]"
          style={{ letterSpacing: "-0.03em" }}
        >
          Privacy Policy
        </h1>
        <p className="text-[13px] text-[#8a8f98] mt-2">
          Last updated: May 1, 2026
        </p>

        <div className="mt-10 space-y-8">
          <div>
            <h2 className="text-[18px] font-semibold text-[#0a0a0a] mb-3">
              Information We Collect
            </h2>
            <p className="text-[15px] text-[#8a8f98] leading-relaxed">
              We collect information you provide directly to us when you create
              an account, use our Service, or communicate with us. This
              includes your name, email address, and account credentials. When
              you use EvalDesk, we also collect the test cases you create, agent
              configurations, evaluation results, and any other content you
              upload or generate within the platform. We automatically collect
              certain information when you use our Service, including your IP
              address, browser type, operating system, pages visited, and the
              dates and times of your visits.
            </p>
          </div>

          <div>
            <h2 className="text-[18px] font-semibold text-[#0a0a0a] mb-3">
              How We Use Your Information
            </h2>
            <p className="text-[15px] text-[#8a8f98] leading-relaxed">
              We use the information we collect to provide, maintain, and
              improve the Service, including processing your evaluations and
              generating analytics. We use your account information to
              authenticate you, communicate with you about your account, and
              provide customer support. We may use aggregated, anonymized data
              for research and development purposes to improve our evaluation
              algorithms and platform features. We do not sell, rent, or trade
              your personal information or evaluation data to third parties. We
              do not use your test cases or agent responses to train machine
              learning models.
            </p>
          </div>

          <div>
            <h2 className="text-[18px] font-semibold text-[#0a0a0a] mb-3">
              Data Storage and Security
            </h2>
            <p className="text-[15px] text-[#8a8f98] leading-relaxed">
              Your data is stored on secure servers with industry-standard
              encryption at rest (AES-256) and in transit (TLS 1.3). We
              implement appropriate technical and organizational measures to
              protect your personal information and evaluation data against
              unauthorized access, alteration, disclosure, or destruction. We
              regularly review our security practices and update them as needed.
              Data retention periods depend on your plan and account status. You
              can request deletion of your data at any time by contacting us.
            </p>
          </div>

          <div>
            <h2 className="text-[18px] font-semibold text-[#0a0a0a] mb-3">
              Third-Party Services
            </h2>
            <p className="text-[15px] text-[#8a8f98] leading-relaxed">
              We may use third-party services to facilitate our Service,
              including cloud hosting providers, payment processors, and
              communication tools. These third parties have access to your
              personal information only to perform specific tasks on our behalf
              and are obligated not to disclose or use it for any other purpose.
              When you configure integrations (such as Slack webhooks or custom
              endpoints), data will be sent to those services according to your
              configuration. We are not responsible for the privacy practices of
              these third-party services and encourage you to review their
              privacy policies.
            </p>
          </div>

          <div>
            <h2 className="text-[18px] font-semibold text-[#0a0a0a] mb-3">
              Your Rights
            </h2>
            <p className="text-[15px] text-[#8a8f98] leading-relaxed">
              You have the right to access, correct, update, or delete your
              personal information at any time through your account settings or
              by contacting us directly. You can export all of your evaluation
              data, test cases, and results in a machine-readable format at any
              time. You may opt out of non-essential communications by updating
              your notification preferences. If you are a resident of the
              European Union, you have additional rights under the GDPR,
              including the right to data portability and the right to lodge a
              complaint with a supervisory authority. We will honor verifiable
              consumer requests as required by applicable law.
            </p>
          </div>

          <div>
            <h2 className="text-[18px] font-semibold text-[#0a0a0a] mb-3">
              Contact Us
            </h2>
            <p className="text-[15px] text-[#8a8f98] leading-relaxed">
              If you have any questions about this Privacy Policy or our data
              practices, please contact us at{" "}
              <a
                href="mailto:privacy@evaldesk.dev"
                className="text-[#ABC83A] hover:underline"
              >
                privacy@evaldesk.dev
              </a>
              . We will respond to your request within 30 days. You may also
              write to us at: EvalDesk, Attn: Privacy, 123 Evaluation Lane,
              San Francisco, CA 94105.
            </p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-black/[0.06]">
          <p className="text-[14px] text-[#8a8f98] leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify
            you of any changes by posting the new Privacy Policy on this page
            and updating the &quot;Last updated&quot; date. You are advised to review
            this Privacy Policy periodically for any changes.
          </p>
        </div>
      </section>
    </div>
  );
}
