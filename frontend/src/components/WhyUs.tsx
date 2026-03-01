interface Props {
  onBack: () => void
}

const SECTION_HEADER = 'text-xs font-mono font-medium uppercase tracking-[0.3em] text-white/30 mb-4'
const SECTION_TITLE = 'text-2xl sm:text-3xl font-bold tracking-tight text-white mb-6'
const BODY = 'text-sm text-white/60 leading-relaxed space-y-3'
const CARD = 'border border-white/[0.06] rounded-lg p-6 bg-white/[0.02]'
const CODE = 'font-mono text-xs bg-white/[0.06] border border-white/[0.08] rounded px-2 py-1 text-white/80'

export default function WhyUs({ onBack }: Props) {
  return (
    <div className="min-h-screen bg-[#06080d] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-10 py-5 bg-[#06080d]/95 backdrop-blur-md border-b border-white/[0.06]">
        <button
          type="button"
          onClick={onBack}
          className="text-lg font-semibold tracking-tight text-white uppercase hover:text-white/80 transition-colors cursor-pointer"
        >
          Aleithia
        </button>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium border border-white/20 text-white/80 hover:text-white hover:border-white/40 transition-colors cursor-pointer"
        >
          Back
        </button>
      </nav>

      <main className="max-w-4xl mx-auto px-10 py-16">
        <p className={SECTION_HEADER}>Value proposition</p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
          Why Us?
        </h1>
        <p className="text-base text-white/50 mb-16">
          Traditional market research is expensive and slow. Aleithia delivers neighborhood intelligence in seconds, for free.
        </p>

        {/* Traditional vs Aleithia — quick comparison */}
        <section className="mb-20">
          <h2 className={SECTION_TITLE}>Traditional vs Aleithia</h2>
          <div className={CARD}>
            <div className="flex items-center justify-center gap-12 py-8">
              <div className="text-center">
                <div className="text-[10px] font-mono uppercase tracking-wider text-white/20 mb-1">Traditional</div>
                <div className="text-lg font-bold text-white/30 line-through font-mono">$5K–$15K</div>
                <div className="text-[10px] font-mono text-white/15">2–3 weeks</div>
              </div>
              <div className="text-xs font-mono text-white/10">vs</div>
              <div className="text-center">
                <div className="text-[10px] font-mono uppercase tracking-wider text-white/20 mb-1">Aleithia</div>
                <div className="text-lg font-bold text-white font-mono">$0</div>
                <div className="text-[10px] font-mono text-white/30">seconds</div>
              </div>
            </div>
          </div>
        </section>

        {/* 1. Traditional Gold Standard Process */}
        <section className="mb-20">
          <h2 className={SECTION_TITLE}>1. The Traditional &quot;Gold Standard&quot; Process</h2>
          <p className={`${BODY} mb-4`}>
            To prove your AI is better, you must benchmark against the Site Selection Group (SSG) or Deloitte&apos;s standard methodology.
          </p>
          <p className="text-xs font-mono text-white/40 mb-4">
            Source: Site Selection Group&apos;s &quot;White Paper on Site Selection Methodology&quot;
          </p>
          <div className={CARD}>
            <h3 className="text-sm font-semibold text-white/90 mb-3">The Process</h3>
            <ul className="space-y-3 text-sm text-white/60">
              <li><strong className="text-white/80">Filtering (The Funnel):</strong> Start with 3,000 counties → filter to 50 → shortlist 3.</li>
              <li><strong className="text-white/80">Labor Analytics:</strong> Manually pulling &quot;Location Quotients&quot; (LQ) from the Bureau of Labor Statistics (BLS).</li>
              <li><strong className="text-white/80">Field Due Diligence:</strong> Sending a team of 4 consultants to a city for 3 days to interview local officials.</li>
            </ul>
            <p className="text-sm text-white/70 mt-4 pt-4 border-t border-white/[0.06]">
              <strong>The Cost:</strong> Professional fees for this 4-phase process typically range from <span className="text-white font-mono">$75,000</span> to <span className="text-white font-mono">$200,000</span> per project.
            </p>
          </div>
        </section>

        {/* 2. Case Study: Amazon HQ2 */}
        <section className="mb-20">
          <h2 className={SECTION_TITLE}>2. Case Study: The &quot;Manual&quot; Burden (Amazon HQ2)</h2>
          <p className="text-xs font-mono text-white/40 mb-4">
            Source: Public RFP for Amazon HQ2 (2017)
          </p>
          <p className={`${BODY} mb-4`}>
            Amazon asked cities to provide data on &quot;cultural fit,&quot; &quot;housing affordability,&quot; and &quot;airport travel times.&quot;
          </p>
          <p className={`${BODY} mb-4`}>
            <strong className="text-white/80">The Friction:</strong> 238 cities responded with PDF documents totaling tens of thousands of pages.
          </p>
          <p className={`${BODY}`}>
            <strong className="text-white/80">The Aleithia Argument:</strong> A human team spent 14 months reviewing this. An AI solution using Natural Language Processing (NLP) and OCR could have ingested, tagged, and ranked all 238 proposals in a single afternoon.
          </p>
        </section>

        {/* 3. Case Study: Starbucks */}
        <section className="mb-20">
          <h2 className={SECTION_TITLE}>3. Case Study: The &quot;Hyper-Local&quot; Data Shift (Starbucks)</h2>
          <p className="text-xs font-mono text-white/40 mb-4">
            Source: Esri Case Study: Starbucks and GIS
          </p>
          <p className={`${BODY} mb-4`}>
            Starbucks uses Atlas, a proprietary GIS (Geographic Information System) tool. It analyzes traffic patterns, &quot;trade area&quot; boundaries, and even weather patterns to predict sales at a new location.
          </p>
          <p className={`${BODY} mb-4`}>
            <strong className="text-white/80">The Friction:</strong> Only &quot;Mega-Corporations&quot; can afford to build Atlas. Most mid-sized firms still use a &quot;gut feeling&quot; or basic Google Maps.
          </p>
          <p className={`${BODY}`}>
            <strong className="text-white/80">The Aleithia Argument:</strong> Our solution provides &quot;Enterprise-grade GIS for the mid-market.&quot; We offer the same intelligence Starbucks has, but via a scalable API/UI for firms that can&apos;t afford a $5M internal data science team.
          </p>
        </section>

        {/* 4. Case Study: Goldman Sachs */}
        <section className="mb-20">
          <h2 className={SECTION_TITLE}>4. Case Study: Financial Services Expansion (Goldman Sachs)</h2>
          <p className="text-xs font-mono text-white/40 mb-4">
            Source: Real Estate Board of New York (REBNY) / Dallas Economic Development
          </p>
          <p className={`${BODY} mb-4`}>
            Goldman Sachs moved a massive division to Dallas, TX. They spent years evaluating the &quot;Texas Triangle.&quot; They had to weigh the $18M in local incentives against the &quot;brain drain&quot; of moving talent from NYC.
          </p>
          <p className={`${BODY}`}>
            <strong className="text-white/80">The Aleithia Argument:</strong> AI can perform Predictive Talent Modeling. It can calculate the &quot;Propensity to Relocate&quot; of employees based on cost-of-living delta, school rankings, and commute times—data points that human consultants often aggregate poorly.
          </p>
        </section>

        {/* 5. Comparative Summary */}
        <section className="mb-20">
          <h2 className={SECTION_TITLE}>5. Comparative Summary</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/[0.12]">
                  <th className="text-left py-3 pr-4 text-white/50 font-mono uppercase tracking-wider">Metric</th>
                  <th className="text-left py-3 pr-4 text-white/50 font-mono uppercase tracking-wider">Traditional Consulting (e.g., JLL, CBRE)</th>
                  <th className="text-left py-3 text-white/50 font-mono uppercase tracking-wider">Aleithia</th>
                </tr>
              </thead>
              <tbody className="text-white/60">
                <tr className="border-b border-white/[0.06]">
                  <td className="py-3 pr-4">Data Scope</td>
                  <td className="py-3 pr-4">Static snapshots (quarterly reports)</td>
                  <td className="py-3">Real-time (API-driven / scraped)</td>
                </tr>
                <tr className="border-b border-white/[0.06]">
                  <td className="py-3 pr-4">Duration</td>
                  <td className="py-3 pr-4">3 to 6 months</td>
                  <td className="py-3">Minutes to hours</td>
                </tr>
                <tr className="border-b border-white/[0.06]">
                  <td className="py-3 pr-4">Bias</td>
                  <td className="py-3 pr-4">Subjective (consultant relationships)</td>
                  <td className="py-3">Objective (data-weighted scoring)</td>
                </tr>
                <tr className="border-b border-white/[0.06]">
                  <td className="py-3 pr-4">Cost</td>
                  <td className="py-3 pr-4">$100k+ fixed fee</td>
                  <td className="py-3">SaaS / Subscription (e.g., $5k–$10k)</td>
                </tr>
                <tr className="border-b border-white/[0.06]">
                  <td className="py-3 pr-4">Scalability</td>
                  <td className="py-3 pr-4">One location at a time</td>
                  <td className="py-3">Compare 1,000 locations instantly</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 6. Recommended Sources */}
        <section className="mb-20">
          <h2 className={SECTION_TITLE}>6. Recommended Sources for Technical Validation</h2>
          <ul className="space-y-3 text-sm text-white/60">
            <li>
              <span className={CODE}>Area Development Magazine</span> — The industry bible for site selectors. Use their &quot;Corporate Consultant Surveys&quot; to find pain points (e.g., &quot;Finding labor is our #1 challenge&quot;).
            </li>
            <li>
              <span className={CODE}>Placer.ai</span> — A modern competitor/benchmark. They use cell phone pings to track foot traffic. If your AI does something similar, this is your closest market peer.
            </li>
            <li>
              <span className={CODE}>BLS.gov (Location Quotient)</span> — This is the math traditionalists use. Show how your AI automates the calculation of LQ.
            </li>
          </ul>
        </section>

        {/* 7. Sources & References */}
        <section className="mb-20">
          <h2 className={SECTION_TITLE}>7. Sources &amp; References</h2>

          <div className="space-y-8">
            {/* 1. Traditional Manual Playbook */}
            <div className={CARD}>
              <h3 className="text-sm font-semibold text-white/90 mb-3">1. The Traditional &quot;Manual&quot; Playbook</h3>
              <p className="text-xs text-white/50 mb-4">Documents the slow, multi-phase methodology used by human consultants.</p>
              <ul className="space-y-2 text-sm text-white/60">
                <li>
                  <a href="https://siteselectiongroup.com/" target="_blank" rel="noopener noreferrer" className="text-[#2B95D6] hover:underline">
                    Site Selection Group: The 8-Step Selection Process
                  </a>
                  <span className="text-white/40"> — Balanced scorecard approach for quantitative and qualitative factors.</span>
                </li>
                <li>
                  <a href="https://researchfdi.com/" target="_blank" rel="noopener noreferrer" className="text-[#2B95D6] hover:underline">
                    ResearchFDI: The 5 Phases of Site Selection
                  </a>
                  <span className="text-white/40"> — Standard lifecycle from project initiation to final selection (6–12 months for complex expansions).</span>
                </li>
                <li>
                  <a href="https://siteselectiongroup.com/" target="_blank" rel="noopener noreferrer" className="text-[#2B95D6] hover:underline">
                    Site Selection Group: 17 Best Practices Guide
                  </a>
                  <span className="text-white/40"> — How &quot;filtering analysis&quot; for talent and tax data is manually driven by project type.</span>
                </li>
              </ul>
            </div>

            {/* 2. Industry Pain Points */}
            <div className={CARD}>
              <h3 className="text-sm font-semibold text-white/90 mb-3">2. Industry Pain Points &amp; Benchmarks</h3>
              <p className="text-xs text-white/50 mb-4">Reports proving the &quot;old way&quot; struggles with speed and talent access.</p>
              <ul className="space-y-2 text-sm text-white/60">
                <li>
                  <a href="https://www.areadevelopment.com/" target="_blank" rel="noopener noreferrer" className="text-[#2B95D6] hover:underline">
                    Area Development: 20th Annual Consultants Survey (2024)
                  </a>
                  <span className="text-white/40"> — Skilled labor access is the top priority; &quot;speed to market&quot; is a critical differentiator.</span>
                </li>
                <li>
                  <a href="https://www.areadevelopment.com/" target="_blank" rel="noopener noreferrer" className="text-[#2B95D6] hover:underline">
                    Area Development: 38th Annual Corporate Survey
                  </a>
                  <span className="text-white/40"> — Mid-sized firms hesitating on expansions due to economic uncertainty—a prime market for cheaper, automated solutions.</span>
                </li>
              </ul>
            </div>

            {/* 3. Major Case Studies */}
            <div className={CARD}>
              <h3 className="text-sm font-semibold text-white/90 mb-3">3. Major Case Studies (Manual vs. Tech)</h3>
              <ul className="space-y-2 text-sm text-white/60">
                <li>
                  <a href="https://www.geekwire.com/2017/amazon-hq2-rfp-full-document/" target="_blank" rel="noopener noreferrer" className="text-[#2B95D6] hover:underline">
                    Amazon HQ2 RFP (Original 2017)
                  </a>
                  <span className="text-white/40"> — The document that triggered 238 manual proposals and a year-long human review process.</span>
                </li>
                <li>
                  <a href="https://www.boston.gov/" target="_blank" rel="noopener noreferrer" className="text-[#2B95D6] hover:underline">
                    Boston&apos;s HQ2 Proposal Archive
                  </a>
                  <span className="text-white/40"> — Example of massive, data-heavy &quot;dossiers&quot; that cities manually prepare and firms must manually read.</span>
                </li>
                <li>
                  <a href="https://www.esri.com/en-us/arcgis/products/arcgis-business-analyst/overview" target="_blank" rel="noopener noreferrer" className="text-[#2B95D6] hover:underline">
                    Esri: ArcGIS Business Analyst Overview
                  </a>
                  <span className="text-white/40"> — The current &quot;high-end&quot; technical benchmark. Location intelligence is a billion-dollar industry but requires specialist training.</span>
                </li>
              </ul>
            </div>

            {/* 4. Cost & Incentive Data */}
            <div className={CARD}>
              <h3 className="text-sm font-semibold text-white/90 mb-3">4. Cost &amp; Incentive Data (ROI Arguments)</h3>
              <ul className="space-y-2 text-sm text-white/60">
                <li>
                  <a href="https://siteselectiongroup.com/" target="_blank" rel="noopener noreferrer" className="text-[#2B95D6] hover:underline">
                    Site Selection Group: 2025 Economic Incentives Report
                  </a>
                  <span className="text-white/40"> — $59.2 billion in incentives awarded in 2024. AI can &quot;find&quot; these incentives faster than a human broker.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-10 py-8 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-mono text-white/20">
            Built at HackIllinois 2026 · Mission-critical city intelligence.
          </p>
        </div>
      </footer>
    </div>
  )
}
