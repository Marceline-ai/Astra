export default function Footer() {
  return (
    <footer id="contacts" className="bg-ink text-white px-5 md:px-10 py-14 lg:py-20 scroll-mt-20">
      <div className="max-w-[1240px] mx-auto grid md:grid-cols-3 gap-10">
        <div>
          <p className="font-serif text-3xl mb-3">Astra<span className="text-rose">.</span></p>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs">
            Салон красоты премиум-класса. Записывайтесь онлайн или звоните — мы всегда рады гостям.
          </p>
        </div>
        <div>
          <a
            href="tel:+79991234567"
            className="inline-flex items-center justify-center w-full rounded-2xl bg-rose hover:bg-rosedark transition text-white font-semibold text-lg lg:text-xl px-6 py-5"
          >
            📞 +7 (999) 123-45-67
          </a>
          <div className="flex gap-4 mt-4 text-sm text-white/70">
            <a href="#" className="hover:text-rose transition">Instagram</a>
            <a href="#" className="hover:text-rose transition">Telegram</a>
            <a href="#" className="hover:text-rose transition">WhatsApp</a>
            <a href="#" className="hover:text-rose transition">ВКонтакте</a>
          </div>
        </div>
        <div className="text-sm text-white/70 space-y-2">
          <p className="text-white font-semibold uppercase tracking-wide text-xs">Контакты</p>
          <p>г. Москва, ул. Тверская, 12</p>
          <p>Пн–Пт: 09:00 – 21:00</p>
          <p>Сб–Вс: 10:00 – 20:00</p>
          <p>hello@astra-beauty.ru</p>
        </div>
      </div>
      <div className="max-w-[1240px] mx-auto mt-12 pt-6 border-t border-white/10 text-xs text-white/40 flex flex-wrap justify-between gap-3">
        <p>© 2026 Салон красоты «Astra»</p>
        <a href="/admin/login" className="hover:text-white transition">Вход для сотрудников</a>
      </div>
    </footer>
  );
}
