// Input rules shared by the API (validation) and the UI (form errors before sending).
import { z } from 'zod';

export const TITLE_MAX = 120;
export const BODY_MAX = 2000;

export const NewAvisoSchema = z
  .object({
    title: z.string().trim().min(1, 'Escreva um título.').max(TITLE_MAX, `Até ${TITLE_MAX} caracteres.`),
    body: z.string().trim().min(1, 'Escreva o aviso.').max(BODY_MAX, `Até ${BODY_MAX} caracteres.`),
  })
  .strict();

export type NewAviso = z.infer<typeof NewAvisoSchema>;
