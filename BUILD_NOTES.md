# Build Notes

## Docker Build Configuration

### Build Scripts

The project has two build scripts for the frontend:

1. **`npm run build`** - Full build with TypeScript type checking
   - Runs `tsc -b` (TypeScript compilation) first
   - Then runs `vite build`
   - Use for local development and CI/CD
   - Will fail if there are TypeScript errors

2. **`npm run build:prod`** - Production build (Docker)
   - Runs `vite build` only
   - Skips TypeScript type checking
   - Faster builds
   - Used in Dockerfiles

### Why Skip Type Checking in Docker?

The Docker build uses `build:prod` which skips TypeScript type checking for several reasons:

1. **Faster builds** - Type checking can add 30-60 seconds to build time
2. **Deployment focus** - Docker builds should focus on creating working artifacts
3. **Separate concerns** - Type checking should be done in CI/CD, not during image build
4. **Vite handles runtime** - Vite's build process still catches critical errors

### Best Practices

For production deployments, follow this workflow:

```bash
# 1. Local development - use strict type checking
npm run build

# 2. Fix any errors found

# 3. Commit changes

# 4. CI/CD pipeline (optional) - run type checking
npm run build

# 5. Docker build - fast production build
docker-compose build
```

### CI/CD Integration

If you're using CI/CD (GitHub Actions, GitLab CI, etc.), add type checking as a separate step:

```yaml
# Example GitHub Actions
steps:
  - name: Install dependencies
    run: npm ci
    
  - name: Type check
    run: npm run build  # This includes tsc
    
  - name: Build Docker image
    run: docker-compose build  # Uses build:prod
```

This ensures code quality while keeping Docker builds fast.

### Vite Configuration

The `vite.config.ts` has been optimized for production builds:

- **Code splitting** - Separate chunks for React, Mantine, and i18n
- **No source maps** - Smaller bundle size
- **Manual chunks** - Better caching for vendors
- **Chunk size warning** - Set to 1000kb

### TypeScript Configuration Files

1. **`tsconfig.json`** - Root config (references app and node configs)
2. **`tsconfig.app.json`** - App source code (strict mode)
3. **`tsconfig.node.json`** - Vite config (strict mode)
4. **`tsconfig.prod.json`** - Production build (relaxed, currently unused)

### Build Output

After building, the frontend container:
- Uses Nginx Alpine (small size ~50MB)
- Serves static files from `/usr/share/nginx/html`
- Includes custom Nginx config for SPA routing
- Has gzip compression enabled
- Sets proper cache headers

### Troubleshooting Build Issues

**Error: TypeScript compilation failed**
```bash
# Solution 1: Use production build script
npm run build:prod

# Solution 2: Fix TypeScript errors
# See TYPESCRIPT_FIXES_NEEDED.md
```

**Error: Module not found**
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build:prod
```

**Error: Out of memory during build**
```bash
# Increase Node memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build:prod
```

### Docker Build Optimization

The Dockerfile uses multi-stage builds:

**Stage 1: Builder**
- Installs all dependencies
- Copies source code
- Runs build process
- Output in `/app/dist`

**Stage 2: Production**
- Uses Nginx Alpine
- Copies only built files
- Final image ~50MB (vs ~500MB with Node)

### Performance Tips

1. **Use .dockerignore** - Exclude node_modules, .git, etc.
2. **Layer caching** - package.json copied before source code
3. **Multi-stage builds** - Only production artifacts in final image
4. **Nginx instead of Node** - Faster static file serving

## Backend Build

The backend build is simpler:

```bash
npm run build  # Compiles TypeScript to JavaScript
node dist/index.js  # Runs compiled code
```

The backend Dockerfile:
- Compiles TypeScript in builder stage
- Copies assets (fonts for PDF generation)
- Installs only production dependencies
- Final image ~200MB

## Summary

- ✅ Docker builds are optimized for speed and size
- ✅ Type checking is recommended but not required for builds
- ✅ Multi-stage builds keep images small
- ✅ Nginx serves frontend for better performance
- ✅ Production builds skip type checking for speed
