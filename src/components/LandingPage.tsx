import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Download,
  Layers,
  Lock,
  RefreshCw,
} from 'lucide-react';
import type { UserProfile } from '../types.ts';
import { AntigravityHeroField } from './AntigravityHeroField.tsx';

interface LandingPageProps {
  users: UserProfile[];
  onSignInWithTeams: () => void;
  onInstallApp: () => void;
}

const PREVIEW_CARDS = [
  {
    code: '19-03 · P1',
    title: 'Requirement Analysis & Setup',
    dateLabel: 'Oct 01 – Oct 15, 2026',
    baselineLabel: 'Baseline: Oct 01 – Oct 16 (-1d)',
    progress: 100,
    health: 'done' as const,
    left: '4%',
    width: '26%',
  },
  {
    code: '19-03 · P2',
    title: 'Design Development',
    dateLabel: 'Oct 16 – Nov 04, 2026',
    baselineLabel: 'Baseline: Oct 15 – Nov 02 (+2d)',
    progress: 67,
    health: 'normal' as const,
    left: '24%',
    width: '30%',
  },
  {
    code: '19-03 · P3',
    title: 'Construction Documents & Core Dev',
    dateLabel: 'Oct 30 – Nov 24, 2026',
    baselineLabel: 'Baseline: Oct 28 – Nov 18 (+6d)',
    progress: 25,
    health: 'warning' as const,
    left: '46%',
    width: '34%',
  },
  {
    code: '19-03 · P5',
    title: 'Contract Administration',
    dateLabel: 'No end date · Review Dec 10',
    baselineLabel: 'Ongoing phase',
    progress: 50,
    health: 'normal' as const,
    left: '68%',
    width: '28%',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  users,
  onSignInWithTeams,
  onInstallApp,
}) => {
  const [activePreviewTab, setActivePreviewTab] = useState<
    'timeline' | 'templates' | 'mcp'
  >('timeline');

  return (
    <div className="min-h-dvh bg-white text-[#121317] flex flex-col selection:bg-[#0A4595] selection:text-white">
      {/* Dark Cosmic Google Antigravity Navbar */}
      <header className="sticky top-0 z-30 bg-[#070A12]/90 backdrop-blur-md border-b border-white/10 text-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <a
              href="#top"
              className="flex items-center gap-2.5 text-white font-semibold text-[17.5px] tracking-tight"
            >
              <img
                src="/tianlan-logo.png"
                alt="Tianlane logo"
                width={28}
                height={28}
                className="w-7 h-7 rounded-lg object-cover ring-1 ring-white/20"
              />
              <span>Tianlane</span>
            </a>

            <nav
              aria-label="Primary navigation"
              className="hidden md:flex items-center gap-6 text-[14.5px] text-gray-300"
            >
              <a href="#preview" className="hover:text-white transition-colors">
                Timeline
              </a>
              <a
                href="#architecture"
                className="hover:text-white transition-colors"
              >
                Templates
              </a>
              <a href="#mcp" className="hover:text-white transition-colors">
                Agent
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onInstallApp}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 hover:border-white/40 hover:bg-white/5 text-[13px] font-medium text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-gray-300" aria-hidden="true" />
              <span>Install app</span>
            </button>

            <button
              type="button"
              onClick={onSignInWithTeams}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#0A4595] hover:bg-[#1264D4] text-white text-[13px] font-medium transition-colors shadow-lg shadow-[#0A4595]/30"
            >
              <span>Sign in</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section with Clean Dark Cosmic Background & Sparkling Blue Stars */}
      <main id="top" className="flex-1">
        <section className="relative overflow-hidden pt-20 pb-20 text-center bg-[#070A12] text-white">
          {/* Antigravity Interactive Starfield in Radiant Brand Blue & Starlight */}
          <AntigravityHeroField brandColor="#0A4595" />

          <div className="relative z-10 max-w-4xl mx-auto px-6">
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white shadow-clean-xs">
                <img
                  src="/favicon.png"
                  alt="Tianlane logo"
                  width={20}
                  height={20}
                  className="w-5 h-5 rounded-md object-contain"
                />
                <span className="text-[13px] font-medium text-white">
                  Tianlane · Project Governance Platform
                </span>
              </div>
            </div>

            <h1 className="text-[36px] sm:text-[52px] leading-[1.12] font-medium tracking-[-0.03em] text-white max-w-3xl mx-auto">
              Dedicated project governance built for Product Owners
            </h1>

            <p className="mt-5 text-[16px] sm:text-[17.5px] leading-[1.6] text-gray-300 max-w-2xl mx-auto font-normal">
              Govern roadmaps, baselines, and phase gates with total clarity — while
              bridging tasks with your team&apos;s daily trackers so project progress stays
              automatically in sync.
            </p>

            {/* Primary & Secondary Pill CTAs */}
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onSignInWithTeams}
                className="inline-flex items-center gap-2.5 px-7 py-3 rounded-full bg-[#0A4595] hover:bg-[#1264D4] active:bg-[#083778] text-white text-[14.5px] font-medium transition-colors shadow-lg shadow-[#0A4595]/40"
              >
                <span>Sign in</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        {/* Clean Pure White Section Below: Product Preview, Templates, Architecture */}
        <div className="bg-white text-[#121317] pt-12">
          {/* Interactive Product Preview */}
          <section id="preview" className="max-w-6xl mx-auto px-6 pb-20">
          <div className="flex justify-center mb-6">
            <div
              role="tablist"
              aria-label="Feature preview"
              className="inline-flex p-1 rounded-full bg-[#F1F3F7] border border-[#E6E8EE]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activePreviewTab === 'timeline'}
                onClick={() => setActivePreviewTab('timeline')}
                className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                  activePreviewTab === 'timeline'
                    ? 'bg-white text-[#121317] shadow-clean-xs'
                    : 'text-[#45474D] hover:text-[#121317]'
                }`}
              >
                Timeline & Baseline
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activePreviewTab === 'templates'}
                onClick={() => setActivePreviewTab('templates')}
                className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                  activePreviewTab === 'templates'
                    ? 'bg-white text-[#121317] shadow-clean-xs'
                    : 'text-[#45474D] hover:text-[#121317]'
                }`}
              >
                Project Templates
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activePreviewTab === 'mcp'}
                onClick={() => setActivePreviewTab('mcp')}
                className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                  activePreviewTab === 'mcp'
                    ? 'bg-white text-[#121317] shadow-clean-xs'
                    : 'text-[#45474D] hover:text-[#121317]'
                }`}
              >
                Agent Automation
              </button>
            </div>
          </div>

          <div className="rounded-[24px] border border-[#E6E8EE] bg-white shadow-clean-md overflow-hidden">
            <div className="px-6 py-3.5 border-b border-[#E6E8EE] flex items-center justify-between bg-[#F7F8FA]">
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-medium text-[#121317] tabular-nums">
                  19-03 · SMSC Platform
                </span>
                <span className="text-[12px] text-[#45474D] tabular-nums">
                  Linked Tracker #42
                </span>
              </div>
              <button
                type="button"
                onClick={onSignInWithTeams}
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#0A4595] hover:underline"
              >
                <span>Open workspace</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {activePreviewTab === 'timeline' && (
              <div className="p-6">
                <div className="grid grid-cols-3 border-b border-[#E6E8EE] pb-3 mb-6 text-[12.5px] text-[#45474D]">
                  <div>October 2026</div>
                  <div className="font-medium text-[#121317]">
                    November 2026 · Today Nov 09
                  </div>
                  <div>December 2026</div>
                </div>

                <div
                  className="relative space-y-4 py-2 timeline-grid-bg"
                  style={{ backgroundSize: '33.333% 100%' }}
                >
                  <div
                    className="absolute top-0 bottom-0 w-[1.5px] bg-[#0A4595] z-10 pointer-events-none"
                    style={{ left: '54%' }}
                  >
                    <span className="absolute -top-2.5 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#0A4595] text-white text-[10px] font-medium tabular-nums">
                      Today
                    </span>
                  </div>

                  {PREVIEW_CARDS.map((card) => (
                    <div
                      key={card.code}
                      style={{ marginLeft: card.left, width: card.width }}
                      className="relative z-20 rounded-xl bg-white border border-[#E6E8EE] shadow-clean-sm overflow-hidden"
                    >
                      <div className="w-full h-1 bg-[#F1F3F7]">
                        <div
                          className={`h-full ${
                            card.health === 'warning'
                              ? 'bg-[#D93025]'
                              : card.health === 'done'
                              ? 'bg-[#188038]'
                              : 'bg-[#121317]'
                          }`}
                          style={{
                            width:
                              card.health === 'warning'
                                ? '100%'
                                : `${card.progress}%`,
                          }}
                        />
                      </div>

                      <div className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                card.health === 'warning'
                                  ? 'bg-[#D93025]'
                                  : 'bg-[#188038]'
                              }`}
                            />
                            <span className="text-[13px] font-medium text-[#121317] truncate">
                              {card.code} — {card.title}
                            </span>
                          </div>
                          <span className="text-[12px] text-[#45474D] tabular-nums shrink-0">
                            {card.progress}%
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[12px] text-[#45474D] tabular-nums">
                          <span>{card.dateLabel}</span>
                          <span>{card.baselineLabel}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activePreviewTab === 'templates' && (
              <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 rounded-2xl border border-[#E6E8EE] space-y-2">
                  <div className="text-[12px] text-[#45474D] font-mono tabular-nums">
                    5 Milestones · 10 Tasks
                  </div>
                  <h3 className="text-[15px] font-medium text-[#121317]">
                    Standard Software Lifecycle
                  </h3>
                  <p className="text-[13px] text-[#45474D]">
                    Auto-schedules phases from PRD and UI design to UAT and go-live.
                  </p>
                </div>

                <div className="p-5 rounded-2xl border border-[#E6E8EE] space-y-2">
                  <div className="text-[12px] text-[#45474D] font-mono tabular-nums">
                    3 Milestones · Gate Blockers
                  </div>
                  <h3 className="text-[15px] font-medium text-[#121317]">
                    Enterprise Systems Integration
                  </h3>
                  <p className="text-[13px] text-[#45474D]">
                    Pre-configured for master data mapping, API contracts, and cutover.
                  </p>
                </div>

                <div className="p-5 rounded-2xl border border-[#E6E8EE] space-y-2">
                  <div className="text-[12px] text-[#45474D] font-mono tabular-nums">
                    2 Milestones · Entra ID SSO
                  </div>
                  <h3 className="text-[15px] font-medium text-[#121317]">
                    Fast-Track PWA Portal
                  </h3>
                  <p className="text-[13px] text-[#45474D]">
                    Rapid rollout for standalone web apps with Microsoft Teams login.
                  </p>
                </div>
              </div>
            )}

            {activePreviewTab === 'mcp' && (
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="space-y-3">
                  <h3 className="text-[17.5px] font-medium text-[#121317]">
                    Automated Task Dispatch & Real-Time Sync
                  </h3>
                  <p className="text-[14.5px] text-[#45474D] leading-relaxed">
                    Bridge high-level project governance with daily team execution.
                    Dispatch milestone deliverables into tracked tasks with one click,
                    and let the Agent sync progress back as team members complete work.
                  </p>
                  <ul className="space-y-2 text-[13px] text-[#45474D]">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-[#0A4595]" aria-hidden="true" />
                      <span>Dispatch tasks with direct tracker reference links</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-[#0A4595]" aria-hidden="true" />
                      <span>Continuous progress sync from team daily updates</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-[#0A4595]" aria-hidden="true" />
                      <span>Human-in-the-loop confirmation before batch writes</span>
                    </li>
                  </ul>
                </div>

                <div className="p-5 rounded-2xl bg-[#F7F8FA] border border-[#E6E8EE] font-mono text-[12px] text-[#121317] space-y-2">
                  <div className="text-[#45474D]">// Agent Automation</div>
                  <div>action: &quot;Dispatch Tasks &amp; Sync Progress&quot;</div>
                  <div>project: &quot;19-03&quot;</div>
                  <div>tracker_id: 42</div>
                  <div className="pt-2 text-[#0A4595]">
                    → Synchronized 4 tasks with ground-truth team status
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Clean 3-Column Specs */}
        <section
          id="architecture"
          className="max-w-6xl mx-auto px-6 py-16 border-t border-[#E6E8EE]"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[#121317] font-medium text-[16px]">
                <Layers className="w-4 h-4 text-[#0A4595]" aria-hidden="true" />
                <span>Timeline, Board &amp; List</span>
              </div>
              <p className="text-[14.5px] text-[#45474D] leading-relaxed">
                Switch views and filter properties from two clean controls. Track
                baseline variance and critical paths without clutter.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[#121317] font-medium text-[16px]">
                <Lock className="w-4 h-4 text-[#0A4595]" aria-hidden="true" />
                <span>Phase-Gate Control</span>
              </div>
              <p className="text-[14.5px] text-[#45474D] leading-relaxed">
                Lock milestone completion until gate blockers and required deliverable
                documents are signed off.
              </p>
            </div>

            <div id="mcp" className="space-y-2">
              <div className="flex items-center gap-2 text-[#121317] font-medium text-[16px]">
                <RefreshCw className="w-4 h-4 text-[#0A4595]" aria-hidden="true" />
                <span>Tracker &amp; Teams Connected</span>
              </div>
              <p className="text-[14.5px] text-[#45474D] leading-relaxed">
                Independent governance that integrates with your team&apos;s daily trackers.
                Sign in with Microsoft Teams and automate weekly digests effortlessly.
              </p>
            </div>
          </div>
        </section>
        </div>
      </main>

      <footer className="border-t border-[#E6E8EE] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 text-[13px] text-[#45474D]">
          <div className="flex items-center gap-2">
            <img
              src="/tianlan-logo.png"
              alt=""
              width={18}
              height={18}
              className="w-4.5 h-4.5 rounded object-cover"
            />
            <span>Tianlane Project Management</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onInstallApp}
              className="hover:text-[#121317] transition-colors"
            >
              Install PWA
            </button>
            <button
              type="button"
              onClick={onSignInWithTeams}
              className="text-[#0A4595] font-medium hover:underline"
            >
              Enter Workspace →
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
