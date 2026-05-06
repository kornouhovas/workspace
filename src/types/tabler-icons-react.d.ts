declare module "@tabler/icons-react/dist/esm/icons/*.mjs" {
  import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from "react"

  type TablerIconProps = Omit<SVGProps<SVGSVGElement>, "ref"> & {
    size?: number | string
    stroke?: number | string
    title?: string
  }

  const Icon: ForwardRefExoticComponent<
    TablerIconProps & RefAttributes<SVGSVGElement>
  >

  export default Icon
}
