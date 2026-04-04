import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Shield, Zap, Wallet, Users, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import FloatingContact from '../components/FloatingContact';

export default function LandingPage() {
  const { t } = useTranslation();
  const { token } = useAuth();

  const primaryHref = token ? '/dashboard' : '/login';

  const providers = useMemo(() => {
    const raw = t('landing.support.providers');
    return raw
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [t]);

  const models = useMemo(() => {
    const raw = t('landing.support.models');
    return raw
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [t]);

  const features = useMemo(
    () => [
      { icon: Zap, title: t('landing.features.fast_title'), desc: t('landing.features.fast_desc') },
      { icon: Wallet, title: t('landing.features.billing_title'), desc: t('landing.features.billing_desc') },
      { icon: Shield, title: t('landing.features.security_title'), desc: t('landing.features.security_desc') },
      { icon: BarChart3, title: t('landing.features.analytics_title'), desc: t('landing.features.analytics_desc') },
      { icon: Users, title: t('landing.features.team_title'), desc: t('landing.features.team_desc') },
    ],
    [t]
  );

  const pricing = useMemo(
    () => [
      {
        name: t('landing.pricing.payg_name'),
        price: t('landing.pricing.payg_price'),
        tagline: t('landing.pricing.payg_tagline'),
        items: [t('landing.pricing.payg_i1'), t('landing.pricing.payg_i2'), t('landing.pricing.payg_i3')],
      },
      {
        name: t('landing.pricing.sub_name'),
        price: t('landing.pricing.sub_price'),
        tagline: t('landing.pricing.sub_tagline'),
        items: [t('landing.pricing.sub_i1'), t('landing.pricing.sub_i2'), t('landing.pricing.sub_i3')],
      },
      {
        name: t('landing.pricing.team_name'),
        price: t('landing.pricing.team_price'),
        tagline: t('landing.pricing.team_tagline'),
        items: [t('landing.pricing.team_i1'), t('landing.pricing.team_i2'), t('landing.pricing.team_i3')],
      },
    ],
    [t]
  );

  const faqs = useMemo(
    () => [
      { q: t('landing.faq.q1'), a: t('landing.faq.a1') },
      { q: t('landing.faq.q2'), a: t('landing.faq.a2') },
      { q: t('landing.faq.q3'), a: t('landing.faq.a3') },
    ],
    [t]
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute top-24 left-10 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute top-48 right-10 h-72 w-72 rounded-full bg-purple-500/15 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-gray-800/60 bg-gray-950/70 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold">T</div>
            <div>
              <div className="text-white font-semibold leading-tight">TRouter</div>
              <div className="text-xs text-gray-400">{t('landing.header.subtitle')}</div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-300">
            <a href="#features" className="hover:text-white transition-colors">{t('landing.header.features')}</a>
            <a href="#pricing" className="hover:text-white transition-colors">{t('landing.header.pricing')}</a>
            <a href="#faq" className="hover:text-white transition-colors">{t('landing.header.faq')}</a>
          </nav>

          <div className="flex items-center gap-3">
            {!token && (
              <Link to="/register" className="hidden sm:inline-flex px-4 py-2 rounded-lg border border-gray-800 text-gray-200 hover:border-gray-700 hover:bg-gray-900 transition-colors">
                {t('landing.header.register')}
              </Link>
            )}
            <Link to={primaryHref} className="inline-flex px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors">
              {token ? t('landing.header.console') : t('landing.header.login')}
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-7xl px-6 pt-16 pb-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                {t('landing.hero.title')}
              </h1>
              <p className="mt-5 text-lg text-gray-300 leading-relaxed">
                {t('landing.hero.desc')}
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link to={primaryHref} className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors">
                  {t('landing.hero.primary')}
                </Link>
                <a href="#pricing" className="inline-flex items-center justify-center px-5 py-3 rounded-xl border border-gray-800 hover:border-gray-700 hover:bg-gray-900 text-gray-200 font-medium transition-colors">
                  {t('landing.hero.secondary')}
                </a>
              </div>
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-gray-400">
                <span className="inline-flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  {t('landing.hero.badge1')}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  {t('landing.hero.badge2')}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  {t('landing.hero.badge3')}
                </span>
              </div>
            </div>

            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 shadow-2xl">
              <div className="text-sm text-gray-400">{t('landing.hero.panel_kicker')}</div>
              <div className="mt-3 grid grid-cols-1 gap-4">
                <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                  <div className="text-white font-semibold">{t('landing.hero.panel_item1_title')}</div>
                  <div className="mt-2 text-sm text-gray-400">{t('landing.hero.panel_item1_desc')}</div>
                </div>
                <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                  <div className="text-white font-semibold">{t('landing.hero.panel_item2_title')}</div>
                  <div className="mt-2 text-sm text-gray-400">{t('landing.hero.panel_item2_desc')}</div>
                </div>
                <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                  <div className="text-white font-semibold">{t('landing.hero.panel_item3_title')}</div>
                  <div className="mt-2 text-sm text-gray-400">{t('landing.hero.panel_item3_desc')}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-10">
          <div className="rounded-3xl border border-gray-800 bg-gray-900/30 p-8">
            <div className="flex flex-col lg:flex-row gap-10">
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-white">{t('landing.support.title')}</h2>
                <p className="mt-2 text-gray-400">{t('landing.support.desc')}</p>
              </div>
              <div className="flex-[1.2] space-y-6">
                <div>
                  <div className="text-sm text-gray-400">{t('landing.support.providers_title')}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {providers.map((p) => (
                      <span
                        key={p}
                        className="inline-flex items-center rounded-full border border-gray-800 bg-gray-950/60 px-3 py-1 text-sm text-gray-200"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">{t('landing.support.models_title')}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {models.map((m) => (
                      <span
                        key={m}
                        className="inline-flex items-center rounded-full border border-gray-800 bg-gray-950/60 px-3 py-1 text-sm text-gray-200"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-gray-500">{t('landing.support.note')}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-6 py-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">{t('landing.features.title')}</h2>
              <p className="mt-2 text-gray-400">{t('landing.features.desc')}</p>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-gray-800 bg-gray-900/40 p-6 hover:bg-gray-900/60 transition-colors">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <f.icon className="h-5 w-5 text-blue-300" />
                </div>
                <div className="mt-4 text-white font-semibold">{f.title}</div>
                <div className="mt-2 text-sm text-gray-400 leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-7xl px-6 py-14">
          <div>
            <h2 className="text-2xl font-semibold text-white">{t('landing.pricing.title')}</h2>
            <p className="mt-2 text-gray-400">{t('landing.pricing.desc')}</p>
          </div>
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {pricing.map((p) => (
              <div key={p.name} className="rounded-2xl border border-gray-800 bg-gray-900/40 p-6">
                <div className="text-white font-semibold">{p.name}</div>
                <div className="mt-2 text-3xl font-bold text-white">{p.price}</div>
                <div className="mt-2 text-sm text-gray-400">{p.tagline}</div>
                <div className="mt-5 space-y-3">
                  {p.items.map((it) => (
                    <div key={it} className="flex items-start gap-2 text-sm text-gray-300">
                      <Check className="mt-0.5 h-4 w-4 text-emerald-400" />
                      <span>{it}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <Link to={primaryHref} className="inline-flex w-full items-center justify-center px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white transition-colors">
                    {t('landing.pricing.cta')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-7xl px-6 py-14">
          <div>
            <h2 className="text-2xl font-semibold text-white">{t('landing.faq.title')}</h2>
            <p className="mt-2 text-gray-400">{t('landing.faq.desc')}</p>
          </div>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            {faqs.map((f) => (
              <div key={f.q} className="rounded-2xl border border-gray-800 bg-gray-900/40 p-6">
                <div className="text-white font-semibold">{f.q}</div>
                <div className="mt-2 text-sm text-gray-400 leading-relaxed">{f.a}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-16">
          <div className="rounded-3xl border border-gray-800 bg-gradient-to-r from-blue-600/20 via-cyan-600/10 to-purple-600/20 p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="text-white text-xl font-semibold">{t('landing.cta.title')}</div>
              <div className="mt-2 text-gray-300">{t('landing.cta.desc')}</div>
            </div>
            <Link to={primaryHref} className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors">
              {t('landing.cta.button')}
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-gray-800/60">
        <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-gray-500">
          <div>© 2015-2026 {t('landing.footer.company')}</div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-gray-300 transition-colors">{t('landing.footer.login')}</Link>
            <Link to="/register" className="hover:text-gray-300 transition-colors">{t('landing.footer.register')}</Link>
          </div>
        </div>
      </footer>

      <FloatingContact />
    </div>
  );
}

