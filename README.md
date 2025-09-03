# Voice Agent Netlify

A React-based voice agent application built with Vite and deployed on Netlify.

## Development

```bash
cd client
npm install
npm run dev
```

## Building

```bash
cd client
npm run build
```

## Deployment

This project is configured for automatic deployment on Netlify. The build process:

1. Builds the React application using Vite
2. Outputs to `client/dist/`
3. Configures SPA routing with redirects

### Netlify Configuration

- **Build command**: `cd client && npm run build`
- **Publish directory**: `client/dist`
- **Node version**: 18

### SPA Routing

The application uses client-side routing. All routes are redirected to `index.html` to ensure proper SPA behavior.

## Project Structure

```
├── client/           # React application
│   ├── src/         # Source code
│   ├── dist/        # Build output
│   └── package.json # Dependencies
├── netlify.toml     # Netlify configuration
└── README.md        # This file
```
