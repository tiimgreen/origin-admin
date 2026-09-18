import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { formatPeriodLabel } from "@/lib/data/dates";
import { cn } from "@/lib/utils";

type MrrChangesTablePoint = {
  periodKey: string;
  newMrr: number;
  expansionMrr: number;
  churnedMrr: number;
  netChangeMrr: number;
};

type MrrChangesTableProps = {
  data: Array<MrrChangesTablePoint>;
};

type RowSpec = {
  label: string;
  getValue: (point: MrrChangesTablePoint) => number;
  signed: boolean;
};

const ROWS: Array<RowSpec> = [
  {
    label: "New",
    getValue: (point) => point.newMrr,
    signed: false,
  },
  {
    label: "Expansion",
    getValue: (point) => point.expansionMrr,
    signed: false,
  },
  {
    label: "Churn",
    getValue: (point) => -point.churnedMrr,
    signed: true,
  },
  {
    label: "Net change",
    getValue: (point) => point.netChangeMrr,
    signed: true,
  },
];

const formatChange = ({ value, signed }: { value: number; signed: boolean }) => {
  if (value === 0) {
    return formatCurrency({ amount: 0 });
  }

  const formatted = formatCurrency({ amount: Math.abs(value) });
  if (value < 0) {
    return `- ${formatted}`;
  }
  return signed || value > 0 ? `+ ${formatted}` : formatted;
};

const changeClassName = (value: number) => {
  return cn(
    "whitespace-nowrap text-right tabular-nums",
    value < 0 && "text-rose-600 dark:text-rose-400",
  );
};

export const MrrChangesTable = ({ data }: MrrChangesTableProps) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="sticky left-0 bg-card">Type</TableHead>
          {data.map((point) => {
            return (
              <TableHead key={point.periodKey} className="whitespace-nowrap text-right">
                {formatPeriodLabel(point.periodKey)}
              </TableHead>
            );
          })}
          <TableHead className="whitespace-nowrap text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map((row) => {
          const total = data.reduce((sum, point) => sum + row.getValue(point), 0);

          return (
            <TableRow key={row.label}>
              <TableCell className="sticky left-0 bg-card font-medium">
                {row.label}
              </TableCell>
              {data.map((point) => {
                const value = row.getValue(point);
                return (
                  <TableCell key={point.periodKey} className={changeClassName(value)}>
                    {formatChange({ value, signed: row.signed })}
                  </TableCell>
                );
              })}
              <TableCell className={cn(changeClassName(total), "font-medium")}>
                {formatChange({ value: total, signed: true })}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
