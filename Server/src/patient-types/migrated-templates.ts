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

/** When release B added the migrated keys a template doesn't show, so their copied values keep a label. */
export const LEGACY_REMOVED_AT = '2026-11-28T00:00:00.000Z';

const removed = (f: TemplateField): TemplateField => ({ ...f, removedAt: LEGACY_REMOVED_AT });
const section = (template: RecordTemplate, title: string) => template.sections.find((s) => s.title === title)!;

export const INDIVIDUAL_TEMPLATE_WITH_LEGACY: RecordTemplate = {
  sections: [
    ...INDIVIDUAL_TEMPLATE.sections,
    { title: 'Aspectos específicos de la familia', fields: section(FAMILY_TEMPLATE, 'Aspectos específicos de la familia').fields.map(removed) },
  ],
};

export const FAMILY_TEMPLATE_WITH_LEGACY: RecordTemplate = {
  sections: [
    ...FAMILY_TEMPLATE.sections,
    { title: 'Composición familiar', fields: section(INDIVIDUAL_TEMPLATE, 'Composición familiar').fields.map(removed) },
    { title: 'Antecedentes', fields: section(INDIVIDUAL_TEMPLATE, 'Antecedentes').fields.map(removed) },
  ],
};
