import * as path from 'path';
import { I18nOptions, Path } from 'nestjs-i18n';

export const i18nOptionsFactory = (
  fallbackLanguage: string = 'id',
): I18nOptions => ({
  fallbackLanguage,
  loaderOptions: {
    path: path.join(__dirname, '/'),
    watch: true,
  },
});

export type I18nPaths = Path<{
  authErrors: typeof import('./en/auth-errors.json');
}>;
