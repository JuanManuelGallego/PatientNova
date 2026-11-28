/* eslint-disable jsx-a11y/alt-text */
import { Document, Image, Page, Text, View, pdf } from "@react-pdf/renderer";
import { FormValues, RELATIONSHIP_CFG, SEX_CFG, SUBSYSTEM_CFG, RelationshipStatus, SubsystemType, type RecordPatientType } from "@/src/types/MedicalRecord";
import { recordLayout, type RecordCard } from "@/src/utils/recordLayout";
import { fmtCalendarDay, getAge, todayString } from "@/src/utils/TimeUtils";
import { S } from "@/src/styles/medicalRecordsPDFStyle";
import { User } from "@/src/types/User";

const val = (v?: string, fallback = "—") => (v?.trim() ? v.trim() : fallback);

const sexLabel = (sex?: string) =>
  (sex && SEX_CFG[ sex as keyof typeof SEX_CFG ]?.label) || sex || "—";

const relationshipLabel = (rel?: string) =>
  (rel && RELATIONSHIP_CFG[ rel as keyof typeof RELATIONSHIP_CFG ]?.label) || rel || "—";

const AUTHOR = "Patient Nova";

function Field({
  label,
  value,
  last = false,
  underline = false,
  isText = false,
}: {
  label: string;
  value?: string;
  last?: boolean;
  underline?: boolean;
  isText?: boolean;
}) {
  const empty = !value?.trim();
  return (
    <View style={[ S.field, last ? S.fieldLast : {}, underline ? S.fieldUnderline : {} ]}>
      <Text style={isText ? S.fieldTitle : S.fieldLabel}>{label}</Text>
      <Text style={empty ? S.fieldValueEmpty : S.fieldValue}>
        {empty ? "Sin información" : value}
      </Text>
    </View>
  );
}

function PageLayout({
  children,
  user
}: {
  children: React.ReactNode;
  user: User | null;
}) {
  return (
    <Page size="A4" style={S.page}>
      <View style={S.body}>{children}</View>
      <View style={S.footer} fixed>
        <Image src={user?.logo} style={S.headerLogo} />
        <Text style={S.footerText}>
          Generado el {todayString()} · {AUTHOR}
        </Text>
        <Text
          style={S.footerBrand}
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
        />
      </View>
    </Page>
  );
}

function FamilyMembers(form: FormValues) {
  return !form.familyMembers?.length ? (
    <Text style={S.emptyText}>No se registraron miembros familiares.</Text>
  ) : (
    form.familyMembers.map((member, i) => (
      <View
        key={i}
        wrap={false}
        style={S.memberCard}
      >
        <Text style={S.memberName}>
          {val(member.name, `Miembro ${i + 1}`)} — {relationshipLabel(member.relationship)}
        </Text>
        <View style={S.row2}>
          <View>
            <Field label="Sexo" value={sexLabel(member.sex)} last />
          </View>
          <View >
            <Field label="Edad" value={member.age} last />
          </View>
        </View>
        <View style={S.row2}>
          <Field label="Descripción de la relación" value={member.relation} last />
        </View>
      </View>
    ))
  )
}

function TemplateValues(card: RecordCard, form: FormValues) {
  return card.fields.map((field, i, arr) => (
    <View key={field.key}>
      <Field isText label={field.label} value={form.data[ field.key ]} last={i === arr.length - 1} />
      <View style={S.divider} />
    </View>
  ));
}

function EvolutionNotes(form: FormValues) {
  return !form.evolutionNotes?.length ? (
    <Text style={S.emptyText}>No se han registrado notas de evolución.</Text>
  ) : (
    [ ...form.evolutionNotes ]
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
      .map((note, i, arr) => (
        <View
          key={i}
          style={[ S.noteCard, i === arr.length - 1 ? S.noteCardLast : {} ]}
        >
          <Text style={S.noteDate}>
            Nota de evolución — {note.date ? fmtCalendarDay(note.date) : `#${i + 1}`}
          </Text>
          <Text style={S.noteText}>{val(note.text, "Sin contenido.")}</Text>
          {i < arr.length - 1 && <View style={S.divider} />}
        </View>
      ))
  )
}

