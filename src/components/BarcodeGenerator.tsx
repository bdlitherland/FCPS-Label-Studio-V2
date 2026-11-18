import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeGeneratorProps {
  value: string;
  format?: 'CODE128' | 'CODE39';
  height?: number;
  width?: number;
  fontSize?: number;
  displayValue?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const BarcodeGenerator: React.FC<BarcodeGeneratorProps> = ({
  value,
  format = 'CODE128',
  height = 36,
  width = 1.4,
  fontSize = 11,
  displayValue = true,
  className = '',
  style
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      const cleanValue = String(value).trim();
      if (!cleanValue) return;

      try {
        JsBarcode(svgRef.current, cleanValue, {
          format,
          height,
          width,
          fontSize,
          displayValue,
          marginTop: 1,
          marginBottom: 1,
          marginLeft: 10,
          marginRight: 10,
          background: '#ffffff',
          lineColor: '#000000',
          font: 'monospace'
        });
      } catch (err) {
        console.warn('JsBarcode render error for value:', cleanValue, err);
      }
    }
  }, [value, format, height, width, fontSize, displayValue]);

  if (!value) return null;

  return (
    <svg
      ref={svgRef}
      shapeRendering="crispEdges"
      preserveAspectRatio="xMidYMid meet"
      className={`max-w-full max-h-full bg-white ${className}`}
      style={style}
    />
  );
};
