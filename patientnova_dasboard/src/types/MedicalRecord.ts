import { today } from "../utils/TimeUtils";

export type MedicalRecord = {
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
    familyMembers?: FamilyMember[];
    evolutionNotes?: EvolutionNote[];
}

export type FormValues = {
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
    familyMembers?: FamilyMember[];
    evolutionNotes?: EvolutionNote[];
};

export type FamilyMember = {
    name: string;
    sex: Sex | "";
    age: string;
    relationship: Relationship | "";
    relation: string;
};

export type EvolutionNote = {
    id: string;
    date: string;
    text: string;
};

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
