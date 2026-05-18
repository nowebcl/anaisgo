'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Clock, Lock, Check } from 'lucide-react';

interface TimeSlotGridProps {
  selectedDate: Date;
  selectedTimeSlot: string | null;
  onSelectTimeSlot: (slot: string) => void;
}

// 10 exact slots from reference app
const FIXED_SLOTS = [
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
];

export default function TimeSlotGrid({
  selectedDate,
  selectedTimeSlot,
  onSelectTimeSlot,
}: TimeSlotGridProps) {
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const appointmentsRef = collection(db, 'appointments');
    const q = query(appointmentsRef, where('date', '==', dateStr));

    setLoading(true);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const booked: string[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.timeSlot && ['pending', 'confirmed', 'blocked'].includes(data.status)) {
            booked.push(data.timeSlot);
          }
        });
        setBookedSlots(booked);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error al escuchar slots:', err);
        setError('Error al conectar con la base de datos.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedDate]);

  if (loading) {
    return (
      <div className="space-y-3">
        <h5 className="text-xs font-bold text-warm-muted uppercase tracking-wider flex items-center">
          <Clock className="w-3.5 h-3.5 mr-2 animate-spin text-gold" />
          Cargando horas...
        </h5>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {FIXED_SLOTS.map((slot) => (
            <div
              key={slot}
              className="h-10 rounded-xl bg-warm-card border border-warm-border p-2 animate-pulse flex justify-center items-center"
            >
              <div className="w-8 h-3 bg-warm-bg rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h5 className="text-[10px] font-bold text-warm-muted uppercase tracking-widest flex items-center">
          <Clock className="w-3.5 h-3.5 mr-1.5 text-gold" />
          Horas disponibles para el {format(selectedDate, "d 'de' MMMM", { locale: es })}
        </h5>
        {error && (
          <span className="text-[9px] text-rose-500 font-medium">{error}</span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {FIXED_SLOTS.map((slot) => {
          const isBooked = bookedSlots.includes(slot);
          const isSelected = selectedTimeSlot === slot;

          return (
            <motion.button
              key={slot}
              type="button"
              disabled={isBooked}
              whileHover={!isBooked ? { y: -1 } : {}}
              whileTap={!isBooked ? { scale: 0.98 } : {}}
              onClick={() => onSelectTimeSlot(slot)}
              className={`h-11 rounded-xl border text-xs font-bold transition-all duration-300 flex items-center justify-between px-3 ${
                isSelected
                  ? 'border-charcoal bg-charcoal text-white shadow-sm'
                  : isBooked
                  ? 'border-warm-border bg-warm-bg/30 text-warm-border/50 line-through cursor-not-allowed'
                  : 'border-warm-border bg-white text-charcoal hover:border-gold hover:bg-gold-light/20'
              }`}
            >
              <span className="tracking-wide">{slot}</span>
              
              <div className="flex items-center">
                {isSelected ? (
                  <Check className="w-3 h-3 text-white" />
                ) : isBooked ? (
                  <Lock className="w-2.5 h-2.5 text-warm-border/50" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-gold-light border border-gold/40" />
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
