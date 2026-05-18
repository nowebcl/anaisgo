'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import CalendarSelector from '@/components/CalendarSelector';
import { 
  Lock, 
  Unlock, 
  Check, 
  Trash2, 
  User, 
  Calendar as CalendarIcon, 
  Clock, 
  AlertTriangle,
  LogOut,
  ShieldCheck,
  LockKeyhole,
  Info,
  Layers,
  ArrowLeft
} from 'lucide-react';

// 10 slots from reference app
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

interface DBAppointment {
  id: string;
  serviceId: string;
  customerName: string;
  customerAge: string;
  customerSex: 'Femenino' | 'Masculino' | 'Otro' | 'Prefiero no decir';
  customerRut: string;
  reason?: string;
  date: string;
  timeSlot: string;
  status: 'pending' | 'confirmed' | 'blocked';
  createdAt: string;
}

export default function AdminPortal() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Dashboard state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<DBAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [selectedAppt, setSelectedAppt] = useState<DBAppointment | null>(null);
  
  // Kill-switch slot blocker state
  const [blockSlotInput, setBlockSlotInput] = useState<string>('09:00');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Authentication check on load
  useEffect(() => {
    const auth = sessionStorage.getItem('anais_admin_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Listen to appointments for the selected date in real-time
  useEffect(() => {
    if (!isAuthenticated) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const q = query(collection(db, 'appointments'), where('date', '==', dateStr));

    setLoading(true);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const apptsList: DBAppointment[] = [];
        snapshot.forEach((docSnap) => {
          apptsList.push({ ...docSnap.data(), id: docSnap.id } as DBAppointment);
        });
        // Sort appointments by timeslot
        apptsList.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
        setAppointments(apptsList);
        setLoading(false);

        // Update modal reference if current appointment inside modal is updated
        if (selectedAppt) {
          const updatedAppt = apptsList.find((a) => a.id === selectedAppt.id);
          if (updatedAppt) {
            setSelectedAppt(updatedAppt);
          } else {
            setSelectedAppt(null); // Document was deleted (released)
          }
        }
      },
      (err) => {
        console.error('Error al escuchar citas de administrador:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedDate, isAuthenticated, selectedAppt]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: emailInput,
          password: passwordInput,
        }),
      });
      const data = await response.json();
      if (data.success) {
        sessionStorage.setItem('anais_admin_auth', 'true');
        setIsAuthenticated(true);
      } else {
        setLoginError('Credenciales incorrectas. Verifique el usuario o contraseña.');
      }
    } catch (err) {
      console.error('Error al iniciar sesión:', err);
      setLoginError('Ocurrió un error al intentar conectar con el servidor.');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('anais_admin_auth');
    setIsAuthenticated(false);
  };

  // Action: Confirm payment
  const handleConfirmPayment = async (apptId: string) => {
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'appointments', apptId), {
        status: 'confirmed',
      });
      showActionMessage('success', 'Pago confirmado correctamente en Firestore.');
    } catch (err) {
      console.error(err);
      showActionMessage('error', 'Error al confirmar el pago en la base de datos.');
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Delete appointment or release block
  const handleReleaseSlot = async (apptId: string) => {
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'appointments', apptId));
      setSelectedAppt(null);
      showActionMessage('success', 'Bloque horario liberado. Disponible al público al instante.');
    } catch (err) {
      console.error(err);
      showActionMessage('error', 'Error al liberar el bloque.');
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Create manual slot block (Kill-switch)
  const handleBlockSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const appointmentId = `${dateStr}_${blockSlotInput.replace(':', '')}`;

    // Verify if already occupied
    const isOccupied = appointments.some((a) => a.timeSlot === blockSlotInput);
    if (isOccupied) {
      showActionMessage('error', `El bloque de las ${blockSlotInput} ya está ocupado.`);
      setActionLoading(false);
      return;
    }

    const blockDoc: DBAppointment = {
      id: appointmentId,
      serviceId: 'presencial', // default
      customerName: 'BLOQUEADO POR ADMINISTRADOR',
      customerAge: 'N/A',
      customerSex: 'Prefiero no decir',
      customerRut: 'N/A',
      reason: 'Bloqueo manual de agenda por la psicóloga.',
      date: dateStr,
      timeSlot: blockSlotInput,
      status: 'blocked',
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'appointments', appointmentId), blockDoc);
      showActionMessage('success', `Bloque de las ${blockSlotInput} bloqueado manualmente.`);
    } catch (err) {
      console.error(err);
      showActionMessage('error', 'Error al bloquear el horario.');
    } finally {
      setActionLoading(false);
    }
  };

  const showActionMessage = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 4000);
  };

  const getServiceName = (id: string) => {
    switch (id) {
      case 'presencial':
        return 'Sesión Presencial';
      case 'online':
        return 'Sesión Online';
      default:
        return 'Sesión General';
    }
  };

  // LOGIN SCREEN
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-bg py-12 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full space-y-6 bg-[#FCFAF7] border border-warm-border rounded-3xl p-8 shadow-md"
        >
          <div className="text-center select-none">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gold-light text-gold mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-serif text-charcoal">
              Acceso Privado
            </h2>
            <p className="text-xs text-warm-muted mt-1 font-semibold tracking-wide">
              Panel Administrativo de Psicóloga
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-[10px] font-semibold flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="email" className="text-[10px] font-bold text-warm-muted uppercase tracking-wider block">
                Usuario
              </label>
              <input
                type="text"
                id="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="anais20"
                className="block w-full px-4 py-2.5 text-xs bg-warm-bg/25 border border-warm-border rounded-xl focus:outline-none focus:ring-gold/10"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-[10px] font-bold text-warm-muted uppercase tracking-wider block">
                Contraseña
              </label>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <LockKeyhole className="h-4 w-4 text-warm-muted" />
                </div>
                <input
                  type="password"
                  id="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="block w-full pl-9 pr-4 py-2.5 text-xs bg-warm-bg/25 border border-warm-border rounded-xl focus:outline-none focus:ring-gold/10"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center text-xs font-bold bg-charcoal hover:bg-charcoal-hover text-white py-3 rounded-xl transition-all shadow-md cursor-pointer"
            >
              Ingresar al Panel
            </button>
          </form>


          <div className="text-center pt-2">
            <a 
              href="/"
              className="inline-flex items-center text-[10px] font-bold text-gold-hover hover:underline"
            >
              <ArrowLeft className="w-3 h-3 mr-1" />
              Volver a agendamiento
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  // LOGGED-IN ADMIN PANEL
  return (
    <div className="min-h-screen bg-warm-bg py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full pb-20">
      {/* Admin Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#FCFAF7] border border-warm-border rounded-3xl p-6 shadow-sm mb-8 gap-4 select-none">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gold flex items-center justify-center text-white">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-serif text-charcoal font-normal tracking-tight">
              Portal Admin - Anaís <span className="shimmer-text italic font-normal">Rodríguez</span>
            </h1>
            <p className="text-[10px] text-warm-muted uppercase tracking-widest font-bold mt-0.5">Control de agenda y confirmación de pagos</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center text-[10px] font-bold text-rose-600 hover:text-rose-700 py-2.5 px-4 rounded-xl border border-rose-100 hover:bg-rose-50/40 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4 mr-1.5" />
          Cerrar Sesión
        </button>
      </header>

      {/* Operation notifications */}
      <AnimatePresence>
        {actionMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 border rounded-2xl mb-6 text-xs flex items-center space-x-3 shadow-sm ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <Check className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>{actionMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left column: Calendar & Kill-switch block */}
        <div className="lg:col-span-1 space-y-6">
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-widest font-bold text-warm-muted block">
              Calendario de Trabajo
            </span>
            <CalendarSelector selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          </div>

          {/* Kill-switch Block Selector Form */}
          <div className="bg-[#FCFAF7] border border-warm-border rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-charcoal font-serif flex items-center">
              <Lock className="w-4 h-4 mr-2 text-gold" />
              Bloquear Horario Manualmente
            </h3>
            <p className="text-[11px] text-warm-muted leading-relaxed">
              Inhabilita un bloque específico para bloquear la consulta. Pacientes en la web lo verán como no disponible de inmediato.
            </p>

            <form onSubmit={handleBlockSlot} className="flex gap-2">
              <select
                value={blockSlotInput}
                onChange={(e) => setBlockSlotInput(e.target.value)}
                className="flex-1 px-3 py-2 text-xs bg-warm-bg/35 border border-warm-border rounded-xl focus:outline-none focus:ring-gold/10"
              >
                {FIXED_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot} hrs
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold bg-charcoal hover:bg-charcoal-hover text-white rounded-xl transition-all shadow-md cursor-pointer"
              >
                Bloquear
              </button>
            </form>
          </div>
        </div>

        {/* Right column: Interactive real-time slot grid */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#FCFAF7] border border-warm-border rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-warm-border">
              <div>
                <h2 className="text-lg font-bold text-charcoal font-serif">
                  Agenda del {format(selectedDate, "d 'de' MMMM, yyyy", { locale: es })}
                </h2>
                <p className="text-[10px] text-warm-muted mt-0.5 uppercase tracking-wide font-semibold">Base de datos Firestore conectada</p>
              </div>
              <div className="text-[10px] font-bold text-gold-hover bg-gold-light/60 border border-gold/10 px-3.5 py-1.5 rounded-full">
                {appointments.length} Citas / Bloqueos
              </div>
            </div>

            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center space-y-2">
                <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-warm-muted">Escuchando base de datos...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {FIXED_SLOTS.map((slot) => {
                  const appointment = appointments.find((a) => a.timeSlot === slot);

                  // Colors by status
                  let borderClass = 'border-warm-border bg-white hover:border-gold/40';
                  let statusLabel = 'Disponible';
                  let statusBg = 'bg-warm-bg text-warm-muted border-warm-border/50';

                  if (appointment) {
                    if (appointment.status === 'confirmed') {
                      borderClass = 'border-emerald-600 bg-emerald-50/10 shadow-sm';
                      statusLabel = 'Confirmado (Pago OK)';
                      statusBg = 'bg-emerald-600 text-white border-transparent';
                    } else if (appointment.status === 'pending') {
                      borderClass = 'border-amber-500 bg-amber-50/10 shadow-sm';
                      statusLabel = 'Pendiente de Transferencia';
                      statusBg = 'bg-amber-500 text-white border-transparent';
                    } else if (appointment.status === 'blocked') {
                      borderClass = 'border-rose-400 bg-rose-50/5';
                      statusLabel = 'Bloqueado';
                      statusBg = 'bg-rose-500 text-white border-transparent';
                    }
                  }

                  return (
                    <motion.div
                      key={slot}
                      whileHover={{ y: -1 }}
                      onClick={() => appointment && setSelectedAppt(appointment)}
                      className={`border rounded-2xl p-4 transition-all duration-300 flex flex-col justify-between h-32 ${
                        appointment ? 'cursor-pointer' : 'cursor-default'
                      } ${borderClass}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            appointment?.status === 'confirmed' ? 'bg-emerald-100/50' :
                            appointment?.status === 'pending' ? 'bg-amber-100/50' :
                            appointment?.status === 'blocked' ? 'bg-rose-100/50' : 'bg-warm-bg'
                          }`}>
                            <Clock className={`w-4 h-4 ${
                              appointment?.status === 'confirmed' ? 'text-emerald-700' :
                              appointment?.status === 'pending' ? 'text-amber-700' :
                              appointment?.status === 'blocked' ? 'text-rose-700' : 'text-warm-muted'
                            }`} />
                          </div>
                          <span className="font-mono font-bold text-sm text-charcoal">{slot} hrs</span>
                        </div>

                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${statusBg}`}>
                          {statusLabel}
                        </span>
                      </div>

                      {appointment ? (
                        <div className="space-y-0.5 mt-2">
                          <span className="text-xs font-bold text-charcoal block truncate">
                            {appointment.customerName}
                          </span>
                          <span className="text-[10px] text-warm-muted block truncate">
                            {appointment.status === 'blocked' ? 'Bloqueo manual' : getServiceName(appointment.serviceId)}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center space-x-2 text-[10px] font-bold text-warm-muted">
                          <Unlock className="w-3.5 h-3.5 text-gold/60" />
                          <span>Horario Libre</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DETAIL MODAL FOR APPOINTMENTS & BLOCKS */}
      <AnimatePresence>
        {selectedAppt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-charcoal/30 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#FCFAF7] border border-warm-border rounded-2xl w-full max-w-lg overflow-hidden shadow-xl"
            >
              {/* Modal Header */}
              <div className={`p-6 text-white flex justify-between items-start ${
                selectedAppt.status === 'confirmed' ? 'bg-[#3D8C61]' :
                selectedAppt.status === 'pending' ? 'bg-amber-500' : 'bg-rose-500'
              }`}>
                <div>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold opacity-90">
                    Cita Registrada - {selectedAppt.timeSlot} hrs
                  </span>
                  <h3 className="text-lg font-serif mt-0.5">
                    {selectedAppt.status === 'blocked' ? 'Horario Inhabilitado' : 'Ficha del Paciente'}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedAppt(null)}
                  className="bg-white/10 hover:bg-white/20 rounded-lg w-7 h-7 flex items-center justify-center transition-colors cursor-pointer text-white font-bold"
                >
                  &times;
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                {selectedAppt.status === 'blocked' ? (
                  <div className="space-y-4 text-xs text-charcoal leading-relaxed">
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3 text-rose-800">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
                      <div>
                        <strong>Bloqueo Administrativo Activo:</strong> Este bloque horario se encuentra inaccesible para los pacientes en la web.
                      </div>
                    </div>
                    <p>
                      <strong>Nota de Bloqueo:</strong> {selectedAppt.reason}
                    </p>
                    <p className="text-[10px] text-warm-muted">
                      Bloqueado el: {format(new Date(selectedAppt.createdAt), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })} hrs
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Patient Contact card */}
                    <div className="bg-warm-bg/30 border border-warm-border rounded-xl p-4 space-y-2">
                      <div className="flex items-center space-x-3 text-xs">
                        <User className="w-4 h-4 text-gold flex-shrink-0" />
                        <div>
                          <span className="text-[9px] text-warm-muted font-semibold block">Paciente</span>
                          <span className="font-bold text-charcoal text-sm">{selectedAppt.customerName}</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 border-t border-warm-border/50 pt-2 mt-2 text-xs">
                        <div>
                          <span className="text-[9px] text-warm-muted font-semibold block">RUT</span>
                          <span className="font-mono font-bold text-charcoal">{selectedAppt.customerRut}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-warm-muted font-semibold block">Edad</span>
                          <span className="font-bold text-charcoal">{selectedAppt.customerAge} años</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-warm-muted font-semibold block">Sexo</span>
                          <span className="font-bold text-charcoal">{selectedAppt.customerSex}</span>
                        </div>
                      </div>
                    </div>

                    {/* Booking metadata */}
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="bg-white border border-warm-border rounded-xl p-3">
                        <span className="text-[9px] text-warm-muted font-semibold block">Modalidad</span>
                        <span className="font-bold text-charcoal mt-1 block">
                          {getServiceName(selectedAppt.serviceId)}
                        </span>
                      </div>
                      <div className="bg-white border border-warm-border rounded-xl p-3">
                        <span className="text-[9px] text-warm-muted font-semibold block">ID de Cita</span>
                        <span className="font-mono font-bold text-charcoal mt-1 block select-all">
                          {selectedAppt.id}
                        </span>
                      </div>
                    </div>

                    {/* Reason */}
                    {selectedAppt.reason && (
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-warm-muted uppercase tracking-wider block">
                          Motivo de Consulta
                        </span>
                        <p className="text-xs bg-warm-bg/25 border border-warm-border rounded-xl p-3 text-charcoal leading-relaxed max-h-24 overflow-y-auto">
                          {selectedAppt.reason}
                        </p>
                      </div>
                    )}

                    <p className="text-[10px] text-warm-muted text-right">
                      Agendado el: {format(new Date(selectedAppt.createdAt), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })} hrs
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="bg-warm-bg/40 p-6 border-t border-warm-border flex flex-col sm:flex-row justify-end gap-3 select-none">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleReleaseSlot(selectedAppt.id)}
                  className="flex items-center justify-center text-xs font-bold text-rose-600 hover:text-rose-700 bg-white py-2.5 px-4 rounded-xl border border-rose-100 hover:bg-rose-50 transition-all shadow-sm cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  {selectedAppt.status === 'blocked' ? 'Liberar Bloqueo' : 'Liberar Horario'}
                </button>

                {selectedAppt.status === 'pending' && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleConfirmPayment(selectedAppt.id)}
                    className="flex items-center justify-center text-xs font-bold bg-charcoal hover:bg-charcoal-hover text-white py-2.5 px-5 rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    <Check className="w-4 h-4 mr-1.5" />
                    Confirmar Transferencia
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedAppt(null)}
                  className="flex items-center justify-center text-xs font-bold text-charcoal bg-white hover:bg-gold-light/20 py-2.5 px-4 rounded-xl border border-warm-border transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
