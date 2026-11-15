import { DateTime } from 'luxon';
import { prisma } from './prisma-client.js';
import { withProviderLock } from './provider-lock.js';
import { config } from '../config/config.js';
import { maskEmail } from '../api/logger.js';
import { PRIVACY_POLICY_VERSION } from '../../portal/privacy-policy.js';
import {
  Prisma,
  AppointmentStatus,
  BookingRequestKind,
  BookingRequestStatus,
  CancelledBy,
  Channel,
  ConsentKind,
  MeetingStatus,
  PatientStatus,
  RecordSource,
  Relationship,
  RelationshipStatus,
  ReminderMode,
  ReminderStatus,
  Sex,
  SubsystemType,
} from '../../../generated/prisma/client.ts';

/**
 * Complete mock clinical data for the existing provider account below: profile, availability,
 * appointment types and locations, patients (portal and provider sourced), medical records with
 * family genograms and evolution notes, appointments in the past and future, reminders for past
 * visits, booking requests in every state, and blocked time.
 *
 * Every row has a deterministic id. Re-running the script removes only those ids and writes them
 * again, so real data in the same account is left untouched. Future reminders and booking holds are
 * not queued for sending: nothing reaches a real patient. Contacts use example.com and +57 300 0000 numbers.
 *
 * Refuses to run when NODE_ENV resolves to production (unset NODE_ENV counts as production).
 */
const TARGET_EMAIL = 'admin@patientnova.net';
const TZ = 'America/Bogota';
const DAY_MS = 24 * 60 * 60 * 1000;

const PROFILE = {
  jobTitle: 'Psicóloga clínica',
  specialty: 'Psicología clínica y sistémica',
  bio: 'Acompañamiento psicológico para adultos, parejas y familias, con enfoque sistémico y un cuidado estricto de la confidencialidad.',
  publicPhone: '+573000000100',
  publicWhatsapp: '+573000000100',
  bankName: 'Banco Demo',
  accountNumber: '0000000000',
  nationalId: '1000000000',
  bankingKey: 'demo-banking-key',
} as const;

const G = {
  patient: '0a7a0001',
  record: '0a7a0002',
  appointment: '0a7a0003',
  request: '0a7a0004',
  type: '0a7a0005',
  location: '0a7a0006',
  blocked: '0a7a0007',
  reminder: '0a7a0008',
  family: '0a7a0009',
  note: '0a7a000a',
  subsystem: '0a7a000b',
} as const;

