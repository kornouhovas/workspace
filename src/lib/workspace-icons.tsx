// bb 0.44.0 uses Hugeicons stroke-rounded. Keep legacy exports for product-only glyphs.
export * from "./lucide-icons";
import { forwardRef, type SVGProps } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import ArrowLeft01 from "@hugeicons/core-free-icons/ArrowLeft01Icon";
import ArrowRight01 from "@hugeicons/core-free-icons/ArrowRight01Icon";
import ArrowDown01 from "@hugeicons/core-free-icons/ArrowDown01Icon";
import ArrowUp01 from "@hugeicons/core-free-icons/ArrowUp01Icon";
import Cancel01 from "@hugeicons/core-free-icons/Cancel01Icon";
import Copy01 from "@hugeicons/core-free-icons/Copy01Icon";
import Delete02 from "@hugeicons/core-free-icons/Delete02Icon";
import Edit02 from "@hugeicons/core-free-icons/Edit02Icon";
import File01 from "@hugeicons/core-free-icons/File01Icon";
import Folder from "@hugeicons/core-free-icons/Folder01Icon";
import MoreHorizontal from "@hugeicons/core-free-icons/MoreHorizontalIcon";
import Search01 from "@hugeicons/core-free-icons/Search01Icon";
import Settings01 from "@hugeicons/core-free-icons/Settings01Icon";
import SidebarLeft from "@hugeicons/core-free-icons/SidebarLeftIcon";
import SidebarRight from "@hugeicons/core-free-icons/SidebarRightIcon";
import PlusSign from "@hugeicons/core-free-icons/PlusSignIcon";
import SlidersHorizontal from "@hugeicons/core-free-icons/SlidersHorizontalIcon";
import Tick02 from "@hugeicons/core-free-icons/Tick02Icon";
import CheckList from "@hugeicons/core-free-icons/CheckListIcon";
import FilterHorizontal from "@hugeicons/core-free-icons/FilterHorizontalIcon";
import InformationCircle from "@hugeicons/core-free-icons/InformationCircleIcon";
import ArrowExpand from "@hugeicons/core-free-icons/ArrowExpandIcon";
import LayoutTwoColumn from "@hugeicons/core-free-icons/LayoutTwoColumnIcon";
import Table01 from "@hugeicons/core-free-icons/Table01Icon";
const icon = (glyph: IconSvgElement) =>
  forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>((props, ref) => (
    <HugeiconsIcon
      ref={ref}
      icon={glyph}
      {...props}
      strokeWidth={typeof props.strokeWidth === "number" ? props.strokeWidth : 1.5}
    />
  ));
export const ChevronLeftIcon = icon(ArrowLeft01),
  ChevronRightIcon = icon(ArrowRight01),
  ChevronDownIcon = icon(ArrowDown01),
  ChevronUpIcon = icon(ArrowUp01),
  XIcon = icon(Cancel01),
  CopyIcon = icon(Copy01),
  Trash2Icon = icon(Delete02),
  PencilIcon = icon(Edit02),
  FileIcon = icon(File01),
  FolderIcon = icon(Folder),
  MoreHorizontalIcon = icon(MoreHorizontal),
  SearchIcon = icon(Search01),
  SettingsIcon = icon(Settings01),
  PanelLeftIcon = icon(SidebarLeft),
  PanelRightCloseIcon = icon(SidebarRight),
  PlusIcon = icon(PlusSign),
  SlidersHorizontalIcon = icon(SlidersHorizontal),
  CheckIcon = icon(Tick02),
  ListChecksIcon = icon(CheckList),
  ListFilterIcon = icon(FilterHorizontal),
  InfoIcon = icon(InformationCircle),
  SquareIcon = icon(ArrowExpand),
  Columns2Icon = icon(LayoutTwoColumn),
  TableIcon = icon(Table01);
