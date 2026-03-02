import React from "react";
import { ClipboardPaste, Brain, FileText, Share2, Scale, ShieldCheck, Building2, Landmark } from "lucide-react";
import { useTranslation } from '../i18n/index.jsx';

const STEPS = [
  {
    icon: ClipboardPaste,
    color: "green",
    iconBg: "bg-green-500/20",
    iconColor: "text-green-400",
    numberBg: "bg-green-500",
    borderColor: "border-green-500/30",
  },
  {
    icon: Brain,
    color: "green",
    iconBg: "bg-green-500/20",
    iconColor: "text-green-400",
    numberBg: "bg-green-500",
    borderColor: "border-green-500/30",
  },
  {
    icon: FileText,
    color: "green",
    iconBg: "bg-green-500/20",
    iconColor: "text-green-400",
    numberBg: "bg-green-500",
    borderColor: "border-green-500/30",
    badges: true,
  },
  {
    icon: Share2,
    color: "green",
    iconBg: "bg-green-500/20",
    iconColor: "text-green-400",
    numberBg: "bg-green-500",
    borderColor: "border-green-500/30",
  },
];

export default function About() {
  const { t } = useTranslation();

  const badges = [
    { icon: Scale, label: t('about.flow_badge_plangere') },
    { icon: ShieldCheck, label: t('about.flow_badge_petitie') },
    { icon: Building2, label: t('about.flow_badge_dnsc') },
    { icon: Landmark, label: t('about.flow_badge_banca') },
  ];

  return (
    <section id="despre" className="py-20 relative z-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Existing about card */}
        <div className="glass-card p-8 mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">{t('about.title')}</h2>
          <p className="text-gray-300 text-lg leading-relaxed mb-4">
            {t('about.p1')}
          </p>
          <p className="text-gray-300 text-lg leading-relaxed">
            {t('about.p2')}
          </p>
        </div>

        {/* Flow diagram */}
        <div data-testid="about-flow-section">
          <h3 className="text-2xl font-bold text-white text-center mb-12">
            {t('about.flow_title')}
          </h3>

          <div className="relative flex flex-col items-center gap-0">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const stepKey = `flow_step${idx + 1}`;
              const isLast = idx === STEPS.length - 1;

              return (
                <React.Fragment key={idx}>
                  {/* Step card */}
                  <div
                    data-testid={`about-flow-step-${idx + 1}`}
                    className={`w-full glass-card border ${step.borderColor} p-6 flex items-start gap-5`}
                  >
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${step.iconBg} flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${step.iconColor}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-semibold text-lg mb-1">
                        {t(`about.${stepKey}_title`)}
                      </h4>
                      <p className="text-gray-400 text-sm leading-relaxed">
                        {t(`about.${stepKey}_desc`)}
                      </p>

                      {/* Badges for step 3 */}
                      {step.badges && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {badges.map((badge, bIdx) => {
                            const BadgeIcon = badge.icon;
                            return (
                              <span
                                key={bIdx}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/15 border border-green-500/30 text-green-300 text-xs font-medium"
                              >
                                <BadgeIcon className="w-3 h-3" />
                                {badge.label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Step number badge */}
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full ${step.numberBg} flex items-center justify-center`}>
                      <span className="text-white text-xs font-bold">{idx + 1}</span>
                    </div>
                  </div>

                  {/* Connector line between steps */}
                  {!isLast && (
                    <div className="flex flex-col items-center w-full" aria-hidden="true">
                      <div className="w-px h-8 bg-gradient-to-b from-gray-500/40 to-gray-500/10" />
                      <div className="w-2 h-2 rounded-full bg-gray-500/40" />
                      <div className="w-px h-8 bg-gradient-to-b from-gray-500/10 to-gray-500/40" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
