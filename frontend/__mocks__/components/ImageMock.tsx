import React from "react";

export type ImgSrc = { src: string } | string;
export type ImageProps = { alt?: string; src: ImgSrc; className?: string };

const ImageMock: React.FC<ImageProps> = ({ alt, src, className }) => {
  const resolved = typeof src === "string" ? src : src.src;
  return <img alt={alt ?? ""} src={resolved} className={className} />;
};

export default ImageMock;
