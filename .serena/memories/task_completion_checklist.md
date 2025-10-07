# Task Completion Checklist

## Code Quality
- [ ] TypeScript compilation passes (`npm run build`)
- [ ] Code follows established conventions (see code_style_conventions memory)
- [ ] Error handling implemented with proper MCP error responses
- [ ] Input validation with type guards where applicable
- [ ] JSDoc comments for public APIs and tool schemas

## Testing
- [ ] Manual testing with MCP inspector (`npm run inspector`)
- [ ] Test both STDIO and HTTP transport modes if relevant
- [ ] Verify error scenarios and edge cases
- [ ] Check environment variable handling

## Build and Deployment
- [ ] Build process completes successfully
- [ ] Executable permissions set on build output
- [ ] Package version updated if breaking changes
- [ ] CHANGELOG.md updated for significant changes

## Security and Performance
- [ ] No hardcoded secrets or sensitive data
- [ ] Rate limiting considered for HTTP mode
- [ ] CORS configuration appropriate for use case
- [ ] Input sanitization and validation in place

## Documentation
- [ ] README.md updated if API changes
- [ ] AGENTS.md reflects any new development patterns
- [ ] Memory files updated with new learnings or patterns