'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Service, ServiceId } from '@/types/booking';
import { motion } from 'framer-motion';
import { MapPin, Video, Check } from 'lucide-react';

interface ServiceSelectorProps {
  selectedServiceId: ServiceId | null;
  onSelectService: (service: Service) => void;
}

const DEFAULT_SERVICES: Service[] = [
  {
    id: 'presencial',
    name: 'Presencial',
    description: 'Atención presencial en consulta física.',
    duration: 60,
    price: 25000,
  },
  {
    id: 'online',
    name: 'Online',
    description: 'Atención telemática en videollamada de alta seguridad.',
    duration: 60,
    price: 20000,
  },
];

export default function ServiceSelector({
  selectedServiceId,
  onSelectService,
}: ServiceSelectorProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadServices() {
      try {
        setLoading(true);
        const querySnapshot = await getDocs(collection(db, 'services'));
        
        if (querySnapshot.empty) {
          console.log('Sembrando modalidades por defecto en Firestore...');
          const seedPromises = DEFAULT_SERVICES.map((service) =>
            setDoc(doc(db, 'services', service.id), service)
          );
          await Promise.all(seedPromises);
          setServices(DEFAULT_SERVICES);
        } else {
          const loadedServices: Service[] = [];
          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            // Map legacy individual/pareja/evaluacion services to fallback online/presencial to avoid breaking the DB
            if (['presencial', 'online'].includes(docSnap.id)) {
              loadedServices.push(data as Service);
            }
          });

          if (loadedServices.length === 0) {
            // Seed anyway if only legacy services are found
            const seedPromises = DEFAULT_SERVICES.map((service) =>
              setDoc(doc(db, 'services', service.id), service)
            );
            await Promise.all(seedPromises);
            setServices(DEFAULT_SERVICES);
          } else {
            // Order them
            const orderedServices = DEFAULT_SERVICES.map(
              (def) => loadedServices.find((s) => s.id === def.id) || def
            );
            setServices(orderedServices);
          }
        }
      } catch (err) {
        console.error('Error al cargar modalidades:', err);
        setError('Cargando modalidades locales...');
        setServices(DEFAULT_SERVICES);
      } finally {
        setLoading(false);
      }
    }

    loadServices();
  }, []);

  const getIcon = (id: ServiceId) => {
    switch (id) {
      case 'presencial':
        return <MapPin className="w-5 h-5 text-gold" />;
      case 'online':
        return <Video className="w-5 h-5 text-gold" />;
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-20 rounded-2xl border border-warm-border bg-warm-card/50 p-4 animate-pulse flex items-center justify-between"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-warm-border" />
              <div className="space-y-2">
                <div className="w-20 h-4 bg-warm-border rounded" />
                <div className="w-32 h-3 bg-warm-border rounded" />
              </div>
            </div>
            <div className="w-16 h-5 bg-warm-border rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-[10px] text-warm-muted text-center italic">{error}</p>
      )}

      <div className="flex flex-row md:grid md:grid-cols-2 gap-4 overflow-x-auto snap-x scroll-smooth pb-3 px-4 md:px-0 -mx-4 md:mx-0 select-none no-scrollbar">
        {services.map((service) => {
          const isSelected = selectedServiceId === service.id;
          return (
            <motion.div
              key={service.id}
              whileHover={{ y: -1, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onSelectService(service)}
              className={`cursor-pointer rounded-2xl border p-4 grid grid-cols-[1fr_auto] gap-3 items-start transition-all duration-300 flex-shrink-0 w-[85%] md:w-auto snap-start ${
                isSelected
                  ? 'border-gold bg-white shadow-sm gold-glow ring-2 ring-gold/10'
                  : 'border-warm-border bg-white hover:border-gold/50'
              }`}
            >
              <div className="flex items-start space-x-3 min-w-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  isSelected ? 'bg-gold-light' : 'bg-warm-bg/50'
                }`}>
                  {getIcon(service.id)}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-charcoal tracking-tight">
                    {service.name}
                  </h4>
                  <p className="text-[10px] sm:text-[11px] text-warm-muted leading-relaxed mt-0.5 break-words">
                    {service.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 text-right flex-shrink-0 mt-0.5 justify-end">
                <span className="text-sm font-bold text-charcoal">
                  ${service.price.toLocaleString('es-CL')}
                </span>
                
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all flex-shrink-0 ${
                  isSelected ? 'border-gold bg-gold text-white' : 'border-warm-border bg-transparent'
                }`}>
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
