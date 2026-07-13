import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Two of Nucleus's engineering rules are enforced here rather than left to
 * code review, because a rule that is only written down is a rule that drifts:
 *
 *   1. No `any`.
 *   2. No Supabase access outside the data layer. Components and routes must
 *      call named functions from `src/lib/data/*`; they may not build a
 *      Supabase client or hand-roll a query themselves. This is what keeps
 *      every query in one auditable place.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    name: "nucleus/no-any",
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },

  {
    name: "nucleus/data-layer-boundary",
    // Everything outside the data layer: routes, Server Actions, components.
    // Server Actions are included deliberately — they orchestrate and validate,
    // then delegate the actual query to src/lib/data/*.
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}", "src/hooks/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@supabase/supabase-js",
              message:
                "Do not talk to Supabase from a component or route. Add a named function in src/lib/data/* and call that instead.",
            },
            {
              name: "@supabase/ssr",
              message:
                "Do not create Supabase clients here. Use src/lib/supabase/* from within src/lib/data/*.",
            },
          ],
          patterns: [
            {
              group: ["@/lib/supabase", "@/lib/supabase/*"],
              message:
                "Supabase clients are an implementation detail of the data layer. Import a named function from src/lib/data/* instead.",
            },
          ],
        },
      ],
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated from the database schema; not hand-edited.
    "src/lib/types/database.types.ts",
  ]),
]);

export default eslintConfig;
