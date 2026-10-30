import coreWebVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = [
  ...coreWebVitals,
  {
    rules: {
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    // Mascota de Invoke: librería entregada por Claude Design (dibujo y animaciones con
    // refs/Date.now en render a propósito). Se integra sin reescribirla; ver su README.
    files: ['src/components/invoke-mascot/**'],
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
    },
  },
];

export default eslintConfig;
