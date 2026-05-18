import { z } from 'zod';

export type ServiceId = 'presencial' | 'online';
export type AppointmentStatus = 'pending' | 'confirmed' | 'blocked';

export interface Service {
  id: ServiceId;
  name: string;
  description: string;
  duration: number; // in minutes
  price: number; // in CLP
}

export interface Appointment {
  id: string;
  serviceId: ServiceId;
  customerName: string;
  customerAge: string;
  customerSex: 'Femenino' | 'Masculino' | 'Otro' | 'Prefiero no decir';
  customerRut: string;
  reason?: string;
  date: string; // ISO Format 'YYYY-MM-DD'
  timeSlot: string; // e.g. "10:00"
  status: AppointmentStatus;
  createdAt: string; // ISO Timestamp
}

// Zod schema for paciente booking form validation matching reference app
export const bookingFormSchema = z.object({
  customerName: z
    .string()
    .min(3, { message: 'Nombre muy corto' })
    .max(100, { message: 'El nombre es demasiado largo' })
    .trim(),
  customerAge: z
    .string()
    .min(1, { message: 'Edad requerida' })
    .trim(),
  customerSex: z.enum(['Femenino', 'Masculino', 'Otro', 'Prefiero no decir'], {
    message: 'Seleccione un sexo',
  }),
  customerRut: z
    .string()
    .min(8, { message: 'RUT incompleto' })
    .trim(),
  reason: z
    .string()
    .max(500, { message: 'El motivo no puede superar los 500 caracteres' })
    .optional()
    .or(z.literal('')),
});

export type BookingFormData = z.infer<typeof bookingFormSchema>;
