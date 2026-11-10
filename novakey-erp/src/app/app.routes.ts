import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { ErpStore } from './core/erp-store';
import { Modulo } from './core/models';
import { Shell } from './layout/shell';

const requiereSesion: CanActivateFn = () =>
  inject(ErpStore).usuarioActual() ? true : inject(Router).createUrlTree(['/login']);

const requiereModulo = (modulo: Modulo): CanActivateFn => () =>
  inject(ErpStore).puede(modulo, 'ver') ? true : inject(Router).createUrlTree(['/panel']);

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login').then((m) => m.Login) },
  {
    path: '',
    component: Shell,
    canActivate: [requiereSesion],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'panel' },
      { path: 'panel', title: 'Panel general · NovaKey', loadComponent: () => import('./features/panel').then((m) => m.Panel) },
      { path: 'ventas', title: 'Ventas · NovaKey', canActivate: [requiereModulo('ventas')], loadComponent: () => import('./features/ventas').then((m) => m.Ventas) },
      { path: 'inventario', title: 'Inventario · NovaKey', canActivate: [requiereModulo('inventario')], loadComponent: () => import('./features/inventario').then((m) => m.Inventario) },
      { path: 'produccion', title: 'Producción · NovaKey', canActivate: [requiereModulo('produccion')], loadComponent: () => import('./features/produccion').then((m) => m.Produccion) },
      { path: 'compras', title: 'Compras · NovaKey', canActivate: [requiereModulo('compras')], loadComponent: () => import('./features/compras').then((m) => m.Compras) },
      { path: 'recursos-humanos', title: 'Recursos Humanos · NovaKey', canActivate: [requiereModulo('rh')], loadComponent: () => import('./features/recursos-humanos').then((m) => m.RecursosHumanos) },
      { path: 'accesos', title: 'Identidad y Accesos · NovaKey', canActivate: [requiereModulo('accesos')], loadComponent: () => import('./features/accesos').then((m) => m.Accesos) },
    ],
  },
  { path: '**', redirectTo: '' },
];
