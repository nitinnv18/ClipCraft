import tsParser from "@typescript-eslint/parser";

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "out/**", "dist/**"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          "args": "none",
          "caughtErrors": "none",
          "varsIgnorePattern": "^_"
        }
      ],
      "no-undef": "off",
    },
  },
];

export default eslintConfig;
