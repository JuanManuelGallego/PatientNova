import type { RecordTemplate, TemplateField } from './record-template.js';

const field = (key: string, label: string): TemplateField => ({ key, label, kind: 'longText', required: false, removedAt: null });

const GENERAL_DATA = { title: 'Datos generales', fields: [ field('consultationReason', 'Motivo de consulta') ] };

export const INDIVIDUAL_TEMPLATE: RecordTemplate = {
  sections: [
    GENERAL_DATA,
    { title: 'Composición familiar', fields: [ field('familyObservations', 'Observaciones') ] },
    {
      title: 'Antecedentes',
      fields: [
        field('earlyDevelopment', 'Desarrollo temprano'),
        field('schoolAndWork', 'Escolar y laboral'),
        field('lifestyleHabits', 'Hábitos y estilo de vida'),
        field('traumaticEvents', 'Eventos traumáticos o estresores previos'),
        field('emotionalConsiderations', 'Consideraciones emocionales'),
        field('physicalConsiderations', 'Consideraciones físicas, etiología y de salud'),
        field('mentalHistory', 'Antecedentes mentales'),
        field('objective', 'Objetivo'),
      ],
    },
  ],
};

export const FAMILY_TEMPLATE: RecordTemplate = {
  sections: [
    GENERAL_DATA,
    {
      title: 'Aspectos específicos de la familia',
      fields: [
        field('familyType', 'Tipo de familia'),
        field('lifecycle', 'Ciclo vital'),
        field('genogram', 'Genograma'),
        field('resources', 'Recursos que tienen'),
        field('difficulties', 'Dificultades tienen'),
        field('communication', 'Comunicación'),
        field('rule', 'Reglas'),
        field('limits', 'Limites'),
        field('familyContext', 'Contexto familiar'),
        field('expectations', 'Expectativas'),
        field('flexibility', 'Flexibilidad al cambio'),
      ],
    },
  ],
};
