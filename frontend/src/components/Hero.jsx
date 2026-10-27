export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-[1240px] mx-auto px-5 md:px-10 py-16 lg:py-28 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className="order-2 lg:order-1">
          <p className="text-rose font-semibold uppercase tracking-[0.2em] text-xs mb-4">Beauty & Wellness</p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-[64px] xl:text-[72px] leading-[1.05] mb-6">
            Красота в&nbsp;каждой детали
          </h1>
          <p className="text-muted text-base lg:text-lg max-w-md mb-8">
            Премиальный салон Astra в центре города. Авторы стиля, безупречный сервис и&nbsp;атмосфера спокойствия.
          </p>
          <div className="flex flex-wrap gap-4">
            <a href="#booking" className="btn-primary">Записаться онлайн</a>
            <a href="#services" className="btn-rose !bg-transparent !text-ink border border-line hover:!bg-white">Наши услуги</a>
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <img
            src="/assets/hero-beauty-portrait.png"
            alt="Гостья салона красоты Astra — профессиональный макияж и укладка"
            fetchPriority="high"
            className="w-full aspect-[4/5] object-cover rounded-[2rem] shadow-xl"
          />
        </div>
      </div>
    </section>
  );
}
