const MONEY = new Intl.NumberFormat("es-CO", { useGrouping: "always", maximumFractionDigits: 0 });

export function fmtMoney(n: number): string {
    return `$ ${MONEY.format(n)}`;
}
