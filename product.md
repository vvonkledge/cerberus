# Product: Cerberus

## What

Cerberus is a service that handles authentication and authorization so that other software doesn't have to. Applications connect to Cerberus to verify who their users are and what those users are allowed to do, keeping security logic in one place instead of scattered across every application that needs it.

## Who

Cerberus is for a solo developer building multiple web applications and backend services who wants a single, reliable auth system shared across all projects — rather than reimplementing login flows, permission checks, and user management in every new application.

## Features

- User registration — User can register an account with email and password
- User login — User can log in and receive a session or token
- Token management — System issues and validates tokens following OAuth 2.0 / OIDC standards
- Permission checks — Application can check whether a user has permission to perform an action
- Role definition — Admin can define roles and assign permissions to those roles
- Role assignment — Admin can assign roles to users
- Password reset — User can reset their password and recover their account
- API key management — System provides API keys for service-to-service authentication
- Audit logging — System logs all authentication and authorization events for review
