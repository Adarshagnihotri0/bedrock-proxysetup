# Contributing to Bedrock Proxy

Thank you for your interest in contributing to Bedrock Proxy! This document provides guidelines and instructions for contributing.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Testing](#testing)
- [Documentation](#documentation)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

---

## Getting Started

1. Fork the repository
2. Clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/bedrock-proxy.git
   cd bedrock-proxy
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Set up environment:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

---

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+
- TypeScript 5+

### Running Locally

```bash
# Development mode with auto-reload
npm run dev

# Build TypeScript
npm run build

# Run production build
npm start
```

### Project Structure

```
bedrock-proxy/
├── src/
│   ├── index.ts          # Entry point
│   ├── server.ts         # Express routes
│   ├── bedrock.ts        # Bedrock integration
│   ├── adapters.ts       # Model adapters
│   ├── telegram-polling.ts
│   ├── db/               # Database layer
│   ├── middleware/       # Request middleware
│   ├── services/         # Business logic
│   ├── types/            # TypeScript types
│   └── utils/            # Utilities
├── migrations/           # SQL migrations
├── scripts/              # Operational scripts
├── docs/                 # Documentation
└── archive/              # Historical docs
```

---

## How to Contribute

### Reporting Bugs

Before submitting a bug report:

1. Check existing issues to avoid duplicates
2. Use a clear and descriptive title
3. Describe the exact steps to reproduce the problem
4. Include logs, screenshots, or error messages
5. Specify your environment (OS, Node version, etc.)

### Suggesting Features

1. Check existing issues and discussions
2. Use a clear and descriptive title
3. Provide a detailed description of the proposed feature
4. Explain why this feature would be useful
5. Include examples of how it would be used

### Submitting Changes

1. Create a new branch for your changes
2. Make your changes following [Coding Standards](#coding-standards)
3. Add tests if applicable
4. Update documentation
5. Submit a pull request

---

## Pull Request Process

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following coding standards

3. **Test your changes**:
   ```bash
   npm test
   npm run lint
   ```

4. **Commit your changes** with clear commit messages

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request**:
   - Use a clear title
   - Reference any related issues
   - Describe the changes made
   - Include testing instructions

7. **Code Review**:
   - Address review feedback
   - Keep changes focused
   - Respond to comments promptly

---

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Define types for all function parameters and returns
- Avoid `any` when possible
- Use interfaces for object shapes
- Use type aliases for unions/primitives

### Code Style

- Use 2-space indentation
- Use semicolons
- Use single quotes for strings
- Use `const` over `let` when possible
- Use async/await over raw promises

### Example

```typescript
// Good
interface MessageRequest {
  model: string;
  messages: Message[];
  max_tokens?: number;
}

async function processRequest(req: MessageRequest): Promise<Response> {
  const response = await sendToBedrock(req);
  return response;
}

// Avoid
async function processRequest(req: any): Promise<any> {
  let response = await sendToBedrock(req);
  return response
}
```

### Linting

Run the linter before committing:

```bash
npm run lint
```

---

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(api): add rate limiting to /v1/chat endpoint

fix(bedrock): handle timeout errors gracefully

docs(readme): update installation instructions
```

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- path/to/test.ts

# Run tests in watch mode
npm test -- --watch
```

### Writing Tests

- Write unit tests for utility functions
- Write integration tests for API endpoints
- Use descriptive test names
- Cover edge cases and error conditions

### Example

```typescript
describe('processRequest', () => {
  it('should return valid response for valid input', async () => {
    const request = { model: 'glm-5', messages: [...] };
    const response = await processRequest(request);
    expect(response.status).toBe(200);
  });

  it('should throw error for invalid input', async () => {
    const request = { model: '', messages: [] };
    await expect(processRequest(request)).rejects.toThrow();
  });
});
```

---

## Documentation

### Updating Documentation

When adding new features or changing behavior:

1. Update the README if it affects basic usage
2. Update docs in the `docs/` directory
3. Add JSDoc comments to new functions
4. Update API documentation

### JSDoc Format

```typescript
/**
 * Processes an incoming chat request and returns a response.
 * 
 * @param request - The message request containing model and messages
 * @returns A promise that resolves to the API response
 * @throws {Error} If the request is invalid or Bedrock fails
 * 
 * @example
 * ```typescript
 * const response = await processRequest({
 *   model: 'glm-5',
 *   messages: [{ role: 'user', content: 'Hello' }]
 * });
 * ```
 */
async function processRequest(request: MessageRequest): Promise<Response> {
  // ...
}
```

---

## Questions?

If you have questions about contributing:

1. Check existing [issues](https://github.com/<username>/bedrock-proxy/issues)
2. Start a [discussion](https://github.com/<username>/bedrock-proxy/discussions)
3. Email: <your-email@example.com>

---

## License

By contributing to Bedrock Proxy, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🎉
