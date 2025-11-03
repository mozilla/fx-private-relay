import React from "react";

const Svg = (props: React.SVGProps<SVGSVGElement>) => (
  <svg data-testid="svg-icon" {...props} />
);

export const MaskIcon = Svg;
export const PhoneIcon = Svg;
export const VpnIcon = Svg;

export const ChevronLeftIcon = Svg;
export const ChevronRightIcon = Svg;
export const QuotationIcon = Svg;

export const StarIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg data-testid="svg-icon" {...props} />
);
