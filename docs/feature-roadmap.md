# Feature Roadmap

## Foundation

- Keep the MCP workspace config in version control so the team gets the same development tools.
- Use input variables for sensitive values instead of checking secrets into the repo.
- Validate that local filesystem access stays scoped to the workspace.

## Development Workflow

- Use GitHub MCP for repository search, issue review, and pull request management.
- Use Stitch for design and implementation support where external search or generation is useful.
- Use Playwright MCP for browser-based checks and workflow validation.
- Use Sequential Thinking for multi-step analysis, architecture decisions, and feature breakdowns.

## Product Planning

- Define the core data model and boundary between client, server, and storage.
- Add secure authentication and authorization before any user-facing data flow.
- Build audit logging for sensitive operations.
- Add validation and error handling across every user input path.

## Delivery

- Add repeatable tests for the critical paths first.
- Add CI checks for linting, formatting, and automated verification.
- Document any operational dependencies, secrets, and release steps.