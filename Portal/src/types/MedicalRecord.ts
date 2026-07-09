import { today } from "../utils/TimeUtils";

// ─── Subsystem enums ──────────────────────────────────────────────────────────

export enum SubsystemType {
    CONJUGAL = "CONJUGAL",
    PARENTAL = "PARENTAL",
    FILIAL = "FILIAL",
    FRATERNAL = "FRATERNAL",
}

export enum RelationshipStatus {
    FUNCIONAL = "FUNCIONAL",
    DISFUNCIONAL = "DISFUNCIONAL",
    DISFUNCIONAL_COMUNICACION = "DISFUNCIONAL_COMUNICACION",
    DISFUNCIONAL_JERARQUIA = "DISFUNCIONAL_JERARQUIA",
    DISFUNCIONAL_LIMITES = "DISFUNCIONAL_LIMITES",
}

export const SUBSYSTEM_CFG: Record<SubsystemType, { label: string }> = {
    [ SubsystemType.CONJUGAL ]: { label: "Conyugal" },
    [ SubsystemType.PARENTAL ]: { label: "Parental" },
    [ SubsystemType.FILIAL ]: { label: "Filial" },
    [ SubsystemType.FRATERNAL ]: { label: "Fraterno" },
};

export const STATUS_CFG = {
    [ RelationshipStatus.FUNCIONAL ]: { label: "Funcional" },
    [ RelationshipStatus.DISFUNCIONAL ]: { label: "Disfuncional" },
    [ RelationshipStatus.DISFUNCIONAL_COMUNICACION ]: { label: "Disfuncional" },
    [ RelationshipStatus.DISFUNCIONAL_JERARQUIA ]: { label: "Disfuncional" },
    [ RelationshipStatus.DISFUNCIONAL_LIMITES ]: { label: "Disfuncional" },
};

export type SubsystemRelation = {
    id?: string;
    subsystem: SubsystemType;
    status: RelationshipStatus;
    observation?: string;
};

// Convenience: keyed map for quick lookup in forms / tables
// e.g. subsystemMap[SubsystemType.PARENTAL][RelationshipStatus.DISFUNCIONAL]
export type SubsystemMap = Partial<
    Record<SubsystemType, Partial<Record<RelationshipStatus, SubsystemRelation>>>
>;

// ─── Core types ───────────────────────────────────────────────────────────────

export interface MedicalRecord {
    id: string;
    patientId: string;
    name: string;
    nationalId: string;
    sex: Sex | "";
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
    resources: string;
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
    resources: string;
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
    resources: "",
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
    subsystem: SubsystemType,
    status: RelationshipStatus,
): SubsystemRelation => ({
    subsystem: subsystem,
    status,
    observation: "",
});

/** Build the full 4×2 matrix pre-populated with empty relations — useful
 *  when rendering the subsystem table so every cell is always bound. */
export const createDefaultSubsystemRelations = (): SubsystemRelation[] =>
    Object.values(SubsystemType).flatMap((subsystem) =>
        Object.values(RelationshipStatus).map((status) =>
            createEmptySubsystemRelation(subsystem, status)
        )
    );

/** Convert a flat array to a nested map for O(1) cell lookups in the UI. */
export const toSubsystemMap = (relations: SubsystemRelation[]): SubsystemMap =>
    relations.reduce<SubsystemMap>((map, rel) => {
        if (!map[ rel.subsystem ]) map[ rel.subsystem ] = {};
        map[ rel.subsystem ]![ rel.status ] = rel;
        return map;
    }, {});

/** Toggle helper: adds the relation if absent, removes it if present. */
export const toggleSubsystemRelation = (
    relations: SubsystemRelation[],
    subsystem: SubsystemType,
    status: RelationshipStatus,
): SubsystemRelation[] => {
    const exists = relations.some(
        (r) => r.subsystem === subsystem && r.status === status
    );
    return exists
        ? relations.filter((r) => !(r.subsystem === subsystem && r.status === status))
        : [ ...relations, createEmptySubsystemRelation(subsystem, status) ];
};