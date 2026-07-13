/**
 * Shared helpers for Server Actions.
 *
 * These live outside `actions.ts` because a `"use server"` file may only export
 * async functions — every export becomes a callable server endpoint. Plain helpers
 * have to be imported from a normal module.
 */

export type FormState = {
  fieldErrors?: Record<string, string[]>;
  formError?: string;
  /** Set on success, so the UI can confirm without a round trip. */
  success?: string;
  /**
   * What the user actually submitted, echoed back so a failed submission does not
   * throw their typing away.
   *
   * React 19 automatically resets an uncontrolled form once its action completes —
   * including when the action *failed*. Without this, someone who fills in four
   * fields and gets one validation error is handed an empty form and told to start
   * again. Rendering these as `defaultValue` restores what they wrote, because a
   * reset returns each input to its value attribute, which is exactly what
   * `defaultValue` sets.
   */
  values?: Record<string, string>;
};

/** Collect the submitted text fields, so a failed action can hand them back. */
export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    // Skip React's internal action plumbing ($ACTION_REF_1, $ACTION_KEY, …) and
    // anything that is not text (a File has no business being re-rendered here).
    if (key.startsWith("$")) continue;
    if (typeof value !== "string") continue;
    // Never echo a password back into the DOM.
    if (key.toLowerCase().includes("password")) continue;

    values[key] = value;
  }

  return values;
}

/**
 * A form field that may not be in the DOM at all.
 *
 * `FormData.get()` returns `null` for a missing field and `""` for one that is
 * present but blank. Zod treats both as values rather than absence, so an
 * `.optional()` field still fails validation when handed a `null`. Normalising to
 * `undefined` is what makes "optional" actually mean optional.
 *
 * This is not hypothetical: the invite form's "Shareable Link" tab has no email
 * input, and the resulting `null` failed validation on a field that was not on
 * screen. The button silently did nothing.
 */
export function optionalField(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Guarantees that a validation failure is always visible.
 *
 * A field error can only be rendered next to a field that is on screen — and a
 * form with tabs (or any conditional field) can produce an error for a field the
 * user cannot see. When that happens the submit button appears to do nothing at
 * all: no message, no clue, the worst failure mode a form has.
 *
 * So if a submission fails, always surface at least one message at form level.
 */
export function withFallbackError(
  fieldErrors: Record<string, string[] | undefined>,
  formData?: FormData,
): FormState {
  const messages = Object.values(fieldErrors).flatMap((errs) => errs ?? []);
  const values = formData ? formValues(formData) : undefined;

  if (messages.length === 0) return { values };

  return {
    fieldErrors: fieldErrors as Record<string, string[]>,
    formError: messages[0],
    values,
  };
}
