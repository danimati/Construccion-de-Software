import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Estado, cop, doc, num } from './ui.jsx';

describe('formateadores', () => {
  it('cop formatea pesos y millones', () => {
    expect(cop(690000)).toBe('$690.000');
    expect(cop(4105500, 'corto')).toBe('$4,1 M');
  });

  it('num usa separador de miles es-CO', () => {
    expect(num(6200)).toBe('6.200');
  });

  it('doc arma el código con ceros a la izquierda', () => {
    expect(doc('OP', 3)).toBe('OP-0003');
    expect(doc('FAC', null)).toBe('—');
  });
});

describe('Estado', () => {
  it('muestra la etiqueta en texto y marca el tono', () => {
    const { container } = render(<Estado valor="bajo_minimo" />);
    expect(screen.getByText('Bajo mínimo')).toBeInTheDocument();
    expect(container.querySelector('.estado.alerta')).not.toBeNull();
  });

  it('usa el valor crudo si no hay traducción', () => {
    render(<Estado valor="desconocido" />);
    expect(screen.getByText('desconocido')).toBeInTheDocument();
  });
});
