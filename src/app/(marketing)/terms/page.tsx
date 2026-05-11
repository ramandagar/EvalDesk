export default function TermsPage() {
  return (
    <div className="bg-white min-h-screen">
      <section className="pt-24 pb-20 max-w-3xl mx-auto px-5">
        <h1
          className="text-[32px] font-semibold text-[#0a0a0a]"
          style={{ letterSpacing: "-0.03em" }}
        >
          Terms of Service
        </h1>
        <p className="text-[13px] text-[#8a8f98] mt-2">
          Last updated: May 1, 2026
        </p>

        <div className="mt-10 space-y-8">
          <div>
            <h2 className="text-[18px] font-semibold text-[#0a0a0a] mb-3">
              1. Acceptance of Terms
            </h2>
            <p className="text-[15px] text-[#8a8f98] leading-relaxed">
              By accessing or using EvalDesk (&quot;the Service&quot;), you agree to be
              bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to
              these Terms, you may not access or use the Service. These Terms
              apply to all visitors, users, and others who access or use the
              Service. We reserve the right to update or modify these Terms at
              any time without prior notice. Your continued use of the Service
              after any such changes constitutes your acceptance of the new
              Terms.
            </p>
          </div>

          <div>
            <h2 className="text-[18px] font-semibold text-[#0a0a0a] mb-3">
              2. Service Description
            </h2>
            <p className="text-[15px] text-[#8a8f98] leading-relaxed">
              EvalDesk provides an AI agent evaluation platform that allows users
              to create test cases, run evaluations against AI agents, and
              analyze results. The Service includes features such as LLM-powered
              judging, analytics dashboards, integrations with third-party
              services, and API access. We reserve the right to modify,
              suspend, or discontinue any aspect of the Service at any time,
              including the availability of any feature, database, or content,
              with reasonable notice to users when possible.
            </p>
          </div>

          <div>
            <h2 className="text-[18px] font-semibold text-[#0a0a0a] mb-3">
              3. User Accounts
            </h2>
            <p className="text-[15px] text-[#8a8f98] leading-relaxed">
              To access certain features of the Service, you must create an
              account. You are responsible for maintaining the confidentiality
              of your account credentials and for all activities that occur
              under your account. You agree to notify us immediately of any
              unauthorized access to or use of your account. You must provide
              accurate, current, and complete information during the
              registration process and keep your account information updated.
              We reserve the right to suspend or terminate your account if any
              information provided proves to be inaccurate, not current, or
              incomplete.
            </p>
          </div>

          <div>
            <h2 className="text-[18px] font-semibold text-[#0a0a0a] mb-3">
              4. Intellectual Property
            </h2>
            <p className="text-[15px] text-[#8a8f98] leading-relaxed">
              The Service and its original content (excluding content provided
              by users), features, and functionality are and will remain the
              exclusive property of EvalDesk and its licensors. The Service is
              protected by copyright, trademark, and other laws of both the
              United States and foreign countries. Our trademarks and trade
              dress may not be used in connection with any product or service
              without the prior written consent of EvalDesk. You retain all
              intellectual property rights to your test cases, agent
              configurations, evaluation results, and any other content you
              upload or create within the Service.
            </p>
          </div>

          <div>
            <h2 className="text-[18px] font-semibold text-[#0a0a0a] mb-3">
              5. Limitation of Liability
            </h2>
            <p className="text-[15px] text-[#8a8f98] leading-relaxed">
              In no event shall EvalDesk, its directors, employees, partners,
              agents, suppliers, or affiliates be liable for any indirect,
              incidental, special, consequential, or punitive damages, including
              without limitation, loss of profits, data, use, goodwill, or other
              intangible losses, resulting from (a) your access to or use of or
              inability to access or use the Service; (b) any conduct or content
              of any third party on the Service; (c) any content obtained from
              the Service; or (d) unauthorized access, use, or alteration of
              your transmissions or content. In no event shall EvalDesk&apos;s total
              aggregate liability exceed the amount you have paid to EvalDesk in
              the twelve (12) months preceding the claim.
            </p>
          </div>

          <div>
            <h2 className="text-[18px] font-semibold text-[#0a0a0a] mb-3">
              6. Governing Law
            </h2>
            <p className="text-[15px] text-[#8a8f98] leading-relaxed">
              These Terms shall be governed and construed in accordance with the
              laws of the State of Delaware, United States, without regard to
              its conflict of law provisions. Any disputes arising from or
              relating to these Terms or the Service shall be resolved in the
              federal or state courts located in Delaware, and you consent to
              the personal jurisdiction and venue of such courts. Our failure to
              enforce any right or provision of these Terms will not be
              considered a waiver of those rights. If any provision of these
              Terms is held to be invalid or unenforceable, the remaining
              provisions shall remain in effect.
            </p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-black/[0.06]">
          <p className="text-[14px] text-[#8a8f98] leading-relaxed">
            If you have any questions about these Terms, please contact us at{" "}
            <a
              href="mailto:legal@evaldesk.dev"
              className="text-[#ABC83A] hover:underline"
            >
              legal@evaldesk.dev
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
