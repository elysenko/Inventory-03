import { Routes } from '@angular/router';
import { authGuard, managerGuard } from './core/guards';

/**
 * Every navigable state is URL-addressable and deep-linkable: a cold load of
 * any route below renders that screen directly, without first visiting another.
 */
export const routes: Routes = [
  {
    path: 'login',
    data: { flow: 'auth.login' },
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'signup',
    data: { flow: 'auth.signup' },
    loadComponent: () => import('./features/auth/signup.component').then((m) => m.SignupComponent),
  },

  {
    path: 'items',
    canActivate: [authGuard],
    data: { flow: 'items.list' },
    loadComponent: () => import('./features/items/item-list.component').then((m) => m.ItemListComponent),
  },
  {
    path: 'items/new',
    canActivate: [managerGuard],
    data: { flow: 'items.create', mode: 'create' },
    loadComponent: () => import('./features/items/item-form.component').then((m) => m.ItemFormComponent),
  },
  {
    path: 'items/:id/edit',
    canActivate: [managerGuard],
    data: { flow: 'items.edit', mode: 'edit' },
    loadComponent: () => import('./features/items/item-form.component').then((m) => m.ItemFormComponent),
  },
  {
    path: 'items/:id',
    canActivate: [authGuard],
    data: { flow: 'items.detail' },
    loadComponent: () => import('./features/items/item-detail.component').then((m) => m.ItemDetailComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'locations' },
      {
        path: 'locations',
        data: { flow: 'items.detail.locations' },
        loadComponent: () =>
          import('./features/items/item-locations-tab.component').then((m) => m.ItemLocationsTabComponent),
      },
      {
        path: 'movements',
        data: { flow: 'items.detail.movements' },
        loadComponent: () =>
          import('./features/items/item-movements-tab.component').then((m) => m.ItemMovementsTabComponent),
      },
    ],
  },

  {
    path: 'locations',
    canActivate: [authGuard],
    data: { flow: 'locations.list' },
    loadComponent: () =>
      import('./features/locations/location-list.component').then((m) => m.LocationListComponent),
  },
  {
    path: 'locations/new',
    canActivate: [managerGuard],
    data: { flow: 'locations.create', mode: 'create' },
    loadComponent: () =>
      import('./features/locations/location-form.component').then((m) => m.LocationFormComponent),
  },
  {
    path: 'locations/:id/edit',
    canActivate: [managerGuard],
    data: { flow: 'locations.edit', mode: 'edit' },
    loadComponent: () =>
      import('./features/locations/location-form.component').then((m) => m.LocationFormComponent),
  },

  {
    path: 'movements/new',
    canActivate: [authGuard],
    data: { flow: 'movements.create' },
    loadComponent: () =>
      import('./features/movements/movement-form.component').then((m) => m.MovementFormComponent),
  },
  {
    path: 'movements',
    canActivate: [managerGuard],
    data: { flow: 'movements.log' },
    loadComponent: () =>
      import('./features/movements/movement-log.component').then((m) => m.MovementLogComponent),
  },

  {
    path: 'reports/low-stock',
    canActivate: [managerGuard],
    data: { flow: 'reports.lowStock' },
    loadComponent: () => import('./features/reports/low-stock.component').then((m) => m.LowStockComponent),
  },
  {
    path: 'admin/settings',
    canActivate: [managerGuard],
    data: { flow: 'admin.settings' },
    loadComponent: () => import('./features/admin/settings.component').then((m) => m.SettingsComponent),
  },

  { path: '', pathMatch: 'full', redirectTo: 'items' },
  { path: '**', redirectTo: 'items' },
];
