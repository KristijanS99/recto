# V1 Release Readiness — Design

## Goal

Bring Recto to production-quality standards for v1 release through comprehensive code review, security hardening, and code quality improvements — package by package.

## Review Order

1. `@recto/api` (foundation — all other packages depend on it)
2. `@recto/mcp` (depends on API)
3. `@recto/web` (least critical, secondary to MCP/API experience)
4. Cross-cutting: docs site accuracy, README, landing page

## Scope Per Package

### In Scope

- **Security**: Vulnerabilities, info leakage, input validation gaps, auth hardening
- **Code quality**: Constants/enums over magic strings, DRY (eliminate duplication), consistent patterns, proper types, reusable configuration
- **Error handling**: Completeness, consistency, no leaked internals
- **Tests**: Update/add tests for all changes
- **Docs**: Update README, docs site, landing page for any user-facing changes

### Specific Changes Agreed

- Enforce minimum 32-character API key at startup (hard fail)
- Tighten OAuth state validation
- Structured logging improvements
- Add MCP health check endpoint
- Full docs accuracy review

### Out of Scope

- Rate limiting
- Token revocation (RFC 7009)
- Accessibility pass on web UI
- CORS configuration (handled by reverse proxy)
- Web UI tests (not planned for v1)

## Process Per Package

1. **Code review** — thorough review for bugs, security, code quality
2. **Create fix/improvement list** — prioritized changes
3. **Implement changes** — fix issues, refactor as needed
4. **Update tests** — cover all changes
5. **Verify CI** — lint, typecheck, test, build all pass
6. **Update docs** — if anything user-facing changed

## Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Rate limiting | Skip for v1 | Adds complexity (needs store), self-hosted tool has limited exposure |
| Token revocation | Skip for v1 | No clear UX path — user never touches tokens directly, 90-day expiry is acceptable |
| API key min length | 32 chars, hard fail | Security baseline for production |
| CORS | Skip | Reverse proxy (Caddy) and Vite proxy handle this |
| Web accessibility | Skip | Web UI is secondary to MCP/API experience |
| Web tests | Skip | Not planned for v1 |
| Docs review | Full accuracy check | Docs must match implementation |
