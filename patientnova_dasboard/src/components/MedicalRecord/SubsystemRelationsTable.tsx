"use client";

import {
    SubsystemRelation,
    SubsistemaType,
    EstadoRelacion,
    SUBSISTEMA_CFG,
    ESTADO_CFG,
    toSubsystemMap,
    toggleSubsystemRelation,
} from "@/src/types/MedicalRecord";
import styles from "./SubsystemRelationsTable.module.css";

type SubsystemRelationsTableProps = {
    relations: SubsystemRelation[];
    onChange: (relations: SubsystemRelation[]) => void;
};

const DISFUNCTIONAL_SUBCATEGORIES: { label: string; estado: EstadoRelacion }[] = [
    { label: "Comunicación", estado: EstadoRelacion.DISFUNCIONAL_COMUNICACION },
    { label: "Jerarquia",    estado: EstadoRelacion.DISFUNCIONAL_JERARQUIA },
    { label: "Limites",      estado: EstadoRelacion.DISFUNCIONAL_LIMITES },
];

export function SubsystemRelationsTable({
    relations,
    onChange,
}: SubsystemRelationsTableProps) {
    const subsystemMap = toSubsystemMap(relations);

    const handleCellClick = (subsistema: SubsistemaType, estado: EstadoRelacion) => {
        const updated = toggleSubsystemRelation(relations, subsistema, estado);
        onChange(updated);
    };

    return (
        <div className={styles.container}>
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th className={`${styles.headerCell} ${styles.labelCol}`}>
                                Subsistema
                            </th>
                            <th className={`${styles.headerCell} ${styles.funcHead}`}>
                                {ESTADO_CFG[EstadoRelacion.FUNCIONAL].label}
                            </th>
                            <th
                                className={`${styles.headerCell} ${styles.funcHead}`}
                                colSpan={DISFUNCTIONAL_SUBCATEGORIES.length}
                            >
                                {ESTADO_CFG[EstadoRelacion.DISFUNCIONAL].label}
                            </th>
                        </tr>
                        <tr>
                            <th className={`${styles.subHeaderCell} ${styles.labelCol}`} />
                            <th className={`${styles.subHeaderCell} ${styles.funcSub}`} />
                            {DISFUNCTIONAL_SUBCATEGORIES.map(({ label }) => (
                                <th key={label} className={styles.subHeaderCell}>
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Object.values(SubsistemaType).map((subsistema) => (
                            <tr key={subsistema} className={styles.row}>
                                <td className={styles.rowHeader}>
                                    {SUBSISTEMA_CFG[subsistema].label}
                                </td>
                                <td
                                    className={`${styles.cell} ${styles.cellFunc}`}
                                    onClick={() => handleCellClick(subsistema, EstadoRelacion.FUNCIONAL)}
                                >
                                    {subsystemMap[subsistema]?.[EstadoRelacion.FUNCIONAL] && (
                                        <span className={`${styles.mark} ${styles.markFunc}`}>✓</span>
                                    )}
                                </td>
                                {DISFUNCTIONAL_SUBCATEGORIES.map(({ label, estado }) => (
                                    <td
                                        key={`${subsistema}-${label}`}
                                        className={`${styles.cell} ${styles.cellDysfunc}`}
                                        onClick={() => handleCellClick(subsistema, estado)}
                                    >
                                        {subsystemMap[subsistema]?.[estado] && (
                                            <span className={`${styles.mark} ${styles.markDysfunc}`}>✓</span>
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}