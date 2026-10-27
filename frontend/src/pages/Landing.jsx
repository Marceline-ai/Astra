import { useEffect, useState } from 'react';
import Header from '../components/Header.jsx';
import Hero from '../components/Hero.jsx';
import About from '../components/About.jsx';
import Services from '../components/Services.jsx';
import Masters from '../components/Masters.jsx';
import BookingForm from '../components/BookingForm.jsx';
import Footer from '../components/Footer.jsx';
import MobileStickyBar from '../components/MobileStickyBar.jsx';
import { api } from '../api.js';

export default function Landing() {
  const [categories, setCategories] = useState([]);
  const [masters, setMasters] = useState([]);

  useEffect(() => {
    api.categories().then(setCategories).catch(() => {});
    api.masters().then(setMasters).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen pb-16 lg:pb-0">
      <Header />
      <main>
        <Hero />
        <About />
        <Services categories={categories} />
        <Masters masters={masters} />
        <section id="booking" className="scroll-mt-24 px-5 py-16 md:px-10 lg:py-28 max-w-[1240px] mx-auto">
          <h2 className="font-serif text-3xl md:text-5xl text-center mb-3 lg:mb-10">Онлайн-запись</h2>
          <p className="text-muted text-center mb-8 lg:mb-12 text-sm md:text-base">
            Выберите услугу, мастера и свободное время — мы свяжемся с вами для подтверждения.
          </p>
          <BookingForm />
        </section>
      </main>
      <Footer />
      <MobileStickyBar />
    </div>
  );
}
