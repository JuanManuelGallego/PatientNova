/* eslint-disable jsx-a11y/alt-text */
import { Document, Image, Page, Text, View, pdf } from "@react-pdf/renderer";
import { FormValues, RELATIONSHIP_CFG, SEX_CFG } from "@/src/types/MedicalRecord";
import { fmtDate, todayString } from "@/src/utils/TimeUtils";
import { S } from "../styles/medicalRecordsPDFStyle";
import { User } from "../types/User";

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

function Antecedents(form: FormValues) {
  return (
    [
      [ "Desarrollo Temprano", form.earlyDevelopment ],
      [ "Escolar y Laboral", form.schoolAndWork ],
      [ "Hábitos y Estilo de Vida", form.lifestyleHabits ],
      [ "Eventos Traumáticos o Estresores Previos", form.traumaticEvents ],
      [ "Consideraciones Emocionales", form.emotionalConsiderations ],
      [ "Consideraciones Físicas, Etiología y de Salud", form.physicalConsiderations ],
      [ "Antecedentes Mentales", form.mentalHistory ],
      [ "Objetivo Clínico", form.objective ],
    ] as [ string, string | undefined ][]
  ).map(([ label, value ], i, arr) => (
    <View key={label}>
      <Field isText label={label} value={value} last={i === arr.length - 1} />
      <View style={S.divider} />
    </View>
  ))
}

function EvolitonNotes(form: FormValues) {
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
            {note.date ? fmtDate(note.date) : `Nota #${i + 1}`}
          </Text>
          <Text style={S.noteText}>{val(note.text, "Sin contenido.")}</Text>
          {i < arr.length - 1 && <View style={S.divider} />}
        </View>
      ))
  )
}

export function MedicalRecordPDF({ form, user }: { form: FormValues; user: User | null }) {
  return (
    <Document
      title={`Historia Clínica — ${val(form.name, "Paciente")}`}
      author={AUTHOR}
      creator={AUTHOR}
      subject="Historia Clínica Psicológica"
      language="es"
    >
      <PageLayout user={user}>
        <View>
          <View style={S.headerTop}>
            <Text style={S.headerTitle}>Historia Clínica</Text>
            <Image src={user?.altLogo} style={S.headerLogo} />
          </View>
          <View style={S.row2}>
            <View style={S.col}>
              <Field label="Nombre Completo" value={form.name} />
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
                label="Fecha de Nacimiento"
                value={form.birthDate ? fmtDate(form.birthDate) : "—"}
              />
            </View>
            <View style={S.col}>
              <Field label="Edad" value={form.age || "—"} />
            </View>
            <View style={S.col}>
              <Field label="Lugar de Nacimiento" value={form.birthPlace || "—"} />
            </View>
          </View>
          <View style={S.divider} />
          <Field isText label="Motivo de Consulta" value={form.consultationReason || "—"} last />
        </View>
        <View style={S.divider} />
        <View>
          <Text style={[ S.fieldTitle, { marginTop: -20 } ]}>Composición Familiar</Text>
          {FamilyMembers(form)}
          <Field isText label="Observaciones" value={form.familyObservations || "—"} last />
          <View style={[ S.divider, { marginTop: 20 } ]} />
        </View>
        <View style={{ marginTop: -20 }}>
          {Antecedents(form)}
        </View>
        <View>
          <Text style={S.fieldTitle}>Notas de Evolución</Text>
          {EvolitonNotes(form)}
        </View>
      </PageLayout>
    </Document>
  );
}

export async function downloadMedicalRecordPDF(user: User | null, form: FormValues) {
  const blob = await pdf(<MedicalRecordPDF form={form} user={user} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: `Historia Clínica — ${form.nationalId || "paciente"}.pdf`,
  });
  a.click();
  URL.revokeObjectURL(url);
}