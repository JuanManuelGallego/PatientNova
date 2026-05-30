import { today } from "../utils/TimeUtils";

// ─── Subsystem enums ──────────────────────────────────────────────────────────

export enum SubsistemaType {
    CONYUGAL = "CONYUGAL",
    PARENTAL = "PARENTAL",
    FILIAL = "FILIAL",
    FRATERNO = "FRATERNO",
}

export enum EstadoRelacion {
    FUNCIONAL = "FUNCIONAL",
    DISFUNCIONAL = "DISFUNCIONAL",
    DISFUNCIONAL_COMUNICACION = "DISFUNCIONAL_COMUNICACION",
    DISFUNCIONAL_JERARQUIA = "DISFUNCIONAL_JERARQUIA",
    DISFUNCIONAL_LIMITES = "DISFUNCIONAL_LIMITES",
}

export const SUBSISTEMA_CFG: Record<SubsistemaType, { label: string }> = {
    [ SubsistemaType.CONYUGAL ]: { label: "Conyugal" },
    [ SubsistemaType.PARENTAL ]: { label: "Parental" },
    [ SubsistemaType.FILIAL ]: { label: "Filial" },
    [ SubsistemaType.FRATERNO ]: { label: "Fraterno" },
};

export const ESTADO_CFG = {
    [ EstadoRelacion.FUNCIONAL ]: { label: "Funcional" },
    [ EstadoRelacion.DISFUNCIONAL ]: { label: "Disfuncional" },
    [ EstadoRelacion.DISFUNCIONAL_COMUNICACION ]: { label: "Disfuncional" },
    [ EstadoRelacion.DISFUNCIONAL_JERARQUIA ]: { label: "Disfuncional" },
    [ EstadoRelacion.DISFUNCIONAL_LIMITES ]: { label: "Disfuncional" },
};

export type SubsystemRelation = {
    id?: string;
    subsistema: SubsistemaType;
    estado: EstadoRelacion;
    observacion?: string;
};

// Convenience: keyed map for quick lookup in forms / tables
// e.g. subsystemMap[SubsistemaType.PARENTAL][EstadoRelacion.DISFUNCIONAL]
export type SubsystemMap = Partial<
    Record<SubsistemaType, Partial<Record<EstadoRelacion, SubsystemRelation>>>
>;

// ─── Core types ───────────────────────────────────────────────────────────────

export interface MedicalRecord {
    id: string;
    patientId: string;
    name: string;
    nationalId: string;
    sex: Sex | "";
    age: string;
    birthDate: string;
    birthPlace: string;
    consultationReason: string;
    earlyDevelopment: string;
    schoolAndWork: string;
    lifestyleHabits: string;
    traumaticEvents: string;
    emotionalConsiderations: string;
    physicalConsiderations: string;
    mentalHistory: string;
    objective: string;
    familyObservations: string;

    // Family fields
    isFamily: boolean;
    familyType: string;
    lifecycle: string;
    genogram: string;
    ressources: string;
    difficulties: string;
    communication: string;
    rule: string;
    limits: string;
    familyContext: string;
    expectations: string;
    flexibility: string;

    // Relations
    familyMembers?: FamilyMember[];
    evolutionNotes?: EvolutionNote[];
    documents: MedicalDocument[];
    subsystemRelations?: SubsystemRelation[];
}

export interface FormValues {
    name: string;
    nationalId: string;
    sex: Sex | "";
    age: string;
    birthDate: string;
    birthPlace: string;
    consultationReason: string;
    earlyDevelopment: string;
    schoolAndWork: string;
    lifestyleHabits: string;
    traumaticEvents: string;
    emotionalConsiderations: string;
    physicalConsiderations: string;
    mentalHistory: string;
    objective: string;
    familyObservations: string;

    // Family fields
    isFamily: boolean;
    familyType: string;
    lifecycle: string;
    genogram: string;
    ressources: string;
    difficulties: string;
    communication: string;
    rule: string;
    limits: string;
    familyContext: string;
    expectations: string;
    flexibility: string;

    // Relations
    familyMembers?: FamilyMember[];
    evolutionNotes?: EvolutionNote[];
    documents: MedicalDocument[];
    subsystemRelations: SubsystemRelation[];
}

export interface FetchMedicalRecordFilters {
    patientId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
    orderBy?: 'createdAt' | 'updatedAt';
    order?: 'asc' | 'desc';
}

// ─── Family member ────────────────────────────────────────────────────────────

export type FamilyMember = {
    name: string;
    sex: Sex | "";
    age: string;
    relationship: Relationship | "";
    relation: string;
};

// ─── Evolution note ───────────────────────────────────────────────────────────

export type EvolutionNote = {
    id: string;
    date: string;
    text: string;
};

