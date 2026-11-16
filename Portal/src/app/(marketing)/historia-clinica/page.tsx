import { FeaturePage } from "@/src/components/Landing/FeaturePage";
import { SCREENSHOTS } from "@/src/components/Landing/screenshots";
import { pageMetadata } from "@/src/utils/seo/pageMetadata";

const PATH = "/historia-clinica";

export const metadata = pageMetadata({
    path: PATH,
    title: "Historia clínica digital para tu consulta | Patient Nova",
    description:
        "Historia clínica digital para profesionales de la salud: antecedentes, notas de evolución, documentos y exportación a PDF, con historias individuales y familiares.",
});

export default function ClinicalRecordPage() {
    return (
        <FeaturePage
            path={PATH}
            badge="Historia clínica"
            title="Historia clínica digital para tu consulta"
            intro="Lleva la historia de cada paciente o familia en un solo lugar, con sus notas de evolución y documentos, y exporta un PDF cuando lo necesites."
            sections={[
                {
                    title: "Historia individual",
                    paragraphs: [
                        "Hoy la historia clínica sigue la estructura de la consulta psicológica, con secciones para:",
                    ],
                    bullets: [
                        "Datos generales e identificación del paciente.",
                        "Motivo de consulta y objetivo del proceso.",
                        "Desarrollo temprano, escolaridad y trabajo, hábitos y estilo de vida.",
                        "Eventos traumáticos, consideraciones emocionales y físicas, antecedentes de salud mental.",
                    ],
                    shot: SCREENSHOTS.medicalRecord,
                },
                {
                    title: "Historia familiar",
                    paragraphs: [
                        "Para la terapia de pareja y de familia, la historia incluye los miembros de la familia y su parentesco, espacio para el genograma y las relaciones entre subsistemas.",
                    ],
                    bullets: [
                        "Tipo de familia y ciclo vital.",
                        "Comunicación, reglas, límites y flexibilidad.",
                        "Recursos, dificultades, contexto familiar y expectativas.",
                    ],
                },
                {
                    title: "Notas de evolución y documentos",
                    paragraphs: [
                        "Registra una nota de evolución por sesión, con su fecha, y adjunta los documentos del proceso: consentimientos, informes o resultados.",
                        "Cuando necesites compartir o archivar la historia, la exportas a PDF.",
                    ],
                },
                {
                    title: "Datos protegidos",
                    paragraphs: [
                        "Los datos de identificación y contacto de tus pacientes se guardan cifrados, el acceso es por usuario y cada cambio queda en un registro de actividad. El tratamiento de datos sigue la Ley 1581 de 2012 de protección de datos personales.",
                    ],
                },
            ]}
        />
    );
}