function SubsystemRelationsTable(form: FormValues) {
  const relations = form.subsystemRelations || [];

  if (!relations.length) {
    return (
      <Text style={S.emptyText}>
        No se han registrado relaciones entre subsistemas.
      </Text>
    );
  }

  const subsistems = Object.values(SubsystemType).filter((s) =>
    relations.some((r) => r.subsystem === s)
  );

  return (
    <View style={{ marginBottom: 16 }}>

      {/* ── Header row 1: group labels ── */}
      <View style={{ flexDirection: "row", borderBottom: "1px solid #ddd" }}>
        <Text style={{ width: "30%", fontSize: 9, paddingBottom: 4 }} />
        <Text
          style={{
            width: "14%",
            fontSize: 9,
            fontWeight: "bold",
            textAlign: "center",
            paddingBottom: 4,
          }}
        >
          Funcional
        </Text>
        <Text
          style={{
            width: "56%",
            fontSize: 9,
            fontWeight: "bold",
            textAlign: "center",
            paddingBottom: 4,
            borderLeft: "1px solid #ddd",
          }}
        >
          Disfuncional
        </Text>
      </View>

      {/* ── Header row 2: sub-column labels ── */}
      <View
        style={{
          flexDirection: "row",
          borderBottom: "1px solid #ddd",
          backgroundColor: "#fdf0eb",
        }}
      >
        <Text
          style={{
            width: "30%",
            fontSize: 9,
            fontWeight: "bold",
            paddingVertical: 4,
            paddingRight: 8,
          }}
        >
          Subsistema
        </Text>
        <Text
          style={{
            width: "14%",
            fontSize: 9,
            textAlign: "center",
            paddingVertical: 4,
          }}
        />
        <Text
          style={{
            width: "18%",
            fontSize: 9,
            textAlign: "center",
            paddingVertical: 4,
            borderLeft: "1px solid #ddd",
          }}
        >
          Comunicación
        </Text>
        <Text
          style={{
            width: "19%",
            fontSize: 9,
            textAlign: "center",
            paddingVertical: 4,
            borderLeft: "1px solid #ddd",
          }}
        >
          Jerarquía
        </Text>
        <Text
          style={{
            width: "19%",
            fontSize: 9,
            textAlign: "center",
            paddingVertical: 4,
            borderLeft: "1px solid #ddd",
          }}
        >
          Límites
        </Text>
      </View>

      {/* ── Body rows ── */}
      {subsistems.map((subsystem) => {
        const has = (status: RelationshipStatus) =>
          relations.some(
            (r) => r.subsystem === subsystem && r.status === status
          );

        return (
          <View
            key={subsystem}
            style={{
              flexDirection: "row",
              borderBottom: "1px solid #eee",
              paddingVertical: 6,
            }}
          >
            <Text style={{ width: "30%", paddingRight: 8, fontSize: 10 }}>
              {SUBSYSTEM_CFG[ subsystem ]?.label || subsystem}
            </Text>
            <Text style={{ width: "14%", fontSize: 10, textAlign: "center" }}>
              {has(RelationshipStatus.FUNCIONAL) ? "X" : ""}
            </Text>
            <Text
              style={{
                width: "18%",
                fontSize: 10,
                textAlign: "center",
                borderLeft: "1px solid #eee",
              }}
            >
              {has(RelationshipStatus.DISFUNCIONAL_COMUNICACION) ? "X" : ""}
            </Text>
            <Text
              style={{
                width: "19%",
                fontSize: 10,
                textAlign: "center",
                borderLeft: "1px solid #eee",
              }}
            >
              {has(RelationshipStatus.DISFUNCIONAL_JERARQUIA) ? "X" : ""}
            </Text>
            <Text
              style={{
                width: "19%",
                fontSize: 10,
                textAlign: "center",
                borderLeft: "1px solid #eee",
              }}
            >
              {has(RelationshipStatus.DISFUNCIONAL_LIMITES) ? "X" : ""}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Identity(form: FormValues) {
  return (
    <>
      <View style={S.row2}>
        <View style={S.col}>
          <Field label="Nombre completo" value={form.name} />
        </View>
        <View style={S.col}>
          <Field label="Documento nacional" value={form.nationalId || "—"} />
        </View>
        <View style={S.col}>
          <Field label="Sexo" value={sexLabel(form.sex)} />
        </View>
      </View>
      <View style={S.row2}>
        <View style={S.col}>
          <Field
            label="Fecha de nacimiento"
            value={form.birthDate ? fmtCalendarDay(form.birthDate) : "—"}
          />
        </View>
        <View style={S.col}>
          <Field label="Edad" value={form.birthDate ? String(getAge(form.birthDate) ?? "—") : "—"} />
        </View>
        <View style={S.col}>
          <Field label="Lugar de nacimiento" value={form.birthPlace || "—"} />
        </View>
      </View>
      <View style={S.divider} />
    </>
  );
}

/** The record as the patient type's template lays it out: active fields only, no removed fields or snapshots. */
export function MedicalRecordPDF({ form, type, user }: { form: FormValues; type: RecordPatientType; user: User | null }) {
  const cards = recordLayout(type.template, { familyMembers: type.familyMembersEnabled, subsystemRelations: type.subsystemRelationsEnabled });
  return (
    <Document
      title={`Historia Clínica — ${val(form.name, "Paciente")}`}
      author={AUTHOR}
      creator={AUTHOR}
      subject="Historia clínica"
      language="es"
    >
      <PageLayout user={user}>
        <View style={S.headerTop}>
          <Text style={S.headerTitle}>Historia clínica</Text>
          <Image src={user?.altLogo} style={S.headerLogo} />
        </View>
        {cards.map((card, i) => (
          <View key={`${i}-${card.title}`}>
            <Text style={S.fieldTitle}>{card.title}</Text>
            {card.identity && Identity(form)}
            {card.familyTable && FamilyMembers(form)}
            {TemplateValues(card, form)}
            {card.subsystemTable && (
              <View style={{ marginTop: 12 }}>
                <Text style={S.fieldTitle}>Relación entre subsistemas</Text>
                {SubsystemRelationsTable(form)}
              </View>
            )}
          </View>
        ))}
        <View>
          <Text style={S.fieldTitle}>Notas de evolución</Text>
          {EvolutionNotes(form)}
        </View>
      </PageLayout>
    </Document>
  );
}

export async function renderMedicalRecordPdf(user: User | null, form: FormValues, type: RecordPatientType): Promise<{ blob: Blob; filename: string }> {
  const blob = await pdf(<MedicalRecordPDF form={form} type={type} user={user} />).toBlob();
  return { blob, filename: `Historia Clínica — ${form.nationalId || "paciente"}.pdf` };
}
