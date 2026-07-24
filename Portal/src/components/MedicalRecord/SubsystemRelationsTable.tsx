"use client";

import {
    SubsystemRelation,
    SubsystemType,
    RelationshipStatus,
    SUBSYSTEM_CFG,
    STATUS_CFG,
    toSubsystemMap,
    toggleSubsystemRelation,
} from "@/src/types/MedicalRecord";
import styles from "./subsystem-relations-table.module.css";

type SubsystemRelationsTableProps = {
    relations: SubsystemRelation[];
    onChange: (relations: SubsystemRelation[]) => void;
};

const DISFUNCTIONAL_SUBCATEGORIES: { label: string; status: RelationshipStatus }[] = [
    { label: "Comunicación", status: RelationshipStatus.DISFUNCIONAL_COMUNICACION },
    { label: "Jerarquia", status: RelationshipStatus.DISFUNCIONAL_JERARQUIA },
    { label: "Limites", status: RelationshipStatus.DISFUNCIONAL_LIMITES },
];

export function SubsystemRelationsTable({
    relations,
    onChange,
}: SubsystemRelationsTableProps) {
    const subsystemMap = toSubsystemMap(relations);

    const handleCellClick = (subsystem: SubsystemType, status: RelationshipStatus) => {
        const updated = toggleSubsystemRelation(relations, subsystem, status);
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
                                {STATUS_CFG[ RelationshipStatus.FUNCIONAL ].label}
                            </th>
                            <th
                                className={`${styles.headerCell} ${styles.funcHead}`}
                                colSpan={DISFUNCTIONAL_SUBCATEGORIES.length}
                            >
                                {STATUS_CFG[ RelationshipStatus.DISFUNCIONAL ].label}
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
                        {Object.values(SubsystemType).map((subsystem) => (
                            <tr key={subsystem} className={styles.row}>
                                <td className={styles.rowHeader}>
                                    {SUBSYSTEM_CFG[ subsystem ].label}
                                </td>
                                <td
                                    className={`${styles.cell} ${styles.cellFunc}`}
                                    onClick={() => handleCellClick(subsystem, RelationshipStatus.FUNCIONAL)}
                                >
                                    {subsystemMap[ subsystem ]?.[ RelationshipStatus.FUNCIONAL ] && (
                                        <span className={`${styles.mark} ${styles.markFunc}`}>✓</span>
                                    )}
                                </td>
                                {DISFUNCTIONAL_SUBCATEGORIES.map(({ label, status }) => (
                                    <td
                                        key={`${subsystem}-${label}`}
                                        className={`${styles.cell} ${styles.cellDysfunc}`}
                                        onClick={() => handleCellClick(subsystem, status)}
                                    >
                                        {subsystemMap[ subsystem ]?.[ status ] && (
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