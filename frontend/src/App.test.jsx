import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';
import { api } from './services/api';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('inicio de sesión', () => {
  for (const [rol, title] of [['RRHH', 'Portal de RRHH'], ['COLABORADOR', 'Mi portal']]) {
    it(`redirige a ${title} para ${rol}`, async () => {
      vi.spyOn(api, 'post').mockResolvedValue({ data: { token: 'token-prueba', usuario: { rol } } });
      const user = userEvent.setup();
      render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>);
      await user.type(screen.getByLabelText('Correo corporativo'), 'demo@example.test');
      await user.type(screen.getByLabelText('Contraseña'), 'clave-prueba');
      await user.click(screen.getByRole('button', { name: 'Ingresar' }));
      expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    });
  }
  it('redirige al login cuando no existe sesión', async () => {
    render(<MemoryRouter initialEntries={['/rrhh']}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Bienvenido de nuevo' })).toBeInTheDocument();
  });
});
