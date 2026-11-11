import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Brand rule: colours come from the tokens in globals.css, never raw HEX.
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
          message: "Raw HEX colour: use a design token class (e.g. bg-yellow-500) from globals.css.",
        },
        {
          selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]",
          message: "Raw HEX colour: use a design token class (e.g. bg-yellow-500) from globals.css.",
        },
      ],
    },
  },
  {
    // Product swatch colours under test (data a customer picks, not interface colours): the brand rule
    // is about the UI, so it doesn't apply to this file.
    files: ["src/lib/color-names.test.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
    // Old code kept for social videos, not part of the app.
    "archive/**",
  ]),
]);

export default eslintConfig;
