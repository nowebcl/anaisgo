'use client';

import { useState, useEffect } from 'react';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Service, ServiceId, bookingFormSchema, BookingFormData } from '@/types/booking';
import ServiceSelector from '@/components/ServiceSelector';
import CalendarSelector from '@/components/CalendarSelector';
import TimeSlotGrid from '@/components/TimeSlotGrid';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { 
  Calendar as CalendarIcon, 
  User as UserIcon, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Download, 
  AlertCircle, 
  Phone,
  Mail,
  Heart,
  MessageSquare,
  ShieldAlert
} from 'lucide-react';

type Step = 'booking' | 'success';

export default function PatientPortal() {
  const [currentStep, setCurrentStep] = useState<Step>('booking');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    customerName: '',
    customerAge: '',
    customerSex: 'Femenino' as 'Femenino' | 'Masculino' | 'Otro' | 'Prefiero no decir',
    customerRut: '',
    reason: '',
  });

  // Validation Errors
  const [errors, setErrors] = useState<Partial<Record<keyof BookingFormData | 'rutMatematica', string>>>({});
  
  // App State
  const [loading, setLoading] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Auto select Presencial modality on load
  const handleSelectService = (service: Service) => {
    setSelectedService(service);
  };

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    setSelectedTimeSlot(null); // Reset timeslot on date change
  };

  const handleSelectTimeSlot = (slot: string) => {
    setSelectedTimeSlot(slot);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear validation error when typing
    if (errors[name as keyof BookingFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  // Chilean RUT input mask handler
  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    // Clean to digits and K/k
    let clean = rawVal.replace(/[^0-9kK]/g, '');
    if (clean.length > 9) clean = clean.slice(0, 9);
    
    let formatted = '';
    if (clean.length > 0) {
      if (clean.length === 1) {
        formatted = clean;
      } else {
        const dv = clean.slice(-1);
        const body = clean.slice(0, -1);
        const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        formatted = `${formattedBody}-${dv.toLowerCase()}`;
      }
    }
    
    setFormData((prev) => ({ ...prev, customerRut: formatted }));
    
    // Clear RUT errors
    if (errors.customerRut || errors.rutMatematica) {
      setErrors((prev) => ({ 
        ...prev, 
        customerRut: undefined, 
        rutMatematica: undefined 
      }));
    }
  };

  // Chilean RUT module-11 mathematical validation
  const validateChileanRut = (rut: string): boolean => {
    const cleanRut = rut.replace(/\./g, '').replace(/-/g, '').trim();
    if (cleanRut.length < 8) return false;
    
    const body = cleanRut.slice(0, -1);
    const dv = cleanRut.slice(-1).toUpperCase();
    
    if (!/^\d+$/.test(body)) return false;
    
    let sum = 0;
    let multiplier = 2;
    for (let i = body.length - 1; i >= 0; i--) {
      sum += parseInt(body[i]) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }
    
    const expectedDv = 11 - (sum % 11);
    let expectedDvStr = '';
    if (expectedDv === 11) expectedDvStr = '0';
    else if (expectedDv === 10) expectedDvStr = 'K';
    else expectedDvStr = expectedDv.toString();
    
    return dv === expectedDvStr;
  };

  // Zod and mathematical RUT validation before submitting
  const validateForm = () => {
    const result = bookingFormSchema.safeParse(formData);
    const fieldErrors: Partial<Record<keyof BookingFormData | 'rutMatematica', string>> = {};
    
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as keyof BookingFormData;
        fieldErrors[path] = issue.message;
      });
    }

    // Mathematical RUT validation
    if (formData.customerRut) {
      const isRutValid = validateChileanRut(formData.customerRut);
      if (!isRutValid) {
        fieldErrors.rutMatematica = 'RUT inválido';
      }
    } else {
      fieldErrors.customerRut = 'RUT requerido';
    }

    setErrors(fieldErrors);
    return Object.keys(fieldErrors).length === 0;
  };

  // WhatsApp redirection helper
  const redirectToWhatsApp = (bookingCode: string, dateStr: string, timeStr: string) => {
    if (!selectedService) return;
    
    const formattedDate = format(new Date(dateStr + 'T00:00:00'), "EEEE d 'de' MMMM yyyy", { locale: es });
    
    const message = `Hola Anaís, agendé una sesión.
Código de Reserva: *${bookingCode}*
------------------------------------
*Paciente:* ${formData.customerName}
*RUT:* ${formData.customerRut}
*Edad:* ${formData.customerAge} años
*Sexo:* ${formData.customerSex}
*Modalidad:* Sesión ${selectedService.name}
*Fecha:* ${formattedDate}
*Hora:* ${timeStr} hrs
*Valor:* $${selectedService.price.toLocaleString('es-CL')} CLP
------------------------------------
Adjunto mis datos para confirmación.`;

    const encodedMsg = encodeURIComponent(message);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=56974954412&text=${encodedMsg}`;
    window.open(whatsappUrl, '_blank');
  };

  // Generate backup text receipt
  const downloadReceipt = (bookingCode: string, dateStr: string, timeStr: string) => {
    if (!selectedService) return;

    const receiptContent = `=====================================================
            COMPROBANTE DE AGENDAMIENTO
                 ANAÍS AGENDAMIENTO
=====================================================

CÓDIGO DE RESERVA: ${bookingCode}
ESTADO: PENDIENTE DE CONFIRMACIÓN VÍA WHATSAPP

-----------------------------------------------------
DETALLES DEL AGENDAMIENTO:
-----------------------------------------------------
Modalidad: Sesión ${selectedService.name}
Duración: ${selectedService.duration} minutos
Valor: $${selectedService.price.toLocaleString('es-CL')} CLP

-----------------------------------------------------
FECHA Y HORA:
-----------------------------------------------------
Fecha: ${format(new Date(dateStr + 'T00:00:00'), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
Bloque Horario: ${timeStr} hrs

-----------------------------------------------------
DATOS DEL PACIENTE:
-----------------------------------------------------
Nombre Completo: ${formData.customerName}
R.U.T: ${formData.customerRut}
Edad: ${formData.customerAge} años
Sexo: ${formData.customerSex}
Motivo de Consulta: ${formData.reason || 'No especificado'}

-----------------------------------------------------
⚠️ PASO OBLIGATORIO FINAL:
-----------------------------------------------------
Para consolidar definitivamente su bloque, debe enviar
el comprobante de su reserva vía WhatsApp presionando
el botón de la pantalla o abriendo el siguiente link
en su navegador:
https://api.whatsapp.com/send?phone=56974954412

¡Gracias por iniciar este camino de bienestar!
=====================================================`;

    const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Comprobante_Anais_${bookingCode}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedService) {
      setSubmissionError('Por favor, selecciona una modalidad (Presencial u Online).');
      return;
    }
    if (!selectedDate) {
      setSubmissionError('Por favor, selecciona una fecha en el calendario.');
      return;
    }
    if (!selectedTimeSlot) {
      setSubmissionError('Por favor, selecciona un bloque horario.');
      return;
    }
    
    if (!validateForm()) return;

    setLoading(true);
    setSubmissionError(null);

    const bookingCode = 'ANAIS-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const appointmentId = `${dateStr}_${selectedTimeSlot.replace(':', '')}`;

    const newAppointment = {
      id: appointmentId,
      serviceId: selectedService.id,
      customerName: formData.customerName,
      customerAge: formData.customerAge,
      customerSex: formData.customerSex,
      customerRut: formData.customerRut,
      reason: formData.reason || '',
      date: dateStr,
      timeSlot: selectedTimeSlot,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    };

    try {
      // Secure the timeslot instantly in Firestore
      await setDoc(doc(db, 'appointments', appointmentId), newAppointment);
      
      setGeneratedCode(bookingCode);
      setIsFormOpen(false);
      setCurrentStep('success');
      
      // Fire confetti celebration
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#B89568', '#F4EFE6', '#201F1D', '#3D8C61']
      });

      // Auto redirect to WhatsApp
      redirectToWhatsApp(bookingCode, dateStr, selectedTimeSlot);

    } catch (err) {
      console.error('Error al guardar reserva:', err);
      setSubmissionError('Lo sentimos, este bloque horario acaba de ser ocupado por otro paciente. Por favor, selecciona otra hora.');
      setSelectedTimeSlot(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full pb-28">
      {/* Header Area styled Playfair display editor style with premium animations */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="text-center mb-8 select-none"
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="inline-flex items-center space-x-1.5 bg-gold-light text-gold-hover px-3.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider mb-3"
        >
          <Heart className="w-3 h-3 fill-gold text-gold animate-pulse" />
          <span>Psicología Clínica</span>
        </motion.div>
        
        <motion.h1 
          whileHover={{ scale: 1.015 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className="text-4xl sm:text-5xl font-serif text-charcoal font-normal tracking-tight cursor-default"
        >
          Anaís <span className="shimmer-text italic font-normal">Rodríguez</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-[10px] uppercase tracking-widest font-bold text-warm-muted mt-1.5"
        >
          Agendamiento de Sesiones
        </motion.p>
      </motion.header>

      {/* Main Form Area */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {currentStep === 'booking' && (
            <motion.form
              onSubmit={handleBookingSubmit}
              key="booking-flow"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              {submissionError && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center space-x-3 text-xs max-w-2xl mx-auto">
                  <AlertCircle className="w-4.5 h-4.5 text-rose-600 flex-shrink-0" />
                  <span>{submissionError}</span>
                </div>
              )}

              {/* 1. Modalidad Selector */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-widest font-bold text-warm-muted block">
                  1. Seleccione Modalidad
                </span>
                <ServiceSelector 
                  selectedServiceId={selectedService?.id || null} 
                  onSelectService={handleSelectService} 
                />
              </div>

              {/* 2. Calendario y Horarios (PC Estático / Móvil Dinámico) */}
              <div className="flex flex-col md:grid md:grid-cols-2 gap-6 items-start">
                {/* 2a. Seleccione Fecha */}
                <div className={`space-y-2 w-full transition-all duration-300 ${
                  selectedService 
                    ? 'block animate-fade-in' 
                    : 'hidden md:block'
                }`}>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-warm-muted block">
                    2. Seleccione Fecha
                  </span>
                  <CalendarSelector 
                    selectedDate={selectedDate} 
                    onSelectDate={(date) => {
                      handleSelectDate(date);
                      // Auto scroll down slightly on mobile to show the time slots appearing
                      if (typeof window !== 'undefined' && window.innerWidth < 768) {
                        setTimeout(() => {
                          window.scrollTo({
                            top: window.scrollY + 200,
                            behavior: 'smooth'
                          });
                        }, 350);
                      }
                    }} 
                  />
                </div>

                {/* 2b. Seleccione Hora */}
                <div className={`space-y-2 w-full transition-all duration-300 ${
                  selectedService && selectedDate 
                    ? 'block animate-fade-in' 
                    : 'hidden md:block'
                }`}>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-warm-muted block">
                    3. Seleccione Hora
                  </span>
                  {selectedDate ? (
                    <TimeSlotGrid
                      selectedDate={selectedDate}
                      selectedTimeSlot={selectedTimeSlot}
                      onSelectTimeSlot={(slot) => {
                        handleSelectTimeSlot(slot);
                        // Auto scroll slightly down on mobile to reveal the sticky "Agendar" button
                        if (typeof window !== 'undefined' && window.innerWidth < 768) {
                          setTimeout(() => {
                            window.scrollTo({
                              top: document.body.scrollHeight,
                              behavior: 'smooth'
                            });
                          }, 300);
                        }
                      }}
                    />
                  ) : (
                    <div className="h-[250px] rounded-2xl border border-dashed border-warm-border flex flex-col items-center justify-center text-center p-6 bg-[#FCFAF7]/50 select-none">
                      <CalendarIcon className="w-8 h-8 text-warm-border/60 mb-2" />
                      <p className="text-xs font-semibold text-charcoal/80">Calendario requerido</p>
                      <p className="text-[10px] text-warm-muted mt-0.5">Por favor, marca un día en el calendario de la izquierda.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Float Action Pill Button at Sticky Bottom to trigger data popup */}
              {selectedService && selectedDate && selectedTimeSlot && (
                <div className="fixed bottom-6 left-0 right-0 z-40 px-4 flex justify-center">
                  <motion.button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsFormOpen(true);
                    }}
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full max-w-md bg-charcoal hover:bg-charcoal-hover text-white py-3.5 px-6 rounded-full font-bold flex justify-between items-center shadow-lg transition-all cursor-pointer"
                  >
                    <span className="text-sm font-extrabold tracking-wide">
                      ${selectedService.price.toLocaleString('es-CL')} CLP
                    </span>
                    <span className="text-[10px] uppercase tracking-widest font-bold flex items-center">
                      Agendar
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </span>
                  </motion.button>
                </div>
              )}

              {/* PATIENT DATA OVERLAY MODAL */}
              <AnimatePresence>
                {isFormOpen && selectedService && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/50 backdrop-blur-sm">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 15 }}
                      className="bg-[#FCFAF7] border border-warm-border rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
                    >
                      {/* Modal Header */}
                      <div className="p-5 pb-3 flex justify-between items-center border-b border-warm-border/50 bg-[#FCFAF7] sticky top-0 z-10">
                        <div>
                          <span className="text-[9px] uppercase tracking-widest font-extrabold text-gold block">Paso Final</span>
                          <h3 className="text-lg font-serif text-charcoal">Ficha de Contacto Paciente</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsFormOpen(false)}
                          className="w-8 h-8 rounded-full bg-warm-bg/50 text-charcoal hover:bg-warm-bg flex items-center justify-center font-serif text-xl cursor-pointer transition-colors"
                        >
                          &times;
                        </button>
                      </div>

                      {/* Modal Body */}
                      <div className="p-6 overflow-y-auto space-y-4">
                        {/* Name Input */}
                        <div className="space-y-1">
                          <label htmlFor="customerName" className="text-[10px] font-bold text-warm-muted uppercase tracking-wider block">
                            Nombre Completo del Paciente
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <UserIcon className="h-4 w-4 text-warm-border" />
                            </div>
                            <input
                              type="text"
                              name="customerName"
                              id="customerName"
                              required
                              value={formData.customerName}
                              onChange={handleInputChange}
                              placeholder="Ej: Ana María"
                              className={`block w-full pl-9 pr-4 py-2 text-xs bg-warm-bg/25 border rounded-xl focus:outline-none ${
                                errors.customerName 
                                  ? 'border-rose-300 focus:ring-rose-500/10' 
                                  : 'border-warm-border focus:ring-gold/10'
                              }`}
                            />
                          </div>
                          {errors.customerName && (
                            <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.customerName}</p>
                          )}
                        </div>

                        {/* Age, Sex, and RUT Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {/* Age */}
                          <div className="space-y-1">
                            <label htmlFor="customerAge" className="text-[10px] font-bold text-warm-muted uppercase tracking-wider block">
                              Edad
                            </label>
                            <input
                              type="text"
                              name="customerAge"
                              id="customerAge"
                              required
                              value={formData.customerAge}
                              onChange={handleInputChange}
                              placeholder="Ej: 30"
                              className={`block w-full px-3.5 py-2 text-xs bg-warm-bg/25 border rounded-xl focus:outline-none ${
                                errors.customerAge 
                                  ? 'border-rose-300 focus:ring-rose-500/10' 
                                  : 'border-warm-border focus:ring-gold/10'
                              }`}
                            />
                            {errors.customerAge && (
                              <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.customerAge}</p>
                            )}
                          </div>

                          {/* Sex */}
                          <div className="space-y-1">
                            <label htmlFor="customerSex" className="text-[10px] font-bold text-warm-muted uppercase tracking-wider block">
                              Sexo
                            </label>
                            <select
                              name="customerSex"
                              id="customerSex"
                              value={formData.customerSex}
                              onChange={handleInputChange}
                              className="block w-full px-3 py-2 text-xs bg-warm-bg/25 border border-warm-border rounded-xl focus:outline-none focus:ring-gold/10"
                            >
                              <option value="Femenino">Femenino</option>
                              <option value="Masculino">Masculino</option>
                              <option value="Otro">Otro</option>
                              <option value="Prefiero no decir">Prefiero no decir</option>
                            </select>
                          </div>

                          {/* RUT */}
                          <div className="space-y-1">
                            <label htmlFor="customerRut" className="text-[10px] font-bold text-warm-muted uppercase tracking-wider block">
                              RUT (12.345.678-9)
                            </label>
                            <input
                              type="text"
                              name="customerRut"
                              id="customerRut"
                              required
                              value={formData.customerRut}
                              onChange={handleRutChange}
                              placeholder="Ej: 12.345.678-9"
                              className={`block w-full px-3.5 py-2 text-xs bg-warm-bg/25 border rounded-xl focus:outline-none ${
                                errors.customerRut || errors.rutMatematica
                                  ? 'border-rose-300 focus:ring-rose-500/10' 
                                  : 'border-warm-border focus:ring-gold/10'
                              }`}
                            />
                            {(errors.customerRut || errors.rutMatematica) && (
                              <p className="text-[10px] text-rose-500 font-semibold mt-0.5">
                                {errors.customerRut || errors.rutMatematica}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Reason Text Area */}
                        <div className="space-y-1">
                          <label htmlFor="reason" className="text-[10px] font-bold text-warm-muted uppercase tracking-wider block">
                            Motivo de Consulta (Opcional)
                          </label>
                          <textarea
                            name="reason"
                            id="reason"
                            rows={2}
                            value={formData.reason}
                            onChange={handleInputChange}
                            placeholder="Breve motivo por el cual agendas..."
                            className="block w-full px-3 py-2 text-xs bg-warm-bg/25 border border-warm-border rounded-xl focus:outline-none focus:ring-gold/10 min-h-[60px]"
                          />
                          {errors.reason && (
                            <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{errors.reason}</p>
                          )}
                        </div>
                      </div>

                      {/* Modal Footer (Triggers actual booking submit) */}
                      <div className="bg-warm-bg/30 p-5 border-t border-warm-border/60 sticky bottom-0">
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full bg-charcoal hover:bg-charcoal-hover text-white py-3.5 px-6 rounded-full font-bold flex justify-between items-center shadow-lg transition-all cursor-pointer"
                        >
                          {loading ? (
                            <div className="w-full flex justify-center items-center">
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : (
                            <>
                              <span className="text-sm font-extrabold tracking-wide">
                                ${selectedService.price.toLocaleString('es-CL')} CLP
                              </span>
                              <span className="text-[10px] uppercase tracking-widest font-bold flex items-center">
                                Confirmar Reserva
                                <ArrowRight className="w-4 h-4 ml-1.5" />
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.form>
          )}

          {/* STEP 2: SUCCESS AND WHATSAPP MODAL SCREEN */}
          {currentStep === 'success' && selectedService && selectedDate && selectedTimeSlot && (
            <motion.div
              key="step-success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto text-center bg-[#FCFAF7] border border-warm-border rounded-2xl p-8 shadow-md relative"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold-light text-gold mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <h2 className="text-2xl font-serif text-charcoal">Cita Agendada con Éxito</h2>
              <p className="text-[11px] text-warm-muted mt-1 leading-relaxed">
                Su bloque horario ha sido reservado y bloqueado en la base de datos de la psicóloga.
              </p>

              {/* Booking Code Banner */}
              <div className="my-5 bg-gold-light border border-gold/20 rounded-xl p-3 select-all">
                <span className="text-[9px] text-warm-muted font-semibold uppercase tracking-wider block">Código Único de Cita</span>
                <span className="text-lg font-mono font-extrabold text-gold-hover tracking-widest mt-0.5 block">
                  {generatedCode}
                </span>
              </div>

              {/* Confirmation Details Card */}
              <div className="text-left bg-warm-bg/30 border border-warm-border rounded-xl p-4 text-[11px] space-y-2 mb-5 leading-normal">
                <div className="flex justify-between border-b border-warm-border/50 pb-1">
                  <span className="text-warm-muted">Paciente:</span>
                  <span className="font-bold text-charcoal">{formData.customerName}</span>
                </div>
                <div className="flex justify-between border-b border-warm-border/50 pb-1">
                  <span className="text-warm-muted">Modalidad:</span>
                  <span className="font-bold text-charcoal">Sesión {selectedService.name}</span>
                </div>
                <div className="flex justify-between border-b border-warm-border/50 pb-1">
                  <span className="text-warm-muted">Fecha:</span>
                  <span className="font-bold text-charcoal capitalize">
                    {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                  </span>
                </div>
                <div className="flex justify-between border-b border-warm-border/50 pb-1">
                  <span className="text-warm-muted">Hora:</span>
                  <span className="font-bold text-charcoal">{selectedTimeSlot} hrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-warm-muted">Inversión:</span>
                  <span className="font-extrabold text-gold-hover">${selectedService.price.toLocaleString('es-CL')} CLP</span>
                </div>
              </div>

              {/* WhatsApp Redirection Banner */}
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-xl p-4 text-[11px] text-left flex items-start space-x-2.5 mb-5 leading-relaxed">
                <ShieldAlert className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-0.5 text-emerald-900">⚠️ Validar Reserva vía WhatsApp:</span>
                  Hemos intentado redirigirte a WhatsApp. Si el popup fue bloqueado, por favor presiona el botón inferior para abrir el chat de confirmación obligatoria.
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => redirectToWhatsApp(generatedCode, format(selectedDate, 'yyyy-MM-dd'), selectedTimeSlot)}
                  className="w-full flex items-center justify-center text-xs font-bold bg-[#25D366] hover:bg-[#20ba5a] text-white py-3 rounded-xl transition-all shadow-md cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4 mr-2 fill-white" />
                  Abrir Chat de WhatsApp
                </button>

                <button
                  type="button"
                  onClick={() => downloadReceipt(generatedCode, format(selectedDate, 'yyyy-MM-dd'), selectedTimeSlot)}
                  className="w-full flex items-center justify-center text-xs font-bold bg-charcoal hover:bg-charcoal-hover text-white py-3 rounded-xl transition-all shadow-md cursor-pointer"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar Comprobante .TXT
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedService(null);
                    setSelectedDate(null);
                    setSelectedTimeSlot(null);
                    setFormData({
                      customerName: '',
                      customerAge: '',
                      customerSex: 'Femenino',
                      customerRut: '',
                      reason: '',
                    });
                    setGeneratedCode('');
                    setIsFormOpen(false);
                    setCurrentStep('booking');
                  }}
                  className="w-full text-[10px] font-bold text-gold-hover hover:text-gold hover:underline py-2 block text-center cursor-pointer"
                >
                  Agendar otra hora
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer styled elegantly */}
      <footer className="text-center text-[10px] text-warm-muted mt-8 pt-4 border-t border-warm-border">
        <p>&copy; {new Date().getFullYear()} Anaís Rodríguez | Consulta Psicológica. Todos los derechos reservados.</p>
        <p className="mt-0.5 opacity-85">Consulta física en Puerto Montt. Atención online vía telemedicina de alta seguridad.</p>
        <p className="mt-1 opacity-75">
          Desarrollado por{' '}
          <a 
            href="https://www.noweb.cl" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:underline hover:text-gold-hover transition-colors duration-200 font-medium"
          >
            noweb labs
          </a>
        </p>
      </footer>
    </div>
  );
}
