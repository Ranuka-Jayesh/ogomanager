# 🤝 Contributing to OGO Manager Pro

Thank you for your interest in contributing to OGO Manager Pro! This document provides guidelines and information for contributors.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Coding Standards](#coding-standards)

## 📜 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:

- Be respectful and inclusive
- Use welcoming and inclusive language
- Be constructive in feedback
- Focus on what's best for the community
- Show empathy towards other community members

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Git
- Supabase account (for database access)

### Development Setup

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/yourusername/ogo-manager.git
   cd ogo-manager
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

## 📝 Contributing Guidelines

### Types of Contributions

We welcome several types of contributions:

- 🐛 **Bug fixes**
- ✨ **New features**
- 📚 **Documentation improvements**
- 🎨 **UI/UX enhancements**
- ⚡ **Performance optimizations**
- 🧪 **Test coverage**

### Before You Start

1. **Check existing issues** - Look for open issues that match your contribution
2. **Create an issue** - For significant changes, create an issue first to discuss
3. **Ask questions** - Don't hesitate to ask questions in discussions

## 🔄 Pull Request Process

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number
```

### 2. Make Your Changes

- Write clean, readable code
- Follow our coding standards
- Add tests if applicable
- Update documentation

### 3. Commit Your Changes

```bash
git add .
git commit -m "feat: add new feature"
# or
git commit -m "fix: resolve issue #123"
```

**Commit Message Format:**
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

### 4. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## 🐛 Issue Reporting

### Before Creating an Issue

1. **Search existing issues** - Check if the issue already exists
2. **Check documentation** - Ensure it's not a configuration issue
3. **Try latest version** - Make sure you're using the latest code

### Issue Template

When creating an issue, please include:

```markdown
## Bug Report / Feature Request

**Description:**
A clear description of the issue or feature request.

**Steps to Reproduce:**
1. Go to '...'
2. Click on '....'
3. See error

**Expected Behavior:**
What you expected to happen.

**Actual Behavior:**
What actually happened.

**Environment:**
- OS: [e.g., Windows 10]
- Browser: [e.g., Chrome 91]
- Node.js version: [e.g., 18.0.0]

**Screenshots:**
If applicable, add screenshots.

**Additional Context:**
Any other context about the problem.
```

## 📏 Coding Standards

### TypeScript Guidelines

```typescript
// ✅ Good
interface UserProps {
  id: string;
  name: string;
  email: string;
}

const UserComponent: React.FC<UserProps> = ({ id, name, email }) => {
  return <div>{name}</div>;
};

// ❌ Avoid
const UserComponent = (props: any) => {
  return <div>{props.name}</div>;
};
```

### React Guidelines

```typescript
// ✅ Good - Use functional components
const MyComponent: React.FC<Props> = ({ title }) => {
  const [state, setState] = useState('');
  
  useEffect(() => {
    // Effect logic
  }, []);
  
  return <div>{title}</div>;
};

// ✅ Good - Custom hooks
const useCustomHook = () => {
  const [data, setData] = useState(null);
  return { data, setData };
};
```

### CSS Guidelines

```css
/* ✅ Good - Use Tailwind classes */
<div className="flex items-center justify-between p-4 bg-[#1a1818] rounded-lg">

/* ✅ Good - Custom CSS when needed */
.custom-component {
  @apply flex items-center;
  background: linear-gradient(45deg, #E16428, #ffb86b);
}
```

### File Naming

```
components/
├── Dashboard.tsx           # PascalCase for components
├── ProjectManagement.tsx
└── ProjectModal.tsx

hooks/
├── useProjects.ts         # camelCase for hooks
└── useEmployees.ts

types/
└── index.ts              # lowercase for utilities
```

## 🧪 Testing

### Running Tests

```bash
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

### Writing Tests

```typescript
// Example test
import { render, screen } from '@testing-library/react';
import { Dashboard } from './Dashboard';

describe('Dashboard', () => {
  it('renders dashboard title', () => {
    render(<Dashboard />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
```

## 📚 Documentation

### Code Documentation

```typescript
/**
 * Calculates the total revenue for a given month
 * @param projects - Array of project objects
 * @param month - Target month (1-12)
 * @returns Total revenue for the month
 */
const calculateMonthlyRevenue = (projects: Project[], month: number): number => {
  // Implementation
};
```

### README Updates

When adding new features:
1. Update the main README.md
2. Add screenshots if applicable
3. Update the features list
4. Document any new environment variables

## 🚀 Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR** - Breaking changes
- **MINOR** - New features (backward compatible)
- **PATCH** - Bug fixes (backward compatible)

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Version bumped
- [ ] Tagged and released

## 💡 Tips for Contributors

### Getting Help

- 💬 **Discussions** - Use GitHub Discussions for questions
- 📖 **Documentation** - Check the README and code comments
- 🔍 **Search Issues** - Look for similar issues or solutions

### Best Practices

1. **Start Small** - Begin with small, focused contributions
2. **Test Thoroughly** - Test your changes locally
3. **Write Tests** - Add tests for new features
4. **Document Changes** - Update documentation as needed
5. **Be Patient** - Review process may take time

### Common Mistakes to Avoid

- ❌ Don't commit directly to main branch
- ❌ Don't ignore TypeScript errors
- ❌ Don't skip testing
- ❌ Don't forget to update documentation
- ❌ Don't make too many changes in one PR

## 🎉 Recognition

Contributors will be recognized in:
- 📄 CONTRIBUTORS.md file
- 🏆 GitHub contributor graph
- 🎖️ Special badges for significant contributions

## 📞 Contact

- **Maintainer**: OGO Technology Team
- **Email**: contact@ogo.technology
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/ogo-manager/discussions)

---

Thank you for contributing to OGO Manager Pro! 🚀
