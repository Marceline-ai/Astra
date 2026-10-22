export default function About() {
  return (
    <section id="about" className="bg-white border-y border-line scroll-mt-20">
      <div className="max-w-[1240px] mx-auto px-5 md:px-10 py-16 lg:py-24 grid lg:grid-cols-2 gap-10 lg:gap-20 items-center">
        <img
          src="/assets/about-interior.png"
          alt="Интерьер салона красоты Astra"
          loading="lazy"
          className="w-full aspect-[4/3] object-cover rounded-[2rem]"
        />
        <div>
          <p className="text-rose font-semibold uppercase tracking-[0.2em] text-xs mb-4">О нас</p>
          <h2 className="font-serif text-3xl lg:text-5xl leading-tight mb-6">Философия Astra</h2>
          <p className="text-muted leading-relaxed mb-4">
            Мы верим, что красота — это не только внешний образ, но и внутреннее состояние.
            В Astra каждый визит начинается с внимания к деталям: от аромата кофе до финального штриха в укладке.
          </p>
          <p className="text-muted leading-relaxed mb-8">
            Наши мастера — призеры профильных конкурсов и постоянные участники обучающих программ
            в Европе. Мы работаем только на премиальной косметике и соблюдаем стандарты стерильности класса «мед».
          </p>
          <dl className="grid grid-cols-3 gap-6">
            {[['7+', 'лет на рынке'], ['12k', 'довольных клиентов'], ['4.9', 'средний рейтинг']].map(([n, l]) => (
              <div key={l}>
                <dt className="font-serif text-3xl lg:text-4xl text-rose">{n}</dt>
                <dd className="text-xs text-muted mt-1 uppercase tracking-wide">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
