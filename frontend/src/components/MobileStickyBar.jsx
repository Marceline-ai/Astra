export default function MobileStickyBar() {
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur border-t border-line px-4 py-3 flex gap-3 safe-bottom">
      <a href="#booking" className="btn-primary flex-1 !px-4 !py-3 text-sm">Записаться</a>
      <a
        href="tel:+79991234567"
        aria-label="Позвонить в салон"
        className="w-12 h-12 shrink-0 grid place-items-center rounded-full bg-rose text-white text-xl"
      >
        ☎
      </a>
    </div>
  );
}