// ─── Sex ──────────────────────────────────────────────────────────────────────

export enum Sex {
    MALE = "MALE",
    FEMALE = "FEMALE",
    OTHER = "OTHER",
}

export const SEX_CFG: Record<Sex, { label: string }> = {
    [ Sex.MALE ]: { label: "Masculino" },
    [ Sex.FEMALE ]: { label: "Femenino" },
    [ Sex.OTHER ]: { label: "Otro" },
};

// ─── Relationship ─────────────────────────────────────────────────────────────

export enum Relationship {
    FATHER = "FATHER",
    MOTHER = "MOTHER",
    SIBLING = "SIBLING",
    DAUGHTER = "DAUGHTER",
    SON = "SON",
    SPOUSE = "SPOUSE",
    GRANDFATHER = "GRANDFATHER",
    GRANDMOTHER = "GRANDMOTHER",
    OTHER = "OTHER",
}

export const RELATIONSHIP_CFG: Record<Relationship, { label: string }> = {
    [ Relationship.FATHER ]: { label: "Padre" },
    [ Relationship.MOTHER ]: { label: "Madre" },
    [ Relationship.DAUGHTER ]: { label: "Hija" },
    [ Relationship.SON ]: { label: "Hijo" },
    [ Relationship.SPOUSE ]: { label: "Esposo/a" },
    [ Relationship.SIBLING ]: { label: "Hermano/a" },
    [ Relationship.GRANDFATHER ]: { label: "Abuelo" },
    [ Relationship.GRANDMOTHER ]: { label: "Abuela" },
    [ Relationship.OTHER ]: { label: "Otro" },
};

// ─── Medical document ─────────────────────────────────────────────────────────

export interface MedicalDocument {
    id: string;   // crypto.randomUUID()
    name: string;   // display name, user-editable
    mimeType: string;   // original MIME type
    sizeBytes: number;   // original file size for display
    data: string;   // base64 data-URL
    uploadedAt: string;   // ISO string
}

// ─── Factory helpers ──────────────────────────────────────────────────────────

export const createEmptyForm = (): FormValues => ({
    name: "",
    nationalId: "",
    sex: "",
    age: "",
    birthDate: "",
    birthPlace: "",
    consultationReason: "",
    earlyDevelopment: "",
    schoolAndWork: "",
    lifestyleHabits: "",
    traumaticEvents: "",
    emotionalConsiderations: "",
    physicalConsiderations: "",
    mentalHistory: "",
    objective: "",
    familyObservations: "",
    isFamily: false,
    familyType: "",
    lifecycle: "",
    genogram: "",
    ressources: "",
    difficulties: "",
    communication: "",
    rule: "",
    limits: "",
    familyContext: "",
    expectations: "",
    flexibility: "",
    familyMembers: [],
    evolutionNotes: [],
    documents: [],
    subsystemRelations: [],
});

export const createEmptyMember = (): FamilyMember => ({
    name: "",
    sex: "",
    age: "",
    relationship: "",
    relation: "",
});

export const createEmptyNote = (): EvolutionNote => ({
    id: crypto.randomUUID(),
    date: today().slice(0, 10),
    text: "",
});

export const createEmptySubsystemRelation = (
    subsistema: SubsistemaType,
    estado: EstadoRelacion,
): SubsystemRelation => ({
    subsistema,
    estado,
    observacion: "",
});

/** Build the full 4×2 matrix pre-populated with empty relations — useful
 *  when rendering the subsystem table so every cell is always bound. */
export const createDefaultSubsystemRelations = (): SubsystemRelation[] =>
    Object.values(SubsistemaType).flatMap((subsistema) =>
        Object.values(EstadoRelacion).map((estado) =>
            createEmptySubsystemRelation(subsistema, estado)
        )
    );

/** Convert a flat array to a nested map for O(1) cell lookups in the UI. */
export const toSubsystemMap = (relations: SubsystemRelation[]): SubsystemMap =>
    relations.reduce<SubsystemMap>((map, rel) => {
        if (!map[ rel.subsistema ]) map[ rel.subsistema ] = {};
        map[ rel.subsistema ]![ rel.estado ] = rel;
        return map;
    }, {});

/** Toggle helper: adds the relation if absent, removes it if present. */
export const toggleSubsystemRelation = (
    relations: SubsystemRelation[],
    subsistema: SubsistemaType,
    estado: EstadoRelacion,
): SubsystemRelation[] => {
    const exists = relations.some(
        (r) => r.subsistema === subsistema && r.estado === estado
    );
    return exists
        ? relations.filter((r) => !(r.subsistema === subsistema && r.estado === estado))
        : [ ...relations, createEmptySubsystemRelation(subsistema, estado) ];
};