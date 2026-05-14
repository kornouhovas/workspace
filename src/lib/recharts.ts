import type { ReactNode } from "react"

export { Area } from "recharts/es6/cartesian/Area.js"
export { AreaChart } from "recharts/es6/chart/AreaChart.js"
export { CartesianGrid } from "recharts/es6/cartesian/CartesianGrid.js"
export { Legend } from "recharts/es6/component/Legend.js"
export { ResponsiveContainer } from "recharts/es6/component/ResponsiveContainer.js"
export { Tooltip } from "recharts/es6/component/Tooltip.js"
export { XAxis } from "recharts/es6/cartesian/XAxis.js"

export type TooltipValueType =
  | number
  | string
  | Array<number | string>

export type DefaultLegendContentProps = {
  payload?: Array<{
    color?: string
    dataKey?: number | string
    type?: string
    value?: unknown
  }>
  verticalAlign?: "bottom" | "middle" | "top"
}

export type DefaultTooltipContentProps<
  ValueType = TooltipValueType,
  NameType = number | string,
> = {
  accessibilityLayer?: boolean
  active?: boolean
  color?: string
  formatter?: (
    value: ValueType,
    name: NameType,
    item: TooltipPayloadItem<ValueType, NameType>,
    index: number,
    payload: Array<TooltipPayloadItem<ValueType, NameType>>,
  ) => ReactNode
  label?: ReactNode
  labelClassName?: string
  labelFormatter?: (
    label: ReactNode,
    payload: Array<TooltipPayloadItem<ValueType, NameType>>,
  ) => ReactNode
  payload?: Array<TooltipPayloadItem<ValueType, NameType>>
}

type TooltipPayloadItem<ValueType, NameType> = {
  color?: string
  dataKey?: number | string
  fill?: string
  name?: NameType
  payload?: Record<string, unknown>
  type?: string
  value?: ValueType
}
