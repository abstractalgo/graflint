This app is built and run via `bun`. Bun is already installed and available.

`package.json` exposes the following commands, i.e. scripts:

- `dev` - runs app with Vite in dev mode
- `build` - build app with Vite
- `ts` - Typescript type checking
- `fmt` - code formatting with Prettier
- `lint` - linting with ESlint
- `lint:fix` - linting with ESlint and auto-fix all fixable lint errors

# Typescript

Use semantically meaningful Typescript types. Prefer narrower types over types that are too wide and ambigious. Prefer types that reference other types and create stronger coupling, if it semantically makes sense.

# Coding style

Take care about the separation of concerns. Try to meaningfully separate things that have business logic, from those that don't, and always consider if something is really tied to the business logic or not, and make choices based on that.
