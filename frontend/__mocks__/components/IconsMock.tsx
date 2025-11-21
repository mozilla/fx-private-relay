import React from "react";

const Svg = (props: React.SVGProps<SVGSVGElement> & { alt?: string }) => {
  const ariaLabel = props["aria-label"] || props.alt;
  const { alt, ...svgProps } = props;
  return (
    <svg data-testid="svg-icon" {...svgProps} aria-label={ariaLabel}>
      {ariaLabel && <title>{ariaLabel}</title>}
    </svg>
  );
};

export const MaskIcon = Svg;
export const PhoneIcon = Svg;
export const VpnIcon = Svg;

export const ChevronLeftIcon = Svg;
export const ChevronRightIcon = Svg;
export const QuotationIcon = Svg;

export const StarIcon = Svg;
