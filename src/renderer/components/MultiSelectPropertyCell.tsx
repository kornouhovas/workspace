import { SelectionPropertyCell, type SelectionProps } from "./SelectionPropertyCell.js";
export function MultiSelectPropertyCell(props: SelectionProps) {
  return <SelectionPropertyCell {...props} multiple />;
}
