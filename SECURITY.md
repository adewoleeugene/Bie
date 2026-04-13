# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in ChristBase, please report it responsibly. **Do not open a public GitHub issue.**

### How to Report

Email **security@christex.foundation** with:

- A description of the vulnerability
- Steps to reproduce the issue
- The potential impact
- Any suggested fixes (optional)

### What to Expect

| Step | Timeline |
|------|----------|
| Acknowledgment of your report | Within 48 hours |
| Initial assessment | Within 5 business days |
| Status update | Within 10 business days |
| Fix and disclosure | Coordinated with reporter |

### Scope

The following are in scope:

- Authentication and authorization bypasses
- Data exposure across tenant boundaries (multi-tenancy isolation)
- SQL injection, XSS, CSRF, and other OWASP Top 10 vulnerabilities
- Server-side request forgery (SSRF)
- Insecure direct object references
- Sensitive data exposure

The following are **out of scope**:

- Vulnerabilities in third-party dependencies (report these upstream)
- Social engineering attacks
- Denial of service attacks
- Issues in environments running outdated or unsupported versions

### Disclosure Policy

- We ask that you do not publicly disclose the vulnerability until a fix is available
- We will credit reporters in the release notes (unless you prefer to remain anonymous)
- We aim to release fixes within 30 days of confirmed vulnerabilities

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest release | Yes |
| Previous minor | Security fixes only |
| Older versions | No |

## Security Best Practices for Deployers

- Always use HTTPS in production
- Set a strong `NEXTAUTH_SECRET` (use `openssl rand -base64 32`)
- Use environment variables for all secrets (never commit `.env`)
- Keep dependencies updated (`npm audit`)
- Enable database SSL/TLS connections in production
- Restrict database access to application servers only

## Contact

- **Security reports**: security@christex.foundation
- **General inquiries**: opensource@christex.foundation
