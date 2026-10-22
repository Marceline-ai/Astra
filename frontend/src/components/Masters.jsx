const FALLBACK = ['/assets/master-elena-rossi.png', '/assets/master-marcus-thorne.png', '/assets/master-sarah-jenkins.png'];

export default function Masters({ masters }) {
  return (
    <section id="masters" className="scroll-mt-20 bg-white border-y border-line px-5 md:px-10 py-16 lg:py-28">
      <div className="max-w-[1240px] mx-auto">
        <p className="text-rose font-semibold uppercase tracking-[0.2em] text-xs mb-4 text-center">Команда</p>
        <h2 className="font-serif text-3xl lg:text-5xl text-center mb-10 lg:mb-14">Наши мастера</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl lg:max-w-none mx-auto">
          {masters.map((m, i) => (
            <article key={m.id} className="card overflow-hidden group">
              <div className="aspect-square overflow-hidden">
                <img
                  src={m.photo_url || FALLBACK[i % 3]}
                  alt={`${m.firstname} ${m.lastname} — ${m.speciality || 'мастер салона Astra'}`}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
              </div>
              <div className="p-5 text-center">
                <h3 className="font-serif text-xl">{m.firstname} {m.lastname}</h3>
                <p className="text-sm text-muted mt-1">{m.speciality}</p>
                {Number(m.rating_avg) > 0 && (
                  <p className="text-xs mt-2 text-rose font-semibold">★ {Number(m.rating_avg).toFixed(1)}</p>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