const uuid = (group: string, n: number) => `${group}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const patientId = (i: number) => uuid(G.patient, i + 1);

/** Index into a seed list that must exist; fails loudly instead of yielding undefined. */
function at<T>(list: readonly T[], index: number): T {
  const value = list[index];
  if (value === undefined) throw new Error(`Seed index ${index} is out of range`);
  return value;
}

const TYPES = {
  initial: { id: uuid(G.type, 1), name: 'Consulta inicial', defaultDuration: 60, defaultPrice: 150000 },
  followUp: { id: uuid(G.type, 2), name: 'Sesión de seguimiento', defaultDuration: 50, defaultPrice: 120000 },
  virtual: { id: uuid(G.type, 3), name: 'Sesión virtual', defaultDuration: 50, defaultPrice: 110000 },
} as const;

const LOCATIONS = {
  office: { id: uuid(G.location, 1), name: 'Consultorio Chapinero', address: 'Calle 63 # 10-40, consultorio 302', isVirtual: false },
  virtual: { id: uuid(G.location, 2), name: 'Videollamada', address: null, isVirtual: true },
} as const;

interface PatientSeed {
  first: string;
  last: string;
  sex: Sex;
  birth: [number, number, number];
  birthPlace: string;
  nationalId: string;
  email: string;
  whatsapp?: string;
  sms?: string;
  reminder: Channel;
  source: RecordSource;
  whatsappUnverified?: boolean;
  inactive?: boolean;
  deleted?: boolean;
  notes: string;
}

const PATIENTS: PatientSeed[] = [
  { first: 'Laura', last: 'Gómez Rojas', sex: Sex.FEMALE, birth: [1986, 3, 14], birthPlace: 'Medellín', nationalId: '1020301001', email: 'laura.gomez@example.com', whatsapp: '+573000000001', reminder: Channel.WHATSAPP, source: RecordSource.PROVIDER, notes: 'Consulta por ansiedad laboral. Prefiere citas en la mañana.' },
  { first: 'Mateo', last: 'Herrera Pardo', sex: Sex.MALE, birth: [1991, 7, 2], birthPlace: 'Bogotá', nationalId: '1020301002', email: 'mateo.herrera@example.com', whatsapp: '+573000000002', reminder: Channel.EMAIL, source: RecordSource.PROVIDER, notes: 'Proceso de duelo por la separación reciente.' },
  { first: 'Valentina', last: 'Cruz Mejía', sex: Sex.FEMALE, birth: [1998, 11, 22], birthPlace: 'Cali', nationalId: '1020301003', email: 'valentina.cruz@example.com', whatsapp: '+573000000003', reminder: Channel.WHATSAPP, source: RecordSource.PORTAL, notes: 'Llegó desde el portal de citas.' },
  { first: 'Santiago', last: 'Rey Ocampo', sex: Sex.MALE, birth: [1979, 5, 30], birthPlace: 'Pereira', nationalId: '1020301004', email: 'santiago.rey@example.com', whatsapp: '+573000000004', reminder: Channel.WHATSAPP, source: RecordSource.PROVIDER, notes: 'Dificultades de comunicación con su pareja.' },
  { first: 'Daniela', last: 'Ruiz Vélez', sex: Sex.FEMALE, birth: [1984, 9, 9], birthPlace: 'Bucaramanga', nationalId: '1020301005', email: 'daniela.ruiz@example.com', whatsapp: '+573000000005', reminder: Channel.EMAIL, source: RecordSource.PROVIDER, notes: 'Consulta familiar. Participan la pareja y los dos hijos.' },
  { first: 'Felipe', last: 'Castaño Gil', sex: Sex.MALE, birth: [2012, 2, 18], birthPlace: 'Medellín', nationalId: '1020301006', email: 'familia.castano@example.com', whatsapp: '+573000000006', reminder: Channel.WHATSAPP, source: RecordSource.PROVIDER, notes: 'Consulta familiar. Contacto de la madre para la agenda.' },
  { first: 'Isabel', last: 'Montoya Díaz', sex: Sex.FEMALE, birth: [1995, 4, 27], birthPlace: 'Bogotá', nationalId: '1020301007', email: 'isabel.montoya@example.com', whatsapp: '+573000000007', sms: '+573000000008', reminder: Channel.SMS, source: RecordSource.PROVIDER, notes: '' },
  { first: 'Andrea', last: 'Salazar Peña', sex: Sex.FEMALE, birth: [1990, 12, 1], birthPlace: 'Manizales', nationalId: '1020301008', email: 'andrea.salazar@example.com', whatsapp: '+573000000009', whatsappUnverified: true, reminder: Channel.EMAIL, source: RecordSource.PORTAL, notes: 'Número escrito en el formulario de reserva; sin verificar.' },
  { first: 'Julián', last: 'Ortiz Quintero', sex: Sex.MALE, birth: [1982, 8, 15], birthPlace: 'Cartagena', nationalId: '1020301009', email: 'julian.ortiz@example.com', whatsapp: '+573000000010', reminder: Channel.WHATSAPP, source: RecordSource.PROVIDER, notes: '' },
  { first: 'Paula', last: 'Estrada Luna', sex: Sex.FEMALE, birth: [1993, 6, 5], birthPlace: 'Barranquilla', nationalId: '1020301010', email: 'paula.estrada@example.com', whatsapp: '+573000000011', reminder: Channel.EMAIL, source: RecordSource.PROVIDER, inactive: true, notes: 'Tratamiento finalizado; pendiente de reactivación.' },
  { first: 'Ricardo', last: 'Vargas Soto', sex: Sex.MALE, birth: [1975, 1, 19], birthPlace: 'Ibagué', nationalId: '1020301011', email: 'ricardo.vargas@example.com', whatsapp: '+573000000012', reminder: Channel.WHATSAPP, source: RecordSource.PROVIDER, deleted: true, notes: 'Registro eliminado por solicitud del paciente.' },
  { first: 'Mariana', last: 'Londoño Arias', sex: Sex.FEMALE, birth: [2001, 10, 10], birthPlace: 'Medellín', nationalId: '1020301012', email: 'mariana.londono@example.com', whatsapp: '+573000000013', reminder: Channel.WHATSAPP, source: RecordSource.PORTAL, notes: 'Llegó desde el portal de citas.' },
];

const contactOf = (p: PatientSeed): string => {
  if (p.reminder === Channel.EMAIL) return p.email;
  if (p.reminder === Channel.SMS) return p.sms ?? p.email;
  return p.whatsapp ?? p.email;
};

const RECORDS = [
  { consultationReason: 'Ansiedad asociada a la carga laboral y dificultad para desconectarse fuera del horario de trabajo.', earlyDevelopment: 'Sin complicaciones reportadas; hitos motores y de lenguaje dentro del rango esperado.', schoolAndWork: 'Ingeniera de sistemas, con jornadas extendidas.', lifestyleHabits: 'Sueño irregular, actividad física ocasional.', traumaticEvents: 'Ninguno reportado en la historia inicial.', emotionalConsiderations: 'Preocupación anticipatoria y tensión muscular.', physicalConsiderations: 'Cefaleas tensionales ocasionales.', mentalHistory: 'Sin antecedentes psiquiátricos previos.', objective: 'Reducir síntomas de ansiedad y mejorar límites laborales.', familyObservations: 'Apoyo constante de la madre; padre fallecido hace cinco años.' },
  { consultationReason: 'Proceso de duelo tras la separación de la pareja, con aislamiento social y bajo ánimo.', earlyDevelopment: 'Desarrollo típico; infancia estable.', schoolAndWork: 'Abogado, en transición a un nuevo empleo.', lifestyleHabits: 'Consumo social de alcohol los fines de semana.', traumaticEvents: 'Separación conyugal hace cuatro meses.', emotionalConsiderations: 'Tristeza, rumiación y sentimientos de culpa.', physicalConsiderations: 'Insomnio de conciliación.', mentalHistory: 'Un episodio depresivo leve hace seis años, sin tratamiento.', objective: 'Elaborar la pérdida y recuperar la red de apoyo.', familyObservations: 'Familia de origen extensa y cercana.' },
  { consultationReason: 'Ataques de pánico recurrentes en el transporte público.', earlyDevelopment: 'Sin hallazgos relevantes.', schoolAndWork: 'Diseñadora gráfica, trabajo independiente.', lifestyleHabits: 'Actividad física tres veces por semana.', traumaticEvents: 'Asalto en transporte público hace un año.', emotionalConsiderations: 'Evitación de espacios cerrados y temor a perder el control.', physicalConsiderations: 'Palpitaciones durante los episodios.', mentalHistory: 'Sin antecedentes previos.', objective: 'Disminuir la frecuencia de los ataques y recuperar la movilidad.', familyObservations: 'Hermana mayor con apoyo activo.' },
  { consultationReason: 'Dificultades de comunicación con la pareja y conflictos recurrentes por la crianza.', earlyDevelopment: 'Desarrollo sin novedades.', schoolAndWork: 'Docente universitario.', lifestyleHabits: 'Horarios de trabajo flexibles.', traumaticEvents: 'Ninguno reportado.', emotionalConsiderations: 'Frustración y sensación de no ser escuchado.', physicalConsiderations: 'Sin hallazgos.', mentalHistory: 'Sin antecedentes.', objective: 'Mejorar la comunicación y acordar pautas de crianza.', familyObservations: 'Dos hijos pequeños; apoyo de los abuelos paternos.' },
  { consultationReason: 'Consulta familiar por conflictos frecuentes entre los adultos y los hijos adolescentes.', earlyDevelopment: 'Desarrollo típico de los hijos; sin antecedentes relevantes.', schoolAndWork: 'Contadora; los hijos asisten a colegio.', lifestyleHabits: 'Rutina familiar con poco tiempo compartido.', traumaticEvents: 'Mudanza reciente desde otra ciudad.', emotionalConsiderations: 'Tensión y cansancio en la pareja.', physicalConsiderations: 'Sin hallazgos.', mentalHistory: 'Sin antecedentes psiquiátricos.', objective: 'Acordar normas compartidas y mejorar la comunicación familiar.', familyObservations: 'Familia de origen en otra ciudad; contacto por videollamada.', isFamily: true, familyType: 'Nuclear con hijos adolescentes', lifecycle: 'Adolescencia de los hijos', genogram: 'Tres generaciones; relación cercana con la línea materna.', resources: 'Red de apoyo extensa y buena comunicación en la pareja.', difficulties: 'Conflictos por normas y horarios.', communication: 'Tono elevado en momentos de tensión.', rule: 'Normas poco consensuadas entre los adultos.', limits: 'Límites difusos entre el subsistema parental y el filial.', familyContext: 'Mudanza reciente a la ciudad.', expectations: 'Acordar normas claras y compartidas.', flexibility: 'Disposición al cambio, con resistencia puntual.' },
  { consultationReason: 'Consulta familiar por bajo rendimiento escolar y dificultades de conducta del hijo menor.', earlyDevelopment: 'Retraso leve en el lenguaje resuelto a los cuatro años.', schoolAndWork: 'Estudiante de bachillerato; padre comerciante.', lifestyleHabits: 'Pantallas en horario nocturno.', traumaticEvents: 'Ninguno reportado.', emotionalConsiderations: 'Irritabilidad y baja tolerancia a la frustración.', physicalConsiderations: 'Sin hallazgos.', mentalHistory: 'Sin antecedentes.', objective: 'Establecer rutinas y mejorar la relación padres-hijo.', familyObservations: 'Madre a cargo del día a día; padre con horarios extensos.', isFamily: true, familyType: 'Nuclear monoparental extendida', lifecycle: 'Edad escolar del hijo', genogram: 'Familia materna con abuela presente.', resources: 'Abuela materna que colabora con el cuidado.', difficulties: 'Desacuerdos sobre disciplina entre los padres.', communication: 'Mensajes indirectos y críticas.', rule: 'Reglas cambiantes según el humor de los adultos.', limits: 'Jerarquía poco clara en las decisiones.', familyContext: 'Separación de los padres hace tres años.', expectations: 'Coherencia en las normas y rutinas.', flexibility: 'Alta en la madre; baja en el padre.' },
];

const FAMILY_MEMBERS: { record: number; name: string; sex: Sex; age: string; relationship: Relationship; relation: string }[] = [
  { record: 4, name: 'Esteban Ruiz', sex: Sex.MALE, age: '45', relationship: Relationship.SPOUSE, relation: 'Pareja de la consultante' },
  { record: 4, name: 'Sara Ruiz', sex: Sex.FEMALE, age: '16', relationship: Relationship.DAUGHTER, relation: 'Hija adolescente' },
  { record: 4, name: 'Tomás Ruiz', sex: Sex.MALE, age: '13', relationship: Relationship.SON, relation: 'Hijo menor' },
  { record: 5, name: 'Gloria Gil', sex: Sex.FEMALE, age: '41', relationship: Relationship.MOTHER, relation: 'Madre del consultante' },
  { record: 5, name: 'Julián Castaño', sex: Sex.MALE, age: '44', relationship: Relationship.FATHER, relation: 'Padre del consultante' },
];

const SUBSYSTEMS: { record: number; subsystem: SubsystemType; status: RelationshipStatus; observation: string }[] = [
  { record: 4, subsystem: SubsystemType.CONJUGAL, status: RelationshipStatus.FUNCIONAL, observation: 'Buena complicidad; conflictos puntuales por la crianza.' },
  { record: 4, subsystem: SubsystemType.PARENTAL, status: RelationshipStatus.DISFUNCIONAL_LIMITES, observation: 'Los adultos ceden con frecuencia ante los hijos.' },
  { record: 4, subsystem: SubsystemType.FILIAL, status: RelationshipStatus.DISFUNCIONAL_COMUNICACION, observation: 'Mensajes indirectos entre la hija y la madre.' },
  { record: 5, subsystem: SubsystemType.PARENTAL, status: RelationshipStatus.DISFUNCIONAL_JERARQUIA, observation: 'La abuela toma decisiones que corresponden a los padres.' },
  { record: 5, subsystem: SubsystemType.FRATERNAL, status: RelationshipStatus.FUNCIONAL, observation: 'Hermanos sin conflictos relevantes.' },
];

const NOTES = [
  'Sesión centrada en la ansiedad anticipatoria. Se practicó respiración diafragmática y se revisó el registro de situaciones de la semana.',
  'Se abordaron conflictos de pareja a partir de un episodio reciente. Se acordó un ejercicio de escucha activa para la próxima sesión.',
  'La consultante reporta mejor descanso y menos cefaleas. Se trabajó la planeación de límites en el trabajo.',
  'Revisión de avances del proceso. Se identificaron patrones de evitación y se propusieron exposiciones graduales.',
];

const DURATION_OF = (type: { defaultDuration: number }) => type.defaultDuration;

async function seedData() {
  if (config.env === 'production') {
    throw new Error('Refusing to seed mock data: NODE_ENV resolves to production. Set NODE_ENV=development for a local database.');
  }

  const now = DateTime.now();
  const nowDate = now.toJSDate();
  const today = now.setZone(TZ).startOf('day');

  const dayOf = (offset: number): DateTime => {
    let day = today.plus({ days: offset });
    const step = offset < 0 ? -1 : 1;
    while (day.weekday > 5) day = day.plus({ days: step });
    return day;
  };
  const atHour = (day: DateTime, hour: number, minute = 0): Date =>
    day.set({ hour, minute, second: 0, millisecond: 0 }).toJSDate();
  const calendarDay = (dt: DateTime): Date => new Date(Date.UTC(dt.year, dt.month - 1, dt.day));
  const daysAgo = (n: number): Date => new Date(nowDate.getTime() - n * DAY_MS);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { email: TARGET_EMAIL }, select: { id: true } });
    if (!user) {
      throw new Error(`No user with email ${TARGET_EMAIL}. Create it first (db:seed-admin).`);
    }
    const userId = user.id;
    // Project rule: lock the provider before writing appointments or blocked time.
    await withProviderLock(tx, userId);

    const patientIds = PATIENTS.map((_, i) => patientId(i));
    const requestIds = Array.from({ length: 8 }, (_, i) => uuid(G.request, i + 1));
    const blockedIds = Array.from({ length: 6 }, (_, i) => uuid(G.blocked, i + 1));
    const typeIds = Object.values(TYPES).map((t) => t.id);
    const locationIds = Object.values(LOCATIONS).map((l) => l.id);

    // Clean up previously seeded mock rows only, in dependency order.
    await tx.patientConsent.deleteMany({ where: { patientId: { in: patientIds } } });
    await tx.bookingRequest.deleteMany({ where: { userId, id: { in: requestIds } } });
    await tx.blockedTime.deleteMany({ where: { userId, id: { in: blockedIds } } });
    await tx.patient.deleteMany({ where: { userId, id: { in: patientIds } } });
    await tx.appointmentType.deleteMany({ where: { userId, id: { in: typeIds } } });
    await tx.appointmentLocation.deleteMany({ where: { userId, id: { in: locationIds } } });
    await tx.availabilityRule.deleteMany({ where: { userId } });

    await tx.user.update({
      where: { id: userId },
      data: PROFILE,
    });

    await tx.availabilityRule.createMany({
      data: [1, 2, 3, 4, 5].map((weekday) => ({ userId, weekday, startMinute: 8 * 60, endMinute: 18 * 60 }))
        .concat([{ userId, weekday: 6, startMinute: 8 * 60, endMinute: 12 * 60 }]),
    });

    await tx.appointmentType.createMany({
      data: [
        { id: TYPES.initial.id, userId, name: TYPES.initial.name, defaultDuration: 60, defaultPrice: TYPES.initial.defaultPrice, color: '#2563eb' },
        { id: TYPES.followUp.id, userId, name: TYPES.followUp.name, defaultDuration: 50, defaultPrice: TYPES.followUp.defaultPrice, color: '#059669' },
        { id: TYPES.virtual.id, userId, name: TYPES.virtual.name, defaultDuration: 50, defaultPrice: TYPES.virtual.defaultPrice, color: '#7c3aed' },
      ],
    });
    await tx.appointmentLocation.createMany({
      data: [
        { id: LOCATIONS.office.id, userId, name: LOCATIONS.office.name, address: LOCATIONS.office.address, isVirtual: false, color: '#0ea5e9' },
        { id: LOCATIONS.virtual.id, userId, name: LOCATIONS.virtual.name, address: null, isVirtual: true, color: '#a855f7' },
      ],
    });

    await tx.patient.createMany({
      data: PATIENTS.map((p, i) => ({
        id: patientId(i),
        userId,
        name: p.first,
        lastName: p.last,
        email: p.email,
        whatsappNumber: p.whatsapp ?? null,
        smsNumber: p.sms ?? null,
        whatsappUnverified: p.whatsappUnverified ?? false,
        reminderChannel: p.reminder,
        source: p.source,
        status: p.inactive ? PatientStatus.INACTIVE : PatientStatus.ACTIVE,
        isDeleted: p.deleted ?? false,
        deletedAt: p.deleted ? daysAgo(20) : null,
        notes: p.notes || null,
        appointmentTypeId: p.deleted ? null : TYPES.initial.id,
      })),
    });

    await tx.patientConsent.createMany({
      data: PATIENTS.flatMap((p, i) =>
        p.source === RecordSource.PORTAL
          ? [{
            patientId: patientId(i),
            userId,
            kind: ConsentKind.DATA_PROCESSING,
            policyVersion: PRIVACY_POLICY_VERSION,
            acceptedAt: daysAgo(20),
          }]
          : [],
      ),
    });

    // Medical records (one per patient for the first six), family members, subsystems, and notes.
    await tx.medicalRecord.createMany({
      data: RECORDS.map((r, i) => {
        const p = at(PATIENTS, i);
        return {
          id: uuid(G.record, i + 1),
          patientId: patientId(i),
          name: `${p.first} ${p.last}`,
          nationalId: p.nationalId,
          sex: p.sex,
          birthDate: calendarDay(DateTime.fromObject({ year: p.birth[0], month: p.birth[1], day: p.birth[2] })),
          birthPlace: p.birthPlace,
          ...r,
          isFamily: 'isFamily' in r ? r.isFamily : false,
        };
      }),
    });

    await tx.familyMember.createMany({
      data: FAMILY_MEMBERS.map((m, n) => ({
        id: uuid(G.family, n + 1),
        medicalRecordId: uuid(G.record, m.record + 1),
        name: m.name,
        sex: m.sex,
        age: m.age,
        relationship: m.relationship,
        relation: m.relation,
      })),
    });
    await tx.subsystemRelation.createMany({
      data: SUBSYSTEMS.map((s, n) => ({
        id: uuid(G.subsystem, n + 1),
        medicalRecordId: uuid(G.record, s.record + 1),
        subsystem: s.subsystem,
        status: s.status,
        observation: s.observation,
      })),
    });

    // Appointments: a 9:00 initial visit and a 15:00 follow-up each weekday, with gaps.
    const appointmentRows: Prisma.AppointmentCreateManyInput[] = [];
    const reminderRows: Prisma.ReminderCreateManyInput[] = [];
    const completedByPatient = new Map<number, Date[]>();
    const activePatients = PATIENTS.map((_, i) => i).filter((i) => !at(PATIENTS, i).deleted);
    let k = 0;
    let rr = 0;

    for (let off = -84; off <= 35; off++) {
      const day = today.plus({ days: off });
      if (day.weekday > 5 || (off + 100) % 4 === 0) continue;

      for (const hour of [9, 15]) {
        k += 1;
        const isVirtual = hour === 15 && k % 5 === 0;
        const type = hour === 9 ? TYPES.initial : isVirtual ? TYPES.virtual : TYPES.followUp;
        const location = isVirtual ? LOCATIONS.virtual : LOCATIONS.office;
        const pIdx = at(activePatients, rr % activePatients.length);
        rr += 1;
        const p = at(PATIENTS, pIdx);

        const start = atHour(day, hour);
        const end = new Date(start.getTime() + DURATION_OF(type) * 60_000);
        const isPast = start.getTime() < nowDate.getTime();
        const id = uuid(G.appointment, k);

        let status: AppointmentStatus = AppointmentStatus.SCHEDULED;
        let cancelledAt: Date | null = null;
        let cancelledBy: CancelledBy | null = null;
        let completedAt: Date | null = null;
        let confirmedAt: Date | null = null;

        if (isPast) {
          if (k % 11 === 5) {
            status = AppointmentStatus.CANCELLED;
            cancelledBy = k % 2 ? CancelledBy.PATIENT : CancelledBy.PROVIDER;
            cancelledAt = new Date(start.getTime() - DAY_MS);
          } else if (k % 17 === 8) {
            status = AppointmentStatus.NO_SHOW;
            confirmedAt = new Date(start.getTime() - 2 * DAY_MS);
          } else {
            status = AppointmentStatus.COMPLETED;
            completedAt = end;
            confirmedAt = new Date(start.getTime() - 2 * DAY_MS);
            const list = completedByPatient.get(pIdx) ?? [];
            list.push(start);
            completedByPatient.set(pIdx, list);
          }
        } else if (k % 5 === 0) {
          status = AppointmentStatus.SCHEDULED;
        } else {
          status = AppointmentStatus.CONFIRMED;
          confirmedAt = daysAgo(2);
        }

        appointmentRows.push({
          id,
          userId,
          patientId: patientId(pIdx),
          typeId: type.id,
          locationId: location.id,
          startAt: start,
          endAt: end,
          price: type.defaultPrice,
          paid: status === AppointmentStatus.COMPLETED && k % 3 !== 0,
          status,
          confirmedAt,
          cancelledAt,
          cancelledBy,
          completedAt,
          source: p.source,
          meetingUrl: isVirtual ? `https://example.com/meet/demo-${k}` : null,
          meetingStatus: isVirtual ? MeetingStatus.READY : MeetingStatus.NOT_REQUIRED,
          notes: k % 6 === 0 ? 'Traer el registro de actividades de la semana.' : k % 9 === 0 ? 'Revisar avances del ejercicio de respiración.' : null,
        });

        if (status === AppointmentStatus.COMPLETED && k % 2 === 0) {
          reminderRows.push({
            id: uuid(G.reminder, k),
            userId,
            patientId: patientId(pIdx),
            appointmentId: id,
            channel: p.reminder,
            to: contactOf(p),
            status: ReminderStatus.SENT,
            sendMode: ReminderMode.SCHEDULED,
            sendAt: new Date(start.getTime() - DAY_MS),
            sentAt: new Date(start.getTime() - DAY_MS),
          });
        }
        if (status === AppointmentStatus.CANCELLED && k % 4 === 0) {
          reminderRows.push({
            id: uuid(G.reminder, k),
            userId,
            patientId: patientId(pIdx),
            appointmentId: id,
            channel: p.reminder,
            to: contactOf(p),
            status: ReminderStatus.CANCELLED,
            sendMode: ReminderMode.SCHEDULED,
            sendAt: new Date(start.getTime() - DAY_MS),
          });
        }
      }
    }

    // Booking requests. Pending holds are nudged already so the sweep never messages anyone.
    const holdFor = (start: Date) => new Date(Math.min(nowDate.getTime() + 48 * 60 * 60 * 1000, start.getTime()));
    const approvedAppointments: Prisma.AppointmentCreateManyInput[] = [];

    type RequestSpec = {
      n: number;
      day: number;
      hour: number;
      type: { id: string; defaultDuration: number; defaultPrice: number };
      channel: Channel;
      first: string;
      last: string;
      email?: string;
      phone?: string;
      status: BookingRequestStatus;
      kind: BookingRequestKind;
      patientIdx?: number;
      resolvedAt?: Date;
      resolvedBy?: string;
      holdExpiresAt?: Date;
      confirmedAt?: Date;
      approvedAppointmentN?: number;
    };

    const specs: RequestSpec[] = [
      { n: 1, day: 3, hour: 11, type: TYPES.initial, channel: Channel.EMAIL, first: 'Sofía', last: 'Torres Medina', email: 'sofia.torres@example.com', status: BookingRequestStatus.PENDING, kind: BookingRequestKind.NEW },
      { n: 2, day: 6, hour: 16, type: TYPES.followUp, channel: Channel.WHATSAPP, first: 'Andrés', last: 'Villa Osorio', phone: '+573000000021', status: BookingRequestStatus.PENDING, kind: BookingRequestKind.NEW },
      { n: 3, day: 9, hour: 11, type: TYPES.initial, channel: Channel.EMAIL, first: 'Camila', last: 'Ospina Restrepo', email: 'camila.ospina@example.com', status: BookingRequestStatus.PENDING, kind: BookingRequestKind.REVIEW },
      { n: 4, day: 12, hour: 11, type: TYPES.initial, channel: Channel.EMAIL, first: 'Valentina', last: 'Cruz Mejía', email: at(PATIENTS, 2).email, status: BookingRequestStatus.APPROVED, kind: BookingRequestKind.NEW, patientIdx: 2, resolvedAt: daysAgo(1), resolvedBy: userId, approvedAppointmentN: 1 },
      { n: 5, day: 19, hour: 10, type: TYPES.followUp, channel: Channel.EMAIL, first: 'Mariana', last: 'Londoño Arias', email: at(PATIENTS, 11).email, status: BookingRequestStatus.APPROVED, kind: BookingRequestKind.NEW, patientIdx: 11, resolvedAt: daysAgo(2), resolvedBy: userId, approvedAppointmentN: 2 },
      { n: 6, day: -6, hour: 11, type: TYPES.initial, channel: Channel.EMAIL, first: 'Jorge', last: 'Parra Ardila', email: 'jorge.parra@example.com', status: BookingRequestStatus.REJECTED, kind: BookingRequestKind.NEW, resolvedAt: daysAgo(6), resolvedBy: userId },
      { n: 7, day: -10, hour: 16, type: TYPES.virtual, channel: Channel.WHATSAPP, first: 'Lucía', last: 'Pérez Gaitán', phone: '+573000000022', status: BookingRequestStatus.EXPIRED, kind: BookingRequestKind.NEW, resolvedBy: 'system' },
      { n: 8, day: 26, hour: 16, type: TYPES.followUp, channel: Channel.EMAIL, first: 'Tomás', last: 'Rincón Lara', email: 'tomas.rincon@example.com', status: BookingRequestStatus.CANCELLED, kind: BookingRequestKind.NEW, resolvedAt: daysAgo(2), resolvedBy: 'patient' },
    ];

    const requestRows: Prisma.BookingRequestCreateManyInput[] = specs.map((s) => {
      const start = atHour(dayOf(s.day), s.hour);
      const end = new Date(start.getTime() + DURATION_OF(s.type) * 60_000);
      const isPending = s.status === BookingRequestStatus.PENDING;
      const confirmedAt = isPending ? daysAgo(0.05) : (s.confirmedAt ?? daysAgo(3));
      const approvedAppointmentId = s.approvedAppointmentN ? uuid(G.appointment, 900 + s.approvedAppointmentN) : null;

      if (approvedAppointmentId && s.patientIdx !== undefined) {
        approvedAppointments.push({
          id: approvedAppointmentId,
          userId,
          patientId: patientId(s.patientIdx),
          typeId: s.type.id,
          locationId: LOCATIONS.office.id,
          startAt: start,
          endAt: end,
          price: s.type.defaultPrice,
          paid: false,
          status: AppointmentStatus.CONFIRMED,
          confirmedAt: s.resolvedAt ?? null,
          source: RecordSource.PORTAL,
          meetingStatus: MeetingStatus.NOT_REQUIRED,
          notes: 'Creada desde una solicitud aprobada.',
        });
      }

      return {
        id: uuid(G.request, s.n),
        userId,
        typeId: s.type.id,
        locationId: LOCATIONS.office.id,
        kind: s.kind,
        status: s.status,
        contactChannel: s.channel,
        email: s.channel === Channel.EMAIL ? s.email! : null,
        verifiedPhone: s.channel === Channel.WHATSAPP ? s.phone! : null,
        name: s.first,
        lastName: s.last,
        startAt: start,
        endAt: end,
        patientTimezone: TZ,
        holdExpiresAt: isPending ? holdFor(start) : (s.holdExpiresAt ?? (s.status === BookingRequestStatus.EXPIRED ? new Date(start.getTime() - 60 * 60 * 1000) : start)),
        nudgedAt: isPending ? nowDate : null,
        confirmedAt,
        confirmationSentAt: new Date(confirmedAt.getTime() - 5 * 60 * 1000),
        policyVersion: PRIVACY_POLICY_VERSION,
        consentAcceptedAt: confirmedAt,
        resolvedAt: s.resolvedAt ?? (s.status === BookingRequestStatus.EXPIRED ? new Date(start.getTime() - 60 * 60 * 1000) : null),
        resolvedBy: s.resolvedBy ?? null,
        patientId: s.patientIdx !== undefined ? patientId(s.patientIdx) : null,
        appointmentId: approvedAppointmentId,
      };
    });

    await tx.appointment.createMany({ data: [ ...appointmentRows, ...approvedAppointments ] });
    await tx.reminder.createMany({ data: reminderRows });

    // Evolution notes: the first three completed visits of each of the six record holders.
    const noteRows: Prisma.EvolutionNoteCreateManyInput[] = [];
    let noteN = 0;
    RECORDS.forEach((_, i) => {
      const visits = (completedByPatient.get(i) ?? []).slice(0, 3);
      for (const visit of visits) {
        noteN += 1;
        noteRows.push({
          id: uuid(G.note, noteN),
          medicalRecordId: uuid(G.record, i + 1),
          date: calendarDay(DateTime.fromJSDate(visit).setZone(TZ)),
          text: at(NOTES, (noteN - 1) % NOTES.length),
        });
      }
    });
    await tx.evolutionNote.createMany({ data: noteRows });

    await tx.blockedTime.createMany({
      data: [
        { day: 1, from: 12, to: 13, description: 'Almuerzo' },
        { day: 2, from: 12, to: 13, description: 'Almuerzo' },
        { day: 4, from: 12, to: 13, description: 'Almuerzo' },
        { day: 7, from: 12, to: 13, description: 'Almuerzo' },
        { day: -3, from: 17, to: 18, description: 'Supervisión clínica' },
        { day: 10, from: 17, to: 18, description: 'Supervisión clínica' },
      ].map((b, n) => ({
        id: uuid(G.blocked, n + 1),
        userId,
        description: b.description,
        startTimeUtc: atHour(dayOf(b.day), b.from),
        endTimeUtc: atHour(dayOf(b.day), b.to),
      })),
    });

    await tx.bookingRequest.createMany({ data: requestRows });

    console.log(
      `Mock data ready for ${maskEmail(TARGET_EMAIL)}: ${PATIENTS.length} patients, ${RECORDS.length} medical records, `
      + `${FAMILY_MEMBERS.length} family members, ${SUBSYSTEMS.length} subsystem relations, `
      + `${noteRows.length} evolution notes, ${appointmentRows.length + approvedAppointments.length} appointments, `
      + `${reminderRows.length} reminders, ${requestRows.length} booking requests, 6 blocked times.`,
    );
  }, { timeout: 120_000, maxWait: 20_000 });
}

seedData()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect().then(() => process.exit(process.exitCode ?? 0));
  });
