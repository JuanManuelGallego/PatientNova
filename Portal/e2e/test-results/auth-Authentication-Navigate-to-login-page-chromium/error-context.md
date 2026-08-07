# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication >> Navigate to login page
- Location: e2e\tests\auth.spec.ts:12:7

# Error details

```
Error: locator.fill: Error: strict mode violation: getByLabel('Contraseña') resolved to 2 elements:
    1) <input value="" required="" type="password" name="password" class="form-input" placeholder="••••••••" autocomplete="current-password"/> aka getByRole('textbox', { name: 'Contraseña Mostrar contraseña' })
    2) <button type="button" tabindex="-1" class="password-toggle" aria-label="Mostrar contraseña">…</button> aka getByRole('button', { name: 'Mostrar contraseña' })

Call log:
  - waiting for getByLabel('Contraseña')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - alert [ref=e2]
  - generic [ref=e4]:
    - generic [ref=e5]:
      - img "Patient Nova" [ref=e6]
      - heading "PatientNova" [level=1] [ref=e7]
      - paragraph [ref=e8]: Inicia sesión en tu cuenta
    - generic [ref=e9]:
      - generic [ref=e10]:
        - text: Correo electrónico
        - textbox "Correo electrónico" [active] [ref=e11]:
          - /placeholder: correo@ejemplo.com
          - text: playwright@patientnova.net
      - generic [ref=e12]:
        - text: Contraseña
        - generic [ref=e13]:
          - textbox "Contraseña Mostrar contraseña" [ref=e14]:
            - /placeholder: ••••••••
          - button "Mostrar contraseña" [ref=e15] [cursor=pointer]
      - button "Iniciar sesión" [disabled] [ref=e19]
      - button "Volver al inicio" [ref=e20] [cursor=pointer]
```

# Test source

```ts
  1  | import { BasePage } from './BasePage';
  2  | import { expect } from '@playwright/test';
  3  | 
  4  | export class LoginPage extends BasePage {
  5  |   readonly emailInput = this.page.getByLabel('Correo electrónico');
  6  |   readonly passwordInput = this.page.getByLabel('Contraseña');
  7  |   readonly submitButton = this.page.getByRole('button', { name: 'Iniciar sesión' });
  8  |   readonly errorMessage = this.page.getByRole('alert');
  9  | 
  10 |   async login(email: string, password: string) {
  11 |     await this.goto('/login');
  12 |     await this.emailInput.fill(email);
> 13 |     await this.passwordInput.fill(password);
     |                              ^ Error: locator.fill: Error: strict mode violation: getByLabel('Contraseña') resolved to 2 elements:
  14 |     await this.submitButton.click();
  15 |     await this.page.waitForURL(/\/dashboard/);
  16 |   }
  17 | 
  18 |   async expectError() {
  19 |     await expect(this.errorMessage).toBeVisible();
  20 |   }
  21 | }
  22 | 
```