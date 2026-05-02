@AGENTS.md

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## Fundamental rules

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Project introduction

This will server as an admin dashboard for my order attribution shopify app, Origin.

## Writing code

Ensure code is clean and always follows the style of the existing code.

### Warnings

NEVER ask for env vars or search for them. Just stub them and ask me to add them in.

### Style guide

1. Do not use single line `if` statments, e.g.:

```typescript
if (condition) return true;
```

ALWAYS use multi-line statements:

```typescript
if (condition) {
  return true;
}
```

2. Always use double quotes for strings, never single quotes

3. Always include curly braces (`{}`) and an explicit return for named functions e.g.:

Bad:

```typescript
const function = () => "test"
```

Good:

```typescript
const function = () => {
  return "test";
}
```

For anonymous functions this does not apply, e.g.:

Good:

```typescript
arr.filter((el) => el.visible);
```

4. Use empty lines to separate groups of logic, you don't need to bunch everything next to each other

5. Prefer a single object parameter to functions over multiple, position-specific parameters

#### Supabase

1. Always name the error related to the query, even if its the only one in the block, e.g.

```typescript
const { data: shops, error: shopsError } = await supabase
  .from("shops")
  .select("shop");
```

2. Always use backticks and multi-line select statements with supabase, unless you are only fetching 1 parameter, e.g.

Bad:

```typescript
const { data: shops, error: shopsError } = await supabase
  .from("shops")
  .select("shop, lastInstalledAt, isInstalled, ...");
```

Good:

```typescript
const { data: shops, error: shopsError } = await supabase
  .from("shops")
  .select(`
    shop,
    lastInstalledAt,
    isInstalled,
    ...
  `);
```

3. Always select multiple rows and throw an error if its empty, rather than `.single()`, e.g.

```typescript
const { data: dataExportJobs, error: dataExportError } = await supabase
  .from("data_export_jobs")
  .select(`
    id,
    shop,
    status
  `)
  .eq("id", dataExportJobId);

if (dataExportError) {
  console.error(`[${dataExportJobId}] Error fetching data export job`, dataExportError);
  res.status(500).send({ success: false, error: "Error fetching data export job" });
  return;
}

if (dataExportJobs.length === 0) {
  console.error(`[${dataExportJobId}] Data export job not found`);
  res.status(404).send({ success: false, error: "Data export job not found" });
  return;
}
```

### TypeScript

1. Be strongly typed where possible, importing types where appropriate.

2. Do not use `any` unless absolutely necessary. When accessing JSON fields from the db through supabase using `any` is acceptable with appropriate presence checks.

3. Do not use `as` to manually cast a type unless absolutely necessary. You should fix the problem to make the type work as intended. Note sometimes this is necessary (e.g. to get around Shopify Polaris' overly string type definitions). It's only a problem when its NOT necessary (i.e. could be strongly typed with existing types).

3. Use `Array<T>` instead of `T[]`

4. Always used named types for react component props (placed direcly above the component), instead of writing the types inline

### React

1. All components must go in their own folder in the `components/` directory. e.g.

the `Banner` component would live in `components/banner/banner.tsx`.

Never place components in a page file or another components file (unless they are tightly coupled)
