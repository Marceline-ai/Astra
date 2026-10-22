import { useState } from 'react';

const links = [
  { href: '#services', label: 'Услуги' },
  { href: '#masters', label: 'Мастера' },
  { href: '#booking', label: 'Записаться' },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 bg-cream/90 backdrop-blur border-b border-line">
      <div className="max-w-[1240px] mx-auto px-5 md:px-10 h-16 lg:h-20 flex items-center justify-between">
        <a href="#" className="font-serif text-2xl lg:text-3xl tracking-wide">
          Astra<span className="text-rose">.</span>
        </a>
        <nav className="hidden lg:flex items-center gap-10 text-sm font-medium text-ink/80">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-rose transition">{l.label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a href="#booking" className="btn-primary hidden sm:inline-flex !px-6 !py-2.5 text-sm">
            Записаться
          </a>
          <button
            aria-label="Меню"
            onClick={() => setOpen(!open)}
            className="lg:hidden w-10 h-10 grid place-items-center rounded-full border border-line bg-white"
          >
            <span className="block w-5 h-5 relative">
              <span className={`absolute left-0 right-0 h-0.5 bg-ink transition-all ${open ? 'top-1/2 rotate-45 -translate-y-1/2' : 'top-0.5'}`} />
              {!open && <span className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-0.5 bg-ink" />}
              <span className={`absolute left-0 right-0 h-0.5 bg-ink transition-all ${open ? 'top-1/2 -rotate-45 -translate-y-1/2' : 'bottom-0.5'}`} />
            </span>
          </button>
        </div>
      </div>
      {open && (
        <nav className="lg:hidden border-t border-line bg-white px-5 py-4 flex flex-col gap-4 text-sm font-medium">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-1">{l.label}</a>
          ))}
          <a href="#booking" onClick={() => setOpen(false)} className="btn-rose mt-1">Записаться</a>
        </nav>
      )}
    </header>
  );
}
