const FALLBACK_IMG = {
  1: '/assets/asset-5b978307.png',
  2: '/assets/asset-798b2c16.png',
  3: '/assets/asset-5b978307.png',
  4: '/assets/asset-798b2c16.png',
  5: '/assets/asset-5b978307.png',
};

export default function Services({ categories }) {
  return (
    <section id="services" className="scroll-mt-20 px-5 md:px-10 py-16 lg:py-28 max-w-[1240px] mx-auto">
      <p className="text-rose font-semibold uppercase tracking-[0.2em] text-xs mb-4 text-center">Услуги</p>
      <h2 className="font-serif text-3xl lg:text-5xl text-center mb-10 lg:mb-14">Что мы умеем лучше всех</h2>

      {/* Desktop: сетка карточек */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-5 gap-6">
        {categories.map((c) => (
          <a
            key={c.id}
            href="#booking"
            className="card overflow-hidden group hover:shadow-lg transition block"
          >
            <div className="aspect-[4/5] overflow-hidden">
              <img
                src={c.image_url || FALLBACK_IMG[c.sort_order]}
                alt={c.name}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
              />
            </div>
            <div className="p-5">
              <h3 className="font-serif text-lg leading-snug">{c.name}</h3>
              <p className="text-xs text-muted mt-2 line-clamp-2">{c.description}</p>
              <span className="inline-block mt-3 text-xs font-semibold text-rose">Записаться →</span>
            </div>
          </a>
        ))}
      </div>

      {/* Mobile: горизонтальный свайп */}
      <div className="md:hidden swipe-row flex gap-4 overflow-x-auto pb-4 -mx-5 px-5">
        {categories.map((c) => (
          <a
            key={c.id}
            href="#booking"
            className="card overflow-hidden shrink-0 w-[260px] block"
          >
            <div className="aspect-[4/5] overflow-hidden">
              <img
                src={c.image_url || FALLBACK_IMG[c.sort_order]}
                alt={c.name}
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-4">
              <h3 className="font-serif text-base leading-snug">{c.name}</h3>
              <p className="text-xs text-muted mt-1.5 line-clamp-2">{c.description}</p>
              <span className="inline-block mt-2 text-xs font-semibold text-rose">Записаться →</span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
